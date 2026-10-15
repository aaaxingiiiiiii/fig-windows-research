// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using FigWin.OverlayHost.Protocol;

namespace FigWin.OverlayHost.Hosting;

/// <summary>一个 renderer 连接的身份和关联线索（hello 中的 pid、wtSession 只用于关联，不是凭据）。</summary>
public sealed record RendererInfo(string Session, string Connection, long Pid, string? WtSession);

public enum CaretSource
{
    Uia,
    Cells,
}

public enum FailReason
{
    BindingUnavailable,
    PositionUnavailable,
    RenderFailed,
}

public enum SuppressReason
{
    Inactive,
    Minimized,
    PaneChanged,
}

/// <summary>定位的结果（第 6 节）。</summary>
public abstract record LocateResult
{
    private LocateResult()
    {
    }

    /// <summary>已确认目标窗格处于前台，得到光标和悬浮窗的物理像素位置（悬浮窗位置已处理工作区裁剪和上下翻转）。</summary>
    public sealed record Located(CaretSource Source, PixelRect CaretRect, PixelRect OverlayRect) : LocateResult;

    /// <summary>无法绑定窗格或无法定位：宿主隐藏并报告 failed。</summary>
    public sealed record Failed(FailReason Reason) : LocateResult;

    /// <summary>目标窗格不在前台、已最小化或已切换：宿主隐藏并报告 suppressed。</summary>
    public sealed record Suppressed(SuppressReason Reason) : LocateResult;
}

/// <summary>
/// 与平台有关的部分：窗格绑定、光标定位和原生窗口。Windows 上由 T-044 实现（UIA、WinForms/WPF）。
/// 核心（HostConnection）负责协议、顺序和竞态：只有仍然是最新的快照才会调用 ApplyAsync。
/// <para>
/// 线程约定：核心在内部锁中调用 ApplyAsync 和 Hide，所以这两个方法<b>不得同步等待 UI 线程</b>
/// （例如不要用 Control.Invoke），而应投递到 UI 线程（BeginInvoke / Dispatcher.InvokeAsync）并立即返回；
/// 投递的显示和隐藏必须按调用顺序执行。UI 线程可以随时调用 OverlayHostCore.Suppress、ReportFailure。
/// </para>
/// </summary>
public interface IOverlayPresenter
{
    /// <summary>绑定窗格并定位光标。可能较慢（UIA），必须响应取消；不要在这里显示窗口。</summary>
    Task<LocateResult> LocateAsync(RendererInfo renderer, ShowSnapshot snapshot, CancellationToken cancellationToken);

    /// <summary>在定位结果处显示或更新列表。窗口实际更新后完成；失败（任务出错）时按 render-failed 处理。</summary>
    Task ApplyAsync(RendererInfo renderer, ShowSnapshot snapshot, LocateResult.Located location);

    /// <summary>隐藏这个 renderer 的列表。可以重复调用；不得同步等待 UI 线程。</summary>
    void Hide(RendererInfo renderer);
}

/// <summary>一个连接的发送端。由传输层实现（命名管道等），只负责排队和写出。</summary>
public interface IOutboundChannel
{
    /// <summary>排入一整行，返回当前尚未写出的字节数。</summary>
    long Enqueue(byte[] line);

    /// <summary>写完已排队的内容后关闭连接。</summary>
    void Close();
}

public sealed record HostOptions
{
    public int HelloTimeoutMs { get; init; } = ProtocolConstants.HelloTimeoutMs;
    public int LeaseMs { get; init; } = ProtocolConstants.LeaseMs;
    public long MaxQueuedBytes { get; init; } = ProtocolConstants.MaxQueuedBytes;
}
