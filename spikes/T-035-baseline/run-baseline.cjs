// T-035: launch the official baseline with project-local runtime data.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const tool = path.join(root, 'local/tools/inshellisense-baseline');
const entry = path.join(tool, 'node_modules/@microsoft/inshellisense/bin.js');
if (!fs.existsSync(entry)) {
  console.error('Install the baseline first: npm install --prefix local/tools/inshellisense-baseline --save-exact @microsoft/inshellisense@0.0.4');
  process.exit(1);
}
if (process.platform !== 'win32') {
  console.error('This baseline harness is for Windows only.');
  process.exit(1);
}
const runtimeHome = path.join(tool, 'runtime-home');
fs.mkdirSync(runtimeHome, { recursive: true });
const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, USERPROFILE: runtimeHome },
  windowsHide: true,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
