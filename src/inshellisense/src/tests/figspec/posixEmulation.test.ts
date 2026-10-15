/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-049：Windows 上用 Node 模拟 spec 中的 POSIX 命令。
// 前半部分直接检查模拟结果；后半部分临时模拟 process.platform 为 win32，经 getSuggestions 检查真实 spec 能给出候选。
// 在 Mac 上模拟 win32 时找不到 Git Bash，所以 bash 脚本只有经过模拟才能得到结果。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { emulatePosixCommand, knownScriptTexts, withPosixHome, type RunNative } from "../../runtime/posixEmulation.js";
import { getSuggestions } from "../../runtime/runtime.js";
import { Shell } from "../../utils/shell.js";
import { unpackResources } from "../../utils/node.js";

const originalPlatform = process.platform;
const setPlatform = (platform: NodeJS.Platform) => Object.defineProperty(process, "platform", { value: platform });

let root = "";
const makeDir = (...parts: string[]) => {
  const dir = path.join(root, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const writeFile = (content: string, ...parts: string[]) => {
  makeDir(...parts.slice(0, -1));
  fs.writeFileSync(path.join(root, ...parts), content);
};

beforeAll(async () => {
  await unpackResources();
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "posix-emulation-")));
});

afterAll(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

afterEach(() => setPlatform(originalPlatform));

/** 假的原生命令：按“命令 参数”返回固定输出，并记录调用。 */
const fakeRun = (outputs: Record<string, string>) => {
  const calls: string[] = [];
  const run: RunNative = async (command, args) => {
    const key = [command, ...args].join(" ");
    calls.push(key);
    return { status: 0, stdout: outputs[key] ?? "", stderr: "" };
  };
  return { run, calls };
};
const noNative: RunNative = async (command) => {
  throw new Error(`unexpected native command ${command}`);
};
const emulate = (command: string, args: string[], cwd: string, run: RunNative = noNative) => emulatePosixCommand(command, args, cwd, run);
const bash = (script: string, cwd: string, run: RunNative = noNative) => emulate("bash", ["-c", script], cwd, run);

describe("ls", () => {
  test("`ls -1ApL` 列出文件和文件夹（含点文件），文件夹带 /，跟随指向文件夹的链接", async () => {
    const dir = makeDir("ls-a");
    writeFile("", "ls-a", "b.txt");
    writeFile("", "ls-a", ".env");
    makeDir("ls-a", "src");
    // Windows 使用无需管理员权限的目录 junction，仍验证链接跟随行为。
    fs.symlinkSync(path.join(dir, "src"), path.join(dir, "link"), originalPlatform === "win32" ? "junction" : "dir");
    expect(await emulate("ls", ["-1ApL"], dir)).toEqual({ status: 0, stdout: ".env\nb.txt\nlink/\nsrc/\n", stderr: "" });
  });

  test("`ls -1 目录` 不列出点文件，不加 /", async () => {
    makeDir("ls-b", "pkg");
    writeFile("", "ls-b", ".hidden");
    expect((await emulate("ls", ["-1", "ls-b"], root))?.stdout).toBe("pkg\n");
  });

  test("目标不存在时返回状态码 2", async () => {
    expect((await emulate("ls", ["-1", "no-such-dir"], root))?.status).toBe(2);
  });

  test("不支持的选项不模拟", async () => {
    expect(await emulate("ls", ["-la"], root)).toBeUndefined();
    expect(await emulate("ls", ["-1", "a", "b"], root)).toBeUndefined();
  });
});

describe("cat 和 grep", () => {
  test("cat 依次输出多个文件；缺少的文件记入 stderr，状态码 1", async () => {
    writeFile("one\n", "cat", "a");
    writeFile("two\n", "cat", "b");
    const result = await emulate("cat", ["a", "missing", "b"], path.join(root, "cat"));
    expect(result).toMatchObject({ status: 1, stdout: "one\ntwo\n" });
    expect(result?.stderr).toContain("missing");
  });

  test("docker 的 `grep -iE FROM.*AS Dockerfile` 列出构建阶段", async () => {
    writeFile("FROM node:22 AS build\r\nRUN x\r\nfrom alpine as runtime\r\n", "docker", "Dockerfile");
    expect(await emulate("grep", ["-iE", "FROM.*AS", "Dockerfile"], path.join(root, "docker"))).toEqual({
      status: 0,
      stdout: "FROM node:22 AS build\nfrom alpine as runtime\n",
      stderr: "",
    });
  });

  test("grep 没有匹配时状态码 1，文件不存在时状态码 2", async () => {
    expect((await emulate("grep", ["-E", "nomatch", "Dockerfile"], path.join(root, "docker")))?.status).toBe(1);
    expect((await emulate("grep", ["x", "missing"], root))?.status).toBe(2);
  });

  test("不能可靠模拟的用法不模拟：标准输入、未知选项、基本正则中的特殊字符", async () => {
    expect(await emulate("cat", [], root)).toBeUndefined();
    expect(await emulate("cat", ["-s", "a"], root)).toBeUndefined();
    expect(await emulate("grep", ["-r", "x", "."], root)).toBeUndefined();
    expect(await emulate("grep", ["a|b", "file"], root)).toBeUndefined();
  });
});

describe("bash -c 中的固定脚本", () => {
  const gitStatus = "M  staged.ts\n M unstaged.ts\nMM both.ts\nA  added.ts\n?? new.ts\n";

  test("git：`--staged` 时只取暂存区的修改和新增", async () => {
    const { run, calls } = fakeRun({ "git --no-optional-locks status --short": gitStatus });
    const result = await bash("git --no-optional-locks status --short | sed -ne '/^M /p' -e '/A /p'", root, run);
    expect(calls).toEqual(["git --no-optional-locks status --short"]);
    expect(result?.stdout).toBe("M  staged.ts\nA  added.ts\n");
  });

  test("git：不带 `--staged` 时取所有修改和新增", async () => {
    const { run } = fakeRun({ "git --no-optional-locks status --short": gitStatus });
    const result = await bash("git --no-optional-locks status --short | sed -ne '/M /p' -e '/A /p'", root, run);
    expect(result?.stdout).toBe("M  staged.ts\n M unstaged.ts\nMM both.ts\nA  added.ts\n");
  });

  test("向上查找最近的 package.json；找不到时状态码 1", async () => {
    writeFile('{"scripts":{}}', "up", "package.json");
    const nested = makeDir("up", "a", "b");
    expect(await bash("until [[ -f package.json ]] || [[ $PWD = '/' ]]; do cd ..; done; cat package.json", nested)).toEqual({
      status: 0,
      stdout: '{"scripts":{}}',
      stderr: "",
    });
    expect((await bash("until [[ ( -f turbo.json || $PWD = '/' ) ]]; do cd ..; done; cat turbo.json", nested))?.status).toBe(1);
  });

  test("node_modules/.bin：同一命令的多个 Windows 启动器只保留一个名字", async () => {
    for (const name of ["eslint", "eslint.cmd", "eslint.ps1", "tsc", "tsc.CMD"]) writeFile("", "bin", "node_modules", ".bin", name);
    const nested = makeDir("bin", "src");
    const result = await bash("until [[ -d node_modules/ ]] || [[ $PWD = '/' ]]; do cd ..; done; ls -1 node_modules/.bin/", nested);
    expect(result?.stdout).toBe("eslint\ntsc\n");
  });

  test("全局包：先执行 `npm root -g`，再列出该目录", async () => {
    makeDir("global", "typescript");
    makeDir("global", "@scope");
    const { run } = fakeRun({ "npm root -g": `${path.join(root, "global")}\r\n` });
    expect((await bash("ls -1 `npm root -g`", root, run))?.stdout).toBe("@scope\ntypescript\n");
  });

  test("cargo：已安装的二进制包名", async () => {
    const { run } = fakeRun({ "cargo install --list": "ripgrep v14.1.0:\n    rg\ncargo-edit v0.12.2:\n    cargo-add\n" });
    const result = await bash("cargo install --list | \\grep -E \"^[a-zA-Z\\-]+\\sv\" | cut -d ' ' -f 1", root, run);
    expect(result?.stdout).toBe("ripgrep\ncargo-edit\n");
  });

  test("make：Makefile 中的目标，去重并排序", async () => {
    const database = "# comment\nbuild test: deps\nclean:\nVAR := 1\n.PHONY: build\nbuild: other\n\tcommand\n";
    const { run } = fakeRun({ "make -qp": database });
    const script = "make -qp | awk -F':' '/^[a-zA-Z0-9][^$#\\/\\t=]*:([^=]|$)/ {split($1,A,/ /);for(i in A)print A[i]}' | sort -u";
    expect((await bash(script, root, run))?.stdout).toBe("build\nclean\ntest\n");
  });

  test("未登记的脚本不模拟", async () => {
    expect(await bash("echo hi | tr a-z A-Z", root)).toBeUndefined();
    expect(await emulate("bash", ["script.sh"], root)).toBeUndefined();
  });

  // spec 包升级后脚本原文可能改变，导致模拟不再生效。这里检查每条脚本仍然出现在对应的 spec 中。
  test.each([
    ["git.js", 0],
    ["git.js", 1],
    ["npm.js", 2],
    ["rush.js", 3],
    ["turbo.js", 4],
    ["npx.js", 5],
    ["npm.js", 6],
    ["cargo.js", 7],
    ["make.js", 8],
  ])("脚本原文仍出现在 spec 包的 %s 中（第 %i 条）", (file, index) => {
    const source = fs.readFileSync(path.join("node_modules", "@withfig", "autocomplete", "build", file), "utf8");
    const literal = JSON.stringify(knownScriptTexts[index]).slice(1, -1);
    expect(source.includes(literal) || source.includes(literal.replaceAll('\\"', '"'))).toBe(true);
  });

  test("每条脚本都有出处检查", () => {
    expect(knownScriptTexts).toHaveLength(9);
  });
});

describe("HOME", () => {
  test("模拟 win32：没有 HOME 时补上用户目录；已有时不改", () => {
    setPlatform("win32");
    expect(withPosixHome({ PATH: "x" }).HOME).toBe(os.homedir());
    expect(withPosixHome({ HOME: "/custom" }).HOME).toBe("/custom");
  });

  test.each(["darwin", "linux"] as const)("%s 平台不改", (platform) => {
    setPlatform(platform);
    expect(withPosixHome({ PATH: "x" })).toEqual({ PATH: "x" });
  });
});

describe("模拟 win32，经真实 spec 得到候选", () => {
  const names = async (command: string, cwd: string) => (await getSuggestions(command, cwd, Shell.Pwsh))?.suggestions.map((s) => s.name) ?? [];

  test("node：filepaths helper（`ls -1ApL`）列出 .js 文件和文件夹，即使 PATH 中没有 ls", async () => {
    const dir = makeDir("helper");
    writeFile("", "helper", "app.js");
    writeFile("", "helper", "notes.txt");
    makeDir("helper", "lib");
    const originalPath = process.env.PATH;
    setPlatform("win32");
    process.env.PATH = "";
    try {
      const result = await names("node ", dir);
      expect(result).toEqual(expect.arrayContaining(["app.js", "lib"]));
      expect(result).not.toContain("notes.txt");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  test("git diff：git 直接执行，sed 由 JS 代替；`--staged` 时只列出暂存区的文件", async () => {
    const dir = makeDir("repo");
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd: dir });
    git("init", "-q");
    fs.writeFileSync(path.join(dir, "tracked.txt"), "x");
    git("add", "tracked.txt");
    git("commit", "-q", "-m", "init");
    fs.writeFileSync(path.join(dir, "tracked.txt"), "changed");
    fs.writeFileSync(path.join(dir, "added.txt"), "x");
    fs.writeFileSync(path.join(dir, "untracked.txt"), "x");
    git("add", "added.txt");
    setPlatform("win32");
    // 参数还有分支、提交等候选，只看这个 generator 给出的（说明为 "Changed tracked files"）
    const changed = async (command: string) =>
      (await getSuggestions(command, dir, Shell.Pwsh))?.suggestions
        .filter((s) => s.description === "Changed tracked files")
        .map((s) => s.name)
        .sort();
    expect(await changed("git diff ")).toEqual(["added.txt", "tracked.txt"]);
    expect(await changed("git diff --staged ")).toEqual(["added.txt"]);
  });

  test("npm run：在子目录中也能读到上层 package.json 的 scripts", async () => {
    writeFile(JSON.stringify({ scripts: { build: "tsc", "test:unit": "jest" } }), "npmproj", "package.json");
    const nested = makeDir("npmproj", "src", "deep");
    setPlatform("win32");
    expect(await names("npm run ", nested)).toEqual(expect.arrayContaining(["build", "test:unit"]));
  });
});
