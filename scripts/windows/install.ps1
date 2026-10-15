# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 安装终端内补全（阶段 A，T-040 / T-058）。在 PowerShell 7 中运行：
#   pwsh -File scripts/windows/install.ps1 [-Source <打包好的 exe>] [-WhatIf]
#
# 做的事（每一步都打印出来）：
#   1. 把打包好的单文件程序复制到 %LOCALAPPDATA%\Programs\fig-windows-inshellisense\is.exe
#   2. 把这个目录加到当前用户的 PATH 最前面（inshellisense 的初始化脚本会调用 `is`）
#   3. 运行 `is init pwsh`：解包资源，生成初始化脚本，得到要加入配置文件的一行
#   4. 备份 $PROFILE，然后在最后追加两行：一行标记注释，一行初始化语句（必须是配置文件的最后一行）
# 安装状态和原始配置文件的备份保存在安装目录中，uninstall.ps1 据此把配置文件逐字节恢复原样。
# 重复运行时只更新程序，不会重复添加初始化语句。

[CmdletBinding(SupportsShouldProcess)]
param(
    # 打包好的程序（T-040 用 `npm run package` 在 Windows 上生成）
    [string]$Source = (Join-Path $PSScriptRoot '..' '..' 'src' 'inshellisense' 'pkg' 'inshellisense-win32-x64.exe'),
    [string]$InstallDir = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs' 'fig-windows-inshellisense' } else { $null }),
    [string]$ProfilePath = $PROFILE.CurrentUserCurrentHost,
    # inshellisense 解包资源的目录，只用来记录安装前是否已经存在
    [string]$DataDir = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.inshellisense'),
    [string]$ExecutableName = $(if ($IsWindows) { 'is.exe' } else { 'is' }),
    # 不修改用户的 PATH（测试或非 Windows 系统使用）
    [switch]$NoPathUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')

if (-not $InstallDir) { throw '无法确定安装目录，请用 -InstallDir 指定。' }
if (-not $ProfilePath) { throw '无法确定 PowerShell 配置文件的位置，请用 -ProfilePath 指定。' }
if ($PSVersionTable.PSVersion.Major -lt 7) { throw "需要在 PowerShell 7 中运行，当前是 $($PSVersionTable.PSVersion)。" }
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "找不到程序：$Source。先在 src/inshellisense 下运行 npm run package。" }

$statePath = Join-Path $InstallDir 'install-state.json'
$target = Join-Path $InstallDir $ExecutableName
$alreadyInstalled = Test-Path -LiteralPath $statePath

# ---- 1. 复制程序 ----
if ($PSCmdlet.ShouldProcess($target, '复制程序')) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Copy-Item -LiteralPath $Source -Destination $target -Force
    if (-not $IsWindows) { chmod +x $target }
}
Write-Host "程序：$target"
if (-not $WhatIfPreference) {
    $version = "$(& $target --version)".Trim()
    if ($version -notlike '*figwin*') { Write-Warning "程序的版本是 $version，不是本项目的构建（应包含 figwin）。是否误用了原版 inshellisense？" }
    else { Write-Host "版本：$version" }
}

if ($alreadyInstalled) {
    Write-Host '已经安装过：只更新了程序，没有修改 PATH 和配置文件。'
    return
}

# ---- 2. PATH ----
$pathAdded = $false
if (-not $NoPathUpdate -and $IsWindows) {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($userPath -split ';' | Where-Object { $_ })
    if (-not ($entries | Where-Object { $_.TrimEnd('\') -ieq $InstallDir.TrimEnd('\') })) {
        if ($PSCmdlet.ShouldProcess('用户 PATH', "在最前面加入 $InstallDir")) {
            [Environment]::SetEnvironmentVariable('Path', (@($InstallDir) + $entries) -join ';', 'User')
            $pathAdded = $true
        }
    }
    $env:Path = "$InstallDir;$env:Path"
    Write-Host "PATH：$(if ($pathAdded) { '已在用户 PATH 最前面加入安装目录' } else { '安装目录已在用户 PATH 中' })"
}
else {
    $env:PATH = "$InstallDir$([IO.Path]::PathSeparator)$env:PATH"
    Write-Host 'PATH：未修改（-NoPathUpdate 或非 Windows）'
}

# ---- 3. is init pwsh ----
$dataExisted = Test-Path -LiteralPath $DataDir
$sourceLine = $null
if ($PSCmdlet.ShouldProcess($target, '运行 init pwsh')) {
    $output = & $target init pwsh
    if ($LASTEXITCODE -ne 0) { throw "is init pwsh 失败，退出码 $LASTEXITCODE。" }
    $sourceLine = @($output | ForEach-Object { "$_".Trim() } | Where-Object { $_ }) | Select-Object -Last 1
    if (-not $sourceLine) { throw 'is init pwsh 没有输出初始化语句。' }
    Write-Host "初始化语句：$sourceLine"
}

# ---- 4. 配置文件 ----
$profileExisted = Test-Path -LiteralPath $ProfilePath -PathType Leaf
$originalHash = $null
if ($PSCmdlet.ShouldProcess($ProfilePath, '备份并在最后追加初始化语句')) {
    if ($profileExisted) {
        Copy-Item -LiteralPath $ProfilePath -Destination (Join-Path $InstallDir 'profile-backup.bin') -Force
        $originalHash = (Get-FileHash -LiteralPath $ProfilePath -Algorithm SHA256).Hash
    }
    else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProfilePath) | Out-Null
    }
    $file = Read-ProfileFile -Path $ProfilePath
    $newline = if ($file.Text.Contains("`r`n") -or (-not $file.Text -and $IsWindows)) { "`r`n" } else { "`n" }
    $separator = if ($file.Text.Length -gt 0 -and -not $file.Text.EndsWith("`n")) { $newline } else { '' }
    $appended = "$separator$ProfileMarker$newline$sourceLine$newline"
    Write-ProfileFile -Path $ProfilePath -Text ($file.Text + $appended) -Encoding $file.Encoding
    Write-Host "配置文件：$ProfilePath（$(if ($profileExisted) { '原文件已备份' } else { '新建' })，在最后追加了 2 行）"

    [ordered]@{
        version          = 1
        installedAt      = (Get-Date).ToString('o')
        executable       = $target
        profilePath      = $ProfilePath
        profileExisted   = $profileExisted
        originalHash     = $originalHash
        installedHash    = (Get-FileHash -LiteralPath $ProfilePath -Algorithm SHA256).Hash
        sourceLine       = $sourceLine
        pathAdded        = $pathAdded
        dataDir          = $DataDir
        dataDirExisted   = $dataExisted
    } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
}

if ($IsWindows -and -not $NoPathUpdate) {
    $resolved = (Get-Command is -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
    if ($resolved -and $resolved -ne $target) { Write-Warning "PATH 中的 is 指向 $resolved，不是刚安装的程序。请检查是否装过原版 inshellisense。" }
}
Write-Host '完成。新开一个 Windows Terminal 标签即可使用；卸载请运行 scripts/windows/uninstall.ps1。'
