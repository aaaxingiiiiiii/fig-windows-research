// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-056：一次跑完对照试验，定位错位的原因，不需要用户操作。在 Windows 上运行，Mac 上只能检查脚本本身。
//   node spikes/T-056-resize-sim/matrix.cjs [pwsh] [--out=local/evidence/T-056-matrix]
// 每组都带 --wrap --per-step（最后一组除外），依次是：
//   direct-*：不经过 inshellisense，直接运行 pwsh（对照组）
//   is-bundled-*：inshellisense 用 node-pty 附带的 conpty.dll（T-056 修复之前的做法）
//   is-system-*：inshellisense 用系统自带的 ConPTY（T-056 的修复，Windows 11 上的默认做法）
//   is-default-*：不指定 FIGWIN_CONPTY，按 src/isterm/pty.ts 的 useBundledConpty 选择
//   *-plain / *-conpty：外层 xterm 用默认规则 / 用 ConPTY 的规则
// 完整输出（含提示符，可能有本机路径）写到 --out 目录；屏幕上和 summary.md 中只有坐标和是否对齐，可以公开。

const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);
const shell = args.find((arg) => !arg.startsWith("--")) ?? "pwsh";
const outArg = args.find((arg) => arg.startsWith("--out="));
const repo = path.resolve(__dirname, "..", "..");
const out = path.resolve(repo, outArg ? outArg.slice("--out=".length) : path.join("local", "evidence", "T-056-matrix"));
fs.mkdirSync(out, { recursive: true });

const groups = [
  { name: "direct-plain", flags: ["--direct"] },
  { name: "direct-conpty", flags: ["--direct", "--outer-conpty"] },
  { name: "is-bundled-plain", flags: [], conpty: "bundled" },
  { name: "is-bundled-conpty", flags: ["--outer-conpty"], conpty: "bundled" },
  { name: "is-system-plain", flags: [], conpty: "system" },
  { name: "is-system-conpty", flags: ["--outer-conpty"], conpty: "system" },
  { name: "is-default-conpty", flags: ["--outer-conpty"] },
  { name: "is-system-conpty-nowrap", flags: ["--outer-conpty"], conpty: "system", nowrap: true },
];

const cell = (result) => {
  const where = result.cursor ? `${result.cursor[0]},${result.cursor[1]}` : "";
  if (result.label === "exited early") return "提前退出";
  if (result.aligned === false) return `✗框 ${where}`;
  if (result.promptAligned === false) return `✗行 ${where}`;
  if (result.rowStable === false) return `✗跳 ${where}`;
  return `✓ ${where}`;
};

const rows = [];
let labels = [];
for (const group of groups) {
  const flags = [shell, ...(group.nowrap ? [] : ["--wrap"]), "--per-step", ...group.flags];
  const env = { ...process.env };
  delete env.FIGWIN_CONPTY;
  if (group.conpty) env.FIGWIN_CONPTY = group.conpty;
  process.stdout.write(`${group.name} ... `);
  const run = spawnSync(process.execPath, [path.join(__dirname, "resize-sim.cjs"), ...flags], { cwd: repo, env, encoding: "utf8", timeout: 180000 });
  fs.writeFileSync(path.join(out, `${group.name}.jsonl`), run.stdout + (run.stderr ? `\n# stderr\n${run.stderr}` : ""));
  const results = run.stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
  if (results.length > labels.length) labels = results.map((result) => result.label);
  rows.push({ name: group.name, exit: run.status, results });
  console.log(run.status === 0 ? "通过" : `失败（退出码 ${run.status}）`);
}

const table = [
  `shell：${shell}；平台：${process.platform}；${new Date().toISOString()}`,
  "",
  `| 组 | 退出码 | ${labels.join(" | ")} |`,
  `| --- | --- | ${labels.map(() => "---").join(" | ")} |`,
  ...rows.map(({ name, exit, results }) => {
    const byLabel = new Map(results.map((result) => [result.label, result]));
    const extra = byLabel.get("exited early");
    return `| ${name} | ${exit} | ${labels.map((label) => (byLabel.has(label) ? cell(byLabel.get(label)) : extra ? cell(extra) : "")).join(" | ")} |`;
  }),
  "",
  "✓ 对齐；✗框 候选框没有紧贴光标；✗行 输入的字符没有出现在提示符所在的行；✗跳 输入一个字符后光标跳到了别的行。坐标是外层终端的光标（列,行，从 0 开始）。",
].join("\n");
fs.writeFileSync(path.join(out, "summary.md"), table + "\n");
console.log("\n" + table);
console.log(`\n完整输出：${path.relative(repo, out)}`);
