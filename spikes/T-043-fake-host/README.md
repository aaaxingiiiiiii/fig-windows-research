# T-043 假的悬浮窗宿主

在 C# 宿主（T-044）完成之前，用来检查 inshellisense 的悬浮窗渲染器发出的协议消息（`docs/protocol.md`）。它不画窗口，只回复协议消息，并把收到的每条消息打印成一行 JSON。

## 用法

需要 Node 18–22。先在一个终端中启动假宿主：

```sh
# macOS / Linux
node spikes/T-043-fake-host/fake-host.mjs /tmp/figwin-overlay.sock
# Windows（PowerShell）
node spikes/T-043-fake-host/fake-host.mjs \\.\pipe\figwin-overlay-v1-test
```

再在另一个终端中，带上环境变量从源码启动 inshellisense（构建方法见 `docs/dev.md`）：

```sh
FIGWIN_OVERLAY_PIPE=/tmp/figwin-overlay.sock node src/inshellisense/build/index.js -s zsh
```

```powershell
$env:FIGWIN_OVERLAY_PIPE = '\\.\pipe\figwin-overlay-v1-test'; node src/inshellisense/build/index.js -s pwsh
```

输入 `git ch`：

- 终端里不出现候选框；
- 假宿主打印 `hello`，然后打印一条 `show`，其中包含 `checkout` 和 `cherry-pick`；
- 按 ↓ 再按 Tab，命令行变成 `git cherry-pick `。

## 检查回退

| 启动参数 | 预期 |
| --- | --- |
| （不启动假宿主） | 与没有设置环境变量时完全一样，候选画在终端里 |
| `--no-ack` | 每条 show 在 100 ms 后超时，候选回到终端里；之后按 1 s、2 s、5 s 的间隔重连 |
| `--fail` | 宿主报告定位失败，候选回到终端里，之后重连 |
| 运行中按 Ctrl+C 结束假宿主 | 候选回到终端里，输入不受影响 |

`2026-10-15` 在 macOS 上用 node-pty 驱动 zsh 检查过上表的前三种情况和正常情况，见 `docs/log.md` 的 T-043 记录。
