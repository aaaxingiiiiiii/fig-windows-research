# AI 协作规则

本文件是所有 AI 工具（Codex、Claude Code、Gemini CLI、Cursor、Copilot 等）共用的唯一规则源。`CLAUDE.md`、`GEMINI.md` 只指向这里，不另写规则。

## 项目目标

研究 Fig 终端补全（现由 Kiro CLI 延续）的行为与互操作方式，写出有证据支持的行为规格，在 Windows 上独立实现同类补全插件。

关键背景（详见 `research/target.md`、`research/sources.md`）：

- Fig 已于 2024-09-01 停止服务。它的代码已由 AWS 以 MIT/Apache-2.0 开源，补全规格库 `withfig/autocomplete` 采用 MIT 许可。
- 本机可运行的是闭源后继产品 Kiro CLI。它只用于黑盒行为观察，不反编译（D-001）。
- 研究优先级：开源源码 → Kiro 运行时观察 → 公开文档。原生逆向工具（REA、Ghidra、Hopper）不是前置条件。
- 路线（D-007）：在 PowerShell 7 + Windows Terminal 上，先基于 inshellisense 做终端内补全（阶段 A），再在同一份代码上加 Fig 式悬浮窗（阶段 B）。实现阶段的主计划是 `docs/mvp-plan.md`。
- 开发分支是 `develop`，不要直接提交到 `main`（D-008）。

## 每次会话开始

1. 依次读取 `docs/handoff.md`（当前状态）、`tasks/board.md`（任务板）和 `docs/workflow.md`（流程细则）。如果认领的是实现任务，还要读 `docs/mvp-plan.md`；阶段 B 的任务还要读 `docs/protocol.md`（由 T-042 编写）。做验收、安排后续工作或在两端之间同步代码时，读 `docs/roadmap.md`（后续顺序、分工、验收流程）。
2. 若用户未指定任务，选择 board 中第一条满足以下条件的任务：状态为 `todo`、依赖均已 `done`、`env` 与本机能力相符、没有标注 `decision:user`。
3. 把该任务改为 `doing`，填写负责人（工具/模型）和日期。
4. 若需要源码，运行 `sh scripts/fetch-sources.sh`，在 `local/sources/` 获得固定版本。

## 工作中

- 只做认领任务的范围。发现新问题时在 board 中新增任务，不要顺手扩大范围。
- 每条结论标注“观察”“推断”或“未知”，并附证据 ID 或源码引用；格式见 `docs/workflow.md`。
- 需要用户拍板的事项写入 `docs/decisions.md`，状态设为“待决定”，不要擅自选定。
- 修改系统配置或安装软件前，先说明计划并取得用户同意。

## 会话结束

1. 更新涉及的 `research/`、`specs/` 文件。
2. 更新 board：将任务状态改为 `done`、`blocked` 或 `todo`，写明产出和阻塞原因。
3. 重写 `docs/handoff.md`，包括当前状态和下一条最小可执行任务。
4. 在 `docs/log.md` 末尾追加一条会话记录。
5. 运行 `sh scripts/check-public.sh`；修改过源码引用时，再运行 `python3 scripts/check-refs.py`。都通过后再提交，提交和推送须经用户同意。

## 公开边界

- `local/` 存放程序副本、源码克隆、原始证据、录屏和抓包，该目录不提交。仓库只保存自己撰写的结论、索引、规格和代码。
- 开源代码按其许可证使用：复用代码时保留版权和许可声明，并登记到 `research/sources.md`。闭源程序（Kiro CLI）的二进制、资源和反编译结果不进入仓库。
- 不绕过许可证、签名、登录或付费限制。
- 公开记录中不得出现本机绝对路径、用户名、终端历史、令牌或个人数据。`.gitignore` 不能保证不泄漏。
