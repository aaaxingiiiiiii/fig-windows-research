# 模块间协议（版本 0，草案）

> **已存档（2026-10-14）**：本文是“PSReadLine 适配模块 + Fig 前端 + WebView2”路线的模块间协议。D-007 已把路线改为“先基于 inshellisense 做终端内版本，再加悬浮窗”，当前计划见 `docs/mvp-plan.md`。如果将来 inshellisense 路线受阻，可以回到本方案；其中的调研结论仍然有效。

状态：草案，由 T-025 定稿为版本 1。修改规则见 `docs/mvp-plan.md` 第 7 节。

三个模块：适配模块（PowerShell，在每个 pwsh 进程中运行）、宿主（C#，每个用户一个进程）、前端（TypeScript，运行在宿主的 WebView2 中）。

## 1. 通用约定

- 编码为 UTF-8。每条消息是一个 JSON 对象，`t` 字段表示消息类型。
- **光标和偏移量一律按 UTF-16 码元计数**。PSReadLine 的 `GetBufferState` 和 JavaScript 字符串都使用这个单位，Fig 前端也按 UTF-16 处理（`aq:crates/fig_desktop/src/remote_ipc/mod.rs#L94-L97`）。
- `session` 是适配模块启动时生成的字符串：`<pid>-<随机数>`。如果环境变量 `WT_SESSION` 存在，一并上报，供宿主调试。
- 时间单位为毫秒，`seq` 和 `id` 都是递增整数。

## 2. 适配模块 ↔ 宿主：命名管道

- 管道名：`\\.\pipe\figwin-<当前用户名>`。宿主创建管道时设置访问控制，只允许当前用户连接。
- 格式：每行一条 JSON（JSON Lines）。
- **只有适配模块主动发送消息**；宿主只回复 `key` 请求。因此适配模块不需要后台读线程。

### 适配模块 → 宿主

| `t` | 何时发送 | 字段 | 宿主是否回复 |
| --- | --- | --- | --- |
| `hello` | 模块加载后 | `v`（协议版本）、`session`、`pid`、`psVersion`、`psReadLineVersion`、`wtSession` | 否 |
| `prompt` | 每次显示提示符时（包装 `prompt` 函数） | `session`、`cwd`（文件系统路径；不在文件系统时为 `null`） | 否；宿主隐藏悬浮窗 |
| `buffer` | 可打印字符或编辑键处理完成后；如果 `[Console]::KeyAvailable` 为真，说明还有输入待处理，跳过发送 | `session`、`seq`、`text`、`cursor`、`row`、`col`（`[Console]::CursorTop/Left`，作为光标定位的后备）、`cwd` | 否 |
| `key` | 按下 Tab、Shift+Tab、Enter、Up、Down、Escape 时 | `session`、`id`、`key`（取值：`Tab`、`ShiftTab`、`Enter`、`Up`、`Down`、`Escape`）、`text`、`cursor` | **是**，见下表 |
| `accept` | 命令被提交执行之前（`AcceptLine` 前） | `session` | 否；宿主隐藏悬浮窗 |
| `bye` | 模块卸载或 pwsh 退出时 | `session` | 否 |

### 宿主 → 适配模块：`keyResult`

```json
{"t":"keyResult","id":12,"consumed":true,
 "edit":{"deleteBefore":2,"insert":"checkout ","cursorBack":0,"execute":false}}
```

| 字段 | 说明 |
| --- | --- |
| `consumed` | `false` 时，适配模块调用该键在模块加载前绑定的函数（加载时用 `Get-PSReadLineKeyHandler` 记录）。Windows 模式的默认值为：Tab → `TabCompleteNext`，Shift+Tab → `TabCompletePrevious`，Enter → `AcceptLine`，Up → `PreviousHistory`，Down → `NextHistory`，Escape → `RevertLine`。如果原来绑定的是用户自定义的脚本块，能否调用尚未验证（T-020） |
| `edit` | 可以省略，表示没有插入（例如只是在列表中移动）。适配模块的处理步骤：<br>`start = cursor - deleteBefore`<br>`Replace(start, deleteBefore, insert)`<br>`SetCursorPosition(start + insert.Length - cursorBack)`<br>`execute` 为真时，再调用 `AcceptLine` |

规则：

1. 宿主在以下情况下直接回复 `consumed:false`，不经过前端：悬浮窗不可见，或者前端没有开启按键拦截。
2. 如果 `key` 中的 `text` 和 `cursor` 与宿主最后收到的 `buffer` 不一致（说明有更新没送到，例如输入法提交的中文），宿主回复 `consumed:true` 且不带 `edit`，同时把新缓冲区推送给前端刷新。用户需要再按一次。这样可以避免把补全插到错误的位置。
3. 适配模块等待 `keyResult` 的时间上限是 50 ms。超时后按 `consumed:false` 处理；连续超时 3 次后，认为宿主离线，停止发送消息，直到下一个提示符时再尝试连接。
4. 适配模块的所有处理器都必须捕获异常。出错时回退到 PSReadLine 原有的行为，绝不能让 PSReadLine 打印错误。

## 3. 宿主 ↔ 前端：WebView2 消息

前端通过 `window.chrome.webview.postMessage(JSON)` 发送消息，宿主通过 `PostWebMessageAsJson` 回传。`bridge` 包把这些消息包装成 Fig 前端原有的函数接口（F-019）。

### 宿主 → 前端

| `t` | 对应的 Fig 接口 | 字段 |
| --- | --- | --- |
| `editBuffer` | `EditBufferNotifications.subscribe` | `text`、`cursor`、`context`：`{sessionId, cwd, shell: "pwsh", processUserPid}` |
| `key` | `Keybindings.pressed` | `id`、`action`（Fig 动作名：`insertSelected`、`insertCommonPrefix`、`navigateUp`、`navigateDown`、`hideAutocomplete`） |
| `settings` | `Settings.current` / `Settings.didChange` | `values`：设置键值对 |
| `runResult` | `Process.run` 的返回值 | `reqId`、`stdout`、`stderr`、`exitCode` |
| `fileResult` | `fs.read` 的返回值 | `reqId`、`content`；文件不存在时为 `null` |

按键到动作的对应关系使用 Fig 的默认值（`aq:packages/autocomplete-app/src/fig.json`）：Enter → `insertSelected`，Tab → `insertCommonPrefix`，Shift+Tab 和 Up → `navigateUp`，Down → `navigateDown`，Escape → `hideAutocomplete`。

### 前端 → 宿主

| `t` | 对应的 Fig 接口 | 字段与宿主的处理 |
| --- | --- | --- |
| `insert` | `Shell.insert` | `text`，即 Fig 的插入串：`"\b"×n + 文本 + "\x1b[D"×k`，文本末尾可能带 `\n`。宿主把它换算成 `edit`：`deleteBefore=n`，`cursorBack=k`，`execute` 取决于文本末尾是否有 `\n`，`insert` 是去掉 `\n` 后的文本 |
| `keyDone` | 无（桥接层新增） | `id`。前端处理完一个 `key` 后发送，宿主据此回复适配模块。如果处理期间有 `insert`，就把它作为 `edit` 一并返回 |
| `frame` | `WindowPosition.setFrame` | `width`、`height`、`anchorX`、`offsetFromBaseline`。宽或高为 1 表示隐藏（Fig 的约定）。宿主把窗口放在光标下方，空间不够时放到上方 |
| `intercept` | `Keybindings.setInterceptKeystrokes` | `enabled`。决定规则 1 中“前端是否开启了按键拦截” |
| `run` | `Process.run` / `executeCommand` | `reqId`、`exe`、`args`、`cwd`、`env`、`timeoutMs`（默认 5000）。`exe` 为 `ls` 且参数为 `-1ApL` 时，由宿主模拟：每行一个条目，文件夹末尾加 `/`，包含隐藏文件 |
| `readFile` | `fs.read` | `reqId`、`path` |
| `log` | 无 | `level`、`message`；写入宿主日志 |

下列接口在 MVP 中不需要实现，`bridge` 返回空结果：`History.query`、`State.watch`、`Event.subscribe`、`Telemetry.track`、`Settings.set`、`fs.append`。

## 4. 调试接口

为了让 AI 不看屏幕也能验证结果，宿主在同一个管道上额外支持：

- 请求：`{"t":"debugState"}`
- 回复：`{"t":"debugStateResult", ...}`，包含以下字段：

| 字段 | 内容 |
| --- | --- |
| `visible` | 悬浮窗是否可见 |
| `intercept` | 前端是否开启了按键拦截 |
| `overlayRect` | 悬浮窗的屏幕矩形（物理像素） |
| `caretRect` | 光标矩形（物理像素） |
| `caretSource` | 光标位置的来源：`uia`、`fallback` 或 `none` |
| `lastBuffer` | 最后收到的 `{text, cursor, seq}` |
| `suggestions` | 前端当前显示的前 20 个候选的名称 |
| `selectedIndex` | 当前选中项的序号 |
| `timings` | 最近一次的耗时：从收到缓冲区到前端渲染完成，以及光标定位 |

`suggestions`、`selectedIndex` 和 `timings` 由前端经 `bridge` 定期上报给宿主（消息类型 `t:"state"`）。
