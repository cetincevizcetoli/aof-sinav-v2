import json
import re
import datetime
import os

VERSION_FILE = 'version.json'
SW_FILE = 'service-worker.js'
CHANGELOG_FILE = os.path.join('data','changelog.json')

def bump_version():
    if not os.path.exists(VERSION_FILE):
        print('Hata: version.json bulunamadı.')
        return
    with open(VERSION_FILE, 'r', encoding='utf-8') as f:
        v_data = json.load(f)
    current_ver = v_data.get('version', '1.0.0')
    print(f'Mevcut Sürüm: {current_ver}')
    parts = current_ver.split('.')
    if len(parts) == 3:
        parts[2] = str(int(parts[2]) + 1)
        new_ver = '.'.join(parts)
    else:
        new_ver = input('Yeni sürümü girin (örn: 1.1.33): ').strip()
        if not new_ver:
            print('Hata: geçerli sürüm girilmedi.')
            return
    print(f'Hedef Sürüm: {new_ver} uygulanıyor...')
    v_data['version'] = new_ver
    with open(VERSION_FILE, 'w', encoding='utf-8') as f:
        json.dump(v_data, f, indent=2, ensure_ascii=False)
    print(f'✅ {VERSION_FILE} güncellendi.')
    if not os.path.exists(SW_FILE):
        print('Uyarı: service-worker.js bulunamadı.')
    else:
        with open(SW_FILE, 'r', encoding='utf-8') as f:
            sw_content = f.read()
        sw_content = re.sub(r'static-v\d+\.\d+\.\d+', f'static-v{new_ver}', sw_content)
        sw_content = re.sub(r'data-v\d+\.\d+\.\d+', f'data-v{new_ver}', sw_content)
        with open(SW_FILE, 'w', encoding='utf-8') as f:
            f.write(sw_content)
        print(f'✅ {SW_FILE} cache isimleri güncellendi.')
    if os.path.exists(CHANGELOG_FILE):
        try:
            with open(CHANGELOG_FILE, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        except Exception:
            logs = []
        new_entry = {
            'version': new_ver,
            'date': datetime.date.today().isoformat(),
            'items': ['Genel iyileştirmeler ve hata düzeltmeleri.']
        }
        if isinstance(logs, list):
            logs.insert(0, new_entry)
        else:
            logs = [new_entry]
        with open(CHANGELOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(logs, f, indent=2, ensure_ascii=False)
        print(f'✅ {CHANGELOG_FILE} dosyasına şablon eklendi.')
    print(f'\n🚀 Başarılı! Sistem v{new_ver} sürümüne taşındı.')

if __name__ == '__main__':
    bump_version()

