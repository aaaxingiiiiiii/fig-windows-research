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

# 按配置文件原来的编码把文本转成字节（包括 BOM）
function ConvertTo-ProfileBytes {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text, [Parameter(Mandatory)][string]$Encoding)
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
    return [byte[]]($preamble + $encoder.GetBytes($Text))
}

function Get-BytesHash([byte[]]$Bytes) {
    return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes))
}

# 原子地写入文件：先写到同一目录下的临时文件，再替换原文件。写到一半中断时，原文件保持不变
function Write-FileAtomic {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyCollection()][byte[]]$Bytes)
    $temp = "$Path.figwin-tmp-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
    try {
        $stream = [IO.File]::Create($temp)
        try {
            $stream.Write($Bytes, 0, $Bytes.Length)
            $stream.Flush($true)
        }
        finally {
            $stream.Dispose()
        }
        if (Test-Path -LiteralPath $Path -PathType Leaf) { [IO.File]::Replace($temp, $Path, [NullString]::Value) }
        else { [IO.File]::Move($temp, $Path) }
    }
    finally {
        if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }
    }
}

function Write-ProfileFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][AllowEmptyString()][string]$Text, [Parameter(Mandatory)][string]$Encoding)
    Write-FileAtomic -Path $Path -Bytes (ConvertTo-ProfileBytes -Text $Text -Encoding $Encoding)
}

# 删除安装时加入的两行：标记注释，以及紧跟其后的初始化语句。只删这两行和它们的换行符，其他内容（包括混用的 LF 和 CRLF）原样保留。
# 返回删除后的文本和是否找到。
function Remove-ProfileBlock {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Text, [Parameter(Mandatory)][string]$SourceLine)
    $pattern = '(?m)^[ \t]*' + [regex]::Escape($ProfileMarker) + '[ \t]*(?:\r?\n|\z)(?:[ \t]*' + [regex]::Escape($SourceLine) + '[ \t]*(?:\r?\n|\z))?'
    $result = [regex]::Replace($Text, $pattern, '')
    return [pscustomobject]@{ Text = $result; Found = ($result -ne $Text) }
}

# 安装记录：原子写入；读取时用索引访问（$state['键']），旧版本的记录缺少某些键时得到 $null，不会在严格模式下出错
function Save-InstallState([System.Collections.IDictionary]$State, [string]$Path) {
    Write-FileAtomic -Path $Path -Bytes ([Text.UTF8Encoding]::new($false).GetBytes(($State | ConvertTo-Json)))
}
