 Masaüstü tarayıcılarda Ctrl+F5 (Hard Refresh) bizim cankurtaranımızdır ama PWA (Yüklü Uygulama) modunda adres çubuğu yoktur, F5 yoktur. Kullanıcı eski versiyonda hapsolur.



Edge veya Chrome üzerinden uygulama olarak yüklendiğinde, arka planda yeni sürüm gelse bile uygulama kapatılıp açılmadan (bazen o bile yetmez) devreye girmez.

Bunu çözmek için sisteme "Uygulama İçi Güncelleme Bildirimi" (In-App Update Toast) ekleyeceğiz.


Teknik Görev: PWA Zorunlu Güncelleme Mekanizması (Update Prompt)
Sorun: Uygulama Edge/Chrome üzerinden PWA olarak yüklendiğinde (display: standalone), kullanıcıların Ctrl+F5 yapma imkanı olmuyor. service-worker arka planda güncellense bile, kullanıcı aktif oturumda eski arayüzü görmeye devam ediyor.

Çözüm: Uygulama açıldığında ve periyodik olarak version.json dosyasını kontrol eden, eğer yerel sürümden daha yeni bir sürüm varsa ekranın altına sabit (sticky) bir "Güncelleme Mevcut" bildirimi çıkaran bir yapı kuracağız.

Lütfen aşağıdaki adımları uygula:

1. js/core/updateManager.js Revizyonu
Mevcut sınıfı, sürüm kontrolü yapıp UI tetikleyecek şekilde güncelle.

JavaScript

export class UpdateManager {
    constructor() {
        this.currentVersion = '1.1.31'; // Bu hardcoded değer version.json ile eşleşmeli veya oradan okunmalı
        this.versionUrl = 'version.json';
    }

    async checkUpdates(silent = true) {
        try {
            // Cache-busting için timestamp ekliyoruz
            const res = await fetch(`${this.versionUrl}?t=${Date.now()}`);
            if (!res.ok) return;
            
            const remote = await res.json();
            const localVer = localStorage.getItem('app_version');

            // İlk yükleme veya sürüm farkı varsa
            if (!localVer || this.compareVersions(remote.version, localVer) > 0) {
                console.log(`🚀 Yeni sürüm bulundu: ${remote.version} (Mevcut: ${localVer})`);
                
                // Eğer force_update varsa veya kullanıcı eski sürümde kaldıysa
                this.showUpdateNotification(remote.version);
            } else {
                if(!silent) alert("Sürümünüz güncel: " + localVer);
            }
        } catch (e) {
            console.error("Güncelleme kontrol hatası:", e);
        }
    }

    // Basit Semver karşılaştırma (v1.1.31 vs v1.1.32)
    compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const p1 = v1.replace('v','').split('.').map(Number);
        const p2 = v2.replace('v','').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return 1;
            if (n2 > n1) return -1;
        }
        return 0;
    }

    showUpdateNotification(newVersion) {
        // Zaten varsa tekrar ekleme
        if (document.getElementById('update-toast')) return;

        const toast = document.createElement('div');
        toast.id = 'update-toast';
        toast.className = 'update-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fa-solid fa-cloud-arrow-down"></i>
                <span>Yeni sürüm mevcut (${newVersion})</span>
            </div>
            <button id="btn-reload-update" class="btn-update-action">YÜKLE</button>
        `;

        document.body.appendChild(toast);

        document.getElementById('btn-reload-update').onclick = async () => {
            // 1. Yeni sürümü kaydet
            localStorage.setItem('app_version', newVersion);
            
            // 2. Service Worker cache'lerini temizle (En garantisi)
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            
            // 3. Sayfayı zorla yenile
            window.location.reload(true);
        };
    }
}
2. CSS (css/main.css veya modal.css)
Bildirimin ekranın altında şık durması için:

CSS

.update-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #1e293b; /* Koyu lacivert */
    color: white;
    padding: 12px 20px;
    border-radius: 50px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    gap: 15px;
    z-index: 9999;
    animation: slideUp 0.5s ease-out;
    width: 90%;
    max-width: 400px;
    justify-content: space-between;
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
}

.btn-update-action {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 6px 16px;
    border-radius: 20px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;
}

@keyframes slideUp {
    from { transform: translate(-50%, 100px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
}
3. js/app.js Entegrasyonu
Uygulama başladığında bu kontrolü yapması için:

JavaScript

// initApp içine:
const updater = new UpdateManager();
// Başlangıçta kontrol et
updater.checkUpdates(true);

// Uygulama aktif olduğunda (telefonda arka plandan öne gelince) tekrar kontrol et
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        updater.checkUpdates(true);
    }
});
4. Service Worker Notu
Mevcut service-worker.js içinde self.skipWaiting() zaten var. Ancak version.json değiştiğinde tarayıcının bunu algılaması için yukarıdaki UpdateManager içindeki unregister() + reload() kombosu en garanti yöntemdir. Eski cache'i siler ve taze dosyaları çeker.

Sonuç: Kullanıcı uygulamayı açtığında, eğer sunucuda version.json içindeki numara (örn: 1.1.32) kullanıcının localStorage'ındaki numaradan büyükse, alttan "Yeni Sürüm Mevcut - YÜKLE" butonu çıkacak. Buna basınca uygulama kendini yenileyip son halini alacak. Bu, Ctrl+F5'in modern karşılığıdır.