/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：渲染器抽象、悬浮窗渲染器的切换与回退、按键拦截规则（docs/protocol.md 第 6 节）。

import { EventEmitter } from "node:events";
import type { Duplex } from "node:stream";
import { jest } from "@jest/globals";

import { type ClientListener, type ShowToken, OverlayClient } from "../../overlay/client.js";
import { createRenderer, OverlayRenderer, type Renderer } from "../../overlay/overlayRenderer.js";
import type { HideReason, ShowBody } from "../../overlay/protocol.js";
import type { DisplayState } from "../../overlay/snapshot.js";
import type { ISTerm } from "../../isterm/pty.js";
import type { Suggestion } from "../../runtime/model.js";
import { getSuggestions } from "../../runtime/runtime.js";
import { SuggestionManager } from "../../ui/suggestionManager.js";
import { Shell } from "../../utils/shell.js";
import { unpackResources } from "../../utils/node.js";

const key = (name: string) => ({ name, sequence: "", shift: false, ctrl: false });
const suggestion = (name: string): Suggestion => ({ name, allNames: [name], icon: "", priority: 50, type: "subcommand" });

/** 假的终端渲染器：只记录调用。 */
const fakeTerminal = () => {
  const calls: string[] = [];
  const terminal = {
    hasVisibleSuggestions: false,
    canAcceptSuggestion: false,
    handleBufferChange: async (type: "normal" | "alternate"): Promise<void> => void calls.push(`buffer:${type}`),
    renderPtyData: (data: string) => void calls.push(`pty:${data}`),
    renderSuggestionUpdate: () => void calls.push("update"),
    resize: (c: number, r: number) => void calls.push(`resize:${c}x${r}`),
    setSuggestionsEnabled: (enabled: boolean) => void calls.push(`enabled:${enabled}`),
  };
  return { terminal, calls };
};

/** 假的客户端：记录发出的快照，由测试触发宿主事件。 */
const fakeClient = () => {
  let listener!: ClientListener;
  const sent: ({ t: "show"; body: ShowBody; token: ShowToken } | { t: "hide"; reason: HideReason })[] = [];
  const client = {
    connected: false,
    setListener: (l: ClientListener) => void (listener = l),
    start: () => {},
    dispose: () => {},
    sendShow: (body: ShowBody, token: ShowToken) => void sent.push({ t: "show", body, token }),
    sendHide: (reason: HideReason) => void sent.push({ t: "hide", reason }),
  };
  const lastShow = () => sent.filter((m) => m.t === "show").at(-1) as { body: ShowBody; token: ShowToken };
  return {
    client,
    sent,
    lastShow,
    connect: () => listener.onConnected(),
    shown: (token = lastShow().token) => listener.onShown(token),
    hidden: () => listener.onHidden({} as never),
    close: (reason = "eof") => listener.onClosed(reason),
  };
};

const setup = () => {
  const state = {
    display: { page: [suggestion("checkout"), suggestion("cherry-pick")], selectedIndex: 0, pageStart: 0, totalCount: 2, listVersion: 1 } as
      | DisplayState
      | undefined,
    command: { commandText: "git ch", cursorTerminated: true, hasOutput: false },
    cursor: { cursorX: 6, cursorY: 2, hidden: false, shift: 0, onLastLine: false, remainingLines: 20 },
    alternate: false,
  };
  const term = {
    rows: 30,
    cols: 120,
    getCommandState: () => state.command,
    getCursorState: () => state.cursor,
    isAlternateBuffer: () => state.alternate,
  };
  const suggestions = { getDisplayState: () => state.display };
  const { terminal, calls } = fakeTerminal();
  const host = fakeClient();
  const renderer = new OverlayRenderer(term as unknown as ISTerm, suggestions, terminal, host.client);
  return { state, terminal, calls, host, renderer };
};

describe("P-11 选择渲染器", () => {
  test("没有设置 FIGWIN_OVERLAY_PIPE 时，直接返回原来的终端渲染器", () => {
    const { terminal } = fakeTerminal();
    expect(createRenderer({} as never, { getDisplayState: () => undefined }, terminal, {})).toBe(terminal);
    expect(createRenderer({} as never, { getDisplayState: () => undefined }, terminal, { FIGWIN_OVERLAY_PIPE: "" })).toBe(terminal);
  });

  test("设置后返回悬浮窗渲染器；宿主不存在时仍由终端绘制", () => {
    jest.useFakeTimers();
    try {
      const { terminal } = fakeTerminal();
      terminal.hasVisibleSuggestions = true;
      const endpoint = process.platform === "win32" ? "\\\\.\\pipe\\figwin-overlay-v1-missing" : "/nonexistent/figwin-overlay.sock";
      const renderer = createRenderer({} as never, { getDisplayState: () => undefined }, terminal, { FIGWIN_OVERLAY_PIPE: endpoint });
      expect(renderer).toBeInstanceOf(OverlayRenderer);
      expect((renderer as OverlayRenderer).overlayActive).toBe(false);
      expect(renderer.hasVisibleSuggestions).toBe(true);
      renderer.dispose?.();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("切换到悬浮窗", () => {
  test("握手后先关闭终端内的候选，再发送当前的快照", () => {
    const { host, calls, renderer } = setup();
    expect(renderer.hasVisibleSuggestions).toBe(false);
    host.connect();
    expect(calls).toEqual(["enabled:false"]);
    expect(host.sent).toEqual([expect.objectContaining({ t: "show" })]);
    expect(host.lastShow().body.candidates.map((c) => c.name)).toEqual(["checkout", "cherry-pick"]);
  });

  test("宿主确认之前不拦截候选按键；确认之后拦截，并且可以接受", () => {
    const { host, renderer } = setup();
    host.connect();
    expect([renderer.hasVisibleSuggestions, renderer.canAcceptSuggestion]).toEqual([false, false]);
    host.shown();
    expect([renderer.hasVisibleSuggestions, renderer.canAcceptSuggestion]).toEqual([true, true]);
  });

  test("P-06 选中项变化后：列表仍然可见（↑↓ 继续拦截），但确认新的选中项之前不能接受", () => {
    const { host, state, renderer } = setup();
    host.connect();
    host.shown();
    state.display = { ...state.display!, selectedIndex: 1 };
    renderer.renderPtyData("", false);
    expect(host.lastShow().body.selectedIndex).toBe(1);
    expect([renderer.hasVisibleSuggestions, renderer.canAcceptSuggestion]).toEqual([true, false]);
    host.shown();
    expect(renderer.canAcceptSuggestion).toBe(true);
  });

  test("候选列表重新计算后，旧的确认失效，等待新的 shown", () => {
    const { host, state, renderer } = setup();
    host.connect();
    host.shown();
    state.display = { ...state.display!, page: [suggestion("checkout")], totalCount: 1, listVersion: 2 };
    state.command = { ...state.command, commandText: "git che" };
    state.cursor = { ...state.cursor, cursorX: 7 };
    renderer.renderPtyData("e", false);
    expect(renderer.hasVisibleSuggestions).toBe(false);
  });

  test("P-06 只有参数说明时发送 show，但不拦截候选按键", () => {
    const { host, state, renderer } = setup();
    state.display = { page: [], selectedIndex: null, pageStart: 0, totalCount: 0, argumentDescription: "branch", listVersion: 3 };
    host.connect();
    host.shown();
    expect(host.lastShow().body.argumentDescription).toBe("branch");
    expect(renderer.hasVisibleSuggestions).toBe(false);
  });

  test("内容没有变化时不重复发送", () => {
    const { host, renderer } = setup();
    host.connect();
    renderer.renderPtyData("x", false);
    renderer.renderSuggestionUpdate(false);
    expect(host.sent).toHaveLength(1);
  });

  test("宿主报告 hidden：立即撤销可见标志", () => {
    const { host, renderer } = setup();
    host.connect();
    host.shown();
    host.hidden();
    expect(renderer.hasVisibleSuggestions).toBe(false);
  });
});

describe("P-09 隐藏的原因", () => {
  test.each([
    ["escape", "dismiss"],
    ["tab", "accept"],
    ["return", "command"],
  ])("按 %s 后候选消失：hide(%s)", (name, reason) => {
    const { host, state, renderer } = setup();
    host.connect();
    renderer.noteKeypress(key(name));
    state.display = undefined;
    renderer.renderPtyData("", false);
    expect(host.sent.at(-1)).toEqual({ t: "hide", reason });
  });

  test("Ctrl+C：hide(command)", () => {
    const { host, state, renderer } = setup();
    host.connect();
    renderer.noteKeypress({ name: "c", ctrl: true, shift: false });
    state.display = undefined;
    renderer.renderPtyData("", false);
    expect(host.sent.at(-1)).toEqual({ t: "hide", reason: "command" });
  });

  test("进入全屏程序：hide(alternate-buffer)，并且不再拦截按键", async () => {
    const { host, state, renderer } = setup();
    host.connect();
    host.shown();
    state.alternate = true;
    await renderer.handleBufferChange("alternate");
    expect(host.sent.at(-1)).toEqual({ t: "hide", reason: "alternate-buffer" });
    expect(renderer.hasVisibleSuggestions).toBe(false);
  });

  test("调整窗口大小：立即 hide(resize)，终端重绘之后按新的网格重新发送", () => {
    jest.useFakeTimers();
    try {
      const { host, state, renderer, calls } = setup();
      host.connect();
      renderer.resize(100, 40);
      expect(calls).toContain("resize:100x40");
      expect(host.sent.at(-1)).toEqual({ t: "hide", reason: "resize" });
      state.cursor = { ...state.cursor, cursorY: 5 };
      renderer.renderPtyData("prompt", false); // 重绘期间不发送
      expect(host.sent.at(-1)).toEqual({ t: "hide", reason: "resize" });
      jest.advanceTimersByTime(200);
      expect(host.lastShow().body.cursor).toEqual({ row: 5, col: 6 });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("P-07 回退", () => {
  test("连接关闭后回到终端绘制：重新打开终端内的候选，按键规则交还终端渲染器", () => {
    const { host, renderer, terminal, calls } = setup();
    host.connect();
    host.shown();
    host.close("show-ack-timeout");
    expect(calls).toEqual(["enabled:false", "enabled:true"]);
    expect(renderer.overlayActive).toBe(false);
    terminal.hasVisibleSuggestions = true;
    expect(renderer.hasVisibleSuggestions).toBe(true);
  });

  test("回退之后 PTY 数据照常交给终端渲染器，不再发送快照", () => {
    const { host, renderer, calls } = setup();
    host.connect();
    host.close();
    const sentBefore = host.sent.length;
    renderer.renderPtyData("abc", false);
    expect(calls.at(-1)).toBe("pty:abc");
    expect(host.sent).toHaveLength(sentBefore);
  });
});

/** 与 FakeSocket 相同思路的最小实现，用于集成测试。 */
class FakeSocket extends EventEmitter {
  written: Record<string, unknown>[] = [];
  seq = 0;
  write(line: Buffer): boolean {
    this.written.push(JSON.parse(line.toString("utf8")));
    return true;
  }
  end(): void {}
  destroy(): void {}
  host(t: string, extra: object): void {
    const { session, connection } = this.written[0] as { session: string; connection: string };
    this.emit("data", Buffer.from(JSON.stringify({ protocol: "figwin-overlay", v: 1, t, session, connection, seq: ++this.seq, ...extra }) + "\n"));
  }
  shown(): void {
    const show = this.written.filter((m) => m.t === "show").at(-1) as { seq: number };
    this.host("status", { forSeq: show.seq, state: "shown", reason: "ok", caretSource: "uia" });
  }
  lastShow(): ShowBody {
    return this.written.filter((m) => m.t === "show").at(-1) as unknown as ShowBody;
  }
}

test("集成：真实的 SuggestionManager 和客户端；`git ch` → ↓ → 确认前按 Tab 不插入 → 确认后插入 cherry-pick", async () => {
  await unpackResources();
  const writes: string[] = [];
  const term = {
    cwd: process.cwd(),
    rows: 30,
    cols: 120,
    write: (data: string) => writes.push(data),
    clearCommand: () => {},
    getCommandState: () => ({ commandText: "git ch", cursorTerminated: true, hasOutput: false }),
    getCursorState: () => ({ cursorX: 6, cursorY: 2, hidden: false, shift: 0, onLastLine: false, remainingLines: 20 }),
    isAlternateBuffer: () => false,
  } as unknown as ISTerm;
  const manager = new SuggestionManager(term, Shell.Bash, Promise.resolve({ getSuggestions }));
  await manager.exec();

  jest.useFakeTimers();
  const socket = new FakeSocket();
  const client = new OverlayClient({ endpoint: "fake", connect: () => socket as unknown as Duplex, pid: 1, wtSession: null });
  const { terminal } = fakeTerminal();
  const renderer: Renderer = new OverlayRenderer(term, manager, terminal, client);
  // ui-root 中的按键处理
  const press = (name: string) => {
    renderer.noteKeypress?.(key(name));
    const handled = manager.update(key(name), renderer.hasVisibleSuggestions, renderer.canAcceptSuggestion);
    if (handled) renderer.renderPtyData("", false); // term.noop() 触发的空数据
    return handled;
  };
  try {
    client.start();
    socket.emit("connect");
    socket.host("welcome", { hostInstance: "33333333-3333-4333-8333-333333333333", heartbeatMs: 200, leaseMs: 600 });
    expect(socket.lastShow().candidates.map((c) => c.name)).toEqual(["checkout", "cherry-pick"]);

    expect(press("tab")).toBe(false); // 宿主还没确认：Tab 交给 shell
    socket.shown();
    expect(press("down")).toBe(true);
    expect(socket.lastShow().selectedIndex).toBe(1);
    expect(press("tab")).toBe(true); // 新的选中项还没确认：吞掉，不插入
    expect(writes).toEqual([]);
    socket.shown();
    expect(press("tab")).toBe(true);
    expect(writes).toEqual(["erry-pick "]);
    expect(manager.getDisplayState()).toBeUndefined();
    expect(press("tab")).toBe(false);
    expect(writes).toEqual(["erry-pick "]);
  } finally {
    client.dispose();
    jest.useRealTimers();
  }
});

test("T-054 returning to a previously confirmed selection still needs a new shown", () => {
  const { host, state, renderer } = setup();
  host.connect();
  host.shown();
  state.display!.selectedIndex = 1;
  renderer.renderSuggestionUpdate(false);
  state.display!.selectedIndex = 0;
  renderer.renderSuggestionUpdate(false);
  expect(renderer.hasVisibleSuggestions).toBe(true);
  expect(renderer.canAcceptSuggestion).toBe(false);
  host.shown();
  expect(renderer.canAcceptSuggestion).toBe(true);
});

test("T-054 alternate buffer hides before asynchronous terminal cleanup finishes", async () => {
  const { host, state, renderer, terminal } = setup();
  host.connect();
  host.shown();
  let finish!: () => void;
  terminal.handleBufferChange = () =>
    new Promise<void>((resolve) => {
      finish = resolve;
    });
  state.alternate = true;
  const cleanup = renderer.handleBufferChange("alternate");
  try {
    expect(host.sent.at(-1)).toEqual({ t: "hide", reason: "alternate-buffer" });
    expect(renderer.hasVisibleSuggestions).toBe(false);
  } finally {
    finish();
    await cleanup;
  }
});

test.each(["command", "cwd"])("T-054 stale suggestions cannot be shown or accepted after %s changes", async (change) => {
  const writes: string[] = [];
  let commandText = "git ch";
  const term = {
    cwd: "/fixture/one",
    write: (value: string) => writes.push(value),
    getCommandState: () => ({ commandText, cursorTerminated: true }),
  };
  const manager = new SuggestionManager(
    term as unknown as ISTerm,
    Shell.Bash,
    Promise.resolve({
      getSuggestions: async () => ({ suggestions: [suggestion("checkout")] }),
    }),
  );
  await manager.exec();
  expect(manager.getDisplayState()).toBeDefined();
  if (change === "command") commandText = "git s";
  else term.cwd = "/fixture/two";
  expect(manager.getDisplayState()).toBeUndefined();
  expect(manager.render("below", 0)).toEqual([]);
  expect(manager.update(key("tab"), true, true)).toBe(false);
  expect(writes).toEqual([]);
});

test("T-054 acceptance consumes the snapshot before delayed PTY echo", async () => {
  const writes: string[] = [];
  const term = {
    cwd: "/fixture",
    write: (value: string) => writes.push(value),
    getCommandState: () => ({ commandText: "git ", cursorTerminated: true }),
  };
  const manager = new SuggestionManager(
    term as unknown as ISTerm,
    Shell.Bash,
    Promise.resolve({
      getSuggestions: async () => ({ suggestions: [suggestion("checkout")] }),
    }),
  );
  await manager.exec();
  expect(manager.update(key("tab"), true, true)).toBe(true);
  expect(manager.getDisplayState()).toBeUndefined();
  expect(manager.update(key("tab"), true, true)).toBe(false);
  expect(writes).toEqual(["checkout "]);
});
