# Copyright (c) fig-windows-research contributors.
# Licensed under the MIT License.
#
# install.ps1 和 uninstall.ps1 共用：读写当前用户的 PATH（注册表 HKCU\Environment 中的 Path 值），只在 Windows 上使用。
# 直接读写注册表，保留原来的值类型（通常是 REG_EXPAND_SZ）和其中没有展开的 %变量%。
# [Environment]::SetEnvironmentVariable 会把值改成 REG_SZ 并展开变量，卸载后就无法恢复原样。
# $Key 是 HKCU 下的子键；测试时指向一个临时的子键，不碰真实的 PATH。

function Get-UserPathValue([string]$Key = 'Environment') {
    $handle = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($Key)
    try {
        if ($null -eq $handle -or $handle.GetValueNames() -notcontains 'Path') { return $null }
        return [ordered]@{
            Value = [string]$handle.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            Kind  = "$($handle.GetValueKind('Path'))"
        }
    }
    finally {
        if ($handle) { $handle.Dispose() }
    }
}

# $PathValue 为 $null 时删除 Path 值（安装前没有这个值）；否则是 Get-UserPathValue 返回的 Value 和 Kind
function Set-UserPathValue($PathValue, [string]$Key = 'Environment') {
    $handle = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($Key)
    try {
        if ($null -eq $PathValue) { $handle.DeleteValue('Path', $false) }
        else { $handle.SetValue('Path', [string]$PathValue.Value, [Microsoft.Win32.RegistryValueKind]$PathValue.Kind) }
    }
    finally {
        $handle.Dispose()
    }
    if ($Key -eq 'Environment') { Send-EnvironmentChange }
}

# 通知资源管理器等程序：环境变量变了。之后新开的终端才能拿到新的 PATH
function Send-EnvironmentChange {
    if (-not ('FigWin.NativeMethods' -as [type])) {
        Add-Type -Namespace FigWin -Name NativeMethods -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
    }
    $result = [UIntPtr]::Zero
    # HWND_BROADCAST、WM_SETTINGCHANGE、SMTO_ABORTIFHUNG，最多等 5 秒
    [void][FigWin.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, 'Environment', 0x0002, 5000, [ref]$result)
}

function Split-PathEntries([string]$Value) {
    return @($Value -split ';' | Where-Object { $_ })
}

# PATH 中的一项是否就是这个目录（展开变量、忽略大小写和结尾的反斜杠）
function Test-PathEntry([string]$Entry, [string]$Directory) {
    return [Environment]::ExpandEnvironmentVariables($Entry).TrimEnd('\') -ieq $Directory.TrimEnd('\')
}
