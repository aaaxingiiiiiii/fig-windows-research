# Mac 运行时观察环境

T-012、T-013 这类任务需要 Mac（`env: mac-kiro`）。只读源码或写文档的任务不需要 Mac。

## 1. 需要什么

| 项目 | 要求 | 检查命令 |
| --- | --- | --- |
| macOS | 能运行 Kiro CLI 的版本 | `sw_vers` |
| Kiro CLI | 已安装、已登录，补全功能已启用 | `kiro-cli --version`、`kiro-cli doctor` |
| 终端 | 记录终端名称和版本；Kiro 支持的终端见其文档 | — |
| shell | zsh、bash 或 fish | `$SHELL --version` |
| 录屏 | 系统自带截图工具（Shift+Cmd+5）即可 | — |
| git | 拉取参考源码 | `git --version` |

Kiro CLI 的安装方式以 [Kiro 官方文档](https://kiro.dev/docs/cli/) 为准。安装和登录需要用户自己操作，AI 不要代替用户登录账号。

## 2. 开始观察前

```bash
sh scripts/fetch-sources.sh          # 拉取参考源码，用于对照
kiro-cli --version                   # 记录到 research/target.md
kiro-cli settings list               # 记录与默认值不同的设置
```

如果版本与 `research/target.md` 中记录的不同，先更新哈希（方法见 `research/evidence.md` 中的 E-001），并在 log 中注明。

## 3. 观察的方式

- 只做黑盒观察：看界面、录屏、记录命令输出（D-001）。不要反编译或修改 Kiro 的二进制。
- 每条用例按 `specs/completion.md` 末尾的模板记录。录屏和截图保存到 `local/evidence/E-xxx-*`，并在 `research/evidence.md` 登记。
- 截图中可能出现用户名、路径或主机名。公开仓库里只写文字结论，原始文件留在 `local/`。
- macOS 的权限（屏幕录制、辅助功能）在系统提示时由用户决定是否授予，不要预先申请宽泛的权限。

## 4. 可选：原生逆向工具

之前计划的 REA、Ghidra、Hopper 已不是前置条件（D-001）。只有在出现源码无法解释、并且确实需要分析某个开源程序的二进制时，才在用户同意后配置。参考资料：[REA 安装说明](https://github.com/morluto/rea/blob/main/docs/installation.md)。
