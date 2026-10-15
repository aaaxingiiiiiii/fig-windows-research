// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

namespace FigWin.OverlayHost.Protocol;

/// <summary>悬浮窗协议 v1 的常量（docs/protocol.md）。</summary>
public static class ProtocolConstants
{
    public const string Protocol = "figwin-overlay";
    public const int Version = 1;

    /// <summary>单行最大字节数，不含 LF（第 2 节）。</summary>
    public const int MaxLineBytes = 65536;

    /// <summary>发送队列的总字节上限（第 3 节）。</summary>
    public const int MaxQueuedBytes = 131072;

    public const int MaxDepth = 16;
    public const int MaxCandidates = 20;
    public const int MaxNameScalars = 512;
    public const int MaxDescriptionScalars = 2048;
    public const int MaxGrid = 4096;
    public const int MaxWtSessionLength = 128;
    public const long MaxSafeInteger = 9007199254740991;

    public const int HeartbeatMs = 200;
    public const int LeaseMs = 600;

    /// <summary>客户端连接后应在 250 ms 内发送 hello（第 4 节）。</summary>
    public const int HelloTimeoutMs = 250;
}

/// <summary>error 消息的错误码（第 4 节）。</summary>
public static class ErrorCodes
{
    public const string UnsupportedVersion = "unsupported-version";
    public const string InvalidMessage = "invalid-message";
    public const string WrongRole = "wrong-role";
    public const string ResourceLimit = "resource-limit";
    public const string InternalError = "internal-error";
}
