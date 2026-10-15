# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# install.ps1 和 uninstall.ps1 共用：按原编码读写 PowerShell 配置文件，保留 BOM。
# Windows PowerShell 5.1 写出的配置文件可能是 UTF-16；PowerShell 7 默认是不带 BOM 的 UTF-8。

$ProfileMarker = '# fig-windows-research: inshellisense (added by scripts/windows/install.ps1; remove with uninstall.ps1)'

function Read-ProfileFile {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Text = ''; Encoding = 'utf8' }
    }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        return [pscustomobject]@{ Text = [Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3); Encoding = 'utf8BOM' }
    }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        return [pscustomobject]@{ Text = [Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2); Encoding = 'utf16le' }
    }
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        return [pscustomobject]@{ Text = [Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2); Encoding = 'utf16be' }
    }
    try {
        return [pscustomobject]@{ Text = [Text.UTF8Encoding]::new($false, $true).GetString($bytes); Encoding = 'utf8' }
    }
    catch [Text.DecoderFallbackException] {
        # Windows PowerShell 5.1 的 Add-Content 默认使用本地代码页（中文系统上是 GBK）
        $codePage = [Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage
        try {
            $ansi = [Text.Encoding]::GetEncoding($codePage, [Text.EncoderFallback]::ExceptionFallback, [Text.DecoderFallback]::ExceptionFallback)
            return [pscustomobject]@{ Text = $ansi.GetString($bytes); Encoding = "codepage:$codePage" }
        }
        catch {
            throw "无法识别配置文件的编码（$Path）。请先把它另存为 UTF-8，再运行安装。"
        }
    }
}

function Write-ProfileFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyString()][string]$Text, [Parameter(Mandatory)][string]$Encoding)
    [byte[]]$preamble = @()
    if ($Encoding -eq 'utf8BOM') {
        $encoder = [Text.UTF8Encoding]::new($false)
        $preamble = 0xEF, 0xBB, 0xBF
    }
    elseif ($Encoding -eq 'utf16le') {
        $encoder = [Text.UnicodeEncoding]::new($false, $false)
        $preamble = 0xFF, 0xFE
    }
    elseif ($Encoding -eq 'utf16be') {
        $encoder = [Text.UnicodeEncoding]::new($true, $false)
        $preamble = 0xFE, 0xFF
    }
    elseif ($Encoding -like 'codepage:*') {
        $encoder = [Text.Encoding]::GetEncoding([int]$Encoding.Substring(9), [Text.EncoderFallback]::ExceptionFallback, [Text.DecoderFallback]::ExceptionFallback)
    }
    else {
        $encoder = [Text.UTF8Encoding]::new($false)
    }
    [byte[]]$body = $encoder.GetBytes($Text)
    $stream = [IO.File]::Create($Path)
    try {
        $stream.Write($preamble, 0, $preamble.Length)
        $stream.Write($body, 0, $body.Length)
    }
    finally {
        $stream.Dispose()
    }
}

# 删除安装时加入的两行：标记注释，以及紧跟其后的初始化语句。返回删除后的文本和是否找到。
function Remove-ProfileBlock {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text, [Parameter(Mandatory)][string]$SourceLine)
    $newline = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
    $lines = [Collections.Generic.List[string]]::new([string[]][regex]::Split($Text, '\r?\n'))
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq $ProfileMarker) {
            $count = if ($i + 1 -lt $lines.Count -and $lines[$i + 1].Trim() -eq $SourceLine) { 2 } else { 1 }
            $lines.RemoveRange($i, $count)
            $found = $true
            $i--
        }
    }
    return [pscustomobject]@{ Text = ($lines -join $newline); Found = $found }
}
