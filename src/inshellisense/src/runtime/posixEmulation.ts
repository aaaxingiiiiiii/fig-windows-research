/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-049：在 Windows 上用 Node 模拟 spec 中常用的 POSIX 命令，使这些 generator 不依赖 Git Bash。
// - 只模拟下面列出的固定用法；其他用法返回 undefined，交给原来的执行路径（直接执行，找不到时退回 Git Bash）。
// - 管道中的原生命令（git、npm、cargo、make）照常执行，只把 sed、grep、awk、cut 等文本处理改成 JS。
// - 用法的来源见仓库根目录的 research/spec-compat.md；每条 bash 脚本在 spec 包中的出处由 posixEmulation.test.ts 检查。

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type Output = Fig.ExecuteCommandOutput;

/** 执行一条原生命令，走与 generator 相同的执行路径。 */
export type RunNative = (command: string, args: string[]) => Promise<Output>;

const ok = (stdout: string): Output => ({ status: 0, stdout, stderr: "" });

const joinLines = (items: string[]): string => items.map((item) => `${item}\n`).join("");

const splitLines = (text: string): string[] => {
  const result = text.split(/\r?\n/);
  if (result.at(-1) === "") result.pop();
  return result;
};

const notFound = (tool: string, target: string, status: number): Output => ({
  status,
  stdout: "",
  stderr: `${tool}: ${target}: No such file or directory\n`,
});

// ---- ls ----

type ListOptions = { all: boolean; slash: boolean; followLinks: boolean };

const isDirectory = async (dir: string, entry: Dirent, followLinks: boolean): Promise<boolean> => {
  if (entry.isDirectory()) return true;
  if (!followLinks || !entry.isSymbolicLink()) return false;
  try {
    return (await fs.stat(path.join(dir, entry.name))).isDirectory();
  } catch {
    return false; // 断开的链接按文件处理
  }
};

const listDirectory = async (dir: string, { all, slash, followLinks }: ListOptions): Promise<string[]> => {
  const entries = (await fs.readdir(dir, { withFileTypes: true })).filter((entry) => all || !entry.name.startsWith("."));
  const names = await Promise.all(entries.map(async (entry) => (slash && (await isDirectory(dir, entry, followLinks)) ? `${entry.name}/` : entry.name)));
  return names.sort();
};

const lsFlags = new Set(["1", "A", "p", "L"]);

/** `ls [-1ApL] [路径]`，最多一个路径。filepaths/folders helper（`@fig/autocomplete-generators`）使用 `ls -1ApL`。 */
const emulateLs = async (args: string[], cwd: string): Promise<Output | undefined> => {
  const isFlag = (arg: string) => arg.startsWith("-") && arg.length > 1;
  const letters = args.filter(isFlag).flatMap((flag) => [...flag.slice(1)]);
  const operands = args.filter((arg) => !isFlag(arg));
  if (letters.some((letter) => !lsFlags.has(letter)) || operands.length > 1) return undefined;
  const target = operands.at(0) ?? ".";
  const resolved = path.resolve(cwd, target);
  try {
    if (!(await fs.stat(resolved)).isDirectory()) return ok(`${target}\n`);
    return ok(joinLines(await listDirectory(resolved, { all: letters.includes("A"), slash: letters.includes("p"), followLinks: letters.includes("L") })));
  } catch {
    return { status: 2, stdout: "", stderr: `ls: cannot access '${target}': No such file or directory\n` };
  }
};

// ---- cat ----

/** `cat 文件...`，不支持选项和标准输入。npm、ssh、dotnet 等 spec 用它读取 package.json、known_hosts 等文件。 */
const emulateCat = async (args: string[], cwd: string): Promise<Output | undefined> => {
  if (args.length === 0 || args.some((arg) => arg.startsWith("-"))) return undefined;
  const result: Output = { status: 0, stdout: "", stderr: "" };
  for (const file of args) {
    try {
      result.stdout += await fs.readFile(path.resolve(cwd, file), "utf8");
    } catch {
      result.stderr += notFound("cat", file, 1).stderr;
      result.status = 1;
    }
  }
  return result;
};

// ---- grep ----

const grepFlags = new Set(["i", "E", "v", "q"]);
// 不带 -E 时是基本正则（BRE），这些字符的含义与 JS 正则不同
const breIncompatible = /[+?|(){}\\]/;

/** `grep [-iEvq] 模式 文件...`，必须给出文件。docker 用 `grep -iE FROM.*AS Dockerfile` 列出构建阶段。 */
const emulateGrep = async (args: string[], cwd: string): Promise<Output | undefined> => {
  let index = 0;
  const flags: string[] = [];
  while (index < args.length && args[index].startsWith("-") && args[index].length > 1) flags.push(...args[index++].slice(1));
  const [pattern, ...files] = args.slice(index);
  if (pattern == null || files.length === 0 || flags.some((flag) => !grepFlags.has(flag))) return undefined;
  if (!flags.includes("E") && breIncompatible.test(pattern)) return undefined;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags.includes("i") ? "i" : "");
  } catch {
    return undefined;
  }
  const invert = flags.includes("v");
  const quiet = flags.includes("q");
  const result: Output = { status: 1, stdout: "", stderr: "" };
  let failed = false;
  for (const file of files) {
    let text: string;
    try {
      text = await fs.readFile(path.resolve(cwd, file), "utf8");
    } catch {
      result.stderr += notFound("grep", file, 2).stderr;
      failed = true;
      continue;
    }
    for (const line of splitLines(text)) {
      if (regex.test(line) === invert) continue;
      result.status = 0;
      if (!quiet) result.stdout += files.length > 1 ? `${file}:${line}\n` : `${line}\n`;
    }
  }
  if (result.status !== 0 && failed) result.status = 2;
  return result;
};

// ---- bash -c 中的固定脚本 ----

/** 从 start 向上查找含有 name 的目录，对应 `until [[ -f name ]] || [[ $PWD = '/' ]]; do cd ..; done`。 */
const findUp = async (start: string, name: string, kind: "file" | "directory"): Promise<string | undefined> => {
  let dir = path.resolve(start);
  for (;;) {
    try {
      const stat = await fs.stat(path.join(dir, name));
      if (kind === "file" ? stat.isFile() : stat.isDirectory()) return dir;
    } catch {
      /* 继续向上 */
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
};

/** git：暂存或修改过的文件。`sed -n` 的两个 p 命令各自打印匹配的行，所以同时匹配两者的行会出现两次（与原脚本一致，postProcess 会去重）。 */
const gitStatusFilter =
  (first: RegExp) =>
  async (_cwd: string, run: RunNative): Promise<Output> => {
    const status = await run("git", ["--no-optional-locks", "status", "--short"]);
    const lines = splitLines(status.stdout).flatMap((line) => [first, /A /].filter((regex) => regex.test(line)).map(() => line));
    // 管道的退出码取最后一个命令（sed）的，所以总是 0
    return { status: 0, stdout: joinLines(lines), stderr: status.stderr };
  };

/** 向上找到含 name 的目录后输出该文件；找不到时与 bash 在根目录执行 cat 的结果相同。 */
const catFromAncestor = (name: string) => async (cwd: string) => {
  const dir = await findUp(cwd, name, "file");
  return dir == null ? notFound("cat", name, 1) : ok(await fs.readFile(path.join(dir, name), "utf8"));
};

// npm、pnpm 在 Windows 上为每个命令生成 foo、foo.cmd、foo.ps1 等多个启动器；补全时只需要一个名字
const windowsLauncherExtension = /\.(cmd|ps1|bat|exe)$/i;

const knownScripts: Record<string, (cwd: string, run: RunNative) => Promise<Output>> = {
  // git、hub、pre-commit、turbo、vsce
  "git --no-optional-locks status --short | sed -ne '/^M /p' -e '/A /p'": gitStatusFilter(/^M /),
  "git --no-optional-locks status --short | sed -ne '/M /p' -e '/A /p'": gitStatusFilter(/M /),
  // npm、yarn、pnpm、bun 等：最近的 package.json
  "until [[ -f package.json ]] || [[ $PWD = '/' ]]; do cd ..; done; cat package.json": catFromAncestor("package.json"),
  "until [[ -f rush.json ]] || [[ $PWD = '/' ]]; do cd ..; done; cat rush.json": catFromAncestor("rush.json"),
  "until [[ ( -f turbo.json || $PWD = '/' ) ]]; do cd ..; done; cat turbo.json": catFromAncestor("turbo.json"),
  // npx、pnpm、yarn、bun 等：最近的 node_modules/.bin 中的命令
  "until [[ -d node_modules/ ]] || [[ $PWD = '/' ]]; do cd ..; done; ls -1 node_modules/.bin/": async (cwd) => {
    const dir = await findUp(cwd, "node_modules", "directory");
    if (dir == null) return { status: 2, stdout: "", stderr: "ls: cannot access 'node_modules/.bin/': No such file or directory\n" };
    try {
      const names = await listDirectory(path.join(dir, "node_modules", ".bin"), { all: false, slash: false, followLinks: false });
      return ok(joinLines([...new Set(names.map((name) => name.replace(windowsLauncherExtension, "")))]));
    } catch {
      return { status: 2, stdout: "", stderr: "ls: cannot access 'node_modules/.bin/': No such file or directory\n" };
    }
  },
  // npm、yarn 等：全局安装的包
  "ls -1 `npm root -g`": async (cwd, run) => {
    const root = (await run("npm", ["root", "-g"])).stdout.trim();
    return root.length === 0 ? { status: 2, stdout: "", stderr: "npm root -g: no output\n" } : ((await emulateLs(["-1"], root)) as Output);
  },
  // cargo：已安装的二进制包
  "cargo install --list | \\grep -E \"^[a-zA-Z\\-]+\\sv\" | cut -d ' ' -f 1": async (_cwd, run) => {
    const list = await run("cargo", ["install", "--list"]);
    const names = splitLines(list.stdout)
      .filter((line) => /^[a-zA-Z-]+\sv/.test(line))
      .map((line) => line.split(" ")[0]);
    return { status: 0, stdout: joinLines(names), stderr: list.stderr };
  },
  // make：Makefile 中的目标。awk 按 ':' 取第一段再按空格拆分；空字符串不输出（原脚本会输出空行）
  "make -qp | awk -F':' '/^[a-zA-Z0-9][^$#\\/\\t=]*:([^=]|$)/ {split($1,A,/ /);for(i in A)print A[i]}' | sort -u": async (_cwd, run) => {
    const database = await run("make", ["-qp"]);
    const targets = new Set<string>();
    for (const line of splitLines(database.stdout)) {
      if (!/^[a-zA-Z0-9][^$#/\t=]*:([^=]|$)/.test(line)) continue;
      for (const target of line.split(":")[0].split(" ")) if (target.length > 0) targets.add(target);
    }
    return { status: 0, stdout: joinLines([...targets].sort()), stderr: database.stderr };
  },
};

/** 已知脚本的原文，供测试检查它们仍然出现在 spec 包中。 */
export const knownScriptTexts = Object.keys(knownScripts);

/**
 * 能模拟时返回结果，否则返回 undefined。调用方只在 Windows 上使用。
 * run 用来执行管道中的原生命令（git、npm 等）。
 */
export const emulatePosixCommand = async (command: string, args: string[], cwd: string, run: RunNative): Promise<Output | undefined> => {
  switch (command) {
    case "ls":
      return emulateLs(args, cwd);
    case "cat":
      return emulateCat(args, cwd);
    case "grep":
      return emulateGrep(args, cwd);
    case "bash":
    case "sh": {
      const script = args.length === 2 && args[0] === "-c" ? knownScripts[args[1]] : undefined;
      return script?.(cwd, run);
    }
    default:
      return undefined;
  }
};

/**
 * generator 上下文中的环境变量。Windows 上通常没有 HOME，而 spec 按 POSIX 习惯用它定位用户目录
 * （例如 ssh 读取 `${HOME}/.ssh/known_hosts` 和 `~/.ssh/config`），缺少时补上用户目录。只影响 generator 上下文，不影响子进程。
 */
export const withPosixHome = (env: Record<string, string>): Record<string, string> =>
  process.platform === "win32" && env.HOME == null ? { ...env, HOME: os.homedir() } : env;
