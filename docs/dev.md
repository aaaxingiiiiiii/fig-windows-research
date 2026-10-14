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
npm test               # 单元测试（jest）
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

从源码运行时，`--version` 显示 `__VERSION__` 占位符，打包时才会替换成真实版本号。

**Windows 上的 generator 执行方式（T-037）**：先用 cross-spawn 直接执行命令；只有命令找不到时才退回 Git Bash。用 `-V` 运行时，日志 `inshellisense.log` 会记录每条命令走的是哪条路径。

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
npm test                                                                          # 运行全部测试，包含规格用例
```

约定：
- 与 Fig 只是做法不同的地方，断言 inshellisense 的实际行为，并在测试名称中写“差异”。
- 已知缺陷用 `test.failing` 写出正确的期望，修复后改为 `test`。不要为了让测试通过而改动期望。
- 新增用例时，同步更新 `specs/completion.md` 的第 9 节或第 10 节。

2026-10-14 在 Mac 上的结果（T-037 之后）：全部测试 239 个，228 个通过，10 个跳过，1 个失败（`brewInstallMullvad`，见上文）。我们新增的测试有 26 个（规格用例 22 个、执行方式 4 个），全部按预期执行；只剩 2 个 `test.failing`。

## 4. 仓库脚本

| 脚本 | 用途 |
| --- | --- |
| `scripts/fetch-sources.sh` | 把参考仓库拉取到 `local/sources/`，固定 commit |
| `scripts/check-public.sh` | 提交前检查本机路径、凭据、大文件，以及 `local/` 是否被跟踪 |
| `scripts/check-refs.py` | 检查文档中的源码引用是否有效 |
| `scripts/windows/check-env.ps1` | Windows 环境检查（只读） |
