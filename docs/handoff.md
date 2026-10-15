# 当前交接状态

更新：2026-10-15 · Claude Code/Opus 5.5（本轮整合者）。每次会话结束时重写本页，保持一屏可读。多个 AI 同时工作时，由整合者统一更新本页（`docs/workflow.md`“多个 AI 同时工作”）。

后续工作的顺序、分工、每一步的验收方法，以及两端如何同步代码，见 **`docs/roadmap.md`**。

## 一句话

路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再加 Fig 式悬浮窗（阶段 B）。

- 阶段 A 的代码已经完成，在 Windows 上构建成功，L1 测试全部通过（T-052）。现在等待用户在 Windows Terminal 中完成人工清单：T-035（16 项）和 T-048（8 项）。
- 阶段 B：协议已完成（T-042）。T-043 由 Claude 在 Mac 上进行。

## 进度

| 谁 | 已完成 | 进行中 / 下一步 |
| --- | --- | --- |
| Claude Code（Mac，整合者） | T-036 至 T-039、T-049、T-051、T-013；`docs/usage.md`、`docs/roadmap.md` | **T-043**（分支 `ai/claude/T-043`，用户改派）；T-050 的三个分支已推送 |
| Codex/GPT-6（Windows） | T-035 的环境检查、冒烟测试和 L1 预检；T-052（Windows 上的测试平台假设） | 和用户一起完成 T-035、T-048 的人工清单 → T-040 |
| GPT/Codex（Mac） | T-015、T-042 | 暂无安排（T-043 已改派） |
| 用户 | 对方仓库授权；inshellisense fork | T-035 和 T-048 的人工清单（Windows）；T-012 的人工清单（Mac，约 15 分钟）；T-050 创建 PR 并签署 CLA |

## 关键结论（本轮新增）

- 测试结果：
  - Mac：`npm test -- --ci` 共 276 个，265 个通过，10 个跳过，1 个失败（本机 Homebrew 环境问题）。
  - Windows：265 个通过，10 个跳过，0 个失败（E-009）。
- Windows 上补全文件夹时，结尾的分隔符是 `\`，例如 `'My Docs\'`；PowerShell 可以正常使用这种写法。
- F-006 已查明：Kiro 只有在 `Q_TERM` 已设置时，才输出完整的 shell 集成脚本（E-007）。本机的 Kiro 已自动更新为 2.31.0。
- T-050：三个修复分支都在用户的 inshellisense fork 上，PR 说明和预填链接在 Mac 的 `local/upstream-pr/`。

## 推送

- 2026-10-15 起，所有端都推送到对方仓库的 `develop`（D-008）。用户的 fork 只作备份。

## 注意

- `local/` 只存在于产生它的机器上；新的工作目录需要运行 `sh scripts/fetch-sources.sh`，或者复制一份。
- 从源码运行 inshellisense 需要 Node 18–22（`docs/dev.md`）。运行测试时加 `--ci`。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
