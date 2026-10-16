// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-060: the default config written by the installer (installer/inshellisenserc.toml) must load as-is,
// and every commented-out setting must be valid and show the real default value once uncommented.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, loadConfig } from "../../utils/config.js";

// Windows checkouts have CRLF line endings
const template = fs
  .readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../installer/inshellisenserc.toml"), "utf8")
  .replaceAll("\r\n", "\n");
const uncommented = template.replace(/^# (\[[A-Za-z.]+\]|[A-Za-z]+ = )/gm, "$1");

const loadTemplate = async (text: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figwin-config-"));
  try {
    const file = path.join(dir, ".inshellisenserc");
    fs.writeFileSync(file, text);
    const errors: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await loadConfig({ error: (message: string) => errors.push(message) } as any, [file]);
    return { errors, config: structuredClone(getConfig()) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("every documented setting is uncommented by the test", () => {
  const settings = uncommented.split("\n").filter((line) => /^(\[|[A-Za-z]+ = )/.test(line));
  expect(settings).toEqual([
    "maxSuggestions = 5",
    'boxBorderStyle = "square"',
    'activeSuggestionBackgroundColor = "#7D56F4"',
    "useNerdFont = false",
    "[bindings.acceptSuggestion]",
    'key = "tab"',
    "[bindings.nextSuggestion]",
    'key = "down"',
    "[bindings.previousSuggestion]",
    'key = "up"',
    "[bindings.dismissSuggestions]",
    'key = "escape"',
    "[specs]",
    'path = ["D:\\\\my-specs"]',
  ]);
});

test("the installer's default config loads without changing any default", async () => {
  const defaults = await loadTemplate("");
  const asShipped = await loadTemplate(template);
  expect(asShipped.errors).toEqual([]);
  expect(asShipped.config).toEqual(defaults.config);
});

test("uncommented settings are valid and match the defaults", async () => {
  const defaults = await loadTemplate("");
  const { errors, config } = await loadTemplate(uncommented);
  expect(errors).toEqual([]);
  expect({ ...config, specs: undefined }).toEqual({ ...defaults.config, specs: undefined });
  expect(config.specs.path).toContain("D:\\my-specs");
});
