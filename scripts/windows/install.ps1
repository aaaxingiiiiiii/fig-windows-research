# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# 安装终端内补全（阶段 A，T-040 / T-058 / T-059）。在 PowerShell 7 中运行：
#   pwsh -File scripts/windows/install.ps1 [-Source <打包好的 exe>] [-ConfigTemplate <默认配置>] [-NoProfileUpdate] [-WhatIf]
# 安装包（installer/figwin.iss）先把程序放进安装目录，再用 -Source 指向它运行本脚本（原地安装，不再复制）。
#
# 做的事（每一步都打印出来）：
#   1. 把打包好的单文件程序复制到 %LOCALAPPDATA%\Programs\figwin\is.exe
#   2. 把这个目录加到当前用户的 PATH 最前面（inshellisense 的初始化脚本会调用 `is`）
#   3. 运行 `is reinit` 和 `is init pwsh`：删除旧资源后重新解包，生成初始化脚本，得到要加入配置文件的一行
#   4. 备份 $PROFILE，然后在最后追加两行：一行标记注释，一行初始化语句（必须是配置文件的最后一行）；-NoProfileUpdate 时跳过
#   5. 给了 -ConfigTemplate 并且用户还没有 ~/.inshellisenserc 时，用它创建一份默认配置
# 安装状态和原始配置文件的备份保存在安装目录中。每一步都先更新记录再修改，文件都是原子写入；uninstall.ps1 据此撤销做过的步骤，
# 并把配置文件逐字节恢复原样。上次安装中途失败时，再运行一次会继续完成剩下的步骤。
# 重复运行（升级）时只更新程序、重新解包资源，不会重复添加初始化语句。资源必须与程序是同一版本，否则 is 无法启动。

[CmdletBinding(SupportsShouldProcess)]
param(
    # 打包好的程序（T-040 用 `npm run package` 在 Windows 上生成）
    [string]$Source = (Join-Path $PSScriptRoot '..' '..' 'src' 'inshellisense' 'pkg' 'inshellisense-win32-x64.exe'),
    [string]$InstallDir = $(if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'Programs' 'figwin' } else { $null }),
    [string]$ProfilePath = $PROFILE.CurrentUserCurrentHost,
    # inshellisense 解包资源的目录，只用来记录安装前是否已经存在。用户目录的取法与 Node 的 os.homedir() 相同（Windows 上优先 USERPROFILE）
    [string]$DataDir = (Join-Path $(if ($IsWindows -and $env:USERPROFILE) { $env:USERPROFILE } else { [Environment]::GetFolderPath('UserProfile') }) '.inshellisense'),
    [string]$ExecutableName = $(if ($IsWindows) { 'is.exe' } else { 'is' }),
    # 默认配置文件的模板；用户已有配置文件时不覆盖
    [string]$ConfigTemplate,
    [string]$ConfigPath = (Join-Path $(if ($IsWindows -and $env:USERPROFILE) { $env:USERPROFILE } else { [Environment]::GetFolderPath('UserProfile') }) '.inshellisenserc'),
    # 不修改 PowerShell 配置文件（安装包中取消勾选“自动启用补全”时使用）
    [switch]$NoProfileUpdate,
    # 不修改用户的 PATH（测试或非 Windows 系统使用）
    [switch]$NoPathUpdate,
    # 用户 PATH 所在的注册表子键（HKCU 下）；测试时指向临时的子键
    [string]$PathKey = 'Environment',
    # 把输出同时写入这个日志文件（安装包使用）
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'profile-file.ps1')
. (Join-Path $PSScriptRoot 'user-path.ps1')

if ($LogPath) { Start-Transcript -LiteralPath $LogPath -Append | Out-Null }
try {
    if (-not $InstallDir) { throw '无法确定安装目录，请用 -InstallDir 指定。' }
    if (-not $ProfilePath) { throw '无法确定 PowerShell 配置文件的位置，请用 -ProfilePath 指定。' }
    if ($PSVersionTable.PSVersion.Major -lt 7) { throw "需要在 PowerShell 7 中运行，当前是 $($PSVersionTable.PSVersion)。" }
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "找不到程序：$Source。先在 src/inshellisense 下运行 npm run package。" }
    if ($ConfigTemplate -and -not (Test-Path -LiteralPath $ConfigTemplate -PathType Leaf)) { throw "找不到默认配置：$ConfigTemplate" }

    $statePath = Join-Path $InstallDir 'install-state.json'
    $target = Join-Path $InstallDir $ExecutableName
    $state = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json -AsHashtable } else { $null }
    # completed 为 true：已经装好，这次是升级。为 false：上次安装中途失败，这次继续完成剩下的步骤。
    # 第 1 版的安装记录（T-058，只在自测中出现过）没有 completed，当作已经装好。
    $alreadyInstalled = $null -ne $state -and ($state['completed'] -or -not $state.ContainsKey('completed'))
    $resuming = $null -ne $state -and -not $alreadyInstalled
    # 先写记录、再修改：任何一步中途失败，卸载都能根据记录撤销已经做过的修改
    $saveState = {
        if (-not $WhatIfPreference) { Save-InstallState $state $statePath }
    }
    if ($resuming) {
        Write-Host '上次安装没有完成，继续完成剩下的步骤。'
        $ProfilePath = $state['profilePath']
        $ConfigPath = $state['configPath']
        if ($state['pathKey']) { $PathKey = $state['pathKey'] }
    }

    # ---- 1. 程序 ----
    New-Item -ItemType Directory -Force -Path $InstallDir -WhatIf:$false | Out-Null
    $inPlace = (Test-Path -LiteralPath $target) -and ((Resolve-Path -LiteralPath $Source).ProviderPath -eq (Resolve-Path -LiteralPath $target).ProviderPath)
    if ($inPlace) {
        Write-Host "程序：$target（已由安装包放好）"
    }
    elseif ($PSCmdlet.ShouldProcess($target, '复制程序')) {
        Copy-Item -LiteralPath $Source -Destination $target -Force
        if (-not $IsWindows) { chmod +x $target }
        Write-Host "程序：$target"
    }
    if (-not $WhatIfPreference) {
        $version = "$(& $target --version)".Trim()
        if ($version -notlike '*figwin*') { Write-Warning "程序的版本是 $version，不是本项目的构建（应包含 figwin）。是否误用了原版 inshellisense？" }
        else { Write-Host "版本：$version" }
    }

    if ($null -eq $state) {
        $state = [ordered]@{
            version         = 3
            completed       = $false
            installedAt     = (Get-Date).ToString('o')
            installDir      = $InstallDir
            executable      = $target
            pathAdded       = $false
            pathKey         = $PathKey
            pathBefore      = $null
            pathAfter       = $null
            pathAfterKind   = $null
            dataDir         = $DataDir
            dataDirExisted  = (Test-Path -LiteralPath $DataDir)
            profileUpdated  = $false
            profilePath     = $ProfilePath
            profileExisted  = $false
            originalHash    = $null
            installedHash   = $null
            sourceLine      = $null
            configPath      = $ConfigPath
            configCreated   = $false
            configHash      = $null
        }
        & $saveState
    }

    # ---- 2. PATH ----
    if ($alreadyInstalled) {
        # 升级：不改动
    }
    elseif ($NoPathUpdate -or -not $IsWindows) {
        Write-Host 'PATH：未修改（-NoPathUpdate 或非 Windows）'
    }
    elseif ($state['pathAdded']) {
        Write-Host 'PATH：上次已经加入安装目录'
    }
    else {
        $before = Get-UserPathValue $PathKey
        $entries = if ($before) { Split-PathEntries $before.Value } else { @() }
        if ($entries | Where-Object { Test-PathEntry $_ $InstallDir }) {
            Write-Host 'PATH：安装目录已在用户 PATH 中'
        }
        elseif ($PSCmdlet.ShouldProcess('用户 PATH', "在最前面加入 $InstallDir")) {
            $after = [ordered]@{ Value = (@($InstallDir) + $entries) -join ';'; Kind = $(if ($before) { $before.Kind } else { 'ExpandString' }) }
            $state['pathBefore'] = $before
            $state['pathAfter'] = $after.Value
            $state['pathAfterKind'] = $after.Kind
            $state['pathAdded'] = $true
            & $saveState
            Set-UserPathValue $after $PathKey
            Write-Host 'PATH：已在用户 PATH 最前面加入安装目录（原来的值已记录，卸载时恢复）'
        }
    }
    $env:PATH = "$InstallDir$([IO.Path]::PathSeparator)$env:PATH"

    # ---- 3. is reinit、is init pwsh：重新解包资源，得到初始化语句 ----
    # 解包时已经存在的文件会被跳过，升级后会留下旧版本的补全规格和脚本，所以先用 reinit 删掉旧资源（包括日志）再解包（F-036）。
    # 有终端正在运行 is 时，原生模块被占用、删不掉：安装包会先请用户关闭这些终端。
    $sourceLine = $null
    if ($PSCmdlet.ShouldProcess($DataDir, '运行 reinit，重新生成资源')) {
        & $target reinit | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "is reinit 失败，退出码 $LASTEXITCODE。如果有打开的终端正在使用补全，请关闭它们后重试。" }
    }
    if ($PSCmdlet.ShouldProcess($target, '运行 init pwsh')) {
        $output = & $target init pwsh
        if ($LASTEXITCODE -ne 0) { throw "is init pwsh 失败，退出码 $LASTEXITCODE。" }
        $sourceLine = @($output | ForEach-Object { "$_".Trim() } | Where-Object { $_ }) | Select-Object -Last 1
        if (-not $sourceLine) { throw 'is init pwsh 没有输出初始化语句。' }
        Write-Host "资源：已解包到 $DataDir"
    }

    if ($alreadyInstalled) {
        if ($state['profileUpdated'] -and $sourceLine -and $sourceLine -ne $state['sourceLine']) {
            Write-Warning "初始化语句与安装时不同（资源目录可能变了）。请卸载后重新安装。`n  安装时：$($state['sourceLine'])`n  现在：$sourceLine"
        }
        Write-Host '已经安装过：更新了程序和资源，没有修改 PATH、PowerShell 配置文件和补全配置。要改变安装选项，请先卸载再安装。'
        return
    }

    # ---- 4. PowerShell 配置文件 ----
    $profileHasBlock = (Test-Path -LiteralPath $ProfilePath -PathType Leaf) -and (Read-ProfileFile -Path $ProfilePath).Text.Contains($ProfileMarker)
    if ($NoProfileUpdate) {
        Write-Host "PowerShell 配置文件：未修改（-NoProfileUpdate）。需要补全时，在 PowerShell 7 中运行 is。"
    }
    elseif ($state['profileUpdated'] -and $profileHasBlock) {
        Write-Host 'PowerShell 配置文件：上次已经修改'
    }
    elseif ($PSCmdlet.ShouldProcess($ProfilePath, '备份并在最后追加初始化语句')) {
        if (-not $state['profileUpdated']) {
            # 第一次修改前备份原文件；继续上次没完成的安装时，沿用上次的备份（它才是安装前的内容）
            $state['profileExisted'] = Test-Path -LiteralPath $ProfilePath -PathType Leaf
            if ($state['profileExisted']) {
                Copy-Item -LiteralPath $ProfilePath -Destination (Join-Path $InstallDir 'profile-backup.bin') -Force
                $state['originalHash'] = (Get-FileHash -LiteralPath $ProfilePath -Algorithm SHA256).Hash
            }
        }
        if (-not (Test-Path -LiteralPath $ProfilePath -PathType Leaf)) {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ProfilePath) | Out-Null
        }
        $file = Read-ProfileFile -Path $ProfilePath
        $newline = if ($file.Text.Contains("`r`n") -or (-not $file.Text -and $IsWindows)) { "`r`n" } else { "`n" }
        $separator = if ($file.Text.Length -gt 0 -and -not $file.Text.EndsWith("`n")) { $newline } else { '' }
        $bytes = ConvertTo-ProfileBytes -Text ($file.Text + "$separator$ProfileMarker$newline$sourceLine$newline") -Encoding $file.Encoding
        $state['profileUpdated'] = $true
        $state['sourceLine'] = $sourceLine
        $state['installedHash'] = Get-BytesHash $bytes
        & $saveState
        Write-FileAtomic -Path $ProfilePath -Bytes $bytes
        Write-Host "PowerShell 配置文件：$ProfilePath（$(if ($state['profileExisted']) { '原文件已备份' } else { '新建' })，在最后追加了 2 行）"
    }

    # ---- 5. 补全配置 ----
    if ($ConfigTemplate) {
        if (Test-Path -LiteralPath $ConfigPath) {
            Write-Host "补全配置：$ConfigPath $(if ($state['configCreated']) { '上次已经创建' } else { '已经存在，保留原样' })"
        }
        elseif ($PSCmdlet.ShouldProcess($ConfigPath, '创建默认的补全配置')) {
            $bytes = [IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ConfigTemplate).ProviderPath)
            $state['configCreated'] = $true
            $state['configHash'] = Get-BytesHash $bytes
            & $saveState
            Write-FileAtomic -Path $ConfigPath -Bytes $bytes
            Write-Host "补全配置：已创建 $ConfigPath（修改后新开一个 PowerShell 标签生效）"
        }
    }

    $state['completed'] = $true
    $state['completedAt'] = (Get-Date).ToString('o')
    & $saveState
    if ($IsWindows -and -not $NoPathUpdate) {
        $resolved = (Get-Command is -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
        if ($resolved -and $resolved -ne $target) { Write-Warning "PATH 中的 is 指向 $resolved，不是刚安装的程序。请检查是否装过原版 inshellisense。" }
    }
    Write-Host '完成。新开一个 Windows Terminal 标签即可使用；卸载请运行 scripts/windows/uninstall.ps1（用安装包安装的，在“设置 → 应用”中卸载）。'
}
finally {
    if ($LogPath) { Stop-Transcript | Out-Null }
}
