# Windows 实现计划

路线已经确定：PowerShell 7 加 Windows Terminal（D-002），Fig 式悬浮窗（D-003）。架构、成本和验证关卡见 `docs/overlay-design.md`；宿主语言暂定为 C#/.NET，前端为 TypeScript（D-004，验证后定稿）。Fig 链路的事实依据见 `research/architecture.md`，现有方案对比见 `research/prior-art.md`。

## 一个补全插件由哪些部分组成

```text
[shell 接入] → 读取命令行和光标 → [补全引擎：分词 → 匹配 spec → generator → 过滤排序] → [显示] → [按键处理] → [插入文本]
```

| 组件 | 职责 | 与平台的关系 |
| --- | --- | --- |
| shell 接入 | 获得当前命令行、光标、工作目录，并能修改命令行 | 每种 shell 单独实现 |
| 补全引擎 | 读取 spec，计算候选，处理插入规则 | 与平台无关，可以复用和测试 |
| 显示 | 终端内菜单或悬浮窗 | 与终端相关 |
| 按键处理 | Tab、Enter、上下方向键、Esc 的拦截与放行 | 与 shell 和终端都相关 |

补全引擎要独立出来，并用 `specs/completion.md` 中的用例做单元测试。这样即使换了接入方式或显示方式，也不需要重写引擎。

## 阶段 0：规格与决策（当前）

- 完成 `specs/completion.md` 第 8 节的用例（C-001 至 C-013），每条都要有源码依据；能做运行时观察的，再补充 Kiro 2.30.0 的实际结果。
- 完成验证关卡 T-019 至 T-022（`docs/overlay-design.md`），再由 T-023 汇总结果、定稿 D-004、写出 MVP 设计。

完成标准：4 项验证都有结论（通过或启用回退方案）；`docs/mvp-design.md` 写好模块划分和接口。

## 阶段 1：最小可用版本（MVP）

范围：PowerShell 7 加 Windows Terminal；悬浮窗显示；使用自带的 `git` spec 和文件路径补全。

完成标准：

- 第 8 节中适用于 Windows 的用例全部通过，结果记录在规格的“Windows 实测”一栏。
- 路径中有空格或中文时，插入结果正确。
- 输入不会丢失，没有候选时不会干扰正常输入。
- 记录候选出现的延迟，目标值由用户确定后写入规格。

## 阶段 2：补全数据与 generator

- 支持 script generator，命令通过 pwsh 或 cmd 执行，不依赖 Git Bash；加入缓存和超时。
- 扩充 spec 数量，记录哪些 spec 只适用于 POSIX、不能在 Windows 上使用。
- 支持在行中间编辑、管道、`&&`、`;`。

## 阶段 3：体验与安装

- 悬浮窗体验打磨：多显示器、DPI 切换、输入法组字期间的处理、主题和动画。
- 提供设置项、安装和卸载、日志与诊断命令。
- 打包发布：宿主用 winget 或 MSIX 分发，适配模块可同时发布到 PowerShell Gallery。

## 阶段 4：兼容性矩阵

对比 Windows Terminal、conhost、VS Code 终端，以及 PowerShell 7.x 和 5.1 的表现；分别记录 Mac 观察结果和 Windows 实测结果。

## 风险

| 风险 | 应对 |
| --- | --- |
| spec 中的 generator 假定 POSIX 命令（`ls`、`grep` 等） | 统计受影响的 spec；为常用 CLI 编写 pwsh 版本的 generator |
| 执行第三方 spec 代码的安全问题 | 只加载打包时固定版本的 spec；generator 设置超时，并限制可执行的命令 |
| PSReadLine 的灰色预测文字与补全菜单冲突 | 在 T-020 中验证二者如何共存 |
| 终端内绘制菜单导致画面错乱（滚动、调整窗口大小、备用屏幕） | 参考 `is` 的处理：在备用屏幕中暂停绘制，调整大小后延迟重绘 |
