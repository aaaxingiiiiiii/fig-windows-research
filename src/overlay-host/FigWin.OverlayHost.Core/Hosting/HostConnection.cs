// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using FigWin.OverlayHost.Protocol;

namespace FigWin.OverlayHost.Hosting;

/// <summary>
/// 一个客户端连接的协议状态（docs/protocol.md 第 2–8 节，宿主一侧）：
/// 握手、身份和序号检查、角色隔离、show/hide 的顺序与竞态、状态回复、租期、发送队列上限、debugState。
/// 所有方法都在 OverlayHostCore.Gate 锁内执行。
/// </summary>
public sealed class HostConnection
{
    private readonly OverlayHostCore _host;
    private readonly IOutboundChannel _outbound;
    private readonly LineFramer _framer = new();
    private readonly ITimer _helloTimer;
    private ITimer? _leaseTimer;

    private bool _closed;
    private ClientRole? _role;
    private string? _session;
    private string? _connection;
    private RendererInfo? _renderer;
    private long _lastReceivedSeq;
    private long _sendSeq;

    // renderer 的显示状态
    private long _lastAcceptedSeq;
    private long _lastAppliedSeq;
    private CancellationTokenSource? _locateCancellation;
    private bool _displayIssued;
    private ShowSnapshot? _shown;
    private bool _foreground;
    private string _binding = "unavailable";
    private string _state = "hidden";
    private string _reason = "shutdown";
    private CaretSource? _caretSource;
    private PixelRect? _caretRect;
    private PixelRect? _overlayRect;
    private double? _locateMs;
    private double? _receiveToDisplayMs;

    internal HostConnection(OverlayHostCore host, IOutboundChannel outbound)
    {
        _host = host;
        _outbound = outbound;
        _helloTimer = host.Time.CreateTimer(
            _ =>
            {
                lock (_host.Gate)
                {
                    if (_role is null) CloseLocked("hello-timeout");
                }
            },
            null,
            TimeSpan.FromMilliseconds(host.Options.HelloTimeoutMs),
            Timeout.InfiniteTimeSpan);
    }

    /// <summary>连接关闭的原因；尚未关闭时为 null。</summary>
    public string? CloseReason { get; private set; }

    public bool IsClosed
    {
        get
        {
            lock (_host.Gate) return _closed;
        }
    }

    internal string? RendererSession => _role == ClientRole.Renderer ? _session : null;

    /// <summary>传输层收到字节时调用。</summary>
    public void Receive(ReadOnlySpan<byte> bytes)
    {
        lock (_host.Gate)
        {
            if (_closed) return;
            IReadOnlyList<byte[]> lines;
            try
            {
                lines = _framer.Push(bytes);
            }
            catch (FramingException e)
            {
                FailLocked(ErrorCodes.InvalidMessage, e.Message, canReply: false);
                return;
            }
            foreach (var line in lines)
            {
                if (_closed) return;
                HandleLineLocked(line);
            }
        }
    }

    /// <summary>传输层读到 EOF 或连接出错时调用。异常 EOF 与 bye 同样清理（第 4 节）。</summary>
    public void ReceiveEof()
    {
        lock (_host.Gate) CloseLocked("eof");
    }

    // ---- 消息处理 ----

    private void HandleLineLocked(byte[] line)
    {
        var result = ClientMessageParser.Parse(line);
        if (result.Failure is { } failure)
        {
            // 只有信封可以安全识别、并且与本连接已锁定的身份一致时，才先回复 error
            var canReply = failure.Session is not null && failure.Connection is not null
                && (_session is null ? true : failure.Session == _session && failure.Connection == _connection);
            if (canReply && _session is null)
            {
                _session = failure.Session;
                _connection = failure.Connection;
            }
            FailLocked(failure.Code, failure.Detail, canReply);
            return;
        }

        var message = result.Message!;
        if (_role is null)
        {
            if (message is not HelloMessage hello)
            {
                _session = message.Session;
                _connection = message.Connection;
                FailLocked(ErrorCodes.InvalidMessage, "expected hello", canReply: true);
                return;
            }
            HandleHelloLocked(hello);
            return;
        }

        if (message.Session != _session || message.Connection != _connection)
        {
            FailLocked(ErrorCodes.InvalidMessage, "identity mismatch", canReply: true);
            return;
        }
        if (message.Seq <= _lastReceivedSeq)
        {
            FailLocked(ErrorCodes.InvalidMessage, "seq did not increase", canReply: true);
            return;
        }
        _lastReceivedSeq = message.Seq;
        RenewLeaseLocked();

        switch (message)
        {
            case HelloMessage:
                FailLocked(ErrorCodes.InvalidMessage, "duplicate hello", canReply: true);
                break;
            case PingMessage ping:
                SendLocked(HostMessageWriter.Pong(NextEnvelope(), ping.Seq));
                break;
            case ByeMessage:
                CloseLocked("bye");
                break;
            case ShowMessage show when _role == ClientRole.Renderer:
                ShowLocked(show);
                break;
            case HideMessage hide when _role == ClientRole.Renderer:
                HideLocked(hide.Seq, hide.Reason);
                break;
            case DebugStateRequest request when _role == ClientRole.Debug:
                SendLocked(HostMessageWriter.DebugStateResult(NextEnvelope(), request.RequestId, request.TargetSession, _host.GetDebugStateLocked(request.TargetSession)));
                break;
            default:
                FailLocked(ErrorCodes.WrongRole, $"{message.GetType().Name} is not allowed for {_role}", canReply: true);
                break;
        }
    }

    private void HandleHelloLocked(HelloMessage hello)
    {
        _helloTimer.Dispose();
        _role = hello.Role;
        _session = hello.Session;
        _connection = hello.Connection;
        _lastReceivedSeq = hello.Seq;
        if (hello.Role == ClientRole.Renderer)
        {
            _renderer = new RendererInfo(hello.Session, hello.Connection, hello.Pid, hello.WtSession);
            _host.RegisterRendererLocked(this, hello.Session);
        }
        SendLocked(HostMessageWriter.Welcome(NextEnvelope(), _host.HostInstance));
        RenewLeaseLocked();
    }

    private void ShowLocked(ShowMessage show)
    {
        _lastAcceptedSeq = show.Seq;
        _locateCancellation?.Cancel();
        var cancellation = new CancellationTokenSource();
        _locateCancellation = cancellation;
        var received = _host.Time.GetTimestamp();
        var renderer = _renderer!;

        Task<LocateResult> locate;
        try
        {
            locate = _host.Presenter.LocateAsync(renderer, show.Snapshot, cancellation.Token);
        }
        catch (Exception)
        {
            locate = Task.FromResult<LocateResult>(new LocateResult.Failed(FailReason.PositionUnavailable));
        }
        // 定位在锁外进行；完成后重新进入锁，并检查这条 show 是否仍是最新的（P-03）
        locate.ContinueWith(task => OnLocated(show, received, task, cancellation), CancellationToken.None,
            TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);
    }

    private void OnLocated(ShowMessage show, long received, Task<LocateResult> task, CancellationTokenSource cancellation)
    {
        lock (_host.Gate)
        {
            if (_closed || cancellation.IsCancellationRequested || show.Seq != _lastAcceptedSeq) return;
            _locateCancellation = null;
            var locateMs = _host.Time.GetElapsedTime(received).TotalMilliseconds;
            var result = task.IsCompletedSuccessfully ? task.Result : new LocateResult.Failed(FailReason.PositionUnavailable);
            switch (result)
            {
                case LocateResult.Located located:
                    _displayIssued = true;
                    Task apply;
                    try
                    {
                        apply = _host.Presenter.ApplyAsync(_renderer!, show.Snapshot, located);
                    }
                    catch (Exception e)
                    {
                        apply = Task.FromException(e);
                    }
                    apply.ContinueWith(t => OnApplied(show, received, locateMs, located, t), CancellationToken.None,
                        TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);
                    break;
                case LocateResult.Failed failed:
                    if (failed.Reason == FailReason.BindingUnavailable) _binding = "unavailable";
                    _locateMs = locateMs;
                    HideDisplayLocked();
                    _lastAppliedSeq = show.Seq;
                    SendStatusLocked(show.Seq, "failed", ToProtocol(failed.Reason), "none");
                    break;
                case LocateResult.Suppressed suppressed:
                    _foreground = false;
                    HideDisplayLocked();
                    _lastAppliedSeq = show.Seq;
                    SendStatusLocked(show.Seq, "suppressed", ToProtocol(suppressed.Reason), "none");
                    break;
            }
        }
    }

    private void OnApplied(ShowMessage show, long received, double locateMs, LocateResult.Located located, Task apply)
    {
        lock (_host.Gate)
        {
            // 较晚的 show/hide 已被接受：旧的显示结果不确认（它已被后续投递的显示或隐藏覆盖）
            if (_closed || show.Seq != _lastAcceptedSeq) return;
            if (!apply.IsCompletedSuccessfully)
            {
                HideDisplayLocked();
                _lastAppliedSeq = show.Seq;
                SendStatusLocked(show.Seq, "failed", "render-failed", "none");
                return;
            }
            _shown = show.Snapshot;
            _lastAppliedSeq = show.Seq;
            _foreground = true;
            _binding = "verified";
            _caretSource = located.Source;
            _caretRect = located.CaretRect;
            _overlayRect = located.OverlayRect;
            _locateMs = locateMs;
            _receiveToDisplayMs = _host.Time.GetElapsedTime(received).TotalMilliseconds;
            SendStatusLocked(show.Seq, "shown", "ok", located.Source == CaretSource.Uia ? "uia" : "cells");
        }
    }

    private void HideLocked(long seq, string reason)
    {
        _lastAcceptedSeq = seq;
        CancelLocateLocked();
        HideDisplayLocked();
        _lastAppliedSeq = seq;
        SendStatusLocked(seq, "hidden", reason, "none");
    }

    internal void SuppressLocked(SuppressReason reason)
    {
        if (_closed) return;
        _foreground = false;
        if (!_displayIssued && _locateCancellation is null) return;
        CancelLocateLocked();
        HideDisplayLocked();
        SendStatusLocked(_lastAcceptedSeq, "suppressed", ToProtocol(reason), "none");
    }

    internal void ReportFailureLocked(FailReason reason)
    {
        if (_closed || (!_displayIssued && _locateCancellation is null)) return;
        if (reason == FailReason.BindingUnavailable) _binding = "unavailable";
        CancelLocateLocked();
        HideDisplayLocked();
        SendStatusLocked(_lastAcceptedSeq, "failed", ToProtocol(reason), "none");
    }

    private void CancelLocateLocked()
    {
        _locateCancellation?.Cancel();
        _locateCancellation = null;
    }

    /// <summary>撤销当前和待绘制的快照。只要发出过显示，就让平台隐藏（较早的显示可能仍在 UI 线程上排队）。</summary>
    private void HideDisplayLocked()
    {
        if (_displayIssued && _renderer is not null) _host.Presenter.Hide(_renderer);
        _displayIssued = false;
        _shown = null;
        _caretSource = null;
        _caretRect = null;
        _overlayRect = null;
    }

    // ---- 租期 ----

    private void RenewLeaseLocked()
    {
        var lease = TimeSpan.FromMilliseconds(_host.Options.LeaseMs);
        if (_leaseTimer is null)
        {
            _leaseTimer = _host.Time.CreateTimer(_ => OnLeaseExpired(), null, lease, Timeout.InfiniteTimeSpan);
        }
        else
        {
            _leaseTimer.Change(lease, Timeout.InfiniteTimeSpan);
        }
    }

    private void OnLeaseExpired()
    {
        lock (_host.Gate)
        {
            if (_closed) return;
            if (_role == ClientRole.Renderer)
            {
                CancelLocateLocked();
                HideDisplayLocked();
                SendStatusLocked(_lastAcceptedSeq, "hidden", "lease-expired", "none");
            }
            CloseLocked("lease-expired");
        }
    }

    // ---- 发送与关闭 ----

    private HostMessageWriter.Envelope NextEnvelope() => new(_session!, _connection!, ++_sendSeq);

    private void SendStatusLocked(long forSeq, string state, string reason, string caretSource)
    {
        _state = state;
        _reason = reason;
        SendLocked(HostMessageWriter.Status(NextEnvelope(), forSeq, state, reason, caretSource));
    }

    private void SendLocked(byte[] line)
    {
        if (_closed) return;
        if (_outbound.Enqueue(line) > _host.Options.MaxQueuedBytes) CloseLocked("resource-limit");
    }

    private void FailLocked(string code, string detail, bool canReply)
    {
        if (canReply && _session is not null && _connection is not null) SendLocked(HostMessageWriter.Error(NextEnvelope(), code));
        CloseLocked($"{code}: {detail}");
    }

    internal void CloseLocked(string reason)
    {
        if (_closed) return;
        _closed = true;
        CloseReason = reason;
        CancelLocateLocked();
        HideDisplayLocked();
        _helloTimer.Dispose();
        _leaseTimer?.Dispose();
        _host.RemoveLocked(this);
        _outbound.Close();
    }

    // ---- debugState ----

    internal DebugStateSnapshot DebugStateLocked()
    {
        var shown = _shown;
        return new DebugStateSnapshot(
            _host.HostInstance,
            _connection!,
            _lastReceivedSeq,
            _lastAppliedSeq,
            Visible: shown is not null,
            _foreground,
            _binding,
            _state,
            _reason,
            CandidateCount: shown?.Candidates.Count ?? 0,
            TotalCount: shown?.TotalCount ?? 0,
            PageStart: shown?.PageStart ?? 0,
            SelectedIndex: shown?.SelectedIndex,
            Cursor: shown?.Cursor,
            Terminal: shown?.Terminal,
            CaretSource: _caretSource switch
            {
                CaretSource.Uia => "uia",
                CaretSource.Cells => "cells",
                _ => "none",
            },
            _caretRect,
            _overlayRect,
            _locateMs,
            _receiveToDisplayMs);
    }

    private static string ToProtocol(FailReason reason) => reason switch
    {
        FailReason.BindingUnavailable => "binding-unavailable",
        FailReason.PositionUnavailable => "position-unavailable",
        _ => "render-failed",
    };

    private static string ToProtocol(SuppressReason reason) => reason switch
    {
        SuppressReason.Inactive => "inactive",
        SuppressReason.Minimized => "minimized",
        _ => "pane-changed",
    };
}
