# 当前交接状态

更新：2026-10-14 · Claude Code/Opus 5.5。每次会话结束时重写本页，保持一屏可读。

## 一句话

路线已经确定：在 **PowerShell 7 + Windows Terminal** 上做 **Fig 式悬浮窗**补全，代码采用 MIT 许可。架构和成本评估已经完成（`docs/overlay-design.md`，MVP 约 9–15 人周）。下一步是在真实的 Windows 机器上完成 4 项验证（T-019 至 T-022），再全面开发。

## 已确认

- 研究基础：Fig 的源码已开源（`aq`），本机的 Kiro CLI 2.30.0 用于对照。补全链路见 `research/architecture.md`，行为规格和 13 条用例见 `specs/completion.md`。
- 决策：D-001（以源码为主）、D-002（PowerShell 7 + WT）、D-003（Fig 式悬浮窗）、D-005（MIT）已经采用；D-004（C#/.NET 宿主 + WebView2 中运行复用的 Fig TS 前端）暂定。
- 关键技术事实：
  - Fig 前端只用到约 15 种宿主接口，可以放进 WebView2 复用（F-018 至 F-020）。
  - PSReadLine 能读写缓冲区，但没有“缓冲区已变化”事件（F-021、`research/psreadline.md`）。
  - WT 的光标矩形可以通过 UIA TextPattern 取得，高 DPI 下可能偏移（F-023、F-024、`research/caret-wt.md`）。

## 部分完成

- 所有关于 Windows 的结论都来自源码和文档，**还没有在 Windows 上实际运行过**。
- 规格中的源码预期还没有在 Kiro 2.30.0 上验证（T-012）。

## 下一条最小可执行任务

- 有 Windows 环境：**T-019**（光标定位），然后是 T-020（适配模块）。这两项风险最高，决定整个方案能否成立。环境见 `docs/windows-setup.md`，测量方法和通过标准见 `docs/overlay-design.md` 的“验证关卡”。
- 只有仓库和网络：T-015（spec 在 Windows 上的可用性）或 T-017（PowerShell 分词与转义规则）。
- 有 Mac 并且有人可以看屏幕：T-012。

## 注意

- `local/` 只存在于产生它的机器上；其他机器先运行 `sh scripts/fetch-sources.sh`。
- 提交使用仓库本地配置的 git 身份；不要改写或强制推送历史。
