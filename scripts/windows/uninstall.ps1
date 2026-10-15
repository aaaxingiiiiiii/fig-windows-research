# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 卸载 install.ps1 安装的终端内补全（T-040 / T-058）。在 PowerShell 7 中运行：
#   pwsh -File scripts/windows/uninstall.ps1 [-KeepData] [-WhatIf]
#
# 做的事：
#   1. 恢复 $PROFILE：
#      - 安装后没有再改过：逐字节恢复安装前的内容；安装前没有这个文件时删除它；
#      - 安装后又被改过：只删除安装时加入的两行，保留其他修改，并提示。
#   2. 从用户 PATH 中删除安装目录（只在安装时加过的情况下）。
#   3. 删除安装时新建的 inshellisense 数据目录（安装前就存在的不删；-KeepData 时都不删）。
#   4. 删除安装目录。

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$InstallDir = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs' 'fig-windows-inshellisense' } else { $null }),
    [switch]$KeepData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')

if (-not $InstallDir) { throw '无法确定安装目录，请用 -InstallDir 指定。' }
$statePath = Join-Path $InstallDir 'install-state.json'
if (-not (Test-Path -LiteralPath $statePath)) { throw "没有找到安装记录：$statePath。可能没有安装，或已经卸载。" }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json

# ---- 1. 配置文件 ----
$profilePath = $state.profilePath
if ($PSCmdlet.ShouldProcess($profilePath, '恢复配置文件')) {
    $exists = Test-Path -LiteralPath $profilePath -PathType Leaf
    $currentHash = if ($exists) { (Get-FileHash -LiteralPath $profilePath -Algorithm SHA256).Hash } else { $null }
    if ($exists -and $currentHash -eq $state.installedHash) {
        if ($state.profileExisted) {
            Copy-Item -LiteralPath (Join-Path $InstallDir 'profile-backup.bin') -Destination $profilePath -Force
            Write-Host "配置文件：已恢复为安装前的内容（$profilePath）"
        }
        else {
            Remove-Item -LiteralPath $profilePath -Force
            Write-Host "配置文件：安装前不存在，已删除（$profilePath）"
        }
    }
    elseif ($exists) {
        $file = Read-ProfileFile -Path $profilePath
        $result = Remove-ProfileBlock -Text $file.Text -SourceLine $state.sourceLine
        if ($result.Found) {
            Write-ProfileFile -Path $profilePath -Text $result.Text -Encoding $file.Encoding
            Write-Warning "配置文件在安装后被修改过：只删除了安装时加入的两行，其他内容保持不变（$profilePath）"
        }
        else {
            Write-Warning "配置文件中没有找到安装时加入的内容，未修改（$profilePath）"
        }
    }
    else {
        Write-Warning "配置文件不存在，跳过（$profilePath）"
    }
}

# ---- 2. PATH ----
if ($state.pathAdded -and $IsWindows -and $PSCmdlet.ShouldProcess('用户 PATH', "删除 $InstallDir")) {
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $entries = @($userPath -split ';' | Where-Object { $_ -and $_.TrimEnd('\') -ine $InstallDir.TrimEnd('\') })
    [Environment]::SetEnvironmentVariable('Path', $entries -join ';', 'User')
    Write-Host 'PATH：已从用户 PATH 中删除安装目录'
}

# ---- 3. 数据目录 ----
if (-not $KeepData -and -not $state.dataDirExisted -and (Test-Path -LiteralPath $state.dataDir)) {
    if ($PSCmdlet.ShouldProcess($state.dataDir, '删除安装时新建的数据目录')) {
        Remove-Item -LiteralPath $state.dataDir -Recurse -Force
        Write-Host "数据目录：已删除（$($state.dataDir)，安装时新建）"
    }
}
elseif (Test-Path -LiteralPath $state.dataDir) {
    Write-Host "数据目录：保留（$($state.dataDir)）"
}

# ---- 4. 安装目录 ----
if ($PSCmdlet.ShouldProcess($InstallDir, '删除安装目录')) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
    Write-Host "程序：已删除（$InstallDir）"
}
Write-Host '完成。新开的终端标签将不再启用补全。'
