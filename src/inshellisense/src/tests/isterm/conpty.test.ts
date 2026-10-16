// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-056: which ConPTY inshellisense uses on Windows (see useBundledConpty in isterm/pty.ts).

import { useBundledConpty } from "../../isterm/pty.js";

test("the conpty.dll bundled with node-pty stays the default: with the system ConPTY no suggestions are shown (E-021)", () => {
  expect(useBundledConpty("win32", undefined)).toBe(true);
  expect(useBundledConpty("win32", "bundled")).toBe(true);
  expect(useBundledConpty("win32", "other")).toBe(true);
});

test("FIGWIN_CONPTY=system switches to the system ConPTY for experiments", () => {
  expect(useBundledConpty("win32", "system")).toBe(false);
});

test("other platforms are unaffected (node-pty ignores the option there)", () => {
  expect(useBundledConpty("darwin", "system")).toBe(true);
  expect(useBundledConpty("linux", undefined)).toBe(true);
});
