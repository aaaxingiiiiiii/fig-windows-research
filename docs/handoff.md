# 当前交接状态

更新：2026-10-14 · Claude Code/Opus 5.5。每次会话结束时重写本页，保持一屏可读。

## 一句话

研究方法已经从“反编译 Fig 的 Mac 程序”改为“读开源源码，再用 Kiro 做运行时对照”（D-001）。补全链路和行为规则已经从源码整理完毕，接下来需要用户做两个决定，并分别在 Mac 和 Windows 上做实测。

## 已确认

- Fig 的后继产品是 Kiro CLI。本机安装的是 2.30.0，正在运行，zsh 会话被 `kiro-cli-term` 包装（`research/target.md`）。
- Fig 补全的完整源码以 MIT/Apache-2.0 开源，spec 库以 MIT 开源；三个参考仓库已固定 commit，可以用 `scripts/fetch-sources.sh` 拉取。
- 补全链路已整理到 `research/architecture.md`，行为规则和 13 条用例在 `specs/completion.md`。
- Fig 从未完成 Windows 版本：有 ConPTY 和光标定位代码，但没有 PowerShell 集成，也没有 Windows IPC。Microsoft inshellisense 已经在 Windows 上可用（`research/prior-art.md`）。

## 部分完成

- 规格中所有“源码预期”都基于开源 1.19.7，还没有在 Kiro 2.30.0 上验证（T-012）。
- `prior-art.md` 第 3 节中关于 PSReadLine 的内容来自记忆，尚未核实（T-016）。

## 等用户决定

- D-002：Windows 首个支持的组合，推荐 PowerShell 7 + Windows Terminal。
- D-003：实现路线，可选基于 inshellisense、PowerShell 原生插件或 Fig 式悬浮窗。建议先完成 T-014 再决定。
- D-005：本项目代码的许可证。

## 下一条最小可执行任务

- 只有仓库和网络的 AI：**T-016**，核实 PSReadLine 相关接口，约 1 小时，结果直接影响 D-003。
- 有 Windows 环境：T-014。
- 有 Mac 并且有人可以看屏幕：T-012。

## 注意

- `local/` 只存在于产生它的机器上；其他机器先运行 `sh scripts/fetch-sources.sh`。
- 本轮的变更尚未提交，等待用户确认。
