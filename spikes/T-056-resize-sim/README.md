# T-056 改变窗口大小的自动检查

`resize-sim.cjs` 不需要用户操作，就能检查改变窗口大小后候选框是否错位：

- 用 xterm-headless 模拟外层终端，代替 Windows Terminal，并像真实终端一样回复光标位置查询；
- 内层用 node-pty 运行我们构建的 inshellisense 和指定的 shell，Windows 上内层是 ConPTY；
- 输入 `git ch` 后改变 4 次窗口大小，再输入一个字符；
- 每一步检查候选框是否紧贴光标所在的行。

```sh
# 在仓库根目录；先在 src/inshellisense 下 npm ci && npm run build
node spikes/T-056-resize-sim/resize-sim.cjs pwsh          # Windows 上的目标组合
node spikes/T-056-resize-sim/resize-sim.cjs pwsh --wrap   # 先输出会折行的长内容
node spikes/T-056-resize-sim/resize-sim.cjs zsh           # Mac 上对照
```

每一步输出一行 JSON：`aligned: false` 表示候选框没有紧贴光标，`promptAligned: false` 表示输入的字符没有出现在提示符所在的行，有任何一项时退出码为 1。

2026-10-16 新增的选项：

| 选项 | 作用 |
| --- | --- |
| `--direct` | 不经过 inshellisense，直接运行 shell（对照组：没有 inshellisense 时是否也错位） |
| `--outer-conpty` | 外层 xterm 按 ConPTY 的规则处理窗口变化（`windowsPty`，VS Code 的终端也这样设置） |
| `--per-step` | 每次改变大小后都输入 `e`、检查、再删掉，用来定位是哪一步引起错位 |
| `--steps=80x30,120x30` | 改变大小的顺序，默认 `80x30,120x30,90x24,100x30` |
| 环境变量 `FIGWIN_CONPTY` | inshellisense 用哪个 ConPTY：`bundled`（node-pty 附带的 conpty.dll）或 `system`（系统自带）；不设置时用 `bundled`，见 `src/inshellisense/src/isterm/pty.ts` 的 `useBundledConpty` |

pwsh 第一条命令是 `Set-PSReadLineOption -HistorySaveStyle SaveNothing`，测试的命令不会写进 PowerShell 的历史，只有这一行本身会被记录。

## 对照试验（`matrix.cjs`）

```powershell
node spikes/T-056-resize-sim/matrix.cjs pwsh    # 约 6 分钟，结果在 local/evidence/T-056-matrix/
```

依次运行 8 组：直接运行 pwsh（外层两种规则）；inshellisense 分别用附带的 conpty.dll、系统 ConPTY、默认选择；系统 ConPTY 不折行的一组。表格中“✗跳”表示输入一个字符后光标跳到了别的行。屏幕上和 `summary.md` 中只有坐标和是否对齐，可以公开；完整输出含提示符（可能有本机路径），只留在 `local/`。GitHub Actions 的 `t056` 作业也运行它（T-061）。

2026-10-16 起，`before` 一步必须出现候选框，否则判为失败（表格中显示“✗无候选”）。在此之前，没有候选框时也判为对齐：E-019、E-020 中系统 ConPTY 的“全部对齐”就是这样误判的（E-021）。

## 结果

2026-10-15，Mac（Node 20、PowerShell 7.6.7）：zsh、pwsh，以及各自加 `--wrap`，共 4 组，全部 `aligned: true`，**没有复现**。外层终端重新折行时，候选框也仍然紧贴光标。

推断：T-035 中看到的错位与 Windows 有关，可能是内层 ConPTY 在大小改变时的重绘，也可能是 Windows Terminal 自己的折行方式。在 Windows 上运行本脚本可以区分这两种：

- 出现 `aligned: false`：内层 ConPTY 的问题，可以在这里自动复现、调试和回归测试。
- 全部对齐：问题在 Windows Terminal 一侧，这个模拟器无法覆盖，需要用户手动复现，并提供 `-V` 日志。

已知情况：在 Mac 上大约 10 次运行中，有 1 次 inshellisense 在中途退出，脚本会输出 `exited early` 并返回 1。原因没有查明，重跑即可；如果反复出现，记录 `rawTail` 字段的内容。

2026-10-15，Windows（ConPTY、PowerShell 7.6.7）：普通组对齐；`--wrap` 连续两次在最后一次改变大小（90×24 → 100×30）后输入时错位，光标从第 29 行跳到第 22 行（E-012）。

2026-10-16 的分析（推断）：ConPTY 的缓冲区只有可见区域那么大，没有回滚区，窗口变高时在底部加空行，光标留在原来的行。inshellisense 内部用来跟踪屏幕的 xterm 默认会从回滚区拉回旧行，光标随之下移。窗口变化 150 ms 后，inshellisense 按内部模型重画整个屏幕，于是外层屏幕也跟着内部模型走。之后 pwsh 按 ConPTY 的行号输出，就落到了别的行。普通组没有错位，是因为屏幕没有写满、没有回滚区可拉。变宽时 xterm 合并折行后也会从回滚区拉行，ConPTY 做不到，所以 `--wrap` 还可能有第二个原因。Mac 上的对照试验 8 组全部对齐（内层不是 ConPTY，候选修复在 Mac 上不生效）。

2026-10-16，GitHub Actions 的 Windows 虚拟机（第一次运行，E-017）：
- 直接运行 pwsh 的两组全部对齐：问题确实在 inshellisense 一侧。
- 现在的 inshellisense：变宽（120×30）后输入时错位。直接运行时，ConPTY 合并折行后光标从第 29 行上移到第 27 行；inshellisense 仍停在第 29 行。
- `conpty` 变体：变高（24 → 30 行）后光标留在第 23 行，与 ConPTY 一致；变宽那一步仍然错位。`legacy` 更差。
- 由此推断：变宽时还有第二个原因，是 xterm 从回滚区拉行。新增 `noscroll` 变体（内部 xterm 不保留回滚区），等下一次运行的结果。

2026-10-16，GitHub Actions 的 Windows 虚拟机（第三次运行，E-020；用户的 Windows 11 26200 上结果一致，E-019）：改用系统 ConPTY 的 4 组（加不加 `windowsPty`、外层两种规则、不折行）**全部对齐**，坐标与直接运行 pwsh 完全一致；其余各组照旧错位。系统 ConPTY 在窗口变化后会重画整个屏幕，内部模型随之与 ConPTY 一致。据此把修复定为：Windows 11 上默认用系统 ConPTY（`useBundledConpty`），删除了试验用的 xterm 变体。

**2026-10-16 更正（E-021）**：上一段的结论是错的。改用系统 ConPTY 后完全不出现候选，各组“对齐”只是因为没有候选框可比较。第四次 CI 的安装包验收发现了这一点：新开的 PowerShell 7 中输入 `git ch` 后没有候选。默认已改回附带的 conpty.dll，T-056 仍未修复。模拟器已修补：没有候选框时判为失败。

