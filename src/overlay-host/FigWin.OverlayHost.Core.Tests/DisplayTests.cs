// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using FigWin.OverlayHost.Hosting;

namespace FigWin.OverlayHost.Core.Tests;

/// <summary>show/hide 的顺序与竞态（P-03、P-04）、状态回复、失焦和失败、测量值。</summary>
public class DisplayTests
{
    [Fact]
    public void show定位并显示后回复shown_caretSource来自定位结果()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = _ => FakePresenter.Located(CaretSource.Uia);
        var client = new FakeClient(host).Hello();
        var seq = client.Show();
        var status = client.Outbound.Last("status");
        Assert.Equal((seq, "shown", "ok", "uia"), (status.Num("forSeq"), status.Str("state"), status.Str("reason"), status.Str("caretSource")));
        Assert.Single(presenter.Applied);
    }

    [Fact]
    public void P03_较慢的定位完成前收到hide_不得再显示旧的show()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = null;
        var client = new FakeClient(host).Hello();
        client.Show();
        var hide = client.Hide();
        Assert.True(presenter.Locates[0].Token.IsCancellationRequested);
        presenter.Locates[0].Result.SetResult(FakePresenter.Located());
        Assert.Empty(presenter.Applied);
        var status = Assert.Single(client.Outbound.OfType("status"));
        Assert.Equal((hide, "hidden", "dismiss"), (status.Num("forSeq"), status.Str("state"), status.Str("reason")));
        Assert.Equal(hide, host.GetDebugState(client.Session)!.LastAppliedSeq);
    }

    [Fact]
    public void P03_显示已投递但未完成时收到hide_通知平台隐藏_旧的显示不确认()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.PendingApply = new TaskCompletionSource();
        var client = new FakeClient(host).Hello();
        client.Show();
        client.Hide();
        Assert.Equal(new[] { client.Session }, presenter.Hidden);
        presenter.PendingApply.SetResult();
        Assert.DoesNotContain(client.Outbound.OfType("status"), s => s.Str("state") == "shown");
        Assert.False(host.GetDebugState(client.Session)!.Visible);
    }

    [Fact]
    public void 新的show取代较早的show_只确认最新的一条()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = null;
        var client = new FakeClient(host).Hello();
        client.Show(selectedIndex: 0);
        var latest = client.Show(selectedIndex: 1);
        Assert.True(presenter.Locates[0].Token.IsCancellationRequested);
        presenter.Locates[0].Result.SetResult(FakePresenter.Located());
        presenter.Locates[1].Result.SetResult(FakePresenter.Located());
        Assert.Equal(1, Assert.Single(presenter.Applied).SelectedIndex);
        Assert.Equal(latest, Assert.Single(client.Outbound.OfType("status")).Num("forSeq"));
    }

    [Theory]
    [InlineData(FailReason.PositionUnavailable, "position-unavailable")]
    [InlineData(FailReason.BindingUnavailable, "binding-unavailable")]
    public void 定位失败_隐藏并报告failed(FailReason reason, string expected)
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = _ => new LocateResult.Failed(reason);
        var client = new FakeClient(host).Hello();
        var seq = client.Show();
        var status = client.Outbound.Last("status");
        Assert.Equal((seq, "failed", expected, "none"), (status.Num("forSeq"), status.Str("state"), status.Str("reason"), status.Str("caretSource")));
        Assert.Empty(presenter.Applied);
    }

    [Fact]
    public void 定位时发现失焦_报告suppressed()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = _ => new LocateResult.Suppressed(SuppressReason.Minimized);
        var client = new FakeClient(host).Hello();
        client.Show();
        Assert.Equal(("suppressed", "minimized"), (client.Outbound.Last("status").Str("state"), client.Outbound.Last("status").Str("reason")));
    }

    [Fact]
    public void 显示失败_报告render_failed()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.FailApply = true;
        var client = new FakeClient(host).Hello();
        client.Show();
        Assert.Equal(("failed", "render-failed"), (client.Outbound.Last("status").Str("state"), client.Outbound.Last("status").Str("reason")));
        Assert.Equal(new[] { client.Session }, presenter.Hidden);
    }

    [Fact]
    public void 平台报告失焦_隐藏并以最近接受的序号报告suppressed_不自行重放()
    {
        var (host, presenter, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var seq = client.Show();
        host.Suppress(client.Session, SuppressReason.Inactive);
        var status = client.Outbound.Last("status");
        Assert.Equal((seq, "suppressed", "inactive"), (status.Num("forSeq"), status.Str("state"), status.Str("reason")));
        Assert.Equal(new[] { client.Session }, presenter.Hidden);
        Assert.Single(presenter.Applied);
        Assert.False(host.GetDebugState(client.Session)!.Foreground);
    }

    [Fact]
    public void 没有显示时失焦_不发送状态()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        host.Suppress(client.Session, SuppressReason.Inactive);
        Assert.Empty(client.Outbound.OfType("status"));
    }

    [Fact]
    public void 平台在显示后报告失败()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        client.Show();
        host.ReportFailure(client.Session, FailReason.BindingUnavailable);
        Assert.Equal(("failed", "binding-unavailable"), (client.Outbound.Last("status").Str("state"), client.Outbound.Last("status").Str("reason")));
        Assert.Equal("unavailable", host.GetDebugState(client.Session)!.Binding);
    }

    [Fact]
    public void P04_同一渲染会话的新连接_先隐藏并关闭旧连接_旧连接迟到的定位结果被忽略()
    {
        var (host, presenter, _) = TestHost.Create();
        presenter.Immediate = null;
        var old = new FakeClient(host).Hello();
        old.Show();
        var fresh = new FakeClient(host, old.Session).Hello();
        Assert.True(old.Outbound.Closed);
        Assert.Equal("superseded", old.Connection.CloseReason);
        presenter.Locates[0].Result.SetResult(FakePresenter.Located());
        Assert.Empty(presenter.Applied);
        Assert.Empty(old.Outbound.OfType("status"));
        presenter.Immediate = _ => FakePresenter.Located();
        fresh.Show();
        Assert.Single(presenter.Applied);
        Assert.Equal(fresh.ConnectionId, host.GetDebugState(fresh.Session)!.Connection);
    }

    [Fact]
    public void debugState记录定位耗时和从收到到显示的耗时_隐藏后清空页信息()
    {
        var (host, presenter, time) = TestHost.Create();
        presenter.Immediate = null;
        var client = new FakeClient(host).Hello();
        client.Show(selectedIndex: 1);
        time.Advance(TimeSpan.FromMilliseconds(7));
        presenter.Locates[0].Result.SetResult(FakePresenter.Located());
        var state = host.GetDebugState(client.Session)!;
        Assert.Equal(7, state.LocateMs);
        Assert.Equal(7, state.ReceiveToDisplayMs);
        Assert.Equal(("shown", "ok", true, "verified"), (state.State, state.Reason, state.Visible, state.Binding));
        Assert.Equal(new Protocol.PixelRect(48, 48, 320, 32), state.OverlayRect);

        client.Hide("accept");
        state = host.GetDebugState(client.Session)!;
        Assert.Equal((false, 0, 0L, (int?)null), (state.Visible, state.CandidateCount, state.TotalCount, state.SelectedIndex));
        Assert.Null(state.Cursor);
        Assert.Null(state.CaretRect);
        Assert.Equal("none", state.CaretSource);
        Assert.Equal(("hidden", "accept"), (state.State, state.Reason));
    }

    [Fact]
    public void 尚无状态时debugState为hidden_shutdown()
    {
        var (host, _, _) = TestHost.Create();
        var client = new FakeClient(host).Hello();
        var state = host.GetDebugState(client.Session)!;
        Assert.Equal(("hidden", "shutdown", 0L, 0L), (state.State, state.Reason, state.LastAppliedSeq, state.LastReceivedSeq - 1));
        Assert.Null(state.LocateMs);
    }
}
