// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.Text.Json.Nodes;
using FigWin.OverlayHost.Hosting;
using FigWin.OverlayHost.Protocol;

namespace FigWin.OverlayHost.Core.Tests;

/// <summary>握手、身份与顺序、角色（P-11）、租期（P-08）、发送队列（P-12）。</summary>
public class ConnectionTests
{
    [Fact]
    public void hello之后回复welcome_回显身份_序号从1开始()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var welcome = Assert.Single(client.Outbound.Sent);
        Assert.Equal("welcome", welcome.Str("t"));
        Assert.Equal(client.Session, welcome.Str("session"));
        Assert.Equal(client.ConnectionId, welcome.Str("connection"));
        Assert.Equal(1, welcome.Num("seq"));
        Assert.Equal(host.HostInstance, welcome.Str("hostInstance"));
        Assert.Equal(200, welcome.Num("heartbeatMs"));
        Assert.Equal(600, welcome.Num("leaseMs"));
    }

    [Fact]
    public void 连接后250毫秒内没有hello_关闭连接()
    {
        var (host, _, time) = TestHost.Create();
        var client = new FakeClient(host);
        time.Advance(TimeSpan.FromMilliseconds(249));
        Assert.False(client.Outbound.Closed);
        time.Advance(TimeSpan.FromMilliseconds(1));
        Assert.True(client.Outbound.Closed);
        Assert.Equal("hello-timeout", client.Connection.CloseReason);
    }

    [Fact]
    public void 第一条消息不是hello_回复error并关闭()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host);
        client.Ping();
        Assert.Equal(ErrorCodes.InvalidMessage, client.Outbound.Last("error").Str("code"));
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void P02_版本不符_回复unsupported_version并关闭()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host);
        var hello = client.Envelope("hello");
        hello["v"] = 0;
        client.Send(hello);
        Assert.Equal(ErrorCodes.UnsupportedVersion, client.Outbound.Last("error").Str("code"));
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void P02_不能识别信封时直接关闭_不回复()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        client.SendRaw("not json\n");
        Assert.Empty(client.Outbound.OfType("error"));
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void 序号没有递增_关闭()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        client.Send(client.Envelope("ping", seq: 1));
        Assert.Equal(ErrorCodes.InvalidMessage, client.Outbound.Last("error").Str("code"));
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void 序号允许跳号()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        client.Send(client.Envelope("ping", seq: 10));
        Assert.Equal(10, client.Outbound.Last("pong").Num("forSeq"));
        Assert.False(client.Outbound.Closed);
    }

    [Fact]
    public void 握手后更换身份_关闭()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var ping = client.Envelope("ping");
        ping["connection"] = Guid.NewGuid().ToString("D");
        client.Send(ping);
        Assert.True(client.Outbound.Closed);
        Assert.StartsWith(ErrorCodes.InvalidMessage, client.Connection.CloseReason);
    }

    [Fact]
    public void 重复hello_关闭()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello().Hello();
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void P11_debug连接不能发送show()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello("debug");
        client.Show();
        Assert.Equal(ErrorCodes.WrongRole, client.Outbound.Last("error").Str("code"));
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void P11_renderer不能请求debugState()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var request = client.Envelope("debugState");
        request["requestId"] = "r1";
        request["targetSession"] = client.Session;
        client.Send(request);
        Assert.Equal(ErrorCodes.WrongRole, client.Outbound.Last("error").Str("code"));
    }

    [Fact]
    public void P08_每条合法消息续租_600毫秒没有消息就隐藏_报告lease_expired并关闭()
    {
        var (host, presenter, time) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var show = client.Show();
        Assert.Single(presenter.Applied);
        for (var i = 0; i < 5; i++)
        {
            time.Advance(TimeSpan.FromMilliseconds(200));
            client.Ping();
        }
        Assert.False(client.Outbound.Closed);
        time.Advance(TimeSpan.FromMilliseconds(600));
        var status = client.Outbound.Last("status");
        Assert.Equal(("hidden", "lease-expired", show), (status.Str("state"), status.Str("reason"), status.Num("forSeq")));
        Assert.Equal([client.Session], presenter.Hidden);
        Assert.True(client.Outbound.Closed);
    }

    [Fact]
    public void P08_EOF与bye都撤销显示()
    {
        var (host, presenter, _) = TestHost.Create();
        var a = new FakeClient(host).Hello();
        a.Show();
        a.Connection.ReceiveEof();
        var b = new FakeClient(host).Hello();
        b.Show();
        b.Send(b.Envelope("bye"));
        Assert.Equal([a.Session, b.Session], presenter.Hidden);
        Assert.True(a.Outbound.Closed && b.Outbound.Closed);
        Assert.Equal(0, host.ConnectionCount);
    }

    [Fact]
    public void P08_debug连接的活动不为renderer续租()
    {
        var (host, _, time) = TestHost.Create();
        var renderer = new FakeClient(host).Hello();
        var debug = new FakeClient(host).Hello("debug");
        for (var i = 0; i < 4; i++)
        {
            time.Advance(TimeSpan.FromMilliseconds(200));
            debug.Ping();
        }
        Assert.True(renderer.Outbound.Closed);
        Assert.False(debug.Outbound.Closed);
    }

    [Fact]
    public void P12_发送队列超过上限_关闭连接()
    {
        var (host, _, _) = TestHost.Create(new HostOptions { MaxQueuedBytes = 1000 });
        var client = new FakeClient(host).Hello();
        client.Outbound.Blocked = true;
        for (var i = 0; i < 20 && !client.Outbound.Closed; i++) client.Ping();
        Assert.True(client.Outbound.Closed);
        Assert.Equal("resource-limit", client.Connection.CloseReason);
    }

    [Fact]
    public void P12_重连需要重新握手()
    {
        var (host, _, _) = TestHost.Create();
        var first = new FakeClient(host).Hello();
        first.Connection.ReceiveEof();
        var second = new FakeClient(host, first.Session);
        second.Show();
        Assert.True(second.Outbound.Closed);
        Assert.Equal(ErrorCodes.InvalidMessage, second.Outbound.Last("error").Str("code"));
    }

    [Fact]
    public void P11_debugState返回目标会话的完整状态_找不到时found为false()
    {
        var (host, _, _) = TestHost.Create();
        var renderer = new FakeClient(host).Hello();
        renderer.Show(selectedIndex: 1);
        var debug = new FakeClient(host).Hello("debug");

        var request = debug.Envelope("debugState");
        request["requestId"] = "req-1";
        request["targetSession"] = renderer.Session;
        debug.Send(request);
        var result = debug.Outbound.Last("debugStateResult");
        Assert.Equal(("req-1", true), (result.Str("requestId"), (bool)result["found"]!));
        var state = result["state"]!.AsObject();
        Assert.Equal(renderer.ConnectionId, state.Str("connection"));
        Assert.True((bool)state["visible"]!);
        Assert.Equal(2, state.Num("candidateCount"));
        Assert.Equal(1, state.Num("selectedIndex"));
        Assert.Equal("cells", state.Str("caretSource"));
        Assert.Equal(2, state["cursor"]!["row"]!.GetValue<int>());

        request = debug.Envelope("debugState");
        request["requestId"] = "req-2";
        request["targetSession"] = Guid.NewGuid().ToString("D");
        debug.Send(request);
        result = debug.Outbound.Last("debugStateResult");
        Assert.False((bool)result["found"]!);
        Assert.Null(result["state"]);
    }
}
