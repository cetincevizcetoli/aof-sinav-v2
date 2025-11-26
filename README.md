# AÖF Sınav Asistanı (PWA)

Açık Öğretim Fakültesi öğrencileri için çevrimdışı destekli, akıllı tekrar (SRS) mantığı ile çalışan sınav hazırlık uygulaması.

## Özellikler
- PWA: Çevrimdışı çalışma, ana ekrana eklenebilme
- Akıllı tekrar (SRS) ve ilerleme takibi (IndexedDB)
- Deneme sınavı: Final için %30/%70 kuralı, ara sınav için ünite 1–4
- Oyunlaştırma: XP ve rütbe sistemi
- Hızlı açılış: Statikler için Cache-First, JSON verileri için Stale-While-Revalidate + TTL

## Mimari
- `service-worker.js`: 
  - Statikler `STATIC_CACHE` altında Cache-First
  - JSON veri ve API istekleri `DATA_CACHE` altında Stale-While-Revalidate (TTL: 300sn)
  - Dağıtımda `STATIC_CACHE` ve `DATA_CACHE` adları, `version.json` sürümü ile senkron tutulur (örn. `v1.0.2`)
- `version.json`: 
  - `{"version": "1.0.x"}` sürüm bildirim dosyası
  - Uygulama açılışında `UpdateManager` tarafından kontrol edilir; farklı ise cache temizliği ve yenileme yapılır
- Modüler JS: `js/core/*` (db, srs, gamification, examManager), `js/ui/*` (dashboard, quizUI)

## Kurulum
1. Depoyu klonla: `git clone https://github.com/cetincevizcetoli/aof-sinav-v2.git`
2. Ek derleme yok; doğrudan statik sunucuda servis edilebilir.
3. Nginx ile yayın (örnek):
   ```nginx
   server {
       listen 80;
       server_name aof-sinav.local;
       root /var/www/aof-sinav-v2;
       index index.html;

       location = /service-worker.js { add_header Cache-Control "no-cache"; }
       location = /version.json       { add_header Cache-Control "no-cache"; }

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
4. Windows Nginx: Proje dizinini `C:\nginx-1.27.5\html\aof-sinav-v2` altında konumlandır.

## Geliştirme
- Yerel geliştirme: Basit bir statik sunucu kullanabilirsin:
  - `npx serve .` veya `python -m http.server 8080`
- Lazy-loading: `QuizUI` modülü gerektiğinde dinamik import edilir.
- IndexedDB: `progress` ve `exam_history` için indeksler (ders/ünite/tarih) vardır.

## Yayın ve Sürümleme
- Her yayın için:
  - `version.json` içindeki `version` değerini artır (örn. `1.0.3`)
  - `service-worker.js` içindeki `STATIC_CACHE` ve `DATA_CACHE` adlarını aynı sürüm ile güncelle
  - Commit + push
- İstemci akışı:
  - Uygulama açıldığında `UpdateManager` sürümü kontrol eder; farklıysa cache’leri temizleyip yeniler
  - Service Worker yeni sürümle statikleri önceden cache’ler; JSON verileri SWR ile arka planda tazelenir

## Dizin Yapısı
```
assets/         # ikonlar ve görseller
css/            # stiller
data/           # ders JSON verileri
js/core/        # çekirdek mantık ve db
js/ui/          # arayüz bileşenleri
index.html      # giriş
manifest.json   # PWA manifest
service-worker.js
version.json    # sürüm bildirimi
```

## Lisans
Bu proje eğitim amaçlıdır. Lisans bilgisi eklenmedi; gerekirse `LICENSE` dosyası eklenebilir.
