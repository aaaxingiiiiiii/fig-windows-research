// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using FigWin.OverlayHost.Hosting;
using FigWin.OverlayHost.Protocol;
using Microsoft.Extensions.Time.Testing;

namespace FigWin.OverlayHost.Core.Tests;

/// <summary>记录宿主写出的消息；可以模拟写出受阻（未写出的字节累积）。</summary>
internal sealed class FakeOutbound : IOutboundChannel
{
    public List<JsonObject> Sent { get; } = [];
    public bool Closed { get; private set; }
    public bool Blocked { get; set; }
    private long _pending;

    public long Enqueue(byte[] line)
    {
        Assert.Equal((byte)'\n', line[^1]);
        Sent.Add(JsonNode.Parse(line.AsSpan(0, line.Length - 1))!.AsObject());
        if (Blocked) _pending += line.Length;
        return _pending;
    }

    public void Close() => Closed = true;

    public IEnumerable<JsonObject> OfType(string t) => Sent.Where(m => (string?)m["t"] == t);

    public JsonObject Last(string t) => OfType(t).Last();
}

/// <summary>可控的平台实现：每次定位返回一个由测试决定何时完成的任务。</summary>
internal sealed class FakePresenter : IOverlayPresenter
{
    public List<(ShowSnapshot Snapshot, TaskCompletionSource<LocateResult> Result, CancellationToken Token)> Locates { get; } = [];
    public List<ShowSnapshot> Applied { get; } = [];
    public List<string> Hidden { get; } = [];
    public Func<ShowSnapshot, LocateResult>? Immediate { get; set; } = _ => Located();
    public TaskCompletionSource? PendingApply { get; set; }
    public bool FailApply { get; set; }

    public static LocateResult.Located Located(CaretSource source = CaretSource.Cells) =>
        new(source, new PixelRect(48, 32, 8, 16), new PixelRect(48, 48, 320, 32));

    public Task<LocateResult> LocateAsync(RendererInfo renderer, ShowSnapshot snapshot, CancellationToken cancellationToken)
    {
        if (Immediate is { } immediate) return Task.FromResult(immediate(snapshot));
        var completion = new TaskCompletionSource<LocateResult>();
        Locates.Add((snapshot, completion, cancellationToken));
        return completion.Task;
    }

    public Task ApplyAsync(RendererInfo renderer, ShowSnapshot snapshot, LocateResult.Located location)
    {
        Applied.Add(snapshot);
        if (FailApply) return Task.FromException(new InvalidOperationException("render failed"));
        return PendingApply?.Task ?? Task.CompletedTask;
    }

    public void Hide(RendererInfo renderer) => Hidden.Add(renderer.Session);
}

/// <summary>模拟一个客户端：按协议编写消息并逐行发给宿主。</summary>
internal sealed class FakeClient
{
    public FakeClient(OverlayHostCore host, string? session = null)
    {
        Host = host;
        Session = session ?? Guid.NewGuid().ToString("D");
        Outbound = new FakeOutbound();
        Connection = host.Accept(Outbound);
    }

    public OverlayHostCore Host { get; }
    public HostConnection Connection { get; }
    public FakeOutbound Outbound { get; }
    public string Session { get; }
    public string ConnectionId { get; } = Guid.NewGuid().ToString("D");
    public long Seq { get; private set; }

    public JsonObject Envelope(string t, long? seq = null)
    {
        Seq = seq ?? Seq + 1;
        return new JsonObject
        {
            ["protocol"] = "figwin-overlay",
            ["v"] = 1,
            ["t"] = t,
            ["session"] = Session,
            ["connection"] = ConnectionId,
            ["seq"] = Seq,
        };
    }

    public void Send(JsonObject message) => SendRaw(message.ToJsonString() + "\n");

    public void SendRaw(string text) => Connection.Receive(Encoding.UTF8.GetBytes(text));

    public void SendBytes(byte[] bytes) => Connection.Receive(bytes);

    public FakeClient Hello(string role = "renderer")
    {
        var hello = Envelope("hello");
        hello["role"] = role;
        hello["pid"] = 4321;
        if (role == "renderer") hello["terminal"] = new JsonObject { ["kind"] = "windows-terminal", ["wtSession"] = null };
        Send(hello);
        return this;
    }

    public long Show(int selectedIndex = 0, int row = 2, int col = 6, params string[] names)
    {
        var show = Envelope("show");
        foreach (var (key, value) in ShowBody(selectedIndex, row, col, names)) show[key] = value?.DeepClone();
        Send(show);
        return Seq;
    }

    public static JsonObject ShowBody(int selectedIndex = 0, int row = 2, int col = 6, params string[] names)
    {
        if (names.Length == 0) names = ["checkout", "cherry-pick"];
        var candidates = new JsonArray();
        foreach (var name in names) candidates.Add(new JsonObject { ["name"] = name, ["description"] = null, ["type"] = "subcommand" });
        return new JsonObject
        {
            ["candidates"] = candidates,
            ["selectedIndex"] = selectedIndex,
            ["pageStart"] = 0,
            ["totalCount"] = names.Length,
            ["argumentDescription"] = null,
            ["cursor"] = new JsonObject { ["row"] = row, ["col"] = col },
            ["terminal"] = new JsonObject { ["rows"] = 30, ["cols"] = 120, ["buffer"] = "normal", ["cursorVisible"] = true },
        };
    }

    public long Hide(string reason = "dismiss")
    {
        var hide = Envelope("hide");
        hide["reason"] = reason;
        Send(hide);
        return Seq;
    }

    public long Ping()
    {
        Send(Envelope("ping"));
        return Seq;
    }
}

internal static class TestHost
{
    public static (OverlayHostCore Host, FakePresenter Presenter, FakeTimeProvider Time) Create(HostOptions? options = null)
    {
        var presenter = new FakePresenter();
        var time = new FakeTimeProvider();
        return (new OverlayHostCore(presenter, time, options, "33333333-3333-4333-8333-333333333333"), presenter, time);
    }

    public static string? Str(this JsonObject message, string key) => (string?)message[key];

    public static long Num(this JsonObject message, string key) => (long)message[key]!;
}
