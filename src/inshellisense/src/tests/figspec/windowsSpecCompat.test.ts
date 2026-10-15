/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.

import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { jest } from "@jest/globals";

const nativeCalls: { command: string; args: string[] }[] = [];
const crossSpawn = jest.fn((command: string, args: string[]) => {
  nativeCalls.push({ command, args });
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => true });
  queueMicrotask(() => {
    child.stdout.emit("data", '{"nameWithOwner":"fixture/repo","description":"test","isPrivate":false}\r\n');
    child.emit("close", 0);
  });
  return child;
});
jest.unstable_mockModule("cross-spawn", () => ({ default: crossSpawn }));
const readDirectory = jest.fn(async () => [{ name: "fixture.txt", isFile: () => true, isDirectory: () => false }]);
jest.unstable_mockModule("../../runtime/templateCache.js", () => ({ readDirectory }));
const { executeGenerator } = await import("../../runtime/generator.js");
const { getSuggestions, clearTransientSuggestionState } = await import("../../runtime/runtime.js");
const { getArgDrivenRecommendation } = await import("../../runtime/suggestion.js");
const { parseCommand } = await import("../../runtime/parser.js");
const { buildExecuteShellCommand } = await import("../../runtime/utils.js");
const { unpackResources } = await import("../../utils/node.js");
const { Shell } = await import("../../utils/shell.js");

const originalPlatform = process.platform;
let root: string;
beforeAll(async () => {
  await unpackResources();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "windows-spec-"));
});
beforeEach(() => {
  Object.defineProperty(process, "platform", { value: "win32" });
  nativeCalls.length = 0;
  readDirectory.mockClear();
  clearTransientSuggestionState();
});
afterEach(() => Object.defineProperty(process, "platform", { value: originalPlatform }));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

// Read the locked package's actual generator, so an upstream change cannot silently bypass this test.
const findGraphql = (value: unknown): Fig.Generator | undefined => {
  if (value == null || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  if (Array.isArray(object.script) && object.script[0] === "gh" && object.script[2] === "graphql") return object as Fig.Generator;
  for (const child of Object.values(object)) {
    const found = findGraphql(child);
    if (found) return found;
  }
};

test("gh actual GraphQL generator passes raw query argv, preserving $variables and inner quotes", async () => {
  const spec = (await import(pathToFileURL(path.resolve("node_modules/@withfig/autocomplete/build/gh.js")).href)).default;
  const generator = findGraphql(spec);
  expect(generator).toBeDefined();
  const suggestions = await executeGenerator(generator!, ["gh", "repo", "clone"], root);
  const query = nativeCalls[0].args.find((arg) => arg.startsWith("query="))!;
  expect(query.startsWith("query=query(")).toBe(true);
  expect(query.endsWith("'")).toBe(false);
  expect(query).toContain("$endCursor");
  expect(suggestions.map((s) => s.name)).toContain("fixture/repo");
  expect(nativeCalls).toHaveLength(1);
});

test("gh normalization does not strip quotes from unrelated argv", async () => {
  const args = ["api", "graphql", "-f", "query={viewer{login}}", "-f", "label='literal'", "--jq", '.data["viewer"]'];
  await buildExecuteShellCommand(1000)({ command: "gh", args, cwd: root });
  expect(nativeCalls[0].args).toEqual(args);
  await buildExecuteShellCommand(1000)({ command: "another-cli", args: ["query='literal'"], cwd: root });
  expect(nativeCalls[1].args).toEqual(["query='literal'"]);
});

const scpSuggestions = async (token: string, pathComplete = false) => {
  const tokens = parseCommand(`scp ${token}`, Shell.Pwsh);
  const partial = tokens.at(-1)!;
  if (pathComplete) {
    partial.isPath = true;
    partial.isPathComplete = true;
  }
  return getArgDrivenRecommendation(
    [{ name: "sources", generators: { template: ["filepaths", "folders"] } }],
    { name: "scp" },
    [],
    partial,
    [tokens[0]],
    tokens,
    false,
    root,
    Shell.Pwsh,
  );
};

test.each(["host:path", "user@host:/path", "user@[2001:db8::1]:/path", "scp://host/path"])("scp %s must not query local files", async (token) => {
  expect((await scpSuggestions(token))?.suggestions ?? []).toEqual([]);
  expect(readDirectory).not.toHaveBeenCalled();
});

test.each(["C:/", "C:\\", "C:relative", "\\\\server\\share\\", "./local:name", "folder/name:part"])("scp %s stays on the local path", async (token) => {
  const result = await scpSuggestions(token, true);
  expect(result?.suggestions.map((s) => s.name)).toContain("fixture.txt");
  expect(readDirectory).toHaveBeenCalled();
});

test("scp completed remote source does not suppress the following local operand", async () => {
  const tokens = parseCommand("scp host:path ", Shell.Pwsh);
  const result = await getArgDrivenRecommendation(
    [{ name: "sources", generators: { template: "filepaths" } }],
    { name: "scp" },
    [],
    undefined,
    tokens,
    tokens,
    true,
    root,
    Shell.Pwsh,
  );
  expect(result?.suggestions.map((s) => s.name)).toContain("fixture.txt");
});

test("dotnet reads launchSettings relative to each shell cwd (spaces, Unicode and CRLF)", async () => {
  for (const [dir, profile] of [
    ["项目 one", "FixtureOne"],
    ["project two", "FixtureTwo"],
  ]) {
    const cwd = path.join(root, dir);
    fs.mkdirSync(path.join(cwd, "Properties"), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, "Properties", "launchSettings.json"),
      JSON.stringify({ profiles: { [profile]: { commandName: "Project" } } }, null, 2).replaceAll("\n", "\r\n"),
    );
    const names = (await getSuggestions("dotnet run --launch-profile ", cwd, Shell.Pwsh))?.suggestions.map((s) => s.name) ?? [];
    expect(names).toContain(profile);
    expect(names).not.toContain(profile === "FixtureOne" ? "FixtureTwo" : "FixtureOne");
  }
  expect(nativeCalls).toEqual([]);
});

test("dotnet missing launchSettings retains static launch profiles", async () => {
  const names = (await getSuggestions("dotnet run --launch-profile ", root, Shell.Pwsh))?.suggestions.map((s) => s.name) ?? [];
  expect(names).toEqual(expect.arrayContaining(["Development", "Staging", "Production"]));
  expect(nativeCalls).toEqual([]);
});

test("gh removes only the query's shell wrapper, keeping embedded literals intact", async () => {
  const query = `query($name: String) { repository(name: "O'Reilly", owner: $name) { id } }`;
  const args = ["api", "graphql", "--raw-field", `query='${query}'`, "--jq", '.data["repository"]'];
  await buildExecuteShellCommand(1000)({ command: "gh.exe", args, cwd: root });
  expect(nativeCalls[0].args).toEqual(["api", "graphql", "--raw-field", `query=${query}`, "--jq", '.data["repository"]']);
  expect(args[3]).toBe(`query='${query}'`);
});
