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

- 状态：已采用（2026-10-14 用户要求在开发分支上工作；2026-10-15 对方仓库已授权，推送目标随之更新）
- 决定：
  - 日常开发在 `develop` 分支上进行（用户所说的“dev 分支”，在对方仓库中的实际名字是 `develop`）。
  - 每个任务在 `ai/<工具>/<任务号>` 分支上完成，再合并回 `develop`。`main` 只用于里程碑。
  - **所有端都推送到对方的仓库**（`xingdouiii-maker/fig-windows-research`）。Mac 上它的远程名是 `upstream`，Windows 上是 `origin`。
- 历史：2026-10-14 至 2026-10-15，Mac 端没有对方仓库的写权限，两端通过用户的 fork 中转（Mac 上的 `origin`，Windows 上的 `mac`）。那个 fork 现在只作备份，不再要求同步；新的工作不要只推送到 fork。

## D-009 T-042：建立 inshellisense 悬浮窗协议 v1

- 状态：已采用（2026-10-14，D-007 / T-042 授权范围内的技术细化；不是新增产品路线）。
- 原因：归档的 v0 面向 PSReadLine/WebView2，会把按键、插入和 generator 执行放进宿主，不适用于 D-007。新增 `docs/protocol.md`，协议标识 `figwin-overlay`、版本 1，与旧 v0 不互通。
- 约定：命名管道双向 JSON 行；inshellisense 保留候选计算、选中项、分页、按键和插入；宿主只定位、显示、隐藏和报告状态。完整快照带会话/连接/序号，坐标按终端单元格而非字符串偏移计数。定位、会话绑定或连接失败时回退终端内显示。
- 边界：管道协议和 debugState 是 T-043/T-044 的共同契约，尚无实现或 Windows 实测。无法可靠匹配 WT 窗格时不显示悬浮窗；具体绑定和定位能力在 T-019/T-044 验证，不虚构 WT_SESSION 能唯一定位窗格。
- 修改规则：后续改变线格式或行为语义时增加协议版本并在本页记录原因；纯勘误注明文档修订，不复用旧版本号解释不兼容数据。

## D-010 与 Fig 的操作差异：暂时保留 inshellisense 的做法

- 状态：已采用（2026-10-14，用户同意）；最终是否改成 Fig 风格，**待 T-041 试用后由用户决定**
- 决定：`specs/completion.md` 第 9 节列出的 7 处做法差异（Tab、Enter、Esc 后的显示、光标在行中、↑ 在第一项、`--opt=`、补全命令名）暂不修改。
- 条件（用户要求）：在使用说明中写明这些差异。已写入 `docs/usage.md` 第 3 节。以后修改其中任何一项，都要同步更新使用说明。

## D-011 向 microsoft/inshellisense 提交通用修复

- 状态：**已撤销**（2026-10-15）。三个 PR（microsoft/inshellisense #486、#487、#488）创建后约 2 分钟，用户要求取消；整理者删除了 fork 上的分支，PR 随之关闭，没有签署 CLA。以后是否再提交，由用户另行决定；在此之前不要向上游提交任何内容。
- 原状态：已采用（2026-10-14，用户同意提交）
- 决定：
  - 先提交 T-039 的两项修复，每项一个 PR：PowerShell 路径引号（F-029）、宽字符删除数（F-030）。这两项与平台无关，已有单元测试；中文删除已在 bash 和 zsh 上实测。
  - T-037（Windows 上直接执行 generator）等 T-048 在 Windows 上验证后，再决定是否提交。
  - 2026-10-15 用户同意追加第三个 PR：T-051（custom generator 的默认目录和输出清理，F-032）。
- 做法：从上游最新的 `main` 建分支（2026-10-15 时仍是 8dcc9ca，与本仓库固定的版本相同），提交时使用本仓库的 git 身份。PR 从用户 GitHub 账号下的 inshellisense fork 发出；分支由 AI 推送，PR 由用户在预填好标题和说明的页面上确认创建。微软要求贡献者签署 CLA，需要用户本人在 PR 中按机器人的提示签署，AI 不代签。
- 合并后：在 `src/inshellisense/CHANGES.md` 的对应行注明上游 PR 编号；以后同步上游时，这几处改动可以直接用上游版本。

## D-012 悬浮窗宿主和测试工具使用 .NET 10

- 状态：已采用（2026-10-15，T-053 开始前的技术细化；不改变 D-007 的路线）
- 原因：.NET 8 的官方支持在 2026-11-10 结束；.NET 10 是长期支持版，支持到 2028 年 11 月。
- 决定：
  - 宿主（`src/overlay-host/`）和 wt-driver 都使用 .NET 10 SDK。
  - 与平台无关的类库目标为 `net10.0`，可以在 Mac 上构建和测试；Windows 专用部分（窗口、UIA）目标为 `net10.0-windows`。
- 安装：
  - Windows：`winget install Microsoft.DotNet.SDK.10`。
  - Mac：用微软官方的 `dotnet-install.sh` 安装到用户目录（`~/.dotnet`），不修改系统目录。
  - 安装前都要先征得用户同意。

## D-013 用户外出期间的授权：需要确认的事项采用整合者的推荐方案

- 状态：已采用（2026-10-15）。用户外出前对整合者说：“如果要我确认的，就直接使用你的推荐方案。”
- 据此确定的事项：
  1. **T-057**：在用户的 Windows 上用 `winget install --id Microsoft.PowerShell --source winget` 安装 PowerShell 7，并设为 Windows Terminal 的默认配置文件。修改 WT 的 `settings.json` 之前先备份；把 `defaultProfile` 改成 PowerShell 7 配置文件的 GUID。
  2. **D-012**：在 Windows 上用 `winget install Microsoft.DotNet.SDK.10` 安装 .NET 10 SDK。
  3. 在 Mac 上把 PowerShell 安装到用户目录（`~/.powershell`），只用于测试 T-058 的安装脚本，不修改系统目录。
- 不在授权范围内（仍须等用户本人决定）：
  - 修改用户的 `$PROFILE`（T-040 的实际安装）；
  - 删除用户数据；
  - 任何对外发布或提交（例如向上游提交 PR，见 D-011）；
  - 改变路线的决定。
- 用户回来后，由整合者汇总按本条执行了哪些事项。


## D-014 先把功能做完，需要用户在场的验收放到最后；最终交付 Windows 安装包和配置

- 状态：已采用（2026-10-16，用户）。用户原话：“这个测试先放一边，先把主要功能进度做完，最后我希望 windows 会有一个安装包，并且有相应的配置。”
- 决定：
  1. 需要用户在场的验收推迟到功能完成之后集中进行，包括：T-048 的 8 项人工清单、T-057 在新标签中的确认、T-056 的手动复现、阶段 B 的人工项（B3、B4 等），以及在用户电脑上的真实安装。
  2. 在此之前，用自动检查推进：T-048 的引擎检查、T-056 的模拟器、wt-driver，以及 GitHub Actions 的 Windows 虚拟机（T-061）。自动检查不能代替人工关卡，关卡状态保持未通过。
  3. 最终交付物是一个 Windows 安装包，连同配置文件：
     - 双击安装，不需要管理员权限，可以在“设置 → 应用”中卸载；
     - 安装界面列出会修改的内容，可以取消勾选；
     - 配置文件中每项设置都有中文说明。
     由 T-059（安装包）和 T-060（配置）完成。
  4. 安装包要修改用户的 `$PROFILE` 和 PATH。这一步由用户自己运行安装包时确认，在此之前不在用户的电脑上安装。安装、升级、卸载的自动验收在 GitHub Actions 的一次性虚拟机中进行。

## D-015 安装包使用 Inno Setup 7.1，在 GitHub Actions 的 Windows 虚拟机中构建和验收

- 状态：已采用（2026-10-16，整合者的技术选择，按用户“需要确认的用我的推荐方案”处理；不改变路线）
- 选择：
  - **Inno Setup 7.1**：
    - 支持按用户安装、不需要管理员权限；VS Code 的“用户安装版”就是这样用 Inno Setup 做的。
    - 7.x 起带有官方的简体中文界面。
    - 许可证允许任何用途，包括商业用途（`research/sources.md`）。
    - 备选方案：NSIS 可以在 Mac 上编译，但脚本更难维护；WiX（MSI）按用户安装时还要额外编写修改 PATH 和配置文件的自定义操作，太复杂。
  - **修改 `$PROFILE`、PATH、补全配置的逻辑仍然放在 `scripts/windows/install.ps1`、`uninstall.ps1`**：已有自测，安装包只负责复制文件和调用这两个脚本。
  - **GitHub Actions**：本仓库是公开仓库，GitHub 提供的 Windows 虚拟机免费。每次推送代码（只改文档的除外）都在虚拟机中做三件事：
    - 运行 L1 测试；
    - 构建安装包，并实际安装、升级、卸载一遍；
    - 运行 T-056 对照试验。
    安装包作为运行结果的附件保留 14 天，不发布 Release。
- 安装包显示的名称暂定为“figwin 终端补全”（figwin 是代码中一直使用的项目代号）。需要改名时，只改 `installer/figwin.iss` 中的 `AppName` 一行。
- 用户的电脑上不需要安装 Inno Setup。Windows 端要在本机构建时，需要先征得用户同意，再安装 Inno Setup 7.1。

## D-016 悬浮窗宿主的默认端点和自动启动

- 状态：已采用（2026-10-16，整合者的技术选择，补充协议 v1 第 2 节；不改变消息格式）
- 原因：以前只能通过环境变量 `FIGWIN_OVERLAY_PIPE` 指定端点，安装后的日常使用需要一个固定的规则，并且宿主没有运行时要能自动启动（T-046 的前置工作，T-063）。
- 决定：
  - 端点名称 `figwin-overlay-v1-<userKey>-<logonSession>`：userKey 是用户名转小写后 SHA-256 的前 16 个十六进制字符；logonSession 是 Windows 会话编号。Node 读不到会话编号，由 PowerShell 初始化脚本放进 `FIGWIN_LOGON_SESSION`。两端各自实现，测试使用同一组数据。
  - 只有配置文件中 `[overlay] enabled = true` 时才使用默认端点，默认关闭。明确设置的 `FIGWIN_OVERLAY_PIPE` 优先，这时不自动启动宿主（开发和测试）。
  - 连不上（ENOENT、ECONNREFUSED）时，在后台启动宿主 `--pipe <名称>`，每个会话最多一次。宿主程序默认是 `is.exe` 旁边的 `figwin-host.exe`，可以用配置中的 `hostPath` 指定。启动失败时只记日志，继续用终端内绘制。
  - 宿主用 `FirstPipeInstance` 保证同一个名称只有一个实例，后启动的安静退出。
- 安全：名称不是凭据，访问控制仍然靠 `PipeOptions.CurrentUserOnly`（协议第 2 节）。

## D-017 PowerShell 命令补全先做最小实现；阶段 A 先验收

- 状态：已采用（2026-10-16，用户）。用户原话：“可以先不做，弄一个最小实现吧，不然流程太长了。接下来还有什么任务，什么时候才可以验收。”
- 决定：
  1. T-064 只做最小实现：常驻的 pwsh 调用 TabExpansion2；只用于 PowerShell 自己的命令和没有 Fig 规格的命令；替换范围对不上时不给候选。会话中定义的函数和别名、同一会话中的补全等，以后再说（见 `research/powershell-native-completion.md`）。
  2. 不等悬浮窗：阶段 A 的安装包现在就验收，清单见 `docs/acceptance-phase-a.md`（14 项，约 30 分钟），它代替 D-014 中推迟的 T-040（真实安装）、T-048（人工清单）、T-057（新标签确认）的人工部分。悬浮窗（阶段 B）完成后，另做一次验收。
