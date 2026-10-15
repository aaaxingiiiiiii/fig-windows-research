/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：协议分帧和消息校验。用例编号对应 docs/protocol.md 第 10 节。

import { parseStrictJson, StrictJsonError } from "../../overlay/json.js";
import { encodeLine, LineDecoder, MAX_LINE_BYTES, parseHostMessage, ProtocolError } from "../../overlay/protocol.js";

const identity = { session: "11111111-1111-4111-8111-111111111111", connection: "22222222-2222-4222-8222-222222222222" };
const envelope = (t: string, seq: number, extra: object) => ({ protocol: "figwin-overlay", v: 1, t, ...identity, seq, ...extra });
const welcome = envelope("welcome", 1, { hostInstance: "33333333-3333-4333-8333-333333333333", heartbeatMs: 200, leaseMs: 600 });
const status = (extra: object = {}) => envelope("status", 2, { forSeq: 2, state: "shown", reason: "ok", caretSource: "uia", ...extra });

describe("P-01 分帧", () => {
  test("中文字符的 UTF-8 字节被拆到两次读取中，仍然恰好得到原消息", () => {
    const line = encodeLine({ text: "切换分支" })!;
    const split = line.indexOf(Buffer.from("换")) + 1; // 拆在“换”的三个字节中间
    const decoder = new LineDecoder();
    expect(decoder.push(line.subarray(0, split))).toEqual([]);
    expect(decoder.push(line.subarray(split)).map((l) => JSON.parse(l))).toEqual([{ text: "切换分支" }]);
  });

  test("两条消息在一次读取中到达，得到两条；JSON 字符串中转义的换行不分割消息", () => {
    const both = Buffer.concat([encodeLine({ a: "x\ny" })!, encodeLine({ b: 2 })!]);
    expect(new LineDecoder().push(both).map((l) => JSON.parse(l))).toEqual([{ a: "x\ny" }, { b: 2 }]);
  });

  test("兼容 CRLF", () => {
    expect(new LineDecoder().push(Buffer.from('{"a":1}\r\n'))).toEqual(['{"a":1}']);
  });

  test("逐字节到达也能正确拼出", () => {
    const line = encodeLine({ text: "中文 ok" })!;
    const decoder = new LineDecoder();
    const out = [...line].flatMap((byte) => decoder.push(Buffer.from([byte])));
    expect(out.map((l) => JSON.parse(l))).toEqual([{ text: "中文 ok" }]);
  });
});

describe("P-02 非法输入", () => {
  test("超过上限仍没有 LF 时，立即报错，不等到换行", () => {
    const decoder = new LineDecoder();
    expect(() => decoder.push(Buffer.alloc(MAX_LINE_BYTES + 1, 0x61))).toThrow(ProtocolError);
  });

  test("恰好等于上限的一行可以接受", () => {
    const decoder = new LineDecoder();
    expect(decoder.push(Buffer.concat([Buffer.alloc(MAX_LINE_BYTES, 0x61), Buffer.from("\n")]))[0]).toHaveLength(MAX_LINE_BYTES);
  });

  test("无效 UTF-8 和 BOM 报错", () => {
    expect(() => new LineDecoder().push(Buffer.from([0xff, 0x0a]))).toThrow(ProtocolError);
    expect(() => new LineDecoder().push(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d, 0x0a]))).toThrow(ProtocolError);
  });

  test("发送时超过单行上限的消息不编码", () => {
    expect(encodeLine({ text: "x".repeat(MAX_LINE_BYTES) })).toBeUndefined();
  });

  test.each([
    ["重复键", '{"a":1,"a":2}'],
    ["嵌套超过 16 层", "[".repeat(17) + "]".repeat(17)],
    ["未配对的代理项", '{"a":"\\ud800"}'],
    ["尾随内容", '{"a":1} x'],
    ["单引号", "{'a':1}"],
  ])("严格 JSON 拒绝%s", (_name, text) => {
    expect(() => parseStrictJson(text)).toThrow(StrictJsonError);
  });

  test("严格 JSON 接受正常内容，包括配对的代理项和 16 层嵌套", () => {
    expect(parseStrictJson('{"a":[1,-2.5e3,true,null,"😀\\n"]}')).toEqual({ a: [1, -2500, true, null, "😀\n"] });
    expect(() => parseStrictJson("[".repeat(16) + "]".repeat(16))).not.toThrow();
  });

  test.each([
    ["v=0", { ...status(), v: 0 }],
    ["其他连接的身份", { ...status(), connection: "44444444-4444-4444-8444-444444444444" }],
    ["seq 为 0", { ...status(), seq: 0 }],
    ["未知的消息类型", envelope("show", 2, {})],
    ["状态与原因不匹配", status({ state: "shown", reason: "dismiss" })],
    ["shown 却没有定位来源", status({ caretSource: "none" })],
    ["hidden 却有定位来源", status({ state: "hidden", reason: "dismiss", caretSource: "uia" })],
    ["forSeq 为负数", status({ forSeq: -1 })],
    ["未知的错误码", envelope("error", 2, { code: "oops" })],
  ])("握手后拒绝：%s", (_name, message) => {
    expect(() => parseHostMessage(JSON.stringify(message), identity, true)).toThrow(ProtocolError);
  });

  test("握手前只接受 welcome 和 error；握手后不再接受 welcome", () => {
    expect(() => parseHostMessage(JSON.stringify(status()), identity, false)).toThrow(ProtocolError);
    expect(parseHostMessage(JSON.stringify(welcome), identity, false).t).toBe("welcome");
    expect(() => parseHostMessage(JSON.stringify(welcome), identity, true)).toThrow(ProtocolError);
  });

  test("已知消息中的未知附加字段可以忽略", () => {
    expect(parseHostMessage(JSON.stringify(status({ extra: { future: true } })), identity, true).t).toBe("status");
  });
});

test.each([{ heartbeatMs: 201 }, { leaseMs: 601 }])("T-054 v1 welcome rejects changed timing: %j", (extra) => {
  expect(() => parseHostMessage(JSON.stringify({ ...welcome, ...extra }), identity, false)).toThrow(ProtocolError);
});

test("T-054 status.state must be a string, not a coercible array", () => {
  expect(() => parseHostMessage(JSON.stringify(status({ state: ["shown"], caretSource: "none" })), identity, true)).toThrow(ProtocolError);
});
