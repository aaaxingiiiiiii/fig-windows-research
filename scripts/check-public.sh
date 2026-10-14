#!/bin/sh
# 提交前的公开边界检查：扫描已跟踪和已暂存的文件。发现问题时退出码为 1。
# 只是辅助手段，不能代替人工查看 git diff --cached。
# 用法：sh scripts/check-public.sh
set -u
fail=0

warn() { printf '[check-public] %s\n' "$1"; fail=1; }

# 1. local/ 等原始材料目录不得进入版本库
if git ls-files --cached | grep -E '^(local|artifacts|captures|raw-evidence)/' >/dev/null; then
  warn "local/ 或原始证据目录中的文件已被跟踪："
  git ls-files --cached | grep -E '^(local|artifacts|captures|raw-evidence)/'
fi

# 2. 本机路径、用户名、令牌、私钥
user=$(id -un 2>/dev/null || echo "")
pattern='/Users/[A-Za-z0-9._-]+/|/home/[a-z0-9._-]+/|[A-Za-z]:\\Users\\|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|github_pat_|sk-[A-Za-z0-9_-]{20,}|xox[bpa]-|BEGIN [A-Z ]*PRIVATE KEY'
if git grep --cached -nIE "$pattern" -- . ':!scripts/check-public.sh' ; then
  warn "以上行疑似包含本机路径或凭据。"
fi
if [ -n "$user" ] && [ ${#user} -ge 4 ] && git grep --cached -nIw -F "$user" -- . ':!scripts/check-public.sh' ; then
  warn "以上行包含当前系统用户名 \"$user\"。"
fi

# 3. 大文件或二进制文件
git ls-files --cached -z | xargs -0 -I{} sh -c '
  f="{}"; [ -f "$f" ] || exit 0
  size=$(wc -c < "$f" | tr -d " ")
  if [ "$size" -gt 1048576 ]; then echo "[check-public] 大于 1 MB：$f"; exit 1; fi
' || fail=1

if [ "$fail" -eq 0 ]; then
  echo "[check-public] 通过（仍需人工查看 git diff --cached）"
fi
exit "$fail"
