/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：从 inshellisense 的状态生成协议的显示快照（docs/protocol.md 第 5 节）。纯函数，便于测试。

import type { Suggestion } from "../runtime/model.js";
import {
  type Candidate,
  type CandidateType,
  type HideReason,
  type ShowBody,
  encodeLine,
  MAX_CANDIDATES,
  MAX_DESCRIPTION_SCALARS,
  MAX_NAME_SCALARS,
} from "./protocol.js";

/** SuggestionManager 当前页的状态。 */
export type DisplayState = {
  page: Suggestion[];
  /** 当前页内的选中下标；没有候选时为 null。 */
  selectedIndex: number | null;
  pageStart: number;
  totalCount: number;
  argumentDescription?: string;
  /** 候选列表的版本：重新计算出新的候选列表时变化，翻页和改变选中项时不变。 */
  listVersion: number;
};

export type SnapshotInput = {
  display: DisplayState | undefined;
  command: { commandText?: string; cursorTerminated?: boolean; hasOutput?: boolean };
  cursor: { cursorX: number; cursorY: number; hidden: boolean; shift: number };
  rows: number;
  cols: number;
  alternateBuffer: boolean;
  /** 刚发送退格、回显还没到达时，保持显示（与终端渲染器相同）。 */
  preserveDuringBackspaceEcho: boolean;
};

export type Snapshot =
  | {
      kind: "show";
      body: ShowBody;
      /** 候选列表和替换范围的标识（不含页码和选中项）：变化后，旧的确认不能再用于拦截按键。 */
      listKey: string;
      /** listKey 加上全局选中下标：变化后，旧的确认不能再用于接受候选。 */
      selectionKey: string;
      /** 是否有可以接受的候选（只有参数说明时为 false，不拦截按键）。 */
      hasCandidates: boolean;
    }
  | { kind: "hide"; reason: HideReason };

// ---- 文字清洗 ----

// CSI、OSC、DCS/SOS/PM/APC 和其他两字节的 ESC 序列
// eslint-disable-next-line no-control-regex
const escapeSequences = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|\u001b[PX^_][^\u001b]*(?:\u001b\\)?|\u001b[@-Z\\-_]/g;
// eslint-disable-next-line no-control-regex
const controlsExceptNewlineAndTab = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;
// eslint-disable-next-line no-control-regex
const allControls = /[\u0000-\u001f\u007f-\u009f]/g;
const loneSurrogates = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

const truncateScalars = (value: string, max: number): string => {
  const scalars = Array.from(value);
  return scalars.length <= max ? value : scalars.slice(0, max).join("");
};

export const sanitizeName = (value: string, max = MAX_NAME_SCALARS): string =>
  truncateScalars(value.replace(escapeSequences, "").replace(allControls, "").replace(loneSurrogates, "�"), max);

export const sanitizeDescription = (value: string | undefined, max = MAX_DESCRIPTION_SCALARS): string | null => {
  if (value == null) return null;
  const clean = value.replace(/\r\n?/g, "\n").replace(escapeSequences, "").replace(controlsExceptNewlineAndTab, "").replace(loneSurrogates, "�");
  return clean.length === 0 ? null : truncateScalars(clean, max);
};

const candidateTypes: Record<string, CandidateType> = {
  file: "file",
  folder: "folder",
  option: "option",
  arg: "argument",
  subcommand: "subcommand",
  shortcut: "shortcut",
};

export const toCandidateType = (type: string | undefined): CandidateType => (type != null && candidateTypes[type]) || "other";

// ---- 快照 ----

// 超过单行上限时，依次缩短说明和名称（第 5 节）；仍然超限则隐藏
const shrinkSteps: { description: number; name: number }[] = [
  { description: MAX_DESCRIPTION_SCALARS, name: MAX_NAME_SCALARS },
  { description: 512, name: MAX_NAME_SCALARS },
  { description: 128, name: MAX_NAME_SCALARS },
  { description: 0, name: 128 },
  { description: 0, name: 32 },
];

/** 生成 show 或 hide。可见条件与终端渲染器（suggestionRenderer.ts）相同，另外加上协议对光标的要求。 */
export const buildSnapshot = (input: SnapshotInput): Snapshot => {
  const { display, command, cursor, rows, cols } = input;
  if (input.alternateBuffer) return { kind: "hide", reason: "alternate-buffer" };
  const hasContent = display != null && (display.page.length > 0 || !!display.argumentDescription);
  const cursorTerminated = input.preserveDuringBackspaceEcho || command.cursorTerminated === true;
  if (!hasContent || !cursorTerminated || command.hasOutput || cursor.shift !== 0 || !command.commandText) return { kind: "hide", reason: "empty" };
  // 光标不可见、待换行（cursorX === cols）或网格不合法时不猜坐标
  if (cursor.hidden || rows < 1 || cols < 1 || rows > 4096 || cols > 4096) return { kind: "hide", reason: "empty" };
  if (cursor.cursorX < 0 || cursor.cursorX >= cols || cursor.cursorY < 0 || cursor.cursorY >= rows) return { kind: "hide", reason: "empty" };

  const page = display.page.slice(0, MAX_CANDIDATES);
  const selectedIndex = page.length === 0 ? null : Math.min(Math.max(display.selectedIndex ?? 0, 0), page.length - 1);
  const totalCount = Math.max(display.totalCount, display.pageStart + page.length);

  for (const limits of shrinkSteps) {
    const candidates: Candidate[] = page.map((suggestion) => ({
      name: sanitizeName(suggestion.name, limits.name) || "�",
      description: limits.description === 0 ? null : sanitizeDescription(suggestion.description, limits.description),
      type: toCandidateType(suggestion.type),
    }));
    const argumentDescription = sanitizeDescription(display.argumentDescription, limits.description === 0 ? 128 : limits.description);
    if (candidates.length === 0 && argumentDescription == null) return { kind: "hide", reason: "empty" };
    const body: ShowBody = {
      candidates,
      selectedIndex: candidates.length === 0 ? null : selectedIndex,
      pageStart: candidates.length === 0 ? 0 : display.pageStart,
      totalCount: candidates.length === 0 ? 0 : totalCount,
      argumentDescription,
      cursor: { row: cursor.cursorY, col: cursor.cursorX },
      terminal: { rows, cols, buffer: "normal", cursorVisible: true },
    };
    // 估算时给信封留出余量
    if (encodeLine({ ...body, envelope: "x".repeat(256) }) == null) continue;
    const listKey = JSON.stringify([display.listVersion, command.commandText, body.cursor, body.terminal]);
    return {
      kind: "show",
      body,
      listKey,
      selectionKey: `${listKey}\u0000${body.selectedIndex == null ? "" : display.pageStart + body.selectedIndex}`,
      hasCandidates: candidates.length > 0,
    };
  }
  return { kind: "hide", reason: "fallback" };
};
