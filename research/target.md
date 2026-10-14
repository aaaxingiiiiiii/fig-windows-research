# 研究对象

更新：2026-10-14。未特别标注的项目均为观察结果（证据 E-001、E-002）。

## 结论先行

- “Fig”目前没有可以独立运行的原版。本机安装的是它的后继产品 **Kiro CLI 2.30.0**（Fig → Amazon Q Developer CLI → Kiro CLI），bundle ID 仍为 `com.amazon.codewhisperer`。
- Fig 补全功能的源码已经开源（见 `sources.md` 中的 `aq`，版本 1.19.7）。因此本项目以开源源码作为主要依据，以 Kiro 2.30.0 作为运行时对照。

## 运行时对象（闭源，仅做黑盒观察）

| 字段 | 记录 |
| --- | --- |
| 产品 | Kiro CLI（Amazon 发布，Developer ID：AMZN Mobile LLC，Team ID `94KV3E626L`） |
| 版本 / build | 2.30.0 / `20261012.203414`；`manifest.json` 中渠道为 stable，打包方式为 dmg |
| 安装位置 | `/Applications/Kiro CLI.app`；命令行入口 `~/.local/bin/kiro-cli`（软链接到 app 内的可执行文件），旧命令 `q` 是一个转发脚本 |
| 主机 | macOS 26.6（25G72），arm64 |
| 架构 | 所有可执行文件均为 x86_64 + arm64 通用二进制 |
| 观察时的运行状态 | `kiro_cli_desktop` 正在运行；本机 zsh 会话被 `zsh (kiro-cli-term)` 包装 |
| 支持的 shell | `kiro-cli init` 接受 bash、zsh、fish、nu，**不支持 pwsh 或 powershell**（E-003） |

组件对照（根据名称和开源代码对应关系推断，未反编译验证）：

| Kiro 2.30.0 组件 | 开源对应（`aq`） | 作用 |
| --- | --- | --- |
| `MacOS/kiro-cli` | `crates/q_cli` | 命令行入口、`init` 生成 shell 集成 |
| `MacOS/kiro-cli-term` | `crates/figterm` | 用 PTY 包装 shell，追踪编辑缓冲区 |
| `MacOS/kiro_cli_desktop` | `crates/fig_desktop` | 常驻进程，负责窗口、IPC 和 webview |
| `Helpers/CodeWhispererInputMethod.app/.../fig_input_method` | `crates/fig_input_method` | macOS 输入法，用于获取光标位置 |
| `Resources/autocomplete/` | `packages/autocomplete-app` | 补全弹窗的 Web 前端（单个 JS 打包文件，约 600 KB） |
| `MacOS/kiro-cli-chat` | `aws/amazon-q-developer-cli`（未克隆） | 聊天功能，不在本项目范围内 |

## 样本哈希（SHA-256）

| 文件（相对 `Kiro CLI.app/Contents/`） | SHA-256 |
| --- | --- |
| `MacOS/kiro-cli` | `c27e6cd953c44ffff2de9f5626083359cd982d245eb79445c2f442d9d046927a` |
| `MacOS/kiro-cli-term` | `1c845b9a45cfe215b41aa7bb8fbdde7b61539bb42b0db374b87326475732b124` |
| `MacOS/kiro_cli_desktop` | `3f421ba8158ebcdfde6f2ee83448c87772fb2aaca7bf7deea4e8dee0285cdef8` |
| `MacOS/kiro-cli-chat` | `7df96616017c95d640a1d551b38a676431128d49765247d938bf6161842a4a03` |
| `Helpers/CodeWhispererInputMethod.app/Contents/MacOS/fig_input_method` | `80e4c7ed3f28490006ad3e1325a59026f690efdb034116660657369694c059a6` |
| `Resources/autocomplete/assets/index-Ct4Ru0Ux.js` | `d4d4538b43eeaee133a94367b6b296a6fc153b07a9a6bee9a1a5f612d1d7f244` |
| `Resources/autocomplete/index.html` | `77e86123e48e802cc5d7833022c26597e3bc6498a7eac2dbe633698af5d31888` |

## 开源基线与闭源版本的关系

下表摘自 `findings.md`；两处不一致时以 `findings.md` 为准。

| 编号 | 结论 | 类型 | 依据 |
| --- | --- | --- | --- |
| F-003 | `kiro-cli init zsh pre` 的输出与 `aq:crates/fig_integrations/src/shell/scripts/pre.sh` 只在模板占位符（二进制名）和一处 `2>/dev/null` 上不同 | 观察 | E-003 与源码 diff |
| F-004 | Kiro 前端打包文件中使用与开源前端相同的设置键（如 `autocomplete.immediatelyExecuteAfterSpace`、`insertCommonPrefix`），以及相同的 spec CDN `https://specs.q.us-east-1.amazonaws.com/` | 观察 | E-002；`aq:packages/autocomplete-parser/src/loadHelpers.ts#L33` |
| F-005 | 从 F-003 和 F-004 推断：Kiro 2.30.0 的补全链路沿用开源代码，可以把开源代码当作行为基线；但 1.19.7 到 2.30.0 之间的具体改动未知 | 推断 | 需要用 `specs/completion.md` 中的运行时用例验证 |
| F-006 | `kiro-cli init zsh post` 在非交互、非 figterm 的环境中只输出 4 行（设置 PATH）；开源版 `post.zsh` 有 193 行，并会发送 OSC 697 序列。原因未知 | 未知 | E-003；待 T-013 验证 |

## 私有记录

只与本机相关的信息（用户目录、登录账号、设置值）记录在 `local/target-private.md`，不提交。
