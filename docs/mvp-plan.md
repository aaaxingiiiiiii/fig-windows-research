# 实现计划：先做终端内版本，再加悬浮窗

更新：2026-10-15。对应 D-007。剩余工作的顺序、分工和各阶段的验收流程见 `docs/roadmap.md`。旧路线（PSReadLine 适配模块 + Fig 前端 + WebView2）已存档在 `docs/archive/`，其中的调研结论仍然有效。

## 1. 结论

- **第一个可用版本会快很多**：大约 1–2 周，旧路线需要 3.5–5 周。原因是 inshellisense 已经能在 PowerShell 7 上运行（F-015），我们只需要补上 Windows 上的缺口，不必从零写三个模块。
- **到悬浮窗版本的总时间大致相当**：大约 3–5 周。前提是阶段 B 在 inshellisense 的基础上**只替换显示方式**，不推倒重来。
- **风险更低**：
  - 最难的问题是“感知输入变化”。PSReadLine 没有提供这个事件（F-021），而 inshellisense 通过 PTY 读取屏幕，可以看到每次回显，包括输入法提交的中文和粘贴的内容，这个问题自然解决。
  - 悬浮窗只负责“在光标旁边画一个列表”。按键拦截、插入和补全计算都留在 inshellisense 中，所以悬浮窗宿主可以做得很简单。
- **代价**：
  1. inshellisense 的补全引擎比 Fig 少一些功能，例如 `history` 和 `help` 模板、`{cursor}`、带版本的 spec（见 `research/prior-art.md` 第 2 节）。
  2. shell 会被包装两层 ConPTY：WT → inshellisense → pwsh。可能出现兼容问题，所以第一步就要实测（T-035）。
  3. 需要 Node 运行时。发布时可以打包成单文件可执行程序，inshellisense 自己就是这样发布的。

## 2. 两个阶段

```text
阶段 A：终端内版本（约 1–2 周）
  Windows Terminal → inshellisense（我们的分支，Node）→ pwsh 7
    · 用 ConPTY 包装 pwsh，用影子终端读取命令行和光标所在的单元格
    · 补全计算：wf spec；Windows 上的 generator 不再依赖 Git Bash
    · 显示：在终端内用 ANSI 绘制（inshellisense 原有方式）
    · 按键：可见时拦截 Tab、↑、↓、Esc，插入时向 PTY 写入删除和文本

阶段 B：悬浮窗（约 2–3 周，复用阶段 A 的全部成果）
  inshellisense 分支新增“悬浮窗渲染器”：不在终端里画，而是把 {候选, 选中项, 光标单元格} 通过命名管道发给 ↓
  悬浮窗宿主（C#/.NET，只负责显示）
    · 用 UIA 定位光标的像素位置；失败时用“终端控件边界 + 单元格坐标 × 单元格尺寸”换算
    · 原生绘制一个置顶、不抢焦点、不接收鼠标的列表窗口
    · 宿主不在线或定位失败时，inshellisense 自动回到终端内绘制
```

## 3. 关键取舍

| 方面 | 选择 | 理由 |
| --- | --- | --- |
| 基础 | 把 inshellisense（MIT）复制到 `src/inshellisense/`，固定上游 commit，在 `CHANGES.md` 中记录每处改动 | 一个仓库就能完成全部工作，方便多个 AI 接力；改动清单便于以后同步上游，或把通用修复提交回上游 |
| 补全引擎 | 沿用 inshellisense 的引擎和打包的 `wf` spec | 已经在 Windows 上运行，并且能按 shell 处理引号（`is:src/runtime/utils.ts#L87-L88`） |
| generator | 在 Windows 上直接启动命令；只有确实需要 shell 时才用 pwsh；不再依赖 Git Bash（现状见 `is:src/runtime/utils.ts#L17-L24`、`#L90-L96`） | 用户不需要另外安装 Git for Windows；`git` 等命令本身照常可用 |
| 键位 | 先沿用 inshellisense 的默认键位（Tab 接受、↑↓ 选择、Esc 关闭），可以通过配置改成 Fig 风格（Enter 接受） | 不修改代码即可调整 |
| 悬浮窗的职责 | 只负责显示；按键和插入都由 inshellisense 处理 | 宿主不需要处理键盘，也不需要 WebView2，复杂度最低 |
| 悬浮窗绘制 | 原生 WinForms 或 WPF 列表 | 候选已经算好，只需要画列表 |
| 光标定位 | UIA 优先，单元格换算作为后备（`research/caret-wt.md`） | inshellisense 已经知道光标在第几行第几列，后备方案比旧路线更可靠 |
| 暂不做 | cmd、Git Bash、鼠标点选、设置界面、历史模式、代码签名 | — |

## 4. 目录

```text
src/inshellisense/     上游源码（MIT）+ CHANGES.md + UPSTREAM（记录上游 commit）
src/overlay-host/      阶段 B：C# 悬浮窗宿主
tools/wt-driver/       Windows 自动测试工具：启动 WT、模拟按键、截图、读取状态
tests/                 我们新增的测试（规格用例、Windows 规则）
docs/dev.md            构建、测试、安装命令（由 T-036 编写）
```

## 5. 测试分层

| 层级 | 运行环境 | 由谁执行 | 内容 |
| --- | --- | --- | --- |
| L1 单元测试 | 任何系统 | AI 自动执行 | inshellisense 自带的测试，以及我们新增的规格用例（`specs/completion.md`）和 Windows 规则 |
| L2 自动集成测试 | Windows | AI 用 `tools/wt-driver` 执行 | 启动 WT 和 pwsh，模拟按键，检查插入结果；阶段 B 还要检查悬浮窗与光标的位置差，并保存截图 |
| L3 人工验收 | Windows | 用户按编号清单执行，回答“是”或“否” | 看效果、输入法、多显示器等 |

规则：每个任务结束时，它涉及的 L1 测试必须全部通过。不允许为了让测试通过而删除或放宽用例；确实需要修改用例时，在 `specs/completion.md` 中说明原因。

## 6. 阶段 A：终端内版本

| 任务 | env | 实现步骤 | 测试与完成标准 |
| --- | --- | --- | --- |
| **T-035** 实测原版 inshellisense | windows, human | ① 按 `docs/windows-setup.md` 准备环境；② 用 `npm install -g @microsoft/inshellisense` 安装，或下载官方发布的程序；③ 运行 `is init pwsh` 并把输出加到 `$PROFILE` 的**最后一行**；④ 按下方“T-035 人工清单”逐条测试 | 写出 `research/spike-inshellisense.md`，内容为：各项结果、启动耗时、按键延迟的主观感受。**关卡**：没有阻断问题（例如画面错乱、输入丢失、明显卡顿），否则在 `docs/decisions.md` 中写清问题和选项，交给用户决定 |
| **T-036** 引入源码 | any | ① 把上游源码复制到 `src/inshellisense/`，保留 LICENSE，在 `UPSTREAM` 文件中记录 commit；② 跑通构建和自带的测试；③ 编写 `docs/dev.md` | 在 Mac 上 `npm test` 通过；在 Windows 上能从源码运行 `is` |
| **T-037** 去掉对 Git Bash 的依赖 | any | 修改 `src/runtime/utils.ts`：Windows 上用 cross-spawn 直接执行命令（处理 PATHEXT 和 `.cmd`），找不到命令时才退回 Git Bash。补充测试 | Mac 上的测试通过（已完成）；Windows 上的验证见 T-048 |
| **T-048** 在 Windows 上验证我们的修改 | windows, human | 从源码运行（`docs/dev.md` 第 2 节）：`node build/index.js -s pwsh -V`，然后按下方“T-048 人工清单”执行 | 清单全部通过；结果写入 `research/spike-fork-windows.md` |
| **T-049** 模拟 spec 中的 POSIX 命令 | any | 新增 `src/runtime/posixEmulation.ts`：Windows 上用 Node 模拟 `ls -1ApL`（filepaths helper）、`cat`、`grep`，以及 git、npm/yarn/pnpm/npx、cargo、make 的固定 `bash -c` 管道；管道中的原生命令照常执行。generator 上下文在 Windows 上补上 HOME | Mac 上模拟 win32 的测试通过（已完成）；Windows 上的验证见 T-048 第 4 至 6 项 |
| **T-038** 规格用例自动化 | any | 把 C-001 至 C-013 改写为针对 inshellisense 引擎的测试，并逐条标注与 Fig 行为不同的地方；新增 pwsh 规则用例，至少包括：带空格的路径、单引号、反引号、中文路径、`;` 之后的命令 | 测试通过；与 Fig 的差异记入 `specs/completion.md` 的新一节“inshellisense 与 Fig 的差异” |
| **T-039** 修复 pwsh 插入缺陷 | any | ① 路径加引号的条件改为“含空格或 PowerShell 特殊字符”，pwsh 中的单引号写成 `''`（F-029）；② 删除数按字符计算，不按显示宽度（F-030）；③ Fig 风格的差异（`specs/completion.md` 第 9 节）等用户决定后再改 | W-002 至 W-005、W-008、W-009 由 `test.failing` 改为 `test` 并通过；`npm test` 没有新增失败；改动记入 `CHANGES.md`，并标注可提交上游 |
| **T-040** 打包与安装 | windows | ① 用 inshellisense 自带的打包脚本（`is:scripts/pkg.ts`）生成 win-x64 单文件程序；②③ `install.ps1`、`uninstall.ps1` 已由 T-058 写好并在 Mac 上自测，T-040 在 Windows 上验证；④ 更新 `docs/usage.md` 第 1 节（安装、自动启动、卸载） | 在一台干净的 Windows 上能安装、使用、卸载，`$PROFILE` 能恢复原样；验收清单见 `docs/roadmap.md` 的 A3 |
| **T-041** 试用 | human | 用户日常使用一到两天，把问题登记为新任务；对照 `docs/usage.md` 第 3 节，逐条决定与 Fig 的差异是否要改（D-010） | 没有导致无法输入或误执行命令的问题；记录方式见 `docs/roadmap.md` 的 A4 |

### T-035 人工清单

每一项都回答“是”或“否”，回答“否”时附截图（存到 `local/evidence/`）。

1. 打开一个新的 WT 标签页，pwsh 能正常启动，没有报错。记录从打开标签到出现提示符的大致秒数。
2. 输入 `git ch`，候选中出现 `checkout` 和 `cherry-pick`。
3. 按 ↓ 再按 Tab，命令行变成 `git cherry-pick `。
4. 输入 `git checkout `（末尾有空格），能看到本仓库的分支列表。
5. 在一个含有 `My Docs` 文件夹的目录中输入 `cd My`，接受补全后，命令能正确进入该文件夹。
6. 候选可见时按 Esc，候选消失；之后的输入正常。
7. 候选不可见时，Tab、↑、↓、Esc 与没有安装时的行为相同。
8. 用微软拼音输入一段中文，例如 `echo 你好`，回车后输出正确，画面没有错乱。
9. 粘贴一段约 20 行的文本，内容完整，没有明显卡顿。
10. 调整窗口大小、左右分屏，候选的位置和画面都正常。
11. 运行 `vim`、`less` 或 `git log` 这类全屏程序，退出后终端正常。
12. 按 Ctrl+C 能中断正在运行的命令，例如 `ping -t localhost`。
13. 连续快速输入一行长命令，没有丢字，也没有明显延迟。
14. 开启 PSReadLine 的预测（灰色提示文字）时，补全候选和灰色提示不会互相干扰。
15. 新建文件夹 `中文目录`，输入 `cd 中` 并接受补全。命令行应为 `cd 中文目录/`，`cd` 后面的空格没有被删掉（F-030）。
16. 新建文件夹 `a$b` 和 `it's`，分别输入 `cd a`、`cd it` 并接受补全，再按 Enter，能否进入对应的文件夹？记录命令行的实际内容（F-029，预期当前会失败）。

### T-048 人工清单

在 `src/inshellisense/` 下执行 `npm ci`、`npm run build`，然后运行 `node build/index.js -s pwsh -V`，在启动的 pwsh 中逐条测试。

1. 在一个 git 仓库中输入 `git checkout `（末尾有空格），能列出分支。打开 `%USERPROFILE%\.inshellisense\log\inshellisense.log`，能看到 `generator command ran natively`，没有 `falling back to git bash`。
2. 新建文件夹 `中文目录`，输入 `cd 中` 并接受补全，命令行为 `cd 中文目录/`，`cd` 后面的空格还在（W-005）。
3. 新建文件夹 `it's`、`a$b`、`a&b`、`` a`b `` 和 `it's dir`，分别输入 `cd it`、`cd a` 并接受补全，按 Enter 后都能进入对应的文件夹（W-002 至 W-004、W-008、W-009）。
4. 输入 `npm uninstall -g `，能列出全局安装的包（至少有 `npm`）。日志中应看到 `generator command emulated in node`（bash）和 `generator command ran natively`（npm）。这条用来验证 `.cmd` 形式的命令（`npm.cmd`）可以直接执行，以及 T-049 的模拟。
5. 在 git 仓库中修改一个已提交的文件，再新建一个文件并 `git add`，然后输入 `git diff `：候选应包含这两个文件；输入 `git diff --staged `：只包含新加的文件。日志中应看到 `generator command emulated in node`，**不应**出现 `using git bash`。如果这台电脑装了 WSL，任务管理器中不应出现 WSL 进程。
6. 在含有 `package.json` 的项目的子目录中输入 `npm run `，能列出脚本名；在有 `.js` 文件的目录中输入 `node `，能列出这些文件。日志中这两项都应是 `emulated in node`。
7. 在 `src/inshellisense/` 下运行 `npm test -- --ci`，记录结果，与 `docs/dev.md` 中 Mac 上的结果对比。
8. 新建一个项目文件夹，其中 `package.json` 的内容为 `{"name":"demo","private":true,"workspaces":["packages/a","packages/b"]}`。先用 `cd` 进入该文件夹（不要在这个文件夹中启动 inshellisense），再输入 `npm run -w `，候选中应有 `packages/a` 和 `packages/b`（T-051）。

## 7. 阶段 B：悬浮窗

| 任务 | env | 实现步骤 | 测试与完成标准 |
| --- | --- | --- | --- |
| **T-042** 悬浮窗协议 | any | 新写 `docs/protocol.md`：inshellisense → 宿主，使用命名管道和 JSON 行；消息包括会话、显示或隐藏、候选列表（名称、说明、类型）、选中项、光标单元格、终端的行数和列数 | 由 T-043 和 T-044 的负责人共同遵守；修改时升级版本号 |
| **T-043** 渲染抽象（已完成，见 `docs/dev.md` 第 4 节） | any | 在 inshellisense 中把显示部分（`is:src/ui/suggestionManager.ts#L177`、`is:src/isterm/pty.ts` 中的补丁逻辑）抽象为接口：终端渲染器保持现状；新增悬浮窗渲染器，按协议发送消息；连接失败或宿主报告定位失败时，自动回到终端渲染 | L1 测试：渲染器切换和回退逻辑；用一个假的管道服务端检查发出的消息 |
| **T-029** 自动测试工具 | windows | `tools/wt-driver`：用 `wt.exe` 启动指定 profile、用 SendInput 模拟按键、截图、用 UIA 读取终端控件的边界、读取宿主状态 | 能跑通一个脚本：打开 WT，输入 `echo hi`，截图并保存 |
| **T-019** 光标定位 | windows, human | 在宿主中实现 `ICaretLocator`：UIA 优先，单元格换算作为后备（`research/caret-wt.md`） | 达到 `docs/overlay-design.md` 中 T-019 的通过标准；报告写入 `research/spike-caret.md` |
| **T-021** 悬浮窗 | windows, human | 实现置顶、不激活、不接收鼠标的原生列表窗口；跟踪前台窗口、移动、最小化、窗格切换 | 达到 T-021 的通过标准；人工确认弹出时输入不中断 |
| **T-044** 宿主集成 | windows | 协议部分已由 T-053 完成（`src/overlay-host/`，含管道服务端、会话状态、debugState）。T-044 只需在 Windows 上实现 `IOverlayPresenter`：窗格绑定、UIA 定位、原生窗口（说明见 `src/overlay-host/README.md`） | 输入 `git ch` 时悬浮窗出现在光标下方，误差不超过半个字符；从收到消息到显示小于 30 ms |
| **T-045** 端到端测试 | windows, human | 用 wt-driver 把 T-035 人工清单中可以自动化的项目写成 L2 测试，其余整理为 L3 清单 | L2 全部通过；用户完成 L3，没有阻断问题 |
| **T-046** 打包与试用 | windows, human | 把宿主加入安装脚本，设置开机自启；用户试用一到两天 | 同 T-040、T-041 |

**阶段 B 的退路**：如果 T-019 不通过，就保留终端内版本作为正式版，悬浮窗暂缓，并由用户决定是否尝试其他定位方法。

## 8. 时间估算（推断）

前提是 AI 写代码，用户每天测试 1–2 小时。

| 阶段 | 日历时间 | 什么时候能用上 |
| --- | --- | --- |
| A 终端内版本 | 1–2 周 | 阶段 A 结束时 |
| B 悬浮窗 | 2–3 周 | 阶段 B 结束时 |
| **合计** | **约 3–5 周** | 第 1–2 周就有可用版本 |

## 9. 给接手 AI 的规则

1. 开发分支是 `develop`（D-008）。每个任务在 `ai/<工具>/<任务号>` 分支上进行，从 `develop` 分出，完成后合并回 `develop`。`main` 只用于里程碑。
2. 修改 `src/inshellisense/` 时，在 `CHANGES.md` 中逐条记录改动的文件和原因；不要重新格式化整份文件。对上游也有用的修复（例如 T-037），在 log 中标注“可提交上游”。
3. 修改 `docs/protocol.md` 前，先在 `docs/decisions.md` 中记录原因，并升级版本号。
4. 遇到关卡不通过时，不要自行选择退路；在 `docs/decisions.md` 中写清测量结果和选项，交给用户决定。
5. 需要用户在 Windows 上操作的步骤，写成编号清单，用户只需逐条回答“是”或“否”。
