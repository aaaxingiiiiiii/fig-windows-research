// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace FigWin.OverlayHost.Transport;

/// <summary>
/// 生产端点的命名（docs/protocol.md 第 2 节，T-063，D-016）：figwin-overlay-v1-&lt;userKey&gt;-&lt;logonSession&gt;。
/// 按用户和 Windows 登录会话隔离；userKey 只用来区分，不是凭据，访问控制靠 PipeOptions.CurrentUserOnly。
/// inshellisense 一侧用同样的规则计算（src/inshellisense/src/overlay/launch.ts），两边的测试使用同一组数据。
/// </summary>
public static class OverlayEndpoint
{
    /// <summary>用户名转小写后的 SHA-256，取前 16 个十六进制字符。</summary>
    public static string UserKey(string userName) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(userName.ToLowerInvariant())))[..16];

    public static string DefaultPipeName(string userName, int logonSession) =>
        $"figwin-overlay-v1-{UserKey(userName)}-{logonSession.ToString(System.Globalization.CultureInfo.InvariantCulture)}";

    /// <summary>当前用户、当前登录会话的默认管道名。</summary>
    public static string DefaultPipeName()
    {
        using var process = Process.GetCurrentProcess();
        return DefaultPipeName(Environment.UserName, process.SessionId);
    }
}
