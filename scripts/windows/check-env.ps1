# Windows 环境检查（只读，不安装、不修改任何东西）
# 用法：在 PowerShell 7 中运行  pwsh -NoProfile -File scripts/windows/check-env.ps1
# 输出一段 Markdown 表格，可直接粘贴到验证报告（research/spike-*.md）开头。
# 已在 Windows 11 / PowerShell 7.6.5 验证解析及版本读取；运行时配置仍需在目标交互终端确认。

$ErrorActionPreference = 'SilentlyContinue'

function Get-CmdVersion([string]$cmd, [string[]]$cmdArgs) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $c) { return '未安装' }
    try { return ((& $cmd @cmdArgs 2>&1) | Select-Object -First 1).ToString().Trim() } catch { return '已安装，读取版本失败' }
}

$os = Get-CimInstance Win32_OperatingSystem
$wt = Get-AppxPackage -Name 'Microsoft.WindowsTerminal*' | Sort-Object Version -Descending | Select-Object -First 1
$psrl = Get-Module PSReadLine -ListAvailable | Sort-Object Version -Descending | Select-Object -First 1
$dpi = (Get-ItemProperty 'HKCU:\Control Panel\Desktop\WindowMetrics' -Name AppliedDPI).AppliedDPI
$gitBash = @("$env:ProgramFiles\Git\bin\bash.exe", "${env:ProgramFiles(x86)}\Git\bin\bash.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1

$rows = [ordered]@{
    'Windows'            = if ($os) { "$($os.Caption) $($os.Version) build $($os.BuildNumber)" } else { '读取失败' }
    'CPU 架构'           = $env:PROCESSOR_ARCHITECTURE
    '主显示器缩放'       = if ($dpi) { "$([math]::Round($dpi / 96 * 100))%" } else { '读取失败' }
    'Windows Terminal'   = if ($wt) { $wt.Version.ToString() } else { '未找到（可能不是 Store 版）' }
    'PowerShell'         = $PSVersionTable.PSVersion.ToString()
    'PSReadLine'         = if ($psrl) { $psrl.Version.ToString() } else { '未找到' }
    'PredictionSource'   = $(try { (Get-PSReadLineOption).PredictionSource.ToString() } catch { '读取失败' })
    'Node.js'            = Get-CmdVersion 'node' @('--version')
    'npm'                = Get-CmdVersion 'npm' @('--version')
    'git'                = Get-CmdVersion 'git' @('--version')
    'Git Bash'           = if ($gitBash) { '已安装' } else { '未安装' }
    '.NET SDK'           = if (Get-Command dotnet -ErrorAction SilentlyContinue) { $(if (@(& dotnet --list-sdks 2>$null).Count -gt 0) { Get-CmdVersion 'dotnet' @('--version') } else { '未安装 SDK（检测到 dotnet 入口）' }) } else { '未安装' }
    'inshellisense (is)' = Get-CmdVersion 'is' @('--version')
}

"| 项目 | 版本 / 状态 |"
"| --- | --- |"
foreach ($k in $rows.Keys) { "| $k | $($rows[$k]) |" }

$node = $rows['Node.js']
if ($node -match '^v(\d+)\.') {
    $major = [int]$Matches[1]
    if ($major -lt 18 -or $major -ge 23) { "`n> 提示：从源码运行 inshellisense 需要 Node 18–22，当前为 $node（见 docs/windows-setup.md）。" }
}
