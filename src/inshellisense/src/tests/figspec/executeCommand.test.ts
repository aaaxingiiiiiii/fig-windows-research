/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-037：generator 命令的执行方式。Windows 上先直接执行（cross-spawn），找不到命令时才退回 Git Bash。
// Windows 专属的分支在这里通过临时模拟 process.platform 来检查控制流；真实效果需要在 Windows 上验证（docs/mvp-plan.md T-037）。

import { jest } from "@jest/globals";
import * as actualShell from "../../utils/shell.js";

// 隔离本机 Git Bash 安装状态，同时保留其余 shell 行为。
const gitBashPath = jest.fn<() => Promise<string>>();
jest.unstable_mockModule("../../utils/shell.js", () => ({ ...actualShell, gitBashPath }));
const { buildExecuteShellCommand } = await import("../../runtime/utils.js");

beforeEach(() => {
  gitBashPath.mockReset().mockRejectedValue(new Error("fixture: Git Bash unavailable"));
});

const originalPlatform = process.platform;
const setPlatform = (platform: NodeJS.Platform) => Object.defineProperty(process, "platform", { value: platform });

afterEach(() => setPlatform(originalPlatform));

const execute = buildExecuteShellCommand(5_000);

test("能找到的命令直接执行并返回输出", async () => {
  const output = await execute({ command: process.execPath, args: ["-e", "process.stdout.write('ok')"] });
  expect(output).toEqual({ status: 0, stderr: "", stdout: "ok" });
});

test("找不到的命令返回非零状态和空输出，不抛错", async () => {
  const output = await execute({ command: "fig-windows-research-no-such-command", args: [] });
  expect(output.stdout).toBe("");
  expect(output.status).not.toBe(0);
});

test("模拟 win32：能找到的命令直接执行，不经过 Git Bash", async () => {
  setPlatform("win32");
  const output = await execute({ command: process.execPath, args: ["-e", "process.stdout.write('native')"] });
  expect(output.stdout).toBe("native");
  expect(gitBashPath).not.toHaveBeenCalled();
});

test("模拟 win32：找不到的命令在没有 Git Bash 时返回空输出，不抛错", async () => {
  setPlatform("win32");
  const output = await execute({ command: "fig-windows-research-no-such-command", args: [] });
  expect(output.stdout).toBe("");
});

test("模拟 win32：bash 不按本机路径解析（避免进入 WSL），没有 Git Bash 时返回“找不到”", async () => {
  setPlatform("win32");
  const output = await execute({ command: "bash", args: ["-c", "echo native"] });
  expect(output.stdout).toBe("");
  expect(output.status).toBe(127);
  expect(gitBashPath).toHaveBeenCalledTimes(1);
});
