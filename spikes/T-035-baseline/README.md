# T-035 Windows 原版实测入口

此启动器调用官方 npm 包 0.0.4，不修改它的代码。依赖和运行缓存均在 Git 忽略的 `local/tools/inshellisense-baseline/` 下。

在仓库根目录执行：

```powershell
npm.cmd install --prefix local/tools/inshellisense-baseline --save-exact @microsoft/inshellisense@0.0.4
node spikes/T-035-baseline/run-baseline.cjs init pwsh
node spikes/T-035-baseline/run-baseline.cjs --version
node spikes/T-035-baseline/run-baseline.cjs doctor
node spikes/T-035-baseline/run-baseline.cjs complete 'git ch'
node spikes/T-035-baseline/run-baseline.cjs -s pwsh
```

第一次先执行 init，解包官方自带资源。它只打印启动配置语句；不要执行输出或将其写进 `$PROFILE`。交互启动后用 `exit` 退出。

需要 Node 22 和可通过 PATH 找到的 PowerShell 7。若普通终端中找不到 `pwsh`，先记录实际环境，再按用户授权准备运行时；本次自动验证使用 Agent 提供的 PowerShell。

启动器仅为子进程设置 USERPROFILE，指向项目内的 runtime-home，以隔离工具自身的缓存与配置。父进程和系统环境变量不变，PowerShell 的启动配置未被修改。这个隔离环境不能替代用户日常配置下的兼容性验收。

自动验证结果见 `research/spike-inshellisense.md`。人工测试使用 `docs/mvp-plan.md` 的 16 项 T-035 清单；当前没有完成这份清单，不应标记关卡通过。
