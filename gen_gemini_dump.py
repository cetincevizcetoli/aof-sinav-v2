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

def list_lesson_json_names():
    names = []
    data_dir = os.path.join(ROOT, 'data')
    if os.path.isdir(data_dir):
        for fname in sorted(os.listdir(data_dir)):
            if fname.lower().endswith('.json') and fname not in {'changelog.json','tooltips.json','config.json'}:
                names.append(f"- {fname}")
    return "\n".join(names) if names else "(yok)"

def collect_critical_jsons():
    critical = [
        ('version.json', os.path.join(ROOT, 'version.json')),
        ('manifest.json', os.path.join(ROOT, 'manifest.json')),
        ('data/changelog.json', os.path.join(ROOT, 'data', 'changelog.json')),
        ('data/tooltips.json', os.path.join(ROOT, 'data', 'tooltips.json')),
        ('data/config.json', os.path.join(ROOT, 'data', 'config.json')),
    ]
    sections = []
    for label, path in critical:
        if not os.path.exists(path):
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            content = f"<okuma hatasi: {e}>"
        sections.append(f"### {label}\n\n```json\n{content}\n```\n")
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
        ,
        "",
        "## JSON Dosyaları",
        "### Ders JSON İsimleri",
        list_lesson_json_names(),
        "",
        "### Kritik JSON İçerikleri",
        collect_critical_jsons()
    ]
    content = "\n".join(header)
    with open(out, "w", encoding="utf-8") as f:
        f.write(content)
    print(out)

if __name__ == "__main__":
    main()
