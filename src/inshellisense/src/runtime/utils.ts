// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import path from "node:path";
import { spawn } from "node:child_process";
import crossSpawn from "cross-spawn";
import fsAsync from "node:fs/promises";
import { homedir } from "node:os";

import { CommandToken } from "./parser.js";
import { getPathSeparator, gitBashPath, Shell } from "../utils/shell.js";
import log from "../utils/log.js";
import { emulatePosixCommand } from "./posixEmulation.js";
import { nativeGhArgs } from "./windowsSpecCompat.js";

export type ExecuteShellCommandTTYResult = {
  code: number | null;
};

const getExecutionShell = async (): Promise<undefined | string> => {
  if (process.platform !== "win32") return;
  try {
    return await gitBashPath();
  } catch (e) {
    log.debug({ msg: "failed to load posix shell for windows child_process.spawn, some generators might fail", error: e });
  }
};

const bashSpecialCharacters = /[&|<>\s]/g;
// escape whitespace & special characters in an argument when not quoted
const shouldEscapeArg = (arg: string) => {
  const hasSpecialCharacter = bashSpecialCharacters.test(arg);
  const isSingleCharacter = arg.length === 1;
  return hasSpecialCharacter && !isSingleCharacter && !isQuoted(arg, `"`);
};

/* based on libuv process.c used by nodejs, only quotes are escaped for shells. if using git bash need to escape whitespace & special characters in an argument */
const escapeArgs = (shell: string | undefined, args: string[]) => {
  // only escape args for git bash
  if (process.platform !== "win32" || shell == undefined) return args;
  return args.map((arg) => (shouldEscapeArg(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg));
};

type QuoteChar = `"` | `'` | "`";

const isQuoted = (value: string | undefined, quoteChar: QuoteChar): boolean => (value?.startsWith(quoteChar) && value?.endsWith(quoteChar)) ?? false;

const isPowerShell = (shell: Shell): boolean => shell == Shell.Pwsh || shell == Shell.Powershell;

// characters that PowerShell interprets in argument mode; '@' and '#' only matter at the start of an argument
const pwshSpecialCharacters = /[\s'"`$&|;,(){}<>]|^[@#]/;

const quoteString = (value: string, quoteChar: QuoteChar, shell: Shell): string => {
  if (isQuoted(value, quoteChar)) return value;
  // PowerShell single-quoted strings are literal; an embedded single quote is written as two single quotes
  if (isPowerShell(shell)) return `'${value.replaceAll("'", "''")}'`;
  const escapedValue = value.replaceAll(`\\${quoteChar}`, quoteChar).replaceAll(quoteChar, `\\${quoteChar}`);
  return `${quoteChar}${escapedValue}${quoteChar}`;
};

const needsQuoted = (value: string, quoteChar: QuoteChar, shell: Shell): boolean =>
  isQuoted(value, quoteChar) || (isPowerShell(shell) ? pwshSpecialCharacters.test(value) : value.includes(" "));

const getShellQuoteChar = (shell: Shell): QuoteChar => {
  switch (shell) {
    case Shell.Zsh:
    case Shell.Bash:
    case Shell.Fish:
      return `"`;
    case Shell.Xonsh:
      return `'`;
    case Shell.Nushell:
      return "`";
    case Shell.Pwsh:
    case Shell.Powershell:
      return `'`;
    case Shell.Cmd:
      return `"`;
  }
};

export const getShellWhitespaceEscapeChar = (shell: Shell): string => {
  switch (shell) {
    case Shell.Zsh:
    case Shell.Bash:
    case Shell.Fish:
    case Shell.Xonsh:
    case Shell.Nushell:
      return "\\";
    case Shell.Pwsh:
    case Shell.Powershell:
      return "`";
    case Shell.Cmd:
      return "^";
  }
};

export const escapePath = (value: string | undefined, shell: Shell): string | undefined =>
  value != null && needsQuoted(value, getShellQuoteChar(shell), shell) ? quoteString(value, getShellQuoteChar(shell), shell) : value;

type ProcessResult = Fig.ExecuteCommandOutput & { notFound: boolean };

type ProcessOptions = { cwd?: string; env: NodeJS.ProcessEnv; signal?: AbortSignal; shell?: string };

const runProcess = (command: string, args: string[], options: ProcessOptions, timeout: number): Promise<ProcessResult> => {
  const { shell, ...spawnOptions } = options;
  // On Windows, cross-spawn resolves PATHEXT and runs .cmd/.bat shims (e.g. npm.cmd) with correct escaping, without a shell.
  const child =
    shell != null
      ? spawn(command, escapeArgs(shell, args), { ...spawnOptions, shell })
      : process.platform === "win32"
      ? crossSpawn(command, args, spawnOptions)
      : spawn(command, args, spawnOptions);
  const killTimeout = setTimeout(() => child.kill("SIGKILL"), timeout);
  let stdout = "";
  let stderr = "";
  let notFound = false;
  child.stdout?.on("data", (data) => (stdout += data));
  child.stderr?.on("data", (data) => (stderr += data));
  child.on("error", (err: NodeJS.ErrnoException) => {
    notFound = err.code === "ENOENT";
    log.debug({ msg: "shell command failed", command, args, shell, e: err.message });
  });
  return new Promise((resolve) => {
    child.on("close", (code) => {
      clearTimeout(killTimeout);
      resolve({ status: code ?? 0, stderr, stdout, notFound });
    });
  });
};

// On Windows, a bare "bash"/"sh" would resolve to the WSL launcher in System32 and run inside WSL;
// generators that invoke them expect Git Bash, so they always go through the Git Bash path.
const posixShellCommands = new Set(["bash", "sh", "bash.exe", "sh.exe"]);

const toOutput = ({ status, stderr, stdout }: ProcessResult): Fig.ExecuteCommandOutput => ({ status, stderr, stdout });

export const buildExecuteShellCommand = (timeout: number, signal?: AbortSignal): Fig.ExecuteCommandFunction => {
  const execute = async ({ command, env, args, cwd }: Fig.ExecuteCommandInput): Promise<Fig.ExecuteCommandOutput> => {
    signal?.throwIfAborted();
    // Windows: common POSIX usages in specs (ls -1ApL, cat, grep, known bash -c pipelines) are emulated in node,
    // running only the native commands of a pipeline (git, npm, ...), so they work without Git Bash.
    if (process.platform === "win32") {
      const emulated = await emulatePosixCommand(command, args, cwd ?? process.cwd(), (nativeCommand, nativeArgs) =>
        execute({ command: nativeCommand, args: nativeArgs, cwd, env }),
      );
      if (emulated != null) {
        log.debug({ msg: "generator command emulated in node", command });
        return emulated;
      }
    }
    const options: ProcessOptions = { cwd, env: { ...process.env, ...env, ISTERM: "1" }, signal };
    const requiresPosixShell = process.platform === "win32" && posixShellCommands.has(command.toLowerCase());
    const nativeArgs = process.platform === "win32" ? nativeGhArgs(command, args) : args;
    const result = requiresPosixShell ? undefined : await runProcess(command, nativeArgs, options, timeout);
    if (result != null && (process.platform !== "win32" || !result.notFound)) {
      if (process.platform === "win32") log.debug({ msg: "generator command ran natively", command });
      return toOutput(result);
    }
    // Windows: only commands that cannot be found natively (e.g. POSIX tools such as grep) fall back to Git Bash, if installed.
    const executionShell = await getExecutionShell();
    if (executionShell == null) return result != null ? toOutput(result) : { status: 127, stderr: `${command}: git bash not found`, stdout: "" };
    signal?.throwIfAborted();
    log.debug({
      msg: requiresPosixShell ? "generator requires a posix shell, using git bash" : "generator command not found natively, falling back to git bash",
      command,
    });
    return toOutput(await runProcess(command, args, { ...options, shell: executionShell }, timeout));
  };
  return execute;
};

const isHomedir = (path: string) => path.startsWith("~");

export const resolveCwd = async (
  cmdToken: CommandToken | undefined,
  cwd: string,
  shell: Shell,
  signal?: AbortSignal,
): Promise<{ cwd: string; pathy: boolean; complete: boolean }> => {
  if (cmdToken == null || cmdToken.complete) return { cwd, pathy: false, complete: false };
  const { token: rawToken, isQuoted } = cmdToken;
  const sep = getPathSeparator(shell);
  const escapedToken = !isQuoted ? rawToken.replaceAll(" ", "\\ ") : rawToken;
  if (escapedToken === "~") return { cwd: homedir(), pathy: true, complete: false };
  if (escapedToken === `~${sep}`) return { cwd: homedir(), pathy: true, complete: true };
  if (!escapedToken.includes(sep)) return { cwd, pathy: false, complete: false };
  const tokenComplete = escapedToken.endsWith(sep);
  const trimmedToken = escapedToken.endsWith(sep) ? escapedToken : path.dirname(escapedToken);
  const token = trimmedToken;
  const resolvedCwd = path.isAbsolute(token) ? token : isHomedir(token) ? token.replace("~", homedir()) : path.join(cwd, token);
  try {
    signal?.throwIfAborted();
    await fsAsync.access(resolvedCwd, fsAsync.constants.R_OK);
    return { cwd: resolvedCwd, pathy: true, complete: tokenComplete };
  } catch {
    // fallback to the parent folder if possible
    const baselessCwd = resolvedCwd.substring(0, resolvedCwd.length - path.basename(resolvedCwd).length);
    try {
      signal?.throwIfAborted();
      await fsAsync.access(baselessCwd, fsAsync.constants.R_OK);
      return { cwd: baselessCwd, pathy: true, complete: tokenComplete };
    } catch {
      /*empty*/
    }
    return { cwd, pathy: false, complete: false };
  }
};
