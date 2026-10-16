# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 卸载 install.ps1 安装的终端内补全（T-040 / T-058 / T-059）。在 PowerShell 7 中运行：
#   pwsh -File scripts/windows/uninstall.ps1 [-KeepData] [-WhatIf]
# 用安装包安装的，在“设置 → 应用”中卸载；安装包的卸载程序会带 -KeepInstallDir 调用本脚本，程序文件由它自己删除。
#
# 做的事（只撤销安装记录中做过的步骤）：
#   1. 恢复 $PROFILE：
#      - 安装后没有再改过：逐字节恢复安装前的内容；安装前没有这个文件时删除它；
#      - 安装后又被改过：先把当前内容另存为 <配置文件>.figwin-uninstall-backup，再只删除安装时加入的两行，其他内容逐字节保留，并提示。
#   2. 删除安装时创建的默认补全配置（~/.inshellisenserc）；用户改过的保留。
#   3. 用户 PATH：安装后没有再改过时，恢复为安装前的值；改过时只删除安装目录这一项（只在安装时加过的情况下）。
#   4. 删除安装时新建的 inshellisense 数据目录（安装前就存在的不删；-KeepData 时都不删）。
#   5. 删除安装目录（-KeepInstallDir 时不删）。
# 第 4、5 步的文件正被打开的终端使用时删不掉，会提示手动删除。安装包在卸载前会先请用户关闭这些终端。

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$InstallDir = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs' 'figwin' } else { $null }),
    [switch]$KeepData,
    [switch]$KeepInstallDir,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')
. (Join-Path $PSScriptRoot 'user-path.ps1')

# 删除目录；有文件正被打开的终端使用时删不掉，只提示，不登记“下次登录时删除”（那样会误删之后重新安装的文件）
function Remove-DirectoryOrWarn([string]$Path, [string]$What) {
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force
        Write-Host "${What}：已删除（$Path）"
    }
    catch {
        Write-Warning "${What}没有删干净，可能有打开的终端正在使用其中的文件。关闭所有 PowerShell 标签后，可以手动删除：$Path"
    }
}

if ($LogPath) { Start-Transcript -LiteralPath $LogPath -Append | Out-Null }
try {
    if (-not $InstallDir) { throw '无法确定安装目录，请用 -InstallDir 指定。' }
    $statePath = Join-Path $InstallDir 'install-state.json'
    if (-not (Test-Path -LiteralPath $statePath)) { throw "没有找到安装记录：$statePath。可能没有安装，或已经卸载。" }
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable
    # 一律用索引访问（$state['键']）：旧版本的记录缺少某些键时得到 $null，严格模式下不会出错
    # 第 1 版的安装记录没有 profileUpdated，有初始化语句就说明改过配置文件
    $profileUpdated = if ($state.ContainsKey('profileUpdated')) { [bool]$state['profileUpdated'] } else { [bool]$state['sourceLine'] }
    # PATH 中要删除的是安装时的目录。恢复时可能从另一个目录（卸载失败时保存的恢复文件夹）运行本脚本
    $recordedDir = if ($state['installDir']) { $state['installDir'] } elseif ($state['executable']) { Split-Path -Parent $state['executable'] } else { $InstallDir }

    # ---- 1. PowerShell 配置文件 ----
    $profilePath = $state['profilePath']
    if (-not $profileUpdated) {
        Write-Host 'PowerShell 配置文件：安装时没有修改，跳过'
    }
    elseif ($PSCmdlet.ShouldProcess($profilePath, '恢复配置文件')) {
        $exists = Test-Path -LiteralPath $profilePath -PathType Leaf
        $currentHash = if ($exists) { (Get-FileHash -LiteralPath $profilePath -Algorithm SHA256).Hash } else { $null }
        if ($exists -and $currentHash -eq $state['installedHash']) {
            if ($state['profileExisted']) {
                Write-FileAtomic -Path $profilePath -Bytes ([IO.File]::ReadAllBytes((Join-Path $InstallDir 'profile-backup.bin')))
                Write-Host "PowerShell 配置文件：已恢复为安装前的内容（$profilePath）"
            }
            else {
                Remove-Item -LiteralPath $profilePath -Force
                Write-Host "PowerShell 配置文件：安装前不存在，已删除（$profilePath）"
            }
        }
        elseif ($exists) {
            $file = Read-ProfileFile -Path $profilePath
            $result = Remove-ProfileBlock -Text $file.Text -SourceLine $state['sourceLine']
            if ($result.Found) {
                # 用户在安装后改过这个文件：先把现在的内容另存一份，再只删除安装时加入的两行
                $backup = "$profilePath.figwin-uninstall-backup"
                if (Test-Path -LiteralPath $backup) { $backup = "$backup-$(Get-Date -Format yyyyMMddHHmmss)" }
                Copy-Item -LiteralPath $profilePath -Destination $backup
                Write-ProfileFile -Path $profilePath -Text $result.Text -Encoding $file.Encoding
                Write-Warning "配置文件在安装后被修改过：只删除了安装时加入的两行，其他内容保持不变（$profilePath）。卸载前的内容另存在 $backup"
            }
            else {
                Write-Warning "配置文件中没有找到安装时加入的内容，未修改（$profilePath）"
            }
        }
        else {
            Write-Warning "配置文件不存在，跳过（$profilePath）"
        }
    }

    # ---- 2. 补全配置 ----
    $configPath = $state['configPath']
    if ($state['configCreated'] -and $configPath -and (Test-Path -LiteralPath $configPath)) {
        if ((Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash -ne $state['configHash']) {
            Write-Host "补全配置：安装后改过，保留（$configPath）"
        }
        elseif ($PSCmdlet.ShouldProcess($configPath, '删除安装时创建的默认补全配置')) {
            Remove-Item -LiteralPath $configPath -Force
            Write-Host "补全配置：安装时创建、没有改过，已删除（$configPath）"
        }
    }

    # ---- 3. PATH ----
    if ($state['pathAdded'] -and $IsWindows -and $PSCmdlet.ShouldProcess('用户 PATH', "删除 $recordedDir")) {
        $pathKey = if ($state['pathKey']) { $state['pathKey'] } else { 'Environment' }
        $afterKind = if ($state['pathAfterKind']) { $state['pathAfterKind'] } elseif ($state['pathBefore']) { $state['pathBefore']['Kind'] } else { 'ExpandString' }
        $current = Get-UserPathValue $pathKey
        $entries = if ($current) { @(Split-PathEntries $current.Value) } else { @() }
        $ours = @($entries | Where-Object { Test-PathEntry $_ $recordedDir })
        if ($current -and $state['pathAfter'] -and $current.Value -ceq $state['pathAfter'] -and $current.Kind -eq $afterKind) {
            # 安装后没有再改过：恢复为安装前的值（安装前没有这个值时删除它）
            Set-UserPathValue $state['pathBefore'] $pathKey
            Write-Host 'PATH：已恢复为安装前的值'
        }
        elseif ($ours.Count -gt 0) {
            Set-UserPathValue ([ordered]@{ Value = @($entries | Where-Object { -not (Test-PathEntry $_ $recordedDir) }) -join ';'; Kind = $current.Kind }) $pathKey
            Write-Host 'PATH：安装后被修改过，只删除了安装目录这一项'
        }
        else {
            Write-Host 'PATH：安装目录已经不在用户 PATH 中，未修改'
        }
    }

    # ---- 4. 数据目录 ----
    $dataDir = $state['dataDir']
    if ($dataDir -and -not $KeepData -and -not $state['dataDirExisted'] -and (Test-Path -LiteralPath $dataDir)) {
        if ($PSCmdlet.ShouldProcess($dataDir, '删除安装时新建的数据目录')) {
            Remove-DirectoryOrWarn $dataDir '数据目录'
        }
    }
    elseif ($dataDir -and (Test-Path -LiteralPath $dataDir)) {
        Write-Host "数据目录：保留（$dataDir）"
    }

    # ---- 5. 安装目录 ----
    if ($KeepInstallDir) {
        if ($PSCmdlet.ShouldProcess($statePath, '删除安装记录')) { Remove-Item -LiteralPath $statePath -Force }
    }
    elseif ($PSCmdlet.ShouldProcess($InstallDir, '删除安装目录')) {
        Remove-DirectoryOrWarn $InstallDir '程序'
    }
    Write-Host '完成。新开的终端标签将不再启用补全。'
}
finally {
    if ($LogPath) { Stop-Transcript | Out-Null }
}
