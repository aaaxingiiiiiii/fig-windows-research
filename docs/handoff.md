# 当前交接状态

更新：2026-10-16 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。Windows 端当前要做的事见 **`docs/windows-next.md`**（第 3 版）；用户只需对那边的 AI 说“同步 develop，读 docs/windows-next.md，按顺序做”。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。**用户决定 D-014：先把功能做完，需要用户在场的测试放到最后；最终交付 Windows 安装包和配置。**

- **阶段 A**：
  - 功能已经完成。
  - 安装包（T-059）在 GitHub Actions 的 Windows 虚拟机中自动构建，验收 30 项全部通过：安装、新开终端出现补全、升级、卸载后逐字节恢复、故障注入（T-061，E-020）。安装包经过 GPT 两轮审查，问题都已修复。
  - T-056（窗口大小改变后错位）：原因已经查明（F-035），**还没有修复**。曾以为改用系统 ConPTY 可以修复，第四次 CI 发现它让候选完全不出现（E-021），已撤回；之前对照试验的“全部对齐”是检查脚本的漏洞造成的误判，已修补。可以清屏恢复，按 D-014 排在功能之后。
- **阶段 B**：
  - 已完成：协议、inshellisense 一侧的渲染器、宿主的协议核心，以及默认端点和自动启动宿主（T-063，D-016）。
  - Windows 端认领了 T-021，但还没有推送任何进度；之后是 T-019、T-044。
- **待用户决定**：T-064，PowerShell 自带命令及其参数的补全。现在完全没有（F-038），推荐的做法见 `research/powershell-native-completion.md`。

## 进度

| 谁 | 已完成 | 下一步 |
| --- | --- | --- |
| Claude Code（Mac，整合者） | 本轮：T-056 分析、T-059 至 T-063、D-014 至 D-016、windows-next 第 3 版；统筹 Mac 上的 GPT（三轮审查安装包、调研 F-038） | 用户决定 T-064 后安排；等 T-044 后把宿主加入安装包（T-046） |
| Codex/GPT-6（Windows） | T-035、T-052、T-057（只差用户确认）、T-048 无人值守部分、T-056 复现和对照试验（E-019）、T-029、.NET 10 | 按 `docs/windows-next.md`：新测试的复验 → T-021 → T-019 → T-044 |
| GPT/Codex（Mac） | T-015、T-042、T-054、T-055；2026-10-16 两轮审查安装包（由整合者用 `codex exec` 派发，见 roadmap 8.2） | 由整合者按需派发 |
| 用户 | T-012；仓库授权；D-014 | 功能完成后，集中做人工验收（`docs/windows-next.md` 第 4 节） |

## 关键结论（本轮新增）

- F-035：T-056 的原因。node-pty 附带的 conpty.dll 在窗口变化后不重画屏幕，inshellisense 内部的 xterm 却从回滚区拉行，两边的行号错开。系统 ConPTY 会重画，但用它时不出现候选（E-021）。
- F-036：升级后直接运行 `is init` 不会更新资源，所以安装脚本每次都先运行 `reinit`。
- F-037：`is` 启动失败时，上游的初始化脚本会关掉每个新开的 PowerShell。已修复（T-062）。
- PATH：`[Environment]::SetEnvironmentVariable` 会把 REG_EXPAND_SZ 改成 REG_SZ 并展开变量。安装脚本改为直接读写注册表，卸载时恢复原值。
- 测试结果：
  - Mac：L1 共 413 个，402 个通过，10 个跳过，1 个失败（Homebrew）；
  - Windows（CI，第五次运行，E-022）：L1、宿主测试、安装脚本自测、安装包验收（30 项）全部通过；
  - 宿主：75 个全部通过；
  - 安装脚本自测：82 项全部通过，另有 4 个用例只在 Windows 上运行。

## 推送和 CI

- 所有端都推送到对方仓库的 `develop`（D-008）。用户的 fork 只作备份。
- 推送后，GitHub Actions 的 **Windows** 工作流会自动运行（只改文档的推送除外），结果看 Actions 页面。Mac 上没有 `gh`，可以用公开 API 读取 annotation（`docs/dev.md` 第 7 节）。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`），并先运行一次 `node build/index.js reinit` 解包资源。运行测试时加 `--ci`。
- 提交前单独运行 `sh scripts/check-public.sh`，并检查它的退出码，不要接在管道后面。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
- 不要在用户的电脑上运行安装包或 `test-installer.ps1`（D-014）；后者只能在一次性的环境中运行。
