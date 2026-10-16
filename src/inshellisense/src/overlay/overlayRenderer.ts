/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：渲染器抽象和悬浮窗渲染器（docs/protocol.md 第 6 节）。
// - 没有设置 FIGWIN_OVERLAY_PIPE、配置中也没有启用悬浮窗时，直接使用原来的终端渲染器，行为完全不变（端点见 launch.ts）。
// - 与宿主握手成功后，终端内不再绘制候选（PTY 输出照常透传），改为向宿主发送显示快照。
// - 连接失败、超时、宿主报告失败或失焦时回到终端内绘制，并按退避间隔重连。
// 按键规则：只有宿主确认当前候选列表已经显示时才拦截候选按键；
// 选中项变化后、宿主确认之前，接受键被吞掉而不插入，避免插入用户没有看到的候选。

import type { ISTerm } from "../isterm/pty.js";
import type { SuggestionManager } from "../ui/suggestionManager.js";
import type { SuggestionRenderer } from "../ui/suggestionRenderer.js";
import { getConfig } from "../utils/config.js";
import log from "../utils/log.js";
import { type ClientListener, type ShowToken, OverlayClient } from "./client.js";
import { type OverlayConfig, createHostLauncher, resolveOverlayTarget } from "./launch.js";
import { type HideReason } from "./protocol.js";
import { type Snapshot, buildSnapshot } from "./snapshot.js";

type TerminalBuffer = "normal" | "alternate";

/** ui-root 使用的渲染器接口。终端渲染器（SuggestionRenderer）和悬浮窗渲染器都实现它。 */
export interface Renderer {
  /** 候选可见：此时拦截候选按键（↑、↓、Esc、接受键）。 */
  readonly hasVisibleSuggestions: boolean;
  /** 可以接受当前选中的候选。 */
  readonly canAcceptSuggestion: boolean;
  handleBufferChange(bufferType: TerminalBuffer): Promise<void>;
  renderPtyData(data: string, preserveDuringBackspaceEcho: boolean): void;
  renderSuggestionUpdate(preserveDuringBackspaceEcho: boolean): void;
  resize(columns: number, rows: number): void;
  /** 记录按键，用来给下一条 hide 填写原因。 */
  noteKeypress?(key: { name: string; ctrl: boolean; shift: boolean }): void;
  dispose?(): void;
}

type TermLike = Pick<ISTerm, "getCommandState" | "getCursorState" | "isAlternateBuffer" | "rows" | "cols">;
type SuggestionsLike = Pick<SuggestionManager, "getDisplayState">;
type TerminalRendererLike = Renderer & Pick<SuggestionRenderer, "setSuggestionsEnabled">;
type ClientLike = Pick<OverlayClient, "setListener" | "start" | "sendShow" | "sendHide" | "dispose" | "connected">;

const RESIZE_SYNC_DELAY_MS = 200;

export class OverlayRenderer implements Renderer {
  readonly #term: TermLike;
  readonly #suggestions: SuggestionsLike;
  readonly #terminal: TerminalRendererLike;
  readonly #client: ClientLike;
  #overlayActive = false;
  #current?: Snapshot;
  #lastSent?: Snapshot;
  #confirmed?: ShowToken;
  #selectionConfirmed = false;
  #pendingHideReason?: HideReason;
  #preserve = false;
  #resizeTimer?: NodeJS.Timeout;

  constructor(term: TermLike, suggestions: SuggestionsLike, terminal: TerminalRendererLike, client: ClientLike) {
    this.#term = term;
    this.#suggestions = suggestions;
    this.#terminal = terminal;
    this.#client = client;
    const listener: ClientListener = {
      onConnected: () => this.#activate(),
      onShown: (token) => {
        this.#confirmed = token;
        this.#selectionConfirmed = true;
      },
      onHidden: () => {
        this.#confirmed = undefined;
      },
      onClosed: (reason) => this.#fallback(reason),
    };
    client.setListener(listener);
  }

  /** 悬浮窗正在接管显示（已握手）。 */
  get overlayActive(): boolean {
    return this.#overlayActive;
  }

  get hasVisibleSuggestions(): boolean {
    if (!this.#overlayActive) return this.#terminal.hasVisibleSuggestions;
    const current = this.#current;
    return current?.kind === "show" && current.hasCandidates && this.#confirmed?.listKey === current.listKey;
  }

  get canAcceptSuggestion(): boolean {
    if (!this.#overlayActive) return this.#terminal.canAcceptSuggestion;
    const current = this.#current;
    return this.#selectionConfirmed && this.hasVisibleSuggestions && current?.kind === "show" && this.#confirmed?.selectionKey === current.selectionKey;
  }

  async handleBufferChange(bufferType: TerminalBuffer): Promise<void> {
    if (bufferType === "alternate" && this.#overlayActive) {
      this.#current = { kind: "hide", reason: "alternate-buffer" };
      this.#send(this.#current);
    }
    await this.#terminal.handleBufferChange(bufferType);
    this.#sync();
  }

  renderPtyData(data: string, preserveDuringBackspaceEcho: boolean): void {
    this.#terminal.renderPtyData(data, preserveDuringBackspaceEcho);
    this.#preserve = preserveDuringBackspaceEcho;
    this.#sync();
  }

  renderSuggestionUpdate(preserveDuringBackspaceEcho: boolean): void {
    this.#terminal.renderSuggestionUpdate(preserveDuringBackspaceEcho);
    this.#preserve = preserveDuringBackspaceEcho;
    this.#sync();
  }

  resize(columns: number, rows: number): void {
    this.#terminal.resize(columns, rows);
    if (!this.#overlayActive) return;
    // 旧坐标立即失效；终端重绘（约 150 ms）之后按新的网格重新发送
    this.#send({ kind: "hide", reason: "resize" });
    this.#current = undefined;
    if (this.#resizeTimer != null) clearTimeout(this.#resizeTimer);
    this.#resizeTimer = setTimeout(() => {
      this.#resizeTimer = undefined;
      this.#sync();
    }, RESIZE_SYNC_DELAY_MS);
  }

  noteKeypress(key: { name: string; ctrl: boolean; shift: boolean }): void {
    const { acceptSuggestion, dismissSuggestions } = getConfig().bindings;
    const matches = (binding: { key: string; shift?: boolean; control?: boolean }) =>
      key.name === binding.key && key.shift === !!binding.shift && key.ctrl === !!binding.control;
    if (matches(dismissSuggestions)) this.#pendingHideReason = "dismiss";
    else if (matches(acceptSuggestion)) this.#pendingHideReason = "accept";
    else if (key.name === "return" || (key.ctrl && key.name === "c")) this.#pendingHideReason = "command";
  }

  dispose(): void {
    if (this.#resizeTimer != null) clearTimeout(this.#resizeTimer);
    this.#client.dispose();
  }

  #activate(): void {
    log.debug({ msg: "overlay connected, suggestions move to the overlay" });
    // 先清掉终端内已画的候选，再发送快照（第 4 节）
    this.#terminal.setSuggestionsEnabled(false);
    this.#overlayActive = true;
    this.#confirmed = undefined;
    this.#lastSent = undefined;
    this.#sync();
  }

  #fallback(reason: string): void {
    if (!this.#overlayActive) return;
    log.debug({ msg: "overlay unavailable, suggestions move back to the terminal", reason });
    this.#overlayActive = false;
    this.#confirmed = undefined;
    this.#current = undefined;
    this.#lastSent = undefined;
    // 只按当前仍然有效的命令状态重画；已被 Esc、Enter 清除的候选不会恢复
    this.#terminal.setSuggestionsEnabled(true);
  }

  #sync(): void {
    if (!this.#overlayActive || this.#resizeTimer != null) return;
    const snapshot = buildSnapshot({
      display: this.#suggestions.getDisplayState(),
      command: this.#term.getCommandState(),
      cursor: this.#term.getCursorState(),
      rows: this.#term.rows,
      cols: this.#term.cols,
      alternateBuffer: this.#term.isAlternateBuffer(),
      preserveDuringBackspaceEcho: this.#preserve,
    });
    this.#current = snapshot;
    if (snapshot.kind === "hide" && snapshot.reason === "empty" && this.#pendingHideReason != null) {
      this.#send({ kind: "hide", reason: this.#pendingHideReason });
    } else {
      this.#send(snapshot);
    }
    this.#pendingHideReason = undefined;
  }

  #send(snapshot: Snapshot): void {
    const last = this.#lastSent;
    if (snapshot.kind === "hide") {
      this.#confirmed = undefined;
      if (last?.kind === "hide") return;
      this.#client.sendHide(snapshot.reason);
    } else {
      if (last?.kind === "show" && last.selectionKey === snapshot.selectionKey && JSON.stringify(last.body) === JSON.stringify(snapshot.body)) return;
      this.#selectionConfirmed = false;
      this.#client.sendShow(snapshot.body, { listKey: snapshot.listKey, selectionKey: snapshot.selectionKey });
    }
    this.#lastSent = snapshot;
  }
}

/** 按环境变量选择渲染器：没有设置 FIGWIN_OVERLAY_PIPE 时就是原来的终端渲染器。 */
export const createRenderer = (
  term: TermLike,
  suggestions: SuggestionsLike,
  terminal: TerminalRendererLike,
  env: NodeJS.ProcessEnv = process.env,
  overlay: OverlayConfig = getConfig().overlay,
): Renderer => {
  // T-063：明确的 FIGWIN_OVERLAY_PIPE，或者配置中启用悬浮窗时的默认端点；都没有时使用原来的终端渲染器
  const target = resolveOverlayTarget(env, overlay);
  if (target == null) return terminal;
  const onUnreachable = target.launch != null ? createHostLauncher(target.launch, (message) => log.debug(message)) : undefined;
  const client = new OverlayClient({ endpoint: target.endpoint, log: (message) => log.debug(message), onUnreachable });
  const renderer = new OverlayRenderer(term, suggestions, terminal, client);
  client.start();
  return renderer;
};
