# Fig 补全行为研究与 Windows 实现

研究 Fig 终端补全（现由 Kiro CLI 延续）的行为，写出有证据支持的规格，在 Windows 上实现同类补全插件。本仓库与 Fig、AWS 均无隶属关系。

**当前状态：** 已根据开源源码整理出补全链路和行为规格，正在等待用户确定 Windows 实现路线，Mac 和 Windows 上的实测尚未进行。详见 [docs/handoff.md](docs/handoff.md)。

## 关键事实

- Fig 已停止服务。后继产品是 Amazon Q Developer CLI，后来更名为 Kiro CLI。
- Fig 补全的源码（[aws/amazon-q-developer-cli-autocomplete](https://github.com/aws/amazon-q-developer-cli-autocomplete)）以 MIT/Apache-2.0 开源，spec 库（[withfig/autocomplete](https://github.com/withfig/autocomplete)）以 MIT 开源。所以本项目以**读源码**为主，不需要反编译。
- Fig 从未发布 Windows 版。[microsoft/inshellisense](https://github.com/microsoft/inshellisense)（MIT）已经在 Windows 上实现了类似功能，是重要的对照对象。

## 交给任意 AI 接手

本仓库按“多 AI 接力”的方式组织，适用于 Codex、Claude Code、Gemini CLI、Cursor 等工具。把下面这段话交给 AI 即可：

> 阅读 AGENTS.md，按其中“每次会话开始”的步骤，从 tasks/board.md 选择一个适合本机环境的任务并完成，会话结束时按 AGENTS.md 更新交接文件。

想指定任务时，在这段话后面加上“做 T-0xx”。

## 目录

| 路径 | 用途 |
| --- | --- |
| `AGENTS.md` | 所有 AI 共用的规则（`CLAUDE.md`、`GEMINI.md` 只指向这里） |
| `docs/handoff.md` | 当前状态和下一步 |
| `tasks/board.md` | 任务板 |
| `docs/workflow.md` | 接力流程细则：编号、证据、认领、提交 |
| `docs/decisions.md` | 决策记录，包括待用户决定的事项 |
| `docs/log.md` | 会话记录 |
| `docs/windows-plan.md` | Windows 实现路线 |
| `docs/mac-setup.md` | Mac 上的运行时观察环境 |
| `research/` | 研究对象、来源、证据索引、结论、架构和现有方案 |
| `specs/completion.md` | 补全行为规格和用例 |
| `scripts/fetch-sources.sh` | 把参考仓库拉取到 `local/sources/`，固定 commit |
| `scripts/check-public.sh` | 提交前检查本机路径、凭据和大文件 |
| `scripts/check-refs.py` | 检查文档中的源码引用是否有效 |
| `local/` | 源码克隆、原始证据、录屏；Git 忽略，不提交 |

## 公开仓库约定

只发布自己撰写的研究说明、规格和代码。开源代码按其许可证使用，复用时保留声明并登记到 `research/sources.md`。闭源程序（Kiro CLI）的二进制、资源和反编译结果不进入仓库。`.gitignore` 只是辅助手段，提交前要运行 `sh scripts/check-public.sh` 并查看 `git diff --cached`。

本仓库采用 [MIT 许可证](LICENSE)（D-005）。复用的第三方代码保留其原有许可证。
