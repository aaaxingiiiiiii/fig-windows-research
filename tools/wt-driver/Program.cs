// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
using System.Diagnostics;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Windows.Automation;

internal static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        if (args.Length < 4 || args[0] != "smoke")
        {
            Console.Error.WriteLine("Usage: WtDriver smoke <absolute-pwsh.exe> <output-directory> <runs 1..3>");
            return 2;
        }
        try
        {
            var shell = Path.GetFullPath(args[1]);
            if (!File.Exists(shell)) throw new FileNotFoundException("PowerShell executable missing", shell);
            var output = Path.GetFullPath(args[2]);
            Directory.CreateDirectory(output);
            int runs = int.Parse(args[3]);
            if (runs is < 1 or > 3) throw new ArgumentException("runs must be 1..3");
            Native.SetProcessDpiAwarenessContext(new IntPtr(-4));
            for (int i = 0; i < runs; i++) Run(shell, output, i + 1);
            return 0;
        }
        catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
    }

    static void Run(string shell, string output, int index)
    {
        string token = "figwin-test-" + Guid.NewGuid().ToString("N");
        string runDir = Path.Combine(output, token);
        Directory.CreateDirectory(runDir);
        string ready = Path.Combine(runDir, "ready.json");
        string script = Path.Combine(runDir, "start.ps1");
        // This script only signals readiness; the echo command is typed using SendInput.
        File.WriteAllText(script, "@{ pid=$PID; version=$PSVersionTable.PSVersion.ToString() } | ConvertTo-Json | Set-Content -LiteralPath '" + ready.Replace("'", "''") + "'\nfunction global:prompt { 'figwin> ' }\n");
        string wt = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "WindowsApps", "wt.exe");
        var launch = new ProcessStartInfo(wt) { UseShellExecute = false };
        foreach (var a in new[] { "-w", "new", "new-tab", "--title", token, "--suppressApplicationTitle", shell, "-NoLogo", "-NoProfile", "-NoExit", "-File", script }) launch.ArgumentList.Add(a);
        using var launcher = Process.Start(launch) ?? throw new InvalidOperationException("WT launch failed");
        IntPtr hwnd = IntPtr.Zero;
        try
        {
            Wait(() => (hwnd = FindWindow(token)) != IntPtr.Zero && File.Exists(ready), "Dedicated WT window did not start", 20000);
            Native.SetForegroundWindow(hwnd);
            Wait(() => Native.GetForegroundWindow() == hwnd, "Cannot focus dedicated WT window; no keys sent", 5000);
            var window = AutomationElement.FromHandle(hwnd);
            AutomationElement? terminal = null;
            Wait(() =>
            {
                var candidates = window.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.IsTextPatternAvailableProperty, true));
                foreach (AutomationElement candidate in candidates)
                {
                    string content = ReadText(candidate);
                    if (content.Contains("figwin> ")) { terminal = candidate; return true; }
                }
                return false;
            }, "Terminal UIA prompt unavailable", 10000);
            terminal!.SetFocus();
            Guard(hwnd, token);
            foreach (char ch in "echo hi") { Guard(hwnd, token); Native.TypeCharacter(ch); }
            Guard(hwnd, token);
            Native.Enter();
            string text = "";
            Wait(() =>
            {
                Guard(hwnd, token);
                text = ReadText(terminal);
                return text.Replace("\r", "").Split('\n').Any(line => line.Trim() == "hi");
            }, "UIA did not observe echo output", 8000);
            Guard(hwnd, token);
            var r = terminal.Current.BoundingRectangle;
            if (r.IsEmpty || r.Width < 1 || r.Height < 1) throw new InvalidOperationException("Terminal bounds empty");
            Native.GetWindowRect(hwnd, out var bounds);
            using var bitmap = new Bitmap(bounds.Right - bounds.Left, bounds.Bottom - bounds.Top);
            using (var g = Graphics.FromImage(bitmap)) g.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bitmap.Size);
            bitmap.Save(Path.Combine(runDir, "terminal.png"), ImageFormat.Png);
            File.WriteAllText(Path.Combine(runDir, "screen.txt"), text);
            File.WriteAllText(Path.Combine(runDir, "result.json"), JsonSerializer.Serialize(new
            {
                passed = true, index, title = token, hwnd = hwnd.ToInt64(),
                terminalBounds = new { x = r.X, y = r.Y, width = r.Width, height = r.Height },
                shell = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(ready)),
                screenshot = "terminal.png", observed = "hi"
            }, new JsonSerializerOptions { WriteIndented = true }));
            Console.WriteLine($"Run {index}: PASS; artifacts: {runDir}");
        }
        finally
        {
            // Close only the unique window we created, never an existing user's window.
            if (hwnd != IntPtr.Zero && Native.Title(hwnd).Contains(token, StringComparison.Ordinal)) Native.PostMessage(hwnd, 0x0010, IntPtr.Zero, IntPtr.Zero);
        }
    }
    static string ReadText(AutomationElement element) => element.TryGetCurrentPattern(TextPattern.Pattern, out var pattern)
        ? ((TextPattern)pattern).DocumentRange.GetText(-1) : "";
    static void Guard(IntPtr hwnd, string token)
    {
        if (Native.GetForegroundWindow() != hwnd || !Native.Title(hwnd).Contains(token, StringComparison.Ordinal))
            throw new InvalidOperationException("Focus/identity changed; stopping without sending more keys");
    }
    static IntPtr FindWindow(string token)
    {
        IntPtr found = IntPtr.Zero;
        Native.EnumWindows((hwnd, _) => { if (Native.Title(hwnd).Contains(token, StringComparison.Ordinal)) found = hwnd; return true; }, IntPtr.Zero);
        return found;
    }
    static void Wait(Func<bool> condition, string message, int timeout)
    {
        var clock = Stopwatch.StartNew();
        while (clock.ElapsedMilliseconds < timeout) { if (condition()) return; Thread.Sleep(100); }
        throw new TimeoutException(message);
    }
}

internal static class Native
{
    internal delegate bool EnumCallback(IntPtr hwnd, IntPtr param);
    [DllImport("user32.dll")] internal static extern bool EnumWindows(EnumCallback callback, IntPtr param);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int max);
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] internal static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] internal static extern bool GetWindowRect(IntPtr hwnd, out Rect bounds);
    [DllImport("user32.dll")] internal static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, Input[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] internal struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct Input { public uint Type; public InputUnion Data; }
    [StructLayout(LayoutKind.Explicit)] struct InputUnion
    {
        [FieldOffset(0)] public Keyboard Keyboard;
        [FieldOffset(0)] public Mouse Mouse;
    }
    [StructLayout(LayoutKind.Sequential)] struct Keyboard { public ushort VirtualKey, Scan; public uint Flags, Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Sequential)] struct Mouse { public int X, Y; public uint Data, Flags, Time; public UIntPtr Extra; }
    internal static string Title(IntPtr hwnd) { var text = new StringBuilder(512); GetWindowText(hwnd, text, text.Capacity); return text.ToString(); }
    internal static void TypeCharacter(char value) => Key(0, value, 4);
    internal static void Enter() => Key(13, 0, 0);
    static void Key(ushort key, ushort scan, uint flags)
    {
        var input = new[] {
            new Input { Type=1, Data = new InputUnion { Keyboard = new Keyboard { VirtualKey=key, Scan=scan, Flags=flags } } },
            new Input { Type=1, Data = new InputUnion { Keyboard = new Keyboard { VirtualKey=key, Scan=scan, Flags=flags|2 } } }
        };
        if (SendInput(2, input, Marshal.SizeOf<Input>()) != 2) throw new InvalidOperationException("SendInput failed: " + Marshal.GetLastWin32Error());
    }
}
