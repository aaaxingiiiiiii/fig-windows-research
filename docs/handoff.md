# 当前交接状态

更新：2026-10-15 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。阶段 A 中只需要 Mac 就能做的部分已经完成，包括 T-049：常用补全不再依赖 Git Bash。现在**卡在 Windows 实测**：T-035、T-048。阶段 B 的协议（T-042）已经完成，GPT 接着做 T-043。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。

## 进度

| 谁 | 已完成 | 进行中 / 下一步 |
| --- | --- | --- |
| Claude Code（Mac） | T-036、T-037、T-038、T-039、T-049（POSIX 命令模拟）、T-051（custom generator 的目录和输出）；`docs/usage.md`、`docs/roadmap.md` | T-013 已完成（F-006 查明）；等待 Windows 验收结果，修复其中发现的缺陷；T-050 等用户 Fork |
| GPT/Codex（Mac，worktree `../fig-windows-research-codex`） | T-015、T-042（`docs/protocol.md` v1） | **T-043**（渲染器抽象和悬浮窗渲染器），已预留，2026-10-15 时还没有开始 |
| Codex/GPT-6（Windows）和用户 | T-035 的环境检查和受控终端冒烟测试（分支 `upstream/ai/codex/T-035`，`research/spike-inshellisense.md`） | **T-035 的 16 项 WT 人工清单，需要用户在 Windows Terminal 中逐项操作** → **T-048**（8 项）→ T-040（打包） |
| 用户 | D-010、D-011 已决定 | T-050：在 GitHub 上 Fork microsoft/inshellisense，并在 PR 中签署 CLA |

### 交给 Windows 上那个 AI 的话

> 克隆仓库并切换到 develop 分支，阅读 AGENTS.md 和 docs/handoff.md。先做 T-035：按 docs/windows-setup.md 准备环境，运行 scripts/windows/check-env.ps1，再按 docs/mvp-plan.md 中的“T-035 人工清单”和用户一起逐条测试，结果写入 research/spike-inshellisense.md。然后做 T-048：按 docs/dev.md 从源码构建 src/inshellisense，按“T-048 人工清单”测试，结果写入 research/spike-fork-windows.md。安装软件前先征得用户同意。每个任务在 ai/<工具>/<任务号> 分支上提交，合并到 develop 前先同步最新的 develop；不要重写 docs/handoff.md。

### T-050（上游 PR）的现状

- 两个分支已经在 Mac 上准备好，上游的构建、lint 和测试都通过。备份在 `local/upstream-pr/`，包括 patch 和英文 PR 说明；这个目录只在当前这台 Mac 上。
- 下一步：用户 Fork 之后，从上游 main（8dcc9ca）应用这两个 patch，推送到 fork，再用 compare 页面创建 PR。微软的 CLA 机器人会要求签署，需要用户本人操作。

## 关键结论（本轮新增）

- T-049：Windows 上，文件补全以及 git、npm/yarn/pnpm/npx、cargo、make 的常用动态候选由 Node 模拟 POSIX 命令（`src/runtime/posixEmulation.ts`），不需要 Git Bash。Mac 上模拟 win32 的测试通过，还没有在 Windows 上运行过。
- T-048 清单已修正：原来的第 4、5 项选错了命令（`npm run`、`git restore` 实际走的路径与清单描述不符），现在第 4 项是 `npm uninstall -g `，第 5 项是 `git diff `，另外新增了第 6 项。
- F-032：custom generator 的默认目录和输出清理与 Fig 不同，已由 T-051 修复，T-048 清单新增第 8 项用于验证。这项修复与平台无关，也可以提交上游（是否加入 T-050，由用户决定）。
- Mac 上的测试（`npm test -- --ci`）：共 275 个，264 个通过，10 个跳过，1 个失败（Homebrew 环境问题）。

## 推送

- 2026-10-15 起，对方仓库已授权，所有端都推送到对方仓库的 `develop`（D-008，`docs/roadmap.md` 第 2 节）。下面两条是此前的情况，保留作记录。

- `origin/develop`（用户的 fork）可以推送，已是最新。
- `upstream/develop`：Windows 端已把 Mac 的提交同步上去（35db2c0）。2026-10-15 用户说对方已经授权，但从 Mac 推送仍返回 403，可能是协作邀请还没有接受，或者本机保存的令牌没有这个仓库的权限。在此之前，两边通过 `origin/develop` 同步。
- Windows 端合并 T-035 前要注意：`research/evidence.md` 中 E-005 前面多了一个空行，表格会断开。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`）。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
