// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-064: PowerShell's own commands use PowerShell's native completion (runtime/powershellCompletion.ts).

import { jest } from "@jest/globals";
import which from "which";

import { getSuggestions } from "../../runtime/runtime.js";
import { parseCommand } from "../../runtime/parser.js";
import {
  type PowerShellBackend,
  PowerShellWorker,
  looksLikePowerShellCommandName,
  setPowerShellBackend,
  toSuggestionBlob,
} from "../../runtime/powershellCompletion.js";
import { Shell } from "../../utils/shell.js";

const lastToken = (line: string) => parseCommand(line, Shell.Pwsh).at(-1);

describe("toSuggestionBlob", () => {
  test("the replacement range must be exactly the word being typed", () => {
    const line = "Get-ChildItem -Pa";
    const blob = toSuggestionBlob(line, lastToken(line), {
      index: 14,
      length: 3,
      matches: [{ text: "-Path", list: "Path", type: "ParameterName", tip: "[string[]] Path" }],
    });
    expect(blob?.suggestions).toEqual([expect.objectContaining({ name: "-Path", insertValue: "-Path ", type: "option", description: "[string[]] Path" })]);
    expect(blob?.activeToken?.token).toBe("-Pa");
  });

  test("results for another range are dropped instead of inserting the wrong text", () => {
    const line = "Get-ChildItem -Pa";
    expect(toSuggestionBlob(line, lastToken(line), { index: 0, length: 17, matches: [{ text: "x", list: "x", type: "Text" }] })).toBeUndefined();
    expect(toSuggestionBlob(line, lastToken(line), { index: 15, length: 2, matches: [{ text: "Path", list: "Path", type: "ParameterName" }] })).toBeUndefined();
  });

  test("after a space nothing is replaced; folders get no trailing space", () => {
    const line = "Set-Location ";
    const blob = toSuggestionBlob(line, lastToken(line), { index: 13, length: 0, matches: [{ text: "./docs", list: "docs", type: "ProviderContainer" }] });
    expect(blob?.suggestions[0]).toEqual(expect.objectContaining({ name: "./docs", insertValue: "./docs", type: "folder" }));
    expect(blob?.activeToken).toBeUndefined();
  });

  test("empty results give no suggestions", () => {
    expect(toSuggestionBlob("git ch", lastToken("git ch"), { index: 4, length: 2, matches: [] })).toBeUndefined();
  });
});

test("command names are only sent to PowerShell when they look like Verb-Noun (short prefixes would scan the whole PATH)", () => {
  expect(["Get-", "Get-Ch", "set-loc"].map(looksLikePowerShellCommandName)).toEqual([true, true, true]);
  expect(["G", "Get", "gci", "-x", "1-2"].map(looksLikePowerShellCommandName)).toEqual([false, false, false, false, false]);
});

describe("routing in getSuggestions", () => {
  const fakeBackend = (kinds: Record<string, string>) => {
    const backend = {
      complete: jest.fn(async (line: string) => {
        if (line === "Get-Ch") return { index: 0, length: 6, matches: [{ text: "Get-ChildItem", list: "Get-ChildItem", type: "Command" }] };
        if (line === "ls -Fi") return { index: 3, length: 3, matches: [{ text: "-Filter", list: "Filter", type: "ParameterName" }] };
        return undefined;
      }),
      commandType: jest.fn(async (name: string) => kinds[name.toLowerCase()]),
    };
    setPowerShellBackend(backend as unknown as PowerShellBackend);
    return backend;
  };
  afterEach(() => setPowerShellBackend(undefined));

  test("a PowerShell command name that matches no Fig spec", async () => {
    fakeBackend({});
    const blob = await getSuggestions("Get-Ch", process.cwd(), Shell.Pwsh);
    expect(blob?.suggestions.map((s) => s.name)).toEqual(["Get-ChildItem"]);
  });

  test("an alias of a cmdlet (ls on Windows) uses PowerShell, not the Unix ls spec", async () => {
    const backend = fakeBackend({ ls: "Alias" });
    const blob = await getSuggestions("ls -Fi", process.cwd(), Shell.Pwsh);
    expect(blob?.suggestions.map((s) => s.name)).toEqual(["-Filter"]);
    expect(backend.complete).toHaveBeenCalledWith("ls -Fi", process.cwd(), undefined);
  });

  test("external programs with a Fig spec keep the spec", async () => {
    const backend = fakeBackend({ git: "Application" });
    const blob = await getSuggestions("git ch", process.cwd(), Shell.Pwsh);
    expect(blob?.suggestions.map((s) => s.name)).toEqual(expect.arrayContaining(["checkout", "cherry-pick"]));
    expect(backend.complete).not.toHaveBeenCalled();
  });

  test("a short command-name prefix does not ask PowerShell", async () => {
    const backend = fakeBackend({});
    await getSuggestions("Ge", process.cwd(), Shell.Pwsh);
    expect(backend.complete).not.toHaveBeenCalled();
  });

  test("other shells never ask PowerShell", async () => {
    const backend = fakeBackend({ ls: "Alias" });
    await getSuggestions("Get-Ch", process.cwd(), Shell.Bash);
    await getSuggestions("ls -", process.cwd(), Shell.Bash);
    expect(backend.complete).not.toHaveBeenCalled();
    expect(backend.commandType).not.toHaveBeenCalled();
  });
});

const pwsh = which.sync("pwsh", { nothrow: true });
const pwshTest = pwsh != null ? test : test.skip;

pwshTest(
  "the resident pwsh completes cmdlet parameters and reports command types",
  async () => {
    const worker = new PowerShellWorker(pwsh!);
    try {
      const result = await worker.complete("Get-ChildItem -Pa", process.cwd());
      expect(result).toEqual(expect.objectContaining({ index: 14, length: 3 }));
      expect(result?.matches.map((m) => m.text)).toContain("-Path");
      expect(await worker.commandType("Get-ChildItem")).toBe("Cmdlet");
      expect(await worker.commandType("definitely-not-a-command-xyz")).toBeUndefined();
    } finally {
      worker.dispose();
    }
  },
  30_000,
);

pwshTest(
  "a burst of requests (one per keystroke) does not pile up: queued ones are replaced and the latest still answers",
  async () => {
    const worker = new PowerShellWorker(pwsh!);
    try {
      const lines = ["Get-ChildItem -", "Get-ChildItem -P", "Get-ChildItem -Pa"];
      const results = await Promise.all([...lines, ...lines].map((line) => worker.complete(line, process.cwd())));
      // the first request is sent at once; the others wait, and each new one replaces the previous queued one
      expect(results.slice(1, -1).every((result) => result === undefined)).toBe(true);
      expect(results.at(-1)?.matches.map((m) => m.text)).toContain("-Path");
    } finally {
      worker.dispose();
    }
  },
  30_000,
);
