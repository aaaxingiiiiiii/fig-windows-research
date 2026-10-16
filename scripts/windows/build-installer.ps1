# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 构建 Windows 安装包（T-059）。在 Windows 的 PowerShell 7 中，于仓库根目录运行：
#   pwsh -File scripts/windows/build-installer.ps1 [-SkipPackage] [-Iscc <ISCC.exe 的路径>] [-StageOnly]
# 步骤：
#   1. 打包单文件程序：在 src/inshellisense 下 npm ci、npm run build、npm run package（-SkipPackage 时跳过，直接用已有的）
#   2. 检查程序报告的版本与 package.json 一致，格式为 x.y.z-figwin.n
#   3. 把要安装的文件放进 dist/stage：is.exe、安装和卸载脚本、默认补全配置、使用说明、许可证和第三方声明
#   4. 用 Inno Setup 7.1 或更新版本编译 installer/figwin.iss
# 结果：dist/figwin-setup-<版本>.exe，以及同名的 .sha256 文件。
# -StageOnly 只做第 1 至 3 步，可以在 Mac 上检查准备的文件（Inno Setup 只能在 Windows 上运行）。

[CmdletBinding()]
param(
    [switch]$SkipPackage,
    [string]$Iscc,
    [switch]$StageOnly,
    [string]$OutputDir = (Join-Path $PSScriptRoot '..' '..' 'dist')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).ProviderPath
$package = Join-Path $repo 'src' 'inshellisense'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$OutputDir = (Resolve-Path $OutputDir).ProviderPath

function Invoke-Checked([string]$What, [scriptblock]$Command) {
    Write-Host "== $What"
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$What 失败，退出码 $LASTEXITCODE" }
}

# ---- 1. 打包 ----
if (-not $SkipPackage) {
    Push-Location $package
    try {
        Invoke-Checked 'npm ci' { npm ci }
        Invoke-Checked 'npm run build' { npm run build }
        Invoke-Checked 'npm run package' { npm run package }
    }
    finally {
        Pop-Location
    }
}
$platform = if ($IsWindows) { 'win32' } elseif ($IsMacOS) { 'darwin' } else { 'linux' }
$arch = "$([Runtime.InteropServices.RuntimeInformation]::OSArchitecture)".ToLowerInvariant()
$exe = Join-Path $package 'pkg' "inshellisense-$platform-$arch$(if ($IsWindows) { '.exe' })"
if (-not (Test-Path -LiteralPath $exe)) { throw "找不到打包好的程序：$exe。去掉 -SkipPackage 重新运行。" }

# ---- 2. 版本 ----
$version = (Get-Content -LiteralPath (Join-Path $package 'package.json') -Raw | ConvertFrom-Json).version
$reported = "$(& $exe --version)".Trim()
if ($reported -ne $version) { throw "程序报告的版本是 $reported，package.json 中是 $version。程序可能不是用当前代码打包的。" }
if ($version -notmatch '^(\d+)\.(\d+)\.(\d+)-figwin\.(\d+)$') { throw "版本号的格式应为 x.y.z-figwin.n，现在是 $version" }
$numericVersion = "$($Matches[1]).$($Matches[2]).$($Matches[3]).$($Matches[4])"
Write-Host "版本：$version（$numericVersion）"

# ---- 3. 准备要安装的文件 ----
$stage = Join-Path $OutputDir 'stage'
if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
$licenses = Join-Path $stage 'licenses'
New-Item -ItemType Directory -Path (Join-Path $stage 'scripts'), (Join-Path $stage 'config'), $licenses | Out-Null
Copy-Item -LiteralPath $exe -Destination (Join-Path $stage 'is.exe')
foreach ($script in 'install.ps1', 'uninstall.ps1', 'profile-file.ps1', 'user-path.ps1') {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $stage 'scripts')
}
Copy-Item -LiteralPath (Join-Path $repo 'installer' 'inshellisenserc.toml') -Destination (Join-Path $stage 'config')
Copy-Item -LiteralPath (Join-Path $repo 'installer' 'README.txt') -Destination $stage

# 安装向导中显示的许可证：本项目的 MIT 许可证，加上第三方软件的说明
$notice = @"
figwin 终端补全

$((Get-Content -LiteralPath (Join-Path $repo 'LICENSE') -Raw).Trim())

------------------------------------------------------------
本程序包含第三方软件，它们的许可证见安装目录下的 licenses 文件夹：
  inshellisense-LICENSE.txt   inshellisense（Microsoft，MIT 许可）
  node-LICENSE.txt            Node.js 运行时及其包含的组件
  THIRD-PARTY-NOTICES.txt     打包进程序的 npm 依赖（包括 Fig 的补全规格库 @withfig/autocomplete）
"@
Set-Content -LiteralPath (Join-Path $licenses 'LICENSE.txt') -Value $notice -Encoding utf8BOM
Copy-Item -LiteralPath (Join-Path $package 'LICENSE') -Destination (Join-Path $licenses 'inshellisense-LICENSE.txt')
$nodeLicense = Get-ChildItem -LiteralPath (Join-Path $package 'pkg') -Directory -Filter 'node-v*' |
    ForEach-Object { Join-Path $_.FullName 'LICENSE' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $nodeLicense) { throw '找不到 Node.js 的许可证（应在 src/inshellisense/pkg/node-v*/LICENSE，由 npm run package 下载）。' }
Copy-Item -LiteralPath $nodeLicense -Destination (Join-Path $licenses 'node-LICENSE.txt')

# 第三方声明：npm 的生产依赖，每个包一节，附上它自带的许可证文本
Push-Location $package
try {
    $dirs = @(npm ls --omit=dev --all --parseable 2>$null | Sort-Object -Unique | Where-Object { $_ -and $_ -ne $package })
}
finally {
    Pop-Location
}
if ($dirs.Count -eq 0) { throw 'npm ls 没有列出任何依赖，先在 src/inshellisense 下运行 npm ci。' }
$sections = foreach ($dir in $dirs) {
    $meta = Get-Content -LiteralPath (Join-Path $dir 'package.json') -Raw | ConvertFrom-Json -AsHashtable
    $file = Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Name -match '^(licen[cs]e|copying)(\..*)?$' } | Select-Object -First 1
    $text = if ($file) { (Get-Content -LiteralPath $file.FullName -Raw).Trim() } else { "（包中没有许可证文件；package.json 中的 license 字段：$($meta['license'])）" }
    $license = if ($meta['license']) { $meta['license'] } else { 'package.json 中未注明，见下方许可证文本' }
    "==== $($meta['name'])@$($meta['version'])（$license）====`n`n$text`n"
}
Set-Content -LiteralPath (Join-Path $licenses 'THIRD-PARTY-NOTICES.txt') -Encoding utf8BOM -Value (@("figwin 终端补全打包的第三方 npm 依赖（共 $($dirs.Count) 个）", '') + $sections)
Write-Host "已准备：$stage（第三方依赖 $($dirs.Count) 个）"
if ($StageOnly) { return }

# ---- 4. 编译安装包 ----
if (-not $IsWindows) { throw 'Inno Setup 只能在 Windows 上运行。在其他系统上请加 -StageOnly。' }
if (-not $Iscc) {
    $Iscc = @(
        (Get-Command iscc -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source),
        (Join-Path $env:ProgramFiles 'Inno Setup 7' 'ISCC.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 7' 'ISCC.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs' 'Inno Setup 7' 'ISCC.exe')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}
if (-not $Iscc) { throw '找不到 Inno Setup 7 的 ISCC.exe。请安装 Inno Setup 7.1 或更新版本，或者用 -Iscc 指定。' }
$isccVersion = [version](Get-Item -LiteralPath $Iscc).VersionInfo.ProductVersion.Split(' ')[0]
if ($isccVersion -lt [version]'7.1') { throw "需要 Inno Setup 7.1 或更新版本（其中有官方的简体中文界面），现在是 $isccVersion：$Iscc" }
Write-Host "Inno Setup：$Iscc（$isccVersion）"
Invoke-Checked 'ISCC' {
    & $Iscc "/DAppVersion=$version" "/DNumericVersion=$numericVersion" "/DStageDir=$stage" "/DOutputDir=$OutputDir" (Join-Path $repo 'installer' 'figwin.iss')
}
$setup = Join-Path $OutputDir "figwin-setup-$version.exe"
$hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$setup.sha256" -Value "$hash  $(Split-Path -Leaf $setup)" -Encoding ascii
Write-Host "安装包：$setup"
Write-Host "SHA256：$hash"
