# Windows 端当前工作指令

更新：2026-10-15 第 2 版（D-013 授权；T-048 要确认运行的是修改版）。读者：Windows 端的 AI。

用户只需要对你说：“同步 develop，读 `docs/windows-next.md`，按顺序做。”本页写明了接下来要做的每一步：什么时候需要先问用户，结果记在哪里，怎样才算完成。背景和验收标准的出处，见文中给出的链接。

本页由 Mac 端的整合者维护。做完一步后，在任务板和 log 中记录即可，**不要修改本页**；本页过时时，由整合者重写。

## 0. 每次开工前

1. 同步代码。对方仓库（`xingdouiii-maker/fig-windows-research`）在你这边一般叫 `origin`：

   ```powershell
   git fetch --all
   git switch develop
   git merge --ff-only origin/develop
   ```

   不能快进时改用 `git merge`，保留双方的提交。合并后确认本页顶部的更新日期没有变旧。
2. 阅读 `AGENTS.md` 和 `docs/handoff.md`，然后回到本页，从第一个还没完成的步骤开始。是否完成，以 `tasks/board.md` 中的状态为准。
3. 规则：
   - 一个任务一个分支，命名为 `ai/codex/<任务号>`。
   - 合并回 develop 前先同步。
   - 不要重写 `docs/handoff.md`。
   - 安装软件、修改用户配置之前，先问用户并得到同意。例外：D-013 已授权的事项（安装 PowerShell 7、设为 WT 默认、安装 .NET 10 SDK）不必再问。
   - 截图和原始日志存到 `local/evidence/`，在 `research/evidence.md` 中登记。
   - 公开的报告中不写用户名、本机路径和个人数据。
4. 和用户一起测试时，每次只说一项操作，等用户回答“是”或“否”再继续。需要看日志的，你自己去读，不要让用户读。

## 1. T-057：正式安装 PowerShell 7（先问用户）

为什么要做：T-035 时用户的 Windows Terminal 中找不到 `pwsh.exe`，测试用的是你自带的 PowerShell。目标 shell 是 PowerShell 7（D-002），后面的测试和日常使用都需要它装在系统里。

**已经授权，不必再问用户**（D-013：用户外出前授权整合者按推荐方案处理，推荐方案就是安装）。

1. 运行 `winget install --id Microsoft.PowerShell --source winget`。
2. 把 PowerShell 7 设为 Windows Terminal 的默认配置文件：
   - 用户在场时，请用户操作：设置 → 启动 → 默认配置文件，选择 PowerShell（不是 Windows PowerShell）→ 保存。
   - 用户不在时，可以直接修改 `settings.json`：先备份到 `local/evidence/T-057-wt-settings-backup.json`，再把 `defaultProfile` 改成 PowerShell 7 配置文件的 GUID。WT 会自动重新加载。
3. 验证：新开一个 WT 标签，运行 `$PSVersionTable.PSVersion`，应显示 7.x；在这个标签中运行 `pwsh -NoProfile -File scripts/windows/check-env.ps1`。用户在场时请用户自己开标签，确认 WT 的默认配置真的生效了。
4. 把结果写入 `research/spike-inshellisense.md` 的新一节“T-057”，在任务板中把 T-057 改为 `done`，并在 log 中写明“按 D-013 执行”。

## 2. T-048：关卡二，测试我们的修改版（需要用户在场，约 30 分钟）

验收标准见 `docs/roadmap.md` 第 4 节 A2；8 项清单见 `docs/mvp-plan.md` 中的“T-048 人工清单”。

1. **用最新的 develop**，其中包含 Mac 端 T-054、T-055 的修改，不要用 T-035 时的版本。在 `src/inshellisense/` 下执行：

   ```powershell
   npm ci
   npm run build
   npm test -- --ci
   ```

   把测试结果与 E-011 对比，多出的失败先记录下来。
2. 检查测试材料。可以沿用 T-035 准备的 `local/acceptance/` 目录，确认清单需要的都有：
   - 7 个特殊名称的文件夹：`My Docs`、`a&b`、`a$b`、`it's`、`it's dir`、`` a`b ``、`中文目录`；
   - 一个 git 仓库：有一个已提交后又修改的文件，和一个新建并暂存的文件；
   - 一个 npm 项目：有 `scripts`、`workspaces` 和一个子文件夹；
   - 至少一个全局安装的 npm 包（清单第 4 项会用到，npm 本身即可）。
3. 请用户在**自己的 PowerShell 7 标签**中进入仓库的 `src/inshellisense/`，然后：
   1. **先确认运行的是修改版**：运行 `node build/index.js --version`，应该显示 `__VERSION__`。从源码构建的版本才显示这个占位符；原版显示 `0.0.4`。上一次 T-048 实际运行的是原版，结果已经作废。
   2. 不要用 `spikes/T-035-baseline/` 的启动器，也不要用全局安装的 `is`，它们都是原版。
   3. 运行 `node build/index.js -s pwsh -V`，然后 `cd` 到测试材料目录。第 8 项要求先 `cd` 进项目，而不是在项目中启动。
   4. 确认 `%USERPROFILE%\.inshellisense\log\inshellisense.log` 的修改时间是刚才。原版启动器把用户目录改到了 `local/tools/` 下，日志不在这里。
4. 按清单逐项进行。第 1、4、5、6 项要检查日志：你自己读取 `%USERPROFILE%\.inshellisense\log\inshellisense.log`，确认其中的 `ran natively`、`emulated in node`，以及有没有 `git bash`。
5. 把结果写入 `research/spike-fork-windows.md`：
   - 开头是环境表，用 check-env 的输出；
   - 然后每项一行：编号、是 / 否、现象、证据编号。
6. 判定：
   - 8 项全部为“是”：把 T-048 改为 `done`，告诉用户关卡二通过。
   - 有“否”：每个失败项在任务板中新建一个任务，env 填 `any`，写明复现步骤和日志中的相关行（删去个人信息），推送后告诉用户“交给 Mac 端修复”。修复合并后，只复验失败的项。

## 3. T-056：复现“拖动窗口大小后候选错位”（需要用户在场，约 10 分钟，可接在 T-048 之后）

T-035 第 10 项发现的问题：拖动窗口大小后，候选和输入位置错开，清屏可以恢复。这一步只负责复现和记录，分析和修复由 Mac 端完成。

1. 用修改版（`node build/index.js -s pwsh -V`）。开始前记下窗口的行数和列数：`$Host.UI.RawUI.WindowSize`。
2. 请用户依次尝试下面几种情况，每种都回答“错位”或“正常”，错位时截图：
   1. 输入 `git ch`，候选出现后，拖动窗口右边缘把窗口变窄；
   2. 同上，把窗口变宽；
   3. 先不输入，拖动窗口大小，再输入 `git ch`；
   4. 最大化窗口，再还原；
   5. 用 Alt+Shift+加号分屏。
3. 每种情况错位后，依次试：按 Esc；再输入一个字符；运行 `Clear-Host`。记录哪一步能恢复。
4. 把每次拖动前后几秒的日志片段复制到 `local/evidence/T-056-*.log`。日志的时间戳可以帮助对齐；不公开原始日志。
5. 把结果写入 `research/spike-fork-windows.md` 的“T-056 复现”一节，包括：WT 版本、拖动前后的窗口大小、触发错位的情况、恢复方法。在任务板中，T-056 的负责人一栏写上“已复现，等待 Mac 端分析”。

## 4. T-040：打包和安装（T-048 通过、T-057 完成之后）

按 `docs/mvp-plan.md` 中 T-040 的步骤和 `docs/roadmap.md` 第 4 节 A3 的 7 项清单进行：

- 修改用户的 `$PROFILE` 之前，先问用户；
- 最好在 Windows Sandbox 中验证安装和卸载；
- 完成后更新 `docs/usage.md` 第 1 节；
- 然后告诉用户可以开始试用（T-041，记录方式见 A4）。

## 5. 用户不在时：阶段 B 的准备

1. 安装 .NET 10 SDK（D-012；已按 D-013 授权，不必再问）：`winget install Microsoft.DotNet.SDK.10`。
2. 装好后，在 `src/overlay-host/` 下运行 `dotnet test OverlayHost.slnx`。Mac 上的结果是 70 个全部通过；把 Windows 上的结果记入 log，失败时新建任务。
3. 按顺序做：
   - T-029 自动测试工具（`tools/wt-driver`，验收见 roadmap B2）；
   - T-021 悬浮窗演示：先做出来，等用户在场时按 B3 的 7 项验收；
   - T-019 光标定位：依赖 T-029，测量方法见 `docs/windows-setup.md`。
4. 以上完成后做 T-044：在 Windows 上实现 `IOverlayPresenter`，说明见 `src/overlay-host/README.md`。

## 6. 每次结束时

1. 在任务分支上提交 → 同步 develop → 合并 → 推送到 `origin`（对方仓库）的 develop 和任务分支。
2. 更新 `tasks/board.md` 中自己的任务行，在 `docs/log.md` 末尾追加一条记录。
3. 用一小段话告诉用户：做完了什么；下一步是本页的哪一步；有没有需要用户决定或在场的事。

## 7. 遇到问题时

| 情况 | 处理 |
| --- | --- |
| 代码缺陷 | 在任务板中新建任务，env 填 `any`，写明复现步骤；Mac 端修复后，你只复验失败的项 |
| 关卡不通过 | 写入 `docs/decisions.md`，状态设为“待决定”，交给用户决定；不要自行选择退路 |
| 环境问题（缺软件、版本不对） | 写入报告；需要安装时先问用户；必要时补充 `docs/windows-setup.md` |
| 本页与其他文档矛盾 | 以本页的顺序为准，并在 log 中写明矛盾之处，由整合者修正 |
