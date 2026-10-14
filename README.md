# Fig 行为研究与 Windows 重实现

在 macOS 上研究 Fig 的可观察行为和集成方式，形成有证据支持的功能规格，再在 Windows 上独立实现。此仓库是公开的研究与协作起点，与 Fig 官方无隶属关系。

**当前状态：准备阶段。尚未确认目标版本、取得分析证据或实现 Windows 客户端。**

## 是否必须使用 Mac？

研究公开资料、可使用的 JavaScript 文件和静态资源不一定需要 Mac。观察 Fig 在 macOS 上的实际运行、终端交互和系统集成，需要可运行目标版本的 Mac 环境。

本项目已验证的 Windows 环境使用 REA 6.4.0；该版本的 Windows Ghidra P0 路径只接受 x86/x86-64 PE，不能用这一路径分析 Fig 的 Mach-O 原生程序。这是这一工具路径的限制，并非所有静态逆向工具都必须在 Mac 上使用。

## 在另一台 Mac 上开始

```bash
git clone https://github.com/xingdouiii-maker/fig-windows-research.git
cd fig-windows-research
```

1. 安装/打开 Codex，将这个文件夹作为项目。
2. 按 [Mac 环境准备](docs/mac-setup.md) 配置 REA；Windows 电脑上的工具安装不会通过 Git 自动同步。
3. 将下面的任务交给 Mac 上的 Agent：

> 阅读 AGENTS.md、docs/handoff.md 和 docs/mac-setup.md。先确认本机 Fig 的准确产品、版本和应用路径，检测 REA 是否可用。优先分析“终端补全的触发、候选展示与选中后插入”这一条流程；这是初始候选范围，若目标不包含该功能则先澄清。将事实、推断与未知项分开，更新 research/target.md、research/findings.md 和 specs/completion.md。原始应用、反编译输出与录屏只存放在忽略的 local/ 目录；仅将经过检查的文字结论和独立行为规格提交到公开仓库。当前先完成调查，不扩展为完整 Windows 客户端开发。

## 目录

| 路径 | 用途 |
| --- | --- |
| `docs/mac-setup.md` | Mac 安装、接入和 provider 选择 |
| `docs/handoff.md` | 跨电脑交接、当前状态和下一步 |
| `research/target.md` | 产品、版本、架构、样本哈希和来源 |
| `research/findings.md` | 结论与证据索引 |
| `specs/completion.md` | 面向独立实现的行为规格 |
| `docs/windows-plan.md` | Windows 实现阶段与验收路线 |
| `local/` | 本地样本、原始证据和临时输出；Git 忽略 |

## 公开仓库约定

只发布自己撰写的研究说明、独立规格及可合法公开的代码。第三方软件本体、专有资源、未经授权的反编译代码、终端历史、令牌和原始抓包不进入仓库。开源参考材料应核实并记录具体许可证、版本和来源。

`.gitignore` 只是辅助，提交前仍需检查 `git diff --cached`。本仓库暂未指定代码许可证；公开可见不等于授予任意复制或分发许可。

## 参考

- [REA 官方仓库](https://github.com/morluto/rea)
- [REA 安装与配置](https://github.com/morluto/rea/blob/main/docs/installation.md)
- [Codex MCP 文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

环境基线记录于 2026-10-14；后续升级 REA 时记录实际版本与工具能力。
