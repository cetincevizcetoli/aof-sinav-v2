export class UpdateManager {
    constructor() {
        this.localVersionKey = 'app_version';
        this.versionUrl = 'version.json';
    }

    async checkUpdates(silent = true) {
        try {
            const response = await fetch(`${this.versionUrl}?t=${Date.now()}`);
            if (!response.ok) return;
            const remote = await response.json();
            const serverVersion = remote.version;
            const localVersion = localStorage.getItem(this.localVersionKey);
            const swVer = await this.getServiceWorkerVersion().catch(()=>null);
            if (!localVersion) { localStorage.setItem(this.localVersionKey, serverVersion); return; }
            const cmp = this.compareVersions(serverVersion, localVersion);
            const needsUpdate = (cmp > 0) || (swVer && this.compareVersions(serverVersion, swVer) !== 0);
            const force = !!remote.force_update;
            if (needsUpdate && force && !silent) {
                this.showUpdateNotification(serverVersion);
            } else {
                if (needsUpdate) { localStorage.setItem(this.localVersionKey, serverVersion); }
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

    compareVersions(v1, v2) {
        if (!v1 || !v2) return 0;
        const p1 = String(v1).replace(/^v/, '').split('.').map(Number);
        const p2 = String(v2).replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0; const n2 = p2[i] || 0;
            if (n1 > n2) return 1; if (n2 > n1) return -1;
        }
        return 0;
    }

    showUpdateNotification(newVersion) {
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
        const btn = document.getElementById('btn-reload-update');
        if (btn) {
            btn.onclick = async () => {
                localStorage.setItem(this.localVersionKey, newVersion);
                await this.performCleanup();
                window.location.reload();
            };
        }
    }

    async getServiceWorkerVersion(){
        try {
            const r = await fetch(`service-worker.js?t=${Date.now()}`, { cache:'no-store' });
            if (!r.ok) return null;
            const txt = await r.text();
            const m = txt.match(/static-v(\d+\.\d+\.\d+)/);
            if (m && m[1]) return m[1];
            const m2 = txt.match(/data-v(\d+\.\d+\.\d+)/);
            return m2 && m2[1] ? m2[1] : null;
        } catch(e){ return null; }
    }
}
