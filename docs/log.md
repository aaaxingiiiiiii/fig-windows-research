# 会话记录

只追加，不修改历史条目。格式见 `docs/workflow.md`。

## 2026-10-14 · ChatGPT/Codex（Windows 电脑）· 初始化（根据提交 79f8d35、b4e965e 补记）

- 做了：建立仓库骨架、Mac 交接说明和证据模板；在 Windows 上安装并验证 REA 6.4.0。
- 产出：README、AGENTS、`docs/`、`research/`、`specs/` 的模板。
- 没做完：没有取得任何 Fig 证据。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-001 至 T-006

- 做了：
  - 检查原大纲，发现它的前提已经过时：Fig 的代码已开源，本机可以运行的是 Kiro CLI 2.30.0。因此把研究方法改为读源码加黑盒观察（D-001）。
  - 识别本机目标，计算哈希；拉取三个参考仓库并固定 commit。
  - 用三个并行的只读子代理追踪补全链路、行为规则和 Windows 现状，并逐条抽查了关键引用。
  - 重建多 AI 接力流程：任务板、决策记录、编号规则、拉取源码和提交前检查的脚本。
- 产出：F-001 至 F-017，C-001 至 C-013，D-001 至 D-005，E-001 至 E-004。
- 没做完 / 问题：没有做 GUI 运行时观察，因为需要人看屏幕；F-006 的原因未知；PSReadLine 相关内容未核实。
- 下一步建议：T-016；用户决定 D-002 和 D-003。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-010/T-011/T-018、T-016

- 做了：
  - 记录用户决定：D-002 选 PowerShell 7 + WT，D-003 选 Fig 式悬浮窗，D-005 选 MIT（新增 `LICENSE`）；D-004 暂定 C#/.NET 宿主 + WebView2。
  - 统计 Fig 前端与宿主之间的接口，确认可以在 WebView2 中复用前端（F-018 至 F-020）。
  - 用两个并行子代理调研 PSReadLine 接口和 WT 中的光标定位方法，整理成 `research/psreadline.md`、`research/caret-wt.md`。
  - 写出并修订 `docs/overlay-design.md`（架构、成本、验证关卡）和 `docs/windows-setup.md`。
- 产出：F-018 至 F-024；新增任务 T-019 至 T-023；T-014 取消。
- 没做完 / 问题：所有 Windows 结论都还没有上机验证。用户已用 filter-branch 把前两次提交的作者改写为仓库本地身份，并推送。
- 下一步建议：在 Windows 上做 T-019、T-020。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-034

- 做了：
  - 应用户要求权衡“最小但效果不错”的实现方案。核对了 Fig 前端的规模（约 1 万行 TS）、依赖许可（都是 MIT），以及文件补全对 `ls -1ApL` 的依赖。
  - 确认三个衔接点：按键、插入、窗口尺寸。
  - 写出 `docs/mvp-plan.md`：取舍表、架构与目录、测试分层（L1、L2、L3）、6 个阶段的实现步骤和测试步骤、接手规则。
  - 写出 `docs/protocol.md` 草案。
  - 任务板按阶段重排；T-017 并入 T-028。
- 产出：D-006；D-004 补充改用 JSON 桥接；F-025 至 F-027；新增任务 T-024 至 T-033。
- 没做完 / 问题：协议是草案，所有 Windows 部分都还没有上机验证。
- 下一步建议：T-024，然后是 T-025。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-047

- 做了：
  - 用户要求改在 dev 分支上开发。经查，对方仓库（upstream）中的分支名是 `develop`，已经包含到 T-034 为止的提交；当前账号推送 upstream 返回 403。因此在本地建立 `develop`，并推送到 `origin/develop`。
  - 用户决定先做 inshellisense 终端内版本，再做悬浮窗。核实了 inshellisense 的几处细节：
    - 核心约 3500 行；
    - 渲染方法独立（`suggestionManager.render`）；
    - 已能按 shell 处理引号；
    - Windows 上的 generator 依赖 Git Bash；
    - npm 最新版本为 0.0.4；
    - Windows 相关的未解决 issue 只有 1 个。
  - 重写 `docs/mvp-plan.md`（阶段 A、B，包括 T-035 人工清单）；旧计划和协议移到 `docs/archive/`。
- 产出：D-007、D-008；D-003 修订，D-004、D-006 推翻；新增任务 T-035 至 T-047；取消 PSReadLine 路线的任务。
- 没做完 / 问题：upstream 的推送权限需要用户与仓库所有者确认。
- 下一步建议：T-035（Windows，人工）和 T-036（任何系统）可以并行。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· 文档修正

- 做了：
  - 把 `docs/windows-plan.md` 改写为与 D-007 一致的概要。之前它仍是旧路线的内容。
  - 复查推送权限：`origin/develop` 可以推送；`upstream/develop` 仍然返回 403。
  - 确认 `origin` 在 GitHub 上是 `upstream` 的 fork，所以可以向 `upstream/develop` 提 Pull Request。
  - 确认本机的 fnm 已有 Node 20，满足 inshellisense 对版本的要求（`>=18 <23`），可以直接开始 T-036。
- 下一步建议：T-036。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· 并行分工准备

- 做了：
  - 新增 `scripts/windows/check-env.ps1`：只读的 Windows 环境检查脚本，尚未在 Windows 上运行过。
  - 在 `docs/workflow.md` 中新增“多个 AI 同时工作”的规则。
  - 在任务板上认领 T-036，并把 T-015、T-042 预留给 Mac 上的 GPT，T-035 预留给 Windows。
  - 在 `docs/handoff.md` 中写好分工表和两段接手提示词。
- 下一步：Claude 做 T-036；GPT 在独立的 worktree 中做 T-015、T-042；Windows 端做 T-035。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-036

- 做了：
  - 用 `git archive` 把 inshellisense 上游 commit `8dcc9ca`（0.0.4）原样导入 `src/inshellisense/`，新增 `UPSTREAM` 和 `CHANGES.md`。
  - 用 Node 20.20.2（通过 fnm 临时切换）执行了 `npm ci`、`npm run build` 和 `npm test`。
  - 编写 `docs/dev.md`。
- 产出：F-028。测试结果为 202 个通过、10 个跳过、1 个失败。失败的是 `brewInstallMullvad`：本机 Homebrew 的 `brew casks` 输出为空，属于环境问题。另外发现可以用 `complete` 子命令直接输出补全结果，适合 T-038 做自动测试。
- 没做完 / 问题：还没有在 Windows 上构建；`--version` 显示占位符，打包时才会替换。
- 下一步建议：T-038（规格用例自动化，可以利用 `complete` 子命令或直接调用运行时）和 T-037。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-038

- 做了：
  - 新增 `src/inshellisense/src/tests/figspec/figspec.test.ts`，共 22 个用例：C-001 至 C-013（C-006 在引擎层无法测试）和新增的 W-001 至 W-009。
  - 用 node-pty 驱动 macOS 自带的 bash 和 zsh，实测确认中文补全会多删一个字符。
  - 把 8 个缺陷用例临时改成普通测试运行，确认它们都是因为断言不符而失败，不是因为找不到候选。
- 产出：
  - `specs/completion.md` 第 9 节（与 Fig 的差异）和第 10 节（PowerShell 规则用例）；
  - F-029（pwsh 引号缺陷）、F-030（中文删除缺陷）、F-031（7 处做法差异）；
  - T-035 人工清单新增第 15、16 项；T-039 的范围改为修复这些缺陷。
- 测试：全部 235 个，224 个通过，10 个跳过，1 个失败（仍是 Homebrew 环境问题）。
- 下一步建议：T-039（修复缺陷）；T-037（去掉 Git Bash 依赖）。Fig 风格的差异是否修改，等用户决定。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-039

- 做了：
  - 修复 inshellisense 的两处缺陷：
    - 删除的字符数改为按字符计算（F-030）；
    - PowerShell 下，路径含空格或特殊字符时加单引号，单引号写成 `''`（F-029）。
  - 把对应的 6 个规格用例改为回归测试。
  - 上游有一条测试期望“按显示宽度删除”，按实测依据改为按字符删除，并在 `CHANGES.md` 中写明。
- 测试：全部 235 个，224 个通过，10 个跳过，1 个失败（仍是 Homebrew 环境问题）；`npm run lint` 通过。
- 没做完 / 问题：
  - PowerShell 中的实际效果待 T-035 第 15、16 项验证。
  - 这两处修复对上游也有用，可以考虑向 microsoft/inshellisense 提交 PR，需要用户决定。
- 下一步建议：T-037（去掉 Git Bash 依赖）。

## 2026-10-14 · Codex/GPT-6（Mac）· T-015

- 做了：
  - 阅读交接、任务板与工作流，按预留分工在独立 worktree 的 `ai/codex/T-015` 分支完成源码评估。
  - 用 fetch-sources 脚本确认三个参考仓库的固定版本；审查 30 个常用 CLI 样本的 generator、动态 spec/别名、共享导入及子规格。
  - 从 npm registry 只读核对 autocomplete-generators 2.4.0，SHA-512 与 wf 锁文件一致；确认 filepaths helper 依赖 ls、git AI 候选依赖 fig，与引擎原生文件模板区分。
- 产出：新增 `research/spec-compat.md`（11 项可直接使用、17 项需改写、2 项不适用；每项附命令与引用）；补充 `research/sources.md` 的固定 helper 来源；仅更新任务板中 T-015 行。报告包含 T-037 适配建议和 Windows 验证清单。
- 验证：check-refs、check-public、git diff --check 通过；核对 30 行编号、表格列数与分类计数。check-public 只扫描索引，因此另对四个新增/修改文件的工作区内容执行相同路径/凭据模式及本机用户名检查。
- 没做完 / 边界：本次是源码评估，未在 Windows 运行；wf 2.692.3 与 is 所用 2.675.0 不同，实际构建需复核；样本不是基于使用率的排名。任务认领和完成状态尚未提交/推送，遵守 AGENTS.md 的用户同意要求。按并行协作规则没有重写 handoff，也未改动其他 AI 的任务。
- 下一步建议：T-037 参考报告改写共享文件访问和执行器；Codex 下一项是 T-042，先读取 mvp-plan，再从同步后的 develop 建立独立任务分支。T-015 的提交、推送及合并仍需用户同意。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-037

- 做了：
  - Windows 上的 generator 改为先用 cross-spawn 直接执行；命令找不到时才退回 Git Bash；没有 Git Bash 时返回空结果。macOS 和 Linux 上的行为不变。
  - 新增依赖 `cross-spawn`，并新增 4 个执行方式测试，其中 2 个模拟 win32。
  - 把 Windows 上的验证拆成 T-048，并写好人工清单。
- 测试：全部 239 个，228 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；`npm run lint` 通过。
- 没做完 / 问题：还没有在 Windows 上实际运行（T-048）。超时后结束 `.cmd` 命令时，只能结束 cmd.exe，它启动的子进程可能残留（推断）。
- 下一步建议：Windows 端做 T-035、T-048；Mac 端可以做 T-042（悬浮窗协议，已预留给 GPT）。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· T-037 补充与合并

- 合并 GPT 的 T-015、T-042 认领提交。两边的日志记录冲突，已全部保留。
- 根据 T-015 报告指出的风险修改执行逻辑：Windows 上的 `bash`、`sh` 总是经 Git Bash 执行，避免本机路径解析到 System32 中的 WSL 启动器。新增 1 个测试，T-048 人工清单新增第 5 项（WSL）。
- 新增 T-049：按 T-015 的建议改写依赖 POSIX 命令的 helper 和文本管道。
- 测试：全部 240 个，229 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；lint 通过。

## 2026-10-14 · Codex/GPT-6（Mac）· T-015 同步、T-042

- 做了：
  - 用户同意提交、推送并继续后，提交 T-015；同步 origin/develop 已完成的 T-036/T-038/T-039。合并日志时保留双方全部记录，没有改动其他 AI 的实现。
  - T-015 已推送到任务分支和 origin/develop；从同步后的 develop 建立 `ai/codex/T-042`，先提交并推送自己的认领行。
  - 新增共享契约 `docs/protocol.md` v1，先在 decisions.md 记录 D-009；本会话已向用户说明宿主职责、回退与验证时机。协议规定帧大小、角色、会话/连接/序号、候选分页、单元格坐标、状态回执、租期、重连、debugState 和 P-01 至 P-12 验收用例。
- 产出：`docs/protocol.md`、D-009；任务板 T-042 done。没有新增代理个人配置或辅助计划文件；protocol 是任务指定的项目契约。
- 验证：6 条 JSONL 示例的解析、UUID、双向序号、候选/坐标范围及逐字节 UTF-8 拆包检查通过；check-refs 与 check-public 通过。本次差异的 git diff --check 通过；同步 develop 时检测到原样导入的上游文件含既有尾随空白，未扩大范围修改。
- 边界：T-042 仅完成契约，不代表管道或悬浮窗已实现；Windows 窗格绑定、定位、UI 挂起后的残留仍需 T-019/T-044/T-045 实测。协议的时间预算是设计值。按并行分工没有重写 handoff。
- 用户验证入口：现在可在 Windows 按 docs/dev.md 从源码构建，运行 `node build/index.js -s pwsh` 做终端版试用，用 exit 退出；按 mvp-plan 的 T-035 清单记录结果，并区分原版与本项目修复版。T-037 后验证无 Git Bash，T-040 后验证安装卸载，T-043/T-044 后验证悬浮效果。
- 下一步建议：T-043 按 v1 抽象渲染并写假服务端 L1；Windows 端继续 T-035、T-019/T-021；本轮共享协议交付后，双方后续改格式或语义须共同升级版本。
- 合并补充：交付前再次同步，已保留 Claude 新完成的 T-037 和整合者 handoff；用户现在可直接执行新增的 T-048 人工清单验证本项目修改，POSIX helper 的进一步改写另列 T-049。

## 2026-10-14 · Claude Code/Opus 5.5（Mac）· 用户决定、T-050 准备、T-049

- 用户决定：
  - 向 microsoft/inshellisense 提交修复（D-011）。
  - 与 Fig 的差异暂时保留，并在使用说明中注明（D-010）。
  - 继续 T-049。
  - GPT 完成 T-042 后，接手 T-043。
- 新增 `docs/usage.md`（使用说明）。第 3 节列出与 Fig 的 7 处不同；README 和 mvp-plan 的 T-040、T-041 行指向它。
- T-050：上游 main 仍是 8dcc9ca，与本仓库固定的版本相同。在本机临时目录中，从上游 main 建了两个分支：
  - `fix/pwsh-path-quoting`：新增 26 个 escapePath 测试，修复前其中 18 个失败；
  - `fix/wide-char-backspace`：加了一个混合宽度的用例。
  - 两个分支上，上游的构建、lint 和 runtime 测试都通过（`brewInstallMullvad` 在本机 Homebrew 环境下本来就失败）。PR 说明已用英文写好。
  - 阻塞：用户的 GitHub 账号下还没有 inshellisense 的 fork，本机也没有 `gh`；CLA 需要用户本人签署。
- T-049：新增 `src/runtime/posixEmulation.ts`，在 Windows 上用 Node 模拟：
  - `ls -1ApL`（filepaths helper，约 70 个 spec 共用）、`cat`、`grep`；
  - 9 条固定的 `bash -c` 脚本：git 的 sed、向上查找 package.json 等、node_modules/.bin、`npm root -g`、cargo、make。
  - generator 上下文在 Windows 上补上 HOME。
  - 新增 31 个测试，包括脚本出处检查，以及模拟 win32 时经真实 spec 得到候选。关掉模拟后，3 个集成测试都失败。
- 修正 T-048 清单：原来的第 5 项用 `git restore --staged`，但这个命令并不经过 bash（它用的是直接执行的 `git status`），改为 `git diff`；原来的第 4 项 `npm run ` 实际走的是 bash 脚本，改为 `npm uninstall -g `，用来验证 `npm.cmd`。日志路径改为 `%USERPROFILE%\.inshellisense\log\`。
- 新发现 F-032：custom generator 的默认目录和输出清理与 Fig 不同，登记为 T-051。
- 测试：`npm test -- --ci` 共 271 个，260 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；lint 通过。不加 `--ci` 时，jest 会为失败的 brew 测试写入快照，已在 dev.md 中说明。
- 下一步：用户 Fork 后推送 T-050 的两个分支；Windows 端做 T-035、T-048；GPT 做 T-043；Mac 端可以做 T-051。

## 2026-10-14 · Codex/GPT-6（Windows）· T-035 环境与初步验证

- 从 Mac fork 的 develop（5020935）接手，按工作流认领 T-035，在独立任务分支工作。共享 develop 已同步 Mac 成果和认领记录。
- 修复 check-env.ps1 的 try/catch 解析错误和缺失 SDK 的显示；版本结果见 research/spike-inshellisense.md。
- 经用户同意在项目 local/ 安装官方原版 0.0.4，使用项目内隔离缓存；未修改 PowerShell 启动配置。
- doctor、git ch CLI 补全及受控 PTY 的启动/输入/候选/Tab 插入/退出通过。记录 E-005、E-006；不将这些结果冒充 Windows Terminal 人工验收。
- T-035 保持 doing，等待用户完成 16 项 WT 清单；T-048 未开始。按并行协作规则未重写 docs/handoff.md。
## 2026-10-15 · Claude Code/Opus 5.5（Mac）· 后续工作与验收流程

- 同步对方仓库的 develop（Windows 端认领 T-035 的提交 35db2c0），查看 Windows 端分支 `ai/codex/T-035` 的进展：环境检查和受控终端冒烟测试已完成，16 项人工清单等待用户。
- 应用户要求新增 `docs/roadmap.md`，内容包括：剩余工作的路线图、各端分工、仓库权限解决前两端同步代码的方法、验收通用规则和报告文件、阶段 A 与阶段 B 每一步的验收步骤（T-040、T-041、T-021、T-044 的清单为新写）、发现问题时的流转，以及接下来的顺序。AGENTS.md、README、mvp-plan、handoff 中加入指向它的说明。
- 从 Mac 推送对方仓库仍然返回 403，用户稍后处理。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-051

- 传给 custom generator 的 executeShellCommand 加了一层包装：
  - 没有给出 cwd 时，使用 generator 的目录。这与 script generator 相同；输入的是路径时，用解析后的目录。
  - 输出按 Fig 的 cleanOutput 清理。依据见 F-032：Fig 的 figterm 和 executeCommand。
- 新增 4 个测试。去掉修复后，其中 3 个失败；另一个检查显式给出的目录不会被覆盖，修复前后都通过。其中 npm workspaces 候选的测试走真实的 spec 和真实的 npm。
- T-048 清单新增第 8 项（`npm run -w `，要在 cd 之后的目录中测试）；roadmap、handoff、usage、spec-compat、dev.md 同步更新。
- 测试：`npm test -- --ci` 共 275 个，264 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；lint 通过。
- 这项修复与平台无关，CHANGES.md 中标注为“可提交上游”。是否作为第三个 PR 加入 T-050，由用户决定。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-013

- 先读开源代码：1.19.7 的 `shell_init` 在 post 阶段不判断是否运行在 figterm 中，总是输出完整的 `post.zsh`。
- 再做黑盒对照（E-007）：Kiro 的 `init <shell> post` 只有在 `Q_TERM` 已设置时才输出完整的集成脚本，否则只设置 PATH。是否有 TTY、是否设置了 `QTERM_SESSION_ID`，都不影响输出；pre 不受影响。完整脚本与开源版只有三处小差异，其中一处是别名改为经标准输入传递。F-006 由“未知”改为“观察”。
- 发现本机的 Kiro 已自动更新为 2.31.0。已在 target.md 中注明：E-001 的哈希只对应 2.30.0，之后的观察要写明实际版本。
- 没有反编译，也没有读取二进制文件的内容，只运行了命令并比较输出。

## 2026-10-15 · Codex/GPT-6（Windows）· T-035
- 同步 mac/develop bd5a6ec，保留两端追加记录，修复 evidence 表格空行。
- 按 roadmap 安装锁定项目依赖并构建成功；Windows L1：253 通过、10 跳过、11 失败，93 快照通过；新增 T-051 的 4 项通过。
- 产出：E-008、research/spike-inshellisense.md 预检结果、T-052（跨平台测试环境假设）。原始日志仅在 local/evidence；未修改 vendor 实现、系统设置或 PowerShell 启动配置。
- T-035 保持 doing，真实 Windows Terminal 的人工清单待用户操作；T-048 尚未通过，不进入 T-040。docs/handoff.md 保留 Mac 整合者版本。

## 2026-10-15 · Codex/GPT-6（Windows）· T-052
- 已 fetch origin 与 mac 的全部分支；两端 develop 没有新的实现提交。将此前 Windows 报告同步到 develop 后认领 T-052。
- 修复 11 个 Windows 测试环境假设失败，不改 runtime、不安装软件、不改系统或启动配置。
- 观察：全量 L1 265 通过、10 跳过、0 失败；93 快照通过；构建和修改文件 ESLint 通过，见 E-009。
- T-052 完成，T-035/T-048 人工验收保持未完成；下一步由用户在 WT 按清单测试。handoff 保留整合者版本。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· 整合、T-050、T-012 准备、认领 T-043

- 对方仓库授权后，Mac 端已经可以推送。合并 Windows 端的 T-035 进展和 T-052，并在 Mac 上复验：共 276 个，265 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；lint 通过。
- 整理 evidence 表中 E-008、E-009 错位的列；更新 D-008：所有端都推送到对方仓库，roadmap 的同步说明随之改写。
- T-050：用户已 Fork 上游，并同意追加 T-051 作为第三个 PR（D-011）。
  - 在上游 main（8dcc9ca）上建了分支 `fix/custom-generator-cwd`，在上游的 `generator.test.ts` 中新增 3 个测试。去掉修复后，其中 2 个失败；lint 通过。
  - 三个分支已推送到用户的 fork。预填好标题和说明的 PR 链接保存在 Mac 的 `local/upstream-pr/links.txt`，由用户确认创建并签署 CLA。
- T-012：在 `specs/completion.md` 第 8 节新增给用户的 13 项人工清单，“Kiro 观察”一栏改为注明版本；在 Mac 的 `local/t012/` 中准备了 `My Docs`、`a&b` 两个文件夹和一个 git 仓库。
- 按用户要求，T-043 由 GPT 改派给 Claude，已认领。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-043

- 用户把 T-043 从 GPT 改派给 Claude。实现了悬浮窗协议 v1 的客户端和悬浮窗渲染器（`src/inshellisense/src/overlay/`），上游文件 `suggestionManager.ts`、`suggestionRenderer.ts`、`ui-root.ts` 各有少量改动，已记入 CHANGES.md。没有设置 `FIGWIN_OVERLAY_PIPE` 时，原有的 276 个测试结果不变。
- 按键规则：
  - 宿主确认当前列表后，才拦截候选按键；
  - 选中项变化后、宿主确认之前，接受键被吞掉，不插入；
  - 只有参数说明时不拦截。
  - 这些规则符合 `docs/protocol.md` 第 6 节，没有修改协议。
- 测试：新增 81 个（`src/tests/overlay/`）。
  - 覆盖 P-01、P-02、P-04、P-06 至 P-09、P-11、P-12 在客户端一侧的部分；
  - 包括一次真实套接字的往返，以及真实 SuggestionManager 加客户端的集成用例；
  - 两次变异检查（放宽接受条件、接受旧 show 的确认）都被测试发现。
  - 全部测试共 357 个，346 个通过，10 个跳过，1 个失败（Homebrew 环境问题）；lint 和构建通过。
- 端到端：新增假宿主 `spikes/T-043-fake-host/`。用 node-pty 驱动真实的 inshellisense（`-s zsh`），检查了四种情况：
  - 宿主正常：终端里不画候选框，宿主收到 show，↓ 加 Tab 插入 cherry-pick；
  - 宿主不回复、宿主报告失败、宿主不存在：候选回到终端里，插入正常。
- 观察到的副作用：宿主一直不确认或一直报告失败时，每次重连后约 100 ms 内，候选交给了宿主，按键直接进入 shell。已写入 dev.md，提醒 T-044 的宿主必须及时回复。
- 没有在 Windows 上运行；命名管道和 C# 宿主由 T-044 验证。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-012 记录、取消 T-050、工作包

- T-012：用户在 Kiro 2.31.1 中完成 13 项，把回答写在了清单旁，截图放在了 `specs/` 中。截图含用户名、主机名和路径，已移到 `local/evidence/T-012/`（E-010），清单恢复原样。结果填入用例表，并整理为 F-033：
  - 9 项一致；
  - C-006 不一致：光标在单词中间时 Kiro 仍然显示窗口；
  - C-003、C-008、C-012 待重测。C-008 测试时不在 `local/t012` 目录中。
  - 勘误：C-002 的源码预期原先算错了公共前缀，应为 `che`。
  - `docs/usage.md` 第 3 节的“Fig 的做法”一栏按实测修正。
- T-050 取消：
  - 用户说没有看到链接，整理者在浏览器中打开了三个预填好的 PR 页面，用户随即点击创建（microsoft/inshellisense #486–#488）。
  - 约 2 分钟后，用户要求取消。整理者删除了 fork 上的三个分支，PR 自动关闭，没有签署 CLA。
  - D-011 改为“已撤销”；之后不要向上游提交任何内容，除非用户另行决定。
  - 教训：这类对外操作在执行前，要用用户能看懂的话说明会发给谁、是什么内容；不要替用户打开浏览器。
- `docs/roadmap.md` 新增第 8 节“交给各端 AI 的工作包”。任务板新增：
  - T-053：宿主协议核心，需要在 Mac 上安装 .NET 8 SDK；
  - T-054：独立审查 T-043；
  - T-055：spec 兼容性余项。


## 2026-10-15 · Codex/GPT-6（Windows）· T-035 人工验收准备
- 同步 origin/mac 的 develop（8fb0570），在 ai/codex/T-035 继续；阅读最新 roadmap 第 3–6 节和 8.1 节。
- 安装锁定项目依赖、构建及 L1 完成：346 通过、10 跳过、0 失败，E-011。人工测试目录、git 和 npm/workspaces 材料已备齐。
- T-035 保持 doing，第 1 项待用户在 WT 操作反馈；T-048 尚未开始。未安装 SDK，未改 handoff.md。


## 2026-10-15 · Codex/GPT-6（Windows）· T-035 第 1 项反馈
- 用户截图确认普通 WT 会话找不到 pwsh.exe；保存本机截图，记录环境阻塞。
- Agent 自带 pwsh 7.6.5 可用；给出当前会话临时 PATH 方案，待用户复验，不安装软件、不修改持久配置。

- T-035 第 1 项复验通过：用户确认启动无报错、体感无明显等待（未计时）；截图已存 local/evidence。第 2 项候选检查待反馈。

- T-035 第 2、3 项用户反馈通过：git ch 显示两个目标候选，下方向键和 Tab 插入 cherry-pick；第 4 项待验收。

- T-035 第 4 项用户反馈通过：git checkout 后出现分支候选；第 5 项待验收。

- T-035 第 5 项用户反馈通过：My Docs 补全后能成功进入；第 6 项待验收。

- T-035 第 6 项用户反馈通过：Esc 关闭候选，后续输入正常；第 7 项待验收。

- T-035 第 7 项用户反馈通过：候选不可见时按键行为一致、无卡顿；第 8 项待验收。

- 收到 T-035 第 8–16 项批量反馈；8/9/11/12/14 用户报通过，13 暂按无丢字/延迟理解。第 10 项缩放错位登记 T-056，待确认恢复性；15/16 用户报可用但截图未显示接受后结果，待补充。三个截图已保存 local/evidence，关卡未标完成。

- T-035 追问：拖动窗口触发错位，取消并清屏后可恢复；中文、a$b、it's 目录均确认能进入。按无阻断问题标准关卡通过，保留 T-056，第 10 项未改成通过；准备进入 T-048。
## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-012 重测、D-012

- 用户重测了 C-003、C-008、C-012，截图移到 `local/evidence/T-012/`。三项都与开源基线一致：
  - C-003：`checkout` 的参数是可选的，所以不加空格；
  - C-008：`My\ Docs/`、`'a&b'/`；
  - C-012：文字回答与截图不一致，按截图记录。
- T-012 完成：12 项一致，只有 C-006 不一致（F-033）。
- D-012：宿主和 wt-driver 改用 .NET 10。.NET 8 的支持在 2026-11-10 结束。在 Windows 端开工前已推送。用户同意在 Mac 上安装 .NET SDK，T-053 由 Claude 认领。

## 2026-10-15 · Codex/GPT-6（Mac）· T-054

- 做了：同步 `upstream/develop`，在 `ai/codex/T-054` 独立对照协议第 2–7 节审查 T-043；第 8 节 debugState 及服务端窗格/定位/权限仍由 T-053/T-044 验证。没有修改协议或 handoff。
- 观察（失败测试 → 修复）：以下 10 类问题各有失败用例；新增 14 个测试，并扩展原有 manager/client 集成测试。证据为 `src/inshellisense/src/tests/overlay/` 中名称以 `T-054` 开头的测试及“集成”用例，可运行 `npm test -- --ci --runInBand src/tests/overlay` 复验。

| 协议条款 | 观察到的问题 | 修复及测试文件 |
| --- | --- | --- |
| 第 4 节 | welcome 接受非 200/600 的时间常量 | 严格匹配 v1，`protocol.test.ts`（2 个） |
| 第 2、6 节 | 数组 state 被对象键隐式转换后误接受 | 检查 string 及自有枚举键，`protocol.test.ts`（1 个） |
| 第 5 节 | 未知候选类型 constructor / __proto__ 命中原型属性 | 仅映射自有键，其余 other，`snapshot.test.ts`（2 个） |
| 第 5 节、P-06 | 页长超过 20 时截掉真实选中项，宿主显示第 19 项而 Node 接受后面的项 | 选取包含真实选中项的子页，更新 pageStart 和页内索引，`snapshot.test.ts`（1 个） |
| 第 7 节、P-08 | 600 ms 租期等到下一心跳轮询才关闭，最晚约 800 ms | 每条有效消息重设独立租期定时器，`client.test.ts`（1 个，包含非心跳边界消息） |
| 第 6 节、P-12 | 新 show/hide 尚在背压队列时，旧 shown 仍确认旧目标 | 入队即撤销旧确认目标，`client.test.ts`（2 个） |
| 第 6 节、P-06 | 选择 A→B→A 时复用首次 A 的 shown | 每次发送 show 都撤销接受权限，保留同列表选择权限，`overlayRenderer.test.ts`（1 个） |
| 第 6 节、P-09 | alternate-buffer 隐藏等待异步终端清理完成 | 先 hide 再 await 清理，`overlayRenderer.test.ts`（1 个） |
| 第 6 节 | 命令/cwd 改变后旧候选可能重新发出并被确认，回退也可能重画旧候选 | manager 绑定生成上下文；显示、接受和异步提交前复核，`overlayRenderer.test.ts`（2 个） |
| 第 6 节、P-09 | 接受后至 PTY 回显前仍可再次插入同一候选 | 立即消耗快照并同步渲染，`overlayRenderer.test.ts`（1 个及集成测试） |

- 验证：Node 20.20.2；完整 `npm test -- --ci --runInBand` 共 371 个：360 通过、10 跳过、1 失败。唯一失败为已记录的 `brewInstallMullvad` 本机 Homebrew 环境问题（`docs/dev.md`）；95 个悬浮窗用例全部通过，93 个快照通过。`npm run build` 通过。`npm run lint`、`sh scripts/check-public.sh` 通过。
- 未知：Mac 假宿主和本机套接字测试不能证明 Windows 命名管道、UIA、WT 焦点和真实键盘效果；这些仍按原任务 T-019/T-021/T-044/T-045 验收。本轮没有遗留未修复的已复现问题。
- 下一步：T-055；本轮不启动 T-053；合并时读到远端 D-012 已改用 .NET 10，T-053 已由 Claude 认领。

## 2026-10-15 · Codex/GPT-6（Mac）· T-055

- 做了：从同步后的 develop 建立 `ai/codex/T-055`，认领状态推送 upstream；完成 gh、scp、dotnet 三项兼容性工作，更新 `research/spec-compat.md` 和 `src/inshellisense/CHANGES.md`，没有重写 handoff。
- 观察（证据：`src/inshellisense/src/tests/figspec/windowsSpecCompat.test.ts`）：初次运行 15 个测试，gh 实际包 generator 的外层查询引号和 4 种 scp 远端操作数的本地枚举共 5 个失败。修复后加上嵌入引号/参数不变性用例，共 16 个全部通过。
- 修复：新增 `src/runtime/windowsSpecCompat.ts`，只在 Windows 原生执行 gh GraphQL raw-field 查询时剥除外层 shell 单引号，保留变量、内部引号和 argv 边界；scp generator 对当前远端操作数不执行本地目录补全，保留盘符（包括盘符相对形式）、UNC、本地相对路径及远端源后的下一个本地操作数。Git Bash 回退和非 Windows 执行不改动。
- 观察：dotnet 相对文件读取已由 T-049 满足；真实 spec 在两个不同 shell cwd（中文/空格路径）读取各自 CRLF launchSettings，缺文件保留静态候选，测试无原生进程调用，因此本轮只加验证，不重复改写。未扩展 `--project` 目标项目解析。
- 验证：Node 20.20.2；全量测试共 387 个：376 通过、10 跳过、1 个既有 `brewInstallMullvad` 环境失败；93 个快照通过。`npm run build`、`npm run lint`、`sh scripts/check-public.sh`、`python3 scripts/check-refs.py`（231 条，0 问题）通过。
- 未知：模拟 win32 验证的是分流、参数和受控文件读取，不代替 Windows 原生路径、gh 登录/网络、scp 可执行程序和 PowerShell 交互验收。未安装 SDK 或其他软件；未开始 T-053（远端已由 Claude 认领）。
- 下一步建议：Windows 端结合 T-048 验证上述改动；阶段 B 接续 T-053/T-044。本轮两个任务均完成并按任务分支合并、推送 upstream。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-053

- 经用户同意，用官方的 `dotnet-install.sh` 把 .NET 10 SDK（10.0.402）安装到 `~/.dotnet`，没有修改系统目录。
- 新增 `src/overlay-host/`，包含三个项目：
  - `FigWin.OverlayHost.Core`：与平台无关的宿主协议核心；
  - `FigWin.OverlayHost.Core.Tests`：70 个 xunit 测试；
  - `FigWin.OverlayHost.DevHost`：开发用宿主，不画窗口。
- 平台接口 `IOverlayPresenter` 的设计：`LocateAsync` 可以较慢、可取消；`ApplyAsync` 在实际显示后完成；`Hide` 不得同步等待 UI 线程，以免 UI 线程调用 `Suppress` 时死锁。核心负责顺序与竞态（P-03）。
- 测试：
  - 70 个全部通过，覆盖 P-01 至 P-04、P-08、P-11、P-12 在宿主一侧的部分，以及管道往返；
  - 两次变异检查（去掉定位后的过期检查、去掉续租）都被测试发现。
- 互通：用 node-pty 驱动真实的 inshellisense（T-043 客户端）连接开发用宿主。
  - 正常情况：宿主收到候选和选中项，终端里不画候选框，Tab 正常插入；
  - 定位延迟 300 ms 和定位失败：客户端都回到终端内绘制，插入正常。
- 登记了测试用 NuGet 包的许可证（`research/sources.md`）。T-044 改为依赖 T-053，只需在 Windows 上实现 `IOverlayPresenter`。


## 2026-10-15 · Codex/GPT-6（Windows）· T-048
- T-035 关卡结果合并 develop 后认领 T-048，在独立任务分支继续。
- 最新修改版构建成功；L1 376 通过、10 跳过、0 失败，93 快照通过。人工清单待用户执行；handoff 未重写。

- T-048 用户反馈：1 分支候选出现（原生命令日志待核实）、2 中文目录通过、3 五种特殊字符目录通过；T-056 在修改版仍复现。

- T-048 版本核实更正：当前实际运行官方 baseline 进程，未发现修改版 build/index.js。撤回此前人工 1–3 项与错位的修改版归属，待明确启动后重测；截图已保存。第 8 项还缺末尾空格，第 6 项 npm run 为执行输出，不算候选证据。
## 2026-10-15 · Claude Code/Opus 5.5（Mac）· 整合 T-035 结果

- 合并 Windows 端的 T-035：按 A1 判定关卡通过；第 10 项拖动窗口后候选错位，清屏可以恢复，登记为 T-056；T-048 已认领，尚无结果。
- 发现：用户自己的 WT 中找不到 `pwsh.exe`，T-035 用的是 Windows 端 AI 工具自带的 PowerShell 7.6.5（临时修改 PATH）。之前环境检查中的“PowerShell 7.6.5”也来自 AI 工具自带的版本。新增 T-057（安装 PowerShell 7 并设为 WT 默认，需要用户决定），T-040 改为依赖它；windows-setup.md 注明环境检查必须在用户自己的终端中运行。
- 更新 roadmap 第 7 节：T-057 → T-048（在最新 develop 上，含 T-054、T-055）→ 复现 T-056 → T-040；阶段 B 的准备照常。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· Windows 端工作指令

- 应用户要求，把交给 Windows 端 AI 的话写成文件 `docs/windows-next.md`，使用户只需说“同步 develop，读 docs/windows-next.md，按顺序做”。内容按顺序包括：
  - T-057：先问用户是否安装 PowerShell 7；
  - T-048：在最新 develop 上做 8 项，日志由 AI 自己读；
  - T-056：复现 5 种窗口变化，记录恢复方法和日志；
  - T-040；
  - 用户不在时做阶段 B 的准备；
  - 结束时的流程，以及遇到问题时的处理。
- AGENTS.md、handoff、roadmap 第 8.1 节和 README 都指向这个文件；该文件由整合者维护，其他 AI 不修改。


## 2026-10-15 · Codex/GPT-6（Windows）· 同步 Claude 工作流
- 同步双方 develop 0374081，保留两端日志和 T-056 分工，并保留版本归属更正。
- 已读 windows-next.md：从 T-057 开始。确认 winget 可用，常规 PowerShell 7 安装路径仍不存在；安装与 WT 默认设置待用户明确同意，未执行安装或修改配置。


## 2026-10-15 · Codex/GPT-6（Windows）· T-057
- 用户明确同意安装 PowerShell 7 并设为 WT 默认；winget 安装 7.6.7 成功，正式二进制验证和环境脚本执行完成。
- 待用户在 WT 设置界面选择默认配置并重新打开验证；不直接编辑 settings.json，不修改启动脚本；任务保持 doing。
## 2026-10-15 · Claude Code/Opus 5.5（Mac）· D-013、指令文件第 2 版

- 用户外出，授权需要确认的事项按整合者的推荐方案处理，记为 D-013。范围是：在 Windows 上安装 PowerShell 7 并设为 WT 默认；安装 .NET 10 SDK；在 Mac 上把 PowerShell 安装到用户目录，用于测试安装脚本。修改 `$PROFILE`、删除数据、对外提交、改变路线都不在授权范围内。
- 合并 Windows 端的 T-048 提交：上次实际运行的是原版，修改版的结果已作废。`docs/windows-next.md` 更新为第 2 版：
  - T-057 不必再问用户；
  - T-048 开始前先用 `--version` 确认是修改版（应显示 `__VERSION__`），并检查日志位置。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-058

- 按 D-013，把 PowerShell 7.6.7 安装到 `~/.powershell`。安装包从 GitHub 官方发布页下载，SHA-256 与发布页的 hashes.sha256 一致。
- 新增 `scripts/windows/install.ps1`、`uninstall.ps1`、`profile-file.ps1`、`test-install.ps1`：
  - 安装：把程序复制为 `is.exe`；在用户 PATH 的最前面加入安装目录；运行 `is init pwsh`；备份 `$PROFILE` 后，在最后追加标记注释和初始化语句；重复安装只更新程序。
  - 卸载：配置文件在安装后没有改过时，逐字节恢复；安装前没有这个文件时删除它；改过时只删除安装时加入的两行，并提示。卸载时还会从 PATH 中删除安装目录，删除安装时新建的数据目录，最后删除安装目录。
  - 保留原来的编码：UTF-8（带或不带 BOM）、UTF-16，以及本地代码页。
- 自测：26 项检查在 Mac 上全部通过，覆盖没有配置文件、UTF-8 BOM 加 CRLF 加中文、UTF-16 LE、安装后又被修改、重复安装五种情况。变异检查（去掉逐字节恢复）有 2 项失败，说明自测有效。
- 本地代码页的配置文件、真实 PATH 的修改，以及打包后的程序，需要在 Windows 上由 T-040 验证。`docs/windows-next.md` 第 4 步已相应更新。
- 补充：T-058 提交时，`check-public` 标出了自测脚本中一个虚构的示例路径，它形如 Windows 用户目录。这不是真实的用户名或路径，但已改为 `D:\示例目录\...`，让检查保持干净。当时的检查结果被管道（`| tail`）吞掉了退出码，提交照常执行了；以后单独运行检查并判断退出码。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-056 分析（第一步）

- 新增 `spikes/T-056-resize-sim/resize-sim.cjs`：用 xterm-headless 模拟外层终端，并回复光标位置查询；内层用 node-pty 运行修改版和指定的 shell；改变 4 次窗口大小后，检查候选框是否紧贴光标。
- Mac 上 4 组全部对齐：zsh、pwsh 7.6.7，以及各自加会折行的长内容。记为 F-034（推断）：问题与 Windows 有关，可能是 ConPTY 的重绘，也可能是 WT 的折行方式。
- 调试中的两个发现：模拟的外层终端必须回复光标位置查询，否则 PSReadLine 会一直等待；Mac 上偶尔有一次 inshellisense 中途退出，没能复现，已写进 README。
- `docs/windows-next.md` 第 3 步改为先在 Windows 上运行这个模拟器，不需要用户在场；能复现就交给 Mac 修复，不能复现再请用户手动复现。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· T-040 准备

- 在 Mac 上运行 `npm run package`：打包流程能处理我们的改动，生成了 macOS 版的单文件程序，约 125 MB。用临时用户目录运行它，`--version`、`init zsh`、`complete "git ch"` 都正常。
- 原来打包后的版本号与原版相同（都是 0.0.4）。按 D-013 的推荐方案改为 `0.0.4-figwin.1`，记入 CHANGES.md；`install.ps1` 会检查版本号中是否包含 figwin，不包含时给出警告；自测脚本的假程序会相应回答 `--version`。
- 改版本号之后，全部测试中有一次多了 1–2 个失败，但没有出现在逐条结果中；之后连续 3 次都只剩 `brewInstallMullvad`。判断为偶发，原因没有查明。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· C-006 核对

- 回到源码核对 T-012 中唯一不一致的 C-006：规则读得没错，光标下面的字符不是空白时隐藏。Kiro 实测仍然显示，原因未知，两种推断（Kiro 改了规则；方向键造成的光标移动没有及时上报）已写入 specs 第 8 节和 F-033。需要更细的观察才能区分，优先级低，暂不安排。

## 2026-10-15 · Claude Code/Opus 5.5（Mac）· 回归检查与交接

- T-054 修改了悬浮窗客户端。合并后重跑 T-043 的假宿主端到端检查（正常、不回复、报告失败、不存在），结果与之前一致。
- 重写 handoff：汇总用户外出期间按 D-013 处理的事项，以及各端的下一步。

- T-057：依用户明确授权及新版 windows-next，备份 WT 设置并将 defaultProfile 指向已有 PowerShell 7 动态配置，读取验证一致；未改启动脚本。实际新默认标签待用户回来确认。

- T-048 无人值守：新增可复现引擎检查，13 项通过，正式 pwsh 执行中文/特殊路径验证成功；npm 全局包以实际列表核对，清单假定 npm 包存在与本机不符。人工关卡仍待确认。


## 2026-10-15 · Codex/GPT-6（Windows）· T-056
- 正式 pwsh 7.6.7 + Windows ConPTY 运行 Claude 的 resize-sim：普通组通过，wrap 连续两次失败，均在尺寸恢复后再输入 e 时 aligned=false，光标行混入 line4。
- E-012 和 research/spike-fork-windows.md 有完整尺寸/光标表与复现命令；原始日志保留 local/evidence。T-056 已复现，待 Mac Claude 分析，未擅自改动运行时或判定修复。


## 2026-10-15 · Codex/GPT-6（Windows）· T-058 Windows 复验
- 使用已安装的 PowerShell 7.6.7 执行 scripts/windows/test-install.ps1，退出码 0，26 项全部通过。包含不存在 profile、UTF-8 BOM/CRLF/中文、UTF-16LE、安装后用户追加内容四组。
- 自测在临时目录中使用假的 is，未修改真实用户 profile 或 PATH；不能代替 T-040 真实单文件安装验收。日志 local/evidence/T-058-windows-selftest.txt；E-013。


## 2026-10-15 · Codex/GPT-6（Windows）· .NET 10、T-029
- 用户明确同意安装 .NET 10 SDK。winget 系统安装被取消（1602），改为微软官方脚本将 10.0.402 安装在 local/tools/dotnet，不修改系统 PATH；E-014。首次 CLI 会初始化本机 .NET 缓存；后续运行禁用遥测。
- 宿主协议 Windows 测试 70/70 通过，与 Mac 结果一致。
- 新增 tools/wt-driver：专用随机标题窗口、固定 echo hi、逐次检查前台与目标身份、UIA TextPattern 实际输出检查、终端边界与截图、仅关闭自己创建的窗口。
- 初版 UIA 误选标题文本控件；改为在支持 TextPattern 的候选中找专用 prompt 后，连续三次通过，E-015；没有通过超时或忽略错误来凑通过。最终构建零警告/零错误。
- T-029 达到当前 smoke 标准；宿主 debugState 接入留 T-044，真实补全/缩放/输入法验收不因此通过。

## 2026-10-16 · Claude Code/Opus 5.5（Mac，整合者）· D-014、T-056 分析、T-059 至 T-062

- 合并 Windows 端的 T-057、T-048（无人值守）、T-056 复现、T-058 复验、.NET 10、T-029、T-021 认领。
- 用户决定 D-014：需要用户在场的测试先放一边，先把功能做完，最终交付 Windows 安装包和配置。重写 `docs/windows-next.md` 第 3 版。
- T-056：根据 E-012 推断出原因（F-035）。在 `src/isterm/pty.ts` 中加了试验用的变体 `FIGWIN_T056_VARIANT`（默认与上游相同），机制测试 3 个。模拟器新增对照组、逐步检查、外层 ConPTY 规则，`matrix.cjs` 一次跑 8 组；Mac 上 8 组都对齐（E-016）。修复要等 Windows 上的结果。
- 写安装包时发现并修复两个会让用户无法使用 PowerShell 的问题：
  - F-037、T-062：`is` 启动失败时，初始化脚本照样关闭 PowerShell。
  - F-036：升级后资源不会更新。安装脚本改为每次先 `reinit`。
- T-058 的安装脚本扩展：原地安装；`-NoProfileUpdate`；默认配置；每完成一步就写一次安装记录；安装日志；PATH 改为直接读写注册表（保留 REG_EXPAND_SZ 和 `%变量%`，卸载时恢复原值）。自测在 Mac 上 69 项通过，另有 3 个只在 Windows 上运行的 PATH 用例；做了两次变异检查。
- T-060：默认配置 `installer/inshellisenserc.toml`，有中文说明；测试 3 个，变异检查有效。为此给 `loadConfig` 加了可选参数。
- T-059：Inno Setup 7.1 安装脚本、构建脚本（Mac 上验证了准备文件的步骤，第三方声明 47 个包）、安装包验收脚本 `test-installer.ps1` 和 `check-installed.cjs`（Mac 上验证了 3 种检查方式）。D-015 记录技术选择。
- T-061：`.github/workflows/windows.yml`。
- L1：Mac 上 396 个测试，385 个通过，10 个跳过，1 个失败（Homebrew）；lint 通过；check-refs 通过。

## 2026-10-16 · Claude Code/Opus 5.5（Mac，整合者）· CI 第一、二次结果，GPT 审查安装包

- 第一次 CI：安装包构建因读错 ISCC 的版本字段而失败；Windows 上 configTemplate 测试因 CRLF 失败。都已修复。
- 第二次 CI（E-018）：Windows 上的测试全部通过；安装包编译成功，虚拟机中安装、新开 PowerShell 7 自动出现补全（PATH 中没有 Node）都通过。
- 第一次按“统筹 GPT”的方式，用本机 Codex（`codex exec`，只读）独立审查安装包，发现 9 个问题。整合者逐条核实，全部成立，其中两条在本机复现（严格模式下哈希表缺键、空结果取 `.Count` 都会报错）。修复：
  - 写文件改为原子替换；先记录、再修改；
  - 安装记录增加 completed：第一次安装中途失败时，再运行一次会补完，不再当作升级跳过；配置失败时安装程序的退出码是 9；
  - 卸载脚本失败或没有 PowerShell 7 时，把恢复所需的文件保存到 `%LOCALAPPDATA%\figwin-recovery\`，并提示怎样完成恢复；
  - 进程检查：WMI 失败时改用 PowerShell 检查，两种都失败时不放行；
  - 卸载时只删除那两行，其余字节原样保留；用户改过的配置文件先另存一份；
  - PATH 的“没有改过”判断区分大小写和值类型；记录一律用索引访问，兼容第 1 版的记录；
  - 验收脚本：修复 `.Count` 缺陷；升级检查先故意把资源弄旧；增加故障注入（配置失败 → 退出码 9 → 补完 → 卸载恢复）。
  - 安装脚本自测：82 项通过，另有 4 个只在 Windows 上运行的 PATH 用例；两处变异检查有效。
- T-056：`noscroll` 无效。新增变体 `sysconpty`、`syswpty`（改用系统 ConPTY），等第三次 CI。

