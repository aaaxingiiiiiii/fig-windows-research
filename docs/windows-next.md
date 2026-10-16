# Windows 端当前工作指令

更新：2026-10-16 第 3 版（D-014：先把功能做完，需要用户在场的测试放到最后）。读者：Windows 端的 AI。

用户只需要对你说：“同步 develop，读 `docs/windows-next.md`，按顺序做。”本页写明了接下来要做的每一步：什么时候需要先问用户，结果记在哪里，怎样才算完成。背景和验收标准的出处，见文中给出的链接。

本页由 Mac 端的整合者维护。做完一步后，在任务板和 log 中记录即可，**不要修改本页**；本页过时时，由整合者重写。

## 这一版改了什么

- **D-014**：用户决定，需要用户在场的测试先放一边，先把功能做完。最终交付 Windows 安装包和配置。所以：
  - 不要再约用户做 T-048 的 8 项人工清单、T-056 的手动复现、T-057 的新标签确认；这些在第 4 节，等功能完成后一起做。
  - 不在用户的电脑上运行安装包，也不修改用户真实的 `$PROFILE` 和 PATH。
- **安装包（T-059）已由 Mac 端写好**：`installer/figwin.iss`、`scripts/windows/build-installer.ps1`。构建和安装、升级、卸载的验收都在 GitHub Actions 的一次性 Windows 虚拟机中进行（T-061，`.github/workflows/windows.yml`），不需要在你这边安装 Inno Setup。
- **T-056**：Mac 端分析了你的复现结果，推断了原因（F-035），并准备了候选修复和一键对照试验，见第 1 步。

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
   - 安装软件、修改用户配置之前，先问用户并得到同意。D-013 已授权的（PowerShell 7、WT 默认配置、.NET 10 SDK）都已经做完。
   - 截图和原始日志存到 `local/evidence/`，在 `research/evidence.md` 中登记。
   - 公开的报告中不写用户名、本机路径和个人数据。

## 1. T-056 对照试验，以及新测试的复验（不需要用户，约 15 分钟）

1. 在 `src/inshellisense/` 下构建最新的修改版，并重新解包资源（从源码运行时，资源的版本是 `__VERSION__`）：

   ```powershell
   npm ci
   npm run build
   node build/index.js reinit
   npm test -- --ci
   ```

   `npm test` 中有 Mac 端新增的 9 个测试（`isterm/windowsPty`、`figspec/shellInit`、`figspec/configTemplate`）。其中 `shellInit` 会用真实的 pwsh 运行初始化脚本，需要正式安装的 PowerShell 7 在 PATH 中。把结果与上次（376 通过）对比，多出的失败先记录下来。
2. 在仓库根目录运行对照试验（约 6 分钟，正式安装的 PowerShell 7 要在 PATH 的最前面，和 E-012 时一样）：

   ```powershell
   node spikes/T-056-resize-sim/matrix.cjs pwsh
   ```

   - 屏幕上最后打印的表格只有坐标和是否对齐，可以公开，原样写入 `research/spike-fork-windows.md` 的新一节“T-056 对照试验”。
   - 完整输出在 `local/evidence/T-056-matrix/`，含提示符和本机路径，不公开，在 `research/evidence.md` 中登记。
   - 怎样读表格，见 `spikes/T-056-resize-sim/README.md` 的“对照试验”一节。你只需要记录结果，修改由 Mac 端完成。
   - 在任务板 T-056 的负责人一栏注明“对照试验已完成，等待 Mac 端修复”。
3. 运行安装脚本的自测：`pwsh -NoProfile -File scripts/windows/test-install.ps1`。这次多了 3 个只在 Windows 上运行的用例，用于检查用户 PATH 的处理。它们只读写注册表中一个临时的子键（`HKCU\Software\figwin-install-test-*`，测试结束后删除），不碰真实的 PATH。全部通过时退出码为 0；把通过的项数记入 log。

## 2. 阶段 B：继续做功能（不需要用户）

验收中需要用户在场的部分（B3 的 7 项、B4 的人工项），按 D-014 留到第 4 节。

1. **T-021 原生悬浮窗演示**（进行中）：先把窗口做出来，并用 wt-driver 做能自动化的检查，例如置顶、不激活、跟随 WT 移动。完成标准中需要用户看画面的项目，在任务板中写明“待用户验收（D-014）”，然后继续下一步，不要停下来等。
2. **T-019 光标定位**：依赖 T-029（已完成）。测量方法见 `docs/windows-setup.md`，通过标准见 `docs/overlay-design.md`。能用 wt-driver 和 UIA 自动测量的先测；需要用户配合的（输入法、缩放、多显示器）留到第 4 节。
3. **T-044 宿主集成**：在 Windows 上实现 `IOverlayPresenter`，说明见 `src/overlay-host/README.md`。.NET SDK 用 `local/tools/dotnet` 中的那份（E-014）。
4. 每完成一个任务，推送后 GitHub Actions 会自动在虚拟机中跑一遍测试（T-061）。

## 3. 安装包（T-059）：只看结果，不在本机安装

- 安装包由 GitHub Actions 构建。每次推送后，在仓库的 Actions 页面 → **Windows** → 对应的运行中，可以看到 `installer` 作业的验收摘要，并下载 `figwin-setup` 附件。
- 如果 `installer` 或 `tests` 作业失败，而失败的原因在你这边能复现（例如 L1 测试在 Windows 上失败），就按第 6 节新建任务。不要为了让 CI 通过而修改测试的期望。
- **不要在用户的电脑上运行安装包**。用户最后会自己运行它（第 4 节）。如果用户同意，也可以在 Windows Sandbox 中试装，那样不影响用户的环境：
  - 开启 Windows Sandbox 是系统设置的修改，要先问用户；
  - 在 Sandbox 中可以运行 `scripts/windows/test-installer.ps1 -Setup <安装包> -Disposable`。

## 4. 功能完成后，和用户一起做的验收（现在不做）

等阶段 B 的功能完成、整合者更新本页之后，再请用户在场，按下面的顺序一次做完：

1. T-057：在用户自己的 WT 新标签中确认 PowerShell 7 是默认配置。
2. 用户运行安装包，按 `docs/roadmap.md` 第 4 节 A3 的清单验收：安装、新开标签出现补全、再次安装、卸载后恢复原样。
3. T-048 的 8 项人工清单（`docs/mvp-plan.md`）。
4. T-056：如果到那时还有错位，再做手动复现。
5. 阶段 B 的人工验收：B3、B4、B5。

## 5. 每次结束时

1. 在任务分支上提交 → 同步 develop → 合并 → 推送到 `origin`（对方仓库）的 develop 和任务分支。
2. 更新 `tasks/board.md` 中自己的任务行，在 `docs/log.md` 末尾追加一条记录。
3. 用一小段话告诉用户：做完了什么；下一步是本页的哪一步；有没有需要用户决定的事。按 D-014，不要约用户做测试。

## 6. 遇到问题时

| 情况 | 处理 |
| --- | --- |
| 代码缺陷 | 在任务板中新建任务，env 填 `any`，写明复现步骤；Mac 端修复后，你只复验失败的项 |
| 关卡不通过 | 写入 `docs/decisions.md`，状态设为“待决定”，交给用户决定；不要自行选择退路 |
| 环境问题（缺软件、版本不对） | 写入报告；需要安装时先问用户；必要时补充 `docs/windows-setup.md` |
| 本页与其他文档矛盾 | 以本页的顺序为准，并在 log 中写明矛盾之处，由整合者修正 |
