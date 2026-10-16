// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// test-installer.ps1 的辅助脚本（T-059）：像用户一样新开一个终端，检查安装好的补全。
// 用 node-pty 启动程序，用 xterm-headless 模拟终端画面（并回复 PSReadLine 的光标位置查询）。
//   node scripts/windows/check-installed.cjs <要启动的程序> <方式> [秒数] [-- 程序的参数...]
// 方式：
//   complete     等到 inshellisense 的提示符标记出现，输入 git ch，检查候选中有 checkout
//   complete-ps  同上，输入 Get-ChildItem -Pa，检查候选中有 -Path（PowerShell 自己的命令，T-064）
//   survive   inshellisense 启动失败时（例如配置写错），PowerShell 仍然可以使用：能执行 echo
//   hold      等到 inshellisense 启动后保持若干秒再退出（用来检查“有终端在运行时阻止升级和卸载”）
// 子进程的 PATH 用环境变量 FIGWIN_CHILD_PATH 指定（test-installer.ps1 去掉了 Node 所在的目录）。
// 输出一行 JSON；符合预期时退出码为 0。

const path = require("node:path");

const repo = path.resolve(__dirname, "..", "..");
const modules = path.join(repo, "src", "inshellisense", "node_modules");
const pty = require(path.join(modules, "node-pty"));
const { Terminal } = require(path.join(modules, "@xterm", "headless"));

const [file, mode, secondsArg, separator, ...rest] = process.argv.slice(2);
const args = separator === "--" ? rest : [];
const seconds = Number(secondsArg ?? 0) || 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const marker = "\x1b]6973;PE";

const env = {};
for (const [key, value] of Object.entries(process.env)) if (!/^path$/i.test(key) && key !== "ISTERM") env[key] = value;
env[process.platform === "win32" ? "Path" : "PATH"] = process.env.FIGWIN_CHILD_PATH ?? process.env.PATH ?? "";

(async () => {
  const term = new Terminal({ cols: 120, rows: 30, allowProposedApi: true });
  const p = pty.spawn(file, args, { name: "xterm-256color", cols: 120, rows: 30, cwd: repo, env });
  let raw = "";
  let exited = false;
  term.onData((reply) => p.write(reply));
  p.onData((data) => {
    raw += data;
    term.write(data);
  });
  p.onExit(() => (exited = true));
  const screen = () => {
    const lines = [];
    const buffer = term.buffer.active;
    for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
    return lines.join("\n");
  };
  const waitFor = async (predicate, ms) => {
    for (let waited = 0; waited < ms; waited += 250) {
      if (predicate()) return true;
      if (exited) return predicate();
      await sleep(250);
    }
    return predicate();
  };
  const type = async (text) => {
    for (const c of text) {
      p.write(c);
      await sleep(100);
    }
  };

  const result = { mode };
  if (mode === "survive") {
    // 等 PowerShell 的提示符出现，再多等几秒，确认 inshellisense 没有启动、PowerShell 也没有被关掉
    await waitFor(() => /^PS /m.test(screen()), 60000);
    await sleep(3000);
    result.inshellisense = raw.includes(marker);
  } else {
    // pwsh 第一次启动、inshellisense 解包后第一次加载都比较慢
    result.inshellisense = await waitFor(() => raw.includes(marker), 60000);
  }
  if (mode === "complete" || mode === "complete-ps") {
    const [input, expected] = mode === "complete" ? ["git ch", "checkout"] : ["Get-ChildItem -Pa", "-Path"];
    if (result.inshellisense) {
      await sleep(1000);
      await type(input);
      // 候选框里要出现期望的候选；输入行本身不算（输入行中是 -Pa，不包含 -Path）
      result.completions = await waitFor(() => screen().includes(expected), 15000);
    }
    result.ok = result.inshellisense && result.completions === true;
  } else if (mode === "survive") {
    await type("echo alive-$(6*7)\r");
    result.alive = await waitFor(() => screen().includes("alive-42"), 15000);
    result.ok = !result.inshellisense && result.alive;
  } else if (mode === "hold") {
    if (result.inshellisense) await sleep(seconds * 1000);
    result.ok = result.inshellisense;
  }
  result.exitedEarly = exited;
  if (!result.ok) result.screenTail = screen().split("\n").filter(Boolean).slice(-12);
  console.log(JSON.stringify(result));
  if (!exited) {
    p.write("\x03");
    await sleep(300);
    p.write("exit\r");
    await sleep(1500);
    try {
      p.kill();
    } catch {
      /* 已退出 */
    }
  }
  process.exit(result.ok ? 0 : 1);
})();
