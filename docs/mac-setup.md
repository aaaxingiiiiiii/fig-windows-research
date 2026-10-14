# Mac 环境准备

## 1. 确认环境

```bash
sw_vers
uname -m
node --version
npm --version
git --version
```

基线为 REA 6.4.0，支持 Node 22.19+（22.x）、24.11+（24.x）或 26+；请依据实际包 engines 确认，不要使用 23/25 或预发行版。没有合适 Node 时先安装受支持版本。

## 2. 安装 REA 并接入 Codex

```bash
npm view rea-agents@6.4.0 engines --json
npm install --global rea-agents@6.4.0
rea --version
rea setup --client codex --dry-run --json
```

检查计划中的配置、技能目录和备份路径，然后运行交互式配置：

```bash
rea setup --client codex
```

根据提示应用已检查的计划，再重启 Codex。在新会话中确认 REA 工具可用。必要时使用限定范围的检查：

```bash
rea doctor --client codex --skill --json
```

已有可用 REA 连接时可跳过重复安装/配置。若使用更新版本，记录版本并确认所需工具，避免假设 main 分支文档与已安装版本完全一致。

## 3. 准备目标与原生引擎

```bash
mkdir -p local/artifacts local/evidence local/captures
```

先确认具体 Fig 产品和版本，填写 `research/target.md`。不要自动下载同名未知软件，也不要默认应用就是 Electron。

- JavaScript/ASAR 静态分析不需要原生反编译引擎。
- Mach-O 深入分析需要配置 REA 支持的原生 provider，如已有的 Hopper、Ghidra 或 IDA。
- REA setup 不会自动安装 Java、Ghidra 或 IDA；依据 [官方 provider 配置说明](https://github.com/morluto/rea/blob/main/docs/installation.md) 配置实际引擎。
- 如选择 Ghidra，设置正确的 `GHIDRA_INSTALL_DIR`，按对应 Ghidra 发布要求配置 Java，再运行 `rea doctor --provider ghidra --json`。
- Hopper 的安装/许可是独立步骤；有首次启动或激活提示时在本机完成。
- 修改 shell 环境变量后，重新启动 Agent，并检查其进程是否取得所需配置。

不要把安装引擎作为所有任务的前置条件；先做不依赖引擎的资料整理、目标识别和行为记录。

## 4. 第一轮工作

在 Codex 中打开仓库并使用 README 的接手提示。仅观察明确选定的 Fig 功能与样本；实际操作需要的 macOS 权限按系统提示和调查范围处理，不预先授予宽泛权限。

本仓库是在 Windows 上准备的交接材料；这里的 Mac 操作尚未在目标 Mac 上执行验证。
