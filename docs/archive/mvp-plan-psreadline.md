# 最小实现方案与分阶段计划

> **已存档（2026-10-14）**：本文是“PSReadLine 适配模块 + Fig 前端 + WebView2”路线的最小实现方案。D-007 已把路线改为“先基于 inshellisense 做终端内版本，再加悬浮窗”，当前计划见 `docs/mvp-plan.md`。如果将来 inshellisense 路线受阻，可以回到本方案；其中的调研结论仍然有效。

更新：2026-10-14。本页是实现阶段的主计划，对应 D-006（MVP 范围）和 D-004（技术选型）。架构背景见 `docs/overlay-design.md`，模块之间的消息格式见 `docs/protocol.md`。

## 1. 目标

在 **PowerShell 7 + Windows Terminal** 中，用户输入命令时，光标旁边自动弹出 Fig 风格的悬浮补全窗：

- 可以补全子命令、选项和参数，并显示说明；
- 用 Tab、Enter、↑、↓、Shift+Tab、Esc 操作；
- 插入结果正确，包括带空格的路径；
- 不影响正常输入，悬浮窗不可见时按键行为与原来完全一致。

**判断原则**：在保证上述体验的前提下，新写的代码越少越好；能复用的经过验证的代码（Fig 前端、`wf` spec）尽量复用；有风险的部分先验证，并准备退路。

## 2. 关键取舍

| 方面 | 最小实现的选择 | 暂不做 | 理由 |
| --- | --- | --- | --- |
| 补全引擎与 UI | **复用 Fig 前端源码**（`aq` 的 autocomplete-app、autocomplete-parser、shell-parser），只把底层的 `api-bindings` 换成自写的 JSON 桥 | 自写引擎 | 行为与 Fig 一致，规格用例可以直接对照；新代码只有桥接层，约 400 行 |
| 前端与宿主的通信 | JSON 消息 | Fig 原有的 protobuf | 少一套代码生成工具链，日志可以直接阅读，方便 AI 调试 |
| 感知输入变化 | 为可打印字符和编辑键绑定脚本处理器；粘贴时用 `[Console]::KeyAvailable` 跳过中间状态；按 Tab、Enter 时再核对一次缓冲区 | 预测插件钩子、C# 二进制模块 | 不需要编译就能迭代；T-020 不达标时再升级 |
| 插入 | PSReadLine 的 `Replace` 加 `SetCursorPosition` | 像 figterm 那样往 PTY 写退格和文本 | 精确，并且支持撤销 |
| 光标定位 | UIA TextPattern；拿不到时贴着终端控件底部显示 | 自写输入法、注入代码 | 见 `research/caret-wt.md` |
| 悬浮窗 | 不透明矩形、不接收鼠标、不抢焦点 | 透明圆角、鼠标点选 | 避开 WebView2 透明背景和焦点的已知难点 |
| spec | 打包固定版本的 `@withfig/autocomplete`，通过 WebView2 的本地虚拟主机加载 | 从 CDN 在线更新 | 离线可用，结果可以复现 |
| generator | 宿主直接启动进程；模拟 `ls -1ApL`（Fig 的文件补全依赖它）；其他 POSIX 命令失败时返回空 | 改写所有依赖 POSIX 命令的 generator | `git` 等常用 CLI 可以直接使用 |
| 路径 | 相对路径和 `~`；`/` 与 `\` 都识别为分隔符；插入时用 `/`；含空格或特殊字符时用 PowerShell 单引号 | 盘符开头的绝对路径（第二阶段） | PowerShell 和大多数程序都接受 `/` |
| 按键 | Fig 默认键位：Tab、Enter、↑、↓、Shift+Tab、Esc | Ctrl+K、Ctrl+R、数字选择、历史模式 | 先保证核心操作 |
| 设置 | 固定默认值，可选一个 JSON 文件覆盖 | 设置界面 | — |
| 安装 | `install.ps1` 修改 `$PROFILE`，并让宿主开机自启 | MSI、winget、代码签名 | 发布前再做 |
| 不在范围内 | cmd、Git Bash、conhost、命令名补全、历史模式、遥测、自动更新、AI 功能 | — | — |

**退路**：

- 复用 Fig 前端失败（T-022 不通过）时，改用 inshellisense 的运行时引擎（MIT，`is:src/runtime/`），自己写一个简单的列表 UI。
- 光标定位失败（T-019 不通过）时，第一版改为在终端内显示菜单。
- 感知输入变化不达标（T-020 不通过）时，改为 C# 预测插件钩子，或者“按 Tab 才弹出”的模式。

## 3. 架构与目录

```text
Windows Terminal → pwsh 7 + PSReadLine
  └─ src/adapter/      PowerShell 模块 FigWin（适配层）
        │  命名管道，JSON 行（docs/protocol.md 第 2 节）
        ▼
  src/host/            C#/.NET 8 宿主（托盘常驻）
        · PipeServer、SessionManager、ProcessRunner（含 ls 模拟）
        · ICaretLocator（UIA 实现，另有可测试的假实现）
        · IOverlayWindow（WebView2 实现）、ForegroundTracker
        · DebugState：输出内部状态，供自动测试读取
        │  WebView2 消息，JSON（docs/protocol.md 第 3 节）
        ▼
  src/frontend/
        · vendor/aq/   复用的 Fig 前端源码（保留 LICENSE 和 NOTICE，记录改动）
        · bridge/      替换 api-bindings 的 JSON 桥，另有浏览器用的假桥
        · specs/       构建时从 @withfig/autocomplete 生成，不提交
tests/
  · engine/            vitest：用 C-xxx 用例测试引擎（任何系统都能运行）
  · adapter/           Pester：插入换算等纯函数
  · host/              dotnet test：协议、ls 模拟、进程超时
  · e2e/               Windows 端到端脚本（用 tools/wt-driver）
tools/wt-driver/       启动 WT、模拟按键、截图、读取宿主状态
```

为了方便多个 AI 接力，所有与平台相关的部分都放在接口后面，并提供假实现。这样只有光标定位、悬浮窗和 WebView2 这三处必须在 Windows 上开发，其余部分在 Mac 或 Linux 上也能开发和测试：

- `pwsh` 和 PSReadLine 可以在 Mac 上运行；
- .NET 的命名管道在 Unix 上会映射为 Unix socket；
- 前端可以在浏览器中运行。

## 4. 测试分层

| 层级 | 运行环境 | 由谁执行 | 内容 |
| --- | --- | --- | --- |
| L1 单元测试 | 任何系统 | AI 自动执行 | 引擎用例（C-xxx）、转义规则、插入换算、协议、ls 模拟 |
| L2 自动集成测试 | Windows | AI 用 `tools/wt-driver` 执行，无需人工值守 | 启动 WT，模拟按键，读取宿主的 `debugState`，检查候选列表、插入结果、悬浮窗与光标的位置差，并保存截图 |
| L3 人工验收 | Windows | 用户按清单执行，10–20 分钟 | 看效果：位置、遮挡、闪烁、输入法、多显示器；截图保存到 `local/evidence/` |

规则：每个任务结束时，它涉及的 L1 测试必须全部通过；L2 和 L3 的结果写进任务对应的报告。不允许为了让测试通过而删除或放宽用例；确实需要修改用例时，在 `specs/completion.md` 中说明原因。

## 5. 阶段与步骤

阶段之间按依赖关系排列，A 线（任何系统）和 W 线（Windows）可以并行。估算是在“AI 写代码、用户每天测试 1–2 小时”的前提下给出的日历时间。

### 阶段 0：骨架与契约（A 线，1–2 天）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-024 建立代码骨架 | ① 按第 3 节建立目录；② 宿主使用 `net8.0-windows` 并开启 `EnableWindowsTargeting`，这样 Mac 上也能编译；③ 前端用 pnpm 工作区；④ 提供 `scripts/build.ps1` 和 `scripts/build.sh`；⑤ 新建 `docs/dev.md`，写明构建和测试命令 | 在 Mac 和 Windows 上都能完成构建，空测试能运行 |
| T-025 定稿协议 | 审阅 `docs/protocol.md`，补齐字段，版本号定为 1 | 各模块的负责人（AI）都按这份文档实现；以后修改要升级版本号并写入 log |

### 阶段 1：引擎在浏览器中跑通（A 线，4–7 天）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-026 引入 Fig 前端 | ① 把 `aq` 的 autocomplete-app、autocomplete-parser、shell-parser、api-bindings-wrappers、shared、fuzzysort 复制到 `src/frontend/vendor/aq/`，带上 LICENSE，并在 NOTICE 中记录来源 commit；② 新建 `bridge` 包，导出与原 `api-bindings` 同名、但只包含实际用到的约 15 个函数（F-019），内部改发 JSON 消息；③ 写浏览器用的假桥：页面上有一个输入框模拟缓冲区，用 `wf` 的 spec，并用 Node 端服务模拟 `ls` 和 `git`；④ 把 spec 地址常量（`aq:packages/autocomplete-parser/src/loadHelpers.ts#L32-L33`）改为本地地址，构建时从 `@withfig/autocomplete` 生成 `index.json` | 在开发页面输入 `git ch`，看到 `checkout` 和 `cherry-pick`；按 Enter 后，假桥收到的插入消息正确 |
| T-027 用例自动化 | 把 `specs/completion.md` 中的 C-001 至 C-013 写成 vitest 测试：输入缓冲区和光标，断言候选列表和插入消息 | 所有能在引擎层验证的用例都通过；不能验证的用例要在测试文件中注明原因 |
| T-028 PowerShell 化补丁（包含原 T-017） | ① 转义改为 PowerShell 单引号规则，文件夹插入为 `'My Docs/{cursor}'`，让光标停在引号内；② 路径识别 `\` 和 `/`；③ 去掉对 macOS 键码 48 的依赖；④ 在 `specs/completion.md` 中新增“Windows 规则”一节和至少 5 条用例 | 新用例通过；`vendor/aq/CHANGES.md` 记录每处改动的文件和原因 |

### 阶段 2：Windows 风险验证（W 线，4–6 天，与阶段 1 并行）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-029 自动测试工具 | 编写 `tools/wt-driver`：① 用 `wt.exe` 启动指定 profile；② 用 SendInput 模拟按键；③ 截图；④ 通过管道读取宿主的 `debugState`；⑤ 用 UIA 读取终端控件的边界 | 能跑一个脚本：打开 WT，输入 `echo hi`，截图并保存 |
| T-019 光标定位 | 在 `src/host` 中实现 `ICaretLocator`，用 UIA 定位，按 `research/caret-wt.md` 处理空区间、DPI、焦点；写一个小程序，用 wt-driver 输入文本后，比较 UIA 结果与截图中的光标位置 | 达到 `docs/overlay-design.md` 中的通过标准；报告写入 `research/spike-caret.md` |
| T-021 悬浮窗 | 实现 `IOverlayWindow`：置顶、不激活、不接收鼠标，内嵌 WebView2 并显示一个静态页面；跟踪前台窗口，WT 失焦、最小化、移动时隐藏或跟随 | 达到通过标准；人工确认弹出时输入不中断；报告写入 `research/spike-overlay.md` |

### 阶段 3：适配模块与宿主核心（A 线、W 线各一部分，4–7 天）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-030 宿主核心 | 实现 `PipeServer`、`SessionManager`、`ProcessRunner`（包括 `ls -1ApL` 模拟和超时）、设置读取、`debugState` | dotnet test 通过（在 Mac 上也能运行）；`ls` 模拟的输出格式与 Fig 的期望一致 |
| T-020 适配模块 | 按 `docs/protocol.md` 实现 `src/adapter`：发送缓冲区（遇到 `KeyAvailable` 时跳过）、同步发送按键请求、执行 `Replace` 和 `SetCursorPosition`、在每个提示符处报告当前目录；宿主不在线时，50 ms 超时后自动回退到 PSReadLine 原有行为 | Pester 测试通过；在 Windows 上测量延迟、粘贴 10 KB、输入中文、调出历史；达到 T-020 的通过标准；报告写入 `research/spike-psreadline.md` |

### 阶段 4：集成（W 线，4–6 天）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-022 WebView2 承载前端 | 宿主用虚拟主机加载前端构建产物和 spec；接通 `bridge` 与宿主之间的消息；把 `setFrame` 请求换算成以光标为基准的窗口位置 | 在 WT 中输入 `git ch` 时弹出候选；从收到缓冲区到显示小于 50 ms；记录常驻内存 |
| T-031 端到端用例 | 用 wt-driver 把 C-001 至 C-013 和 Windows 规则用例写成 L2 测试，并整理一份 L3 人工清单 | L2 全部通过；用户完成 L3 清单，没有阻断性问题 |

### 阶段 5：可试用版本（W 线，3–5 天）

| 任务 | 实现步骤 | 测试与完成标准 |
| --- | --- | --- |
| T-032 安装与诊断 | 编写 `install.ps1` 和 `uninstall.ps1`：修改 `$PROFILE` 前先备份，宿主开机自启；日志写到 `%LOCALAPPDATA%`；提供 `figwin doctor` 命令检查环境；README 中写使用说明 | 在一台干净的 Windows 上安装、使用、卸载，`$PROFILE` 能恢复原样 |
| T-033 试用 | 用户日常使用一到两天，问题记录到 `tasks/board.md` 的新任务中 | 没有导致无法输入或误执行命令的问题 |

## 6. 时间估算（推断）

| 阶段 | 日历时间 | 是否需要人参与 |
| --- | --- | --- |
| 0 骨架与契约 | 1–2 天 | 否 |
| 1 引擎 | 4–7 天 | 否 |
| 2 风险验证 | 4–6 天（与阶段 1 并行） | 需要，每天 1–2 小时 |
| 3 适配与宿主 | 4–7 天 | 部分需要 |
| 4 集成 | 4–6 天 | 需要 |
| 5 试用 | 3–5 天 | 需要 |
| **合计** | **约 3.5–5 周** | |

## 7. 给接手 AI 的规则

1. 按任务板的依赖顺序认领任务，一次只做一个任务，在自己的分支 `ai/<工具>/<任务号>` 上开发；完成后由用户合并，或经用户同意后直接合并到 `main`。
2. 修改 `docs/protocol.md` 前，先在 `docs/decisions.md` 中记录原因，并升级协议版本号。
3. 修改 `vendor/aq/` 下的代码时，在 `vendor/aq/CHANGES.md` 中逐条记录改动；不要重新格式化整份文件，这样便于和上游对照。
4. 遇到阶段 2 的“不通过”时，不要自行决定退路，在 `docs/decisions.md` 中写清楚测量结果和各个选项，交给用户决定。
5. Windows 上的人工步骤（L3）要写成编号清单，用户只需逐条执行并回答“是”或“否”。
