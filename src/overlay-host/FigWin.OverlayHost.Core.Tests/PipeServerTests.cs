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
}
