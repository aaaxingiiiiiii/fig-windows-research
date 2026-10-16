// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-056: the internal xterm must follow ConPTY's resize rules on Windows.
// ConPTY has no scrollback, so when the window grows taller it adds blank rows at the bottom and the cursor keeps its row.

import xterm from "@xterm/headless";
import { t056WindowsPty } from "../../isterm/pty.js";

const write = (term: xterm.Terminal, data: string) => new Promise<void>((resolve) => term.write(data, resolve));

const cursorRowAfterGrowing = async (windowsPty: ReturnType<typeof t056WindowsPty>) => {
  const term = new xterm.Terminal({ allowProposedApi: true, cols: 40, rows: 6, windowsPty });
  for (let i = 0; i < 20; i++) await write(term, `line${i}\r\n`);
  await write(term, "PS> git ch");
  const before = term.buffer.active.cursorY;
  term.resize(40, 10);
  const after = term.buffer.active.cursorY;
  term.dispose();
  return { before, after };
};

test("t056WindowsPty only applies on win32 and defaults to upstream behaviour", () => {
  expect(t056WindowsPty("darwin", "25.6.0", "conpty")).toBeUndefined();
  expect(t056WindowsPty("win32", "10.0.26200", undefined)).toBeUndefined();
  expect(t056WindowsPty("win32", "10.0.26200", "off")).toBeUndefined();
  expect(t056WindowsPty("win32", "10.0.26200", "conpty")).toEqual({ backend: "conpty", buildNumber: 26200 });
  // the bundled conpty.dll (useConptyDll) supports reflow even on older Windows 10 builds
  expect(t056WindowsPty("win32", "10.0.19045", "conpty")).toEqual({ backend: "conpty", buildNumber: 21376 });
  expect(t056WindowsPty("win32", "10.0.26200", "legacy")).toEqual({ backend: "conpty", buildNumber: 21375 });
});

test("growing the terminal pulls lines from scrollback by default", async () => {
  const { before, after } = await cursorRowAfterGrowing(undefined);
  expect(before).toBe(5);
  expect(after).toBe(9);
});

test("growing the terminal keeps the cursor row with the conpty variant, like ConPTY", async () => {
  const { before, after } = await cursorRowAfterGrowing(t056WindowsPty("win32", "10.0.26200", "conpty"));
  expect(before).toBe(5);
  expect(after).toBe(5);
});
