/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-063：悬浮窗宿主的端点和自动启动（docs/protocol.md 第 2 节，D-016）。
// - 明确设置了 FIGWIN_OVERLAY_PIPE（完整端点）：照原样使用，不启动宿主（开发和测试用）。
// - 否则，配置文件中 [overlay] enabled = true 时，使用按用户和登录会话隔离的默认端点
//   figwin-overlay-v1-<userKey>-<logonSession>。登录会话编号来自 FIGWIN_LOGON_SESSION，由 PowerShell 的初始化脚本设置
//   （Node 读不到它）。宿主的 OverlayEndpoint（C#）用同样的规则计算，两边的测试使用同一组数据。
// - 连不上宿主时，启动 is.exe 旁边的宿主程序（或配置中的 hostPath），每个会话最多启动一次。

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { ENDPOINT_ENV } from "./protocol.js";

export const LOGON_SESSION_ENV = "FIGWIN_LOGON_SESSION";

export type OverlayConfig = { enabled: boolean; hostPath?: string };
export type HostLaunch = { hostPath: string; pipeName: string };
export type OverlayTarget = { endpoint: string; launch?: HostLaunch };

/** 用户名转小写后的 SHA-256，取前 16 个十六进制字符。只用来区分用户，不是凭据。 */
export const userKey = (userName: string): string => createHash("sha256").update(userName.toLowerCase(), "utf8").digest("hex").slice(0, 16);

export const defaultPipeName = (userName: string, logonSession: string): string => `figwin-overlay-v1-${userKey(userName)}-${logonSession}`;

/** 与宿主的 PipeServer.EndpointPath 相同：Windows 上是命名管道；其他系统上 .NET 用 Unix 域套接字实现。 */
export const endpointPath = (pipeName: string, platform: NodeJS.Platform = process.platform, tmpdir: string = os.tmpdir()): string =>
  platform === "win32" ? `\\\\.\\pipe\\${pipeName}` : path.join(tmpdir, `CoreFxPipe_${pipeName}`);

/** 安装包把宿主放在 is.exe 旁边。 */
export const defaultHostPath = (execPath: string = process.execPath, platform: NodeJS.Platform = process.platform): string =>
  path.join(path.dirname(execPath), platform === "win32" ? "figwin-host.exe" : "figwin-host");

const currentUserName = (): string | undefined => {
  try {
    return os.userInfo().username;
  } catch {
    return undefined;
  }
};

export const resolveOverlayTarget = (
  env: NodeJS.ProcessEnv,
  overlay: OverlayConfig,
  options: { userName?: string; platform?: NodeJS.Platform; tmpdir?: string; execPath?: string } = {},
): OverlayTarget | undefined => {
  const explicit = env[ENDPOINT_ENV];
  if (explicit != null && explicit.length > 0) return { endpoint: explicit };
  if (!overlay.enabled) return undefined;
  const session = env[LOGON_SESSION_ENV];
  const userName = options.userName ?? currentUserName();
  if (session == null || !/^\d{1,10}$/.test(session) || !userName) return undefined;
  const pipeName = defaultPipeName(userName, session);
  return {
    endpoint: endpointPath(pipeName, options.platform, options.tmpdir),
    launch: { hostPath: overlay.hostPath ?? defaultHostPath(options.execPath, options.platform), pipeName },
  };
};

type SpawnLike = (
  file: string,
  args: string[],
  options: { detached: boolean; stdio: "ignore"; windowsHide: boolean },
) => { on(event: "error", listener: (error: Error) => void): unknown; unref(): void };

/** 返回一个函数：第一次调用时在后台启动宿主（不等待、不继承输入输出），之后的调用什么都不做。启动失败只记日志。 */
export const createHostLauncher = (launch: HostLaunch, log: (message: Record<string, unknown>) => void, spawnFn: SpawnLike = spawn): (() => void) => {
  let started = false;
  return () => {
    if (started) return;
    started = true;
    try {
      const child = spawnFn(launch.hostPath, ["--pipe", launch.pipeName], { detached: true, stdio: "ignore", windowsHide: true });
      child.on("error", (error) => log({ msg: "overlay host failed to start", hostPath: launch.hostPath, error: error.message }));
      child.unref();
      log({ msg: "overlay host started", hostPath: launch.hostPath, pipeName: launch.pipeName });
    } catch (error) {
      log({ msg: "overlay host failed to start", hostPath: launch.hostPath, error: error instanceof Error ? error.message : String(error) });
    }
  };
};
