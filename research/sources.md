# 来源与许可

运行 `sh scripts/fetch-sources.sh` 可以把下列仓库拉取到 `local/sources/<目录>`，并固定到表中的 commit。源码引用格式为 `别名:路径#L行号`。

| 别名 | 仓库 | 目录 | 固定 commit（日期） | 许可证 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `aq` | [aws/amazon-q-developer-cli-autocomplete](https://github.com/aws/amazon-q-developer-cli-autocomplete) | `amazon-q-developer-cli-autocomplete` | `b654a1b`（2025-11-15） | MIT 或 Apache-2.0 双许可（仓库根目录 `LICENSE.MIT`、`LICENSE.APACHE`） | Fig 桌面端、figterm、Shell 集成和补全前端源码；工作区版本 1.19.7 |
| `wf` | [withfig/autocomplete](https://github.com/withfig/autocomplete) | `autocomplete` | `aef52ac`（2025-05-05） | MIT | 补全规格（spec）库，覆盖数百个 CLI |
| `is` | [microsoft/inshellisense](https://github.com/microsoft/inshellisense) | `inshellisense` | `8dcc9ca`（2026-10-03） | MIT | 已有的跨平台实现，支持 Windows，使用 `wf` 的 spec |

另外两个相关仓库，目前未克隆：

- [aws/amazon-q-developer-cli](https://github.com/aws/amazon-q-developer-cli)（Apache-2.0）：主要是聊天和智能体功能。按搜索结果，该项目已转为只修复安全问题，后续功能在闭源的 Kiro CLI 中开发（未在仓库 README 中逐字核实）。
- [withfig/fig](https://github.com/withfig/fig)（MIT，已归档）：Fig 公开问题追踪库，可用来查找历史行为和已知问题。

## 闭源对象

| 对象 | 用途 | 限制 |
| --- | --- | --- |
| Kiro CLI 2.30.0 macOS 版（见 `target.md`） | 黑盒运行时观察，与开源基线对比 | 不反编译，不复制其二进制或资源（D-001）；使用条款未逐条核实 |

## 使用规则

- 在自研代码中复用 `aq`、`wf` 或 `is` 的代码时，必须保留原版权声明和许可证文本，并在本表“用途”一栏写明复用了哪些文件。
- `wf` 的 spec 是可执行的 JavaScript（含 generator、postProcess 等函数）。直接加载它们意味着运行第三方代码，需要在实现中考虑沙箱和信任边界。
- 二手资料（博客、聚合站）只能作为线索，结论应以仓库或官方文档为准。

## 已用于核实背景的公开资料

- GitHub API 仓库元数据（2026-10-14 查询）：上表的许可证、归档状态和最近推送时间。
- AWS 文档 [Upgrade to Kiro](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html)：Amazon Q 组件会更新为 Kiro 的对应组件。
- AWS 日文博客 [Introducing Kiro CLI](https://aws.amazon.com/jp/blogs/news/introducing-kiro-cli/)：Amazon Q Developer CLI 更名为 Kiro CLI，二手资料称发布日期为 2025-11-18（链接可以访问，正文未逐字核实）。
- [Kiro CLI 官方文档](https://kiro.dev/docs/cli/)。
- Fig 于 2024-09-01 停止服务：仅见于二手资料，尚未找到官方原文，标为推断。
