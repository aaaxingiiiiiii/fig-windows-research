// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using FigWin.OverlayHost.Protocol;

namespace FigWin.OverlayHost.Hosting;

/// <summary>
/// 悬浮窗宿主的核心：接受连接、按渲染会话登记、处理平台报告的失焦，提供 debugState。
/// 所有状态变化都在 <see cref="Gate"/> 锁内进行；定位（可能较慢）在锁外异步进行。
/// </summary>
public sealed class OverlayHostCore
{
    private readonly Dictionary<string, HostConnection> _renderers = new(StringComparer.Ordinal);
    private readonly List<HostConnection> _connections = [];

    public OverlayHostCore(IOverlayPresenter presenter, TimeProvider? time = null, HostOptions? options = null, string? hostInstance = null)
    {
        Presenter = presenter;
        Time = time ?? TimeProvider.System;
        Options = options ?? new HostOptions();
        HostInstance = hostInstance ?? Guid.NewGuid().ToString("D");
    }

    /// <summary>宿主启动时生成的 UUID，供识别宿主重启。</summary>
    public string HostInstance { get; }

    internal IOverlayPresenter Presenter { get; }
    internal TimeProvider Time { get; }
    internal HostOptions Options { get; }
    internal object Gate { get; } = new();

    /// <summary>当前连接数（含尚未握手的连接）。</summary>
    public int ConnectionCount
    {
        get
        {
            lock (Gate) return _connections.Count;
        }
    }

    /// <summary>传输层接受一个新连接后调用。</summary>
    public HostConnection Accept(IOutboundChannel outbound)
    {
        lock (Gate)
        {
            var connection = new HostConnection(this, outbound);
            _connections.Add(connection);
            return connection;
        }
    }

    /// <summary>平台报告某个渲染会话的窗格失焦、最小化或切换（第 6 节）。</summary>
    public void Suppress(string session, SuppressReason reason)
    {
        lock (Gate)
        {
            if (_renderers.TryGetValue(session, out var connection)) connection.SuppressLocked(reason);
        }
    }

    /// <summary>平台在显示之后发现失败（例如窗口被销毁、窗格无法再绑定）时调用。</summary>
    public void ReportFailure(string session, FailReason reason)
    {
        lock (Gate)
        {
            if (_renderers.TryGetValue(session, out var connection)) connection.ReportFailureLocked(reason);
        }
    }

    /// <summary>某个渲染会话的 debugState；找不到时为 null。</summary>
    public DebugStateSnapshot? GetDebugState(string session)
    {
        lock (Gate)
        {
            return _renderers.TryGetValue(session, out var connection) ? connection.DebugStateLocked() : null;
        }
    }

    internal DebugStateSnapshot? GetDebugStateLocked(string session) =>
        _renderers.TryGetValue(session, out var connection) ? connection.DebugStateLocked() : null;

    /// <summary>登记 renderer。同一渲染会话的旧连接先隐藏并关闭（第 3 节）。</summary>
    internal void RegisterRendererLocked(HostConnection connection, string session)
    {
        if (_renderers.TryGetValue(session, out var previous) && previous != connection) previous.CloseLocked("superseded");
        _renderers[session] = connection;
    }

    internal void RemoveLocked(HostConnection connection)
    {
        _connections.Remove(connection);
        if (connection.RendererSession is { } session && _renderers.TryGetValue(session, out var registered) && registered == connection)
            _renderers.Remove(session);
    }
}
