# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# install.ps1 / uninstall.ps1 的自测（T-058）。不修改真实的配置文件、PATH 和用户目录：
# 所有路径都在临时目录中；用一个假的 `is` 代替打包好的程序：它记录每次调用的参数，创建数据目录，并输出一行初始化语句。
# 在 Mac 或 Windows 的 PowerShell 7 中运行：pwsh -NoProfile -File scripts/windows/test-install.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')
. (Join-Path $PSScriptRoot 'user-path.ps1')

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
        '@echo off', 'chcp 65001 >nul', 'if "%1"=="--version" (echo 0.0.4-figwin.test& exit /b 0)', 'echo %*>>"%FIGWIN_TEST_CALLS%"', 'if defined FIGWIN_TEST_FAIL_INIT if "%1"=="init" exit /b 3', 'mkdir "%FIGWIN_TEST_DATA%" 2>nul', 'echo.', "echo $($sourceLine.Replace('%', '%%'))")
}
else {
    $fakeName = 'is'
    $fake = Join-Path $root 'fake-is.sh'
    Set-Content -LiteralPath $fake -Encoding utf8 -Value @('#!/bin/sh', 'if [ "$1" = "--version" ]; then echo 0.0.4-figwin.test; exit 0; fi', 'echo "$*" >> "$FIGWIN_TEST_CALLS"', 'if [ -n "$FIGWIN_TEST_FAIL_INIT" ] && [ "$1" = init ]; then exit 3; fi', 'mkdir -p "$FIGWIN_TEST_DATA"', 'echo', "printf '%s\n' `"$($sourceLine.Replace('"', '\"'))`"")
    chmod +x $fake
}

$template = Join-Path $root 'template.toml'
Set-Content -LiteralPath $template -Encoding utf8NoBOM -Value '# 默认配置（测试）'

# $Options：传给 install.ps1 的额外参数；Prepare 可以返回新的选项（例如原地安装时的 Source）
function Invoke-Case([string]$Name, [scriptblock]$Prepare, [scriptblock]$AfterInstall, [scriptblock]$Verify, [hashtable]$Options = @{}) {
    Write-Host "用例：$Name"
    $case = Join-Path $root ([guid]::NewGuid().ToString('N').Substring(0, 8))
    $profilePath = Join-Path $case 'profile' 'Microsoft.PowerShell_profile.ps1'
    $installDir = Join-Path $case 'install'
    $dataDir = Join-Path $case 'data'
    $configPath = Join-Path $case 'home' '.inshellisenserc'
    $calls = Join-Path $case 'calls.txt'
    $env:FIGWIN_TEST_DATA = $dataDir
    $env:FIGWIN_TEST_CALLS = $calls
    New-Item -ItemType Directory -Path (Split-Path -Parent $profilePath), (Split-Path -Parent $configPath) -Force | Out-Null
    $ctx = @{ Profile = $profilePath; Data = $dataDir; Config = $configPath; Install = $installDir; Calls = $calls }
    $extra = & $Prepare $ctx
    $before = if (Test-Path -LiteralPath $profilePath) { (Get-FileHash -LiteralPath $profilePath).Hash } else { $null }
    $ctx.Before = $before
    $common = @{ Source = $fake; InstallDir = $installDir; ProfilePath = $profilePath; DataDir = $dataDir; ExecutableName = $fakeName; NoPathUpdate = $true; ConfigPath = $configPath }
    foreach ($key in $Options.Keys) { $common[$key] = $Options[$key] }
    if ($extra -is [hashtable]) { foreach ($key in $extra.Keys) { $common[$key] = $extra[$key] } }
    $ctx.Extra = $extra
    & (Join-Path $PSScriptRoot 'install.ps1') @common 6>$null | Out-Null
    if (-not $Options.ContainsKey('NoProfileUpdate')) {
        $text = (Read-ProfileFile -Path $profilePath).Text
        $lines = @($text -split "`r?`n" | Where-Object { $_ })
        Assert-True ($lines[-1] -eq $sourceLine) '安装后初始化语句是配置文件的最后一行'
        Assert-True ($lines[-2] -eq $ProfileMarker) '初始化语句前面是标记注释'
    }
    $installedHash = if (Test-Path -LiteralPath $profilePath) { (Get-FileHash -LiteralPath $profilePath).Hash } else { $null }
    $initCalls = @(Get-Content -LiteralPath $calls | Where-Object { $_ -like 'init*' }).Count
    & (Join-Path $PSScriptRoot 'install.ps1') @common 6>$null | Out-Null
    $currentHash = if (Test-Path -LiteralPath $profilePath) { (Get-FileHash -LiteralPath $profilePath).Hash } else { $null }
    Assert-True ($currentHash -eq $installedHash) '重复安装不再修改配置文件'
    Assert-True (@(Get-Content -LiteralPath $calls | Where-Object { $_ -like 'init*' }).Count -eq $initCalls + 1) '重复安装（升级）时重新运行 init，解包新版本的资源'
    $order = @(Get-Content -LiteralPath $calls | ForEach-Object { "$_".Trim() })
    Assert-True (($order -join ',') -eq 'reinit,init pwsh,reinit,init pwsh') '每次安装都先 reinit（删除旧资源）再 init'
    if ($AfterInstall) { & $AfterInstall $ctx }
    $warnings = $null
    & (Join-Path $PSScriptRoot 'uninstall.ps1') -InstallDir $installDir -WarningVariable warnings -WarningAction SilentlyContinue 6>$null | Out-Null
    Assert-True (-not (Test-Path -LiteralPath $installDir)) '卸载后安装目录已删除'
    $ctx.Warnings = $warnings
    & $Verify $ctx
}

Invoke-Case '安装前没有配置文件' { } $null {
    param($ctx)
    Assert-True (-not (Test-Path -LiteralPath $ctx.Profile)) '卸载后配置文件被删除（安装前不存在）'
    Assert-True (-not (Test-Path -LiteralPath $ctx.Data)) '安装时新建的数据目录被删除'
}

Invoke-Case 'UTF-8 带 BOM、CRLF、没有结尾换行、含中文' {
    param($ctx)
    [IO.File]::WriteAllBytes($ctx.Profile, [byte[]](0xEF, 0xBB, 0xBF) + [Text.Encoding]::UTF8.GetBytes("# 我的配置`r`nSet-Alias ll Get-ChildItem"))
} $null {
    param($ctx)
    Assert-True ((Get-FileHash -LiteralPath $ctx.Profile).Hash -eq $ctx.Before) '配置文件逐字节恢复（UTF-8 BOM）'
}

Invoke-Case 'UTF-16 LE（Windows PowerShell 5.1 常见）' {
    param($ctx)
    [IO.File]::WriteAllBytes($ctx.Profile, [byte[]](0xFF, 0xFE) + [Text.Encoding]::Unicode.GetBytes("Import-Module posh-git`r`n"))
} {
    param($ctx)
    Assert-True ((Read-ProfileFile -Path $ctx.Profile).Encoding -eq 'utf16le') '安装后仍是 UTF-16 LE'
} {
    param($ctx)
    Assert-True ((Get-FileHash -LiteralPath $ctx.Profile).Hash -eq $ctx.Before) '配置文件逐字节恢复（UTF-16 LE）'
}

Invoke-Case '安装后用户又在末尾加了内容' {
    param($ctx)
    Set-Content -LiteralPath $ctx.Profile -Encoding utf8NoBOM -Value 'Write-Host start'
    New-Item -ItemType Directory -Path $ctx.Data | Out-Null
} {
    param($ctx)
    Add-Content -LiteralPath $ctx.Profile -Encoding utf8NoBOM -Value 'Write-Host later'
} {
    param($ctx)
    $text = Get-Content -LiteralPath $ctx.Profile -Raw
    Assert-True ($text -notmatch [regex]::Escape($ProfileMarker)) '删除了标记注释'
    Assert-True (-not $text.Contains($sourceLine)) '删除了初始化语句'
    Assert-True ($text.Contains('Write-Host start') -and $text.Contains('Write-Host later')) '保留了用户的其他内容'
    Assert-True (@($ctx.Warnings).Count -ge 1) '提示配置文件在安装后被修改过'
    Assert-True (Test-Path -LiteralPath $ctx.Data) '安装前就存在的数据目录被保留'
}

Invoke-Case '创建默认补全配置，卸载时删除没有改过的' { } $null {
    param($ctx)
    Assert-True (-not (Test-Path -LiteralPath $ctx.Config)) '没有改过的默认补全配置被删除'
} -Options @{ ConfigTemplate = $template }

Invoke-Case '默认补全配置安装后被用户修改' { } {
    param($ctx)
    Assert-True ((Get-Content -LiteralPath $ctx.Config -Raw) -eq (Get-Content -LiteralPath $template -Raw)) '创建的补全配置与模板相同'
    Add-Content -LiteralPath $ctx.Config -Value 'maxSuggestions = 8'
} {
    param($ctx)
    Assert-True ((Test-Path -LiteralPath $ctx.Config) -and (Get-Content -LiteralPath $ctx.Config -Raw).Contains('maxSuggestions = 8')) '用户改过的补全配置被保留'
} -Options @{ ConfigTemplate = $template }

Invoke-Case '用户已有补全配置' {
    param($ctx)
    Set-Content -LiteralPath $ctx.Config -Value 'useNerdFont = true'
} $null {
    param($ctx)
    Assert-True ((Get-Content -LiteralPath $ctx.Config -Raw).Trim() -eq 'useNerdFont = true') '已有的补全配置不被覆盖，卸载后仍在'
} -Options @{ ConfigTemplate = $template }

Invoke-Case '不修改 PowerShell 配置文件（-NoProfileUpdate）' {
    param($ctx)
    Set-Content -LiteralPath $ctx.Profile -Encoding utf8NoBOM -Value 'Write-Host mine'
} {
    param($ctx)
    Assert-True ((Get-FileHash -LiteralPath $ctx.Profile).Hash -eq $ctx.Before) '安装没有修改配置文件'
} {
    param($ctx)
    Assert-True ((Get-FileHash -LiteralPath $ctx.Profile).Hash -eq $ctx.Before) '卸载后配置文件仍是原样'
} -Options @{ NoProfileUpdate = $true }

Invoke-Case '原地安装（安装包已把程序放进安装目录）' {
    param($ctx)
    New-Item -ItemType Directory -Path $ctx.Install | Out-Null
    $placed = Join-Path $ctx.Install $fakeName
    Copy-Item -LiteralPath $fake -Destination $placed
    if (-not $IsWindows) { chmod +x $placed }
    @{ Source = $placed }
} $null {
    param($ctx)
    Assert-True (-not (Test-Path -LiteralPath $ctx.Profile)) '原地安装后也能完整卸载'
}

Invoke-Case '安装后改过的配置文件混用 LF 和 CRLF：卸载只删两行，其他字节原样保留' {
    param($ctx)
    [IO.File]::WriteAllBytes($ctx.Profile, [Text.Encoding]::UTF8.GetBytes("A`nB`r`n"))
} {
    param($ctx)
    $bytes = [IO.File]::ReadAllBytes($ctx.Profile)
    [IO.File]::WriteAllBytes($ctx.Profile, [byte[]]($bytes + [Text.Encoding]::UTF8.GetBytes("C`nD")))
    $ctx.BeforeUninstall = [IO.File]::ReadAllBytes($ctx.Profile)
} {
    param($ctx)
    $expected = [Text.Encoding]::UTF8.GetBytes("A`nB`r`nC`nD")
    Assert-True ([Convert]::ToHexString([IO.File]::ReadAllBytes($ctx.Profile)) -eq [Convert]::ToHexString($expected)) '只删除了安装时加入的两行，混用的换行符原样保留'
    $backup = "$($ctx.Profile).figwin-uninstall-backup"
    Assert-True ((Test-Path -LiteralPath $backup) -and [Convert]::ToHexString([IO.File]::ReadAllBytes($backup)) -eq [Convert]::ToHexString($ctx.BeforeUninstall)) '卸载前的内容另存了一份'
}

# 第一次安装在 init 时失败：安装记录标明没有完成；再运行一次时补完剩下的步骤，而不是当作升级跳过
Write-Host '用例：第一次安装中途失败，再运行时补完'
$case = Join-Path $root 'resume'
$resumeProfile = Join-Path $case 'profile' 'Microsoft.PowerShell_profile.ps1'
$resumeInstall = Join-Path $case 'install'
$env:FIGWIN_TEST_DATA = Join-Path $case 'data'
$env:FIGWIN_TEST_CALLS = Join-Path $case 'calls.txt'
New-Item -ItemType Directory -Path (Split-Path -Parent $resumeProfile) -Force | Out-Null
Set-Content -LiteralPath $resumeProfile -Encoding utf8NoBOM -Value 'Write-Host mine'
$resumeBefore = (Get-FileHash -LiteralPath $resumeProfile).Hash
$resumeArgs = @{ Source = $fake; InstallDir = $resumeInstall; ProfilePath = $resumeProfile; DataDir = $env:FIGWIN_TEST_DATA; ExecutableName = $fakeName; NoPathUpdate = $true; ConfigPath = (Join-Path $case '.inshellisenserc') }
$env:FIGWIN_TEST_FAIL_INIT = '1'
$failed = $false
try { & (Join-Path $PSScriptRoot 'install.ps1') @resumeArgs 6>$null | Out-Null } catch { $failed = $true }
Remove-Item Env:FIGWIN_TEST_FAIL_INIT
$resumeState = Get-Content -LiteralPath (Join-Path $resumeInstall 'install-state.json') -Raw | ConvertFrom-Json -AsHashtable
Assert-True ($failed -and $resumeState['completed'] -eq $false) 'init 失败时安装报错，记录标明没有完成'
Assert-True ((Get-FileHash -LiteralPath $resumeProfile).Hash -eq $resumeBefore) '失败时配置文件还没有被修改'
# 模拟更晚的中断点：记录已经写明“改过配置文件”，配置文件却还没写入；中断期间用户又改了配置文件
$resumeState['profileUpdated'] = $true
$resumeState['installedHash'] = 'never-written'
$resumeState | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resumeInstall 'install-state.json')
Add-Content -LiteralPath $resumeProfile -Encoding utf8NoBOM -Value 'Write-Host interim'
$resumeBefore = (Get-FileHash -LiteralPath $resumeProfile).Hash
& (Join-Path $PSScriptRoot 'install.ps1') @resumeArgs 6>$null | Out-Null
$resumeState = Get-Content -LiteralPath (Join-Path $resumeInstall 'install-state.json') -Raw | ConvertFrom-Json -AsHashtable
$resumeLines = @((Read-ProfileFile -Path $resumeProfile).Text -split "`r?`n" | Where-Object { $_ })
Assert-True ($resumeState['completed'] -eq $true -and $resumeLines[-2] -eq $ProfileMarker -and $resumeLines[-1] -eq $sourceLine) '再运行一次补完了配置文件的修改'
& (Join-Path $PSScriptRoot 'uninstall.ps1') -InstallDir $resumeInstall 6>$null | Out-Null
Assert-True ((Test-Path -LiteralPath $resumeProfile) -and (Get-FileHash -LiteralPath $resumeProfile).Hash -eq $resumeBefore) '补完后卸载，配置文件逐字节恢复为加入两行之前的内容（包括中断期间用户的修改）'

# 旧版本（第 1 版）的安装记录缺少后来新增的键：卸载不能在严格模式下出错
Write-Host '用例：第 1 版的安装记录'
$case = Join-Path $root 'v1'
New-Item -ItemType Directory -Path $case | Out-Null
$v1Profile = Join-Path $root 'v1-profile.ps1'  # 放在安装目录之外：卸载会删除整个安装目录
Set-Content -LiteralPath $v1Profile -Encoding utf8NoBOM -Value "Write-Host old`n$ProfileMarker`n$sourceLine"
@{ version = 1; profilePath = $v1Profile; profileExisted = $true; installedHash = 'not-the-current-hash'; sourceLine = $sourceLine; pathAdded = $false; dataDir = (Join-Path $case 'data'); dataDirExisted = $true } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $case 'install-state.json')
$v1Failed = $false
try { & (Join-Path $PSScriptRoot 'uninstall.ps1') -InstallDir $case -WarningAction SilentlyContinue 6>$null | Out-Null } catch { $v1Failed = $true; Write-Host "  $_" }
Assert-True (-not $v1Failed -and -not (Get-Content -LiteralPath $v1Profile -Raw).Contains($ProfileMarker)) '用第 1 版的记录也能卸载，删除了安装时加入的两行'

# ---- 用户 PATH（只在 Windows 上）：用 HKCU 下的临时子键代替 HKCU\Environment，不碰真实的 PATH ----
if ($IsWindows) {
    $testKeyRoot = "Software\figwin-install-test-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    $script:pathCase = 0
    function New-TestPathKey($Value, [string]$Kind = 'ExpandString') {
        $script:pathCase++
        $key = "$testKeyRoot\case$script:pathCase"
        $handle = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($key)
        if ($null -ne $Value) { $handle.SetValue('Path', $Value, [Microsoft.Win32.RegistryValueKind]$Kind) }
        $handle.Dispose()
        return @{ PathKey = $key; NoPathUpdate = $false }
    }
    $original = '%USERPROFILE%\AppData\Local\Microsoft\WindowsApps;C:\Tools;;'

    Invoke-Case 'PATH 是 REG_EXPAND_SZ，含 %USERPROFILE% 和多余的分号' { New-TestPathKey $original } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Assert-True ((Split-PathEntries $value.Value)[0] -eq $ctx.Install) '安装目录是 PATH 的第一项'
        Assert-True ($value.Kind -eq 'ExpandString') 'PATH 仍是 REG_EXPAND_SZ'
        Assert-True ($value.Value.Contains('%USERPROFILE%\AppData')) '原有的 %USERPROFILE% 没有被展开'
    } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Assert-True ($value.Value -ceq $original -and $value.Kind -eq 'ExpandString') '卸载后 PATH 的值和类型与安装前完全相同'
    }

    Invoke-Case '安装前没有用户 PATH' { New-TestPathKey $null } {
        param($ctx)
        Assert-True ((Get-UserPathValue $ctx.Extra.PathKey).Value -eq $ctx.Install) '新建的 PATH 只有安装目录'
    } {
        param($ctx)
        Assert-True ($null -eq (Get-UserPathValue $ctx.Extra.PathKey)) '卸载后仍然没有用户 PATH'
    }

    Invoke-Case '安装后用户又在 PATH 中加了一项' { New-TestPathKey 'C:\Tools' 'String' } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Set-UserPathValue ([ordered]@{ Value = "$($value.Value);D:\Later"; Kind = $value.Kind }) $ctx.Extra.PathKey
    } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Assert-True ($value.Value -eq 'C:\Tools;D:\Later' -and $value.Kind -eq 'String') '只删除了安装目录，保留了用户新加的项和原来的类型'
    }
    Invoke-Case '安装后只改了 PATH 的值类型（REG_EXPAND_SZ → REG_SZ）' { New-TestPathKey 'C:\Tools' } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Set-UserPathValue ([ordered]@{ Value = $value.Value; Kind = 'String' }) $ctx.Extra.PathKey
    } {
        param($ctx)
        $value = Get-UserPathValue $ctx.Extra.PathKey
        Assert-True ($value.Value -eq 'C:\Tools' -and $value.Kind -eq 'String') '只删除了安装目录，保留了用户改过的类型'
    }
    [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($testKeyRoot, $false)
}
else {
    Write-Host '用例：用户 PATH（跳过：只在 Windows 上运行）'
}

Remove-Item -LiteralPath $root -Recurse -Force
Write-Host ''
if ($failures.Count -eq 0) {
    Write-Host "全部通过：$passed 项检查" -ForegroundColor Green
    exit 0
}
Write-Host "失败 $($failures.Count) 项，通过 $passed 项" -ForegroundColor Red
exit 1
