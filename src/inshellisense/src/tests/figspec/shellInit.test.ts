// Copyright (c) fig-windows-research contributors.
// Licensed under the MIT License.
/* eslint-disable header/header */

// fig-windows-research T-062: the generated PowerShell init script must not close the shell when `is` fails to start,
// otherwise an invalid config or a missing program closes every new PowerShell window.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import which from "which";
import { getShellConfig, Shell } from "../../utils/shell.js";

const pwsh = which.sync("pwsh", { nothrow: true });
// the init script only starts `is` in an interactive session; services and some CI runners are not
const interactive =
  pwsh != null && spawnSync(pwsh, ["-NoLogo", "-NoProfile", "-Command", "[Environment]::UserInteractive"], { encoding: "utf8" }).stdout.trim() === "True";
const pwshTest = interactive ? test : test.skip;

// runs the init script in an interactive-looking pwsh (-NoExit -Command) with a fake `is` that exits with the given code
const runInit = (exitCode: number) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "figwin-init-"));
  try {
    const init = path.join(dir, "init.ps1");
    fs.writeFileSync(init, getShellConfig(Shell.Pwsh));
    if (process.platform === "win32") {
      fs.writeFileSync(path.join(dir, "is.cmd"), `@exit /b ${exitCode}\r\n`);
    } else {
      fs.writeFileSync(path.join(dir, "is"), `#!/bin/sh\nexit ${exitCode}\n`);
      fs.chmodSync(path.join(dir, "is"), 0o755);
    }
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH ?? ""}` };
    delete env.ISTERM;
    delete env.VSCODE_RESOLVING_ENVIRONMENT;
    const result = spawnSync(pwsh!, ["-NoLogo", "-NoProfile", "-NoExit", "-Command", `. '${init}'; 'still-alive'; exit 0`], {
      env,
      encoding: "utf8",
      input: "",
      timeout: 60_000,
    });
    return { alive: result.stdout.includes("still-alive"), status: result.status };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

test("pwsh init script only stops the outer shell when is succeeds", () => {
  expect(getShellConfig(Shell.Pwsh)).toContain("  is -s pwsh\n  if ($?) { Stop-Process -Id $pid }\n");
  expect(getShellConfig(Shell.Powershell)).toContain("  is -s powershell\n  if ($?) { Stop-Process -Id $pid }\n");
  // T-063: the logon session for the overlay host endpoint
  expect(getShellConfig(Shell.Pwsh)).toContain("  $env:FIGWIN_LOGON_SESSION = [System.Diagnostics.Process]::GetCurrentProcess().SessionId\n  is -s pwsh\n");
});

pwshTest(
  "outer pwsh stays usable when is fails to start",
  () => {
    expect(runInit(1)).toEqual({ alive: true, status: 0 });
  },
  60_000,
);

pwshTest(
  "outer pwsh is closed after is ends normally",
  () => {
    expect(runInit(0).alive).toBe(false);
  },
  60_000,
);
