# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# install.ps1 / uninstall.ps1 的自测（T-058）。不修改真实的配置文件、PATH 和用户目录：
# 所有路径都在临时目录中；用一个假的 `is` 代替打包好的程序，它只输出一行初始化语句并创建数据目录。
# 在 Mac 或 Windows 的 PowerShell 7 中运行：pwsh -NoProfile -File scripts/windows/test-install.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')

$root = Join-Path ([IO.Path]::GetTempPath()) "figwin-install-test-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
New-Item -ItemType Directory -Path $root | Out-Null
$failures = [Collections.Generic.List[string]]::new()
$passed = 0

function Assert-True([bool]$Condition, [string]$Message) {
    if ($Condition) { $script:passed++ } else { $script:failures.Add($Message); Write-Host "  失败：$Message" -ForegroundColor Red }
}

# 假的 is：Windows 上是 .cmd，其他系统上是 sh 脚本
$sourceLine = "if ( Test-Path 'D:\示例目录\.inshellisense\init\pwsh\init.ps1' -PathType Leaf ) { . 'D:\示例目录\.inshellisense\init\pwsh\init.ps1' }"
if ($IsWindows) {
    $fakeName = 'is.cmd'
    $fake = Join-Path $root 'fake-is.cmd'
    Set-Content -LiteralPath $fake -Encoding utf8 -Value @(
        '@echo off', 'chcp 65001 >nul', 'mkdir "%FIGWIN_TEST_DATA%" 2>nul', 'echo.', "echo $($sourceLine.Replace('%', '%%'))")
}
else {
    $fakeName = 'is'
    $fake = Join-Path $root 'fake-is.sh'
    Set-Content -LiteralPath $fake -Encoding utf8 -Value @('#!/bin/sh', 'mkdir -p "$FIGWIN_TEST_DATA"', 'echo', "printf '%s\n' `"$($sourceLine.Replace('"', '\"'))`"")
    chmod +x $fake
}

function Invoke-Case([string]$Name, [scriptblock]$Prepare, [scriptblock]$AfterInstall, [scriptblock]$Verify) {
    Write-Host "用例：$Name"
    $case = Join-Path $root ([guid]::NewGuid().ToString('N').Substring(0, 8))
    $profilePath = Join-Path $case 'profile' 'Microsoft.PowerShell_profile.ps1'
    $installDir = Join-Path $case 'install'
    $dataDir = Join-Path $case 'data'
    $env:FIGWIN_TEST_DATA = $dataDir
    New-Item -ItemType Directory -Path (Split-Path -Parent $profilePath) -Force | Out-Null
    & $Prepare $profilePath $dataDir
    $before = if (Test-Path -LiteralPath $profilePath) { (Get-FileHash -LiteralPath $profilePath).Hash } else { $null }
    $common = @{ Source = $fake; InstallDir = $installDir; ProfilePath = $profilePath; DataDir = $dataDir; ExecutableName = $fakeName; NoPathUpdate = $true }
    & (Join-Path $PSScriptRoot 'install.ps1') @common 6>$null | Out-Null
    $text = (Read-ProfileFile -Path $profilePath).Text
    $lines = @($text -split "`r?`n" | Where-Object { $_ })
    Assert-True ($lines[-1] -eq $sourceLine) '安装后初始化语句是配置文件的最后一行'
    Assert-True ($lines[-2] -eq $ProfileMarker) '初始化语句前面是标记注释'
    $installedHash = (Get-FileHash -LiteralPath $profilePath).Hash
    & (Join-Path $PSScriptRoot 'install.ps1') @common 6>$null | Out-Null
    Assert-True ((Get-FileHash -LiteralPath $profilePath).Hash -eq $installedHash) '重复安装不再修改配置文件'
    if ($AfterInstall) { & $AfterInstall $profilePath }
    $warnings = $null
    & (Join-Path $PSScriptRoot 'uninstall.ps1') -InstallDir $installDir -WarningVariable warnings -WarningAction SilentlyContinue 6>$null | Out-Null
    Assert-True (-not (Test-Path -LiteralPath $installDir)) '卸载后安装目录已删除'
    & $Verify $profilePath $before $dataDir $warnings
}

Invoke-Case '安装前没有配置文件' { } $null {
    param($profilePath, $before, $dataDir)
    Assert-True (-not (Test-Path -LiteralPath $profilePath)) '卸载后配置文件被删除（安装前不存在）'
    Assert-True (-not (Test-Path -LiteralPath $dataDir)) '安装时新建的数据目录被删除'
}

Invoke-Case 'UTF-8 带 BOM、CRLF、没有结尾换行、含中文' {
    param($profilePath)
    [IO.File]::WriteAllBytes($profilePath, [byte[]](0xEF, 0xBB, 0xBF) + [Text.Encoding]::UTF8.GetBytes("# 我的配置`r`nSet-Alias ll Get-ChildItem"))
} $null {
    param($profilePath, $before)
    Assert-True ((Get-FileHash -LiteralPath $profilePath).Hash -eq $before) '配置文件逐字节恢复（UTF-8 BOM）'
}

Invoke-Case 'UTF-16 LE（Windows PowerShell 5.1 常见）' {
    param($profilePath)
    [IO.File]::WriteAllBytes($profilePath, [byte[]](0xFF, 0xFE) + [Text.Encoding]::Unicode.GetBytes("Import-Module posh-git`r`n"))
} {
    param($profilePath)
    Assert-True ((Read-ProfileFile -Path $profilePath).Encoding -eq 'utf16le') '安装后仍是 UTF-16 LE'
} {
    param($profilePath, $before)
    Assert-True ((Get-FileHash -LiteralPath $profilePath).Hash -eq $before) '配置文件逐字节恢复（UTF-16 LE）'
}

Invoke-Case '安装后用户又在末尾加了内容' {
    param($profilePath, $dataDir)
    Set-Content -LiteralPath $profilePath -Encoding utf8NoBOM -Value 'Write-Host start'
    New-Item -ItemType Directory -Path $dataDir | Out-Null
} {
    param($profilePath)
    Add-Content -LiteralPath $profilePath -Encoding utf8NoBOM -Value 'Write-Host later'
} {
    param($profilePath, $before, $dataDir, $warnings)
    $text = Get-Content -LiteralPath $profilePath -Raw
    Assert-True ($text -notmatch [regex]::Escape($ProfileMarker)) '删除了标记注释'
    Assert-True (-not $text.Contains($sourceLine)) '删除了初始化语句'
    Assert-True ($text.Contains('Write-Host start') -and $text.Contains('Write-Host later')) '保留了用户的其他内容'
    Assert-True (@($warnings).Count -ge 1) '提示配置文件在安装后被修改过'
    Assert-True (Test-Path -LiteralPath $dataDir) '安装前就存在的数据目录被保留'
}

Remove-Item -LiteralPath $root -Recurse -Force
Write-Host ''
if ($failures.Count -eq 0) {
    Write-Host "全部通过：$passed 项检查" -ForegroundColor Green
    exit 0
}
Write-Host "失败 $($failures.Count) 项，通过 $passed 项" -ForegroundColor Red
exit 1
