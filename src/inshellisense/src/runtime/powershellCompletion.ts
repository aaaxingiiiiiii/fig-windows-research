/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
//
// T-064（最小实现）：PowerShell 自己的命令（cmdlet、函数、别名）及其参数，用 PowerShell 的原生补全（TabExpansion2）。
// 调研和推荐的做法见 research/powershell-native-completion.md（F-038）。
// - 一个常驻的 pwsh（-NoProfile），第一次需要时启动；按行收发 JSON；每个请求最多等 1.5 秒；进程退出后下次需要时重启。
// - 只用于 pwsh。命令是外部程序（git、npm）并且有 Fig 规格时照旧用 Fig；命令是 PowerShell 自己的（例如 Windows 上的 ls 是
//   Get-ChildItem 的别名），或者没有 Fig 规格时，用 PowerShell。
// - PowerShell 给出的替换范围必须正好是正在输入的那个词，否则不给候选，避免插错。
// 局限：看不到用户 profile 和当前会话中定义的函数、别名；只在行尾补全。

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import which from "which";

import log from "../utils/log.js";
import type { CommandToken } from "./parser.js";
import type { Suggestion, SuggestionBlob } from "./model.js";
import { typedCharCount } from "./replacement.js";
import { SuggestionIcons } from "./suggestion.js";

export type CompletionMatch = { text: string; list: string; type: string; tip?: string };
export type CompletionResult = { index: number; length: number; matches: CompletionMatch[] };
export type PowerShellBackend = {
  complete(line: string, cwd: string, signal?: AbortSignal): Promise<CompletionResult | undefined>;
  commandType(name: string, signal?: AbortSignal): Promise<string | undefined>;
};

const REQUEST_TIMEOUT_MS = 1500;
const MAX_MATCHES = 50;
// PowerShell 自己的命令：用原生补全；Application（外部程序）有 Fig 规格时用 Fig
const POWERSHELL_COMMAND_TYPES = new Set(["Alias", "Cmdlet", "Function", "Filter", "ExternalScript"]);

// 在 pwsh 中运行的循环：每行一个请求，每行一个回复
const WORKER_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $id = $null
  try {
    $request = $line | ConvertFrom-Json
    $id = $request.id
    if ($request.op -eq 'kind') {
      $command = Get-Command -Name $request.name -ErrorAction SilentlyContinue | Select-Object -First 1
      $reply = @{ id = $id; kind = $(if ($command) { "$($command.CommandType)" } else { $null }) }
    }
    else {
      if ($request.cwd) { Set-Location -LiteralPath $request.cwd -ErrorAction SilentlyContinue }
      $result = TabExpansion2 -inputScript $request.line -cursorColumn $request.line.Length
      $items = @($result.CompletionMatches | Select-Object -First ${MAX_MATCHES} | ForEach-Object {
        @{ text = $_.CompletionText; list = $_.ListItemText; type = "$($_.ResultType)"; tip = $_.ToolTip }
      })
      $reply = @{ id = $id; index = $result.ReplacementIndex; length = $result.ReplacementLength; matches = $items }
    }
  }
  catch {
    $reply = @{ id = $id; error = "$_" }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject $reply -Compress -Depth 4))
  [Console]::Out.Flush()
}
`;

type Pending = { resolve: (value: Record<string, unknown> | undefined) => void; timer: NodeJS.Timeout };

/** 常驻的 pwsh。第一次请求时启动，进程退出后下次请求时重启。 */
export class PowerShellWorker implements PowerShellBackend {
  readonly #executable: string;
  #process?: ChildProcessWithoutNullStreams;
  #nextId = 1;
  readonly #pending = new Map<number, Pending>();

  constructor(executable: string) {
    this.#executable = executable;
  }

  #start(): ChildProcessWithoutNullStreams {
    // -EncodedCommand（UTF-16LE 的 Base64）：避免 Windows 命令行对引号和换行的转义问题
    const encoded = Buffer.from(WORKER_SCRIPT, "utf16le").toString("base64");
    const child = spawn(this.#executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], { stdio: "pipe", windowsHide: true });
    child.stdin.on("error", () => {});
    readline.createInterface({ input: child.stdout }).on("line", (line) => {
      let reply: Record<string, unknown>;
      try {
        reply = JSON.parse(line);
      } catch {
        return;
      }
      const pending = typeof reply.id === "number" ? this.#pending.get(reply.id) : undefined;
      if (pending == null) return;
      this.#pending.delete(reply.id as number);
      clearTimeout(pending.timer);
      pending.resolve(reply.error != null ? undefined : reply);
    });
    const exited = () => {
      if (this.#process === child) this.#process = undefined;
      for (const [id, pending] of this.#pending) {
        clearTimeout(pending.timer);
        pending.resolve(undefined);
        this.#pending.delete(id);
      }
    };
    child.on("exit", exited);
    child.on("error", (error) => {
      log.debug({ msg: "powershell completion worker failed", error: error.message });
      exited();
    });
    child.unref();
    return child;
  }

  #request(body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown> | undefined> {
    if (signal?.aborted) return Promise.resolve(undefined);
    this.#process ??= this.#start();
    const id = this.#nextId++;
    return new Promise((resolve) => {
      const done = (value: Record<string, unknown> | undefined) => {
        if (!this.#pending.has(id)) return;
        clearTimeout(this.#pending.get(id)!.timer);
        this.#pending.delete(id);
        resolve(value);
      };
      const timer = setTimeout(() => done(undefined), REQUEST_TIMEOUT_MS);
      this.#pending.set(id, { resolve, timer });
      signal?.addEventListener("abort", () => done(undefined), { once: true });
      this.#process!.stdin.write(JSON.stringify({ id, ...body }) + "\n");
    });
  }

  async complete(line: string, cwd: string, signal?: AbortSignal): Promise<CompletionResult | undefined> {
    const reply = await this.#request({ op: "complete", line, cwd }, signal);
    if (reply == null || typeof reply.index !== "number" || typeof reply.length !== "number" || !Array.isArray(reply.matches)) return undefined;
    return { index: reply.index, length: reply.length, matches: reply.matches as CompletionMatch[] };
  }

  async commandType(name: string, signal?: AbortSignal): Promise<string | undefined> {
    const reply = await this.#request({ op: "kind", name }, signal);
    return typeof reply?.kind === "string" ? reply.kind : undefined;
  }

  dispose(): void {
    this.#process?.kill();
    this.#process = undefined;
  }
}

let backend: PowerShellBackend | null | undefined;
const commandTypes = new Map<string, string | undefined>();

/** 测试用：替换后端（null 表示没有 pwsh）。 */
export const setPowerShellBackend = (value: PowerShellBackend | null | undefined): void => {
  backend = value;
  commandTypes.clear();
};

const getBackend = (): PowerShellBackend | null => {
  if (backend === undefined) {
    const executable = which.sync("pwsh", { nothrow: true });
    backend = executable != null ? new PowerShellWorker(executable) : null;
  }
  return backend;
};

/** 提前启动常驻的 pwsh（启动约需 1 秒），免得第一次补全时等待。 */
export const warmUpPowerShell = (): void => {
  void isPowerShellCommand("Get-ChildItem");
};

/** 命令是不是 PowerShell 自己的（cmdlet、函数、别名、脚本）。结果按命令名缓存。 */
export const isPowerShellCommand = async (name: string, signal?: AbortSignal): Promise<boolean> => {
  const worker = getBackend();
  if (worker == null) return false;
  const key = name.toLowerCase();
  if (!commandTypes.has(key)) {
    const kind = await worker.commandType(name, signal);
    if (signal?.aborted) return false;
    commandTypes.set(key, kind);
  }
  const kind = commandTypes.get(key);
  return kind != null && POWERSHELL_COMMAND_TYPES.has(kind);
};

const iconFor = (type: string): string => {
  switch (type) {
    case "ParameterName":
      return SuggestionIcons.Option;
    case "ProviderContainer":
      return SuggestionIcons.Folder;
    case "ProviderItem":
      return SuggestionIcons.File;
    case "Command":
      return SuggestionIcons.Subcommand;
    default:
      return SuggestionIcons.Argument;
  }
};

const figTypeFor = (type: string): Fig.SuggestionType => {
  switch (type) {
    case "ParameterName":
      return "option";
    case "ProviderContainer":
      return "folder";
    case "ProviderItem":
      return "file";
    case "Command":
      return "subcommand";
    default:
      return "arg";
  }
};

/** 把原生补全的结果转换成候选。替换范围不是正在输入的那个词时返回 undefined。 */
export const toSuggestionBlob = (line: string, token: CommandToken | undefined, result: CompletionResult): SuggestionBlob | undefined => {
  if (result.index + result.length !== line.length) return undefined;
  const expectedLength = token == null || token.complete ? 0 : typedCharCount(token);
  if (result.length !== expectedLength) return undefined;
  const suggestions = result.matches
    .filter((match) => typeof match.text === "string" && match.text.length > 0)
    .map(
      (match): Suggestion => ({
        name: match.text,
        allNames: [match.text],
        description: match.tip != null && match.tip.trim() !== match.text ? match.tip.trim() : undefined,
        icon: iconFor(match.type),
        priority: 50,
        // 目录后面不加空格，便于继续输入下一级
        insertValue: match.type === "ProviderContainer" ? match.text : match.text + " ",
        type: figTypeFor(match.type),
      }),
    );
  if (suggestions.length === 0) return undefined;
  return { suggestions, activeToken: token != null && !token.complete ? token : undefined };
};

/** 用 PowerShell 的原生补全得到候选；没有 pwsh、超时或范围对不上时返回 undefined。 */
export const getPowerShellSuggestions = async (
  line: string,
  cwd: string,
  token: CommandToken | undefined,
  signal?: AbortSignal,
): Promise<SuggestionBlob | undefined> => {
  const worker = getBackend();
  if (worker == null) return undefined;
  const result = await worker.complete(line, cwd, signal);
  if (result == null || signal?.aborted) return undefined;
  return toSuggestionBlob(line, token, result);
};
