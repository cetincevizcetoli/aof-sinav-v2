# Sync v3.0 – Otomatik Senkronizasyon Toplantı Notu

## Sorun Tanımı
- Masaüstünde BIL209U dersinde bir üniteden 1 soru çözüldü; ilerleme arttı.
- Mobilde aynı hesapla giriş yapıldığında otomatik yükleme gerçekleşmiyor; ilerleme görünmüyor.
- Manuel “Sunucuya Yükle / Sunucudan Yükle” kaldırıldı; otomatik senkron bekleniyor ancak tetiklenmiyor gibi.

## Yapılan Revizyonlar (Sync v3.0)
- Last-Write-Wins (timestamp) stratejisi getirildi; veri büyüklüğü yerine `updated_at` kıyaslanıyor.
- History tekilleştirme için `uuid` alanı ve benzersiz indeks eklendi.
- Hafif polling `action=check_version` ile 10 saniyede bir sunucu son güncelleme kontrolü.
- Otomatik iki yönlü senkronizasyon: pull → merge (timestamp) → local overwrite → push local-new → update last_sync.

## Değişen Dosyalar ve Referanslar
- `api/db.php`
  - Şema: `progress.updated_at`, `user_stats.updated_at`: c:\nginx-1.27.5\html\aof-sinav-v2\api\db.php:41–42
  - `exam_history` `uuid` ekleme ve indeks: c:\nginx-1.27.5\html\aof-sinav-v2\api\db.php:47–52
- `api/sync.php`
  - `action=check_version`: c:\nginx-1.27.5\html\aof-sinav-v2\api\sync.php:6–13
  - Progress push timestamp kıyaslaması: c:\nginx-1.27.5\html\aof-sinav-v2\api\sync.php:18–33
  - Stats push timestamp kıyaslaması: c:\nginx-1.27.5\html\aof-sinav-v2\api\sync.php:35–48
  - History tekilleştirme (`INSERT IGNORE` + `uuid`): c:\nginx-1.27.5\html\aof-sinav-v2\api\sync.php:50–53
  - Pull yanıtta `stats.updated_at` ve `history.uuid`: c:\nginx-1.27.5\html\aof-sinav-v2\api\sync.php:56–62
- `js/core/db.js`
  - `saveProgress` yerelde `updated_at: Date.now()`: c:\nginx-1.27.5\html\aof-sinav-v2\js\core\db.js:93–113
  - `updateUserStats` `updated_at: Date.now()`: c:\nginx-1.27.5\html\aof-sinav-v2\js\core\db.js:153–160
  - `logActivity` uuid v4 üretimi ve kaydı: c:\nginx-1.27.5\html\aof-sinav-v2\js\core\db.js:200–213
- `js/core/sync.js`
  - `pushAll` ve `pullAll` içinde `updated_at` alanları ile payload: c:\nginx-1.27.5\html\aof-sinav-v2\js\core\sync.js:11–12
  - `autoSync` timestamp-based merge ve pushQueue: c:\nginx-1.27.5\html\aof-sinav-v2\js\core\sync.js:16–41
- `js/app.js`
  - Kısa polling (10sn) ve tetikleme: c:\nginx-1.27.5\html\aof-sinav-v2\js\app.js:32–41

## Beklenen Davranış
- Mobil cihazda, login sonrası ve çevrimiçi iken 10sn aralıklarla `check_version` çağrısı yapılır.
- Sunucu `last_server_update` > local `last_sync` ise `autoSync()` tetiklenir.
- `autoSync()` pull → timestamp merge → local overwrite → gerekirse sunucuya push; ardından `last_sync` güncellenir.

## Mevcut Gözlem / Hata
- Mobilde `check_version` çağrısı görülmüyor olabilir veya `last_server_update` localden küçük/ eşit kaldığı için `autoSync` tetiklenmiyor olabilir.
- SW/Cache nedeniyle eski JS çalışıyor olabilir (mobilde eski service worker). Hard refresh gerekebilir.
- Token eşleşmesi: Masaüstünde üretilen token ile mobildeki token farklıysa farklı kullanıcı verisi çekiliyor olabilir.

## Doğrulama Adımları
1) Mobil DevTools → Network:
   - `GET /api/sync.php?action=check_version` her 10sn’da bir gidiyor mu?
   - Yanıt `{ last_server_update }` local `last_sync`’ten büyükse hemen sonrasında `autoSync` ile `pull`/`push` görülebilmeli.
2) `GET /api/sync.php?action=pull` yanıtında BIL209U kartları için `progress` listesinde `level/correct/wrong/updated_at` beklenen değerler geliyor mu?
3) `localStorage.auth_token` her iki cihazda aynı mı?
4) Mobilde SW güncel mi? `service-worker.js` cache adı `v1.1.31`; güçlü yenileme (Ctrl+F5) veya SW reset.

## Olası Nedenler ve Çözüm Önerileri
- Eski Service Worker/JS:
  - Çözüm: Cache sürümünü artırıp (SW) hard refresh; mobilde “Güçlü Yenileme” veya SW unregister + reload.
- Token Uyumsuzluğu:
  - Çözüm: Mobilde logout/login aynı email; `auth.php?action=me` ile doğrulama.
- Saat Farkı (Client vs Server):
  - Çözüm: `push` sırasında `updated_at` boşsa server `time()` set ediyor; merge tarafında client-side `updated_at` zorunlu; mevcut kod set ediyor. Yanıtında `updated_at` dönüyor.
- BIL209U ID Eşleşmesi:
  - Çözüm: Kart `id` formatı `LESSON_UNITCARD` (ör: `BIL209U_U3_Q15` gibi); her iki cihazda aynı id yazılıyor mu? `db.saveProgress` lesson/unit parse ediyor.

## Hızlı Test (cURL)
- Version Check:
  - `curl -H "Authorization: Bearer {TOKEN}" "https://www.acetin.com.tr/aof-sinav-v2/api/sync.php?action=check_version"`
- Pull:
  - `curl -H "Authorization: Bearer {TOKEN}" "https://www.acetin.com.tr/aof-sinav-v2/api/sync.php?action=pull"`
- Push (örnek payload):
  - `curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer {TOKEN}" -d '{"progress":[{"id":"BIL209U_U3_Q15","level":2,"updated_at":1732812345}],"stats":{"xp":10,"updated_at":1732812345},"history":[{"lesson":"BIL209U","unit":3,"isCorrect":1,"date":1732812345,"uuid":"..."}]}' "https://www.acetin.com.tr/aof-sinav-v2/api/sync.php?action=push"`

## Geçici Çözüm (Debug)
- Mobilde menüye geçici “Senkronu Zorla” eklenebilir (sadece debug döneminde). `autoSync()` direkt tetikler.
- Loglama: `autoSync` başında/sonunda `console.log` ile `last_sync`, `last_server_update`, pushQueue ölçümleri.

## Sonuç
- Sync v3.0 kodları canlı; otomatik senkron için polling + merge çalışmalı.
- Mobilde eski SW/JS veya token uyuşmazlığı en olası nedenler.
- Doğrulama adımlarına göre düzeltme/iyileştirme yapılacaktır.
