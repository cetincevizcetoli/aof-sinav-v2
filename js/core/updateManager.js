export class UpdateManager {
    constructor() {
        this.localVersionKey = 'app_version';
    }

    async checkUpdates() {
        try {
            // 1. Sunucudaki versiyonu sor
            // (Cache'lenmesin diye sonuna rastgele sayı ekliyoruz)
            const response = await fetch(`version.json?t=${Date.now()}`);
            if (!response.ok) return;

            const serverData = await response.json();
            const serverVersion = serverData.version;
            const localVersion = localStorage.getItem(this.localVersionKey);

            console.log(`Versiyon Kontrolü: Yerel=${localVersion}, Sunucu=${serverVersion}`);

            // 2. Versiyonlar farklıysa temizlik yap
            if (localVersion !== serverVersion) {
                console.warn('⚠️ Yeni güncelleme bulundu! Sistem yenileniyor...');
                
                await this.performCleanup();
                
                // Yeni versiyonu kaydet
                localStorage.setItem(this.localVersionKey, serverVersion);
                
                // Kullanıcıyı rahatsız etmeden sayfayı yenile
                window.location.reload(true);
            }
        } catch (error) {
            console.log('İnternet yok veya versiyon kontrolü yapılamadı.', error);
        }
    }

    async performCleanup() {
        // Service Worker'ı durdur ve sil
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }

        // Cache (Önbellek) dosyalarını tamamen sil
        if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        }
        
        console.log('🧹 Temizlik tamamlandı.');
    }
}