# Fig 式悬浮窗方案：架构与成本评估

更新：2026-10-14。对应 D-003（已采用 Fig 式悬浮窗）和 D-004。本页的成本数字都是**估算（推断）**，需要在验证阶段（T-019 至 T-022）完成后修正。

## 结论

- **可以做，并且能达到最接近 Fig 的体验。**代价是工作量约为“终端内显示”方案的 2–3 倍。最大的不确定性在于：能否在 Windows Terminal 中稳定取得光标的屏幕像素位置。
- 有两点可以明显降低成本：
  1. **在 PowerShell 7 中不需要照搬 figterm 的 PTY 包装。**Fig 在 macOS 上包装 PTY，是因为 bash 和 zsh 不提供读取编辑缓冲区的接口；PSReadLine 可以直接读写缓冲区和光标，插入文本也不再需要“退格加重打”这种方式。
  2. **Fig 的补全前端（引擎、UI、spec 加载）可以整体放进 WebView2 中复用。**它与宿主之间只有一层薄桥，实际用到的宿主接口约 15 种（F-018 至 F-020），WebView2 自带的 JS 引擎也正好能运行 spec 中的函数（F-016）。
- 建议用约 1–1.5 周做 4 项验证（下文“验证关卡”）再全面投入。如果光标定位验证失败，可以退回“终端内显示”，引擎和适配层的投入都能保留。

## 架构

```text
Windows Terminal
 └─ pwsh 7 + PSReadLine
     └─ 适配模块（PowerShell 模块）              ← 相当于 Fig 的 figterm 和 shell 集成
         · 每次输入变化时发送 {缓冲区, 光标, 当前目录, 会话 ID}
         · 窗口可见时接管 Tab、Enter、↑、↓、Esc
         · 用 PSReadLine 的 Replace 和 SetCursorPosition 应用补全
              │ 命名管道（每个用户一个）
              ▼
宿主进程（C#/.NET，常驻托盘）                       ← 相当于 fig_desktop
 · 置顶、不抢焦点的悬浮窗口，内嵌 WebView2
 · 用 UI Automation 定位光标；跟踪前台窗口、移动和失焦
 · 在会话当前目录中执行 generator 命令
 · 设置、日志、自动启动
              │ WebView2 消息（相当于 window.ipc）
              ▼
补全前端（TypeScript，运行在 WebView2 中）           ← 复用 aq 的 autocomplete-app、autocomplete-parser、shell-parser
 · 分词、spec 匹配、generator、过滤排序、列表 UI
 · 打包时固定 wf spec 的版本
```

与 Fig macOS 版的对应关系：

| Fig（macOS） | 本方案（Windows） | 改动程度 |
| --- | --- | --- |
| figterm 包装 PTY，加上 OSC 697 标记 | PSReadLine 适配模块 | 重写，但更简单 |
| 用 Unix socket 传 protobuf | 命名管道（可以沿用 protobuf 或改用 JSON） | 重写传输层 |
| fig_desktop（Rust、tao、wry） | C#/.NET 宿主加 WebView2 | 重写 |
| IMK 输入法和 AX API 定位光标 | UI Automation，失败时按单元格换算 | 重写，**风险最高** |
| React 补全前端 | 原样复用，增加一层转接代码 | 小改 |
| 前端通过宿主调用 `RunProcess` 执行 generator | 宿主直接在会话目录中启动进程 | 重写，需要处理 POSIX 命令 |

## 成本拆分

按一名熟悉 Windows 桌面开发的工程师估算，单位为人周，AI 辅助编码已计入。实际耗时取决于验证结果。

| 组件 | 内容 | 估算 | 风险 | 可复用 |
| --- | --- | --- | --- | --- |
| 适配模块 | 感知输入变化、按键路由、插入、会话标识、与 PSReadLine 预测灰字共存 | 1–2 | 中 | — |
| IPC | 命名管道服务端和客户端、消息格式、重连 | 0.5–1 | 低 | `aq:proto/` 的消息定义 |
| 光标定位 | UIA 定位、单元格换算后备、DPI、多显示器、窗格、滚动 | 2–4 | **高** | Fig 原型 `aq:crates/fig_desktop/src/platform/windows.rs` 的思路 |
| 悬浮窗 | 置顶且不激活、跟随移动、失焦隐藏、主题、WebView2 预热 | 1–2 | 中 | — |
| 前端移植 | 转接代码、实现约 15 种宿主接口、PowerShell 分词和转义 | 2–3 | 中 | `aq` 的前端、解析器 |
| generator | 在 Windows 上执行，处理超时、缓存，改写依赖 POSIX 命令的 spec | 1–3 | 中 | 取决于 T-015 的统计 |
| 安装与发布 | 安装和卸载（修改 profile）、自动启动、代码签名、winget 或 MSIX | 2–3 | 中 | — |
| 测试与兼容 | WT 和 PS 版本、DPI、多显示器、中文输入法、回归用例 | 2–3 | 中 | `specs/completion.md` |
| **合计** | | **MVP 约 8–12 周；完整版约 12–20 周** | | |

MVP 的范围：PowerShell 7 加 Windows Terminal，`git` spec 加文件路径，悬浮窗可以使用，规格用例全部通过。

其他费用：

- **代码签名证书**：不签名时，安装程序会触发 SmartScreen 警告。Azure Trusted Signing 约每月 10 美元，传统 OV 证书约每年数百美元。发布前再决定是否购买。
- **持续维护**：Windows Terminal 和 PSReadLine 升级后可能改变 UIA 或按键行为，需要保留回归测试；spec 也要定期同步。

与其他路线比较（同样是估算）：

| 路线 | MVP 工作量 | 体验 |
| --- | --- | --- |
| 基于 inshellisense | 1–2 周 | 菜单画在终端内，依赖 Node，generator 依赖 Git Bash |
| PowerShell 模块，终端内显示 | 4–6 周 | 菜单画在终端内，只支持 PowerShell |
| **Fig 式悬浮窗（已选）** | **8–12 周** | 最接近 Fig；以后加 cmd 或 Git Bash 时，需要再做 ConPTY 包装 |

## 验证关卡

全面开发之前，在真实的 Windows 机器上完成以下验证。每项都有明确的“通过 / 不通过”判定。

| 任务 | 验证内容 | 通过标准 | 不通过时 |
| --- | --- | --- | --- |
| T-019 | 在 WT 中定位光标：比较 UIA 与单元格换算两种方法 | 在 100%、150%、200% DPI，分屏窗格，滚动后，误差都不超过半个字符宽度；耗时小于 10 ms | 改为终端内显示；悬浮窗留到第 3 阶段 |
| T-020 | PSReadLine 适配：感知每次输入、按键路由、插入 | 每次按键的额外延迟小于 5 ms；粘贴、历史调出、中文输入都不出错；Tab、Enter 在窗口不可见时保持原有行为 | 改为只在 Tab 时触发补全 |
| T-021 | 悬浮窗：置顶、不抢焦点、跟随窗口 | 显示时不打断输入，WT 失焦后隐藏，移动或调整 WT 窗口时跟随 | 改用原生窗口（WPF）绘制 |
| T-022 | 在 WebView2 中运行 Fig 前端 | `git ch` 能列出候选；从收到缓冲区到列表显示小于 50 ms | 不复用 Fig 前端，改为自写引擎 |

T-019 风险最高，应该最先做。
