/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-063：悬浮窗宿主的默认端点和自动启动（src/overlay/launch.ts）。

import { EventEmitter } from "node:events";
import type { Duplex } from "node:stream";
import { jest } from "@jest/globals";

import { OverlayClient } from "../../overlay/client.js";
import { createHostLauncher, defaultHostPath, defaultPipeName, endpointPath, resolveOverlayTarget, userKey } from "../../overlay/launch.js";

// 与 src/overlay-host/FigWin.OverlayHost.Core.Tests/PipeServerTests.cs 使用同一组数据：两边必须算出同样的管道名
test.each([
  ["alice", "1", "figwin-overlay-v1-2bd806c97f0e00af-1"],
  ["Alice", "1", "figwin-overlay-v1-2bd806c97f0e00af-1"],
  ["张三", "2", "figwin-overlay-v1-1d841bc0ee98309c-2"],
  ["runneradmin", "0", "figwin-overlay-v1-6d4dd91a15baa7e0-0"],
])("默认管道名按用户和登录会话计算：%s / %s", (userName, session, expected) => {
  expect(defaultPipeName(userName, session)).toBe(expected);
  expect(userKey(userName)).toBe(expected.split("-")[3]);
});

test("端点路径与宿主的 PipeServer.EndpointPath 相同", () => {
  expect(endpointPath("demo", "win32")).toBe("\\\\.\\pipe\\demo");
  expect(endpointPath("demo", "darwin", "/tmp/x")).toBe("/tmp/x/CoreFxPipe_demo");
});

test("宿主默认放在 is.exe 旁边", () => {
  expect(defaultHostPath("C:\\Apps\\figwin\\is.exe", "win32")).toMatch(/figwin-host\.exe$/);
  expect(defaultHostPath("/opt/figwin/is", "darwin")).toBe("/opt/figwin/figwin-host");
});

describe("resolveOverlayTarget", () => {
  const options = { userName: "alice", platform: "win32" as const, execPath: "C:\\Apps\\figwin\\is.exe" };

  test("明确设置的 FIGWIN_OVERLAY_PIPE 照原样使用，不启动宿主", () => {
    expect(resolveOverlayTarget({ FIGWIN_OVERLAY_PIPE: "\\\\.\\pipe\\dev", FIGWIN_LOGON_SESSION: "1" }, { enabled: true }, options)).toEqual({
      endpoint: "\\\\.\\pipe\\dev",
    });
  });

  test("没有启用悬浮窗时不使用", () => {
    expect(resolveOverlayTarget({ FIGWIN_LOGON_SESSION: "1" }, { enabled: false }, options)).toBeUndefined();
  });

  test("启用后使用默认端点，连不上时启动 is.exe 旁边的宿主", () => {
    expect(resolveOverlayTarget({ FIGWIN_LOGON_SESSION: "1" }, { enabled: true }, options)).toEqual({
      endpoint: "\\\\.\\pipe\\figwin-overlay-v1-2bd806c97f0e00af-1",
      launch: { hostPath: expect.stringMatching(/figwin-host\.exe$/), pipeName: "figwin-overlay-v1-2bd806c97f0e00af-1" },
    });
  });

  test("配置中的 hostPath 优先", () => {
    expect(resolveOverlayTarget({ FIGWIN_LOGON_SESSION: "3" }, { enabled: true, hostPath: "D:\\host.exe" }, options)?.launch?.hostPath).toBe("D:\\host.exe");
  });

  test("没有登录会话编号（不是由 PowerShell 初始化脚本启动）或编号不合法时，不使用悬浮窗", () => {
    expect(resolveOverlayTarget({}, { enabled: true }, options)).toBeUndefined();
    expect(resolveOverlayTarget({ FIGWIN_LOGON_SESSION: "1;x" }, { enabled: true }, options)).toBeUndefined();
  });
});

describe("createHostLauncher", () => {
  const fakeSpawn = () => {
    const children: EventEmitter[] = [];
    const spawn = jest.fn((file: string, args: string[], spawnOptions: object) => {
      void file;
      void args;
      void spawnOptions;
      const child = Object.assign(new EventEmitter(), { unref: jest.fn() });
      children.push(child);
      return child;
    });
    return { spawn, children };
  };

  test("只启动一次，在后台运行，传入管道名", () => {
    const { spawn, children } = fakeSpawn();
    const log = jest.fn();
    const launch = createHostLauncher({ hostPath: "C:\\figwin\\figwin-host.exe", pipeName: "figwin-overlay-v1-abc-1" }, log, spawn);
    launch();
    launch();
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledWith("C:\\figwin\\figwin-host.exe", ["--pipe", "figwin-overlay-v1-abc-1"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    expect((children[0] as unknown as { unref: jest.Mock }).unref).toHaveBeenCalled();
  });

  test("宿主程序不存在时只记日志，不抛出", () => {
    const { spawn, children } = fakeSpawn();
    const log = jest.fn();
    createHostLauncher({ hostPath: "missing.exe", pipeName: "p" }, log, spawn)();
    expect(() => children[0].emit("error", Object.assign(new Error("spawn missing.exe ENOENT"), { code: "ENOENT" }))).not.toThrow();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ msg: "overlay host failed to start" }));
    const throwing = jest.fn(() => {
      throw new Error("EACCES");
    });
    expect(() => createHostLauncher({ hostPath: "x", pipeName: "p" }, log, throwing)()).not.toThrow();
  });
});

describe("OverlayClient.onUnreachable", () => {
  const socketFailingWith = (code: string, afterConnect: boolean) => {
    const socket = Object.assign(new EventEmitter(), { write: () => true, end: () => {}, destroy: () => {} });
    setImmediate(() => {
      if (afterConnect) socket.emit("connect");
      socket.emit("error", Object.assign(new Error(code), { code }));
    });
    return socket as unknown as Duplex;
  };

  test.each([
    ["ENOENT", false, 1],
    ["ECONNREFUSED", false, 1],
    ["EPIPE", false, 0],
    ["ECONNRESET", true, 0],
  ])("连接失败 %s（已连上：%s）时调用 %i 次", async (code, afterConnect, calls) => {
    const onUnreachable = jest.fn();
    const client = new OverlayClient({
      endpoint: "fake",
      connect: () => socketFailingWith(code as string, afterConnect as boolean),
      onUnreachable,
      pid: 1,
      wtSession: null,
    });
    client.start();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    client.dispose();
    expect(onUnreachable).toHaveBeenCalledTimes(calls as number);
  });
});
