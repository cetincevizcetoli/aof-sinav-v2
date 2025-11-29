import os
import re
from datetime import datetime

ROOT = os.path.dirname(os.path.abspath(__file__))

def next_meeting_filename():
    pattern = re.compile(r"^gemini_toplanti_(\d+)\.(md|txt)$", re.IGNORECASE)
    max_n = 0
    for name in os.listdir(ROOT):
        m = pattern.match(name)
        if m:
            try:
                n = int(m.group(1))
                if n > max_n:
                    max_n = n
            except ValueError:
                pass
    return os.path.join(ROOT, f"gemini_toplanti_{max_n+1}.md")

def build_tree():
    lines = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT)
        if rel == ".":
            rel = ""
        # Skip some heavy or irrelevant folders
        if any(part.lower() in {".git", "node_modules", "backups"} for part in dirpath.split(os.sep)):
            continue
        lines.append(f"- {rel if rel else '.'}")
        for fname in sorted(filenames):
            lines.append(f"  - {fname}")
    return "\n".join(lines)

def collect_sources():
    sections = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        if any(part.lower() in {".git", "node_modules", "backups"} for part in dirpath.split(os.sep)):
            continue
        for fname in sorted(filenames):
            ext = os.path.splitext(fname)[1].lower()
            if ext in {".js", ".php"}:
                path = os.path.join(dirpath, fname)
                rel = os.path.relpath(path, ROOT)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        code = f.read()
                except Exception as e:
                    code = f"<okuma hatasi: {e}>"
                fence = "```javascript" if ext == ".js" else "```php"
                sections.append(f"### {rel}\n\n{fence}\n{code}\n```\n")
    return "\n".join(sections)

def main():
    out = next_meeting_filename()
    header = [
        f"# Gemini Toplantı Paketi",
        f"Tarih: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "## Dizin Yapısı",
        build_tree(),
        "",
        "## Kaynak Kodlar (PHP & JS)",
        collect_sources()
    ]
    content = "\n".join(header)
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)
    print(out)

if __name__ == "__main__":
    main()

