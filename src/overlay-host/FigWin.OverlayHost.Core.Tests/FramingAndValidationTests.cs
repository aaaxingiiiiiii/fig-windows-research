// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text;
using System.Text.Json.Nodes;
using FigWin.OverlayHost.Protocol;

namespace FigWin.OverlayHost.Core.Tests;

/// <summary>P-01 分帧，P-02 非法输入（docs/protocol.md 第 10 节，宿主一侧）。</summary>
public class FramingAndValidationTests
{
    [Fact]
    public void P01_中文字节被拆到两次读取中仍然恰好得到一行()
    {
        var line = Encoding.UTF8.GetBytes("{\"text\":\"切换分支\"}\n");
        var split = Encoding.UTF8.GetByteCount("{\"text\":\"切") + 1; // 拆在“换”的三个字节中间
        var framer = new LineFramer();
        Assert.Empty(framer.Push(line.AsSpan(0, split)));
        var lines = framer.Push(line.AsSpan(split));
        Assert.Equal("{\"text\":\"切换分支\"}", Encoding.UTF8.GetString(Assert.Single(lines)));
    }

    [Fact]
    public void P01_合包_转义换行_CRLF()
    {
        var framer = new LineFramer();
        var lines = framer.Push(Encoding.UTF8.GetBytes("{\"a\":\"x\\ny\"}\r\n{\"b\":2}\n"));
        Assert.Equal(["{\"a\":\"x\\ny\"}", "{\"b\":2}"], lines.Select(l => Encoding.UTF8.GetString(l)));
    }

    [Fact]
    public void P01_逐字节到达()
    {
        var framer = new LineFramer();
        var output = Encoding.UTF8.GetBytes("{\"text\":\"中文 ok\"}\n").SelectMany(b => framer.Push([b])).ToList();
        Assert.Equal("{\"text\":\"中文 ok\"}", Encoding.UTF8.GetString(Assert.Single(output)));
    }

    [Fact]
    public void P02_超过上限仍没有LF时立即报错()
    {
        var framer = new LineFramer();
        Assert.Throws<FramingException>(() => framer.Push(new byte[ProtocolConstants.MaxLineBytes + 1]));
    }

    [Fact]
    public void P02_恰好等于上限的一行可以接受()
    {
        var framer = new LineFramer();
        var bytes = Enumerable.Repeat((byte)'a', ProtocolConstants.MaxLineBytes).Append((byte)'\n').ToArray();
        Assert.Equal(ProtocolConstants.MaxLineBytes, Assert.Single(framer.Push(bytes)).Length);
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0x0A })]
    [InlineData(new byte[] { 0xEF, 0xBB, 0xBF, 0x7B, 0x7D, 0x0A })]
    public void P02_无效UTF8和BOM报错(byte[] bytes) => Assert.Throws<FramingException>(() => new LineFramer().Push(bytes));

    [Theory]
    [InlineData("{\"a\":1,\"a\":2}")]
    [InlineData("{\"a\":\"\\ud800\"}")]
    [InlineData("{\"a\":1} x")]
    [InlineData("{'a':1}")]
    public void P02_严格JSON拒绝(string text) => Assert.Throws<StrictJsonException>(() => StrictJson.Parse(Encoding.UTF8.GetBytes(text)).Dispose());

    [Fact]
    public void P02_严格JSON的嵌套上限是16层()
    {
        StrictJson.Parse(Encoding.UTF8.GetBytes(new string('[', 16) + new string(']', 16))).Dispose();
        Assert.Throws<StrictJsonException>(() => StrictJson.Parse(Encoding.UTF8.GetBytes(new string('[', 17) + new string(']', 17))).Dispose());
    }

    private static JsonObject ValidShow() =>
        new JsonObject
        {
            ["protocol"] = "figwin-overlay",
            ["v"] = 1,
            ["t"] = "show",
            ["session"] = "11111111-1111-4111-8111-111111111111",
            ["connection"] = "22222222-2222-4222-8222-222222222222",
            ["seq"] = 2,
        }.Merge(FakeClient.ShowBody());

    private static ParseResult Parse(JsonObject message) => ClientMessageParser.Parse(Encoding.UTF8.GetBytes(message.ToJsonString()));

    [Fact]
    public void 合法的show被解析为快照()
    {
        var show = Assert.IsType<ShowMessage>(Parse(ValidShow()).Message);
        Assert.Equal(["checkout", "cherry-pick"], show.Snapshot.Candidates.Select(c => c.Name));
        Assert.Equal(new CellPosition(2, 6), show.Snapshot.Cursor);
        Assert.Equal(new TerminalGrid(30, 120), show.Snapshot.Terminal);
    }

    public static TheoryData<string, Action<JsonObject>, string> InvalidMessages => new()
    {
        { "v=0", m => m["v"] = 0, ErrorCodes.UnsupportedVersion },
        { "未知协议", m => m["protocol"] = "other", ErrorCodes.InvalidMessage },
        { "session 不是小写 UUID", m => m["session"] = "11111111-1111-4111-8111-11111111111A", ErrorCodes.InvalidMessage },
        { "seq 为 0", m => m["seq"] = 0, ErrorCodes.InvalidMessage },
        { "seq 超过安全整数", m => m["seq"] = 9007199254740992, ErrorCodes.InvalidMessage },
        { "seq 不是整数", m => m["seq"] = 1.5, ErrorCodes.InvalidMessage },
        { "未知类型", m => m["t"] = "teleport", ErrorCodes.InvalidMessage },
        { "错误方向（status 只能由宿主发送）", m => m["t"] = "status", ErrorCodes.InvalidMessage },
        { "selectedIndex 越界", m => m["selectedIndex"] = 2, ErrorCodes.InvalidMessage },
        { "selectedIndex 为 null 但有候选", m => m["selectedIndex"] = null, ErrorCodes.InvalidMessage },
        { "col 等于 cols", m => m["cursor"]!["col"] = 120, ErrorCodes.InvalidMessage },
        { "row 等于 rows", m => m["cursor"]!["row"] = 30, ErrorCodes.InvalidMessage },
        { "rows 超过 4096", m => m["terminal"]!["rows"] = 4097, ErrorCodes.InvalidMessage },
        { "buffer 不是 normal", m => m["terminal"]!["buffer"] = "alternate", ErrorCodes.InvalidMessage },
        { "cursorVisible 为 false", m => m["terminal"]!["cursorVisible"] = false, ErrorCodes.InvalidMessage },
        { "pageStart + 候选数超过 totalCount", m => m["pageStart"] = 1, ErrorCodes.InvalidMessage },
        { "空名称", m => m["candidates"]![0]!["name"] = "", ErrorCodes.InvalidMessage },
        { "名称超过 512 个标量值", m => m["candidates"]![0]!["name"] = new string('名', 513), ErrorCodes.InvalidMessage },
        { "未知候选类型", m => m["candidates"]![0]!["type"] = "special", ErrorCodes.InvalidMessage },
        { "候选超过 20 项", m => m["candidates"] = new JsonArray(Enumerable.Range(0, 21).Select(i => (JsonNode)new JsonObject { ["name"] = $"c{i}", ["description"] = null, ["type"] = "other" }).ToArray()), ErrorCodes.InvalidMessage },
        { "没有候选也没有参数说明（应当发 hide）", m => { m["candidates"] = new JsonArray(); m["selectedIndex"] = null; m["totalCount"] = 0; }, ErrorCodes.InvalidMessage },
        { "缺少 argumentDescription 字段", m => m.Remove("argumentDescription"), ErrorCodes.InvalidMessage },
    };

    [Theory]
    [MemberData(nameof(InvalidMessages))]
    public void P02_拒绝不合法的show(string name, Action<JsonObject> mutate, string code)
    {
        var message = ValidShow();
        mutate(message);
        var result = Parse(message);
        Assert.True(result.Failure is not null, name);
        Assert.Equal(code, result.Failure!.Code);
    }

    [Fact]
    public void 只有参数说明时可以show()
    {
        var message = ValidShow();
        message["candidates"] = new JsonArray();
        message["selectedIndex"] = null;
        message["totalCount"] = 0;
        message["argumentDescription"] = "branch name";
        Assert.IsType<ShowMessage>(Parse(message).Message);
    }

    [Fact]
    public void 已知消息中的未知附加字段可以忽略()
    {
        var message = ValidShow();
        message["future"] = new JsonObject { ["x"] = 1 };
        Assert.IsType<ShowMessage>(Parse(message).Message);
    }
}

internal static class JsonObjectExtensions
{
    public static JsonObject Merge(this JsonObject target, JsonObject source)
    {
        foreach (var (key, value) in source) target[key] = value?.DeepClone();
        return target;
    }
}
