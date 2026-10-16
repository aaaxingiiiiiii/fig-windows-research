/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// 规格用例的自动化测试（T-038）。用例定义见仓库根目录的 specs/completion.md：
//   - C-xxx：第 8 节，来自 Fig 开源基线的行为；
//   - W-xxx：第 10 节，PowerShell（pwsh）规则。
// 约定：
//   - 与 Fig 只是“做法不同”的地方，断言 inshellisense 的实际行为，并在注释中标注“差异”，
//     差异清单见 specs/completion.md 第 9 节；
//   - 已知缺陷用 test.failing 写出正确的期望；修复后改为 test（T-039）。

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getSuggestions } from "../../runtime/runtime.js";
import { calculateReplacement } from "../../runtime/replacement.js";
import { setPowerShellBackend } from "../../runtime/powershellCompletion.js";
import { Shell } from "../../utils/shell.js";
import { unpackResources } from "../../utils/node.js";
import { SuggestionManager } from "../../ui/suggestionManager.js";
import type { ISTerm } from "../../isterm/pty.js";

const key = (name: string, sequence = "") => ({ name, sequence, shift: false, ctrl: false });

let workDir = "";
const folders = ["My Docs", "a&b", "a$b", "it's", "it's dir", "a`b", "中文目录"];

beforeAll(async () => {
  await unpackResources();
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), "figspec-"));
  for (const folder of folders) fs.mkdirSync(path.join(workDir, folder));
});

afterAll(() => {
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

const names = async (command: string, shell: Shell, cwd = process.cwd()) => (await getSuggestions(command, cwd, shell))?.suggestions.map((s) => s.name) ?? [];

/** 接受候选时，inshellisense 要删除的字符数和要插入的文本。name 省略时取第一个候选。 */
const accept = async (command: string, shell: Shell, cwd: string, name?: string) => {
  const blob = await getSuggestions(command, cwd, shell);
  const suggestion = name == null ? blob?.suggestions.at(0) : blob?.suggestions.find((s) => s.name === name);
  if (blob == null || suggestion == null) throw new Error(`no suggestion for ${JSON.stringify(command)}`);
  const action = calculateReplacement(blob.activeToken, suggestion);
  if (action == null) throw new Error(`no replacement for ${JSON.stringify(command)}`);
  return { deleteCount: action.backspaceCount, insert: action.insertText };
};

/** 驱动 SuggestionManager（按键处理层），记录写入终端的内容。 */
const managerFor = async (initialText: string, shell = Shell.Bash) => {
  const writes: string[] = [];
  const state = { commandText: initialText };
  const terminal = {
    cwd: process.cwd(),
    cols: 120,
    write: (data: string) => writes.push(data),
    clearCommand: () => {},
    getCommandState: () => ({ commandText: state.commandText, cursorTerminated: true, hasOutput: false }),
    getCursorState: () => ({ cursorX: 0 }),
  } as unknown as ISTerm;
  const manager = new SuggestionManager(terminal, shell, Promise.resolve({ getSuggestions }));
  await manager.exec();
  const visible = () => manager.render("below", 0).length > 0;
  return { manager, writes, visible, state };
};

describe("C-xxx：与 Fig 开源基线对照（bash）", () => {
  test("C-001 `git ch` 列出 checkout 和 cherry-pick，checkout 在前", async () => {
    expect(await names("git ch", Shell.Bash)).toEqual(["checkout", "cherry-pick"]);
  });

  test("C-002 差异：Tab 直接插入选中项（Fig 插入公共前缀，没有可插入的前缀时窗口抖动）", async () => {
    const { manager, writes } = await managerFor("git ch");
    expect(manager.update(key("tab", "\t"))).toBe(true);
    expect(writes).toEqual(["eckout "]);
  });

  test("C-003 `git chec` + Tab 补全为 `git checkout `", async () => {
    const { manager, writes } = await managerFor("git chec");
    expect(manager.update(key("tab", "\t"))).toBe(true);
    expect(writes).toEqual(["kout "]);
  });

  test("C-004 差异：↓ 后由 Tab 接受（Fig 用 Enter）；Enter 不被拦截，交给 shell 执行", async () => {
    const tab = await managerFor("git ch");
    tab.manager.update(key("down"));
    tab.manager.update(key("tab", "\t"));
    expect(tab.writes).toEqual(["erry-pick "]);

    const enter = await managerFor("git ch");
    enter.manager.update(key("down"));
    expect(enter.manager.update(key("return", "\r"))).toBe(false);
    expect(enter.writes).toEqual([]);
  });

  test("C-005 差异：Esc 隐藏后，再输入字符会重新显示（Fig 保持隐藏）", async () => {
    const { manager, visible, state } = await managerFor("git ch");
    expect(visible()).toBe(true);
    manager.update(key("escape", "\x1b"));
    expect(visible()).toBe(false);
    manager.update(key("e", "e"));
    state.commandText = "git che";
    await manager.exec();
    expect(visible()).toBe(true);
  });

  // C-006（光标在单词中间时不显示）：由 suggestionRenderer 根据 cursorTerminated 判断，
  // inshellisense 在光标之后还有任何非空白文字时都不显示，比 Fig 更严格。在引擎层无法测试，T-035 人工验证。

  test("C-007 管道之后只解析最后一段命令", async () => {
    expect(await names("ls | git ch", Shell.Bash)).toEqual(["checkout", "cherry-pick"]);
  });

  test("C-008a 差异：带空格的文件夹用双引号包裹（Fig 用 `My\\ Docs/`）", async () => {
    expect(await accept("cd M", Shell.Bash, workDir)).toEqual({ deleteCount: 1, insert: '"My Docs/"' });
  });

  test.failing("C-008b 缺陷：bash 下 `a&b` 应加引号（当前插入 `a&b/`，& 会被当作后台运行符）", async () => {
    const { insert } = await accept("cd a", Shell.Bash, workDir, "a&b");
    expect(insert.startsWith('"') || insert.startsWith("'")).toBe(true);
  });

  test.failing("C-009 差异：必须带 `=` 的选项应插入 `--chmod=`（当前插入 `--chmod `）", async () => {
    const { insert } = await accept("git add --chm", Shell.Bash, process.cwd());
    expect(insert.endsWith("=")).toBe(true);
  });

  test("C-010 没有 spec 的命令不显示", async () => {
    expect(await getSuggestions("notacommand-xyz ", process.cwd(), Shell.Bash)).toBeUndefined();
  });

  test("C-011 差异：在第一项按 ↑ 时停在第一项，窗口不隐藏（Fig 隐藏）", async () => {
    const { manager, visible } = await managerFor("git ch");
    expect(manager.update(key("up"))).toBe(true);
    expect(visible()).toBe(true);
  });

  test("C-012 没有候选时按键不被拦截", async () => {
    const { manager, writes } = await managerFor("notacommand-xyz ");
    for (const k of ["tab", "up", "down", "escape"]) expect(manager.update(key(k))).toBe(false);
    expect(writes).toEqual([]);
  });

  test("C-013 差异：默认补全命令名本身（Fig 默认关闭）", async () => {
    expect(await names("gi", Shell.Bash)).toContain("git");
  });
});

describe("W-xxx：PowerShell 规则", () => {
  // T-064 起，pwsh 中的 cd 等 PowerShell 自己的命令改用 PowerShell 的原生补全。这组用例检查的是 Fig 规格这条路径上的
  // 引号和删除规则（git、npm 等外部程序的路径参数仍然走这条路径），所以关闭原生补全，结果不受机器上有没有 pwsh 影响
  beforeAll(() => setPowerShellBackend(null));
  afterAll(() => setPowerShellBackend(undefined));

  test("W-001 带空格的文件夹用单引号包裹", async () => {
    expect(await accept("cd M", Shell.Pwsh, workDir)).toEqual({ deleteCount: 1, insert: `'My Docs${path.sep}'` });
  });

  test("W-002 名称中的单引号写成两个单引号，并整体加引号（T-039 修复）", async () => {
    expect((await accept("cd it", Shell.Pwsh, workDir, "it's")).insert).toBe(`'it''s${path.sep}'`);
  });

  test("W-003 含 `$` 的名称加单引号，避免被当作变量展开（T-039 修复）", async () => {
    expect((await accept("cd a", Shell.Pwsh, workDir, "a$b")).insert).toBe(`'a$b${path.sep}'`);
  });

  test("W-004 含 `&` 的名称加单引号（T-039 修复）", async () => {
    expect((await accept("cd a", Shell.Pwsh, workDir, "a&b")).insert).toBe(`'a&b${path.sep}'`);
  });

  test("W-005 中文名称按字符数删除（T-039 修复；PowerShell 中的效果待 T-035 第 15 项验证）", async () => {
    expect(await accept("cd 中", Shell.Pwsh, workDir)).toEqual({ deleteCount: 1, insert: `中文目录${path.sep}` });
  });

  test("W-006 `;` 之后只解析最后一条命令", async () => {
    expect(await names("echo hi; git ch", Shell.Pwsh)).toEqual(["checkout", "cherry-pick"]);
  });

  test("W-007 用户已输入开头的单引号时，替换整个带引号的词", async () => {
    expect(await accept("cd 'My", Shell.Pwsh, workDir)).toEqual({ deleteCount: 3, insert: `'My Docs${path.sep}'` });
  });

  test("W-008 含反引号的名称加单引号（T-039 修复）", async () => {
    expect((await accept("cd a", Shell.Pwsh, workDir, "a`b")).insert).toBe(`'a\`b${path.sep}'`);
  });

  test("W-009 同时含空格和单引号时，单引号写成两个单引号（T-039 修复）", async () => {
    expect((await accept("cd it", Shell.Pwsh, workDir, "it's dir")).insert).toBe(`'it''s dir${path.sep}'`);
  });
});
