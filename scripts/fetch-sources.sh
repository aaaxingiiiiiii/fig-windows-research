#!/bin/sh
# 将研究用的开源参考仓库拉取到 local/sources/，固定到 research/sources.md 记录的 commit。
# 用法：sh scripts/fetch-sources.sh        （在仓库根目录运行；可重复执行）
set -eu

dest="local/sources"
mkdir -p "$dest"

fetch() {
  name=$1 url=$2 sha=$3
  dir="$dest/$name"
  if [ ! -d "$dir/.git" ]; then
    git init --quiet "$dir"
    git -C "$dir" remote add origin "$url"
  fi
  if [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null || true)" != "$sha" ]; then
    git -C "$dir" fetch --quiet --depth 1 origin "$sha"
    git -C "$dir" checkout --quiet --detach FETCH_HEAD
  fi
  echo "$name $(git -C "$dir" rev-parse --short HEAD)"
}

# 别名  仓库  commit（修改时同步更新 research/sources.md）
fetch amazon-q-developer-cli-autocomplete https://github.com/aws/amazon-q-developer-cli-autocomplete.git b654a1beb880951dd2343120bb867659622eecd9
fetch autocomplete https://github.com/withfig/autocomplete.git aef52acff84c45edde61ae610cc2c964802b9a38
fetch inshellisense https://github.com/microsoft/inshellisense.git 8dcc9ca3e3ee6f6d535577898639154f189f390b
