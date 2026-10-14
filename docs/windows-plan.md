# Windows 实现路线（概要）

本页只做概要说明；详细的步骤、测试和估算以 `docs/mvp-plan.md` 为准。

- **目标组合**：PowerShell 7 + Windows Terminal（D-002）。
- **路线**（D-007）：
  1. **阶段 A：终端内版本。**把 inshellisense（MIT）引入 `src/inshellisense/`，补上 Windows 上的缺口：generator 不再依赖 Git Bash；对照规格补齐差异；打包并提供安装脚本。预计 1–2 周。
  2. **阶段 B：悬浮窗。**在 inshellisense 中增加悬浮窗渲染器；C# 宿主只负责用 UIA 定位光标和显示列表。定位失败时回到终端内显示。预计 2–3 周。
- **之后**（尚未排期）：
  - 补全数据：评估并改写依赖 POSIX 命令的 generator（T-015）。
  - 体验：多显示器、DPI 切换、输入法组字期间的处理、设置项。
  - 发布：代码签名，用 winget 分发。
  - 兼容：conhost、VS Code 终端、Windows PowerShell 5.1、cmd。

## 主要风险

| 风险 | 应对 |
| --- | --- |
| 两层 ConPTY（WT → inshellisense → pwsh）导致兼容问题 | 由 T-035 实测；发现阻断问题时，由用户决定是否回到已存档的 PSReadLine 路线（`docs/archive/`） |
| spec 中的 generator 假定 POSIX 命令（`ls`、`grep` 等） | T-037 去掉对 Git Bash 的依赖；T-015 统计受影响的 spec |
| 执行第三方 spec 代码的安全问题 | 只加载打包时固定版本的 spec；generator 设置超时 |
| 光标在高 DPI 下定位偏移 | T-019 实测；必要时修正 padding 的缩放，或使用单元格换算（`research/caret-wt.md`） |
| PSReadLine 的灰色预测文字与补全菜单冲突 | T-035 人工清单第 14 项 |
