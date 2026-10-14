# 结论索引

本页是所有结论（F-xxx）的唯一清单，其他文件引用这里的编号。证据编号 E-xxx 见 `evidence.md`，源码别名见 `sources.md`。

“类型”的含义见 `docs/workflow.md`：观察是直接看到的事实；推断由观察推导，尚未直接验证；未知表示已经尝试但还没有答案。

| 编号 | 结论 | 类型 | 依据 | 局限 / 待验证 |
| --- | --- | --- | --- | --- |
| F-001 | Fig 原产品已停止服务，由 Amazon Q Developer CLI 接替，后者在 2025 年 11 月更名为 Kiro CLI | 推断 | AWS 文档和博客、二手资料（`sources.md`） | 停服日期 2024-09-01 只见于二手资料 |
| F-002 | Fig 补全的完整源码（Rust 桌面端、figterm、shell 集成、React 前端）以 MIT 或 Apache-2.0 双许可开源；spec 库 `wf` 采用 MIT | 观察 | `aq:LICENSE.MIT`、`aq:LICENSE.APACHE`；GitHub API | 开源版本为 1.19.7，Kiro 闭源版本为 2.30.0 |
| F-003 | Kiro 2.30.0 的 `init zsh pre` 与开源 `pre.sh` 只在二进制名占位符上不同 | 观察 | E-003；`aq:crates/fig_integrations/src/shell/scripts/pre.sh` | 只比较了 zsh pre |
| F-004 | Kiro 2.30.0 前端使用与开源前端相同的设置键和 spec CDN | 观察 | E-002；`aq:packages/autocomplete-parser/src/loadHelpers.ts#L33` | 只做了字符串统计，没有比较逻辑 |
| F-005 | Kiro 2.30.0 的补全链路沿用开源代码，开源代码可作为行为基线 | 推断 | F-003、F-004 | 用 T-012 的运行时用例验证 |
| F-006 | `kiro-cli init zsh post` 在非交互环境中只输出 4 行，而开源 `post.zsh` 有 193 行并输出 OSC 697。原因未知 | 未知 | E-003 | T-013 |
| F-007 | Kiro 2.30.0 的 `init` 只接受 bash、zsh、fish、nu，不支持 PowerShell 和 cmd | 观察 | E-003 | 只检查了命令行参数 |
| F-008 | 补全链路为：figterm 用 PTY 包装 shell → shell 输出 OSC 697 标记 → figterm 在影子终端中取出缓冲区 → 通过 protobuf 和 Unix socket 发给桌面端 → 推送给 webview 前端 | 观察 | `architecture.md` | 来自开源基线 |
| F-009 | 插入的方式是向 PTY 写入“光标移动 + 退格 × N + 文本 + 可选的回车”；前端用 `ESC[D` 实现 `{cursor}` 占位 | 观察 | `aq:crates/fig_proto/src/figterm.rs#L4-L30`、`aq:packages/autocomplete-app/src/state/insertion.ts#L25-L90` | 退格字节在 Windows 各 shell 上的效果未测 |
| F-010 | 光标位于词中间时不显示补全，光标之后的文本不参与解析 | 观察 | `aq:packages/autocomplete-app/src/state/index.ts#L486-L491` | C-006 |
| F-011 | 默认按键：Enter 插入（不执行），Tab 插入公共前缀，Shift+Tab、↑、Ctrl+P 上移，↓、Ctrl+N 下移，Esc 隐藏；只在窗口可见且有候选时拦截 | 观察 | `aq:packages/autocomplete-app/src/fig.json`、`aq:crates/figterm/src/interceptor.rs#L195-L226` | C-002 至 C-005、C-011、C-012 |
| F-012 | 第一个词（命令名）默认不补全，由 `autocomplete.firstTokenCompletion` 控制，默认值为 false | 观察 | `aq:packages/dashboard-app/src/data/autocomplete.ts#L131-L138` | C-013 |
| F-013 | 按 Esc 隐藏后，后续输入保持隐藏，直到状态重置 | 观察 | `aq:packages/autocomplete-app/src/state/index.ts#L324-L346` | 重置时机是推断；C-005 |
| F-014 | Fig 自己的 Windows 移植是未完成的原型：已有 ConPTY、控制台 I/O、UIA/MSAA 光标定位；缺少 Windows IPC、PowerShell 和 cmd 集成、安装程序 | 观察 | `prior-art.md` 第 1 节 | 无法在 Windows 编译这一点是推断 |
| F-015 | inshellisense 已在 Windows 上支持 pwsh、powershell 和 cmd（实验性），方式是 ConPTY 包装加终端内 ANSI 绘制，使用 `wf` spec 2.675.0；Windows 上的 generator 经 Git Bash 执行 | 观察 | `prior-art.md` 第 2 节 | 没有在 Windows 上实际运行（T-014） |
| F-016 | `wf@aef52ac`（2.692.3）顶层 715 个 spec 文件中，有 201 个含 `postProcess` 或 `custom` 函数。因此 Windows 引擎需要嵌入 JS 运行时，否则只能支持静态部分 | 观察 | 用 `grep -lE 'postProcess\|custom:' src/*.ts` 统计 | 没有统计子目录中的 spec |
| F-017 | 开源前端有两处疑似缺陷：计算删除数时只把查询词中的第一个空白算作 `\ `；`selectSuggestionN` 只有第 1 个有效 | 观察（是否属于缺陷为推断） | `aq:packages/autocomplete-app/src/state/insertion.ts#L56`、`aq:packages/autocomplete-app/src/hooks/keypress.ts#L183-L189` | Windows 实现不照搬 |

## 注意

- 静态调用关系不能单独证明运行时行为；搜不到某个字符串，也不能证明某个功能不存在。
- 从开源基线得出的结论，在 T-012 验证之前不能写成“Kiro 的行为是……”。
