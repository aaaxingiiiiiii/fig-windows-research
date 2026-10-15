// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Buffers;
using System.Text.Json;

namespace FigWin.OverlayHost.Protocol;

/// <summary>宿主发给客户端的消息（第 4、6、8 节），编码为一行 UTF-8 JSON 加 LF。</summary>
public static class HostMessageWriter
{
    public readonly record struct Envelope(string Session, string Connection, long Seq);

    public static byte[] Welcome(Envelope envelope, string hostInstance) =>
        Write(envelope, "welcome", w =>
        {
            w.WriteString("hostInstance", hostInstance);
            w.WriteNumber("heartbeatMs", ProtocolConstants.HeartbeatMs);
            w.WriteNumber("leaseMs", ProtocolConstants.LeaseMs);
        });

    public static byte[] Status(Envelope envelope, long forSeq, string state, string reason, string caretSource) =>
        Write(envelope, "status", w =>
        {
            w.WriteNumber("forSeq", forSeq);
            w.WriteString("state", state);
            w.WriteString("reason", reason);
            w.WriteString("caretSource", caretSource);
        });

    public static byte[] Pong(Envelope envelope, long forSeq) => Write(envelope, "pong", w => w.WriteNumber("forSeq", forSeq));

    public static byte[] Error(Envelope envelope, string code) => Write(envelope, "error", w => w.WriteString("code", code));

    public static byte[] DebugStateResult(Envelope envelope, string requestId, string targetSession, DebugStateSnapshot? state) =>
        Write(envelope, "debugStateResult", w =>
        {
            w.WriteString("requestId", requestId);
            w.WriteString("targetSession", targetSession);
            w.WriteBoolean("found", state is not null);
            w.WritePropertyName("state");
            if (state is null) w.WriteNullValue();
            else state.WriteTo(w);
        });

    private static byte[] Write(Envelope envelope, string type, Action<Utf8JsonWriter> body)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("protocol", ProtocolConstants.Protocol);
            writer.WriteNumber("v", ProtocolConstants.Version);
            writer.WriteString("t", type);
            writer.WriteString("session", envelope.Session);
            writer.WriteString("connection", envelope.Connection);
            writer.WriteNumber("seq", envelope.Seq);
            body(writer);
            writer.WriteEndObject();
        }
        if (buffer.WrittenCount > ProtocolConstants.MaxLineBytes) throw new InvalidOperationException($"{type} exceeds the line limit");
        var line = new byte[buffer.WrittenCount + 1];
        buffer.WrittenSpan.CopyTo(line);
        line[^1] = (byte)'\n';
        return line;
    }
}

public readonly record struct PixelRect(double X, double Y, double Width, double Height);

/// <summary>debugState 的完整状态（第 8 节）。一次性复制，不拼接不同时刻的字段。</summary>
public sealed record DebugStateSnapshot(
    string HostInstance,
    string Connection,
    long LastReceivedSeq,
    long LastAppliedSeq,
    bool Visible,
    bool Foreground,
    string Binding,
    string State,
    string Reason,
    int CandidateCount,
    long TotalCount,
    long PageStart,
    int? SelectedIndex,
    CellPosition? Cursor,
    TerminalGrid? Terminal,
    string CaretSource,
    PixelRect? CaretRect,
    PixelRect? OverlayRect,
    double? LocateMs,
    double? ReceiveToDisplayMs)
{
    internal void WriteTo(Utf8JsonWriter w)
    {
        w.WriteStartObject();
        w.WriteString("hostInstance", HostInstance);
        w.WriteString("connection", Connection);
        w.WriteNumber("lastReceivedSeq", LastReceivedSeq);
        w.WriteNumber("lastAppliedSeq", LastAppliedSeq);
        w.WriteBoolean("visible", Visible);
        w.WriteBoolean("foreground", Foreground);
        w.WriteString("binding", Binding);
        w.WriteString("state", State);
        w.WriteString("reason", Reason);
        w.WriteNumber("candidateCount", CandidateCount);
        w.WriteNumber("totalCount", TotalCount);
        w.WriteNumber("pageStart", PageStart);
        WriteNullableNumber(w, "selectedIndex", SelectedIndex);
        w.WritePropertyName("cursor");
        if (Cursor is { } cursor)
        {
            w.WriteStartObject();
            w.WriteNumber("row", cursor.Row);
            w.WriteNumber("col", cursor.Col);
            w.WriteEndObject();
        }
        else w.WriteNullValue();
        w.WritePropertyName("terminal");
        if (Terminal is { } terminal)
        {
            w.WriteStartObject();
            w.WriteNumber("rows", terminal.Rows);
            w.WriteNumber("cols", terminal.Cols);
            w.WriteString("buffer", "normal");
            w.WriteBoolean("cursorVisible", true);
            w.WriteEndObject();
        }
        else w.WriteNullValue();
        w.WriteString("caretSource", CaretSource);
        WriteRect(w, "caretRect", CaretRect);
        WriteRect(w, "overlayRect", OverlayRect);
        WriteNullableNumber(w, "locateMs", LocateMs);
        WriteNullableNumber(w, "receiveToDisplayMs", ReceiveToDisplayMs);
        w.WriteEndObject();
    }

    private static void WriteNullableNumber(Utf8JsonWriter w, string name, double? value)
    {
        if (value is { } number) w.WriteNumber(name, number);
        else w.WriteNull(name);
    }

    private static void WriteRect(Utf8JsonWriter w, string name, PixelRect? rect)
    {
        w.WritePropertyName(name);
        if (rect is not { } r)
        {
            w.WriteNullValue();
            return;
        }
        w.WriteStartObject();
        w.WriteNumber("x", r.X);
        w.WriteNumber("y", r.Y);
        w.WriteNumber("width", r.Width);
        w.WriteNumber("height", r.Height);
        w.WriteEndObject();
    }
}
