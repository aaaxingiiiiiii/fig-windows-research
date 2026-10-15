/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-051：custom generator 执行命令时，默认目录和输出清理与 Fig 一致（F-032）。
// Fig 的依据：figterm 在没有给出目录时使用终端的当前目录；executeCommand 会清理输出（CRLF 换成 LF，去掉首尾的空行）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { executeGenerator } from "../../runtime/generator.js";
import { getSuggestions } from "../../runtime/runtime.js";
import { Shell } from "../../utils/shell.js";
import { unpackResources } from "../../utils/node.js";

let root = "";

beforeAll(async () => {
  await unpackResources();
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "custom-generator-")));
});

afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

/** 一个 custom generator：执行 node 脚本，把输出原样作为候选名称返回。 */
const echoGenerator = (script: string, cwd?: string): Fig.Generator => ({
  custom: async (_tokens, executeShellCommand) => {
    const { stdout } = await executeShellCommand({ command: process.execPath, args: ["-e", script], cwd });
    return [{ name: stdout }];
  },
});

test("没有给出目录时，在 generator 的目录中执行（不是 inshellisense 进程的目录）", async () => {
  const dir = path.join(root, "work");
  fs.mkdirSync(dir);
  const [suggestion] = await executeGenerator(echoGenerator("process.stdout.write(process.cwd())"), [], dir);
  expect(suggestion.name).toBe(dir);
});

test("给出目录时，使用给出的目录", async () => {
  const other = path.join(root, "other");
  fs.mkdirSync(other);
  const [suggestion] = await executeGenerator(echoGenerator("process.stdout.write(process.cwd())", other), [], root);
  expect(suggestion.name).toBe(other);
});

test("输出被清理：CRLF 换成 LF，去掉首尾的空行，保留行内空白", async () => {
  const script = String.raw`process.stdout.write("\r\n\n  a\r\nb  \r\n\n")`;
  const [suggestion] = await executeGenerator(echoGenerator(script), [], root);
  expect(suggestion.name).toBe("  a\nb  ");
});

test("npm 的 workspaces 候选：先执行 `npm prefix`，再读取它输出的目录中的 package.json", async () => {
  const project = path.join(root, "project");
  fs.mkdirSync(project);
  fs.writeFileSync(path.join(project, "package.json"), JSON.stringify({ name: "demo", private: true, workspaces: ["packages/a", "packages/b"] }));
  const suggestions = (await getSuggestions("npm run -w ", project, Shell.Bash))?.suggestions.map((s) => s.name) ?? [];
  expect(suggestions).toEqual(expect.arrayContaining(["packages/a", "packages/b"]));
});
