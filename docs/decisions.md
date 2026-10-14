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

- 状态：已采用（2026-10-14，用户选择推荐项：PowerShell 7 + Windows Terminal）
- 选项：
  1. **PowerShell 7 + Windows Terminal**（推荐）：Windows 11 的默认终端；PSReadLine 提供精确的缓冲区读取、按键处理和预测插件接口；也是 inshellisense 已覆盖的组合，便于对照。
  2. Windows PowerShell 5.1：系统自带，但 PSReadLine 版本较旧，无法使用预测插件接口（推断）。
  3. cmd（配合 Clink）：用户多，但需要依赖 Clink 等第三方工具才能获得行编辑能力。
  4. Git Bash：可以最大程度复用 Fig 的 bash 集成，但不是 Windows 原生体验。
- 影响：决定验证关卡（T-019 至 T-022）的测试环境，以及阶段一的验收环境。

## D-003 实现路线

- 状态：已修订（2026-10-14，见 D-007）。最终目标仍然是 Fig 式悬浮窗，但改为分两步：先基于 inshellisense 做终端内版本，再在同一基础上加悬浮窗。下面的原始记录保留作参考。
- 原状态：已采用（2026-10-14，用户选择选项 3：Fig 式悬浮窗）
- 选项：
  1. 基于 inshellisense：MVP 约 1–2 周；菜单画在终端内。
  2. PowerShell 原生插件，终端内显示：MVP 约 4–6 周。
  3. **Fig 式悬浮窗**：MVP 约 9–15 周；体验最接近 Fig。
- 决定：采用选项 3，并按 `docs/overlay-design.md` 做以下调整：
  - 在 PowerShell 7 中，用 PSReadLine 适配模块代替 figterm 的 PTY 包装。
  - 把 Fig 的补全前端放进 WebView2 中复用。
  - 先完成验证关卡 T-019 至 T-022，再全面开发。
- 回退：如果 T-019（光标定位）不通过，第一版改为终端内显示，悬浮窗留到第 3 阶段。适配模块和补全引擎的投入都可以保留。
- 成本评估：见 `docs/overlay-design.md`。

## D-004 宿主语言、补全引擎与 JS 运行时

- 状态：已推翻（2026-10-14，被 D-007 取代）。新的选型：补全引擎沿用 inshellisense 的 TypeScript 代码，运行在 Node 上（发布时打包成单文件）；悬浮窗宿主用 C#/.NET 原生绘制，不使用 WebView2。下面的原始记录保留作参考。
- 原状态：暂定（2026-10-14，随 D-003 提出；验证关卡完成后定稿）
- 约束：`wf` 的 spec 是可执行的 JavaScript（F-016）。
- 暂定方案：
  - 宿主进程使用 **C#/.NET**（WinForms 或 WPF 加 WebView2）。它对 UI Automation、命名管道和 WebView2 的支持最直接，PowerShell 7 也运行在 .NET 上，日后可以把适配模块改写成 C# 二进制模块。
  - 补全引擎和 UI 使用 **TypeScript**，运行在 WebView2 中，复用 `aq` 的前端代码；JS 运行时就是 WebView2 自带的引擎。
  - 前端与宿主之间改用 **JSON 消息**，用自写的 `bridge` 包替换 Fig 原有的、基于 protobuf 的 `api-bindings`（2026-10-14 补充，见 `docs/protocol.md`）。
  - 适配模块先用 PowerShell 脚本实现。如果 T-020 的延迟不达标，再改为 C# 二进制模块。
- 备选：Rust（tao、wry、windows-rs）可以复用 Fig 的 Rust 代码，但 Fig 的 Windows 部分已经过时（F-014），所以不作首选。

## D-005 本项目代码的许可证

- 状态：已采用（2026-10-14，用户同意建议）
- 决定：本仓库采用 MIT 许可证，见根目录 `LICENSE`。与计划复用的 `aq`（MIT/Apache-2.0）、`wf`（MIT）、`is`（MIT）兼容；复用时保留原版权声明，并在 `research/sources.md` 中登记。

## D-006 MVP 的范围与实现取舍

- 状态：已推翻（2026-10-14，被 D-007 取代）。原计划已存档到 `docs/archive/mvp-plan-psreadline.md`。
- 原决定：按原计划第 2 节执行：
  - 复用 Fig 前端，前端与宿主之间用 JSON 桥接；
  - 适配模块先用 PowerShell 脚本实现；
  - 插入使用 `Replace`；
  - 悬浮窗不透明、不接收鼠标；
  - spec 打包在本地；
  - 模拟 `ls -1ApL`；
  - 只支持相对路径和 `~`；
  - 只实现 Fig 的默认键位。
- 退路：见 `docs/mvp-plan.md` 第 2 节末尾。任何一项退路都要先由用户确认才能启用。
- 后果：MVP 约 3.5–5 周（AI 编码，用户每天测试 1–2 小时）。cmd、Git Bash、历史模式、安装包和代码签名都放到 MVP 之后。

## D-007 路线修订：先做 inshellisense 终端内版本，再加悬浮窗

- 状态：已采用（2026-10-14，用户决定）
- 背景：用户希望尽快得到可用的版本。inshellisense（MIT）已经能在 PowerShell 7 上工作，并且它的 PTY 方式解决了 PSReadLine 路线中最难的“感知输入变化”问题（F-021、F-022）。
- 决定：
  1. 阶段 A：把 inshellisense 复制到本仓库（`src/inshellisense/`），补上 Windows 上的缺口（Git Bash 依赖、规格差异），做成终端内补全的可用版本。
  2. 阶段 B：在同一份代码中增加悬浮窗渲染器，配合一个只负责显示的 C# 悬浮窗宿主。
  3. 详细步骤、测试和退路见 `docs/mvp-plan.md`。
- 关卡：T-035 实测原版 inshellisense。如果发现阻断问题（例如两层 ConPTY 导致画面错乱或输入丢失），交给用户决定是否回到已存档的 PSReadLine 路线。
- 后果：第一个可用版本约 1–2 周，悬浮窗版本合计约 3–5 周；补全引擎的功能比 Fig 少一些，按 T-038 的差异清单逐步补齐。

## D-008 开发分支与推送

- 状态：已采用（2026-10-14，用户要求在开发分支上工作）；推送目标有一项待确认，见下文
- 决定：
  - 日常开发在 `develop` 分支上进行（用户所说的“dev 分支”，在对方仓库中的实际名字是 `develop`）。
  - 每个任务在 `ai/<工具>/<任务号>` 分支上完成，再合并回 `develop`。`main` 只用于里程碑。
- 现状：
  - 本地 remote `origin` 是用户的 fork，可以推送，已建立 `origin/develop`。
  - `upstream`（`xingdouiii-maker/fig-windows-research`）的 `develop` 分支已经包含到 T-034 为止的提交，但当前账号推送时返回 403，没有写权限。
- 待确认：由仓库所有者把当前账号加为协作者，直接推送到 `upstream/develop`；或者改为从 `origin/develop` 向 `upstream/develop` 提 Pull Request。
