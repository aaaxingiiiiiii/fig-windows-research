# Fig spec 在 Windows 上的兼容性评估

更新：2026-10-14 · Codex/GPT-6 · T-015。

## 范围与判定方式

本报告评估 **Windows 原生 PowerShell 7 + Windows Terminal、不以 Git Bash/WSL 为前提** 的补全。固定版本为 `wf` aef52ac（包版本 2.692.3）和 `is` 8dcc9ca；后者实际依赖的 spec 包是 **2.675.0**，因此下面的清单是 T-037 的迁移参考，不能当成当前打包版本的逐项实测结果。版本证据：`wf:package.json#L1-L6`、`is:package.json#L47`。

选样覆盖版本控制、JavaScript、Python、容器、云、.NET、Go、Rust、网络和构建工具，共 30 个 CLI。brew、apt 用作平台边界对照；docker-compose 与 docker compose 共用一行。不把别名 python3、pip3 重复计数。**这是面向本项目的常用工具样本，不是有使用率数据支持的“全球前 30”排名。**

检查范围包括入口文件、同名子目录中的 spec、显式共享 generator 导入，以及 `script`、`custom`、`generateSpec` 和动态别名中的命令。跨工具 `loadSpec`（例如 Python 转交 django-admin、npx 转交任意 CLI）只记录委托边界，不把任意下游工具视为已审计。只读取源码和官方文档，没有执行这些 generator，也没有读取本机 SSH、云账号或项目配置。

表中“外部命令与证据”均为**观察（源码）**；分类、改写方法和优先级均为**推断**，尚未经 Windows 验证：

- **可直接使用**：所审查的 generator 未发现 Unix 专属命令依赖；假设对应 CLI 已安装、执行器能正确启动它。静态选项可复用不代表整个 CLI 或所有 Fig 特性已受支持。
- **需改写**：至少一条被审查路径依赖 Unix 命令、路径语义、shell 引号或 Fig 专有服务。通常仍可保留静态选项及其他原生命令 generator。
- **不适用**：工具所管理的环境不属于当前原生 Windows 目标；WSL 是另一个执行环境，不能以本机目录、凭据和命令直接代替。

按这个口径，**11 项可直接使用、17 项需改写、2 项不适用**。其中 az、gcloud 虽归入规格层的“可直接使用”，但当前引擎主动排除它们；aws 同样被排除且另有 Unix 依赖。不是 11 项已经能在现有程序里完整运行。

## 共享依赖：不能只扫描入口中的 script

1. **观察**：inshellisense 在 Windows 上尝试选择 Git Bash；找不到时捕获异常，继续以未指定 shell 的方式 `spawn(command, args)`。不是所有 generator 都会失败，也不是所有 generator 都能脱离 Bash。见 `is:src/runtime/utils.ts#L17-L39`、`is:src/runtime/utils.ts#L90-L116`。
2. **观察**：内建 `template: "filepaths" / "folders"` 经 `fs.readdir` 读取目录，不依赖 `ls`；history/help 模板返回空数组。见 `is:src/runtime/template.ts#L6-L34`、`is:src/runtime/templateCache.ts#L13-L18`。
3. **观察**：`@fig/autocomplete-generators` **2.4.0** 导出的 `filepaths()` / `folders()` 却是 custom generator，执行 **`ls -1ApL`**，且按 `/` 分段。其调用点即使只出现 `filepaths({ extensions: ... })`，仍有 Unix 依赖。核对 npm 固定版本包 `package/lib/src/filepaths.js` 第 94–149 行；下载包的 SHA-512 与 `wf:pnpm-lock.yaml#L383-L384` 一致。来源登记见 `sources.md` 的 T-015 补充。
4. **观察**：同包 `keyValue()` 本身组合 JS 候选，不执行外部命令；传入的回调另计。`ai()` 则调用 `fig settings --format json autocomplete.ai.enabled` 和 `fig _ request --route /ai/chat ...`。git 的提交消息候选使用它，并在回调里执行 `git log`、`git diff --staged`（`wf:src/git.ts#L4400-L4431`）。**推断**：独立 Windows 实现应禁用这项 Fig AI 候选，保留其他 git 补全；不能把它当作换一个 shell 就能修复的功能。
5. **观察**：custom 上下文的 `searchTerm` 当前固定为空字符串（`is:src/runtime/generator.ts#L8-L16`）。**推断**：改写 helper 时还需要检查目录与查询词语义，不宜只把命令名 `ls` 换成 `dir`。
6. **观察**：扫描固定版本 `is:src/runtime/`，未找到 `generateSpec` 或 `parserDirectives` 属性的处理；当前子命令选择/递归见 `is:src/runtime/runtime.ts#L176-L188`、`is:src/runtime/runtime.ts#L378-L463`。**推断**：表中列出的这些回调是规格的潜在执行依赖，不表示当前引擎已经调用它们；执行器迁移和 Fig 特性覆盖应分开验收。

## 30 个 CLI 清单

`H` 表示上节已核实的 filepaths helper，隐含外部命令 `ls -1ApL`。命令列列出被调用的可执行程序及主要子命令族；AWS 等大型规格不逐个展开所有服务 API 名称。静态选项中出现某个命令名不代表 generator 执行了它。

| # | CLI | 外部命令与证据（观察） | 分类（推断） | Windows 处理建议与边界（推断） |
| --- | --- | --- | --- | --- |
| 1 | git | `git log/config/rev-list/stash list/diff/branch/remote/tag/status/help -a`；暂存文件分支还调用 `bash -c`、`sed`；AI 分支调用 `fig`。`wf:src/git.ts#L120-L351`、`wf:src/git.ts#L449-L481`、`wf:src/git.ts#L4030-L4066`；AI 见上节 | 需改写 | 普通 git 查询保留参数数组；在 JS 中过滤 status 输出，替换 sed；禁用 Fig AI 子功能 |
| 2 | gh | `gh repo list/api graphql/pr list/alias list`、`git branch`、H。`wf:src/gh.ts#L1`、`wf:src/gh.ts#L66-L204`、`wf:src/gh.ts#L2470` | 需改写 | 替换 H；GraphQL 参数 `query='…'` 带 shell 引号，直接传 argv 会保留引号，需要按参数语义修正；`--jq` 是 gh 内建参数，不要求安装 jq；账号和网络另验 |
| 3 | npm | `curl` 搜索包/版本、`npm prefix/root -g`、`cat`、`bash -c`、`ls`、`until`/`[[ ]]`/`cd`。`wf:src/npm.ts#L1-L56`、`wf:src/npm.ts#L118-L216` | 需改写 | 用 Node 查找和解析 package.json、列全局目录；网络搜索可保留原生 curl 或改为 HTTP；处理 npm.cmd 启动 |
| 4 | npx | `bash -c` 向上查找 node_modules，再用 `ls -1 node_modules/.bin/`。`wf:src/npx.ts#L178-L202` | 需改写 | 用 Node 向上遍历，正确停止于盘符/UNC 根；对 .bin 中同名 `.cmd`、`.ps1` 启动器去重；下游 CLI 单独审计 |
| 5 | yarn | `yarn global dir/list/config list/--version/workspaces info/workspaces list`、`npm prefix`、`cat`、`bash`、`ls`、`curl`，并复用 npm generator。`wf:src/yarn.ts#L1-L24`、`wf:src/yarn.ts#L53-L141`、`wf:src/yarn.ts#L352-L393`、`wf:src/yarn.ts#L1508-L1569` | 需改写 | 共享 npm 的读文件/遍历适配；保留 Yarn 1 与后续版本的输出分支，不把工作区格式混用 |
| 6 | pnpm | `pnpm ls`、`git branch`，导入 npm/yarn generator，间接调用 `bash`、`cat`、`curl`。`wf:src/pnpm.ts#L3-L48`、`wf:src/pnpm.ts#L989-L1005` | 需改写 | 复用 npm/yarn 的修改；动态 spec 构造也调用依赖扫描，不能只处理 args.generators |
| 7 | node | H；`generateSpec` 调用 `bash -c isAdonisJsonPresentCommand`，该参数是字面字符串。`wf:src/node.ts#L1-L12`、`wf:src/node.ts#L85-L100` | 需改写 | 替换 H；框架探测必须重新明确文件检查语义，不能原样转给 pwsh；静态 Node 参数可先保留 |
| 8 | python | H；Django 探测执行 `bash -c` 内的 `cat manage.py` 与 `grep -q django`。`wf:src/python.ts#L1-L26` | 需改写 | Node 读文件并检查内容；保留 Python 参数；转交 django-admin 后的行为不在本项保证范围内 |
| 9 | pip | `pip list`，按文本行生成已安装包候选。`wf:src/pip.ts#L1-L13`、`wf:src/pip.ts#L16616` | 可直接使用 | 确认 pip 对应目标虚拟环境；需验证 CRLF 和包名解析，表格整行可能包含版本；可后续改用 JSON |
| 10 | pipenv | H；导入 pip 的静态 packageList，没有复用其 listPackages generator。`wf:src/pipenv.ts#L1-L3`、`wf:src/pipenv.ts#L211` | 需改写 | 替换 requirements 文件补全的 H；不要误报为需要执行 pipenv 或 pip list |
| 11 | poetry | 未发现执行外部命令的 generator；静态参数/模板。检查全文件 `wf:src/poetry.ts#L1-L746` | 可直接使用 | 仅表示静态规格可复用，不代表能动态枚举环境或依赖 |
| 12 | docker | `docker ps/image ls/images/search/context list/network list/node list/plugin list/secret list/service list/stack list/volume list`；构建阶段探测执行 `grep -iE FROM.*AS Dockerfile`；compose 委托下一行。`wf:src/docker.ts#L28-L180`、`wf:src/docker.ts#L340-L375`、`wf:src/docker.ts#L1988-L1993`、`wf:src/docker.ts#L6848` | 需改写 | 大部分 JSON 查询可保留；用 Node 读 Dockerfile 提取阶段；验证 format 参数内的空格，以及 daemon 不可用的处理 |
| 13 | docker-compose / docker compose | 按 tokens 选择 `docker-compose` 或 `docker compose`，执行 `config --services/--profiles`，传递 `-f`。`wf:src/docker-compose.ts#L1-L30` | 可直接使用 | 用临时 compose 配置测服务和 profile，不要求启动容器；路径带空格时保持单个参数 |
| 14 | kubectl | `kubectl api-resources`、`get`（pods/资源名/JSON）、`config get-contexts/get-clusters`。`wf:src/kubectl.ts#L1-L6`、`wf:src/kubectl.ts#L43-L117`、`wf:src/kubectl.ts#L178-L192` | 可直接使用 | 需要 kubeconfig 与查询权限；验证 context/namespace 和失败输出，不能把返回空列表直接归因于 Windows |
| 15 | helm | 未发现执行外部命令的 generator；静态规格。检查全文件 `wf:src/helm.ts#L1-L2290` | 可直接使用 | 不承诺动态 release/chart 列表；规格中的 completion bash 子命令不是实际执行 Bash |
| 16 | terraform | `terraform workspace list`、`terraform state list`。`wf:src/terraform.ts#L1-L27` | 可直接使用 | 需要项目目录和有效状态；验证空状态、CRLF、远端后端超时 |
| 17 | aws | `aws configure list-profiles`；子规格调用 `aws` 各服务的 list/describe/get 查询；本地 file/fileb 分支使用 `ls -1ApL`、`echo`。`wf:src/aws.ts#L1-L16`、`wf:src/aws/s3.ts#L132-L214`、`wf:src/aws/ec2.ts#L1-L35`、`wf:src/aws/cloudformation.ts#L116-L126` | 需改写 | 本地路径生成改为 Node，前缀改为直接返回候选；云查询仍需账号/网络；当前引擎排除此 spec，不能仅修 generator 后宣称已支持 |
| 18 | az | 入口版本探测 `az version -o json`；2.53.0 子规格扫描未发现其他命令执行点。`wf:src/az/index.ts#L1-L14`、`wf:src/az/2.53.0.ts`、`wf:src/az/2.53.0/` | 可直接使用 | 仅执行依赖层面；版本化加载及 az.cmd 启动另验；当前引擎排除 az |
| 19 | gcloud | 入口和 68 个同名目录子文件未发现外部命令 generator；通过 loadSpec 组织静态规格。`wf:src/gcloud.ts#L1-L361`、`wf:src/gcloud/` | 可直接使用 | 不代表动态云资源补全；当前引擎排除 gcloud |
| 20 | dotnet | H；`dotnet tool list --global`、`dotnet new --list`、`cat Properties/launchSettings.json`。`wf:src/dotnet.ts#L1`、`wf:src/dotnet.ts#L214-L224`、`wf:src/dotnet/dotnet-new.ts#L191`、`wf:src/dotnet/dotnet-run.ts#L61` | 需改写 | 替换 H 和 launchSettings 文件读取；SDK 版本引起的模板列表格式变化另验 |
| 21 | go | `go tool`；其余为静态参数/模板。`wf:src/go.ts#L873-L875` | 可直接使用 | 目标工具链已安装；核对工具名候选即可 |
| 22 | cargo | `cargo metadata/read-manifest/install --list/--list`、`rustc --print target-list`、`rustup toolchain list`、`curl`、`cat`、`bash`、`grep`、`cut`、H。`wf:src/cargo.ts#L1`、`wf:src/cargo.ts#L129-L223`、`wf:src/cargo.ts#L275-L350`、`wf:src/cargo.ts#L5047-L5053`、`wf:src/cargo.ts#L5830-L5839` | 需改写 | 保留 JSON metadata 查询；Node 读 Makefile.toml、解析安装列表；crate 搜索是网络功能，离线失败与平台失败分开记录 |
| 23 | rustup | `rustup toolchain list/target list/docs --path`；`bash -c` 内 `command -v gh`、`gh api` 或 `curl`；文档符号路径用 `find`、`sed`、`grep`。`wf:src/rustup.ts#L1-L39`、`wf:src/rustup.ts#L80-L89`、`wf:src/rustup.ts#L695-L701` | 需改写 | 保留原生命令；Node 遍历文档目录；在 JS 中选择网络查询提供方，不转译整段 Bash |
| 24 | ssh | `cat` 读取 config、Include 文件、known_hosts；依赖环境变量 HOME 和 `/` 路径规则。`wf:src/ssh.ts#L1-L99` | 需改写 | 用平台 home/path API 和文件读取；验证盘符、UNC、Include 和带空格路径；无需发起 SSH 连接 |
| 25 | scp | 导入 ssh 的 knownHosts/configHosts，因此间接执行 `cat`。`wf:src/scp.ts#L1-L20`、`wf:src/ssh.ts#L26-L99` | 需改写 | 与 ssh 共用修复；区分远端 `host:path` 与本地盘符冒号，不把所有冒号都当远端分隔符 |
| 26 | curl | 无外部命令 generator；URL 使用 history 模板，其他参数含文件模板。`wf:src/curl.ts#L1-L50` | 可直接使用 | 当前引擎 history 返回空；这是功能缺口，不是必须调用 curl 查询候选；`{cursor}` 等插入语义另验 |
| 27 | wget | 未发现外部命令 generator，静态参数。检查全文件 `wf:src/wget.ts#L1-L604` | 可直接使用 | 对应 GNU Wget 可执行程序；同名 PowerShell 函数/别名不自动具有相同参数 |
| 28 | make | `bash -c` 中 `make -qp`、`awk`、`sort -u`，另用 `cat Makefile makefile`。`wf:src/make.ts#L1-L30` | 需改写 | 需要 GNU make；JS 解析查询输出和说明；不要把 nmake 当成等价工具 |
| 29 | brew | `brew services list/tap/list/outdated/formulae/casks`、`bash`、`sed`、`tail`、`find`。`wf:src/brew.ts#L1-L75`、`wf:src/brew.ts#L1281` | 不适用 | Homebrew 官方描述的是 macOS/Linux/WSL；原生 Windows 范围不引入这个包管理环境，见下方官方文档 |
| 30 | apt | `apt list`、`apt list --installed/--upgradable`、H。`wf:src/apt.ts#L1-L60` | 不适用 | 管理 Debian 系包数据库，不能映射为 Windows 包列表；仅在单独的 Linux/WSL 执行环境中考虑 |

## 给 T-037 的建议顺序

以下均为**推断（实现建议）**，没有改变现有路线或认领实现任务：

1. **先区分可执行程序与 shell 脚本。** 保持 `command + args` 的参数边界，原生 `.exe` 不需要 Git Bash。Windows `.cmd/.bat` 需要专门的启动和引号处理，不能简单改成全部 `shell: false`，也不能把任意参数拼进 `pwsh -Command`。Node 官方说明了这类文件的启动要求：[Node 22 child_process](https://nodejs.org/download/release/latest-jod/docs/api/child_process.html#spawning-bat-and-cmd-files-on-windows)。gh 的带引号 GraphQL 参数就是需要单独处理的既有数据（上表第 2 项）。
2. **优先替换共享的文件访问。** 把 H 的扩展名过滤、文件夹选项和插入行为转接到引擎模板/Node API；再处理 npm/yarn/pnpm 的 package.json、npx 的目录枚举、ssh/scp 的配置读取。这些修改能覆盖多个 CLI，依据为上表各调用点与内建模板实现。
3. **再替换少量文本管道。** git 的 sed、docker 的 grep、cargo 的 grep/cut、make 的 awk/sort 改成 JS 后处理。保留其原生命令查询，避免把 spec 全部重写成 PowerShell。
4. **把静态候选作为逐项回退。** 某个 generator 超时、缺依赖或解析失败时，应保留静态选项；Fig AI 不纳入当前独立实现。是否恢复云规格加载应由现有计划范围决定，本报告不擅自移除 ignoredSpecs。排除证据：`is:src/runtime/runtime.ts#L26-L28`。

## 验证清单与未知项

**未知（尚无 Windows 运行证据）**：本报告没有测过上述 CLI 的实际版本、CRLF 输出、安装布局和 PowerShell 交互。也没有把 wf 2.692.3 与 is 实际包 2.675.0 做逐项 diff。T-037 应先在引入的构建中确认实际包版本，再对这张表复核；不要据此直接升级依赖。

建议在 Windows 上验证以下条件，记录“输入、实际启动的程序与参数、候选输出、耗时/错误”；使用临时样本，不记录个人目录或账号数据：

| 验证组 | 场景 | 通过标准（建议） |
| --- | --- | --- |
| 无 Bash 的执行器 | PATH 无 Bash/Unix 工具；原生 exe 与 npm.cmd 各一例；参数含空格、中文、引号、`&` | 保持参数边界；候选能产生；失败可诊断；静态候选仍可用 |
| git / docker | 临时 git 仓库：分支、暂存/未暂存文件；多阶段 Dockerfile 的 `--target` | 结果符合 fixture；不启动 sed/grep/bash；Dockerfile 探测不需要 daemon |
| npm / yarn / pnpm / npx | 含空格的工作区路径、嵌套目录、无 package.json、多个 Windows bin shim | 正确找最近项目根；根目录停止；候选无重复启动器后缀 |
| H / SSH | 盘符路径、UNC、反斜杠、扩展名过滤、临时 SSH Include、缺失文件 | 不启动 ls/cat；目录与文件候选类型正确；缺失文件不使补全失效 |
| CLI 原生查询 | pip、go、terraform、compose；cloud/kubectl 用受控测试环境 | CRLF 不泄入候选；权限/网络失败与平台不兼容分别记录 |
| 回退与非目标 | Fig AI、brew/apt、云规格禁用、history 空模板 | 不误报完整支持；已有静态选项可继续使用；不偷偷切换到 WSL |

**观察（补充官方文档，2026-10-14 查询）**：Homebrew 将 Linux/Windows 支持描述为 Linux/WSL 环境，见 [Homebrew on Linux](https://docs.brew.sh/Homebrew-on-Linux)；apt 的职责是查询和操作其包管理数据库，见 [Debian apt(8)](https://manpages.debian.org/bookworm/apt/apt.8.en.html)。**推断**：二者不纳入当前原生 Windows MVP，与能否画出静态选项无关。

## 复核方法

先运行 `sh scripts/fetch-sources.sh` 固定三个源码版本，再按表格引用检查。定位时使用 `rg -n 'script:|command:|custom:|generateSpec:|executeShellCommand|executeCommand|^import'`，同时检查返回命令数组的函数、共享 helper 和 `loadSpec`；仅匹配 `script:` 会漏掉 docker 的 grep、AWS 的 ls/echo 和 npm/yarn 的间接依赖。负向结论只限于上述明确扫描范围，不是通用静态分析器的完备性证明。

共享包可从 `sources.md` 中的固定 npm tarball 读取到内存，用 SHA-512 对照锁文件，检查 `package/lib/src/filepaths.js`、`keyvalue.js`、`ai.js`；无需安装或运行包。最后执行 `python3 scripts/check-refs.py` 检查引用是否存在及行号是否越界，人工核对分类与引用内容。
