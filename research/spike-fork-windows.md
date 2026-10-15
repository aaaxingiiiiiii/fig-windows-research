# T-048 Windows 修改版验收

2026-10-15，Codex/GPT-6（Windows），分支 ai/codex/T-048。

状态：doing。已同步 develop（含 T-054/T-055）并构建成功；Windows L1 376 通过、10 跳过、0 失败，93 快照通过。日志在 local/evidence/T-048-build.txt、T-048-tests.txt；含个人路径不公开。人工 1–8 项尚未确认，准备先测试 1–3 项；T-056 拖动窗口错位另做对照，不替代原清单。


## 第一批人工反馈

- 第 1 项：用户确认 main/demo-feature 分支候选出现；原生命令日志尚未核实，不能标为完整通过。本机常规用户目录及原版隔离目录中未找到预期 log，需确认实际运行日志位置与版本。
- 第 2 项：用户确认中文目录补全、空格保留及进入正常。
- 第 3 项：用户确认五种特殊字符目录全部能补全并进入。
- T-056 对照：用户确认修改版拖动窗口后仍然错位，原版和修改版均有此现象；修改版恢复性未单独确认。待修复，不因其他用例通过而关闭。


## 版本核实与前述结论更正

观察：后续截图的日志目录仍为原版隔离 runtime-home，且常规日志不存在。读取本机相关进程后确认当前运行链为官方 bin.js -s pwsh → inshellisense-win32-x64.exe → pwsh；未发现修改版 build/index.js 进程。因此前述人工第 1–3 项及“修改版仍复现 T-056”均不能作为修改版验收证据，需切换后重测。无法回溯确认每次历史输入所属进程，保留反馈但撤回版本归属。

本批反馈：4 无包名；5 图中有 staged.txt/tracked.txt，未展示 --staged；6 图中 npm run 已被执行，仅 node 候选有 demo.js；8 图中 npm run -w 缺末尾空格，仍在选项候选阶段。以上均不直接登记为修改版代码缺陷。截图保存 local/evidence/T-048-version-check-1.png 至 -4.png，含个人路径不公开。

下一步：在全新 WT 标签显式启动本仓库 build/index.js -s pwsh -V，先核实相关进程和日志，再批量重测。L1 376 通过的自动结果仍有效；人工 1–8 项保持待确认。


## 无人值守引擎集成验证

使用最新构建、Shell.Pwsh、正式安装的 PowerShell 7.6.7，直接验证实际候选、替换内容与 cd 执行结果。13 项检查全部通过：分支 1 项、中文/特殊字符路径 6 项、全局包 1 项、git diff/--staged 2 项、npm scripts/node 文件 2 项、workspaces 1 项。复现入口 spikes/T-048-engine-check/check.mjs，结果 local/evidence/T-048-engine.json；日志 T-048-engine.log。

第 4 项首次按清单要求 npm 包名时失败；npm ls -g 表明本机全局安装的是 pnpm 与 rea-agents，npm 本体不在该全局 prefix。改为核对实际安装列表后通过；不安装额外软件来凑通过条件。需整合者确认清单的 npm 示例说明，不擅自修改原清单。

这些是引擎与原生命令集成证据，不代表 WT 人工 1–8 项已通过。无人值守期间保留人工关卡待确认。

日志核对：git 原生执行 8 次、npm 原生执行 2 次；Node 模拟 bash 4 次、cat 1 次、ls 2 次；未出现 Git Bash 回退日志。最新全量 L1 376 通过、10 跳过、0 失败，93 快照通过，构建成功。
