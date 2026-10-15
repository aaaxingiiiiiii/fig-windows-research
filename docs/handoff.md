# 当前交接状态

更新：2026-10-15 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。Windows 端当前要做的事见 **`docs/windows-next.md`**；用户只需对那边的 AI 说“同步 develop，读 docs/windows-next.md，按顺序做”。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。

- 阶段 A：**关卡一 T-035 已通过**（原版 inshellisense 在 Windows Terminal 中没有阻断问题）。发现两件事：
  - T-056：拖动窗口大小后候选错位，清屏可以恢复；
  - T-057：用户的 Windows 上没有安装 PowerShell 7，测试靠 AI 工具自带的 pwsh。
  下一步是 T-057（用户决定），然后在最新的 develop 上做关卡二 T-048。顺序见 `docs/roadmap.md` 第 7 节。
- 阶段 B：协议（T-042）、inshellisense 一侧的悬浮窗渲染器（T-043）和宿主的协议核心（T-053，C#/.NET 10）已完成，并且在 Mac 上验证过两端可以互通。下一步是 Windows 上的 T-029、T-021、T-019，然后是 T-044：只需实现 `IOverlayPresenter`。

## 进度

| 谁 | 已完成 | 进行中 / 下一步 |
| --- | --- | --- |
| Claude Code（Mac，整合者） | T-036 至 T-039、T-049、T-051、T-013、T-043、T-053、T-058；记录 T-012；`docs/usage.md`、`docs/roadmap.md`、`docs/windows-next.md` | 等待 Windows 验收结果并修复其中的缺陷 |
| Codex/GPT-6（Windows） | T-035 的环境检查、冒烟测试和 L1 预检；T-052（Windows 上的测试平台假设） | T-035 已通过；下一步：T-057（等用户同意）→ T-048（最新 develop）→ 复现 T-056；用户不在时做 T-029、T-021 |
| GPT/Codex（Mac） | T-015、T-042 | T-054（审查 T-043）→ T-055；T-053 需要先安装 .NET 8 SDK（见 `docs/roadmap.md` 第 8.2 节） |
| 用户 | 对方仓库授权；inshellisense fork | 决定是否在 Windows 上安装 PowerShell 7（T-057）；T-048 的人工清单 |

## 关键结论（本轮新增）

- 测试结果：
  - Mac：`npm test -- --ci` 共 357 个（T-043 新增 81 个），346 个通过，10 个跳过，1 个失败（本机 Homebrew 环境问题）。
  - Windows：265 个通过，10 个跳过，0 个失败（E-009）。
- Windows 上补全文件夹时，结尾的分隔符是 `\`，例如 `'My Docs\'`；PowerShell 可以正常使用这种写法。
- F-006 已查明：Kiro 只有在 `Q_TERM` 已设置时，才输出完整的 shell 集成脚本（E-007）。本机的 Kiro 已自动更新为 2.31.0。
- T-050 已取消：向 microsoft/inshellisense 提交的三个 PR（#486–#488）由用户要求撤销，已关闭（D-011）。在用户另行决定之前，不要向上游提交任何内容。补丁仍保存在 Mac 的 `local/upstream-pr/`。
- T-012 已完成：13 项中 12 项与开源基线一致，只有 C-006 不一致（F-033）。
- T-043：设置 `FIGWIN_OVERLAY_PIPE` 后，候选改为发给悬浮窗宿主；宿主异常时回到终端内绘制（`docs/dev.md` 第 4 节）。
- T-053：宿主的协议核心在 `src/overlay-host/`，70 个测试；开发用宿主可以与真实的 inshellisense 联调（`src/overlay-host/README.md`）。宿主和 wt-driver 使用 .NET 10（D-012）。

- T-058：安装和卸载脚本已写好，在 Mac 上自测通过。T-040 只需在 Windows 上打包和验证。
- D-013：用户外出期间授权整合者按推荐方案处理需要确认的事项。已按此授权的事项：Windows 上安装 PowerShell 7 并设为默认、安装 .NET 10 SDK；Mac 上把 PowerShell 7.6.7 安装到 `~/.powershell`。

## 推送

- 2026-10-15 起，所有端都推送到对方仓库的 `develop`（D-008）。用户的 fork 只作备份。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`）。运行测试时加 `--ci`。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
