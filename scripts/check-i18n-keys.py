"""Every t("key") used in src/ must exist in src/messages/tr.json.

A translator variable is resolved to the nearest preceding `const X = useTranslations("ns")`
in the same file (each component declares its own at the top). Dynamic keys are listed for review.
"""
import json, re, sys, pathlib

msgs = json.load(open("src/messages/tr.json"))

def has(path):
    node = msgs
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return False
        node = node[part]
    return True

missing, dynamic = [], []
decl_re = re.compile(r'const (\w+) = (?:await )?(?:useTranslations|getTranslations)\("([\w.]+)"\)')
for f in pathlib.Path("src").rglob("*.ts*"):
    src = f.read_text()
    decls = [(m.start(), m.group(1), m.group(2)) for m in decl_re.finditer(src)]
    for var in {d[1] for d in decls}:
        def ns_at(pos):
            found = [d for d in decls if d[1] == var and d[0] < pos]
            return found[-1][2] if found else None
        for m in re.finditer(rf'(?<![\w.]){var}(?:\.rich|\.has)?\(\s*([`"])([^`"]*)\1', src):
            ns = ns_at(m.start())
            if ns is None:
                continue
            quote, key = m.groups()
            if quote == "`" or "${" in key:
                dynamic.append(f"{f}: {ns}.{key}")
            elif not has(f"{ns}.{key}"):
                missing.append(f"{f}: {ns}.{key}")
        for m in re.finditer(rf'(?<![\w.]){var}\(\s*([a-zA-Z_][\w.]*)\s*[,)]', src):
            ns = ns_at(m.start())
            if ns:
                dynamic.append(f"{f}: {ns}.<{m.group(1)}>")

print("MISSING:", *sorted(set(missing)), sep="\n  ")
print("DYNAMIC (review):", *sorted(set(dynamic)), sep="\n  ")
sys.exit(1 if missing else 0)
