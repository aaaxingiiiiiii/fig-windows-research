// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-056：自动检查“改变窗口大小后候选框是否错位”，不需要用户操作。
// 用 xterm-headless 模拟外层终端，代替 Windows Terminal；内层用 node-pty 运行我们构建的 inshellisense 和指定的 shell
// （Windows 上内层是 ConPTY）。改变几次窗口大小后，检查外层屏幕上候选框是否紧贴光标所在行。
//
// 用法（在仓库根目录，先在 src/inshellisense 下 npm ci && npm run build）：
//   node spikes/T-056-resize-sim/resize-sim.cjs [pwsh|zsh|bash] [--wrap]
//   --wrap：先输出几行会折行的长内容，检查重新折行的影响
// 输出：每次改变大小后一行 JSON；aligned=false 表示错位。

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const repo = path.resolve(__dirname, "..", "..");
const modules = path.join(repo, "src", "inshellisense", "node_modules");
const pty = require(path.join(modules, "node-pty"));
const { Terminal } = require(path.join(modules, "@xterm", "headless"));

const shell = process.argv[2] ?? (process.platform === "win32" ? "pwsh" : "zsh");
const wrap = process.argv.includes("--wrap");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "figwin-resize-"));
const env = { ...process.env };
if (shell === "zsh") {
  fs.writeFileSync(path.join(tmp, ".zshrc"), "PROMPT='> '\n");
  env.ZDOTDIR = tmp;
}

const outer = new Terminal({ cols: 100, rows: 30, allowProposedApi: true, scrollback: 1000 });
let chain = Promise.resolve();

const inspect = (label) => {
  const buffer = outer.buffer.active;
  const lines = [];
  for (let i = 0; i < outer.rows; i++) lines.push(buffer.getLine(buffer.viewportY + i)?.translateToString(true) ?? "");
  const cursorY = buffer.cursorY;
  const tops = lines.flatMap((line, i) => (line.includes("┌") ? [i] : []));
  const bottoms = lines.flatMap((line, i) => (line.includes("└") ? [i] : []));
  const visible = lines.some((line) => line.includes("checkout"));
  // 候选框在光标上方时，最后一个下边框应在光标的上一行；在下方时，第一个上边框应在光标的下一行
  const above = bottoms.length > 0 && Math.max(...bottoms) < cursorY;
  const aligned = !visible || (above ? Math.max(...bottoms) === cursorY - 1 : tops.length > 0 && Math.min(...tops) === cursorY + 1);
  return { label, cols: outer.cols, rows: outer.rows, cursor: [buffer.cursorX, cursorY], visible, direction: visible ? (above ? "above" : "below") : null, aligned, cursorLine: lines[cursorY] };
};

(async () => {
  const p = pty.spawn(process.execPath, [path.join(repo, "src", "inshellisense", "build", "index.js"), "-s", shell], {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd: repo,
    env,
  });
  // 像真实终端一样回复查询（例如 PSReadLine 查询光标位置的 CSI 6n），否则 pwsh 会一直等待
  outer.onData((reply) => p.write(reply));
  let raw = "";
  let exited = false;
  p.onExit(() => (exited = true));
  p.onData((data) => {
    raw += data;
    chain = chain.then(() => new Promise((resolve) => outer.write(data, resolve)));
  });
  // 等到出现第一个提示符（inshellisense 的提示符结束标记 OSC 6973;PE），最多 30 秒；pwsh 第一次启动较慢
  for (let waited = 0; waited < 30000 && !raw.includes("\x1b]6973;PE"); waited += 250) await sleep(250);
  await sleep(1000);
  if (wrap) {
    for (let i = 0; i < 6; i++) {
      p.write(`echo ${String(i).repeat(150)}\r`);
      await sleep(150);
    }
  }
  for (let i = 0; i < 8; i++) {
    p.write(`echo line${i}\r`);
    await sleep(100);
  }
  await sleep(800);
  for (const c of "git ch") {
    p.write(c);
    await sleep(100);
  }
  await sleep(1500);
  await chain;
  const results = [inspect("before")];
  for (const [cols, rows] of [
    [80, 30],
    [120, 30],
    [90, 24],
    [100, 30],
  ]) {
    if (exited) break;
    outer.resize(cols, rows);
    p.resize(cols, rows);
    await sleep(1200);
    await chain;
    results.push(inspect(`after resize ${cols}x${rows}`));
  }
  p.write("e");
  await sleep(1200);
  await chain;
  results.push(inspect("after typing e"));
  if (exited) results.push({ label: "inshellisense exited early", aligned: false, tail: raw.slice(-300) });
  for (const result of results) console.log(JSON.stringify(result));
  // 收尾：Ctrl+C 清掉当前行，再退出（避免把半截命令留在 shell 历史中）
  if (!exited) {
    p.write("\x03");
    await sleep(300);
    p.write("exit\r");
  }
  await sleep(1000);
  try {
    p.kill();
  } catch {
    /* 已退出 */
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(results.every((result) => result.aligned) ? 0 : 1);
})();
