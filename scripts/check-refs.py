"""检查 research/、specs/、docs/ 中的源码引用（aq:/wf:/is: 及 APP/PAR/SH/CR 缩写）是否存在、行号是否越界。
用法：先运行 sh scripts/fetch-sources.sh，再运行 python3 scripts/check-refs.py"""
import re, sys, pathlib
root = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "."); src = root / "local/sources"
alias = {"aq": "amazon-q-developer-cli-autocomplete", "wf": "autocomplete", "is": "inshellisense"}
abbr = {"APP": "aq:packages/autocomplete-app/src", "PAR": "aq:packages/autocomplete-parser/src",
        "SH": "aq:packages/shell-parser/src", "CR": "aq:crates"}
pat = re.compile(r"`((?:aq|wf|is|APP|PAR|SH|CR)[:/][^`#\s]+)(?:#L(\d+)(?:-L(\d+))?)?`")
bad = 0; n = 0
for md in list(root.glob("research/*.md")) + list(root.glob("specs/*.md")) + list(root.glob("docs/*.md")):
    for m in pat.finditer(md.read_text(encoding="utf-8")):
        ref, a, b = m.group(1), m.group(2), m.group(3)
        for k, v in abbr.items():
            if ref.startswith(k + "/"): ref = v + ref[len(k):]
        al, path = ref.split(":", 1)
        f = src / alias[al] / path
        n += 1
        if not f.exists():
            print(f"MISSING {md.name}: {m.group(0)}"); bad += 1; continue
        if f.is_file() and a:
            L = sum(1 for _ in open(f, encoding="utf-8", errors="ignore"))
            if int(b or a) > L: print(f"OUT-OF-RANGE {md.name}: {m.group(0)} (file has {L})"); bad += 1
print(f"checked {n} refs, {bad} problems")
sys.exit(1 if bad else 0)
