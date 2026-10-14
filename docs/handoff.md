# 当前交接状态

更新：2026-10-14 · Claude Code/Opus 5.5。每次会话结束时重写本页，保持一屏可读。

## 一句话

路线已修订（D-007）：在 PowerShell 7 + Windows Terminal 上，**先基于 inshellisense 做终端内补全**（阶段 A，约 1–2 周），**再在同一份代码上加 Fig 式悬浮窗**（阶段 B，约 2–3 周）。计划见 `docs/mvp-plan.md`。开发分支是 `develop`（D-008）。

## 已确认

- 研究结论：F-001 至 F-027，见 `research/findings.md`。新路线依赖的关键事实：
  - inshellisense 已支持 pwsh（F-015）；
  - PTY 方式可以看到输入法提交的文字和粘贴的内容，避开了 PSReadLine 没有“缓冲区变化”事件的问题（F-021、F-022）；
  - WT 的光标可以通过 UIA 定位（F-023）。
- 决策：D-001、D-002、D-005、D-007、D-008 已经采用；D-003 已修订；D-004、D-006 已推翻（原计划存档在 `docs/archive/`）。

## 部分完成

- 所有关于 Windows 的结论都来自源码和文档，**还没有在 Windows 上实际运行过**。
- 推送：`origin/develop`（用户的 fork）可以推送。推送 `upstream/develop` 返回 403，需要仓库所有者授予写权限，或者改用 Pull Request（D-008 待确认）。

## 下一条最小可执行任务

- 有 Windows 并且有人可以操作：**T-035**（实测原版 inshellisense，按人工清单执行，大约 1 小时）。这是阶段 A 的关卡。
- 任何系统：**T-036**（把 inshellisense 源码引入 `src/inshellisense/`，跑通构建和测试），之后是 T-037、T-038。

## 注意

- `local/` 只存在于产生它的机器上；其他机器先运行 `sh scripts/fetch-sources.sh`。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史；不要直接提交到 `main`。
