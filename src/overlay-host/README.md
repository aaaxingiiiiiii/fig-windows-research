# 悬浮窗宿主（C#/.NET 10）

阶段 B 的宿主，实现 `docs/protocol.md` v1 的服务端：接收 inshellisense 发来的显示快照，在光标旁显示原生列表窗口。语言和版本见 D-004、D-012。

## 结构

| 项目 | 目标框架 | 内容 | 状态 |
| --- | --- | --- | --- |
| `FigWin.OverlayHost.Core` | `net10.0` | 与平台无关的协议核心（T-053），见下文 | 已完成，可以在 Mac 上构建和测试 |
| `FigWin.OverlayHost.Core.Tests` | `net10.0` | xunit 测试，70 个 | 已完成 |
| `FigWin.OverlayHost.DevHost` | `net10.0` | 开发用宿主：使用真实的核心和命名管道，但不画窗口，只把 show/hide 打印出来 | 已完成 |
| Windows 宿主（T-044 新建，例如 `FigWin.OverlayHost.Windows`） | `net10.0-windows` | 实现 `IOverlayPresenter`：窗格绑定、UIA 光标定位、原生窗口 | 待做 |

`FigWin.OverlayHost.Core` 的内容：

- 分帧（`LineFramer`）、严格 JSON（`StrictJson`）、校验客户端消息（`ClientMessageParser`）；
- 编码宿主消息（`HostMessageWriter`）；
- 连接状态机（`HostConnection`）：握手、身份和序号、角色、show 和 hide 的竞态、状态回复、租期、发送队列上限、debugState；
- 会话登记（`OverlayHostCore`）；
- 命名管道服务端（`PipeServer`）。

## 构建和测试

```sh
cd src/overlay-host
dotnet build OverlayHost.slnx
dotnet test OverlayHost.slnx
```

Mac 上的 .NET SDK 安装在 `~/.dotnet`（D-012），需要时把它加到 PATH；运行前可以设置 `DOTNET_CLI_TELEMETRY_OPTOUT=1`，关闭遥测。

## 给 T-044 的说明：实现 `IOverlayPresenter`

核心已经处理协议本身，以及顺序和竞态的问题：

- 只有仍然是最新的 show 才会调用 `ApplyAsync`；
- 收到 hide、失焦或租期届满时，会调用 `Hide`；
- 旧连接迟到的结果会被丢弃。

平台部分只需要实现三个方法：

| 方法 | 要做的事 |
| --- | --- |
| `LocateAsync` | 根据 `RendererInfo`（pid、wtSession）找到并验证 WT 窗格是前台输入窗格，用 UIA 定位光标；失败时用单元格换算。返回 `Located`（光标和悬浮窗的物理像素位置）、`Failed` 或 `Suppressed`。必须响应取消，不要在这里显示窗口 |
| `ApplyAsync` | 把显示操作投递到 UI 线程，窗口实际更新后，任务才完成 |
| `Hide` | 把隐藏操作投递到 UI 线程 |

**线程约定**：`ApplyAsync` 和 `Hide` 是在核心的锁内调用的。

- 不要同步等待 UI 线程，例如不要用 `Control.Invoke`。要用 `BeginInvoke`、`Dispatcher.InvokeAsync` 投递后立即返回。
- 投递的操作必须按调用顺序执行。
- UI 线程发现失焦、最小化、切换窗格时，调用 `OverlayHostCore.Suppress(session, reason)`；显示之后发现失败时，调用 `ReportFailure`。这两个方法可以从任何线程调用。

**启动**：

```csharp
var host = new OverlayHostCore(new WindowsPresenter(...));
await new PipeServer(host, pipeName).RunAsync(cancellationToken);
```

管道名在生产环境中要按用户和登录会话隔离（`docs/protocol.md` 第 2 节，T-046）。

## 与 inshellisense 联调

先启动开发用宿主：

```sh
dotnet run --project FigWin.OverlayHost.DevHost -- figwin-overlay-v1-dev
```

它会打印 `listening on <端点>`。把这个端点设为 `FIGWIN_OVERLAY_PIPE`，再从源码启动 inshellisense（见 `docs/dev.md` 第 2 节）。

输入 `git ch`，开发用宿主会打印：

```text
SHOW … [checkout], cherry-pick
```

终端里不会画候选框。可选参数：

- `--fail`：定位总是失败；
- `--suppress`：定位总是报告失焦；
- `--delay=毫秒`：模拟较慢的定位。超过 100 ms 时，客户端会回到终端内绘制。

2026-10-15 在 macOS 上用 node-pty 驱动真实的 inshellisense，检查过正常、`--delay=300`、`--fail` 三种情况，结果都符合协议（见 `docs/log.md` 的 T-053 记录）。
