# 在 Windows Terminal 中定位光标的屏幕坐标（T-019 前期调研）

更新：2026-10-14。依据是 microsoft/terminal main 分支源码（2026-10）、微软官方文档和公开 issue。**这些内容都没有在 Windows 上实际运行验证过**；正式发布的 WT 版本可能落后于 main 分支。需要上机验证的项目见第 6 节，测量方法见 `docs/windows-setup.md`。

## 结论

- 首选 **UI Automation**：
  1. 用 `TextPattern.GetSelection()` 取得光标处的空区间；
  2. 克隆后调用 `ExpandToEnclosingUnit(Character)`；
  3. 调用 `GetBoundingRectangles()`。

  WT 源码完整支持这条路线，Fig 的 Windows 原型用的也是它（`aq:crates/fig_desktop/src/platform/windows.rs#L177-L217`）。
- **后备方案**：适配模块报告光标的行列号，再结合 UIA 给出的控件边界和单元格尺寸自行换算。有选区、矩形为空或 UIA 超时时使用，也可以用来与首选方案交叉核对。
- 不建议使用：`GetGUIThreadInfo` 和 MSAA（在 WT 中拿不到光标）、自己编写 TSF 输入法、向 WT 注入代码、CSI 16t、`GetCurrentConsoleFontEx`。
- 风险从“未知”降为“**中高**”：方法已经明确，主要不确定性在于高 DPI 下可能存在的偏移、跨进程调用的延迟，以及窗格切换时焦点事件是否可靠。

## 1. WT 的 UIA 实现（观察，读源码）

- TermControl 只实现了 TextPattern，没有 TextPattern2，因此不能用 `GetCaretRange`。来源：[ScreenInfoUiaProviderBase.cpp](https://github.com/microsoft/terminal/blob/main/src/types/ScreenInfoUiaProviderBase.cpp)、[TermControlAutomationPeer.h](https://github.com/microsoft/terminal/blob/main/src/cascadia/TerminalControl/TermControlAutomationPeer.h)。
- 控件的 `ClassName` 固定为 `"TermControl"`，源码注释说明为兼容 JAWS 不得修改；本地化的控件类型名则随系统语言变化。所以识别终端控件应当用 ClassName。Fig 原型比较的是本地化字符串 `"terminal"`，在非英文系统上会失效（推断）。来源：[TermControlAutomationPeer.cpp](https://github.com/microsoft/terminal/blob/main/src/cascadia/TerminalControl/TermControlAutomationPeer.cpp)。
- `GetSelection()` 在没有选区时返回光标处的空区间。**用户用鼠标选中文字时，返回的是选区，不是光标。**
- 对空区间调用 `GetBoundingRectangles()` 返回空数组；区间在视口之外时也返回空。因此必须先扩展到一个字符。WT 把文档末尾定义为“光标下一行的行首”，所以光标在行尾时扩展也不会移到前一个字符。来源：[UiaTextRangeBase.cpp](https://github.com/microsoft/terminal/blob/main/src/types/UiaTextRangeBase.cpp)。
- 矩形的计算方式是“行列号 × 字体像素尺寸 + 内容原点”，其中内容原点等于控件边界加上 padding。来源：[TermControlUiaTextRange.cpp](https://github.com/microsoft/terminal/blob/main/src/types/TermControlUiaTextRange.cpp)、[TermControlUiaProvider.cpp](https://github.com/microsoft/terminal/blob/main/src/types/TermControlUiaProvider.cpp)。
- **可能的偏移（推断）**：UIA 路径中的 padding 取自 `SwapChainPanel().Margin()`，单位是 DIP，没有乘缩放比例；而 WT 自己的 TSF 代码乘了缩放比例。如果推断成立，默认 padding 为 8 时，150% 缩放下会偏约 4 px，200% 下偏约 8 px。来源：[TermControl.cpp](https://github.com/microsoft/terminal/blob/main/src/cascadia/TerminalControl/TermControl.cpp)。
- 光标移动时，WT 会发出 `TextSelectionChanged` 事件，可以用来做事件驱动的刷新。
- 相关 issue：[#2551](https://github.com/microsoft/terminal/issues/2551)（非 100% 缩放时矩形错位，已修复）、[#5385](https://github.com/microsoft/terminal/pull/5385)（坐标系错误，已修复）、[#12210](https://github.com/microsoft/terminal/pull/12210)（放大镜跟随光标，1.13 版修复）、[#7000](https://github.com/microsoft/terminal/issues/7000)（UIA 改进总帖，仍未关闭）。NVDA 在 WT 上也使用 UIA，并把光标更新的等待时间放大了 3 倍（[winConsoleUIA.py](https://github.com/nvaccess/nvda/blob/master/source/NVDAObjects/UIA/winConsoleUIA.py)）。
- 宿主进程必须开启 Per-Monitor DPI 感知，因为 UIA 只使用物理坐标（[文档](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-screenscaling)）。

## 2. 旧方法：GetGUIThreadInfo 与 MSAA

- WT：拿不到光标。参见 Raymond Chen 的文章 [The Old New Thing, 2026-01-08](https://devblogs.microsoft.com/oldnewthing/20260108-00/?p=111973) 和 [#6805](https://github.com/microsoft/terminal/issues/6805)。
- conhost：可用。conhost 会设置系统光标信息，`GetGUIThreadInfo` 的 `rcCaret` 和 `OBJID_CARET` 事件都有效；新版会把事件合并，延迟约 100 ms 后发出（[AccessibilityNotifier.cpp](https://github.com/microsoft/terminal/blob/main/src/host/AccessibilityNotifier.cpp)、[#19344](https://github.com/microsoft/terminal/pull/19344)）。

## 3. 输入法（TSF）路线：不采用

- WT 的 `ITfContextOwner::GetTextExt` 返回光标矩形，但这个值本身也出过错：窗口最大化或位于副屏时偏移，2026-09 才修复（[#20318](https://github.com/microsoft/terminal/issues/20318)、[#20627](https://github.com/microsoft/terminal/pull/20627)）。
- 外部进程要拿到这个值，有两种做法：
  - 自己编写 TSF 输入法（相当于 Fig 在 macOS 上的输入法做法）。但 TSF 只加载用户当前选中的输入法，会与中文输入法冲突。
  - 向 WT 注入代码，例如 [GetCaretPosEx](https://github.com/Tebayaki/AutoHotkeyScripts/tree/main/lib/GetCaretPosEx)。容易被安全软件拦截，对以管理员身份运行的 WT 也无效（推断）。

  两种都不适合产品化。

## 4. 自行换算（后备方案）

- 不可用的数据源：CSI 14t/16t 返回的是固定的 10×20 虚拟单元尺寸（[#17504](https://github.com/microsoft/terminal/pull/17504)）；`GetCurrentConsoleFontEx` 在 ConPTY 下反映不了 WT 的实际字体（推断）。从 settings.json 读取字号和 padding 再反推像素，会受字体缩放、DPI、字体回退和 profile 覆盖影响，很脆弱（推断）。
- 可行的换算公式（推断，与 WT 内部 TSF 的算法一致）：

  ```text
  光标像素 = TermControl 的 UIA 边界原点 + padding × 缩放比例 + (列, 行) × 单元格尺寸
  ```

  - 单元格尺寸：取任意一个非空、单字符区间的 UIA 矩形宽高。
  - 行列号：由适配模块通过 `[Console]::CursorLeft/Top` 提供。ConPTY 的缓冲区大小等于视口（推断，参见 [#1860 维护者评论](https://github.com/microsoft/terminal/issues/1860#issuecomment-509311231)）。用户向上翻看历史时会不准，但 WT 默认在输入时滚回底部（`snapOnInput`）。

## 5. 焦点与可见性

- 用 `EVENT_SYSTEM_FOREGROUND` 跟踪前台窗口，对 WT 进程监听 `EVENT_OBJECT_LOCATIONCHANGE`。WT 顶层窗口的类名是 `CASCADIA_HOSTING_WINDOW_CLASS`（[IslandWindow.cpp](https://github.com/microsoft/terminal/blob/main/src/cascadia/WindowsTerminal/IslandWindow.cpp)）。
- 切换窗格或标签页时，推断会触发 UIA 的 FocusChanged 事件，焦点落到对应的 TermControl 上；按 ClassName 匹配并缓存这个元素。

## 6. 需要上机验证

| 项目 | 说明 |
| --- | --- |
| DPI 偏移 | padding 的偏移是否真实存在；XAML Island 的 UIA 边界是否为物理像素 |
| 延迟 | 跨进程 UIA 调用的耗时 p50 和 p95；终端大量输出时是否卡顿 |
| 焦点 | 切换窗格和标签页时 FocusChanged 是否可靠 |
| 行列号 | ConPTY 报告的行列号与 WT 视口是否始终一致，特别是窗口缩放导致重新换行之后 |
| 权限 | WT 以管理员身份运行时，UIPI 是否阻止 UIA（推断会） |
| 进程 | 多个 WT 窗口是否共用一个进程 |
| 状态 | 向上翻看、有鼠标选区、输入法组字时的表现 |
| 版本 | 正式版与 main 分支的差异 |
