/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：悬浮窗客户端。前半部分用可控的假连接和假时钟，检查握手、确认超时、租期、重连和背压；
// 最后一个用例用真实的本机套接字（Mac 上是 Unix 域套接字，Windows 上是命名管道）跑一次完整往返。

import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { Duplex } from "node:stream";
import { jest } from "@jest/globals";

import { type ClientListener, OverlayClient } from "../../overlay/client.js";
import type { ShowBody, StatusMessage } from "../../overlay/protocol.js";

class FakeSocket extends EventEmitter {
  written: Record<string, unknown>[] = [];
  accepting = true;
  ended = false;
  destroyed = false;

  write(line: Buffer): boolean {
    this.written.push(JSON.parse(line.toString("utf8")));
    return this.accepting;
  }
  end(): void {
    this.ended = true;
  }
  destroy(): void {
    this.destroyed = true;
  }
  /** 宿主发来一条消息（自动填写信封）。 */
  host(t: string, extra: object = {}): void {
    const hello = this.written[0] as { session: string; connection: string };
    this.hostSeq += 1;
    const message = { protocol: "figwin-overlay", v: 1, t, session: hello.session, connection: hello.connection, seq: this.hostSeq, ...extra };
    this.emit("data", Buffer.from(JSON.stringify(message) + "\n"));
  }
  hostSeq = 0;
  sent(t: string) {
    return this.written.filter((m) => m.t === t);
  }
}

const body = (name: string): ShowBody => ({
  candidates: [{ name, description: null, type: "subcommand" }],
  selectedIndex: 0,
  pageStart: 0,
  totalCount: 1,
  argumentDescription: null,
  cursor: { row: 0, col: 6 },
  terminal: { rows: 30, cols: 120, buffer: "normal", cursorVisible: true },
});
const token = (name: string) => ({ listKey: name, selectionKey: name });

const setup = () => {
  const sockets: FakeSocket[] = [];
  const events: string[] = [];
  const shown: string[] = [];
  const hidden: StatusMessage[] = [];
  const client = new OverlayClient({
    endpoint: "fake",
    connect: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as Duplex;
    },
    pid: 4321,
    wtSession: null,
  });
  const listener: ClientListener = {
    onConnected: () => events.push("connected"),
    onShown: (t) => shown.push(t.listKey),
    onHidden: (s) => hidden.push(s),
    onClosed: (reason) => events.push(`closed:${reason}`),
  };
  client.setListener(listener);
  client.start();
  const socket = () => sockets.at(-1)!;
  const handshake = () => {
    socket().emit("connect");
    socket().host("welcome", { hostInstance: "33333333-3333-4333-8333-333333333333", heartbeatMs: 200, leaseMs: 600 });
  };
  return { client, sockets, socket, events, shown, hidden, handshake };
};

const lastSeq = (socket: FakeSocket, t: string) => (socket.sent(t).at(-1) as { seq: number }).seq;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("握手与心跳", () => {
  test("连接后发送 hello：renderer 角色、pid、WT 会话线索；session 和 connection 是 UUID", () => {
    const { socket, client, handshake, events } = setup();
    handshake();
    const hello = socket().written[0];
    expect(hello).toMatchObject({
      protocol: "figwin-overlay",
      v: 1,
      t: "hello",
      seq: 1,
      role: "renderer",
      pid: 4321,
      terminal: { kind: "windows-terminal", wtSession: null },
    });
    expect(hello.session).toBe(client.session);
    expect(hello.connection).toMatch(/^[0-9a-f-]{36}$/);
    expect(events).toEqual(["connected"]);
    expect(client.connected).toBe(true);
  });

  test("每 200 ms 发送 ping；宿主持续应答时连接保持", () => {
    const { socket, handshake, events } = setup();
    handshake();
    for (let i = 0; i < 5; i++) {
      jest.advanceTimersByTime(200);
      socket().host("pong", { forSeq: lastSeq(socket(), "ping") });
    }
    expect(socket().sent("ping")).toHaveLength(5);
    expect(events).toEqual(["connected"]);
  });

  test("P-08 超过 600 ms 没有收到宿主消息：关闭连接并回退", () => {
    const { handshake, events } = setup();
    handshake();
    jest.advanceTimersByTime(800);
    expect(events).toEqual(["connected", "closed:lease-expired"]);
  });

  test("500 ms 内没有 welcome：放弃本次连接，1 s 后用新的 connection 重新握手，不重放旧消息", () => {
    const { sockets, events } = setup();
    sockets[0].emit("connect");
    jest.advanceTimersByTime(500);
    expect(events).toEqual(["closed:welcome-timeout"]);
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].emit("connect");
    expect(sockets[1].written).toHaveLength(1);
    expect(sockets[1].written[0]).toMatchObject({ t: "hello", seq: 1 });
    expect(sockets[1].written[0].connection).not.toBe(sockets[0].written[0].connection);
  });

  test("重连间隔为 1 s、2 s、5 s，之后保持 5 s", () => {
    const { sockets } = setup();
    const delays: number[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = sockets.length;
      sockets.at(-1)!.emit("error", new Error("ENOENT"));
      let waited = 0;
      while (sockets.length === count) {
        jest.advanceTimersByTime(100);
        waited += 100;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([1000, 2000, 5000, 5000, 5000]);
  });
});

describe("show 的确认", () => {
  test("最新一条 show 收到 shown：确认可见", () => {
    const { client, socket, handshake, shown } = setup();
    handshake();
    client.sendShow(body("checkout"), token("A"));
    socket().host("status", { forSeq: lastSeq(socket(), "show"), state: "shown", reason: "ok", caretSource: "uia" });
    expect(shown).toEqual(["A"]);
  });

  test("较早一条 show 的 shown 被忽略，只有最新一条能确认", () => {
    const { client, socket, handshake, shown } = setup();
    handshake();
    client.sendShow(body("a"), token("A"));
    const first = lastSeq(socket(), "show");
    client.sendShow(body("b"), token("B"));
    socket().host("status", { forSeq: first, state: "shown", reason: "ok", caretSource: "uia" });
    expect(shown).toEqual([]);
    socket().host("status", { forSeq: lastSeq(socket(), "show"), state: "shown", reason: "ok", caretSource: "cells" });
    expect(shown).toEqual(["B"]);
  });

  test("P-07 show 发出后 100 ms 内没有状态回复：关闭连接并回退", () => {
    const { client, handshake, events } = setup();
    handshake();
    client.sendShow(body("a"), token("A"));
    jest.advanceTimersByTime(99);
    expect(events).toEqual(["connected"]);
    jest.advanceTimersByTime(1);
    expect(events).toEqual(["connected", "closed:show-ack-timeout"]);
  });

  test("hidden 撤销可见但保留连接；suppressed 和 failed 关闭连接并重连", () => {
    const { client, socket, sockets, handshake, events, hidden } = setup();
    handshake();
    client.sendShow(body("a"), token("A"));
    socket().host("status", { forSeq: lastSeq(socket(), "show"), state: "hidden", reason: "lease-expired", caretSource: "none" });
    expect(hidden.map((s) => s.state)).toEqual(["hidden"]);
    expect(events).toEqual(["connected"]);
    socket().host("status", { forSeq: lastSeq(socket(), "show"), state: "failed", reason: "position-unavailable", caretSource: "none" });
    expect(events).toEqual(["connected", "closed:failed: position-unavailable"]);
    jest.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
  });

  test("P-04 新连接建立后，旧连接上迟到的 shown 被忽略", () => {
    const { client, sockets, socket, handshake, shown, events } = setup();
    handshake();
    client.sendShow(body("a"), token("A"));
    const old = sockets[0];
    const oldSeq = lastSeq(old, "show");
    old.emit("close");
    jest.advanceTimersByTime(1000);
    handshake();
    old.host("status", { forSeq: oldSeq, state: "shown", reason: "ok", caretSource: "uia" });
    expect(shown).toEqual([]);
    expect(events).toEqual(["connected", "closed:eof", "connected"]);
    expect(socket()).not.toBe(old);
  });
});

describe("P-02 宿主发来非法消息", () => {
  test.each([
    ["非 JSON", "not json\n"],
    ["重复键", '{"protocol":"figwin-overlay","protocol":"figwin-overlay"}\n'],
  ])("%s：关闭连接", (_name, raw) => {
    const { socket, handshake, events } = setup();
    handshake();
    socket().emit("data", Buffer.from(raw));
    expect(events[1]).toMatch(/^closed:protocol-error/);
  });

  test("seq 没有递增：关闭连接", () => {
    const { socket, handshake, events } = setup();
    handshake();
    socket().hostSeq = 0;
    socket().host("pong", { forSeq: 1 });
    expect(events[1]).toMatch(/^closed:protocol-error/);
  });

  test("宿主发送 error：关闭连接", () => {
    const { socket, handshake, events } = setup();
    handshake();
    socket().host("error", { code: "invalid-message" });
    expect(events).toEqual(["connected", "closed:host-error: invalid-message"]);
  });
});

describe("P-12 背压与有界队列", () => {
  test("写入受阻时只保留最新的待发送 show；hide 撤销此前待发送的 show", () => {
    const { client, socket, handshake } = setup();
    handshake();
    socket().accepting = false;
    client.sendShow(body("a"), token("A")); // 写入后受阻
    client.sendShow(body("b"), token("B"));
    client.sendShow(body("c"), token("C"));
    socket().accepting = true;
    socket().emit("drain");
    expect(
      socket()
        .sent("show")
        .map((m) => (m.candidates as { name: string }[])[0].name),
    ).toEqual(["a", "c"]);

    socket().accepting = false;
    client.sendShow(body("d"), token("D"));
    client.sendShow(body("e"), token("E"));
    client.sendHide("dismiss");
    socket().accepting = true;
    socket().emit("drain");
    expect(
      socket()
        .sent("show")
        .map((m) => (m.candidates as { name: string }[])[0].name),
    ).toEqual(["a", "c", "d"]);
    expect(socket().sent("hide")).toEqual([expect.objectContaining({ reason: "dismiss" })]);
  });

  test("序号在实际写入时分配，严格递增", () => {
    const { client, socket, handshake } = setup();
    handshake();
    client.sendShow(body("a"), token("A"));
    client.sendHide("empty");
    const seqs = socket().written.map((m) => m.seq as number);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
  });

  test("排队的字节超过上限：关闭连接并回退", () => {
    const { client, socket, handshake, events } = setup();
    handshake();
    socket().accepting = false;
    client.sendShow(body("a"), token("A"));
    const huge = body("x");
    huge.candidates[0].description = "d".repeat(140000);
    client.sendShow(huge, token("X"));
    expect(events).toEqual(["connected", "closed:resource-limit"]);
  });
});

test("dispose：发送 hide(shutdown) 和 bye，正常结束连接，不再重连", () => {
  const { client, socket, sockets, handshake } = setup();
  handshake();
  client.dispose();
  expect(socket().written.slice(-2)).toEqual([expect.objectContaining({ t: "hide", reason: "shutdown" }), expect.objectContaining({ t: "bye" })]);
  expect(socket().ended).toBe(true);
  jest.advanceTimersByTime(10000);
  expect(sockets).toHaveLength(1);
});

test("真实套接字往返：握手、show、shown（Mac 上是 Unix 域套接字，Windows 上是命名管道）", async () => {
  jest.useRealTimers();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "overlay-"));
  const endpoint = process.platform === "win32" ? `\\\\.\\pipe\\figwin-overlay-v1-test-${process.pid}` : path.join(dir, "host.sock");
  const received: Record<string, unknown>[] = [];
  const server = net.createServer((conn) => {
    let buffer = "";
    let seq = 0;
    conn.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const message = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        received.push(message);
        const reply = (t: string, extra: object) =>
          conn.write(
            JSON.stringify({ protocol: "figwin-overlay", v: 1, t, session: message.session, connection: message.connection, seq: ++seq, ...extra }) + "\n",
          );
        if (message.t === "hello") reply("welcome", { hostInstance: "33333333-3333-4333-8333-333333333333", heartbeatMs: 200, leaseMs: 600 });
        if (message.t === "show") reply("status", { forSeq: message.seq, state: "shown", reason: "ok", caretSource: "cells" });
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(endpoint, resolve));
  const client = new OverlayClient({ endpoint });
  try {
    const result = await new Promise<string>((resolve, reject) => {
      client.setListener({
        onConnected: () => client.sendShow(body("checkout"), token("A")),
        onShown: (t) => resolve(t.listKey),
        onHidden: () => reject(new Error("hidden")),
        onClosed: (reason) => reject(new Error(reason)),
      });
      client.start();
    });
    expect(result).toBe("A");
    expect(received.map((m) => m.t)).toEqual(["hello", "show"]);
  } finally {
    client.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
