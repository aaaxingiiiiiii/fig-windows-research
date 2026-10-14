# Fig 补全链路（开源基线 `aq@b654a1b`）

更新：2026-10-14（T-003）。本页描述 Fig 开源代码中的终端补全链路，所有内容都是读源码得到的观察；标注“推断”的除外。它是否与 Kiro 2.30.0 的运行时行为一致，还需要按 `specs/completion.md` 逐项验证（F-005）。

缩写：`APP` = `aq:packages/autocomplete-app/src`，`PAR` = `aq:packages/autocomplete-parser/src`，`SH` = `aq:packages/shell-parser/src`，`CR` = `aq:crates`。

## 组件

```text
 用户按键
    │
    ▼
┌──────────┐  原始字节   ┌──────────┐
│ figterm  │ ──────────► │ 真实 shell│   figterm 用 PTY 包装 shell，
│(kiro-cli-│ ◄────────── │ zsh/bash │   shell 的 rc 脚本在每个提示符处输出 OSC 697
│  term)   │  输出+OSC   └──────────┘
└────┬─────┘
     │ protobuf over Unix socket（remote.sock）
     ▼
┌──────────────┐   事件（base64 protobuf）   ┌────────────────────┐
│ fig_desktop  │ ─────────────────────────► │ 补全前端（React，    │
│(kiro_cli_    │ ◄───────────────────────── │ 运行在 webview 中）   │
│ desktop)     │   请求：插入、定位窗口、     │ 解析、spec、排序      │
└──────┬───────┘   拦截按键                  └────────────────────┘
       │ 光标坐标
┌──────┴───────┐
│ 输入法 / 辅助 │  macOS：IMK 输入法或 AX API
│ 功能 API      │
└──────────────┘
```

## 步骤

**0. 启动。** rc 文件执行 `eval "$(q init zsh pre)"`（`CR/fig_integrations/src/shell/mod.rs#L303`）。`pre` 脚本用 `exec -a "<shell> (qterm)"` 把当前 shell 替换成 figterm（`CR/fig_integrations/src/shell/scripts/pre.sh#L34-L75`）。figterm 生成会话 ID（`QTERM_SESSION_ID`），在 PTY 中重新启动真实 shell，把 stdin 设为原始模式，然后连接桌面端的 `remote.sock`，用 ID 和 secret 握手（`CR/figterm/src/main.rs#L484-L559`、`CR/figterm/src/ipc.rs#L153-L299`）。本机 Kiro 2.30.0 的进程名 `zsh (kiro-cli-term)` 与这一行为一致（E-003）。

**1. Shell 钩子。** `post.zsh` 定义 `fig_osc`，输出 `ESC ] 697 ; <内容> BEL`（`CR/fig_integrations/src/shell/scripts/post.zsh#L20`）。

- `precmd` 输出 `OSCUnlock`、`Dir`、`Shell`、`ShellPath`、`PID`、`ExitCode`、`TTY`、`User` 等（L82-L95）；提示符前后分别包上 `StartPrompt` 和 `EndPrompt`，最后是 `NewCmd=<会话ID>`（L102-L164）。
- `preexec` 输出 `OSCLock` 和 `PreExec`（L73-L74）。
- bash 通过 bash-preexec 和 `PROMPT_COMMAND` 实现同样的效果；fish 用事件；nu 也支持。没有 PowerShell 或 cmd 的脚本。

**2. 按键。** figterm 读取 stdin。不在命令执行期间（preexec）时，先由 `KeyInterceptor` 判断：如果按键匹配某个已注册的动作，就把它作为 `InterceptedKeyHook` 发给桌面端，**这个按键不会传给 shell**；否则原样写入 PTY（`CR/figterm/src/main.rs#L768-L840`）。

**3. 解析输出。** PTY 输出一边原样转发到终端，一边逐字节送进 figterm 内置的 `alacritty_terminal` 副本（`main.rs#L856-L873`）。OSC 697 在 `CR/alacritty_terminal/src/ansi.rs#L1175-L1272` 处理：

- `StartPrompt` 和 `EndPrompt` 之间的单元格标记为提示符。
- `NewCmd` 把当前光标位置记为命令起点。
- `PreExec` 进入执行状态。
- 颜色与 zsh-autosuggestions 灰字相同的单元格，标记为建议文字。

**4. 编辑缓冲区。** `get_current_buffer` 从命令起点读到屏幕底部，跳过提示符和建议灰字（`CR/alacritty_terminal/src/term/mod.rs#L681-L790`）。光标位置是 **UTF-8 字节偏移**，桌面端再转换成 UTF-16 偏移（`CR/fig_desktop/src/remote_ipc/mod.rs#L94-L97`）。

**5. 发送缓冲区。** 每次读取 PTY 输出后，只要满足以下条件，figterm 就发送一次 `EditBufferHook{上下文, 文本, 光标, 坐标}`（`main.rs#L300-L389`、`#L879-L884`）：

- shell 属于 bash、zsh、fish、nu、dash 之一；
- 不在执行状态；
- 没有处于插入锁定中。

触发方式是“shell 回显后发送”，不是“按键时发送”。

**6. 桌面端处理。** 桌面端把缓冲区转成 `EditBufferChangedNotification` 推送给前端。缓冲区非空时显示窗口，为空或只有空白时隐藏；收到 `PreExec` 时也隐藏（`CR/fig_desktop/src/remote_ipc/mod.rs#L62-L151`、`#L223-L236`）。

**7. 定位窗口（macOS）。** 有三条路径（`CR/fig_desktop/src/platform/macos.rs#L675-L733`）：

- 支持输入法的终端：IMK 输入法返回光标矩形（`CR/fig_input_method/src/imk.rs#L79-L159`）。
- xterm.js 类终端：遍历辅助功能树查找光标。
- 其他终端：通过 AX 的选区边界获取（`CR/macos-utils/src/caret_position.rs#L50-L140`）。

窗口默认放在光标下方，空间不够时放到上方；最大高度由 `autocomplete.height` 决定，默认 140 px（`CR/fig_desktop/src/webview/window.rs#L178-L285`）。

**8. 注册按键拦截。** 前端通过 `UpdateApplicationPropertiesRequest` 告诉桌面端要拦截哪些动作，桌面端再转发给每个 figterm（`CR/fig_desktop/src/request/properties.rs#L20-L89`）。规则：只有在“需要拦截”并且“窗口可见”时才拦截已绑定的按键；全局模式下只拦截显示和切换类动作（`CR/figterm/src/interceptor.rs#L195-L226`）。

**9. 选中与插入。** 前端发送 `fig.InsertTextRequest`，桌面端转成 `figterm.InsertTextRequest`。figterm 的处理（`CR/figterm/src/message.rs#L162-L207`）：

- 在执行状态下丢弃该请求。
- 如果用户在快照之后又输入了字符，先用退格删除多出的字符或补上缺少的字符，使两边一致。
- 设置插入锁，写入 PTY，顺序为：光标移动（`ESC[C` 或 `ESC[D` × n）→ 退格 `0x08` × 删除数 → 插入文本 → 如果要求立即执行，再写 `\r`（`CR/fig_proto/src/figterm.rs#L4-L30`）。
- 缓冲区等于预期值，或超过 16 ms 后，解除插入锁。

## 传输与协议

- 帧格式：`\x1b@` + `fig-pbuf` + 8 字节大端长度 + protobuf 内容（`CR/fig_proto/src/lib.rs#L55-L72`）。
- Socket 目录：macOS 为 `$TMPDIR/cwrun/`；代码中 Windows 为 `%TEMP%\<数据目录>\sockets`（`CR/fig_util/src/directories.rs#L233-L246`），但 IPC 只实现了 Unix socket（见 `prior-art.md`）。
- 主要消息：

| 消息 | 定义 | 方向 | 用途 |
| --- | --- | --- | --- |
| `local.EditBufferHook` | `aq:proto/local.proto#L189-L197` | figterm → 桌面 | 缓冲区、字节光标、上下文、可选坐标 |
| `local.TerminalCursorCoordinates` | `aq:proto/local.proto#L182-L187` | figterm → 桌面 | 单元格坐标和字体像素尺寸，**只有 Windows 版会填写** |
| `local.PromptHook` / `PreExecHook` | `aq:proto/local.proto#L208-L223` | figterm → 桌面 | 生命周期事件 |
| `local.InterceptedKeyHook` | `aq:proto/local.proto#L287-L291` | figterm → 桌面 | 被拦截的动作名 |
| `fig_common.ShellContext` | `aq:proto/fig_common.proto#L41-L72` | 随各钩子发送 | pid、tty、cwd、shell、环境变量、别名 |
| `figterm.InterceptRequest` | `aq:proto/figterm.proto#L40-L64` | 桌面 → figterm | 拦截哪些动作，窗口是否可见 |
| `figterm.InsertTextRequest` | `aq:proto/figterm.proto#L68-L83` | 桌面 → figterm | 插入、删除、偏移、立即执行、插入时的缓冲区快照 |
| `remote.RunProcessRequest` | `aq:proto/remote.proto#L12-L18` | 桌面 → figterm | 在 shell 的环境和目录中运行 generator 命令 |
| `fig.EditBufferChangedNotification` | `aq:proto/fig.proto#L680-L685` | 桌面 → 前端 | 缓冲区和 UTF-16 光标 |
| `fig.KeybindingPressedNotification` | `aq:proto/fig.proto#L708-L712` | 桌面 → 前端 | 被拦截的动作 |

## 对 Windows 实现的含义（推断）

1. Fig 的设计依赖“PTY 包装 + 影子终端 + 提示符标记”取得缓冲区。这种方式适用于任何 shell，但需要处理 ConPTY 的事件顺序问题（`CR/figterm/src/main.rs#L583-L584`），还要识别灰色预测文字。
2. 在 PowerShell 中，PSReadLine 可以直接提供缓冲区和光标，可能不需要 PTY 包装；但它没有“缓冲区已变化”事件，见 `psreadline.md`（待 T-020 验证）。
3. 插入的本质是“删除 N 个字符，再输入文本”。Windows 上每种 shell 对退格字节（`0x08` 或 `0x7f`）的处理需要实测，inshellisense 对 pwsh 使用 `0x7f`。
4. 前端的补全逻辑（解析、spec、排序、插入规则）与平台无关，可以作为 Windows 引擎的行为基准。详见 `specs/completion.md`。
