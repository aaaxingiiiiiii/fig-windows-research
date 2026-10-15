// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text;

namespace FigWin.OverlayHost.Protocol;

public sealed class FramingException(string message) : Exception(message);

/// <summary>
/// 把字节流按 LF 切成消息行（第 2 节）：按字节累计到换行再解码，支持中文字符跨读包、半包和多条合包；
/// 末尾的 CR 去掉；超过单行上限时（即使还没有 LF）立即报错；拒绝 BOM 和无效的 UTF-8。
/// </summary>
public sealed class LineFramer
{
    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
    private readonly MemoryStream _pending = new();

    /// <summary>返回本次拼出的完整消息行（UTF-8 字节，不含 CR/LF）。</summary>
    public IReadOnlyList<byte[]> Push(ReadOnlySpan<byte> chunk)
    {
        var lines = new List<byte[]>();
        while (true)
        {
            var newline = chunk.IndexOf((byte)'\n');
            if (newline < 0)
            {
                if (_pending.Length + chunk.Length > ProtocolConstants.MaxLineBytes) throw new FramingException("line exceeds limit");
                _pending.Write(chunk);
                return lines;
            }
            if (_pending.Length + newline > ProtocolConstants.MaxLineBytes) throw new FramingException("line exceeds limit");
            _pending.Write(chunk[..newline]);
            lines.Add(Finish());
            chunk = chunk[(newline + 1)..];
        }
    }

    private byte[] Finish()
    {
        var bytes = _pending.ToArray();
        _pending.SetLength(0);
        var length = bytes.Length > 0 && bytes[^1] == (byte)'\r' ? bytes.Length - 1 : bytes.Length;
        var body = bytes.AsSpan(0, length);
        if (body.StartsWith(new byte[] { 0xEF, 0xBB, 0xBF })) throw new FramingException("BOM is not allowed");
        try
        {
            StrictUtf8.GetCharCount(body);
        }
        catch (DecoderFallbackException)
        {
            throw new FramingException("invalid UTF-8");
        }
        return body.ToArray();
    }
}
