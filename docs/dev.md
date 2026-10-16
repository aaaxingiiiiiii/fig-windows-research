# 开发指南

构建、测试和运行的命令。路线与任务见 `docs/mvp-plan.md`，协作规则见 `AGENTS.md`。

## 1. 环境

- **Node.js 18–22**（inshellisense 的 `engines` 要求 `>=18 <23`）。推荐用 fnm 管理版本：
  - 安装：`fnm install 22`
  - 切换：`fnm use 22`
  - 临时使用：`fnm exec --using=22 -- <命令>`

  本机的默认 Node 超出这个范围时（例如 24 或 26），用 `fnm exec` 临时切换即可。
- **node-pty** 带有 darwin、linux、win32 的 x64 和 arm64 预编译二进制，通常不需要本地编译工具链。2026-10-14 在 macOS arm64 上观察到。
- Windows 上的完整环境见 `docs/windows-setup.md`。

## 2. inshellisense（`src/inshellisense/`）

上游来源见 `src/inshellisense/UPSTREAM`。**修改这个目录下的任何文件，都要在 `src/inshellisense/CHANGES.md` 中追加一行。**

```sh
cd src/inshellisense
npm ci                 # 按 package-lock.json 安装依赖
npm run build          # tsc 编译，输出到 build/（已被 .gitignore 忽略）
npm test -- --ci       # 单元测试（jest）；--ci 不写新快照，见第 3 节
npm run lint           # eslint 和 prettier 检查
```

Windows 上的命令相同，在 PowerShell 中执行即可。

### 运行

| 用途 | 命令（在 `src/inshellisense/` 下执行） | 说明 |
| --- | --- | --- |
| 不进入交互界面，直接查看补全结果 | `node build/index.js complete "git ch"` | 输出 JSON：候选列表和当前词。适合脚本化检查和自动测试 |
| 交互试用 | `node build/index.js -s pwsh`（Windows）或 `-s zsh`（Mac） | 在当前终端中启动一个被包装的 shell，用 `exit` 退出 |
| 从 TS 源码运行 | `npm run dev` | 用 tsx 直接运行，不需要先构建 |
| 环境诊断 | `node build/index.js doctor` | — |
| 打包单文件程序 | `npm run package` | 使用 `scripts/pkg.ts`；在 Windows 上由 T-040 验证 |

从源码运行时，`--version` 显示 `__VERSION__` 占位符，打包时才会替换成真实版本号。本项目的版本号带 `figwin` 后缀（例如 `0.0.4-figwin.1`），用来和原版 inshellisense（`0.0.4`）区分；`install.ps1` 会检查这一点。

**Windows 上的 generator 执行方式（T-037、T-049）**，按顺序：

1. spec 中常用的 POSIX 用法（`ls -1ApL`、`cat`、`grep`，以及登记过的 `bash -c` 脚本）由 Node 模拟，管道中的 git、npm 等原生命令照常执行。见 `src/runtime/posixEmulation.ts`。
2. 其他命令用 cross-spawn 直接执行。
3. 命令找不到时才退回 Git Bash。`bash`、`sh` 中没有登记的脚本，总是经 Git Bash 执行，避免误入 WSL。

用 `-V` 运行时，日志 `%USERPROFILE%\.inshellisense\log\inshellisense.log` 会记录每条命令走的是哪条路径：`emulated in node`、`ran natively` 或 `git bash`。

spec 包（`@withfig/autocomplete`）升级后，登记的脚本原文可能改变，模拟就会失效。`posixEmulation.test.ts` 中的出处检查会失败，提醒更新脚本表。要登记新的脚本，在 `knownScripts` 中加一项，并在测试中加上它的出处检查。

### 测试的已知情况

2026-10-14 在 macOS 26.6 arm64、Node 20.20.2 上运行，共 213 个测试：202 个通过，10 个跳过，1 个失败。

- 失败的是 `brewInstallMullvad`。它只在 macOS 上运行，依赖本机 Homebrew 的 `brew casks` 输出 cask 列表；本机（Homebrew 6.0.15）这条命令输出为空。属于环境问题，与 Windows 无关。
- `gitStatus` 测试依赖 git 的状态：如果 `src/inshellisense/` 还没有提交到仓库，git 会把整个目录显示为一项未跟踪内容，测试就会失败。

在其他机器上运行时，如果失败的测试与上面不同，在任务报告中记录。

## 3. 我们新增的测试

规格用例（`specs/completion.md` 的 C-xxx 和 W-xxx）的测试放在 `src/inshellisense/src/tests/figspec/figspec.test.ts`，这样可以直接使用 inshellisense 的 jest 配置和运行时：

```sh
cd src/inshellisense
node --experimental-vm-modules node_modules/jest/bin/jest.js src/tests/figspec   # 只运行规格用例
npm test -- --ci                                                                  # 运行全部测试，包含规格用例
```

约定：
- 与 Fig 只是做法不同的地方，断言 inshellisense 的实际行为，并在测试名称中写“差异”。
- 已知缺陷用 `test.failing` 写出正确的期望，修复后改为 `test`。不要为了让测试通过而改动期望。
- 新增用例时，同步更新 `specs/completion.md` 的第 9 节或第 10 节。

2026-10-16 在 Mac 上的结果（`npm test -- --ci`，pwsh 在 PATH 中）：全部测试 396 个，385 个通过，10 个跳过，1 个失败（`brewInstallMullvad`，见上文）。完整运行时偶尔还有 1 个规格用例因为负载超时，单独运行时通过。我们新增的测试：

- 规格用例 22 个；
- 执行方式 5 个（Windows 端的 T-052 又修改过）；
- POSIX 模拟 32 个；
- custom generator 4 个；
- spec 兼容（T-055）16 个；
- 悬浮窗 95 个（T-054 之后）；
- ConPTY 的选择 3 个（`isterm/conpty.test.ts`，T-056）；
- PowerShell 初始化脚本 3 个（`figspec/shellInit.test.ts`，T-062；后两个要用真实的 pwsh，没有 pwsh 或不是交互式会话时跳过）；
- 安装包的默认配置 3 个（`figspec/configTemplate.test.ts`，T-060）。

建议加上 `--ci`。不加时，jest 会为失败的 `brewInstallMullvad` 新写一个快照，把 `__snapshots__/runtime.test.ts.snap` 改掉；出现这种改动时，用 `git checkout` 还原，不要提交。

## 4. 悬浮窗渲染器（T-043）

inshellisense 一侧的悬浮窗支持。协议见 `docs/protocol.md`，宿主由 T-044 实现。

**启用方式**，有两种：

- 开发和测试：设置环境变量 `FIGWIN_OVERLAY_PIPE`，值为宿主的端点（Windows 上是 `\\.\pipe\<名称>`，其他系统上是 Unix 域套接字的路径）。这时不会自动启动宿主。
- 正式使用（T-063）：在配置文件中加入

  ```toml
  [overlay]
  enabled = true
  # hostPath = "D:\\figwin\\figwin-host.exe"   # 不写时用 is.exe 旁边的 figwin-host.exe
  ```

  inshellisense 按用户和登录会话算出默认端点（`overlay/launch.ts`，协议第 2 节），连不上时在后台启动宿主。登录会话编号来自 PowerShell 初始化脚本设置的 `FIGWIN_LOGON_SESSION`；从源码直接运行时要自己设置这个变量。

两种都没有时，行为与原来完全相同。在 Mac 上联调自动启动：`hostPath` 指向一个运行 `dotnet <DevHost.dll> "$@"` 的脚本，再用 `XDG_CONFIG_HOME` 指定一份临时配置，不必修改 `~/.inshellisenserc`。

**代码**（`src/inshellisense/src/overlay/`）：

| 文件 | 作用 |
| --- | --- |
| `json.ts` | 严格的 JSON 解析：拒绝重复键、嵌套超过 16 层、未配对的代理项 |
| `protocol.ts` | 常量、消息类型、按行分帧（处理半包、合包、CRLF，限制单行字节数）、校验宿主消息 |
| `snapshot.ts` | 从候选页、命令状态和光标单元格生成 show 或 hide；清洗文字；超长时依次缩短 |
| `client.ts` | 连接与协议状态：握手、心跳与租期、show 的 100 ms 确认超时、背压时只保留最新快照、有界队列、按 1 s、2 s、5 s 重连 |
| `overlayRenderer.ts` | 渲染器接口 `Renderer`；`OverlayRenderer` 在终端渲染和悬浮窗之间切换；`createRenderer` 按环境变量和配置选择 |
| `launch.ts` | 默认端点、宿主路径、自动启动宿主（T-063） |

对上游文件的改动：

- `suggestionManager.ts`：增加 `getDisplayState()`、候选列表版本号，以及 `update()` 的 `allowAccept` 参数。
- `suggestionRenderer.ts`：增加 `setSuggestionsEnabled()` 和 `canAcceptSuggestion`。
- `ui-root.ts`：改用 `createRenderer`，并在退出时调用 `dispose()`。

详见 `src/inshellisense/CHANGES.md`。

**按键规则**：

- 只有宿主确认当前候选列表已经显示（收到 shown），才拦截 ↑、↓、Esc 和接受键。
- 按 ↑、↓ 改变选中项后，列表仍然可见，可以继续选择。但在宿主确认新的选中项之前，接受键会被吞掉，不插入任何内容，以免插入用户还没看到的候选。
- 只有参数说明、没有候选时，不拦截按键。

**宿主异常时**：

- 以下情况都会回到终端内绘制，并按退避间隔重连：
  - 宿主不存在；
  - 100 ms 内没有确认 show；
  - 600 ms 没有任何消息；
  - 报告 suppressed 或 failed；
  - 发来不合法的消息。
- 宿主一直不确认或一直报告失败时，每次重连后大约有 100 ms，候选交给了宿主，按键直接进入 shell。所以 T-044 的宿主必须及时回复 status。

**手动检查**：`spikes/T-043-fake-host/` 中有一个假的宿主，它不画窗口，只回复协议消息并打印收到的消息。用法见其中的 README。

**测试**：`src/tests/overlay/` 中共 81 个，对应 `docs/protocol.md` 第 10 节的 P-01、P-02、P-04、P-06、P-07、P-08、P-09、P-11、P-12 在客户端一侧的部分。其中包括：

- 一次真实套接字的往返；
- 一个集成测试：真实的 SuggestionManager 和客户端连在一起，走完 `git ch` → ↓ → 确认前按 Tab 被吞掉 → 确认后插入。

P-03、P-05、P-10 只涉及宿主。

## 5. 悬浮窗宿主（T-053，`src/overlay-host/`）

C#/.NET 10（D-012）。与平台无关的协议核心、测试和开发用宿主都可以在 Mac 上构建和运行；Windows 专用的部分（窗口、UIA）由 T-044 完成。

```sh
cd src/overlay-host
dotnet build OverlayHost.slnx
dotnet test OverlayHost.slnx      # 2026-10-15 在 Mac 上：70 个全部通过
```

- Mac 上的 SDK 在 `~/.dotnet`，用官方的 `dotnet-install.sh --channel 10.0` 安装（10.0.402）。
- 结构、平台接口 `IOverlayPresenter` 的线程约定，以及与 inshellisense 联调的方法，见 `src/overlay-host/README.md`。
- 开发用宿主（`FigWin.OverlayHost.DevHost`）与假宿主（`spikes/T-043-fake-host/`）的区别：
  - 开发用宿主使用真实的协议核心，用来检查两端的实现能否互通；
  - 假宿主只按固定方式回复，用来模拟不回复等异常情况。

## 6. 仓库脚本

| 脚本 | 用途 |
| --- | --- |
| `scripts/fetch-sources.sh` | 把参考仓库拉取到 `local/sources/`，固定 commit |
| `scripts/check-public.sh` | 提交前检查本机路径、凭据、大文件，以及 `local/` 是否被跟踪 |
| `scripts/check-refs.py` | 检查文档中的源码引用是否有效 |
| `scripts/windows/check-env.ps1` | Windows 环境检查（只读） |
| `scripts/windows/install.ps1`、`uninstall.ps1` | 安装和卸载终端内补全（T-058、T-059）：复制程序、加入用户 PATH、运行 `is reinit` 和 `is init pwsh`、备份并修改 `$PROFILE`、创建默认补全配置。卸载时把 `$PROFILE` 和 PATH 恢复原样。支持 `-WhatIf`。安装包也调用这两个脚本 |
| `scripts/windows/profile-file.ps1`、`user-path.ps1` | 上面两个脚本共用：按原编码读写配置文件；直接读写注册表中的用户 PATH，保留 REG_EXPAND_SZ 和 `%变量%` |
| `scripts/windows/test-install.ps1` | 安装脚本的自测：只用临时目录、临时注册表键和一个假的 `is`，不碰真实环境。在 Mac 上可以用 `~/.powershell/pwsh` 运行（PATH 的 3 个用例只在 Windows 上运行） |
| `scripts/windows/build-installer.ps1` | 构建安装包，见第 7 节 |
| `scripts/windows/test-installer.ps1`、`check-installed.cjs` | 安装包的自动验收：静默安装、新开终端检查补全、升级、卸载。会修改当前用户的环境，只能在一次性的环境中运行（必须加 `-Disposable`） |

## 7. 安装包和 Windows 自动检查（T-059、T-061）

安装包用 Inno Setup 7.1 编译（D-015），脚本是 `installer/figwin.iss`。安装时复制文件，然后调用 `install.ps1`；卸载时先调用 `uninstall.ps1`，再删除文件。

构建（Windows，PowerShell 7，需要 Inno Setup 7.1 或更新版本）：

```powershell
pwsh -File scripts/windows/build-installer.ps1            # 打包 is.exe 并编译，结果在 dist/
pwsh -File scripts/windows/build-installer.ps1 -SkipPackage -Iscc <ISCC.exe 的路径>
```

在 Mac 上可以加 `-SkipPackage -StageOnly`，只检查准备安装文件的步骤：许可证、第三方声明、脚本、默认配置。

每次推送到 `develop` 或 `ai/**` 分支时（只改文档的除外），`.github/workflows/windows.yml` 在 GitHub 的 Windows 虚拟机中运行三个作业：

| 作业 | 内容 | 附件 |
| --- | --- | --- |
| tests | inshellisense 的 L1 测试、宿主测试、`test-install.ps1` | — |
| installer | 构建安装包，用 `test-installer.ps1 -Disposable` 实际安装、升级、卸载 | `figwin-setup`（安装包和 SHA256）、`installer-test-logs` |
| t056 | T-056 对照试验（`spikes/T-056-resize-sim/matrix.cjs`） | `t056-matrix` |

结果摘要在每次运行的 Summary 页面；失败项和 T-056 的结果另有 annotation。公开仓库的 annotation 不登录也可以通过 GitHub API 读取，Mac 端没有 `gh` 时可以这样查看结果。

