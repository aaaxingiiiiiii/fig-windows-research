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

## 2026-10-14 · Codex/GPT-6（Mac）· T-015

- 做了：
  - 阅读交接、任务板与工作流，按预留分工在独立 worktree 的 `ai/codex/T-015` 分支完成源码评估。
  - 用 fetch-sources 脚本确认三个参考仓库的固定版本；审查 30 个常用 CLI 样本的 generator、动态 spec/别名、共享导入及子规格。
  - 从 npm registry 只读核对 autocomplete-generators 2.4.0，SHA-512 与 wf 锁文件一致；确认 filepaths helper 依赖 ls、git AI 候选依赖 fig，与引擎原生文件模板区分。
- 产出：新增 `research/spec-compat.md`（11 项可直接使用、17 项需改写、2 项不适用；每项附命令与引用）；补充 `research/sources.md` 的固定 helper 来源；仅更新任务板中 T-015 行。报告包含 T-037 适配建议和 Windows 验证清单。
- 验证：check-refs、check-public、git diff --check 通过；核对 30 行编号、表格列数与分类计数。check-public 只扫描索引，因此另对四个新增/修改文件的工作区内容执行相同路径/凭据模式及本机用户名检查。
- 没做完 / 边界：本次是源码评估，未在 Windows 运行；wf 2.692.3 与 is 所用 2.675.0 不同，实际构建需复核；样本不是基于使用率的排名。任务认领和完成状态尚未提交/推送，遵守 AGENTS.md 的用户同意要求。按并行协作规则没有重写 handoff，也未改动其他 AI 的任务。
- 下一步建议：T-037 参考报告改写共享文件访问和执行器；Codex 下一项是 T-042，先读取 mvp-plan，再从同步后的 develop 建立独立任务分支。T-015 的提交、推送及合并仍需用户同意。
