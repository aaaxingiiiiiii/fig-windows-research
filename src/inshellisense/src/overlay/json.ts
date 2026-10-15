/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：悬浮窗协议要求的严格 JSON 解析（docs/protocol.md 第 2 节）。
// 与 JSON.parse 的区别：重复键、嵌套超过上限、字符串中未配对的代理项都视为错误。

export class StrictJsonError extends Error {}

const MAX_DEPTH = 16;

const fail = (message: string, index: number): never => {
  throw new StrictJsonError(`${message} at ${index}`);
};

const hasLoneSurrogate = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i++;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
};

/** 解析一段 JSON 文本；不符合 RFC 8259 或违反上述限制时抛出 StrictJsonError。 */
export const parseStrictJson = (text: string, maxDepth = MAX_DEPTH): unknown => {
  let index = 0;

  const skipWhitespace = () => {
    while (index < text.length && " \t\n\r".includes(text[index])) index++;
  };

  const parseString = (): string => {
    // 字符串的语法交给 JSON.parse 检查（转义、控制字符），这里只负责找到结尾的引号
    const start = index;
    index++;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === '"') {
        index++;
        let value: string;
        try {
          value = JSON.parse(text.slice(start, index)) as string;
        } catch {
          return fail("invalid string", start);
        }
        if (hasLoneSurrogate(value)) fail("lone surrogate in string", start);
        return value;
      }
      index++;
    }
    return fail("unterminated string", start);
  };

  const parseLiteral = (): unknown => {
    const match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(index));
    if (match == null) return fail("unexpected token", index);
    index += match[0].length;
    return JSON.parse(match[0]);
  };

  const parseValue = (depth: number): unknown => {
    skipWhitespace();
    const char = text[index];
    if (char === "{" || char === "[") {
      if (depth >= maxDepth) fail("nesting too deep", index);
      return char === "{" ? parseObject(depth + 1) : parseArray(depth + 1);
    }
    if (char === '"') return parseString();
    return parseLiteral();
  };

  const parseObject = (depth: number): Record<string, unknown> => {
    const result: Record<string, unknown> = Object.create(null);
    const keys = new Set<string>();
    index++;
    skipWhitespace();
    if (text[index] === "}") {
      index++;
      return result;
    }
    for (;;) {
      skipWhitespace();
      if (text[index] !== '"') fail("expected key", index);
      const keyIndex = index;
      const key = parseString();
      if (keys.has(key)) fail(`duplicate key ${JSON.stringify(key)}`, keyIndex);
      keys.add(key);
      skipWhitespace();
      if (text[index] !== ":") fail("expected ':'", index);
      index++;
      result[key] = parseValue(depth);
      skipWhitespace();
      if (text[index] === ",") {
        index++;
        continue;
      }
      if (text[index] === "}") {
        index++;
        return result;
      }
      fail("expected ',' or '}'", index);
    }
  };

  const parseArray = (depth: number): unknown[] => {
    const result: unknown[] = [];
    index++;
    skipWhitespace();
    if (text[index] === "]") {
      index++;
      return result;
    }
    for (;;) {
      result.push(parseValue(depth));
      skipWhitespace();
      if (text[index] === ",") {
        index++;
        continue;
      }
      if (text[index] === "]") {
        index++;
        return result;
      }
      fail("expected ',' or ']'", index);
    }
  };

  const value = parseValue(0);
  skipWhitespace();
  if (index !== text.length) fail("trailing characters", index);
  return value;
};
