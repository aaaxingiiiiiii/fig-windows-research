# 当前交接状态

更新：2026-10-16 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。Windows 端当前要做的事见 **`docs/windows-next.md`**（第 3 版）；用户只需对那边的 AI 说“同步 develop，读 docs/windows-next.md，按顺序做”。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。**用户决定 D-014：先把功能做完，需要用户在场的测试放到最后；最终交付 Windows 安装包和配置。**

- **阶段 A**：
  - 功能已经完成。
  - 安装包已写好（T-059），在 GitHub Actions 的虚拟机中构建和验收（T-061），还没有拿到第一次运行结果。
  - T-056（窗口大小改变后错位）：原因已有推断（F-035），候选修复和对照试验已备好，等 Windows 上的结果。
- **阶段 B**：协议、inshellisense 一侧的渲染器和宿主的协议核心都已完成。Windows 端正在做 T-021，之后是 T-019、T-044。

## 进度

| 谁 | 已完成 | 下一步 |
| --- | --- | --- |
| Claude Code（Mac，整合者） | 本轮：T-056 分析、T-059 至 T-062、D-014、D-015、windows-next 第 3 版 | 看 T-061 第一次运行的结果并修复问题；按对照试验的结果修复 T-056；之后把悬浮窗宿主接入安装包 |
| Codex/GPT-6（Windows） | T-035、T-052、T-057（只差用户确认）、T-048 无人值守部分、T-056 复现、T-029、.NET 10 | 按 `docs/windows-next.md`：T-056 对照试验 → T-021 → T-019 → T-044 |
| GPT/Codex（Mac） | T-015、T-042、T-054、T-055 | 暂无任务 |
| 用户 | T-012；仓库授权；D-014 | 功能完成后，集中做人工验收（`docs/windows-next.md` 第 4 节） |

## 关键结论（本轮新增）

- F-035（推断）：T-056 的原因。ConPTY 没有回滚区，窗口变高时只在底部加空行；inshellisense 内部的 xterm 却从回滚区拉回旧行，两边的行号错开。
- F-036：升级后直接运行 `is init` 不会更新资源，所以安装脚本每次都先运行 `reinit`。
- F-037：`is` 启动失败时，上游的初始化脚本会关掉每个新开的 PowerShell。已修复（T-062）。
- PATH：`[Environment]::SetEnvironmentVariable` 会把 REG_EXPAND_SZ 改成 REG_SZ 并展开变量。安装脚本改为直接读写注册表，卸载时恢复原值。
- 测试结果：
  - Mac：L1 共 396 个，385 个通过，10 个跳过，1 个失败（Homebrew）；
  - 宿主：70 个全部通过；
  - 安装脚本自测：69 项全部通过，另有 3 个用例只在 Windows 上运行。

## 推送和 CI

- 所有端都推送到对方仓库的 `develop`（D-008）。用户的 fork 只作备份。
- 推送后，GitHub Actions 的 **Windows** 工作流会自动运行（只改文档的推送除外），结果看 Actions 页面。Mac 上没有 `gh`，可以用公开 API 读取 annotation（`docs/dev.md` 第 7 节）。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`），并先运行一次 `node build/index.js reinit` 解包资源。运行测试时加 `--ci`。
- 提交前单独运行 `sh scripts/check-public.sh`，并检查它的退出码，不要接在管道后面。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
- 不要在用户的电脑上运行安装包或 `test-installer.ps1`（D-014）；后者只能在一次性的环境中运行。
