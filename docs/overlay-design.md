# Fig 式悬浮窗方案：架构与成本评估

更新：2026-10-14。具体的实现步骤和测试步骤见 `docs/mvp-plan.md`。对应 D-003（已采用 Fig 式悬浮窗）和 D-004。依据见 `research/psreadline.md`、`research/caret-wt.md`、`research/findings.md` 中的 F-018 至 F-020。本页的成本数字都是**估算（推断）**，验证关卡（T-019 至 T-022）完成后需要修正。

## 结论

- **可以做，并且能达到最接近 Fig 的体验。**代价是 MVP 约需 9–15 人周，大约是“终端内显示”方案的 2–3 倍。
- 两项最大的技术风险都已经有了明确的做法，但必须在真实的 Windows 上验证：
  1. **光标像素定位（中高风险）**：用 UIA 的 TextPattern 取得光标所在的字符矩形，Fig 原型也用这条路；不行时用“行列号 × 单元格尺寸”换算。待验证：高 DPI 下可能偏移 4–8 px、跨进程调用的延迟、窗格切换。
  2. **感知输入变化（中高风险）**：PSReadLine 没有“缓冲区已变化”事件。候选做法是“预测插件钩子 + 特殊按键处理器”，需要实测输入法和粘贴场景下是否遗漏。
- 有两点可以明显降低成本：
  1. **PowerShell 7 不需要照搬 figterm 的 PTY 包装。**PSReadLine 可以直接读写缓冲区和光标，插入使用 `Replace`，比“退格加重打”更可靠。
  2. **Fig 的补全前端可以整体放进 WebView2 中复用。**它与宿主之间只有一层薄桥，只用到约 15 种宿主接口；WebView2 自带的 JS 引擎正好能运行 spec 中的函数（F-016、F-020）。
- 建议先用 1–1.5 周做 4 项验证再全面投入。如果光标定位不通过，第一版退回终端内显示，适配模块和补全引擎的投入都能保留。

## 架构

```text
Windows Terminal
 └─ pwsh 7 + PSReadLine
     └─ 适配模块（先写成 PowerShell 脚本，必要时改为 C# 二进制模块）  ← 相当于 Fig 的 figterm 和 shell 集成
         · 感知输入变化：预测插件钩子 + 特殊按键处理器
         · 发送 {缓冲区, 光标偏移, 光标所在行列, 当前目录, 会话 ID}
         · 悬浮窗可见时接管 Tab、Enter、↑、↓、Esc，否则调用 PSReadLine 原有的函数
         · 用 Replace 和 SetCursorPosition 应用补全
              │ 命名管道（每个用户一个，设置访问控制）
              ▼
宿主进程（C#/.NET，常驻托盘，Per-Monitor DPI 感知）                ← 相当于 fig_desktop
 · 置顶、不抢焦点的悬浮窗口，内嵌 WebView2
 · 光标定位：UIA TextPattern，失败时用行列号换算
 · 跟踪前台窗口、窗口移动、焦点和窗格切换
 · 在会话的当前目录中执行 generator 命令
 · 设置、日志、自动启动
              │ WebView2 消息（替代 Fig 的 window.ipc）
              ▼
补全前端（TypeScript，运行在 WebView2 中）           ← 复用 aq 的 autocomplete-app、autocomplete-parser、shell-parser
 · 分词、spec 匹配、generator、过滤排序、列表 UI
 · 打包时固定 wf spec 的版本
```

与 Fig macOS 版的对应关系：

| Fig（macOS） | 本方案（Windows） | 改动程度 |
| --- | --- | --- |
| figterm 包装 PTY，加上 OSC 697 标记 | PSReadLine 适配模块 | 重写；不需要 PTY，但需要自己解决“感知输入变化” |
| 用 Unix socket 传 protobuf | 命名管道（可以沿用 protobuf 或改用 JSON） | 重写传输层 |
| fig_desktop（Rust、tao、wry） | C#/.NET 宿主加 WebView2 | 重写 |
| IMK 输入法和 AX API 定位光标 | UIA TextPattern，加上行列号换算后备 | 重写；参考 Fig 原型 |
| React 补全前端 | 原样复用，增加一层转接代码 | 小改 |
| 前端通过宿主调用 `RunProcess` 执行 generator | 宿主直接在会话目录中启动进程 | 重写，需要处理 POSIX 命令 |

## 成本拆分

按一名熟悉 Windows 桌面开发的工程师估算，单位为人周，已计入 AI 辅助编码。

| 组件 | 内容 | MVP | 完整版 | 风险 |
| --- | --- | --- | --- | --- |
| 适配模块 | 感知输入变化、按键路由、插入、会话标识、与 PSReadLine 预测共存；可能需要编译成 DLL | 1.5–3 | 同左 | **中高** |
| IPC | 命名管道、消息格式、重连、宿主未运行时的降级 | 0.5–1 | 同左 | 低 |
| 光标定位 | UIA 定位、换算后备、DPI、多显示器、窗格、滚动、管理员权限运行的 WT | 1.5–3 | 同左 | **中高** |
| 悬浮窗 | 置顶且不激活、跟随移动、失焦隐藏、主题、WebView2 预热 | 1–2 | 同左 | 中 |
| 前端移植 | 转接代码、约 15 种宿主接口、PowerShell 分词和转义 | 2–3 | 同左 | 中 |
| generator | 在 Windows 上执行，处理超时、缓存；改写依赖 POSIX 命令的 spec | 0.5–1（只做 git） | 1.5–3 | 中 |
| 安装与发布 | 修改 profile、自动启动、卸载；代码签名、winget 或 MSIX | 0.5（脚本安装） | 2–3 | 中 |
| 测试与兼容 | WT 和 PS 版本、DPI、多显示器、中文输入法、回归用例 | 1–1.5 | 2–3 | 中 |
| **合计** | | **约 9–15** | **约 12–21** | |

- MVP 的范围：PowerShell 7 加 Windows Terminal，`git` spec 加文件路径，悬浮窗可以使用，`specs/completion.md` 中适用的用例全部通过。
- 用 AI 接力开发时，编码时间可以明显缩短；但 GUI、DPI、输入法这些测试必须在 Windows 实机上由人观察，这是日历时间的主要瓶颈。

### 其他费用

- **代码签名**：不签名的安装程序会触发 SmartScreen 警告。Azure Trusted Signing 约每月 10 美元，传统 OV 证书约每年数百美元。发布前再决定是否购买。
- **持续维护**：Windows Terminal 和 PSReadLine 升级后，UIA 或按键行为可能变化，需要保留回归测试；spec 也要定期同步。

### 与其他路线比较（估算）

| 路线 | MVP 工作量 | 体验 |
| --- | --- | --- |
| 基于 inshellisense | 1–2 周 | 菜单画在终端内，依赖 Node，generator 依赖 Git Bash |
| PowerShell 模块，终端内显示 | 4–6 周 | 菜单画在终端内，只支持 PowerShell |
| **Fig 式悬浮窗（已选）** | **9–15 周** | 最接近 Fig；以后要加 cmd 或 Git Bash，需要再做 ConPTY 包装 |

## 验证关卡

全面开发之前，先在真实的 Windows 机器上完成以下验证，每项都有明确的通过标准。环境和测量方法见 `docs/windows-setup.md`。

| 任务 | 验证内容 | 通过标准 | 不通过时 |
| --- | --- | --- | --- |
| T-019 | 光标定位：比较 UIA 与行列号换算两种方法（`research/caret-wt.md` 第 6 节） | 在 100%、150%、200% 缩放，分屏窗格，最大化，双显示器下，误差都不超过半个字符宽度；p95 耗时小于 15 ms | 第一版改为终端内显示，悬浮窗留到第 3 阶段 |
| T-020 | 适配模块：比较感知输入变化的几种做法，验证按键路由和插入（`research/psreadline.md` 第 5、6 节） | 正常输入、粘贴、历史调出、中文输入都能在 50 ms 内得到正确的缓冲区；每次按键的额外延迟小于 5 ms；悬浮窗不可见时，Tab、Enter 等按键保持原有行为 | 改为“按 Tab 才补全”的模式，并在 D-004 中重新评估 |
| T-021 | 悬浮窗：置顶、不抢焦点、跟随窗口 | 显示时不打断输入；WT 失焦、最小化、切换标签后隐藏；移动或调整 WT 窗口时跟随 | 改用原生 WPF 窗口绘制，不用 WebView2 |
| T-022 | 在 WebView2 中运行 Fig 前端 | `git ch` 能列出候选；从收到缓冲区到列表显示小于 50 ms；常驻内存记录在报告中 | 改用 inshellisense 的运行时引擎加自写列表 UI（MVP 增加约 1–2 周） |

T-019 和 T-020 的风险最高，应该最先做。
