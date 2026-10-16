# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 安装包的自动验收（T-059，对应 docs/roadmap.md 的 A3）。在当前用户的真实环境中静默安装、升级、卸载，
# 所以只能在一次性的 Windows 环境中运行（GitHub Actions 的虚拟机、Windows Sandbox），并且必须加 -Disposable：
#   pwsh -File scripts/windows/test-installer.ps1 -Setup dist/figwin-setup-<版本>.exe -Disposable [-LogDir <目录>]
# 需要先在 src/inshellisense 下 npm ci（check-installed.cjs 用其中的 node-pty 和 xterm-headless 模拟终端）。
# 新开终端的检查都在 PATH 中去掉 Node 的情况下进行，确认单文件程序不依赖 Node（A3 第 4 项）。

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Setup,
    [switch]$Disposable,
    [string]$LogDir = (Join-Path ([IO.Path]::GetTempPath()) "figwin-installer-test-$(Get-Date -Format yyyyMMddHHmmss)")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw '只能在 Windows 上运行。' }
if (-not $Disposable) { throw '这个测试会修改当前用户的 PowerShell 配置文件、PATH 和用户目录，只能在一次性的环境中运行。确认后加 -Disposable。' }
. (Join-Path $PSScriptRoot 'profile-file.ps1')
. (Join-Path $PSScriptRoot 'user-path.ps1')

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).ProviderPath
$Setup = (Resolve-Path -LiteralPath $Setup).ProviderPath
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$installDir = Join-Path $env:LOCALAPPDATA 'Programs' 'figwin'
$installedExe = Join-Path $installDir 'is.exe'
$profilePath = $PROFILE.CurrentUserCurrentHost
$configPath = Join-Path $env:USERPROFILE '.inshellisenserc'
$dataDir = Join-Path $env:USERPROFILE '.inshellisense'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{05A2CCCF-E90F-4E6B-A863-1E7256CE851E}_is1'
$version = (Get-Content -LiteralPath (Join-Path $repo 'src' 'inshellisense' 'package.json') -Raw | ConvertFrom-Json).version
$node = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$pwsh = (Get-Process -Id $PID).Path
$checker = Join-Path $PSScriptRoot 'check-installed.cjs'

$results = [Collections.Generic.List[object]]::new()
function Add-Result([string]$Name, [string]$Status, [string]$Detail = '') {
    $results.Add([pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail })
    $color = @{ '通过' = 'Green'; '失败' = 'Red'; '跳过' = 'Yellow' }[$Status]
    Write-Host "[$Status] $Name$(if ($Detail) { "：$Detail" })" -ForegroundColor $color
    if ($env:GITHUB_ACTIONS -eq 'true' -and $Status -eq '失败') { Write-Host "::error title=安装包验收::$Name $Detail" }
}
function Check([string]$Name, [bool]$Ok, [string]$Detail = '') { Add-Result $Name $(if ($Ok) { '通过' } else { '失败' }) $Detail }
function Get-Hash([string]$Path) { if (Test-Path -LiteralPath $Path -PathType Leaf) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash } else { $null } }

function Invoke-Setup([string]$Name, [string[]]$Arguments = @()) {
    $log = Join-Path $LogDir "setup-$Name.log"
    $process = Start-Process -FilePath $Setup -ArgumentList (@('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=`"$log`"") + $Arguments) -Wait -PassThru
    return $process.ExitCode
}

# Inno Setup 的卸载程序会把自己复制到临时目录再运行，第一个进程马上退出，所以要等卸载信息从注册表中消失
function Invoke-Uninstall([string]$Name, [int]$TimeoutSeconds) {
    $uninstaller = Join-Path $installDir 'unins000.exe'
    if (-not (Test-Path -LiteralPath $uninstaller)) { return $false }
    Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=`"$(Join-Path $LogDir "uninstall-$Name.log")`"" -Wait
    for ($waited = 0; $waited -lt $TimeoutSeconds; $waited++) {
        if (-not (Test-Path -LiteralPath $uninstallKey)) { return $true }
        Start-Sleep -Seconds 1
    }
    return -not (Test-Path -LiteralPath $uninstallKey)
}

# 新开终端时的 PATH：注册表中的用户 PATH 和系统 PATH，去掉含有 node.exe 的目录
function Get-ChildPath {
    $entries = @([Environment]::GetEnvironmentVariable('Path', 'User'), [Environment]::GetEnvironmentVariable('Path', 'Machine')) -join ';' -split ';'
    return (@($entries | Where-Object { $_ -and -not (Test-Path -LiteralPath (Join-Path $_ 'node.exe')) }) -join ';')
}

function Invoke-Checker([string]$Mode, [string]$File, [string[]]$Arguments, [int]$Seconds = 0) {
    $env:FIGWIN_CHILD_PATH = Get-ChildPath
    $output = & $node $checker $File $Mode $Seconds -- @Arguments
    $json = @($output | Where-Object { "$_".StartsWith('{') }) | Select-Object -Last 1
    Add-Content -LiteralPath (Join-Path $LogDir 'checker.jsonl') -Value $json
    if (-not $json) { return [pscustomobject]@{ ok = $false } }
    return $json | ConvertFrom-Json
}

function Get-IsProcesses { @(Get-Process -Name is -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $installedExe }) }

# ---- 安装前 ----
$profileBefore = Get-Hash $profilePath
$pathBefore = Get-UserPathValue
$configExisted = Test-Path -LiteralPath $configPath
$dataExisted = Test-Path -LiteralPath $dataDir
$interactive = "$(& $pwsh -NoLogo -NoProfile -Command '[Environment]::UserInteractive')".Trim() -eq 'True'
Write-Host "安装包：$Setup"
Write-Host "PowerShell 7：$pwsh；交互式会话：$interactive"

# ---- 1. 安装 ----
$code = Invoke-Setup 'install' @('/TASKS=profile,config')
Check '安装程序正常结束（退出码 0）' ($code -eq 0) "退出码 $code"
Check '程序已安装' (Test-Path -LiteralPath $installedExe)
if (Test-Path -LiteralPath (Join-Path $installDir 'install.log')) { Copy-Item -LiteralPath (Join-Path $installDir 'install.log') -Destination (Join-Path $LogDir 'install.log') }
$reported = if (Test-Path -LiteralPath $installedExe) { "$(& $installedExe --version)".Trim() } else { '' }
Check '程序的版本正确' ($reported -eq $version) $reported
$userPath = Get-UserPathValue
Check '用户 PATH 的第一项是安装目录' ($userPath -and (Test-PathEntry (Split-PathEntries $userPath.Value)[0] $installDir))
Check '用户 PATH 的值类型保持不变' ((-not $pathBefore) -or ($userPath -and $userPath.Kind -eq $pathBefore.Kind)) "$(if ($userPath) { $userPath.Kind })"
$lines = @((Read-ProfileFile -Path $profilePath).Text -split "`r?`n" | Where-Object { $_ })
Check 'PowerShell 配置文件的最后两行是标记注释和初始化语句' ($lines.Count -ge 2 -and $lines[-2] -eq $ProfileMarker -and $lines[-1] -like 'if ( Test-Path *init.ps1*')
if (-not $configExisted) {
    Check '创建了默认补全配置，内容与安装包中的模板相同' ((Get-Hash $configPath) -eq (Get-Hash (Join-Path $installDir 'config' 'inshellisenserc.toml')))
}
$versionFile = Join-Path $dataDir 'version.txt'
Check '解包的资源与程序是同一版本' ((Test-Path -LiteralPath $versionFile) -and (Get-Content -LiteralPath $versionFile -Raw).Trim() -eq $version)
Check '“设置 → 应用”中登记了卸载信息' (Test-Path -LiteralPath $uninstallKey)
$profileInstalled = Get-Hash $profilePath

# ---- 2. 新开终端，补全自动启用（A3 第 3、4 项） ----
if ($interactive) {
    $r = Invoke-Checker 'complete' $pwsh @('-NoLogo')
    Check '新开的 PowerShell 7 自动启用补全，输入 git ch 出现 checkout（PATH 中没有 Node）' ([bool]$r.ok)
}
else {
    Add-Result '新开的 PowerShell 7 自动启用补全' '跳过' '当前不是交互式会话（[Environment]::UserInteractive 为 False），初始化脚本按设计不启动 is'
    $r = Invoke-Checker 'complete' $installedExe @('-s', 'pwsh')
    Check '直接运行安装的 is -s pwsh，输入 git ch 出现 checkout（PATH 中没有 Node）' ([bool]$r.ok)
}

# ---- 3. 有终端在使用补全时，阻止升级和卸载 ----
$env:FIGWIN_CHILD_PATH = Get-ChildPath
$hold = Start-Process -FilePath $node -ArgumentList "`"$checker`"", "`"$installedExe`"", 'hold', '60', '--', '-s', 'pwsh' -PassThru -WindowStyle Hidden
for ($waited = 0; $waited -lt 60 -and (Get-IsProcesses).Count -eq 0; $waited++) { Start-Sleep -Seconds 1 }
if ((Get-IsProcesses).Count -gt 0) {
    $code = Invoke-Setup 'upgrade-while-running'
    Check '有终端在运行 is.exe 时，安装程序不升级（退出码不为 0）' ($code -ne 0) "退出码 $code"
    Check '……PowerShell 配置文件没有被改动' ((Get-Hash $profilePath) -eq $profileInstalled)
    $removed = Invoke-Uninstall 'while-running' 15
    Check '有终端在运行 is.exe 时，卸载程序不卸载' ((-not $removed) -and (Test-Path -LiteralPath $installedExe))
}
else {
    Add-Result '有终端在运行时阻止升级和卸载' '失败' '60 秒内没有看到 is.exe 进程'
}
Wait-Process -Id $hold.Id -Timeout 120 -ErrorAction SilentlyContinue
Get-IsProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# ---- 4. 再运行一次安装程序（升级，A3 第 5 项） ----
$code = Invoke-Setup 'upgrade'
Check '再次运行安装程序正常结束（退出码 0）' ($code -eq 0) "退出码 $code"
Check '再次安装没有重复添加初始化语句（配置文件不变）' ((Get-Hash $profilePath) -eq $profileInstalled)
Check '再次安装后资源仍与程序同一版本' ((Test-Path -LiteralPath $versionFile) -and (Get-Content -LiteralPath $versionFile -Raw).Trim() -eq $version)

# ---- 5. 补全配置写错时，PowerShell 仍然可用（T-062） ----
if ($interactive -and (Test-Path -LiteralPath $configPath)) {
    $backup = Join-Path $LogDir 'inshellisenserc.backup'
    Copy-Item -LiteralPath $configPath -Destination $backup
    Set-Content -LiteralPath $configPath -Value 'maxSuggestions = '
    $r = Invoke-Checker 'survive' $pwsh @('-NoLogo')
    Check '补全配置写错时，新开的 PowerShell 不会被关闭，仍能执行命令' ([bool]$r.ok)
    Copy-Item -LiteralPath $backup -Destination $configPath -Force
}
else {
    Add-Result '补全配置写错时 PowerShell 仍然可用' '跳过' '需要交互式会话'
}

# ---- 6. 卸载（A3 第 6 项） ----
$removed = Invoke-Uninstall 'final' 120
Check '卸载程序完成，卸载信息已删除' $removed
for ($waited = 0; $waited -lt 30 -and (Test-Path -LiteralPath $installDir); $waited++) { Start-Sleep -Seconds 1 }
Check '安装目录已删除' (-not (Test-Path -LiteralPath $installDir))
Check 'PowerShell 配置文件恢复原样（哈希相同，或者仍然不存在）' ((Get-Hash $profilePath) -eq $profileBefore)
$pathAfter = Get-UserPathValue
$samePath = if ($null -eq $pathBefore) { $null -eq $pathAfter } else { $pathAfter -and $pathAfter.Value -ceq $pathBefore.Value -and $pathAfter.Kind -eq $pathBefore.Kind }
Check '用户 PATH 恢复原样（值和类型都相同）' $samePath
if (-not $configExisted) { Check '没有改过的默认补全配置已删除' (-not (Test-Path -LiteralPath $configPath)) }
if (-not $dataExisted) { Check '安装时新建的数据目录已删除' (-not (Test-Path -LiteralPath $dataDir)) }

# ---- 汇总 ----
$failed = @($results | Where-Object Status -eq '失败')
$summary = @('| 检查 | 结果 | 说明 |', '| --- | --- | --- |') + @($results | ForEach-Object { "| $($_.Name) | $($_.Status) | $($_.Detail) |" })
Set-Content -LiteralPath (Join-Path $LogDir 'summary.md') -Value $summary -Encoding utf8
if ($env:GITHUB_STEP_SUMMARY) { Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value (@('## 安装包验收', '') + $summary) -Encoding utf8 }
if ($env:GITHUB_ACTIONS -eq 'true') {
    Write-Host "::notice title=安装包验收::通过 $(@($results | Where-Object Status -eq '通过').Count)，失败 $($failed.Count)，跳过 $(@($results | Where-Object Status -eq '跳过').Count)"
}
Write-Host ''
Write-Host "日志：$LogDir"
if ($failed.Count -gt 0) {
    Write-Host "失败 $($failed.Count) 项" -ForegroundColor Red
    exit 1
}
Write-Host "全部通过（$($results.Count) 项，其中跳过 $(@($results | Where-Object Status -eq '跳过').Count) 项）" -ForegroundColor Green
exit 0
