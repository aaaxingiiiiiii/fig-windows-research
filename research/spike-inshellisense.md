# T-035：Windows 原版 inshellisense 实测

日期：2026-10-14；负责人：Codex/GPT-6（Windows）。

状态：**进行中**。环境、诊断和受控终端冒烟检查完成；Windows Terminal 的完整人工验收尚未执行，关卡结论待定。

## 版本与边界

| 项目 | 实测 |
| --- | --- |
| Windows | Windows 11 专业版 10.0.26200，build 26200，AMD64 |
| 主显示器缩放 | 150% |
| Windows Terminal | 1.24.12741.0（已安装；尚未在其窗口内完成验收） |
| PowerShell | 7.6.5（本轮使用 Agent 提供的运行时） |
| PSReadLine | 2.4.5 |
| PredictionSource | 本轮非交互检查为 None，不代表用户日常会话配置 |
| Node.js / npm | 22.23.2 / 10.9.8 |
| Git | 2.55.0.windows.5；Git Bash 已安装 |
| .NET SDK | 未检测到 SDK；不阻塞本次阶段 A 的原版测试 |
| 原版包 | 官方 npm `@microsoft/inshellisense@0.0.4`，Windows x64 平台包 |

从 `mac/develop` 的 5020935 接手。在独立任务分支上进行验证，没有修改 vendor 源码或用户的 PowerShell 启动配置。

## 已完成的观察

1. 环境脚本原先在 ordered hashtable 中直接使用 try/catch，PowerShell 解析报错。改为 `$()` 子表达式后可正常执行；SDK 缺失现在明确报告，不再把 dotnet 错误提示当作版本号。
2. 原版包安装在 `local/tools/inshellisense-baseline/`。安装后通过官方 `bin.js` 入口调用，避免依赖本机全局 `is` 命令。
3. 首次直接运行 complete 时，因尚未解包 spec，出现 ERR_MODULE_NOT_FOUND。通过项目内启动器执行 `init pwsh` 后恢复；不是补全算法结论。
4. `--version` 返回 0.0.4；doctor 四项检查全部通过。
5. `complete 'git ch'` 返回 checkout、cherry-pick，activeToken 为 ch。该 CLI 路径在 Windows 默认使用 cmd 语义，不能独立证明 pwsh 插入正确。
6. 另外在工具提供的交互 PTY 中运行 `-s pwsh`：出现提示符，执行 `Write-Output T035_SMOKE_OK` 返回标记；输入 `git ch` 显示 checkout 和 cherry-pick；发送下方向键及 Tab 后，终端输出显示 `git cherry-pick `。随后按 Ctrl+C 取消，未执行 cherry-pick，输入 exit 后退出码为 0。

第 6 项是受控 PTY 下的观察，不能等同于 Windows Terminal 的视觉效果、输入法、双层终端兼容性或延迟验收。未测量启动耗时与输入延迟，不能给出性能通过结论。

## 人工清单进度

按 `docs/mvp-plan.md` 中 T-035 的编号继续：

| 项目 | 当前状态 |
| --- | --- |
| 1：WT 新标签启动及耗时 | 待用户在 WT 验证；仅受控 PTY 启动通过 |
| 2–3：git ch 候选及下方向键 + Tab | 受控 PTY 观察通过；WT 待确认 |
| 4–7：分支、空格路径、Esc、原按键回退 | 待测 |
| 8–10：中文输入法、多行粘贴、缩放和分屏 | 待测，需人工观察 |
| 11–14：全屏应用、运行中 Ctrl+C、快速输入、预测提示 | 待测；取消未执行输入不算中断运行程序通过 |
| 15–16：中文目录和特殊字符路径 | 待测；如原版缺陷出现，记录实际表现，不修改通过标准 |

## 下一步

在 Windows Terminal 使用 `spikes/T-035-baseline/README.md` 的启动命令，按 16 项清单逐项记录是/否和现象。完整验收前保持 T-035 为 doing。此后按交接安排执行 T-048 验证修改版；本轮未开始 T-048。

本次使用隔离的运行时用户目录；未开启开机/终端自动启动。将来验证真实用户 `$PROFILE` 时另行按授权范围备份并执行。
