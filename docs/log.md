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
