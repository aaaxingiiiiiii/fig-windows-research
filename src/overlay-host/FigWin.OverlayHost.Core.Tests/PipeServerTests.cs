// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.IO.Pipes;
using System.Text;
using System.Text.Json.Nodes;
using FigWin.OverlayHost.Hosting;
using FigWin.OverlayHost.Transport;

namespace FigWin.OverlayHost.Core.Tests;

/// <summary>真实的命名管道往返（Windows 上是命名管道，其他系统上 .NET 用 Unix 域套接字实现）。</summary>
public class PipeServerTests
{
    [Fact]
    public async Task 握手_show_status的完整往返()
    {
        var presenter = new FakePresenter();
        var host = new OverlayHostCore(presenter);
        var pipeName = $"figwin-overlay-test-{Guid.NewGuid():N}"[..40];
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        var server = new PipeServer(host, pipeName).RunAsync(cancellation.Token);

        await using var pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous);
        await pipe.ConnectAsync(cancellation.Token);
        var client = new FakeClient(new OverlayHostCore(presenter)); // 只用来编写消息
        using var reader = new StreamReader(pipe, new UTF8Encoding(false), leaveOpen: true);

        async Task<JsonObject> Exchange(JsonObject message)
        {
            await pipe.WriteAsync(Encoding.UTF8.GetBytes(message.ToJsonString() + "\n"), cancellation.Token);
            await pipe.FlushAsync(cancellation.Token);
            var line = await reader.ReadLineAsync(cancellation.Token);
            return JsonNode.Parse(line!)!.AsObject();
        }

        var hello = client.Envelope("hello");
        hello["role"] = "renderer";
        hello["pid"] = 1;
        hello["terminal"] = new JsonObject { ["kind"] = "windows-terminal", ["wtSession"] = null };
        Assert.Equal("welcome", (await Exchange(hello)).Str("t"));

        var show = client.Envelope("show").Merge(FakeClient.ShowBody());
        var status = await Exchange(show);
        Assert.Equal(("status", "shown", client.Seq), (status.Str("t"), status.Str("state"), status.Num("forSeq")));
        Assert.Single(presenter.Applied);

        cancellation.Cancel();
        pipe.Close();
        await server;
    }

    [Fact]
    public void 端点路径_Windows上是命名管道_其他系统上是套接字文件()
    {
        var path = PipeServer.EndpointPath("demo");
        if (OperatingSystem.IsWindows()) Assert.Equal(@"\\.\pipe\demo", path);
        else Assert.EndsWith("CoreFxPipe_demo", path);
    }

    [Fact]
    public async Task 同一个管道名上已有宿主时_第二个宿主报告已在运行()
    {
        var pipeName = $"figwin-overlay-test-{Guid.NewGuid():N}"[..40];
        using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        var first = new PipeServer(new OverlayHostCore(new FakePresenter()), pipeName).RunAsync(cancellation.Token);
        // 等第一个宿主开始监听
        await using (var probe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut, PipeOptions.Asynchronous))
        {
            await probe.ConnectAsync(cancellation.Token);
        }

        var error = await Assert.ThrowsAsync<HostAlreadyRunningException>(
            () => new PipeServer(new OverlayHostCore(new FakePresenter()), pipeName).RunAsync(cancellation.Token));
        Assert.Equal(pipeName, error.PipeName);

        cancellation.Cancel();
        await first;
    }

    // 与 src/inshellisense/src/tests/overlay/launch.test.ts 使用同一组数据：两边必须算出同样的管道名
    [Theory]
    [InlineData("alice", 1, "figwin-overlay-v1-2bd806c97f0e00af-1")]
    [InlineData("Alice", 1, "figwin-overlay-v1-2bd806c97f0e00af-1")]
    [InlineData("张三", 2, "figwin-overlay-v1-1d841bc0ee98309c-2")]
    [InlineData("runneradmin", 0, "figwin-overlay-v1-6d4dd91a15baa7e0-0")]
    public void 默认管道名按用户和登录会话计算(string userName, int logonSession, string expected)
    {
        Assert.Equal(expected, OverlayEndpoint.DefaultPipeName(userName, logonSession));
    }
}
