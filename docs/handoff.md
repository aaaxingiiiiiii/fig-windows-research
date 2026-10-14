# 当前交接状态

更新：2026-10-14 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。阶段 A 中只需要 Mac 就能做的部分已经基本完成，现在**卡在 Windows 实测**：T-035、T-048。

## 进度

| 谁 | 已完成 | 进行中 / 下一步 |
| --- | --- | --- |
| Claude Code（Mac） | T-036 引入源码；T-038 规格用例自动化；T-039 修复 pwsh 引号和中文删除；T-037 generator 直接执行（`bash`、`sh` 经 Git Bash） | 可以接着做 T-049（改写 POSIX 依赖），或者等 T-042 完成后做 T-043 |
| GPT/Codex（Mac，worktree `../fig-windows-research-codex`） | T-015 spec 兼容性评估（`research/spec-compat.md`） | T-042 悬浮窗协议（分支 `ai/codex/T-042`） |
| Windows 上的 AI 和用户 | — | **T-035**（实测原版 inshellisense）→ **T-048**（实测我们的修改）→ T-040（打包） |

### 交给 Windows 上那个 AI 的话

> 克隆仓库并切换到 develop 分支，阅读 AGENTS.md 和 docs/handoff.md。先做 T-035：按 docs/windows-setup.md 准备环境，运行 scripts/windows/check-env.ps1，再按 docs/mvp-plan.md 中的“T-035 人工清单”和用户一起逐条测试，结果写入 research/spike-inshellisense.md。然后做 T-048：按 docs/dev.md 从源码构建 src/inshellisense，按“T-048 人工清单”测试，结果写入 research/spike-fork-windows.md。安装软件前先征得用户同意。每个任务在 ai/<工具>/<任务号> 分支上提交，合并到 develop 前先同步最新的 develop；不要重写 docs/handoff.md。

## 关键结论（本轮新增）

- 我们的分支在 Mac 上：全部测试 240 个，229 个通过，10 个跳过，1 个失败（本机 Homebrew 环境问题，见 `docs/dev.md`）。
- 已修复：pwsh 路径引号（F-029）、中文补全多删字符（F-030，在 bash 和 zsh 上实测确认）；Windows 上的 generator 不再强依赖 Git Bash。这几处对上游也有用（`src/inshellisense/CHANGES.md` 中标为“可提交上游”），要不要向 microsoft/inshellisense 提 PR，由用户决定。
- inshellisense 与 Fig 的 7 处做法差异见 `specs/completion.md` 第 9 节。是否改成 Fig 风格，等用户试用（T-041）后再决定。

## 推送

- `origin/develop`（用户的 fork）可以推送，已是最新。
- `upstream/develop` 仍然返回 403。授权之前，可以从 fork 提 Pull Request（D-008）。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`）。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
