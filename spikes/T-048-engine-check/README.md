# T-048 Windows 补全引擎自动检查

在仓库根目录执行 `node spikes/T-048-engine-check/check.mjs`。先构建 src/inshellisense，并设置 FIGWIN_TEST_PWSH 为正式 PowerShell 7 可执行文件的绝对路径。需要 T-035 的 local/acceptance/T-035-20261015 材料（git-demo、npm-demo、特殊名称目录）。不安装或卸载包，不修改用户启动配置。

直接调用构建后的 getSuggestions（明确 Shell.Pwsh）与 calculateReplacement，并用 PowerShell 执行生成的 cd 参数，核对目标路径和删除数。第 4 项对比本机 npm ls -g 的实际包列表，不假定 npm 本身位于全局 prefix。输出 JSON 和 generator 日志到 local/evidence，原始材料不提交。

这是引擎/原生命令集成验证，不包含 Windows Terminal UI、Tab 实际按键、缩放、输入法或 ConPTY 画面；不能单凭它把 T-048 人工关卡改为通过。日志 enable 会重置当前运行用户的 inshellisense.log，应在独立测试会话执行并及时复制结果。
