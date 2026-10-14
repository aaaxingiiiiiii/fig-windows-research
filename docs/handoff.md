# 当前交接状态

更新：2026-10-14 · Claude Code/Opus 5.5。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。计划见 `docs/mvp-plan.md`。开发分支是 `develop`。

## 当前分工（3 个 AI 并行）

| 谁 | 在哪里 | 任务 | 分支 / 目录 |
| --- | --- | --- | --- |
| Claude Code | Mac | T-036：引入 inshellisense 源码，跑通构建和测试，编写 `docs/dev.md`（之后是 T-038、T-037） | `ai/claude/T-036`，主目录 |
| GPT/Codex | Mac | T-015：评估 spec 在 Windows 上的可用性；然后做 T-042：悬浮窗协议 | `ai/codex/T-015`，独立 worktree `../fig-windows-research-codex` |
| Windows 上的 AI 和用户 | Windows | T-035：实测原版 inshellisense（关卡）；之后可以做 T-029、T-021 | `ai/<工具>/T-035` |

### 交给 Windows 上那个 AI 的话

> 克隆仓库并切换到 develop 分支，阅读 AGENTS.md 和 docs/handoff.md。你负责 T-035：按 docs/windows-setup.md 准备环境，先运行 scripts/windows/check-env.ps1，然后按 docs/mvp-plan.md 中的“T-035 人工清单”和用户一起逐条测试，结果写入 research/spike-inshellisense.md。安装任何软件前先征得用户同意。完成后按 AGENTS.md 更新任务板和日志，在 ai/<工具>/T-035 分支上提交，合并到 develop 前先同步最新的 develop。不要重写 docs/handoff.md。

### 交给 Mac 上 GPT 的话

> 进入目录 ../fig-windows-research-codex（这是一个独立的 git worktree，当前分支是 ai/codex/T-015，不要在主目录里工作）。阅读 AGENTS.md、docs/handoff.md 和 docs/workflow.md 中“多个 AI 同时工作”一节。先做 T-015，再做 T-042，两个任务各用一个分支（ai/codex/T-015、ai/codex/T-042），都从最新的 develop 分出。参考源码在 local/sources/ 中。完成后只更新任务板上自己的行，并在 docs/log.md 末尾追加记录，不要重写 docs/handoff.md。合并到 develop 前先同步最新的 develop，然后推送到 origin。

## 已确认

- 研究结论：F-001 至 F-027（`research/findings.md`）。决策：D-001、D-002、D-005、D-007、D-008 已采用；D-003 已修订；D-004、D-006 已推翻（旧计划在 `docs/archive/`）。
- 推送：`origin/develop` 可以推送。推送 `upstream/develop` 返回 403，用户正在与仓库所有者沟通权限；在此之前，可以从 fork 提 Pull Request。

## 部分完成

- 所有关于 Windows 的结论都来自源码和文档，**还没有在 Windows 上实际运行过**。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
