/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：悬浮窗宿主的客户端（renderer 角色），实现 docs/protocol.md 第 2–4、6、7 节中客户端的部分：
// 握手、心跳与租期、show 的确认超时、背压与有界队列、断线重连。
// 任何异常都只会关闭本连接并通知渲染器回到终端内绘制，不会影响 PTY。

import { randomUUID } from "node:crypto";
import net from "node:net";
import type { Duplex } from "node:stream";

import {
  type HideReason,
  type HostMessage,
  type ShowBody,
  type StatusMessage,
  encodeLine,
  LineDecoder,
  MAX_QUEUED_BYTES,
  parseHostMessage,
  PROTOCOL,
  timing as defaultTiming,
  VERSION,
} from "./protocol.js";

export type ShowToken = { listKey: string; selectionKey: string };

export type ClientListener = {
  /** 收到 welcome，可以发送 show。 */
  onConnected(): void;
  /** 最新一条 show 已在正确的窗格显示。 */
  onShown(token: ShowToken): void;
  /** 宿主报告 hidden、suppressed 或 failed：立即撤销可见标志。 */
  onHidden(status: StatusMessage): void;
  /** 连接已关闭（任何原因）。之后会按退避间隔自动重连，除非已调用 dispose()。 */
  onClosed(reason: string): void;
};

export type ClientOptions = {
  endpoint: string;
  connect?: (endpoint: string) => Duplex;
  timing?: Partial<typeof defaultTiming>;
  log?: (message: Record<string, unknown>) => void;
  pid?: number;
  wtSession?: string | null;
};

type PendingSnapshot = { kind: "show"; body: ShowBody; token: ShowToken } | { kind: "hide"; reason: HideReason };

export class OverlayClient {
  readonly session = randomUUID();
  readonly #options: ClientOptions;
  readonly #timing: typeof defaultTiming;
  #listener?: ClientListener;

  #socket?: Duplex;
  #connection = "";
  #decoder = new LineDecoder();
  #handshakeDone = false;
  #sendSeq = 0;
  #receiveSeq = 0;
  #lastHostMessageAt = 0;

  #blocked = false;
  #controlQueue: Buffer[] = [];
  #pendingSnapshot?: PendingSnapshot;
  #latestShow?: { seq: number; token: ShowToken };
  #unackedShows: { seq: number; sentAt: number }[] = [];

  #welcomeTimer?: NodeJS.Timeout;
  #heartbeatTimer?: NodeJS.Timeout;
  #ackTimer?: NodeJS.Timeout;
  #retryTimer?: NodeJS.Timeout;
  #retryIndex = 0;
  #disposed = false;

  constructor(options: ClientOptions) {
    this.#options = options;
    this.#timing = { ...defaultTiming, ...options.timing };
  }

  setListener(listener: ClientListener): void {
    this.#listener = listener;
  }

  /** 握手已完成，可以发送 show/hide。 */
  get connected(): boolean {
    return this.#handshakeDone;
  }

  start(): void {
    if (this.#disposed || this.#socket != null) return;
    this.#connect();
  }

  sendShow(body: ShowBody, token: ShowToken): void {
    if (!this.#handshakeDone) return;
    this.#enqueueSnapshot({ kind: "show", body, token });
  }

  sendHide(reason: HideReason): void {
    if (!this.#handshakeDone) return;
    this.#enqueueSnapshot({ kind: "hide", reason });
  }

  /** 结束：撤销显示并关闭连接，不再重连。 */
  dispose(): void {
    if (this.#disposed) return;
    if (this.#handshakeDone && this.#socket != null && !this.#blocked) {
      this.#write(this.#envelope("hide", { reason: "shutdown" }));
      this.#write(this.#envelope("bye", {}));
    }
    this.#disposed = true;
    if (this.#retryTimer != null) clearTimeout(this.#retryTimer);
    this.#retryTimer = undefined;
    this.#close("shutdown", false, true);
  }

  // ---- 连接 ----

  #connect(): void {
    this.#retryTimer = undefined;
    this.#connection = randomUUID();
    this.#decoder = new LineDecoder();
    this.#handshakeDone = false;
    this.#sendSeq = 0;
    this.#receiveSeq = 0;
    this.#blocked = false;
    this.#controlQueue = [];
    this.#pendingSnapshot = undefined;
    this.#latestShow = undefined;
    this.#unackedShows = [];

    const connect = this.#options.connect ?? ((endpoint: string) => net.createConnection(endpoint));
    const socket = connect(this.#options.endpoint);
    this.#socket = socket;
    const isCurrent = () => this.#socket === socket;

    // 从发起连接起计时：welcome 必须在这段时间内到达（第 4 节）
    this.#welcomeTimer = setTimeout(() => isCurrent() && this.#close("welcome-timeout"), this.#timing.welcomeWithinMs);

    socket.on("connect", () => {
      if (!isCurrent()) return;
      const wtSession = this.#options.wtSession !== undefined ? this.#options.wtSession : process.env.WT_SESSION ?? null;
      this.#write(
        this.#envelope("hello", {
          role: "renderer",
          pid: this.#options.pid ?? process.pid,
          terminal: { kind: "windows-terminal", wtSession: wtSession != null && wtSession.length <= 128 ? wtSession : null },
        }),
      );
    });
    socket.on("data", (chunk: Buffer) => isCurrent() && this.#receive(chunk));
    socket.on("drain", () => isCurrent() && this.#flush());
    socket.on("error", (error: Error) => isCurrent() && this.#close(`socket-error: ${error.message}`));
    socket.on("close", () => isCurrent() && this.#close("eof"));
  }

  #close(reason: string, notify = true, graceful = false): void {
    const socket = this.#socket;
    this.#socket = undefined;
    const wasConnected = this.#handshakeDone;
    this.#handshakeDone = false;
    for (const timer of [this.#welcomeTimer, this.#ackTimer]) if (timer != null) clearTimeout(timer);
    if (this.#heartbeatTimer != null) clearInterval(this.#heartbeatTimer);
    this.#welcomeTimer = this.#ackTimer = this.#heartbeatTimer = undefined;
    this.#controlQueue = [];
    this.#pendingSnapshot = undefined;
    this.#latestShow = undefined;
    this.#unackedShows = [];
    if (socket != null) {
      socket.removeAllListeners("data");
      socket.removeAllListeners("drain");
      socket.on("error", () => {});
      // 正常结束时先把已写入的 hide、bye 发出去；协议错误等情况直接断开
      if (graceful) socket.end();
      else socket.destroy();
    }
    this.#options.log?.({ msg: "overlay connection closed", reason, wasConnected });
    if (notify) this.#listener?.onClosed(reason);
    this.#scheduleRetry();
  }

  #scheduleRetry(): void {
    if (this.#disposed || this.#retryTimer != null) return;
    const delays = this.#timing.retryDelaysMs;
    const delay = delays[Math.min(this.#retryIndex, delays.length - 1)];
    this.#retryIndex += 1;
    this.#retryTimer = setTimeout(() => this.#connect(), delay);
    this.#retryTimer.unref?.();
  }

  // ---- 接收 ----

  #receive(chunk: Buffer): void {
    let lines: string[];
    try {
      lines = this.#decoder.push(chunk);
    } catch (e) {
      this.#close(`protocol-error: ${(e as Error).message}`);
      return;
    }
    for (const line of lines) {
      if (this.#socket == null) return;
      let message: HostMessage;
      try {
        message = parseHostMessage(line, { session: this.session, connection: this.#connection }, this.#handshakeDone);
        if (message.seq <= this.#receiveSeq) throw new Error("seq did not increase");
      } catch (e) {
        this.#close(`protocol-error: ${(e as Error).message}`);
        return;
      }
      this.#receiveSeq = message.seq;
      this.#lastHostMessageAt = Date.now();
      this.#handle(message);
    }
  }

  #handle(message: HostMessage): void {
    switch (message.t) {
      case "welcome":
        if (this.#welcomeTimer != null) clearTimeout(this.#welcomeTimer);
        this.#welcomeTimer = undefined;
        this.#handshakeDone = true;
        this.#heartbeatTimer = setInterval(() => this.#heartbeat(), this.#timing.heartbeatMs);
        this.#heartbeatTimer.unref?.();
        this.#listener?.onConnected();
        return;
      case "pong":
        return;
      case "error":
        this.#close(`host-error: ${message.code}`);
        return;
      case "status":
        this.#handleStatus(message);
        return;
    }
  }

  #handleStatus(status: StatusMessage): void {
    this.#unackedShows = this.#unackedShows.filter(({ seq }) => seq > status.forSeq);
    this.#armAckTimer();
    if (status.state === "shown") {
      // 只有最新一条 show 的 shown 才能确认可见（第 6 节）
      if (this.#latestShow != null && status.forSeq === this.#latestShow.seq) {
        this.#retryIndex = 0;
        this.#listener?.onShown(this.#latestShow.token);
      }
      return;
    }
    this.#listener?.onHidden(status);
    // suppressed、failed：关闭本连接，按退避间隔重连（第 6 节）
    if (status.state === "suppressed" || status.state === "failed") this.#close(`${status.state}: ${status.reason}`);
  }

  #heartbeat(): void {
    if (this.#socket == null || !this.#handshakeDone) return;
    if (Date.now() - this.#lastHostMessageAt > this.#timing.leaseMs) {
      this.#close("lease-expired");
      return;
    }
    // 背压时不排队心跳：对方本来就收不到，租期会让双方各自清理
    if (!this.#blocked) this.#write(this.#envelope("ping", {}));
  }

  // ---- 发送 ----

  #envelope(t: string, body: object): Buffer {
    const message = { protocol: PROTOCOL, v: VERSION, t, session: this.session, connection: this.#connection, seq: ++this.#sendSeq, ...body };
    const line = encodeLine(message);
    if (line == null) throw new Error(`message ${t} exceeds the line limit`);
    return line;
  }

  #enqueueSnapshot(snapshot: PendingSnapshot): void {
    // 只保留最新的待发送快照；hide 自然撤销此前待发送的 show（第 3 节）
    this.#pendingSnapshot = snapshot;
    if (!this.#blocked) this.#flush();
    else if (this.#queuedBytes() > MAX_QUEUED_BYTES) this.#close("resource-limit");
  }

  #queuedBytes(): number {
    const controls = this.#controlQueue.reduce((sum, line) => sum + line.length, 0);
    const snapshot = this.#pendingSnapshot == null ? 0 : Buffer.byteLength(JSON.stringify(this.#pendingSnapshot));
    return controls + snapshot;
  }

  #flush(): void {
    this.#blocked = false;
    while (this.#socket != null && !this.#blocked) {
      const control = this.#controlQueue.shift();
      if (control != null) {
        this.#write(control);
        continue;
      }
      const snapshot = this.#pendingSnapshot;
      if (snapshot == null) return;
      this.#pendingSnapshot = undefined;
      this.#writeSnapshot(snapshot);
    }
  }

  #writeSnapshot(snapshot: PendingSnapshot): void {
    if (snapshot.kind === "hide") {
      this.#latestShow = undefined;
      this.#write(this.#envelope("hide", { reason: snapshot.reason }));
      return;
    }
    let line: Buffer;
    try {
      line = this.#envelope("show", snapshot.body);
    } catch {
      this.#close("show-too-large");
      return;
    }
    const seq = this.#sendSeq;
    this.#latestShow = { seq, token: snapshot.token };
    this.#unackedShows.push({ seq, sentAt: Date.now() });
    this.#armAckTimer();
    this.#write(line);
  }

  #write(line: Buffer): void {
    const socket = this.#socket;
    if (socket == null) return;
    if (this.#blocked) {
      this.#controlQueue.push(line);
      if (this.#queuedBytes() > MAX_QUEUED_BYTES) this.#close("resource-limit");
      return;
    }
    if (!socket.write(line)) this.#blocked = true;
  }

  /** 最早一条未确认的 show 超过时限仍没有状态回复：关闭连接并回退（第 6 节）。 */
  #armAckTimer(): void {
    if (this.#ackTimer != null) clearTimeout(this.#ackTimer);
    this.#ackTimer = undefined;
    const oldest = this.#unackedShows[0];
    if (oldest == null) return;
    const remaining = Math.max(0, oldest.sentAt + this.#timing.showAckMs - Date.now());
    this.#ackTimer = setTimeout(() => this.#close("show-ack-timeout"), remaining);
  }
}
