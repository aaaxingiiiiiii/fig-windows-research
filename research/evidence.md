# 本地证据索引

原始文件位于 `local/evidence/`，不提交。其他机器上的 AI 无法读取这些文件，所以“产生方式”一栏要写到可以复现。

| 编号 | 内容 | 产生方式 | 目标 | 日期 | 含个人数据 |
| --- | --- | --- | --- | --- | --- |
| E-001 | Kiro CLI app 各可执行文件和前端资源的 SHA-256 | 对 `Kiro CLI.app/Contents/` 下 `MacOS/*`、输入法可执行文件、`Resources/autocomplete/` 运行 `shasum -a 256` | Kiro CLI 2.30.0 | 2026-10-14 | 输出含本机路径，公开版已去除路径 |
| E-002 | 前端打包文件的字符串统计 | 用 `grep -o -F` 统计 `insertValue`、`insertCommonPrefix`、`specs.q.us-east-1` 等字符串，并提取 `https://` 链接 | `index-Ct4Ru0Ux.js`（哈希见 target.md） | 2026-10-14 | 否 |
| E-003 | Shell 集成脚本输出 | `kiro-cli init {zsh,bash,fish} {pre,post}`，在非交互的工具 shell 中运行；另试 `init pwsh pre` 和 `init powershell pre`，均报错 | Kiro CLI 2.30.0 | 2026-10-14 | 输出含 `$HOME` 展开后的路径 |
| E-004 | Bundle 元数据与签名 | 读取 `Info.plist`、`Resources/manifest.json`；运行 `codesign -dv --verbose=2`；运行 `file` 查看架构 | Kiro CLI 2.30.0 | 2026-10-14 | 否 |
