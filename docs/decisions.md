# 决策记录

状态分为：待决定、已采用、已推翻。AI 可以提出决策并给出推荐，但标为“待决定”的事项要等用户选择后才能执行。推翻某项决策时保留原条目，并注明原因和日期。

---

## D-001 研究方法：以开源源码为主，Kiro 只做黑盒观察

- 状态：已采用（2026-10-14，由 AI 在本轮提出；用户可以推翻）
- 背景：原大纲假设 Fig 是黑盒，计划在 Mac 上用 REA、Ghidra、Hopper 反编译 Mach-O。核实后发现 Fig 的代码已以 MIT/Apache-2.0 开源（`aq`），spec 库为 MIT（`wf`），本机可以运行的后继产品 Kiro CLI 是闭源的。
- 决定：
  1. 行为依据的优先级是开源源码，其次是 Kiro 2.30.0 的运行时观察，最后是公开文档。
  2. 不反编译、不提取 Kiro 的闭源二进制。开源基线与 Kiro 不一致时，只用黑盒方式（录屏、命令输出）记录差异。
  3. REA、Ghidra、Hopper 不再是前置条件，只在出现无法用源码解释的问题时，经用户同意后再启用。
- 后果：研究速度快得多，引用可以公开复现；但开源基线是 1.19.7，与 Kiro 2.30.0 之间的差异需要逐项验证（F-005）。

## D-002 Windows 首个支持的 shell 和终端组合

- 状态：待决定
- 选项：
  1. **PowerShell 7 + Windows Terminal**（推荐）：Windows 11 的默认终端；PSReadLine 提供精确的缓冲区读取、按键处理和预测插件接口；也是 inshellisense 已覆盖的组合，便于对照。
  2. Windows PowerShell 5.1：系统自带，但 PSReadLine 版本较旧，无法使用预测插件接口（推断）。
  3. cmd（配合 Clink）：用户多，但需要依赖 Clink 等第三方工具才能获得行编辑能力。
  4. Git Bash：可以最大程度复用 Fig 的 bash 集成，但不是 Windows 原生体验。
- 影响：决定 T-014 的验证对象，以及阶段一的验收环境。

## D-003 实现路线

- 状态：待决定（建议先完成 T-014，再做选择）
- 选项：
  1. **基于 inshellisense**：fork 或向上游贡献。最快得到可用版本；体验是终端内绘制而不是悬浮窗；依赖 Node；在 Windows 上，generator 要经过 Git Bash 执行。
  2. **PowerShell 原生插件**：一个 PowerShell 模块，通过 PSReadLine 的键处理器或预测插件取得输入，补全引擎可以替换。最符合“插件”的形态，读取缓冲区精确，不需要包装 PTY；只支持 PowerShell。
  3. **Fig 式完整架构**：ConPTY 包装加置顶悬浮窗（例如 WebView2）加 IPC。体验最接近 Fig，支持任意 shell；成本和风险最高，涉及光标像素定位、焦点、输入法和 DPI 等问题。
- 推荐：先用 T-014 实测 inshellisense，列出它与 Fig 的体验差距。如果差距可以接受，选 1；如果需要 Windows 原生的 PowerShell 体验，选 2，同时把补全引擎做成独立组件，日后再加上 3 的悬浮窗。
- 依赖：D-002。

## D-004 补全引擎的语言与 JS 运行时

- 状态：待决定（依赖 D-003）
- 约束：`wf` 的 spec 是可执行的 JavaScript，必须嵌入 JS 运行时，否则只能支持 spec 中的静态部分。
- 选项：TypeScript + Node（可在许可证范围内复用 `aq:packages/autocomplete-parser` 和 `is` 的逻辑）；C#/.NET + Jint 或 ClearScript（与 PowerShell 同进程）；Rust + QuickJS 或 Boa（可复用 `aq` 的 Rust 代码）。

## D-005 本项目代码的许可证

- 状态：待决定
- 建议：采用 MIT 或 MIT/Apache-2.0 双许可，与计划复用的 `aq`、`wf`、`is` 兼容。在第一次提交实现代码之前决定。
