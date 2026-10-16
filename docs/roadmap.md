# 后续工作与验收流程

更新：2026-10-16（D-014 之后）。读者：接手的 AI（Mac、Windows 各端）和负责人工验收的用户。

本页说明三件事：剩下的工作按什么顺序做、由哪一端做；每一步做完后如何验收；验收不通过时如何处理。其他内容见：

| 想知道 | 看哪里 |
| --- | --- |
| 现在做到哪了、谁在做什么 | `docs/handoff.md`、`tasks/board.md` |
| 每个任务的实现步骤和完成标准 | `docs/mvp-plan.md` 第 6、7 节 |
| T-035、T-048 的人工清单 | `docs/mvp-plan.md` 第 6 节（不在本页重复） |
| 协作规则 | `AGENTS.md`、`docs/workflow.md` |

本页新增的验收清单（T-040、T-041、阶段 B）以本页为准。修改清单时，不能为了通过而放宽标准；确实需要改的，在 `docs/decisions.md` 中写明原因。

## 1. 路线图

```text
阶段 A：终端内版本
  ┌ [Windows + 用户] T-035 实测原版 inshellisense ── 关卡 ①（进行中）
  ├ [Windows + 用户] T-048 实测我们的修改 ──────── 关卡 ②（可与 T-035 同一次完成）
        ↓ T-035、T-048 通过
  [Windows]        T-040 打包、安装、卸载
        ↓
  [用户]           T-041 日常试用一到两天 ──────── 里程碑 A：终端内版本可用

阶段 B：悬浮窗（与阶段 A 后半段并行）
  [Mac，Claude]    T-043 渲染器抽象和悬浮窗渲染器（已完成；假宿主见 spikes/T-043-fake-host）
  [Windows]        T-029 自动测试工具 wt-driver
  [Windows + 用户] T-021 原生悬浮窗演示 ─────────── 可以先单独看效果
  [Windows + 用户] T-019 光标定位 ──────────────── 关卡 ③
        ↓ T-043、T-019、T-021 完成
  [Mac，Claude]    T-053 宿主协议核心（已完成；src/overlay-host/）
  [Windows]        T-044 宿主集成（实现 IOverlayPresenter）── 里程碑 B1：第一次看到悬浮补全
        ↓
  [Windows + 用户] T-045 端到端测试 → T-046 打包试用 ── 里程碑 B：悬浮窗版本可用

低优先级（Mac，Kiro）：T-012、T-013 已完成
```

## 2. 各端分工

| 端 | 当前 / 下一个任务 | 之后 | 说明 |
| --- | --- | --- | --- |
| Windows：AI 和用户 | T-035（自动检查已完成，等待用户完成 16 项人工清单）→ T-048；用户不在时做 T-029、T-021（见第 8.1 节） | T-040 → T-029 → T-021 → T-019 → T-044 → T-045 → T-046 | 凡是要看画面、用输入法、调缩放的步骤，都需要用户坐在 Windows Terminal 前操作 |
| Mac：Claude（整合者） | T-043 已完成；等待 Windows 验收结果 | 修复 Windows 验收中发现的缺陷（代码类任务的 env 为 any）；合并各端分支；重写 `docs/handoff.md` | 不能运行 Windows 程序；修复后由 Windows 端复验 |
| Mac：GPT | T-054（审查 T-043） | T-055 | 在独立的 worktree 中工作，见第 8.2 节；T-053 已由 Claude 认领 |
| 用户 | T-035、T-048 的人工清单 | T-050、T-041、T-045 的 L3 清单、T-046；处理仓库权限 | 每项只需回答“是”或“否”，回答“否”时附截图 |

### 两端如何同步代码

2026-10-15 起，所有端都直接推送到对方的仓库（D-008）。Mac 上它的远程名是 `upstream`，Windows 上是 `origin`。用户的 fork 只作备份。

每次开工前和合并任务分支前，执行：

```sh
git fetch --all
git switch develop
git merge --ff-only <对方仓库的远程>/develop   # 不能快进时改用 git merge，保留双方的提交
git push <对方仓库的远程> develop
```

不要 rebase，也不要强制推送。`docs/log.md` 冲突时保留双方的记录。任务分支也推送到对方的仓库，方便另一端查看。

## 3. 验收的通用规则

**三层测试**（`docs/mvp-plan.md` 第 5 节）：

| 层级 | 执行者 | 什么时候做 |
| --- | --- | --- |
| L1 单元测试 | AI，任何系统 | 每个代码任务结束时；Windows 端开始人工验收前，也在本机先运行一次 |
| L2 自动集成测试 | AI，Windows，借助 wt-driver | T-029 完成之后 |
| L3 人工验收 | 用户，Windows | 每个关卡和里程碑 |

**每次人工验收的步骤：**

1. 同步 `develop`（见第 2 节），在任务分支上工作。
2. 运行 L1：在 `src/inshellisense/` 下执行 `npm ci`、`npm run build`、`npm test -- --ci`，把结果和 `docs/dev.md` 中记录的结果对比。多出的失败要先记录下来。
3. AI 按清单准备测试材料（文件夹、git 仓库等），然后逐项把操作告诉用户，用户回答“是”或“否”。
4. 结果写入该任务的报告文件（见下表）。每项一行：编号、是 / 否、现象、证据编号。
5. 截图和日志存到 `local/evidence/`，在 `research/evidence.md` 中登记为 E-xxx。公开的报告中不写本机路径、用户名和个人数据。
6. 全部通过时，把任务改为 `done` 并合并分支。有未通过的项，按第 6 节处理。

| 任务 | 报告文件 |
| --- | --- |
| T-035 | `research/spike-inshellisense.md`（已创建） |
| T-048 | `research/spike-fork-windows.md` |
| T-040 | `research/spike-install.md` |
| T-041 | `research/trial-phase-a.md` |
| T-019 | `research/spike-caret.md` |
| T-021 | `research/spike-overlay-window.md` |
| T-044、T-045 | `research/spike-overlay-e2e.md` |
| T-046 | `research/trial-phase-b.md` |

## 4. 阶段 A 的验收

### A1. T-035：实测原版 inshellisense（关卡 ①）

- 状态：Windows 端的 AI 已完成环境检查和受控终端中的冒烟测试，代码在分支 `ai/codex/T-035`（还没有合并到 develop）。
- 启动方法：按该分支中的 `spikes/T-035-baseline/README.md` 操作。这个方法使用官方 npm 包 0.0.4，不修改 `$PROFILE`。
- 清单：`docs/mvp-plan.md` 中的“T-035 人工清单”，共 16 项，**必须在 Windows Terminal 中执行**。
- 判定：
  - 没有阻断问题即通过。阻断问题指画面错乱后无法恢复、丢失输入、误执行命令、明显卡顿。
  - 第 15、16 项是原版的已知缺陷（F-029、F-030），预期会失败，不算阻断。只记录实际的命令行内容，与 T-048 的结果对照。
- 不通过时：不要自行选择退路。在 `docs/decisions.md` 中写清现象和可选方案，状态设为“待决定”，交给用户。

### A2. T-048：实测我们的修改（关卡 ②）

- 可以和 T-035 在同一次操作中完成，先测原版，再测修改版。
- 启动方法（在 Windows Terminal 中的 pwsh 里，使用 Node 22）：

  ```powershell
  cd src/inshellisense
  npm ci
  npm run build
  node build/index.js -s pwsh -V
  ```

- 清单：`docs/mvp-plan.md` 中的“T-048 人工清单”，共 8 项。日志在 `%USERPROFILE%\.inshellisense\log\inshellisense.log`。
- 判定：8 项全部为“是”。
- 不通过时：每个失败项新建一个任务（env 填 `any`），写明复现步骤和日志中的相关行（删去个人信息）。Mac 端修复并补上 L1 测试，之后 Windows 端只需复验失败的项。

### A3. T-040：打包与安装

实现步骤见 `docs/mvp-plan.md`。验收在一台“干净”的环境中进行：可以用 Windows Sandbox、新建的 Windows 用户，或者没有安装过 inshellisense 的电脑。

2026-10-16 起，打包和安装由安装包完成（T-059）。第 1 至 6 项的自动部分由 `scripts/windows/test-installer.ps1` 在 GitHub Actions 的虚拟机中检查（T-061），每次推送都运行。在用户电脑上的最终验收，按 D-014 放到功能完成之后。

1. 安装前，记录 `$PROFILE` 的状态：文件不存在，或者记下 `Get-FileHash $PROFILE` 的结果。
2. 不用管理员权限运行 `install.ps1`，能顺利完成。输出中列出修改了哪些文件，以及备份放在哪里。
3. 新开一个 WT 标签，补全自动启用：输入 `git ch` 时出现候选。
4. 在没有安装 Node 的环境中（或者从 PATH 中去掉 node 之后），补全仍然可用，说明程序是单文件的。
5. 再运行一次 `install.ps1`，`$PROFILE` 中的初始化语句不会重复添加。
6. 运行 `uninstall.ps1` 后，`$PROFILE` 恢复到第 1 步的状态（哈希相同，或者文件仍然不存在）。程序文件已删除，新开的标签不再启用补全。
7. 记录杀毒软件和 SmartScreen 的提示（程序没有签名），不要求消除。

判定：第 1 至 6 项全部为“是”。

### A4. T-041：日常试用（里程碑 A）

- 用户正常工作一到两天，遇到问题时在 `research/trial-phase-a.md` 中记一行：日期、在做什么、发生了什么、严重程度、能否复现。
- 严重程度分三级：
  - **阻断**：无法输入、误执行命令、终端卡死、画面无法恢复；
  - **影响使用**：候选错误或缺失、明显延迟；
  - **小问题**。
- 试用结束时，对照 `docs/usage.md` 第 3 节，逐条决定 7 处与 Fig 的差异是否要改，结果记入 D-010。决定要改的，每一处新建一个任务。
- 判定：没有阻断问题即达到里程碑 A。经用户同意后，把 `develop` 合并到 `main` 作为里程碑（D-008）。“影响使用”的问题登记为任务，排在阶段 B 之前或与阶段 B 并行处理。

## 5. 阶段 B 的验收

协议见 `docs/protocol.md` v1。其中 P-01 至 P-12 是 T-043、T-044 必须实现的测试。

### B1. T-043：渲染器抽象（Mac，L1）

- 没有设置 `FIGWIN_OVERLAY_PIPE` 时，行为与现在完全一样：原有测试和 figspec 测试全部通过。
- 用假的管道服务端，覆盖 P-01 至 P-12 中可以在 Node 一侧测试的部分。每个测试名称中写上 P 编号，便于对照。
- 宿主不存在、超时、报告失败时，回到终端内绘制，并且不会阻塞或重放按键（P-07）。
- 由整合者审查后合并。T-043 不需要 Windows 人工验收。

### B2. T-029：自动测试工具

- 一个脚本能完成：启动 WT 和 pwsh，输入 `echo hi`，截图并保存。连续运行 3 次都成功。
- 截图存到 `local/evidence/`，不进入仓库。

### B3. T-021：原生悬浮窗演示（可以先单独看效果）

先用一个演示程序在 WT 上方显示固定的候选列表，不接入补全。用户逐项回答：

1. 列表窗口出现在 WT 上方，文字在 150% 缩放下清晰。
2. 窗口出现后，在 WT 中继续输入，字符没有丢失，焦点没有被抢走。
3. 点击列表窗口后，焦点仍然留在 WT。
4. 切换到其他程序时窗口隐藏，切回 WT 时窗口重新出现。
5. 最小化 WT 时窗口隐藏；移动 WT、调整 WT 大小时，窗口跟着移动。
6. 切换 WT 的标签页时，窗口隐藏。
7. 如果有第二块显示器：把 WT 拖过去，窗口跟着过去，大小正确。

判定：第 1 至 6 项为“是”，即达到 `docs/overlay-design.md` 中 T-021 的通过标准。报告写入 `research/spike-overlay-window.md`。

### B4. T-019：光标定位（关卡 ③）

- 测量方法和测试矩阵见 `docs/windows-setup.md` 中的“T-019 光标定位的测量方法”。
- 判定：所有组合下，误差都不超过半个字符宽度，并且 p95 耗时小于 15 ms。
- 不通过时：按 `docs/mvp-plan.md` 中“阶段 B 的退路”处理。终端内版本作为正式版，是否尝试其他定位方法由用户决定，先在 `docs/decisions.md` 中写明测量结果。

### B5. T-044：宿主集成（里程碑 B1：第一次看到悬浮补全）

1. 在 WT 中输入 `git ch`，悬浮列表出现在光标下方，误差不超过半个字符宽度。终端内不再绘制候选。
2. 按 ↓ 和 Tab，选中项随之变化，插入的结果与终端内版本相同。
3. `debugState` 中的 `receiveToDisplayMs` 小于 30 ms。
4. 结束宿主进程后，1 秒内回到终端内绘制，输入不受影响（P-07、P-08）。
5. 按 Esc、Enter、Ctrl+C，或打开全屏程序时，悬浮窗消失（P-09）。
6. 宿主一侧的 P-01 至 P-12 测试通过。

### B6. T-045、T-046：端到端测试与试用（里程碑 B）

- T-045：用 wt-driver 把 T-035 清单中可以自动化的项目写成 L2 测试，并全部通过。其余项目在悬浮窗模式下由用户逐项复验，包括输入法、粘贴、分屏、缩放、多显示器（P-05、P-10）。
- T-046：按 A3 的清单验收安装和卸载（加上宿主的开机自启和卸载），再按 A4 的方式试用，结果写入 `research/trial-phase-b.md`。没有阻断问题即达到里程碑 B。

## 6. 发现问题时如何处理

```text
Windows 验收发现问题
  → 在报告中写下：编号、复现步骤、实际结果、日志中的相关行（删去个人信息）、证据编号
  → 判断问题类型：
      · 代码缺陷 → 在 board 中新建任务（env：any），写明对应的清单项
      · 关卡不通过 → 在 decisions.md 中写“待决定”，交给用户
      · 环境问题（例如软件版本） → 写入报告，必要时更新 docs/windows-setup.md
  → Mac 或任意一端修复：先写一个能复现问题的 L1 测试，再修复；改动记入 CHANGES.md
  → Windows 端只复验失败的项，在报告中把该项改为“是”并注明是第几次复验
```

## 7. 接下来按顺序做

更新：2026-10-16，按 D-014 调整：先把功能做完，需要用户在场的验收放到最后，最终交付 Windows 安装包和配置。

1. **Mac · Claude**：T-056。根据 Windows 端或 GitHub Actions（T-061 的 `t056` 作业）的对照试验结果，选定修复方法，删除试验用的环境变量，补上回归测试。
2. **Windows 端的 AI**（不需要用户，见 `docs/windows-next.md`）：
   1. T-056 对照试验和新测试的复验；
   2. 阶段 B 的功能：T-021 → T-019 → T-044。
3. **GitHub Actions**（T-061，自动）：每次推送后在 Windows 虚拟机中运行 L1 测试，并构建安装包（T-059），实际安装、升级、卸载一遍。A3 中能自动化的项目在这里验证。
4. **Mac · Claude**：阶段 B 接入安装包（T-046 的安装部分）——悬浮窗宿主的打包、自动启动和配置项。等 T-044 的接口稳定后再做。
5. **功能完成后，和用户一起**（`docs/windows-next.md` 第 4 节）：T-057 确认 → 用户运行安装包，按 A3 验收 → T-048 的 8 项 → 阶段 B 的人工验收 → T-041 日常试用。

## 8. 交给各端 AI 的工作包

用户把下面某一节的“交给它的话”复制给对应的 AI 即可。每个工作包都按 `AGENTS.md` 的规则执行：开工前同步 develop（第 2 节）；一个任务一个分支；结束时更新 board 和 log；不要重写 `docs/handoff.md`；安装软件前先征得用户同意。

### 8.1 Windows 端的 GPT

Windows 端当前要做的事，按顺序写在 **`docs/windows-next.md`** 中，包括：

- 什么时候先问用户；
- 结果记在哪里；
- 怎样才算完成；
- 怎样交回 Mac 端。

用户只需要对它说：

> 同步 develop，读 docs/windows-next.md，按顺序做。

`docs/windows-next.md` 由整合者维护。阶段变化时，由整合者重写；其他 AI 只在任务板和 log 中记录进度。

### 8.2 Mac 端的 GPT

在当前这台 Mac 上可以做的事，按价值排序：

1. **T-054 独立审查 T-043**：
   - 逐节对照 `docs/protocol.md`，检查 `src/inshellisense/src/overlay/` 和相关的上游改动，看是否有不符合协议、竞态或回退不完整的地方。
   - 每个问题先写一个会失败的测试，再新建任务或直接修复。修复时在 `CHANGES.md` 中记录。
   - 不修改协议；确实需要修改时，按 D-009 的规则先写决策。
2. **T-053 宿主协议核心**（已由 Claude 完成，以下保留作记录）：
   - 实现 `docs/protocol.md` 服务端一侧中与平台无关的部分：分帧、严格校验、会话和序号、show/hide/status 的状态机、租期、背压、debugState。
   - 用单元测试覆盖 P-01 至 P-04、P-08、P-11、P-12 在宿主一侧的部分。
   - 窗口、UIA 和命名管道的访问控制留给 Windows 上的 T-044，在类库中用接口隔开。
   - 代码放在 `src/overlay-host/`。
   - **需要先征得用户同意，在 Mac 上安装 .NET 10 SDK**。
3. **T-055 补齐 spec 兼容性的余项**（`research/spec-compat.md` 中“仍未处理的项”）：
   - gh 的 GraphQL 参数引号；
   - scp 中区分 `host:path` 和盘符；
   - dotnet 的 `launchSettings.json` 相对路径。
   - 用模拟 win32 的测试验证，改动记入 `CHANGES.md`。

**交给它的话：**

> 在 ../fig-windows-research-codex 中同步 develop（`git fetch --all`，合并 upstream/develop），阅读 AGENTS.md、docs/handoff.md 和 docs/roadmap.md 的第 8.2 节。先做 T-054：对照 docs/protocol.md 审查 T-043 的实现，把问题写成会失败的测试，再修复或登记为新任务。然后做 T-055。T-053 已由 Claude 认领，不要做。每个任务在 ai/codex/<任务号> 分支上完成，合并前先同步 develop，推送到 upstream；结束时更新 board 和 log，不要重写 handoff.md。

