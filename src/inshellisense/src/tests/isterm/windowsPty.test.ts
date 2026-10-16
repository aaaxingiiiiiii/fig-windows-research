// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-056: the internal xterm must follow ConPTY's resize rules on Windows.
// ConPTY has no scrollback: when the window grows taller it adds blank rows at the bottom, and when it grows wider and
// wrapped lines are joined, the cursor moves up. In both cases the default xterm pulls lines back from its scrollback.

import xterm from "@xterm/headless";
import { t056TerminalOptions } from "../../isterm/pty.js";

const write = (term: xterm.Terminal, data: string) => new Promise<void>((resolve) => term.write(data, resolve));
const options = (variant?: string) => t056TerminalOptions("win32", "10.0.26200", variant);

const cursorRowAfterGrowing = async (variant?: string) => {
  const term = new xterm.Terminal({ allowProposedApi: true, cols: 40, rows: 6, ...options(variant) });
  for (let i = 0; i < 20; i++) await write(term, `line${i}\r\n`);
  await write(term, "PS> git ch");
  const before = term.buffer.active.cursorY;
  term.resize(40, 10);
  const after = term.buffer.active.cursorY;
  term.dispose();
  return { before, after };
};

// two lines that wrap at 40 columns sit just above the prompt; widening to 80 columns joins them
const cursorRowAfterWidening = async (variant?: string) => {
  const term = new xterm.Terminal({ allowProposedApi: true, cols: 40, rows: 6, ...options(variant) });
  for (let i = 0; i < 20; i++) await write(term, `line${i}\r\n`);
  for (const c of "ab") await write(term, `${c.repeat(70)}\r\n`);
  await write(term, "PS> git ch");
  const before = term.buffer.active.cursorY;
  term.resize(80, 6);
  const after = term.buffer.active.cursorY;
  term.dispose();
  return { before, after };
};

test("t056TerminalOptions only applies on win32 and defaults to upstream behaviour", () => {
  expect(t056TerminalOptions("darwin", "25.6.0", "noscroll")).toEqual({});
  expect(options(undefined)).toEqual({});
  expect(options("off")).toEqual({});
  expect(options("conpty")).toEqual({ windowsPty: { backend: "conpty", buildNumber: 26200 } });
  // the bundled conpty.dll (useConptyDll) supports reflow even on older Windows 10 builds
  expect(t056TerminalOptions("win32", "10.0.19045", "conpty")).toEqual({ windowsPty: { backend: "conpty", buildNumber: 21376 } });
  expect(options("legacy")).toEqual({ windowsPty: { backend: "conpty", buildNumber: 21375 } });
  expect(options("noscroll")).toEqual({ windowsPty: { backend: "conpty", buildNumber: 26200 }, scrollback: 0 });
});

test("growing the terminal pulls lines from scrollback by default", async () => {
  expect(await cursorRowAfterGrowing()).toEqual({ before: 5, after: 9 });
});

test("growing the terminal keeps the cursor row with the conpty and noscroll variants, like ConPTY", async () => {
  expect(await cursorRowAfterGrowing("conpty")).toEqual({ before: 5, after: 5 });
  expect(await cursorRowAfterGrowing("noscroll")).toEqual({ before: 5, after: 5 });
});

test("widening keeps the cursor row by pulling from scrollback, even with windowsPty", async () => {
  expect(await cursorRowAfterWidening()).toEqual({ before: 5, after: 5 });
  expect(await cursorRowAfterWidening("conpty")).toEqual({ before: 5, after: 5 });
});

test("widening moves the cursor up with the noscroll variant, like ConPTY", async () => {
  expect(await cursorRowAfterWidening("noscroll")).toEqual({ before: 5, after: 3 });
});
