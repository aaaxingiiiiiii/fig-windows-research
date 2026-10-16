# inshellisense ↔ 悬浮窗宿主协议 v1

更新：2026-10-14 · T-042 · 协议标识 `figwin-overlay`，`v: 1`。

状态：供 T-043（Node 渲染器）和 T-044（C# 宿主）实现的契约，**尚未实现或在 Windows 验证**。依据 D-007、D-009 和 `mvp-plan.md`。归档的 `archive/protocol-psreadline-v0.md` 不适用。本页所有“必须/应”是本项目的设计约定（推断），不是对已有程序的观察。

## 1. 职责和源码落点

| 组件 | 唯一负责的状态/操作 | 不通过管道传递的能力 |
| --- | --- | --- |
| inshellisense（客户端） | 计算候选、过滤排序、分页和选择；读取影子终端；处理键盘、计算替换并写入 PTY；选择终端/悬浮渲染器 | 不接受宿主发来的插入、执行命令或按键请求 |
| C# 宿主（服务端） | 验证目标窗格；光标像素定位；原生窗口显示/隐藏；报告可见性和定位失败；debugState | 不解析命令行、不执行 generator、不改变候选顺序、不处理鼠标选择 |

**观察（固定上游源码）**：候选模型包含 name/description/type/insertValue，后者留在 Node 内（`is:src/runtime/model.ts#L6-L21`）；分页与选择在 `is:src/ui/suggestionManager.ts#L177-L198`；键处理及写入 PTY 在 `is:src/ui/suggestionManager.ts#L222-L269`；外层键处理使用 renderer.hasVisibleSuggestions（`is:src/ui/ui-root.ts#L81-L101`）；终端单元格来自 `is:src/isterm/pty.ts#L251-L260`。T-043 应暴露结构化显示快照，不从 ANSI 补丁反解析文字。当前工程对应文件位于 `src/inshellisense/`。

## 2. 传输与端点

- 服务端建立本机双向、异步、**字节模式**命名管道；每个连接一个客户端角色。允许多个连接，单个可见窗口由宿主按已确认的前台窗格仲裁。
- 端点由启动器/测试工具通过进程环境变量 `FIGWIN_OVERLAY_PIPE` 传给 Node，值为完整路径，例如 `\\.\pipe\figwin-overlay-v1-demo`。宿主以同一端点的名称部分创建管道。不扫描全部管道。
- 2026-10-16 补充（T-063，D-016）：没有设置 `FIGWIN_OVERLAY_PIPE` 时，只有在配置文件中 `[overlay] enabled = true`，并且有登录会话编号（环境变量 `FIGWIN_LOGON_SESSION`，由 PowerShell 初始化脚本设置）时，才使用下面的默认端点；否则维持终端渲染。连不上时，Node 在后台启动宿主（`--pipe <名称>`），每个会话最多一次；宿主用 `FirstPipeInstance` 保证同一个名称只有一个实例。
- 生产端点必须按当前用户和 Windows 登录会话隔离，命名为 `figwin-overlay-v1-<userKey>-<logonSession>`：userKey 是用户名转小写后 SHA-256 的前 16 个十六进制字符，logonSession 是 Windows 会话编号（T-063，两端实现：`src/inshellisense/src/overlay/launch.ts`、`FigWin.OverlayHost.Transport.OverlayEndpoint`，测试使用同一组数据）；userKey 不是认证凭据，不能用端点可猜测性替代权限。只接收本机连接；用同用户访问控制及同一提升级别。权限不符直接回退，不请求自动提权。
- **观察（官方文档）**：Node `net` 在 Windows 上支持命名管道；路径支持 `\\.\pipe\`。见 [Node 22 net IPC](https://nodejs.org/download/release/latest-v22.x/docs/api/net.html#ipc-support)。`.NET PipeOptions.CurrentUserOnly` 在 Windows 上检查用户和提升级别，见 [Microsoft PipeOptions](https://learn.microsoft.com/dotnet/api/system.io.pipes.pipeoptions)。本协议不把该选项当作窗格身份验证。
- 每条消息：一个 UTF-8 JSON 对象加 LF，无 BOM；字符串中的换行由 JSON 转义，接收方兼容 CRLF。必须按字节累计到换行再解码，支持中文字符跨读包、半包和多条合包；不是“一次 read 一条消息”。
- 单行最多 **65536 字节（不含 LF，含可能的 CR）**，无换行时也按此上限终止累积。JSON 嵌套深度最多 16。无效 UTF-8/JSON、重复键、缺字段、错误类型、越界数值、错误方向的消息均关闭连接并撤销本连接显示；能安全识别信封时可先发送 error。
- 所有整数必须非负、安全整数（≤ 9007199254740991）；pid、rows、cols、seq 为正整数。字符串须是有效 Unicode，无未配对代理项。已知消息可忽略未知附加字段；未知消息类型或版本报错并关闭，防止静默解释成另一种操作。

## 3. 信封、身份与顺序

每条消息都有以下字段，后续表格只列额外字段：

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `protocol` | string | 固定 `figwin-overlay` |
| `v` | integer | 固定 1；只支持完全匹配，不降级到旧 v0 |
| `t` | string | 消息类型 |
| `session` | string | Node 包装 shell 生命周期的随机 UUID；debug 客户端也生成自己的 UUID |
| `connection` | string | 每次连接重新生成的 UUID；旧连接的异步回调必须丢弃 |
| `seq` | integer | **每个方向各自**从 1 递增；允许跳号，不允许相等或倒退 |

session/connection 使用小写标准 UUID 文本。session 不从 PID 或 WT_SESSION 派生。宿主在 hello 中锁定这对身份，后续不得更换；响应回显同一对身份。身份不是秘密，OS 管道权限仍然必要。PID 可复用，不能单独作身份键。

宿主收到新连接使用相同渲染 session 时，先隐藏并关闭旧连接，再接纳新连接。每条 show/hide 是完整状态，`forSeq` 引用客户端的 show/hide 序号；不使用增量候选更新。UI 线程实际应用前再次检查连接、最新状态序号、目标窗格及可见条件，过期 show 不得覆盖后来的 hide。

发送端允许合并**尚未写入流**的连续 show，保留最新一条；hide 必须撤销此前待发送 show。写入发生背压时最多保留一个待发送快照，控制消息按序排队；总排队字节上限 131072，超出即断开并回退，不阻塞键盘/PTY 线程。接收端同样只保留最新待绘制状态。

## 4. 握手与消息表

客户端连接后 250 ms 内发送 hello；服务端从接受连接起 500 ms 内完成 welcome，否则客户端终止本次尝试。握手完成前只有 hello/welcome/error 合法。这些时间是初始工程预算，实测调整必须记录版本变更。

| 方向 | t | 额外必需字段 | 语义 |
| --- | --- | --- | --- |
| 客→宿 | `hello` | `role: "renderer" 或 "debug"`，`pid`；renderer 另有 `terminal: {kind: "windows-terminal", wtSession: string 或 null}` | pid 是客户端自身进程，不是 pwsh PID；wtSession 只是关联线索（最多 128 字符） |
| 宿→客 | `welcome` | `hostInstance`（宿主启动时生成的 UUID），`heartbeatMs: 200`，`leaseMs: 600` | 成功协商；**不表示已找到窗格或已显示** |
| 客→宿 | `show` | 第 5 节完整显示快照 | 仅 renderer；清空终端旧补丁后发送 |
| 客→宿 | `hide` | `reason` | 仅 renderer；立即撤销待绘制/当前快照；reason 为 `empty`、`dismiss`、`accept`、`command`、`alternate-buffer`、`resize`、`fallback`、`shutdown` 之一 |
| 宿→客 | `status` | `forSeq`，`state`，`reason`，`caretSource` | 仅 renderer；状态变化或 show/hide 应用后回复，字段见第 6 节 |
| 客→宿 | `ping` | 无 | 两个角色都可发送；每 200 ms 一次，独立于键盘事件 |
| 宿→客 | `pong` | `forSeq`（ping 的 seq） | 连通性应答，不代表可见；不改变候选状态 |
| 客→宿 | `bye` | 无 | 撤销状态后关闭连接；异常 EOF 与 bye 同样清理 |
| 客→宿 | `debugState` | `requestId`、`targetSession` | 仅 debug；requestId 为 1–64 字符，仅字母数字、`-`、`_`；targetSession 为 UUID |
| 宿→客 | `debugStateResult` | 同一 `requestId`、`targetSession`，`found`，`state` | 仅 debug；见第 8 节；找不到目标时 found=false、state=null |
| 宿→客 | `error` | `code` | `unsupported-version`、`invalid-message`、`wrong-role`、`resource-limit`、`internal-error`；发送后关闭，不把异常堆栈或用户内容传出 |

debug 连接也要 hello/welcome/ping，但不能调用 show/hide。renderer 不可用 debugState 切换自己的角色。角色是协议隔离，不是防御同用户恶意进程的权限边界。

## 5. show：完整显示快照

| 字段 | 类型/范围 | 解释 |
| --- | --- | --- |
| `candidates` | array，0–20 项 | 当前页；每项 `{name, description, type}`；三个字段必需，description 可为 null |
| `name` | string，1–512 Unicode 标量值 | 显示名称；Node 保留真实插入值，可截断显示但不得改变本地接受补全的内容 |
| `description` | string 或 null，最多 2048 标量值 | 纯文本，可含已转义换行；不含 ANSI、HTML、图标 URL |
| `type` | enum | `file`、`folder`、`option`、`argument`、`subcommand`、`shortcut`、`other`；未知 Fig 类型映射为 other |
| `selectedIndex` | integer 或 null | **当前页内的零基下标**；非空 candidates 必须选中其中一项；空数组必须为 null |
| `pageStart` | integer | 当前页在 Node 完整过滤后列表中的起始下标 |
| `totalCount` | integer | 完整过滤后列表总数；pageStart + candidates.length ≤ totalCount |
| `argumentDescription` | string 或 null，最多 2048 标量值 | 没有候选时的参数帮助；不是插入内容 |
| `cursor` | `{row, col}` | 零基、相对当前可见的**终端内容网格**，单位是单元格；不是 UTF-16、字符数、像素或带 scrollback 的绝对行 |
| `terminal` | `{rows, cols, buffer, cursorVisible}` | rows/cols 为 1–4096；buffer 固定 `normal`，cursorVisible 必须为 true |

约束：`0 ≤ row < rows`、`0 ≤ col < cols`。遇到换行待决状态、光标不可见、备用缓冲区或无法确定合法单元格时发 hide，不猜坐标、不简单对 col 取模。中文宽字符占多个单元格，由影子终端决定，不按字符串长度计算。窗口 resize 后发送新尺寸和新坐标的完整快照，不能沿用旧网格。

无候选且无 argumentDescription 时必须 hide；仅参数帮助允许 show，此时 candidates=[]、selectedIndex=null、pageStart=totalCount=0，**不拦截接受/选择候选的按键**。分页由 Node 决定，宿主不得排序或截掉选中项；20 是线协议上限，不强制产品显示 20 行。Node 应选取包含当前全局选中项的一页，翻页也发完整 show；全局下标等于 pageStart + selectedIndex。

Node 在发送前去除显示文字中的终端控制序列和控制字符（说明允许 LF/TAB）；宿主也作为纯文本渲染。超出字符/字节上限时 Node 先截短显示说明、再名称，均按 Unicode 边界；仍超限则 hide/fallback。协议不传完整命令行、cwd、环境变量、insertValue、按键或执行指令。

## 6. 状态、定位与渲染器切换

status.state 为 `shown`、`hidden`、`suppressed`、`failed`。reason 固定取值：

| state | reason | 宿主动作 / 客户端动作 |
| --- | --- | --- |
| shown | `ok` | 最新 show 已经在正确窗格实际显示；caretSource 为 uia 或 cells |
| hidden | hide 中的 reason，或 `lease-expired` | 已撤销当前和待绘制快照；caretSource=none；不能拦截候选按键 |
| suppressed | `inactive`、`minimized`、`pane-changed` | 隐藏且丢弃显示快照；客户端不再向此连接发 show，保留终端渲染路径 |
| failed | `binding-unavailable`、`position-unavailable`、`render-failed` | 隐藏且丢弃显示快照；客户端转入回退 |

`forSeq` 是宿主最近接受的 show/hide 的序号，无该类消息时为 0；宿主主动报告失焦等变化时仍用这个序号。宿主不得在恢复焦点后自行重放旧 show。客户端只能用**当前连接、最新目标 show 的 shown 应答**确认可见；旧 shown 必须忽略。当前连接的新 hidden/suppressed/failed 即使引用的是较早已应用帧，也立即撤销可见标志，不能因当前还有在途帧而忽略失焦。

宿主绑定规则：

1. hello 的 pid、wtSession 仅辅助关联。只有验证此连接对应的 WT 顶层窗口及其具体内容窗格、且该窗格处于前台输入状态，才允许 shown。多个连接竞争同一窗格而无法消歧时全部隐藏并报 binding-unavailable，不能用“最后发消息的连接”猜测焦点。
2. UIA 优先；后备用**当前窗格内容区**的物理像素边界和当前单元格尺寸换算。不得使用整个 WT 外框（包含标题/标签栏）；不能只由 rows/cols 和顶层窗口推断分屏位置。
3. 单元格后备基准：`x = contentLeft + col * cellWidth`，`y = contentTop + row * cellHeight`；所有量为物理像素，边界允许负坐标（左侧/上方显示器）。由宿主处理 DPI、工作区裁剪和上下翻转。缺有效字体度量、网格或窗格映射即 position-unavailable。
4. 前台窗口、窗格、最小化、滚动、DPI 或几何变化时重新验证。滚动离开实时输入行、备用缓冲区、无法确认光标时立即隐藏。移动后可以在仍有效快照/租期内重新定位；失焦、窗格切换后则必须等待新的 show。

**未知**：固定上游提供单元格，但没有提供“Node 会话可靠绑定 UIA 窗格”的实现。T-019/T-044 必须验证这一点；协议不会补出不存在的 WT pane ID。验证失败时按 D-007 保留终端版，不声称多窗格已通过。

客户端状态转换：

- 启动/连接失败：终端渲染器照常工作。收到 welcome 后只说明管道可用。
- 尝试悬浮：清除当前终端候选补丁，设可见标志 false，再发送 show；100 ms 内收到对应 shown 才进入 overlay-visible。该等待是异步的，键盘输入继续转发 PTY，不能阻塞等待或在稍后重放按键。
- 本地命令、cwd、光标或活动 token 改变使替换范围失效时，立即撤销旧快照的接受权限，等待新候选和对应 shown；宿主仍显示旧文字也不能接受旧结果。
- overlay-visible 中选择/候选变化：更新 Node 状态并发完整 show；收到匹配 shown 前不允许接受尚未确认的新选中项。失焦、取消、命令执行、alternate buffer 立即撤销可见标志并发送 hide。
- hide/定位失败：宿主先隐藏，再发送状态。客户端确认 hidden/failed 后才重新绘制终端候选；只对当前仍合法的本地命令状态绘制，不能恢复已被 Esc/Enter 清除的旧候选。
- show 应答超时或连接断开：停止发送并关闭连接，恢复终端渲染。宿主在 EOF 时隐藏；同时有下节租期防止孤儿窗口。网络/调度故障时可能有短暂旧窗口残留，不能保证两个进程原子切换；这段期间不拦截旧候选的接受键。
- 重试间隔为 1 s、2 s、5 s，之后保持 5 s；成功显示后复位。suppressed/failed 后关闭本连接再按此节重试，生成新 connection；只发送当前最新状态，不回放队列。

## 7. 活性、租期与延迟

客户端每 200 ms 发 ping；600 ms 未收到有效宿主消息则关闭并回退。宿主从最近一条有效 renderer 消息起 600 ms 没有收到新消息时隐藏、清除会话并关闭连接；debug 活动不能续租 renderer。只有当前连接内顺序正确的合法消息可以续租。ping 仅保持一个**仍然通过焦点/定位检查**的显示，不复活已隐藏状态。

宿主必须让 hide、失焦处理和租期计时不被耗时 UIA 查询阻塞；UIA 工作结果回来时重新检查最新 seq/连接和显示条件。失联应在检测到 EOF 后立即隐藏；没有 EOF 时在租期届满后隐藏。**未知**：若宿主 UI 线程/进程完全挂起，定时器也可能无法隐藏，必须在 T-044/T-045 用故障注入验证并记录残留；本协议不承诺硬实时或零帧重叠。

性能测量在宿主自己的单调时钟上进行：从完整 show 解码完成到窗口更新为 `receiveToDisplayMs`；定位为 `locateMs`。不同进程的时钟不相减。T-044 目标为前者 <30 ms；T-019 定位 p95 <15 ms、位置误差不超过半个字符宽度，按 `overlay-design.md` 验收。100 ms 的应答超时是故障回退预算，不是性能达标阈值。

## 8. debugState：只读验证

通过单独的 debug 连接请求。state 在 found=true 时为以下完整对象：

| 字段 | 类型/含义 |
| --- | --- |
| hostInstance | UUID，供识别宿主重启 |
| connection | 被查询 renderer 的 connection UUID |
| lastReceivedSeq / lastAppliedSeq | 最近合法 renderer 消息序号 / 最近实际应用的 show/hide 序号；尚无时为 0 |
| visible / foreground | boolean；后者表示目标窗格已确认为当前输入窗格 |
| binding | `verified` 或 `unavailable` |
| state / reason | 最近 status 的状态与原因；无状态时 hidden/shutdown |
| candidateCount / totalCount / pageStart / selectedIndex | 最近应用页的信息；隐藏后分别为 0、0、0、null |
| cursor / terminal | 最近应用 show 的 cursor/terminal；隐藏后均为 null |
| caretSource | uia、cells、none |
| caretRect / overlayRect | `{x,y,width,height}`，有限数值、物理像素；width/height >0；隐藏时为 null |
| locateMs / receiveToDisplayMs | 非负有限毫秒数；未测量时为 null，不伪填 0 |

宿主一次性复制状态后响应，不能拼接不同时刻的字段。默认不返回候选文本、命令行、路径或凭据；L2 用候选数量/选中下标、fixture 中的实际 PTY 插入结果和截图共同验证内容。图像/原始日志保存到 local/evidence 并按项目规则登记。debugState 不证明键盘仍在 WT，也不证明屏幕测量误差达标，仍需 L3。

## 9. 可解析的消息示例

以下按两个方向展示一个 renderer 会话；每行是真实 JSON 行，数值仅为 fixture。先握手，show 第 3 行的 `git ch` 候选，然后 hide；JSON 字符串中的 `\n` 不分割消息。

```jsonl
{"protocol":"figwin-overlay","v":1,"t":"hello","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":1,"role":"renderer","pid":1234,"terminal":{"kind":"windows-terminal","wtSession":null}}
{"protocol":"figwin-overlay","v":1,"t":"welcome","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":1,"hostInstance":"33333333-3333-4333-8333-333333333333","heartbeatMs":200,"leaseMs":600}
{"protocol":"figwin-overlay","v":1,"t":"show","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":2,"candidates":[{"name":"checkout","description":"切换分支\n或恢复文件","type":"subcommand"},{"name":"cherry-pick","description":"应用提交","type":"subcommand"}],"selectedIndex":0,"pageStart":0,"totalCount":2,"argumentDescription":null,"cursor":{"row":2,"col":6},"terminal":{"rows":30,"cols":120,"buffer":"normal","cursorVisible":true}}
{"protocol":"figwin-overlay","v":1,"t":"status","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":2,"forSeq":2,"state":"shown","reason":"ok","caretSource":"uia"}
{"protocol":"figwin-overlay","v":1,"t":"hide","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":3,"reason":"dismiss"}
{"protocol":"figwin-overlay","v":1,"t":"status","session":"11111111-1111-4111-8111-111111111111","connection":"22222222-2222-4222-8222-222222222222","seq":3,"forSeq":3,"state":"hidden","reason":"dismiss","caretSource":"none"}
```

## 10. 实现验收用例

这些是 T-043/T-044 必须实现的测试，不是 T-042 已运行的集成测试。

| 编号 | 输入/故障 | 期望 |
| --- | --- | --- |
| P-01 | UTF-8 中文字节拆包；两行合包；转义换行；CRLF | 恰好解析原消息，不截断字符或多生成一条消息 |
| P-02 | 超长无 LF、重复键、v=0、非法 selectedIndex、col=cols | 撤销本连接状态并关闭；PTY 不受影响 |
| P-03 | show 2 的 UIA 延迟，随后 hide 3 | 不得在 hide 后应用 show 2；debug lastAppliedSeq=3 |
| P-04 | 旧 connection 的 shown 到达；新连接已建立 | 忽略旧事件，不能重新启用旧选择的按键拦截 |
| P-05 | 两个 WT 窗格分别发送 show、焦点切换或不能消歧 | 只对已验证的前台窗格显示；不能验证时全部回退 |
| P-06 | selectedIndex 更新、翻页、仅参数帮助 | 下标按页解释；Node 接受值与确认页相同；仅帮助不拦截候选接受键 |
| P-07 | 宿主不存在、定位失败、shown 应答延迟 >100 ms | 不阻塞/重放输入；关闭连接并恢复当前合法终端候选 |
| P-08 | Node 被杀、宿主被杀、宿主 UIA 卡住、租期不续 | EOF/超时清理；注入完全挂起时记录窗口残留，不伪报通过 |
| P-09 | resize、alternate buffer、Ctrl+C/Enter/Esc | 清除悬浮与待显示快照；无全屏程序覆盖；不恢复过期候选 |
| P-10 | 双屏负坐标、100/150/200% DPI、分屏、滚动 | 当前内容区/光标定位，按半字符和耗时标准验证 |
| P-11 | debug 连接尝试 show；不同用户/提升级别；缺端点变量 | 角色/访问拒绝或终端回退；不自动提权 |
| P-12 | show 背压、过期异步回调、宿主重启 | 队列有界，最新 hide 优先于旧待发 show；新连接重新握手，不恢复旧帧 |

T-042 仅完成契约、JSON 示例和引用检查；T-043 可在 Mac 用假服务端/字节流完成 L1；Windows 命名管道、窗格绑定与悬浮效果由 T-019/T-021/T-044/T-045 实测。后续修改先记入 decisions.md，再升级 v 和端点版本；T-043 与 T-044 必须同时更新，不能单边改变字段意义。
