// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { setupZshDotfiles, Shell } from "../utils/shell.js";

type RuntimeModule = typeof import("./runtime.js");

let runtimeInitialization: Promise<RuntimeModule> | undefined;

export const initializeRuntime = (shell: Shell): Promise<RuntimeModule> => {
  runtimeInitialization ??= (async () => {
    const zshSetup = shell == Shell.Zsh ? setupZshDotfiles() : Promise.resolve();
    const [runtime, alias] = await Promise.all([import("./runtime.js"), import("./alias.js")]);
    // fig-windows-research T-064: start the resident pwsh used for PowerShell's own commands
    if (shell == Shell.Pwsh) (await import("./powershellCompletion.js")).warmUpPowerShell();
    await Promise.all([runtime.loadLocalSpecsSet(), alias.loadAliases(shell), zshSetup]);
    return runtime;
  })();
  return runtimeInitialization;
};
