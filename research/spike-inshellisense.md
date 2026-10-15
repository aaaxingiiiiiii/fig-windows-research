# T-035：Windows 原版 inshellisense 实测

日期：2026-10-14；负责人：Codex/GPT-6（Windows）。

状态：**进行中**。环境、诊断和受控终端冒烟检查完成；Windows Terminal 的完整人工验收尚未执行，关卡结论待定。

## 版本与边界

| 项目 | 实测 |
| --- | --- |
| Windows | Windows 11 专业版 10.0.26200，build 26200，AMD64 |
| 主显示器缩放 | 150% |
| Windows Terminal | 1.24.12741.0（已安装；尚未在其窗口内完成验收） |
| PowerShell | 7.6.5（本轮使用 Agent 提供的运行时） |
| PSReadLine | 2.4.5 |
| PredictionSource | 本轮非交互检查为 None，不代表用户日常会话配置 |
| Node.js / npm | 22.23.2 / 10.9.8 |
| Git | 2.55.0.windows.5；Git Bash 已安装 |
| .NET SDK | 未检测到 SDK；不阻塞本次阶段 A 的原版测试 |
| 原版包 | 官方 npm `@microsoft/inshellisense@0.0.4`，Windows x64 平台包 |

从 `mac/develop` 的 5020935 接手。在独立任务分支上进行验证，没有修改 vendor 源码或用户的 PowerShell 启动配置。

## 已完成的观察

1. 环境脚本原先在 ordered hashtable 中直接使用 try/catch，PowerShell 解析报错。改为 `$()` 子表达式后可正常执行；SDK 缺失现在明确报告，不再把 dotnet 错误提示当作版本号。
2. 原版包安装在 `local/tools/inshellisense-baseline/`。安装后通过官方 `bin.js` 入口调用，避免依赖本机全局 `is` 命令。
3. 首次直接运行 complete 时，因尚未解包 spec，出现 ERR_MODULE_NOT_FOUND。通过项目内启动器执行 `init pwsh` 后恢复；不是补全算法结论。
4. `--version` 返回 0.0.4；doctor 四项检查全部通过。
5. `complete 'git ch'` 返回 checkout、cherry-pick，activeToken 为 ch。该 CLI 路径在 Windows 默认使用 cmd 语义，不能独立证明 pwsh 插入正确。
6. 另外在工具提供的交互 PTY 中运行 `-s pwsh`：出现提示符，执行 `Write-Output T035_SMOKE_OK` 返回标记；输入 `git ch` 显示 checkout 和 cherry-pick；发送下方向键及 Tab 后，终端输出显示 `git cherry-pick `。随后按 Ctrl+C 取消，未执行 cherry-pick，输入 exit 后退出码为 0。

第 6 项是受控 PTY 下的观察，不能等同于 Windows Terminal 的视觉效果、输入法、双层终端兼容性或延迟验收。未测量启动耗时与输入延迟，不能给出性能通过结论。

## 人工清单进度

按 `docs/mvp-plan.md` 中 T-035 的编号继续：

| 项目 | 当前状态 |
| --- | --- |
| 1：WT 新标签启动及耗时 | 待用户在 WT 验证；仅受控 PTY 启动通过 |
| 2–3：git ch 候选及下方向键 + Tab | 受控 PTY 观察通过；WT 待确认 |
| 4–7：分支、空格路径、Esc、原按键回退 | 待测 |
| 8–10：中文输入法、多行粘贴、缩放和分屏 | 待测，需人工观察 |
| 11–14：全屏应用、运行中 Ctrl+C、快速输入、预测提示 | 待测；取消未执行输入不算中断运行程序通过 |
| 15–16：中文目录和特殊字符路径 | 待测；如原版缺陷出现，记录实际表现，不修改通过标准 |

## 下一步

在 Windows Terminal 使用 `spikes/T-035-baseline/README.md` 的启动命令，按 16 项清单逐项记录是/否和现象。完整验收前保持 T-035 为 doing。此后按交接安排执行 T-048 验证修改版；本轮未开始 T-048。

本次使用隔离的运行时用户目录；未开启开机/终端自动启动。将来验证真实用户 `$PROFILE` 时另行按授权范围备份并执行。

## 2026-10-15：同步 Mac 与 Windows 本机 L1 预检

观察（E-008）：合入 mac/develop 的 bd5a6ec 后，按 roadmap 执行锁定依赖安装、TypeScript 构建和 Jest。安装与构建退出码为 0；测试退出码为 1：274 项中 253 通过、10 跳过、11 失败；93 个快照全部通过。新增 customGenerator 的 4 项测试全部通过。此数量是 Windows 实测，不沿用 Mac 报告中的 275 项。

| 失败组 | 数量 | 观察及后续 |
| --- | --- | --- |
| figspec W-001/002/003/004/005/007/008/009 | 8 | 断言期待目录结尾 `/`，Windows 实际返回反斜杠；引号及删除数没有显示差异。需要核对跨平台语义，不应直接删除断言。 |
| posixEmulation 的 ls 链接 | 1 | 测试夹具创建符号链接时报 EPERM；没有修改系统开发者模式或提权安装。 |
| posixEmulation 的 HOME「其他平台不改」 | 1 | Windows 实际补入 HOME，与断言冲突；需隔离测试的平台前提。 |
| executeCommand 的「没有 Git Bash」 | 1 | 本机装有 Git Bash，实际执行并返回 native；测试未隔离 Git Bash 存在条件。 |

推断：这些失败主要反映测试的跨平台环境假设；尚不能据此证明交互功能正确或错误。登记 T-052 供后续修复并在 Windows 复验，本轮不修改 vendor 源码或放宽验收条件。

复现（在 `src/inshellisense/`）：`npm ci --no-audit --no-fund`、`npm run build`、`npm test -- --ci --runInBand --json --outputFile=../../local/evidence/T-035-source-tests.json`。测试会调用 unpackResources，在运行用户的 `.inshellisense/` 中准备 spec 缓存；未改 PowerShell 启动配置。原始日志含本机路径，仅留在 local/evidence。

T-035 的 16 项 Windows Terminal 人工清单仍待完成；T-048 仅完成上述预检，不视为认领或通过。继续使用 `spikes/T-035-baseline/README.md` 的原版启动入口。

## 2026-10-15：T-052 修复后复验

观察（E-009）：Windows 全量 L1 为 **265 通过、10 原有跳过、0 失败（275 项）**，93 个快照通过。构建与三个修改测试文件的 ESLint 通过。比 E-008 多一项，是把 HOME 的非 Windows 用例分别覆盖 darwin 和 linux。

本轮只改测试：PowerShell 期望使用本机目录分隔符，完整保留引号、特殊字符和删除数断言；Windows 的目录链接夹具使用不需要管理员权限的 junction，继续验证跟随链接；HOME 明确模拟非 Windows 平台；Git Bash 探测用 mock 隔离本机安装，并验证原生命令不触发回退、bash 在回退不可用时返回 127。没有跳过新失败，也没有修改运行时实现。Mac 本机尚未复验。

T-052 已完成。T-035/T-048 的 Windows Terminal 人工验收仍未完成，不能用本次 L1 成功代替。


## 2026-10-15：最新 develop 人工验收准备

观察（E-011）：已同步双方 develop 到 8fb0570，工作分支 ai/codex/T-035。锁定依赖安装、构建成功；Windows L1 346 通过、10 跳过、0 失败，93 快照通过。相比 E-009 新增 81 个通过用例；Mac 文档中的总数 357 与本机 356 不同，不能等同为失败。

材料位于 local/acceptance/T-035-20261015：七个特殊名称/中文目录；git-demo 有 main、demo-feature 分支，tracked.txt 已提交再修改、staged.txt 新增并暂存；npm-demo 含 scripts、child、demo.js、packages/a 与 packages/b workspaces。材料仅在本机，不提交。未安装系统软件或修改启动配置。

人工清单第 1 项等待用户在新 Windows Terminal 标签页启动原版并反馈提示符、报错和耗时；未收到反馈，不填通过。其余项按清单逐项进行。


### T-035 第 1 项，首次人工反馈

观察：用户在 Windows Terminal 的 Windows PowerShell 标签中启动原版，返回 `shell not found on PATH: pwsh.exe`，未进入目标 shell。截图存于 `local/evidence/T-035-item01-pwsh-not-found.png`。当前为环境阻塞，第 1 项未通过，启动耗时未测。已确认 Agent 自带 PowerShell 7.6.5 可执行文件可用，常规 Program Files 安装位置不存在；下一次仅在当前终端临时补充 PATH 后复验，不修改用户或系统 PATH。


### T-035 第 1 项复验：是

用户在当前会话临时补充 Agent 自带 pwsh 的 PATH 后反馈：提示符出现、没有报错、很快且没有感知等待。此为主观耗时描述，未计时。截图保存于 local/evidence/T-035-item01-started.png，含个人路径，不公开。第 1 项在该临时环境下通过；不代表常规用户 PATH 已配置。截图显示 git ch/git check 被执行后由 Git 报未知子命令，不能据此判定补全候选失败；第 2 项待用户仅输入 git ch、不按 Enter 后确认。


### T-035 第 2、3 项：是（用户反馈）

第 2 项：用户再次输入 git ch（不回车）后确认出现 checkout 和 cherry-pick。第 3 项：用户确认按一次下方向键再按 Tab 后，命令行为 git cherry-pick。以上依据本次对话的逐项反馈，未获取这两项的对应截图；此前命令名候选截图不作为这两项的通过证据。未要求执行 cherry-pick。第 4 项分支候选待验收。


### T-035 第 4 项：是（用户反馈）

用户确认输入 git checkout 加末尾空格、不回车后，出现仓库分支候选。依据对话反馈，未取得对应截图。第 5 项空格目录补全待验收。


### T-035 第 5 项：是（用户反馈）

用户在准备好的目录中输入 cd M 时，截图显示 git-demo、My Docs、npm-demo 候选；随后按指导补全为 cd My，选择 My Docs，Tab 接受并回车后确认成功进入。带空格目录补全与执行通过。第 6 项 Esc 关闭候选待验收。


### T-035 第 6 项：是（用户反馈）

用户确认候选可见时按 Esc 能关闭候选，随后可以正常输入。依据对话反馈，无对应截图。第 7 项候选不可见时的 Tab、上下方向键、Esc 行为待验收。


### T-035 第 7 项：是（用户反馈）

用户确认候选不可见时，Tab、上下方向键和 Esc 的行为与平时 PowerShell 一致，没有卡住。依据对话反馈，无对应截图。第 8 项中文输入法待验收。


### T-035 第 8–16 项批量反馈（2026-10-15）

| 项目 | 结果 | 现象与证据 |
| --- | --- | --- |
| 8 中文输入 | 是，用户反馈 | 用户说“可以”；截图中的历史错误无法归因于输入法，未把它当作缺陷证明 |
| 9 多行粘贴 | 是，用户反馈 | 用户说“正确”；图二可见部分编号输出 |
| 10 调整窗口/分屏 | 否 | 用户报告缩放后错误，图一候选与输入位置明显错开；缩放具体方式、分屏是否测试、Esc/清屏能否恢复待确认。登记 T-056 |
| 11 全屏程序 | 是，用户反馈 | 用户说“正确” |
| 12 Ctrl+C 中断 | 是，用户反馈 | 用户说“正确” |
| 13 快速输入 | 是，暂按上下文理解 | 用户回复“没有”，理解为没有丢字或明显延迟 |
| 14 灰色预测共存 | 是，用户反馈 | 用户说“能共存” |
| 15 中文目录 | 用户报可用，完整插入结果待补 | 图二显示中文目录候选，但没有接受后的命令和进入目录结果 |
| 16 特殊字符目录 | 用户报可用，两个目录结果待补 | 图三与图二画面相同，没有分别展示 a$b 与 it's 的接受后命令或进入结果 |

截图留存 local/evidence/T-035-item10-resize.png、T-035-item15-candidates.png、T-035-item16-candidates.png，含个人路径，不公开。用户批量反馈是观察来源；未取得精确计时或按键轨迹。关卡尚未判定通过：先确认第 10 项能否恢复，若无法恢复则按 roadmap 写入待决定事项；不自行变更路线。


### T-035 追问结果与关卡结论（2026-10-15）

用户确认：第 10 项触发方式是拖动窗口大小；取消输入并 Clear-Host 后，回复“回复”（按语境理解为恢复）。第 15 项接受补全并回车后能进入中文目录；第 16 项 a$b 与 it's 两个目录都能进入。后两项依据用户明确反馈，不以候选截图代替执行证据，未取得实际插入文本。

关卡结论：按 roadmap A1 的“没有阻断问题即通过”，T-035 通过，保留非阻断缺陷 T-056（调整窗口后错位，可清屏恢复）。不是 16 项全部无缺陷：第 10 项为失败，分屏行为没有独立确认；第 13 项“没有”按无丢字/延迟理解。原版已知路径缺陷本轮未被用户复现，不能据此删除修改版回归测试。启动使用临时 PATH 下的 Agent PowerShell，未验证永久安装配置。
