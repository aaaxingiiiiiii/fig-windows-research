// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

using System.IO.Pipes;
using System.Threading.Channels;
using FigWin.OverlayHost.Hosting;

namespace FigWin.OverlayHost.Transport;

/// <summary>
/// 字节模式的命名管道服务端（第 2 节）。Windows 上是 \\.\pipe\&lt;名称&gt;；其他系统上 .NET 用 Unix 域套接字实现，
/// 路径见 <see cref="EndpointPath"/>，便于在 Mac 上与 inshellisense 联调。
/// 只接受当前用户的连接（PipeOptions.CurrentUserOnly）。生产端点的命名见 <see cref="OverlayEndpoint"/>。
/// 同一个管道名只能有一个宿主：已经有宿主在监听时，<see cref="RunAsync"/> 抛出 <see cref="HostAlreadyRunningException"/>。
/// </summary>
public sealed class PipeServer(OverlayHostCore host, string pipeName)
{
    /// <summary>客户端（inshellisense 的 FIGWIN_OVERLAY_PIPE）应使用的完整端点。</summary>
    public static string EndpointPath(string pipeName) =>
        OperatingSystem.IsWindows() ? $@"\\.\pipe\{pipeName}" : Path.Combine(Path.GetTempPath(), "CoreFxPipe_" + pipeName);

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var connections = new List<Task>();
        var first = true;
        while (!cancellationToken.IsCancellationRequested)
        {
            NamedPipeServerStream stream;
            try
            {
                // 第一个实例带 FirstPipeInstance：已有宿主在用这个名称时创建失败
                stream = new NamedPipeServerStream(pipeName, PipeDirection.InOut, NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte, PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly | (first ? PipeOptions.FirstPipeInstance : PipeOptions.None));
            }
            catch (Exception e) when (first && e is IOException or UnauthorizedAccessException)
            {
                throw new HostAlreadyRunningException(pipeName, e);
            }
            first = false;
            try
            {
                await stream.WaitForConnectionAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                await stream.DisposeAsync().ConfigureAwait(false);
                break;
            }
            connections.RemoveAll(task => task.IsCompleted);
            connections.Add(HandleAsync(stream, cancellationToken));
        }
        await Task.WhenAll(connections).ConfigureAwait(false);
    }

    private async Task HandleAsync(NamedPipeServerStream stream, CancellationToken cancellationToken)
    {
        var outbound = new StreamOutbound(stream);
        var connection = host.Accept(outbound);
        var buffer = new byte[16384];
        try
        {
            while (!connection.IsClosed)
            {
                var read = await stream.ReadAsync(buffer, cancellationToken).ConfigureAwait(false);
                if (read == 0) break;
                connection.Receive(buffer.AsSpan(0, read));
            }
        }
        catch (Exception e) when (e is IOException or OperationCanceledException or ObjectDisposedException)
        {
            // 连接断开：与 EOF 同样处理
        }
        finally
        {
            connection.ReceiveEof();
            await outbound.DisposeAsync().ConfigureAwait(false);
        }
    }

    /// <summary>按顺序写出排队的行；记录尚未写出的字节数，供核心检查队列上限。</summary>
    private sealed class StreamOutbound : IOutboundChannel, IAsyncDisposable
    {
        private readonly Channel<byte[]> _queue = Channel.CreateUnbounded<byte[]>(new UnboundedChannelOptions { SingleReader = true });
        private readonly Stream _stream;
        private readonly Task _pump;
        private long _pending;

        public StreamOutbound(Stream stream)
        {
            _stream = stream;
            _pump = PumpAsync();
        }

        public long Enqueue(byte[] line)
        {
            var pending = Interlocked.Add(ref _pending, line.Length);
            _queue.Writer.TryWrite(line);
            return pending;
        }

        public void Close() => _queue.Writer.TryComplete();

        public async ValueTask DisposeAsync()
        {
            Close();
            await _pump.ConfigureAwait(false);
        }

        private async Task PumpAsync()
        {
            try
            {
                await foreach (var line in _queue.Reader.ReadAllAsync().ConfigureAwait(false))
                {
                    await _stream.WriteAsync(line).ConfigureAwait(false);
                    await _stream.FlushAsync().ConfigureAwait(false);
                    Interlocked.Add(ref _pending, -line.Length);
                }
                // Windows 上关闭服务端句柄前，等对方读完已写入的内容（最多 1 s）
                if (OperatingSystem.IsWindows() && _stream is PipeStream { IsConnected: true } pipe)
                {
                    await Task.WhenAny(Task.Run(pipe.WaitForPipeDrain), Task.Delay(1000)).ConfigureAwait(false);
                }
            }
            catch (Exception e) when (e is IOException or ObjectDisposedException or InvalidOperationException)
            {
                // 对方已断开
            }
            finally
            {
                await _stream.DisposeAsync().ConfigureAwait(false);
            }
        }
    }
}

/// <summary>同一个管道名上已经有宿主在监听。</summary>
public sealed class HostAlreadyRunningException(string pipeName, Exception inner)
    : Exception($"another overlay host is already listening on {pipeName}", inner)
{
    public string PipeName { get; } = pipeName;
}

