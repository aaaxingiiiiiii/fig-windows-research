# 多 AI 接力流程细则

`AGENTS.md` 是简要规则，本页是细则。目标是让任何 AI 或人在不了解前情的情况下，只读仓库就能接手，并且不同会话的产出可以互相核对。

## 文件职责

| 文件 | 回答的问题 | 写法 |
| --- | --- | --- |
| `docs/handoff.md` | 现在进行到哪？下一步做什么？ | 每次会话结束时**重写**，保持一屏可读 |
| `tasks/board.md` | 有哪些任务？谁在做？做到什么程度才算完成？ | 逐行更新任务状态 |
| `docs/decisions.md` | 哪些方向已定，哪些等用户决定？ | 追加；状态变化时修改原条目 |
| `docs/log.md` | 每次会话做了什么？ | 只追加，不改历史记录 |
| `research/target.md` | 研究对象是什么版本，哈希是多少？ | 版本变化时更新 |
| `research/sources.md` | 用了哪些外部来源？许可证是什么？固定在哪个 commit？ | 新增来源时追加 |
| `research/evidence.md` | 本地原始证据怎么产生、如何复现？ | 每条证据一行 |
| `research/findings.md` | 得出了哪些结论，可信度如何？ | 每条结论一行 |
| `research/architecture.md` | Fig 的补全链路怎样工作？ | 叙述加源码引用 |
| `research/prior-art.md` | Windows 上已有哪些方案可以复用或对照？ | 叙述加对比表 |
| `specs/completion.md` | Windows 实现应满足哪些可测试行为？ | 用例 C-xxx |
| `docs/windows-plan.md` | Windows 实现的路线、阶段和验收标准是什么？ | 随决策更新 |

## 编号

| 前缀 | 含义 | 示例 |
| --- | --- | --- |
| `T-` | 任务 | T-012 |
| `D-` | 决策 | D-002 |
| `E-` | 本地原始证据（文件在 `local/evidence/`） | E-003 |
| `F-` | 结论 | F-007 |
| `C-` | 规格用例 | C-004 |

编号只增不复用。新增前先查看对应文件中的最大编号。

## 证据与引用

**源码引用**使用 `research/sources.md` 定义的别名、路径和行号，例如：

```text
aq:crates/figterm/src/main.rs#L120-L140
wf:src/git.ts#L10
is:src/runtime/runtime.ts#L55
```

别名固定到某个 commit，因此行号可以复现。升级 commit 时，需要同步更新 `sources.md` 和 `scripts/fetch-sources.sh`，并在 log 中记录。

**本地证据**（截图、录屏、命令输出、抓包）放在 `local/evidence/E-xxx-简述.ext`，同时在 `research/evidence.md` 登记：产生方式（命令或操作）、目标版本或哈希、日期，以及是否含个人数据。其他机器上的 AI 无法访问 `local/`，所以“产生方式”必须写到可以复现的程度。

**结论分级**

- 观察：直接看到的事实（读到的源码、运行时行为、命令输出）。
- 推断：由观察推导但没有直接验证。写明推理依据，以及用什么方法可以验证。
- 未知：已经尝试过，但还没有答案。写明尝试过什么、搜索范围是什么。

源码表明的行为不等于 Kiro 2.30.0 的实际行为，因为开源基线是 1.19.7。两者一致需要运行时观察来确认，否则只能标为推断。

## 任务板规则

状态：`todo` → `doing` → `done`。需要等待外部条件时用 `blocked`，并写明原因。

`env` 标签说明执行任务所需的环境：

| 标签 | 需要 |
| --- | --- |
| `any` | 只需本仓库和网络（读源码、写文档） |
| `mac-kiro` | macOS，已安装并登录 Kiro CLI |
| `windows` | Windows 10/11，可安装 PowerShell 7 等工具 |
| `human` | 需要人眼观察 GUI 或进行交互操作；AI 只能准备步骤并整理结果 |

`decision:user` 表示任务需要用户先做决定，AI 不要自行认领执行。

**认领**：把状态改为 `doing`，填写 `负责人` 为“工具/模型 日期”，例如 `Codex/gpt-5 2026-10-15`。如果某任务处于 `doing` 超过 3 天、log 中没有进展，可以视为放弃并重新认领，同时在 log 中注明。

**完成标准**：每个任务都写有“完成标准”。达不到时不要标为 `done`，改为留在 `doing` 或拆分出新任务。

**新增任务**：标题以动词开头，范围控制在一次会话（约 1–3 小时）内可以完成，写明依赖、`env` 和完成标准。

## 会话记录格式（docs/log.md）

```text
## 2026-10-15 · Codex/gpt-5 · T-012
- 做了：……
- 产出：F-008、C-003，更新 specs/completion.md
- 没做完 / 遇到的问题：……
- 下一步建议：T-013
```

## 提交约定

- 一个任务对应一个或少量提交，提交信息以任务编号开头，例如 `T-012: 记录 Tab 与 Enter 的插入行为`。
- 提交前运行 `sh scripts/check-public.sh`，并人工查看 `git diff --cached --stat`。
- 新增或修改了源码引用时，运行 `python3 scripts/check-refs.py`，检查文件是否存在、行号是否越界。它不检查引用的内容是否与结论相符，内容需要人工抽查。
- 分支（D-008）：日常开发在 `develop` 上进行。每个任务从 `develop` 分出 `ai/<工具>/<任务号>` 分支，完成后合并回 `develop`；只有文档的小改动可以直接提交到 `develop`。`main` 只用于里程碑，由用户决定何时合并。
- 推送：推送到 `origin`（用户的 fork）。同步到 `upstream` 的方式见 D-008 的“待确认”一项。

## 多个 AI 同时工作

例如：Mac 上的 Claude 和 GPT 同时开发，Windows 上还有一个 AI 做实测。

1. **一个 AI 一个工作目录。**同一台机器上的多个 AI 不能共用一个 git 工作目录，否则切换分支时会互相覆盖文件。第二个 AI 使用 git worktree，例如：
   `git worktree add -b ai/codex/T-015 ../fig-windows-research-codex develop`
   `local/` 不会随 worktree 带过去，需要在新目录中运行 `sh scripts/fetch-sources.sh`。在 macOS 上也可以用 `cp -cR <原目录>/local <新目录>/` 快速复制一份。
2. **先认领，再开工。**开工前，在 `develop` 上把任务改为 `doing` 并推送，其他 AI 拉取后就能看到。认领提交只改自己那一行。
3. **只改自己的部分。**任务进行期间只修改：
   - 自己负责的代码和文档；
   - 任务板上自己的那一行；
   - 在 `docs/log.md` 末尾追加记录。

   **不要重写 `docs/handoff.md`**，由用户指定的整合者（默认是最后一个合并进 `develop` 的 AI）在合并后统一更新。
4. **合并前先同步。**合并回 `develop` 前，先 `git fetch` 并把最新的 `develop` 合并进自己的分支，解决冲突后再合并、推送。不要强制推送，不要改写已推送的历史。
5. **共享的契约文件**（`docs/protocol.md`、`docs/decisions.md`）如果需要修改，在 log 中写明，并通知用户。

## 遇到问题时

- 工具不可用：在 log 中记录现象，再换用其他方法。不要为了用某个工具而扩大安装范围。
- 来源之间矛盾：两条都记录，标为“未知”，并新增一个验证任务。
- 需要用户决定：写入 `docs/decisions.md`，状态设为“待决定”，并列出选项及推荐理由。
