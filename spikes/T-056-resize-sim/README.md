# T-056 改变窗口大小的自动检查

`resize-sim.cjs` 不需要用户操作，就能检查改变窗口大小后候选框是否错位：

- 用 xterm-headless 模拟外层终端，代替 Windows Terminal，并像真实终端一样回复光标位置查询；
- 内层用 node-pty 运行我们构建的 inshellisense 和指定的 shell，Windows 上内层是 ConPTY；
- 输入 `git ch` 后改变 4 次窗口大小，再输入一个字符；
- 每一步检查候选框是否紧贴光标所在的行。

```sh
# 在仓库根目录；先在 src/inshellisense 下 npm ci && npm run build
node spikes/T-056-resize-sim/resize-sim.cjs pwsh          # Windows 上的目标组合
node spikes/T-056-resize-sim/resize-sim.cjs pwsh --wrap   # 先输出会折行的长内容
node spikes/T-056-resize-sim/resize-sim.cjs zsh           # Mac 上对照
```

每一步输出一行 JSON：`aligned: false` 表示错位，退出码 1。

## 结果

2026-10-15，Mac（Node 20、PowerShell 7.6.7）：zsh、pwsh，以及各自加 `--wrap`，共 4 组，全部 `aligned: true`，**没有复现**。外层终端重新折行时，候选框也仍然紧贴光标。

推断：T-035 中看到的错位与 Windows 有关，可能是内层 ConPTY 在大小改变时的重绘，也可能是 Windows Terminal 自己的折行方式。在 Windows 上运行本脚本可以区分这两种：

- 出现 `aligned: false`：内层 ConPTY 的问题，可以在这里自动复现、调试和回归测试。
- 全部对齐：问题在 Windows Terminal 一侧，这个模拟器无法覆盖，需要用户手动复现，并提供 `-V` 日志。

已知情况：在 Mac 上大约 10 次运行中，有 1 次 inshellisense 在中途退出，脚本会输出 `inshellisense exited early` 并返回 1。原因没有查明，重跑即可；如果反复出现，记录 `tail` 字段的内容。
