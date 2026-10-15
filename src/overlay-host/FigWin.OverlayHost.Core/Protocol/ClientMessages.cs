// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text.Json;
using System.Text.RegularExpressions;

namespace FigWin.OverlayHost.Protocol;

public enum ClientRole
{
    Renderer,
    Debug,
}

/// <summary>show 中的一个候选（第 5 节）。</summary>
public sealed record Candidate(string Name, string? Description, string Type);

public readonly record struct CellPosition(int Row, int Col);

public readonly record struct TerminalGrid(int Rows, int Cols);

/// <summary>show 的完整显示快照（第 5 节）。</summary>
public sealed record ShowSnapshot(
    IReadOnlyList<Candidate> Candidates,
    int? SelectedIndex,
    long PageStart,
    long TotalCount,
    string? ArgumentDescription,
    CellPosition Cursor,
    TerminalGrid Terminal);

/// <summary>客户端发给宿主的消息（第 3、4 节）。</summary>
public abstract record ClientMessage(string Session, string Connection, long Seq);

public sealed record HelloMessage(string Session, string Connection, long Seq, ClientRole Role, long Pid, string? WtSession)
    : ClientMessage(Session, Connection, Seq);

public sealed record ShowMessage(string Session, string Connection, long Seq, ShowSnapshot Snapshot) : ClientMessage(Session, Connection, Seq);

public sealed record HideMessage(string Session, string Connection, long Seq, string Reason) : ClientMessage(Session, Connection, Seq);

public sealed record PingMessage(string Session, string Connection, long Seq) : ClientMessage(Session, Connection, Seq);

public sealed record ByeMessage(string Session, string Connection, long Seq) : ClientMessage(Session, Connection, Seq);

public sealed record DebugStateRequest(string Session, string Connection, long Seq, string RequestId, string TargetSession)
    : ClientMessage(Session, Connection, Seq);

/// <summary>解析失败：错误码，以及能否安全识别信封（能识别时可以先回复 error，第 2 节）。</summary>
public sealed record ParseFailure(string Code, string Detail, string? Session, string? Connection);

public sealed class ParseResult
{
    private ParseResult(ClientMessage? message, ParseFailure? failure)
    {
        Message = message;
        Failure = failure;
    }

    public ClientMessage? Message { get; }
    public ParseFailure? Failure { get; }

    public static ParseResult Ok(ClientMessage message) => new(message, null);

    public static ParseResult Fail(string code, string detail, string? session = null, string? connection = null) =>
        new(null, new ParseFailure(code, detail, session, connection));
}

/// <summary>解析并校验一行客户端消息。只做与连接状态无关的检查；顺序、身份和角色由 HostConnection 检查。</summary>
public static partial class ClientMessageParser
{
    private static readonly HashSet<string> HideReasons =
        ["empty", "dismiss", "accept", "command", "alternate-buffer", "resize", "fallback", "shutdown"];

    private static readonly HashSet<string> CandidateTypes = ["file", "folder", "option", "argument", "subcommand", "shortcut", "other"];

    private static readonly HashSet<string> HostOnlyTypes = ["welcome", "status", "pong", "error", "debugStateResult"];

    [GeneratedRegex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
    private static partial Regex UuidPattern();

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex RequestIdPattern();

    public static bool IsUuid(string? value) => value is not null && UuidPattern().IsMatch(value);

    public static ParseResult Parse(byte[] line)
    {
        JsonDocument document;
        try
        {
            document = StrictJson.Parse(line);
        }
        catch (StrictJsonException e)
        {
            return ParseResult.Fail(ErrorCodes.InvalidMessage, e.Message);
        }

        using (document)
        {
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return ParseResult.Fail(ErrorCodes.InvalidMessage, "message is not an object");

            var session = GetString(root, "session");
            var connection = GetString(root, "connection");
            string? replySession = IsUuid(session) ? session : null;
            string? replyConnection = IsUuid(connection) ? connection : null;
            ParseResult Fail(string detail, string code = ErrorCodes.InvalidMessage) => ParseResult.Fail(code, detail, replySession, replyConnection);

            if (GetString(root, "protocol") != ProtocolConstants.Protocol) return Fail("unknown protocol");
            if (!root.TryGetProperty("v", out var v) || v.ValueKind != JsonValueKind.Number) return Fail("missing version");
            if (!v.TryGetInt64(out var version) || version != ProtocolConstants.Version) return Fail("unsupported version", ErrorCodes.UnsupportedVersion);
            if (replySession is null || replyConnection is null) return Fail("invalid session or connection");
            if (!TryGetPositive(root, "seq", out var seq)) return Fail("invalid seq");
            var type = GetString(root, "t");
            if (type is null) return Fail("missing type");
            if (HostOnlyTypes.Contains(type)) return Fail($"{type} is not sent by clients");

            try
            {
                ClientMessage message = type switch
                {
                    "hello" => ParseHello(root, replySession, replyConnection, seq),
                    "show" => new ShowMessage(replySession, replyConnection, seq, ParseSnapshot(root)),
                    "hide" => new HideMessage(replySession, replyConnection, seq, ParseHideReason(root)),
                    "ping" => new PingMessage(replySession, replyConnection, seq),
                    "bye" => new ByeMessage(replySession, replyConnection, seq),
                    "debugState" => ParseDebugState(root, replySession, replyConnection, seq),
                    _ => throw new InvalidMessageException($"unknown message type {type}"),
                };
                return ParseResult.Ok(message);
            }
            catch (InvalidMessageException e)
            {
                return Fail(e.Message);
            }
        }
    }

    private sealed class InvalidMessageException(string message) : Exception(message);

    private static HelloMessage ParseHello(JsonElement root, string session, string connection, long seq)
    {
        var role = GetString(root, "role") switch
        {
            "renderer" => ClientRole.Renderer,
            "debug" => ClientRole.Debug,
            _ => throw new InvalidMessageException("invalid role"),
        };
        if (!TryGetPositive(root, "pid", out var pid)) throw new InvalidMessageException("invalid pid");
        string? wtSession = null;
        if (role == ClientRole.Renderer)
        {
            if (!root.TryGetProperty("terminal", out var terminal) || terminal.ValueKind != JsonValueKind.Object)
                throw new InvalidMessageException("missing terminal");
            if (GetString(terminal, "kind") != "windows-terminal") throw new InvalidMessageException("invalid terminal kind");
            if (!terminal.TryGetProperty("wtSession", out var wt)) throw new InvalidMessageException("missing wtSession");
            if (wt.ValueKind == JsonValueKind.String)
            {
                wtSession = wt.GetString()!;
                if (wtSession.Length > ProtocolConstants.MaxWtSessionLength) throw new InvalidMessageException("wtSession too long");
            }
            else if (wt.ValueKind != JsonValueKind.Null)
            {
                throw new InvalidMessageException("invalid wtSession");
            }
        }
        return new HelloMessage(session, connection, seq, role, pid, wtSession);
    }

    private static string ParseHideReason(JsonElement root)
    {
        var reason = GetString(root, "reason");
        return reason is not null && HideReasons.Contains(reason) ? reason : throw new InvalidMessageException("invalid hide reason");
    }

    private static DebugStateRequest ParseDebugState(JsonElement root, string session, string connection, long seq)
    {
        var requestId = GetString(root, "requestId");
        if (requestId is null || !RequestIdPattern().IsMatch(requestId)) throw new InvalidMessageException("invalid requestId");
        var target = GetString(root, "targetSession");
        if (!IsUuid(target)) throw new InvalidMessageException("invalid targetSession");
        return new DebugStateRequest(session, connection, seq, requestId, target!);
    }

    private static ShowSnapshot ParseSnapshot(JsonElement root)
    {
        if (!root.TryGetProperty("candidates", out var candidatesElement) || candidatesElement.ValueKind != JsonValueKind.Array)
            throw new InvalidMessageException("missing candidates");
        if (candidatesElement.GetArrayLength() > ProtocolConstants.MaxCandidates) throw new InvalidMessageException("too many candidates");
        var candidates = new List<Candidate>();
        foreach (var item in candidatesElement.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object) throw new InvalidMessageException("invalid candidate");
            var name = GetString(item, "name");
            var nameScalars = name is null ? 0 : ScalarCount(name);
            if (nameScalars is < 1 or > ProtocolConstants.MaxNameScalars) throw new InvalidMessageException("invalid candidate name");
            var description = GetNullableString(item, "description", ProtocolConstants.MaxDescriptionScalars);
            var type = GetString(item, "type");
            if (type is null || !CandidateTypes.Contains(type)) throw new InvalidMessageException("invalid candidate type");
            candidates.Add(new Candidate(name!, description, type));
        }

        if (!root.TryGetProperty("selectedIndex", out var selectedElement)) throw new InvalidMessageException("missing selectedIndex");
        int? selectedIndex;
        if (candidates.Count == 0)
        {
            if (selectedElement.ValueKind != JsonValueKind.Null) throw new InvalidMessageException("selectedIndex must be null without candidates");
            selectedIndex = null;
        }
        else
        {
            if (!TryGetNonNegative(selectedElement, out var index) || index >= candidates.Count) throw new InvalidMessageException("invalid selectedIndex");
            selectedIndex = (int)index;
        }

        if (!TryGetNonNegative(root, "pageStart", out var pageStart) || !TryGetNonNegative(root, "totalCount", out var totalCount))
            throw new InvalidMessageException("invalid paging");
        if (pageStart + candidates.Count > totalCount) throw new InvalidMessageException("pageStart + candidates exceeds totalCount");
        var argumentDescription = GetNullableString(root, "argumentDescription", ProtocolConstants.MaxDescriptionScalars, required: true);
        if (candidates.Count == 0)
        {
            if (argumentDescription is null) throw new InvalidMessageException("empty show must be a hide");
            if (pageStart != 0 || totalCount != 0) throw new InvalidMessageException("pageStart and totalCount must be 0 without candidates");
        }

        if (!root.TryGetProperty("terminal", out var terminal) || terminal.ValueKind != JsonValueKind.Object) throw new InvalidMessageException("missing terminal");
        if (!TryGetGrid(terminal, "rows", out var rows) || !TryGetGrid(terminal, "cols", out var cols)) throw new InvalidMessageException("invalid grid");
        if (GetString(terminal, "buffer") != "normal") throw new InvalidMessageException("buffer must be normal");
        if (!terminal.TryGetProperty("cursorVisible", out var visible) || visible.ValueKind != JsonValueKind.True)
            throw new InvalidMessageException("cursorVisible must be true");

        if (!root.TryGetProperty("cursor", out var cursor) || cursor.ValueKind != JsonValueKind.Object) throw new InvalidMessageException("missing cursor");
        if (!TryGetNonNegative(cursor, "row", out var row) || !TryGetNonNegative(cursor, "col", out var col)) throw new InvalidMessageException("invalid cursor");
        if (row >= rows || col >= cols) throw new InvalidMessageException("cursor outside the grid");

        return new ShowSnapshot(candidates, selectedIndex, pageStart, totalCount, argumentDescription, new CellPosition((int)row, (int)col), new TerminalGrid(rows, cols));
    }

    // ---- 字段读取 ----

    private static string? GetString(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    private static string? GetNullableString(JsonElement element, string name, int maxScalars, bool required = true)
    {
        if (!element.TryGetProperty(name, out var value))
        {
            if (required) throw new InvalidMessageException($"missing {name}");
            return null;
        }
        if (value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind != JsonValueKind.String) throw new InvalidMessageException($"invalid {name}");
        var text = value.GetString()!;
        if (ScalarCount(text) > maxScalars) throw new InvalidMessageException($"{name} too long");
        return text;
    }

    private static bool TryGetNonNegative(JsonElement element, string name, out long value)
    {
        value = 0;
        return element.TryGetProperty(name, out var property) && TryGetNonNegative(property, out value);
    }

    private static bool TryGetNonNegative(JsonElement element, out long value)
    {
        value = 0;
        return element.ValueKind == JsonValueKind.Number && element.TryGetInt64(out value) && value is >= 0 and <= ProtocolConstants.MaxSafeInteger;
    }

    private static bool TryGetPositive(JsonElement element, string name, out long value) => TryGetNonNegative(element, name, out value) && value > 0;

    private static bool TryGetGrid(JsonElement element, string name, out int value)
    {
        value = 0;
        if (!TryGetNonNegative(element, name, out var number) || number is < 1 or > ProtocolConstants.MaxGrid) return false;
        value = (int)number;
        return true;
    }

    private static int ScalarCount(string value) => value.EnumerateRunes().Count();
}
