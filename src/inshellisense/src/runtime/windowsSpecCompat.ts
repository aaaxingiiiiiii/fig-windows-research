/* eslint-disable header/header -- 本文件由 fig-windows-research 编写，版权声明与上游不同 */
// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
// T-055: narrow adaptations for the pinned @withfig/autocomplete package.

/** gh's GraphQL generator includes shell quotes inside a raw-field argv value. */
export const nativeGhArgs = (command: string, args: string[]): string[] => {
  if (!/^(?:gh|gh\.exe)$/i.test(command) || args[0] !== "api" || args[1] !== "graphql") return args;
  return args.map((arg, index) => {
    if (args[index - 1] !== "-f" && args[index - 1] !== "--raw-field") return arg;
    return arg.startsWith("query='") && arg.endsWith("'") ? `query=${arg.slice(7, -1)}` : arg;
  });
};

/** Windows drive paths take precedence over scp's colon separator; slashes before a colon denote local paths. */
export const isScpRemotePath = (token: string): boolean => {
  if (/^[a-z]:/i.test(token)) return false;
  if (token.startsWith("scp://")) return true;
  return /^(?:[^/\\:@]+@)?(?:\[[^\]]+\]|[^/\\:]+):/.test(token);
};
