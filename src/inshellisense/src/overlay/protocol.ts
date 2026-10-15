/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：悬浮窗协议 v1 的常量、消息类型、分帧和校验。规范见仓库根目录的 docs/protocol.md。
// 本文件只实现客户端（inshellisense，renderer 角色）需要的部分。

import { parseStrictJson } from "./json.js";

export const PROTOCOL = "figwin-overlay";
export const VERSION = 1;
/** 单行最大字节数，不含 LF（第 2 节）。 */
export const MAX_LINE_BYTES = 65536;
/** 发送队列的总字节上限（第 3 节）。 */
export const MAX_QUEUED_BYTES = 131072;
export const MAX_CANDIDATES = 20;
export const MAX_NAME_SCALARS = 512;
export const MAX_DESCRIPTION_SCALARS = 2048;

export const ENDPOINT_ENV = "FIGWIN_OVERLAY_PIPE";

export const timing = {
  helloWithinMs: 250,
  welcomeWithinMs: 500,
  heartbeatMs: 200,
  leaseMs: 600,
  showAckMs: 100,
  retryDelaysMs: [1000, 2000, 5000],
};

export type CandidateType = "file" | "folder" | "option" | "argument" | "subcommand" | "shortcut" | "other";
export type HideReason = "empty" | "dismiss" | "accept" | "command" | "alternate-buffer" | "resize" | "fallback" | "shutdown";
export type StatusState = "shown" | "hidden" | "suppressed" | "failed";
export type CaretSource = "uia" | "cells" | "none";

export type Candidate = { name: string; description: string | null; type: CandidateType };

export type ShowBody = {
  candidates: Candidate[];
  selectedIndex: number | null;
  pageStart: number;
  totalCount: number;
  argumentDescription: string | null;
  cursor: { row: number; col: number };
  terminal: { rows: number; cols: number; buffer: "normal"; cursorVisible: true };
};

export type Envelope = { protocol: typeof PROTOCOL; v: typeof VERSION; t: string; session: string; connection: string; seq: number };

export type WelcomeMessage = Envelope & { t: "welcome"; hostInstance: string; heartbeatMs: number; leaseMs: number };
export type StatusMessage = Envelope & { t: "status"; forSeq: number; state: StatusState; reason: string; caretSource: CaretSource };
export type PongMessage = Envelope & { t: "pong"; forSeq: number };
export type ErrorMessage = Envelope & { t: "error"; code: string };
export type HostMessage = WelcomeMessage | StatusMessage | PongMessage | ErrorMessage;

export class ProtocolError extends Error {}

// ---- 分帧 ----

/** 把字节流按 LF 切成消息行。行内的 CR 在末尾时去掉；超过上限（即使还没有 LF）就报错。 */
export class LineDecoder {
  #chunks: Buffer[] = [];
  #length = 0;

  push(chunk: Buffer): string[] {
    const lines: string[] = [];
    let start = 0;
    for (;;) {
      const newline = chunk.indexOf(0x0a, start);
      if (newline === -1) break;
      lines.push(this.#finish(chunk.subarray(start, newline)));
      start = newline + 1;
    }
    const rest = chunk.subarray(start);
    if (rest.length > 0) {
      this.#length += rest.length;
      if (this.#length > MAX_LINE_BYTES) throw new ProtocolError("line exceeds limit");
      this.#chunks.push(Buffer.from(rest));
    }
    return lines;
  }

  #finish(tail: Buffer): string {
    const bytes = Buffer.concat([...this.#chunks, tail]);
    this.#chunks = [];
    this.#length = 0;
    if (bytes.length > MAX_LINE_BYTES) throw new ProtocolError("line exceeds limit");
    const body = bytes.at(-1) === 0x0d ? bytes.subarray(0, -1) : bytes;
    if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) throw new ProtocolError("BOM is not allowed");
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      throw new ProtocolError("invalid UTF-8");
    }
  }
}

/** 把一条消息编码为一行（UTF-8 + LF）；超过单行上限时返回 undefined。 */
export const encodeLine = (message: object): Buffer | undefined => {
  const line = Buffer.from(JSON.stringify(message), "utf8");
  return line.length > MAX_LINE_BYTES ? undefined : Buffer.concat([line, Buffer.from("\n")]);
};

// ---- 校验宿主发来的消息 ----

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const isNonNegativeInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isPositiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;

const statusReasons: Record<StatusState, readonly string[]> = {
  shown: ["ok"],
  hidden: ["empty", "dismiss", "accept", "command", "alternate-buffer", "resize", "fallback", "shutdown", "lease-expired"],
  suppressed: ["inactive", "minimized", "pane-changed"],
  failed: ["binding-unavailable", "position-unavailable", "render-failed"],
};
const caretSources: readonly string[] = ["uia", "cells", "none"];
const errorCodes: readonly string[] = ["unsupported-version", "invalid-message", "wrong-role", "resource-limit", "internal-error"];

/**
 * 解析并校验一行宿主消息。identity 是本连接的 session/connection；handshakeDone 为 false 时只接受 welcome 和 error。
 * 不合法时抛出 ProtocolError，调用方应关闭连接（第 2 节）。
 */
export const parseHostMessage = (line: string, identity: { session: string; connection: string }, handshakeDone: boolean): HostMessage => {
  let value: unknown;
  try {
    value = parseStrictJson(line);
  } catch (e) {
    throw new ProtocolError(`invalid JSON: ${(e as Error).message}`);
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) throw new ProtocolError("message is not an object");
  const message = value as Record<string, unknown>;
  if (message.protocol !== PROTOCOL) throw new ProtocolError("unknown protocol");
  if (message.v !== VERSION) throw new ProtocolError("unsupported version");
  if (message.session !== identity.session || message.connection !== identity.connection) throw new ProtocolError("identity mismatch");
  if (!isPositiveInteger(message.seq)) throw new ProtocolError("invalid seq");

  const allowed = handshakeDone ? ["status", "pong", "error"] : ["welcome", "error"];
  if (typeof message.t !== "string" || !allowed.includes(message.t)) throw new ProtocolError(`unexpected message type ${String(message.t)}`);

  switch (message.t) {
    case "welcome":
      if (!isUuid(message.hostInstance) || !isPositiveInteger(message.heartbeatMs) || !isPositiveInteger(message.leaseMs)) {
        throw new ProtocolError("invalid welcome");
      }
      break;
    case "status": {
      const state = message.state as StatusState;
      if (!isNonNegativeInteger(message.forSeq) || !(state in statusReasons) || !statusReasons[state].includes(message.reason as string)) {
        throw new ProtocolError("invalid status");
      }
      if (!caretSources.includes(message.caretSource as string)) throw new ProtocolError("invalid caretSource");
      if ((state === "shown") === (message.caretSource === "none")) throw new ProtocolError("caretSource does not match state");
      break;
    }
    case "pong":
      if (!isPositiveInteger(message.forSeq)) throw new ProtocolError("invalid pong");
      break;
    case "error":
      if (!errorCodes.includes(message.code as string)) throw new ProtocolError("invalid error code");
      break;
  }
  return message as unknown as HostMessage;
};
