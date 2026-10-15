// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-053：开发用宿主。使用真实的协议核心和命名管道，但不画窗口：把 show/hide 打印到标准输出。
// 用于在 Mac 或 Windows 上与 inshellisense 联调（docs/dev.md 第 4 节），也是 T-044 的起点。
//
// 用法：dotnet run --project FigWin.OverlayHost.DevHost -- [管道名] [--fail] [--suppress] [--delay=毫秒]
//   --fail：定位总是失败（position-unavailable），检查客户端回退
//   --suppress：定位总是报告失焦（inactive）
//   --delay：定位前等待的毫秒数，模拟较慢的 UIA

using FigWin.OverlayHost.Hosting;
using FigWin.OverlayHost.Protocol;
using FigWin.OverlayHost.Transport;

var pipeName = args.FirstOrDefault(a => !a.StartsWith("--", StringComparison.Ordinal)) ?? "figwin-overlay-v1-dev";
var mode = args.Contains("--fail") ? "fail" : args.Contains("--suppress") ? "suppress" : "ok";
var delayArg = args.FirstOrDefault(a => a.StartsWith("--delay=", StringComparison.Ordinal));
var delay = delayArg is null ? 0 : int.Parse(delayArg["--delay=".Length..], System.Globalization.CultureInfo.InvariantCulture);

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;
    cancellation.Cancel();
};

var host = new OverlayHostCore(new ConsolePresenter(mode, delay));
Console.Error.WriteLine($"dev host {host.HostInstance} listening on {PipeServer.EndpointPath(pipeName)} (mode={mode}, delay={delay}ms)");
await new PipeServer(host, pipeName).RunAsync(cancellation.Token);

/// <summary>不画窗口的平台实现：按单元格换算位置（每格 8×16 像素），把显示和隐藏打印出来。</summary>
internal sealed class ConsolePresenter(string mode, int delayMs) : IOverlayPresenter
{
    private const double CellWidth = 8;
    private const double CellHeight = 16;

    public async Task<LocateResult> LocateAsync(RendererInfo renderer, ShowSnapshot snapshot, CancellationToken cancellationToken)
    {
        if (delayMs > 0) await Task.Delay(delayMs, cancellationToken);
        return mode switch
        {
            "fail" => new LocateResult.Failed(FailReason.PositionUnavailable),
            "suppress" => new LocateResult.Suppressed(SuppressReason.Inactive),
            _ => new LocateResult.Located(
                CaretSource.Cells,
                new PixelRect(snapshot.Cursor.Col * CellWidth, snapshot.Cursor.Row * CellHeight, CellWidth, CellHeight),
                new PixelRect(snapshot.Cursor.Col * CellWidth, (snapshot.Cursor.Row + 1) * CellHeight, 40 * CellWidth,
                    Math.Max(1, snapshot.Candidates.Count) * CellHeight)),
        };
    }

    public Task ApplyAsync(RendererInfo renderer, ShowSnapshot snapshot, LocateResult.Located location)
    {
        var names = string.Join(", ", snapshot.Candidates.Select((c, i) => i == snapshot.SelectedIndex ? $"[{c.Name}]" : c.Name));
        Console.WriteLine($"SHOW {renderer.Session[..8]} cursor={snapshot.Cursor.Row},{snapshot.Cursor.Col} page={snapshot.PageStart}/{snapshot.TotalCount} {names}");
        return Task.CompletedTask;
    }

    public void Hide(RendererInfo renderer) => Console.WriteLine($"HIDE {renderer.Session[..8]}");
}
