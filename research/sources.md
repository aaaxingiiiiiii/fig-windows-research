# 来源与许可

运行 `sh scripts/fetch-sources.sh` 可以把下列仓库拉取到 `local/sources/<目录>`，并固定到表中的 commit。源码引用格式为 `别名:路径#L行号`。

| 别名 | 仓库 | 目录 | 固定 commit（日期） | 许可证 | 用途 |
| --- | --- | --- | --- | --- | --- |
| `aq` | [aws/amazon-q-developer-cli-autocomplete](https://github.com/aws/amazon-q-developer-cli-autocomplete) | `amazon-q-developer-cli-autocomplete` | `b654a1b`（2025-11-15） | MIT 或 Apache-2.0 双许可（仓库根目录 `LICENSE.MIT`、`LICENSE.APACHE`） | Fig 桌面端、figterm、Shell 集成和补全前端源码；工作区版本 1.19.7 |
| `wf` | [withfig/autocomplete](https://github.com/withfig/autocomplete) | `autocomplete` | `aef52ac`（2025-05-05） | MIT | 补全规格（spec）库，覆盖数百个 CLI |
| `is` | [microsoft/inshellisense](https://github.com/microsoft/inshellisense) | `inshellisense` | `8dcc9ca`（2026-10-03） | MIT | 已有的跨平台实现，支持 Windows，使用 `wf` 的 spec |

实现阶段计划通过 npm 使用的包（都已核实为 MIT 许可，F-026）：`@withfig/autocomplete`（编译好的 spec；2.692.3 版解压后约 77 MB、1541 个文件）、`@fig/autocomplete-generators`、`@fig/autocomplete-helpers`、`@fig/autocomplete-shared`、`@withfig/autocomplete-types`。

另外两个相关仓库，目前未克隆：

- [aws/amazon-q-developer-cli](https://github.com/aws/amazon-q-developer-cli)（Apache-2.0）：主要是聊天和智能体功能。按搜索结果，该项目已转为只修复安全问题，后续功能在闭源的 Kiro CLI 中开发（未在仓库 README 中逐字核实）。
- [withfig/fig](https://github.com/withfig/fig)（MIT，已归档）：Fig 公开问题追踪库，可用来查找历史行为和已知问题。

## 引入本仓库的第三方代码

| 目录 | 来源 | 版本 | 许可证 | 引入任务 |
| --- | --- | --- | --- | --- |
| `src/inshellisense/` | `is`（microsoft/inshellisense） | commit `8dcc9ca`，0.0.4 | MIT（目录内的 `LICENSE`） | T-036；改动记录在该目录的 `CHANGES.md` |

悬浮窗宿主（`src/overlay-host/`，T-053）通过 NuGet 引用、只用于测试的包。不复制它们的源码，许可证按本机缓存中的 nuspec 核实（2026-10-15）：

| 包 | 版本 | 许可证 |
| --- | --- | --- |
| xunit | 2.9.3 | Apache-2.0 |
| xunit.runner.visualstudio | 3.1.4 | Apache-2.0 |
| Microsoft.NET.Test.Sdk | 17.14.1 | MIT |
| Microsoft.Extensions.TimeProvider.Testing | 10.11.0 | MIT |

核心类库 `FigWin.OverlayHost.Core` 只依赖 .NET 10 自带的库。

安装包（T-059）和 Windows 自动检查（T-061）在构建时使用下面的工具，不复制它们的源码（2026-10-16 核实）：

| 工具 | 版本 | 许可证 | 用途 |
| --- | --- | --- | --- |
| Inno Setup | 7.1.0（[jrsoftware/issrc 的 Release](https://github.com/jrsoftware/issrc/releases/tag/is-7_1_0) 中的 `innosetup-7.1.0-x64.exe`，SHA256 `0362a383ed217d4c4239b5933866dd96d3eb2102737da92f80f6057a4b40df2f`） | Inno Setup License（issrc 的 `license.txt`：允许任何用途，包括商业用途；再分发时保留版权声明） | 编译安装包；界面使用其中自带的官方简体中文翻译（2026-06-23 加入，7.x 起提供） |
| GitHub Actions | `actions/checkout` v7.0.1、`actions/setup-node` v7.0.0、`actions/setup-dotnet` v6.0.0、`actions/upload-artifact` v7.0.2，都按 commit 固定 | MIT | `.github/workflows/windows.yml` |

安装包中的 `is.exe` 打包了 Node.js 运行时和 inshellisense 的 npm 生产依赖（47 个，包括 `@withfig/autocomplete`）。构建脚本把它们的许可证文本收集到安装目录的 `licenses/` 中：Node.js 的 `LICENSE`、inshellisense 的 `LICENSE`、每个 npm 包自带的许可证（`THIRD-PARTY-NOTICES.txt`）。其中 4 个包没有附带许可证文件，只在 `package.json` 中声明了 MIT（或 MIT/CC0），声明文件中照实注明。

## 闭源对象

| 对象 | 用途 | 限制 |
| --- | --- | --- |
| Kiro CLI 2.30.0 macOS 版（见 `target.md`） | 黑盒运行时观察，与开源基线对比 | 不反编译，不复制其二进制或资源（D-001）；使用条款未逐条核实 |

## 使用规则

- 在自研代码中复用 `aq`、`wf` 或 `is` 的代码时，必须保留原版权声明和许可证文本，并在本表“用途”一栏写明复用了哪些文件。
- `wf` 的 spec 是可执行的 JavaScript（含 generator、postProcess 等函数）。直接加载它们意味着运行第三方代码，需要在实现中考虑沙箱和信任边界。
- 二手资料（博客、聚合站）只能作为线索，结论应以仓库或官方文档为准。

## T-015：共享 generator 的固定版本核对

- 来源：npm 官方 registry 的 [`@fig/autocomplete-generators` 2.4.0 tarball](https://registry.npmjs.org/@fig/autocomplete-generators/-/autocomplete-generators-2.4.0.tgz)，包内 `package.json` 声明 MIT。2026-10-14 仅下载到内存并读取源码，没有安装、运行或复制其实现到项目。
- 固定依据：`wf:pnpm-lock.yaml#L383-L384`；实算 tarball SHA-512 与锁文件 integrity 一致（`sha512-fiaaCGmsgnbUJbVbNAcVDmrnCGj/SmfarK6WKt/lfQP9k1hLHkkmZQ836VSMJvPP1vAKFAiXpdJziG6EGyjAYg==`）。
- 检查文件：包内 `package/lib/src/filepaths.js`（尤其第 94–149 行）、`keyvalue.js`、`ai.js`。用于区分 helper 的 `ls`/`fig` 依赖与 inshellisense 内建文件模板；结论见 `spec-compat.md`。这里核对的是 wf 锁定依赖，不代表 is 2.675.0 构建中的 helper 已核实。

## 已用于核实背景的公开资料

- GitHub API 仓库元数据（2026-10-14 查询）：上表的许可证、归档状态和最近推送时间。
- AWS 文档 [Upgrade to Kiro](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/upgrade-to-kiro.html)：Amazon Q 组件会更新为 Kiro 的对应组件。
- AWS 日文博客 [Introducing Kiro CLI](https://aws.amazon.com/jp/blogs/news/introducing-kiro-cli/)：Amazon Q Developer CLI 更名为 Kiro CLI，二手资料称发布日期为 2025-11-18（链接可以访问，正文未逐字核实）。
- [Kiro CLI 官方文档](https://kiro.dev/docs/cli/)。
- Fig 于 2024-09-01 停止服务：仅见于二手资料，尚未找到官方原文，标为推断。
