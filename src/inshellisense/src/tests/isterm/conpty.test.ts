// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-056: which ConPTY inshellisense uses on Windows (see useBundledConpty in isterm/pty.ts).

import { useBundledConpty } from "../../isterm/pty.js";

test("Windows 11 uses the system ConPTY, which repaints the screen after a resize", () => {
  expect(useBundledConpty("win32", "10.0.22000", undefined)).toBe(false);
  expect(useBundledConpty("win32", "10.0.26100", undefined)).toBe(false);
  expect(useBundledConpty("win32", "10.0.26200", undefined)).toBe(false);
});

test("older Windows 10 builds keep the conpty.dll bundled with node-pty", () => {
  expect(useBundledConpty("win32", "10.0.19045", undefined)).toBe(true);
  expect(useBundledConpty("win32", "10.0.21999", undefined)).toBe(true);
  expect(useBundledConpty("win32", "unexpected", undefined)).toBe(true);
});

test("FIGWIN_CONPTY overrides the choice", () => {
  expect(useBundledConpty("win32", "10.0.26200", "bundled")).toBe(true);
  expect(useBundledConpty("win32", "10.0.19045", "system")).toBe(false);
  expect(useBundledConpty("win32", "10.0.26200", "other")).toBe(false);
});

test("other platforms are unaffected (node-pty ignores the option there)", () => {
  expect(useBundledConpty("darwin", "25.6.0", "system")).toBe(true);
  expect(useBundledConpty("linux", "6.8.0", undefined)).toBe(true);
});
