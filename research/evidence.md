# 本地证据索引

原始文件位于 `local/evidence/`，不提交。其他机器上的 AI 无法读取这些文件，所以“产生方式”一栏要写到可以复现。

| 编号 | 内容 | 产生方式 | 目标 | 日期 | 含个人数据 |
| --- | --- | --- | --- | --- | --- |
| E-001 | Kiro CLI app 各可执行文件和前端资源的 SHA-256 | 对 `Kiro CLI.app/Contents/` 下 `MacOS/*`、输入法可执行文件、`Resources/autocomplete/` 运行 `shasum -a 256` | Kiro CLI 2.30.0 | 2026-10-14 | 输出含本机路径，公开版已去除路径 |
| E-002 | 前端打包文件的字符串统计 | 用 `grep -o -F` 统计 `insertValue`、`insertCommonPrefix`、`specs.q.us-east-1` 等字符串，并提取 `https://` 链接 | `index-Ct4Ru0Ux.js`（哈希见 target.md） | 2026-10-14 | 否 |
| E-003 | Shell 集成脚本输出 | `kiro-cli init {zsh,bash,fish} {pre,post}`，在非交互的工具 shell 中运行；另试 `init pwsh pre` 和 `init powershell pre`，均报错 | Kiro CLI 2.30.0 | 2026-10-14 | 输出含 `$HOME` 展开后的路径 |
| E-004 | Bundle 元数据与签名 | 读取 `Info.plist`、`Resources/manifest.json`；运行 `codesign -dv --verbose=2`；运行 `file` 查看架构 | Kiro CLI 2.30.0 | 2026-10-14 | 否 |
| E-005 | Windows 环境检查 | pwsh -NoProfile -File scripts/windows/check-env.ps1；dotnet --list-sdks 确认无 SDK | Windows 11 / T-035 | 2026-10-14 | 公开报告仅含版本；完整输出保留 local/ |
| E-006 | 官方原版命令与受控 PTY 冒烟检查 | 按 spikes/T-035-baseline/README.md 初始化、doctor、complete；交互输入 git ch、下方向键、Tab，Ctrl+C 取消后 exit | inshellisense 0.0.4 / pwsh 7.6.5 | 2026-10-14 | 终端记录含本机路径，不公开原始记录；不等同 WT 人工验收 |
| E-007 | `init <shell> post` 在不同环境下的输出（T-013） | 在仓库根目录分别运行：① `kiro-cli init zsh post [--rcfile zshrc]`；② `script -q /dev/null sh -c 'kiro-cli init zsh post --rcfile zshrc \| wc -l'`；③ 加上 `Q_TERM=1`；④ 只加 `QTERM_SESSION_ID=<任意 UUID>`；⑤ bash、fish 的 post 各运行一次，比较有无 `Q_TERM=1` 的区别；⑥ 用 diff 对比 ③ 的输出与开源 `post.zsh`（把 `{{CLI_BINARY_NAME}}` 换成 `kiro-cli`）。行数：zsh 4/197，bash 4/573，fish 3/115；② 为 4；④ 为 4；pre 不受影响（80） | Kiro CLI 2.31.0 | 2026-10-15 | 输出含 `$HOME` 展开后的路径，原始文件在 `local/evidence/T-013/` |
| E-008 | Windows 修改版 L1 预检 | 按 research/spike-inshellisense.md 的安装、构建、Jest 命令复现；local/evidence/T-035-source-{install,build,tests}.txt 与 T-035-source-tests.json | mac/develop bd5a6ec，npm 锁定依赖 | 2026-10-15 | 原始日志含本机路径，不提交；253 通过、10 跳过、11 失败，见 T-052 |
| E-009 | Windows T-052 修复后复验 | 在 src/inshellisense 执行 npm test -- --ci --runInBand --json --outputFile=../../local/evidence/T-052-tests.json；npm run build；对三个修改测试文件运行 ESLint | 本仓库 T-052 测试改动，锁定依赖 | 2026-10-15 | 265 通过、10 原有跳过、0 失败；93 快照通过；原始日志含本机路径，仅存 local/evidence/T-052-tests.txt 和 JSON |
| E-010 | T-012 规格用例的人工观察 | 用户在 macOS 自带的“终端”中（窗口标题显示 zsh 由 `kiro-cli-term` 包装），按 `specs/completion.md` 第 8 节的 T-012 人工清单逐项操作，把回答写在清单旁，并截了 4 张图（C-004、C-007、C-008、C-009）。整理者把回答填入用例表，原始回答和截图移到 `local/evidence/T-012/` | Kiro CLI 2.31.1 | 2026-10-15 | 截图含用户名、主机名、路径和 Dock，不公开 |
