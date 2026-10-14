# 补全行为规格

更新：2026-10-14（T-004）。缩写与 `research/architecture.md` 相同：`APP` = `aq:packages/autocomplete-app/src`，`PAR` = `aq:packages/autocomplete-parser/src`，`SH` = `aq:packages/shell-parser/src`，`CR` = `aq:crates`。

## 怎么读这份规格

- 第 1–7 节是从开源基线读出的**行为规则**，每条都附有源码出处。它们描述 Fig 1.19.7 的代码逻辑，还没有确认与 Kiro 2.30.0 的运行结果一致。
- 第 8 节是**可测试用例** C-xxx。每条用例都有三栏，分别填写“源码预期”“Kiro 2.30.0 观察”“Windows 实测”。
- 每条规则末尾的“Windows：”说明 Windows 实现是沿用、修改还是不适用。这是设计建议，不是事实，在 D-003 确定后再定稿。

## 1. 触发与显示

1. 每次 shell 回显之后，figterm 会发送一次缓冲区，前端每次收到都会重新解析，没有全局防抖（`CR/figterm/src/main.rs#L879-L884`、`APP/parser/hooks.ts#L46-L78`）。Windows：沿用，但需要测量延迟。
2. 缓冲区为空或只有空白时隐藏；命令开始执行（preexec）时隐藏（`CR/fig_desktop/src/remote_ipc/mod.rs#L136-L151`）。Windows：沿用。
3. **光标下方的字符不是空白（光标在词中间）时，不显示补全**；光标之后的文本不参与解析（`APP/state/index.ts#L486-L491`）。Windows：沿用。
4. 隐藏状态有三种（`APP/state/types.ts#L8-L24`、`APP/state/index.ts#L324-L346`）：
   - 等待按键而隐藏：下一次解析后重新显示。
   - 插入后隐藏：只有当前参数或补全对象发生变化时才重新显示。
   - 按 Esc 隐藏：此后的解析都**保持隐藏**，直到解析出错时重置，例如下一个提示符出现、缓冲区清空（重置时机为推断）。
5. 以下情况强制隐藏：用退格删回上一个词；缓冲区发生“大幅变化”，即粘贴或调出历史命令等不是由补全自己插入造成的非前缀变化（`APP/parser/hooks.ts#L17-L29`、`APP/state/index.ts#L355-L361`）。
6. 命令没有对应的 spec 时，加载失败，不显示任何内容（`PAR/parseArguments.ts#L842-L844`）。
7. 设置 `autocomplete.onlyShowOnTab` 开启时，不自动弹出。按 Tab 时，如果只有一个候选就直接插入，否则弹出列表（`APP/state/index.ts#L348-L353`、`APP/hooks/keypress.ts#L90-L101`）。

## 2. 分词

1. 使用自写的类 bash 语法分析器。运算符为 `; & &; | |& && ||`；支持 `( )`、`{ }`、`$( )`、反引号、`${ }`、`$(( ))`、双引号、单引号和 `$'…'`（`SH/parser.ts#L109`、`#L232-L311`、`#L618-L655`）。
2. 只解析**光标所在的最内层命令**。例如 `a | b`、`a && b`、`$(b` 都只解析 `b`（`SH/command.ts#L21-L36`、`#L189-L202`）。
3. 词的值是去掉引号和转义之后的文本；未闭合的引号可以容忍（`SH/parser.ts#L124-L157`）。缓冲区末尾是空白时，会追加一个空词，表示正在开始一个新参数（`SH/command.ts#L82-L89`）。
4. 开头的 `FOO=bar` 赋值会被跳过（`SH/parser.ts#L556-L602`）。重定向符 `>`、`<` 被当作普通词（推断）。
5. 别名只在第一个词上展开，并且要求至少有两个词（`SH/command.ts#L158-L187`）。
6. 在 spec 中，每个词依次尝试匹配子命令、选项、选项参数和位置参数。`--` 之后不再识别选项；`--opt=val` 和 `-abc` 选项串都支持（`PAR/parseArguments.ts#L191-L573`）。

Windows：PowerShell 的语法不同，例如反引号是转义符、`;` 是语句分隔符，没有 `&&`（5.1）。需要另写 PowerShell 分词器，或者先只支持 PowerShell 和 bash 语法相同的子集。这是一个待决定的设计问题。

## 3. 候选来源

0. **第一个词（命令名本身）默认不补全。**只有开启 `autocomplete.firstTokenCompletion`（默认值为 false）时，才会通过 shell 列出可用命令作为候选（`PAR/parseArguments.ts#L1026-L1119`，默认值见 `aq:packages/dashboard-app/src/data/autocomplete.ts#L131-L138`）。
1. spec 的查找顺序：开发端口 → 开发目录 → CDN 上 `index.json` 列出的 spec → 本地 `~/.fig/autocomplete/build/<名称>.js`（`PAR/loadSpec.ts#L112-L197`、`PAR/loadHelpers.ts#L27-L133`）。Windows：改为使用打包在程序中、版本固定的 `wf` spec。
2. 候选包括：子命令、选项、参数的固定建议，generator 的结果，以及 `filepaths`、`folders`、`history`、`help` 模板（`PAR/parseArguments.ts#L102-L134`）。
3. 脚本 generator 在当前目录中运行，超时取 `autocomplete.scriptTimeout`（默认 5000 ms）、spec 设置和输入参数中的最大值。`splitOn` 优先于 `postProcess`。出错时返回空列表，不显示错误（`APP/generators/scriptSuggestionsGenerator.ts#L10-L92`、`APP/generators/helpers.ts#L25-L26`）。
4. generator 的重新运行由 `trigger` 控制；`debounce: true` 表示 200 ms（`APP/state/generators.ts#L118-L198`）。只有设置了 `cache` 时才缓存（`APP/generators/helpers.ts#L30-L58`）。
5. 执行命令的超时为 5 s，**Windows 上为 20 s**（`aq:packages/api-bindings-wrappers/src/executeCommand.ts#L19-L22`）。

## 4. 过滤与排序

1. 拼装顺序：子命令（按字母序）→ 参数建议 → generator 结果 → 附加建议 → 选项（按字母序）（`APP/suggestions/index.ts#L96-L290`）。
2. 优先级默认 50，取值范围 0–100。最近使用过的项提升到 75 以上；`autocomplete.sortMethod: "alphabetical"` 会关闭这一提升。之后按优先级做稳定排序（`APP/suggestions/sorting.ts#L20-L83`）。
3. 输入为空时，隐藏 `hidden` 项。输入不为空时：先放名称完全匹配的项，大小写一致的在前，`hidden` 项此时也可以出现；再放部分匹配的项，按分数排序，分数相同再按优先级。默认是前缀匹配；`autocomplete.fuzzySearch` 开启后使用模糊匹配，但前缀匹配的项仍排在前面（`APP/suggestions/index.ts#L357-L518`、`APP/suggestions/helpers.ts#L40-L60`）。
4. 不限制数量。列表虚拟滚动，高 140 px、宽 320 px，每行 20 px，约可见 7 行（`APP/window.ts#L7-L28`，可见行数为推断）。
5. 重新计算后，如果之前选中的项仍然存在，就保持选中；否则回到第一项（`APP/state/index.ts#L238-L257`）。

## 5. 按键

默认绑定（`APP/fig.json`，前端启动后覆盖 figterm 内置的那一份）：

| 动作 | 默认按键 | 行为 |
| --- | --- | --- |
| insertSelected | Enter | 插入选中项，**不执行命令** |
| insertCommonPrefix | Tab | 插入所有候选的公共前缀；没有可插入的前缀时窗口抖动；只剩一个候选时完整插入 |
| navigateUp | Shift+Tab、↑、Ctrl+P | 上移；在第一项时继续上移会隐藏窗口（`autocomplete.scrollWrapAround` 未开启时） |
| navigateDown | ↓、Ctrl+N | 下移 |
| hideAutocomplete | Esc | 隐藏，见 1.4 |
| toggleDescription | Ctrl+K | 显示或隐藏说明 |
| toggleHistoryMode | Ctrl+R | 切换历史模式 |
| selectSuggestion1–10 | Cmd+1…0 | 只选中，不插入。源码中的 `<= 0` 缺陷导致只有第 1 个有效（`APP/hooks/keypress.ts#L183-L189`） |

- 只有在窗口可见并且有候选时才拦截按键；其他时候按键原样交给 shell（`CR/figterm/src/interceptor.rs#L195-L226`）。**右方向键没有默认绑定。**
- 用户可以用 `autocomplete.keybindings.<按键>` 改绑，设为 `"ignore"` 表示放行该按键（`CR/fig_settings/src/keybindings.rs#L65-L83`）。

Windows：Cmd 键改为 Ctrl 或 Alt，但这些组合可能与 PSReadLine 已有的绑定冲突，需要列出冲突清单。前端用 macOS 键码 48 识别 Tab（`APP/hooks/keypress.ts#L90-L101`），这一做法不能照搬。

## 6. 插入

插入文本的生成规则（`APP/state/insertion.ts#L151-L224`）：

1. 有 `insertValue`，并且不是文件或文件夹时，原样使用 `insertValue`，不做转义。
2. 否则使用匹配到的名称。选项设置了 `requiresSeparator` 或 `requiresEquals`，并且第一个参数是必填时，追加分隔符（默认 `=`）和 `{cursor}`（`APP/suggestions/index.ts#L160-L179`）。
3. 转义：文本中只要含有 `\ ? * ' " # | < > ( ) [ ] ! &` 中的任一字符，就整体用单引号包起来，其中的 `'` 写成 `'"'"'`；文件夹的结尾 `/` 留在引号外。如果只含空格，就把每个空格写成 `\ `。
4. 要求执行时追加 `\n`；末尾连续的多个 `\n` 合并为一个。
5. 不以 `\n` 结尾、候选带有 `shouldAddSpace`，并且 `autocomplete.insertSpaceAutomatically` 未关闭（默认开启）时，追加一个空格。子命令或选项有必填参数、要求子命令或含有子命令时，会带上 `shouldAddSpace`（`APP/suggestions/index.ts#L45-L68`）。

发送方式（`APP/state/insertion.ts#L25-L90`）：

6. 删除的字符数等于当前查询词的长度。如果新文本以查询词开头，就不删除，只输入剩余部分。
7. `{cursor}` 从文本中去掉，并在末尾追加相应数量的 `ESC[D`，把光标移回该位置。
8. 最终发送 `"\b" × 删除数 + 文本 + ESC[D × 回移数`。计算删除数时只把查询词中的第一个空白算作 `\ `（正则缺少 `g` 标志），含多个空格的路径会删少（推断为缺陷，Windows 实现不要照搬）。
9. figterm 写入 PTY 前会先核对：如果用户在此期间又输入了字符，先补删或补写（见 `research/architecture.md` 第 9 步）。
10. 插入公共前缀时，按同类候选（文件和文件夹视为同类）求公共前缀，比较时不区分大小写，大小写取选中项的写法。这是部分插入，窗口不关闭（`APP/state/insertion.ts#L226-L304`）。

Windows：PowerShell 的转义规则与 bash 不同，路径中的空格应使用引号包裹，不能用 `\ `。分隔符使用 `\` 还是 `/` 待决定。

## 7. 错误与超时

| 情况 | 行为 | 出处 |
| --- | --- | --- |
| 解析出错 | 重置状态并隐藏 | `APP/state/index.ts#L505-L513` |
| generator 加载超过 200 ms | 列表换成加载图标 | `APP/App.tsx#L218-L232` |
| spec 加载 | 5 s 超时 | `PAR/loadSpec.ts#L238` |
| 从 CDN 导入 | 每次 1 s，最多重试 5 次 | `PAR/loadHelpers.ts#L89-L117` |
| generator 失败 | 返回空列表，不提示 | `APP/generators/helpers.ts#L25-L26` |

## 8. 用例

运行时观察需要 macOS 和 Kiro CLI，并且要有人看着屏幕（T-012，`env: mac-kiro, human`）。一律使用默认设置；观察前运行 `kiro-cli settings list` 并记录与默认值不同的项。spec 以 `wf@aef52ac` 中的 `git` 为准。

| 编号 | 初始缓冲区（`│` 为光标） | 操作 | 源码预期 | 依据 | Kiro 2.30.0 观察 | Windows 实测 |
| --- | --- | --- | --- | --- | --- | --- |
| C-001 | `git ch│` | 等待 | 弹出，候选为 `checkout`、`cherry-pick`，选中第一项 | 4.1、4.3；`wf:src/git.ts#L7932`、`#L8120` | 待测 | 尚未测试 |
| C-002 | `git ch│` | Tab | 两个候选的公共前缀等于已输入的 `ch`，窗口抖动，缓冲区不变 | 5 表、6.10 | 待测 | 尚未测试 |
| C-003 | `git chec│` | Tab | 只剩一个候选，完整插入为 `git checkout`，末尾是否有空格取决于 `shouldAddSpace` | 5 表、6.5 | 待测 | 尚未测试 |
| C-004 | `git ch│` | ↓ 然后 Enter | 插入 `cherry-pick`，**不执行**；插入后窗口按 1.4 的规则处理 | 5 表、6.6 | 待测 | 尚未测试 |
| C-005 | `git ch│` | Esc，再输入 `e` | Esc 后窗口隐藏，输入 `e` 后仍保持隐藏 | 1.4 | 待测 | 尚未测试 |
| C-006 | `git checkout│`，把光标左移 3 格 | 等待 | 光标在词中间，不显示 | 1.3 | 待测 | 尚未测试 |
| C-007 | `ls \| git ch│` | 等待 | 只解析 `git ch`，候选与 C-001 相同 | 2.2 | 待测 | 尚未测试 |
| C-008 | 当前目录有文件夹 `My Docs` 和 `a&b`；`cd M│` 和 `cd a│` | Enter | 分别插入 `My\ Docs/` 和 `'a&b'/` | 6.3 | 待测 | 尚未测试，Windows 应改用引号 |
| C-009 | `git add --chmod│` | 选中后 Enter | 插入 `--chmod=`，光标停在 `=` 之后 | 6.2、6.7；`wf:src/git.ts#L3922-L3926` | 待测 | 尚未测试 |
| C-010 | `notacommand-xyz │` | 等待 | 没有 spec，不显示 | 1.6 | 待测 | 尚未测试 |
| C-011 | `git ch│`，窗口可见 | ↑（当前是第一项） | 窗口隐藏 | 5 表 | 待测 | 尚未测试 |
| C-012 | 缓冲区为空 | 按 Enter 执行空命令；窗口不可见时按 Tab | 按键原样交给 shell，补全不作处理 | 5 节 | 待测 | 尚未测试 |
| C-013 | `gi│`（默认设置） | 等待 | 第一个词（命令名）默认不补全，不显示 | 3.0 | 待测 | 尚未测试 |

### 观察记录模板

```text
用例：C-00x
环境：Kiro CLI 2.30.0 / macOS 版本 / 终端名称与版本 / shell 版本
与默认值不同的设置：
操作：
结果：（候选列表、选中项、插入后的缓冲区和光标；附截图或录屏的证据编号 E-xxx）
与源码预期一致吗：是 / 否（不一致时写明差异）
```
