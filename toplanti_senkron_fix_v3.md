# Sync v3.0 – Otomatik Senkronizasyon Düzeltme Notu

## Sorun
- Masaüstünde BIL209U dersinde ilerleme artıyor; mobilde aynı hesapla açılınca otomatik senkron çalışmıyor ve ilerleme görünmüyor.

## Yapılan Kod Değişiklikleri
- Timestamp – Last Write Wins
  - `progress.updated_at` ve `user_stats.updated_at` alanları kullanılıyor: api/db.php:41–42
  - Sunucu push’ta eski zamanlı veriyi ezmiyor, sadece daha yeni veriyle güncelliyor: api/sync.php:18–33, 35–48
- History Tekilleştirme
  - `exam_history.uuid` kolonu ve benzersiz indeks eklendi/denetleniyor: api/db.php:47–52
  - Push’ta `INSERT IGNORE` ve uuid kontrolü: api/sync.php:50–53
- Hafif Polling (10sn)
  - `action=check_version`: api/sync.php:6–13
  - İstemci kısa aralıklarla kontrol edip daha yeni sunucu verisi varsa `autoSync()` tetikliyor: js/app.js:32–41
- İstemci Tarafı
  - Lokal kayıtlar `updated_at` ile tutuluyor: js/core/db.js:93–113, 153–160
  - Sınav geçmişine uuid yazılıyor: js/core/db.js:200–213
  - Merge algoritması timestamp tabanlı ve pushQueue ile sadece daha yeni yerel kayıtları sunucuya yazıyor: js/core/sync.js:16–41

## Beklenen Akış
- Mobilde login/online/görünür olduğunda her 10 saniyede `check_version` çağrılır.
- `last_server_update > last_sync` ise `autoSync()` → pull → merge (timestamp) → local overwrite → gerekliyse push → `last_sync` güncellenir.

## Mevcut Hata Olasılıkları
- Eski Service Worker/JS kullanımı (mobilde cache):
  - SW cache adı sürüm yükseltilmiş olsa da cihazda tam yenileme yapılmadıysa eski JS kalmış olabilir.
- Token uyuşmazlığı:
  - Masaüstü ve mobilde `localStorage.auth_token` farklı olabilir; bu durumda farklı hesabın verisi çekilir.
- Saat farkı / `updated_at` boş kayıtlar:
  - Push sırasında `updated_at` boşsa server `time()` ile doldurur; client tarafı tüm yazımlarda `updated_at` set eder.

## Doğrulama – Hızlı Kontrol Listesi
- Service Worker
  - Mobilde güçlü yenileme (Ctrl+F5 veya SW unregister → reload); `service-worker.js` cache adı `v1.1.31` olmalı: service-worker.js:1–3
- Token
  - Her iki cihazda `auth.php?action=me` sonucu aynı kullanıcı mı: api/auth.php:75–84
- Polling
  - Mobil DevTools Network: `GET /api/sync.php?action=check_version` çağrıları 10sn aralıklarla geliyor mu: api/sync.php:6–13
- Pull Yanıtı
  - `GET /api/sync.php?action=pull` içinde BIL209U için `progress[id, level, updated_at]` beklenen mi: api/sync.php:56–62
- Lokal Yazım
  - Sınav bitirince `exam_history.uuid` üretiliyor mu: js/core/db.js:200–213
  - Kart güncellemede `updated_at` set ediliyor mu: js/core/db.js:93–113

## Geçici Yardımcı Adım (Debug)
- Mobil ayarlar menüsüne geçici “Senkronu Zorla” butonu eklenirse `autoSync()` hemen çalışır ve akış gözlenir.
- `autoSync()` içine `console.log` ile `last_sync`, `last_server_update` ve `pushQueue.length` loglanabilir: js/core/sync.js:16–41

## Sonuç
- Sync v3.0 kodları canlı ve git’e gönderildi; otomatik senkron için polling + timestamp merge devrede.
- Sorun devam ediyorsa en olası neden SW’nin eski JS tutması veya token uyuşmazlığıdır. Yukarıdaki kontrol listesi ile teşhis edelim; gerekirse “Senkronu Zorla” geçici butonu ekleyip sahada doğrulama yapalım.
