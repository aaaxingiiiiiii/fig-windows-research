/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：显示快照（docs/protocol.md 第 5 节）。

import type { Suggestion } from "../../runtime/model.js";
import { encodeLine, MAX_LINE_BYTES } from "../../overlay/protocol.js";
import { type DisplayState, type SnapshotInput, buildSnapshot, sanitizeDescription, sanitizeName, toCandidateType } from "../../overlay/snapshot.js";

const suggestion = (name: string, extra: Partial<Suggestion> = {}): Suggestion => ({ name, allNames: [name], icon: "", priority: 50, ...extra });

const display = (extra: Partial<DisplayState> = {}): DisplayState => ({
  page: [suggestion("checkout", { description: "Switch branches", type: "subcommand" }), suggestion("cherry-pick", { type: "subcommand" })],
  selectedIndex: 0,
  pageStart: 0,
  totalCount: 2,
  listVersion: 1,
  ...extra,
});

const input = (extra: Partial<SnapshotInput> = {}): SnapshotInput => ({
  display: display(),
  command: { commandText: "git ch", cursorTerminated: true, hasOutput: false },
  cursor: { cursorX: 6, cursorY: 2, hidden: false, shift: 0 },
  rows: 30,
  cols: 120,
  alternateBuffer: false,
  preserveDuringBackspaceEcho: false,
  ...extra,
});

test("与协议示例一致的 show：候选、选中项、光标单元格和终端网格", () => {
  const snapshot = buildSnapshot(input());
  expect(snapshot.kind).toBe("show");
  if (snapshot.kind !== "show") return;
  expect(snapshot.body).toEqual({
    candidates: [
      { name: "checkout", description: "Switch branches", type: "subcommand" },
      { name: "cherry-pick", description: null, type: "subcommand" },
    ],
    selectedIndex: 0,
    pageStart: 0,
    totalCount: 2,
    argumentDescription: null,
    cursor: { row: 2, col: 6 },
    terminal: { rows: 30, cols: 120, buffer: "normal", cursorVisible: true },
  });
  expect(snapshot.hasCandidates).toBe(true);
});

describe("P-06 分页与选中项", () => {
  test("selectedIndex 是页内下标；全局下标 = pageStart + selectedIndex", () => {
    const snapshot = buildSnapshot(input({ display: display({ page: [suggestion("e"), suggestion("f")], selectedIndex: 1, pageStart: 5, totalCount: 7 }) }));
    expect(snapshot.kind === "show" && snapshot.body).toMatchObject({ selectedIndex: 1, pageStart: 5, totalCount: 7 });
  });

  test("选中项或页码变化时，selectionKey 变化而 listKey 不变；候选列表重新计算后 listKey 变化", () => {
    const a = buildSnapshot(input());
    const b = buildSnapshot(input({ display: display({ selectedIndex: 1 }) }));
    const c = buildSnapshot(input({ display: display({ listVersion: 2 }) }));
    if (a.kind !== "show" || b.kind !== "show" || c.kind !== "show") throw new Error("expected show");
    expect(b.listKey).toBe(a.listKey);
    expect(b.selectionKey).not.toBe(a.selectionKey);
    expect(c.listKey).not.toBe(a.listKey);
  });

  test("只有参数说明时可以 show，但没有可接受的候选", () => {
    const snapshot = buildSnapshot(input({ display: display({ page: [], selectedIndex: null, totalCount: 0, argumentDescription: "branch name" }) }));
    expect(snapshot.kind === "show" && snapshot.body).toMatchObject({
      candidates: [],
      selectedIndex: null,
      pageStart: 0,
      totalCount: 0,
      argumentDescription: "branch name",
    });
    expect(snapshot.kind === "show" && snapshot.hasCandidates).toBe(false);
  });

  test("每页最多 20 项", () => {
    const page = Array.from({ length: 25 }, (_, i) => suggestion(`s${i}`));
    const snapshot = buildSnapshot(input({ display: display({ page, totalCount: 25 }) }));
    expect(snapshot.kind === "show" && snapshot.body.candidates).toHaveLength(20);
  });
});

describe("隐藏条件（与终端渲染器相同，另加光标要求）", () => {
  test.each([
    ["没有候选", { display: undefined }],
    ["命令为空", { command: { commandText: "", cursorTerminated: true } }],
    ["光标后面还有文字", { command: { commandText: "git ch", cursorTerminated: false } }],
    ["命令已有输出", { command: { commandText: "git ch", cursorTerminated: true, hasOutput: true } }],
    ["光标刚被输出推下", { cursor: { cursorX: 6, cursorY: 2, hidden: false, shift: 1 } }],
    ["光标不可见", { cursor: { cursorX: 6, cursorY: 2, hidden: true, shift: 0 } }],
    ["待换行（cursorX 等于列数），不对列取模", { cursor: { cursorX: 120, cursorY: 2, hidden: false, shift: 0 } }],
    ["行号越界", { cursor: { cursorX: 6, cursorY: 30, hidden: false, shift: 0 } }],
  ] as [string, Partial<SnapshotInput>][])("%s → hide(empty)", (_name, extra) => {
    expect(buildSnapshot(input(extra))).toEqual({ kind: "hide", reason: "empty" });
  });

  test("备用缓冲区 → hide(alternate-buffer)", () => {
    expect(buildSnapshot(input({ alternateBuffer: true }))).toEqual({ kind: "hide", reason: "alternate-buffer" });
  });

  test("刚发送退格、回显未到时保持显示", () => {
    expect(buildSnapshot(input({ command: { commandText: "git ch", cursorTerminated: false }, preserveDuringBackspaceEcho: true })).kind).toBe("show");
  });
});

describe("文字清洗", () => {
  test("名称去掉 ANSI 序列和所有控制字符；说明保留换行和制表符", () => {
    expect(sanitizeName("\u001b[31mred\u001b[0m\tname\n")).toBe("redname");
    expect(sanitizeDescription("line1\r\nline2\tx\u0007\u001b]8;;http://x\u0007link\u001b]8;;\u0007")).toBe("line1\nline2\txlink");
  });

  test("按 Unicode 标量值截断，不切开代理项；未配对的代理项替换为 U+FFFD", () => {
    expect(sanitizeName("😀😀😀", 2)).toBe("😀😀");
    expect(sanitizeName("a\ud800b")).toBe("a�b");
  });

  test("Fig 的类型映射到协议的枚举", () => {
    expect([toCandidateType("arg"), toCandidateType("special"), toCandidateType(undefined), toCandidateType("folder")]).toEqual([
      "argument",
      "other",
      "other",
      "folder",
    ]);
  });

  test("超长内容依次缩短说明和名称，保证单行不超过上限", () => {
    const long = "说".repeat(2048);
    const page = Array.from({ length: 20 }, (_, i) => suggestion(`${i}${"名".repeat(600)}`, { description: long }));
    const snapshot = buildSnapshot(input({ display: display({ page, totalCount: 20 }) }));
    expect(snapshot.kind).toBe("show");
    if (snapshot.kind !== "show") return;
    expect(encodeLine(snapshot.body)!.length).toBeLessThan(MAX_LINE_BYTES);
    expect(snapshot.body.candidates[0].name.startsWith("0")).toBe(true);
  });
});
