// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-043：假的悬浮窗宿主，用来在没有 C# 宿主（T-044）时检查 inshellisense 发出的协议消息。
// 不画任何窗口：收到 hello 回复 welcome，收到 ping 回复 pong，收到 show/hide 回复 status，
// 并把收到的每条消息按 JSON 行打印到标准输出。协议见 docs/protocol.md。
//
// 用法：node fake-host.mjs <端点> [--no-ack] [--fail]
//   端点：Windows 上为 \\.\pipe\<名称>，其他系统上为 Unix 域套接字文件的路径
//   --no-ack：收到 show 后不回复，用来检查客户端 100 ms 超时后回到终端内绘制
//   --fail：对 show 回复 failed(position-unavailable)，用来检查回退

import fs from "node:fs";
import net from "node:net";
import { randomUUID } from "node:crypto";

const [endpoint, ...flags] = process.argv.slice(2);
if (!endpoint) {
  console.error("usage: node fake-host.mjs <endpoint> [--no-ack] [--fail]");
  process.exit(2);
}
const noAck = flags.includes("--no-ack");
const fail = flags.includes("--fail");
const hostInstance = randomUUID();
if (process.platform !== "win32" && fs.existsSync(endpoint)) fs.unlinkSync(endpoint);

const server = net.createServer((socket) => {
  let buffer = "";
  let seq = 0;
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        console.log(JSON.stringify({ fakeHost: "invalid-json", line }));
        socket.destroy();
        return;
      }
      console.log(JSON.stringify(message));
      const reply = (t, extra) =>
        socket.write(JSON.stringify({ protocol: "figwin-overlay", v: 1, t, session: message.session, connection: message.connection, seq: ++seq, ...extra }) + "\n");
      switch (message.t) {
        case "hello":
          reply("welcome", { hostInstance, heartbeatMs: 200, leaseMs: 600 });
          break;
        case "ping":
          reply("pong", { forSeq: message.seq });
          break;
        case "show":
          if (fail) reply("status", { forSeq: message.seq, state: "failed", reason: "position-unavailable", caretSource: "none" });
          else if (!noAck) reply("status", { forSeq: message.seq, state: "shown", reason: "ok", caretSource: "cells" });
          break;
        case "hide":
          reply("status", { forSeq: message.seq, state: "hidden", reason: message.reason, caretSource: "none" });
          break;
      }
    }
  });
  socket.on("error", () => {});
});
server.listen(endpoint, () => console.error(`fake host listening on ${endpoint}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
