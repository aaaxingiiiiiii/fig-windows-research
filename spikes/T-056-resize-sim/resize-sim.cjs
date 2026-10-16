// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-056：自动检查“改变窗口大小后候选框是否错位”，不需要用户操作。
// 用 xterm-headless 模拟外层终端，代替 Windows Terminal；内层用 node-pty 运行我们构建的 inshellisense 和指定的 shell
// （Windows 上内层是 ConPTY）。改变几次窗口大小后，检查外层屏幕上候选框是否紧贴光标所在行。
//
// 用法（在仓库根目录，先在 src/inshellisense 下 npm ci && npm run build）：
//   node spikes/T-056-resize-sim/resize-sim.cjs [pwsh|zsh|bash] [--wrap] [--direct] [--outer-conpty] [--per-step] [--steps=80x30,120x30]
//   --wrap：先输出几行会折行的长内容，检查重新折行的影响
//   --direct：不经过 inshellisense，直接运行 shell（对照组：没有 inshellisense 时是否也错位）
//   --outer-conpty：外层 xterm 按 ConPTY 的规则处理窗口变化（windowsPty，VS Code 的终端也这样设置）
//   --per-step：每次改变大小后都输入 e、检查、再删掉，用来定位是哪一步引起错位
//   --steps：改变大小的顺序，默认 80x30,120x30,90x24,100x30
// 内层 inshellisense 的试验变体用环境变量 FIGWIN_T056_VARIANT 指定（off、conpty、legacy、noscroll，见 src/inshellisense/src/isterm/pty.ts）。
// 输出：每次检查一行 JSON。aligned=false 表示候选框没有紧贴光标；promptAligned=false 表示输入的字符没有出现在提示符所在的行；
// rowStable=false 表示输入一个字符后光标跳到了别的行。
// 输出中的 cursorLine 和 rawAfterTyping 含提示符（可能有本机路径），只存到 local/。

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const repo = path.resolve(__dirname, "..", "..");
const modules = path.join(repo, "src", "inshellisense", "node_modules");
const pty = require(path.join(modules, "node-pty"));
const { Terminal } = require(path.join(modules, "@xterm", "headless"));

const args = process.argv.slice(2);
const shell = args.find((arg) => !arg.startsWith("--")) ?? (process.platform === "win32" ? "pwsh" : "zsh");
const wrap = args.includes("--wrap");
const direct = args.includes("--direct");
const outerConpty = args.includes("--outer-conpty");
const perStep = args.includes("--per-step");
const stepsArg = args.find((arg) => arg.startsWith("--steps="));
const steps = (stepsArg ? stepsArg.slice("--steps=".length) : "80x30,120x30,90x24,100x30").split(",").map((step) => step.split("x").map(Number));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "figwin-resize-"));
const env = { ...process.env };
if (shell === "zsh") {
  fs.writeFileSync(path.join(tmp, ".zshrc"), "PROMPT='> '\n");
  env.ZDOTDIR = tmp;
}

const findOnPath = (name) => {
  if (process.platform !== "win32") return name;
  const exts = (process.env.PATHEXT ?? ".EXE").split(";");
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const ext of ["", ...exts]) {
      const candidate = path.join(dir, name + ext);
      if (dir && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  return name;
};

const windowsBuild = Number(os.release().split(".")[2]) || 22000;
const outer = new Terminal({
  cols: 100,
  rows: 30,
  allowProposedApi: true,
  scrollback: 1000,
  windowsPty: outerConpty ? { backend: "conpty", buildNumber: process.platform === "win32" ? windowsBuild : 22000 } : undefined,
});
let chain = Promise.resolve();
let promptPrefix;

const inspect = (label, typed) => {
  const buffer = outer.buffer.active;
  const lines = [];
  for (let i = 0; i < outer.rows; i++) lines.push(buffer.getLine(buffer.viewportY + i)?.translateToString(true) ?? "");
  const cursorY = buffer.cursorY;
  const cursorLine = lines[cursorY];
  const tops = lines.flatMap((line, i) => (line.includes("┌") ? [i] : []));
  const bottoms = lines.flatMap((line, i) => (line.includes("└") ? [i] : []));
  const visible = lines.some((line) => line.includes("checkout"));
  // 候选框在光标上方时，最后一个下边框应在光标的上一行；在下方时，第一个上边框应在光标的下一行
  const above = bottoms.length > 0 && Math.max(...bottoms) < cursorY;
  const aligned = direct || !visible || (above ? Math.max(...bottoms) === cursorY - 1 : tops.length > 0 && Math.min(...tops) === cursorY + 1);
  // 输入的字符应该和提示符在同一行（提示符取第一次检查时光标行中输入内容之前的部分）
  const promptAligned = typed == null || promptPrefix == null ? null : cursorLine.startsWith(promptPrefix) && cursorLine.includes(typed);
  return {
    label,
    cols: outer.cols,
    rows: outer.rows,
    cursor: [buffer.cursorX, cursorY],
    visible: direct ? null : visible,
    direction: visible && !direct ? (above ? "above" : "below") : null,
    aligned,
    promptAligned,
    cursorLine,
  };
};

const ok = (result) => result.aligned !== false && result.promptAligned !== false && result.rowStable !== false;

(async () => {
  const file = direct ? findOnPath(shell) : process.execPath;
  const shellArgs = { pwsh: ["-NoLogo", "-NoProfile"], bash: ["--norc"], zsh: [] }[shell] ?? [];
  const p = pty.spawn(file, direct ? shellArgs : [path.join(repo, "src", "inshellisense", "build", "index.js"), "-s", shell], {
    name: "xterm-256color",
    cols: 100,
    rows: 30,
    cwd: repo,
    env,
  });
  // 像真实终端一样回复查询（例如 PSReadLine 查询光标位置的 CSI 6n），否则 pwsh 会一直等待
  outer.onData((reply) => p.write(reply));
  let raw = "";
  let lastData = Date.now();
  let exited = false;
  p.onExit(() => (exited = true));
  p.onData((data) => {
    raw += data;
    lastData = Date.now();
    chain = chain.then(() => new Promise((resolve) => outer.write(data, resolve)));
  });
  // 等到出现第一个提示符，最多 30 秒；pwsh 第一次启动较慢。
  // inshellisense 有提示符结束标记（OSC 6973;PE）；直接运行 shell 时，等输出停止 1.5 秒
  for (let waited = 0; waited < 30000; waited += 250) {
    if (direct ? raw.length > 0 && Date.now() - lastData > 1500 : raw.includes("\x1b]6973;PE")) break;
    await sleep(250);
  }
  await sleep(1000);
  const run = async (line, wait) => {
    p.write(line);
    await sleep(wait);
  };
  // 不把这次测试的命令写进用户的 PowerShell 历史（只有这一行本身会被记录）
  if (shell === "pwsh") await run("Set-PSReadLineOption -HistorySaveStyle SaveNothing\r", 800);
  if (wrap) {
    for (let i = 0; i < 6; i++) await run(`echo ${String(i).repeat(150)}\r`, 150);
  }
  for (let i = 0; i < 8; i++) await run(`echo line${i}\r`, 100);
  await sleep(800);
  for (const c of "git ch") await run(c, 100);
  await sleep(1500);
  await chain;
  const before = inspect("before");
  const at = before.cursorLine.lastIndexOf("git ch");
  promptPrefix = at > 0 ? before.cursorLine.slice(0, at) : undefined;
  const results = [{ ...inspect("before", "git ch"), promptPrefixFound: promptPrefix != null }];

  // 输入一个字符后，光标应留在原来的行（命令很短，不会折行）；跳到别的行说明内外行号不一致
  const typeAndInspect = async (label) => {
    const mark = raw.length;
    const rowBefore = outer.buffer.active.cursorY;
    p.write("e");
    await sleep(1200);
    await chain;
    const result = inspect(label, "git che");
    results.push({ ...result, rowStable: result.cursor[1] === rowBefore, rawAfterTyping: JSON.stringify(raw.slice(mark).slice(-600)) });
  };

  for (const [cols, rows] of steps) {
    if (exited) break;
    outer.resize(cols, rows);
    p.resize(cols, rows);
    await sleep(1200);
    await chain;
    results.push(inspect(`after resize ${cols}x${rows}`, "git ch"));
    if (perStep && !exited) {
      await typeAndInspect(`typed e after ${cols}x${rows}`);
      p.write("\x7f");
      await sleep(800);
      await chain;
    }
  }
  if (!perStep && !exited) await typeAndInspect("after typing e");
  if (exited) results.push({ label: "exited early", aligned: false, promptAligned: false, rawTail: JSON.stringify(raw.slice(-300)) });
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
  process.exit(results.every(ok) ? 0 : 1);
})();
