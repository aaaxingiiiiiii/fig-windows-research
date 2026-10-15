# 当前交接状态

更新：2026-10-15 晚 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。Windows 端当前要做的事见 **`docs/windows-next.md`**；用户只需对那边的 AI 说“同步 develop，读 docs/windows-next.md，按顺序做”。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。

- **阶段 A**：
  - 关卡一 T-035 已通过。
  - 关卡二 T-048 第一次误用了原版，结果已作废，要在正式安装的 PowerShell 7 中重测（T-057 → T-048）。
  - 打包和安装：脚本已经备好（T-058），打包流程也在 Mac 上验证过，Windows 上只剩打包和验收（T-040）。
- **阶段 B**：
  - 已完成：协议（T-042），inshellisense 一侧的渲染器（T-043，经 T-054 审查），宿主的协议核心（T-053，C#/.NET 10）。两端在 Mac 上实测可以互通。
  - Windows 上剩下：T-029、T-021、T-019，然后是 T-044（只需实现 `IOverlayPresenter`）。

## 进度

| 谁 | 已完成 | 下一步 |
| --- | --- | --- |
| Claude Code（Mac，整合者） | T-036 至 T-039、T-049、T-051、T-013、T-043、T-053、T-058；记录 T-012；T-056 在 Mac 上的分析（F-034）；Mac 上验证打包 | 等 Windows 端的 T-048 和 T-056 结果，修复其中的缺陷；继续整合 |
| Codex/GPT-6（Windows） | T-035（关卡一）、T-052 | 按 `docs/windows-next.md`：T-057 → T-048 → T-056 的自动检查和复现 → T-040；用户不在时做 .NET 10、T-029、T-021 |
| GPT/Codex（Mac） | T-015、T-042、T-054、T-055 | 暂无任务 |
| 用户 | T-012（Kiro 观察）；对方仓库授权 | 回来后：在 Windows 上配合 T-048（约 30 分钟）和 T-056 的手动复现（约 10 分钟）；修改真实的 `$PROFILE`（T-040）需要用户同意 |

## 用户外出期间按 D-013 处理的事项

用户授权：需要确认的事项，按整合者的推荐方案处理。已按此执行或写入指令的有：

- Windows：安装 PowerShell 7 并设为 WT 默认（T-057）；安装 .NET 10 SDK。已写入 `docs/windows-next.md`，由 Windows 端执行。
- Mac：把 PowerShell 7.6.7 安装到 `~/.powershell`，用来测试安装脚本。
- 版本号改为 `0.0.4-figwin.1`，用来和原版区分。

修改用户真实的 `$PROFILE`、删除数据、对外提交、改变路线，都不在授权范围内。

## 关键结论（本轮新增）

- 测试结果：
  - Mac：inshellisense 共 387 个，376 个通过，10 个跳过，1 个失败（本机 Homebrew 环境问题；偶尔多出 1–2 个偶发失败）；
  - 宿主：70 个全部通过；
  - 安装脚本自测：26 项全部通过。
- T-056：Mac 上的模拟器（`spikes/T-056-resize-sim/`）无法复现，推断与 Windows 的 ConPTY 或 WT 的折行方式有关（F-034）。下一步在 Windows 上运行这个模拟器。
- T-012：13 项中 12 项与开源基线一致。C-006 的源码规则已核对无误，不一致的原因未知（F-033）。
- 打包：`npm run package` 在 Mac 上可以完成，程序约 125 MB。

## 推送

- 所有端都推送到对方仓库的 `develop`（D-008）。用户的 fork 只作备份。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`）。运行测试时加 `--ci`。
- 提交前单独运行 `sh scripts/check-public.sh`，并检查它的退出码，不要接在管道后面。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
