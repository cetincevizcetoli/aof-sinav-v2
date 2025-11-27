import { ExamDatabase } from './core/db.js';
import { DataLoader } from './core/dataLoader.js';
import { Dashboard } from './ui/dashboard.js';
import { UpdateManager } from './core/updateManager.js';
import { SyncManager } from './core/sync.js';

let db, loader, dashboard, quizUI;

async function initApp() {
    console.log("🚀 Uygulama Başlatılıyor (v3.2 Stable)...");

    // 1. Otomatik Güncelleme Kontrolü
    const updater = new UpdateManager();
    updater.checkUpdates(); // Arka planda versiyon kontrolü yapar

    // 2. Veritabanı Başlatma
    db = new ExamDatabase();
    try {
        await db.open();
    } catch (e) {
        console.error("Veritabanı hatası, otomatik onarım devreye girmeliydi.", e);
        document.getElementById('app-container').innerHTML = 
            `<div class="loading-state"><p style="color:red;">Sistem Hatası! Lütfen sayfayı yenileyin.</p></div>`;
        return;
    }

    // 3. Modülleri Yükle
    loader = new DataLoader(db);
    const sync = new SyncManager(db);
    
    // Dashboard'u başlat
    dashboard = new Dashboard(loader, db);
    
    

    // 4. Global Başlatıcı Fonksiyonu (Dashboard'dan çağrılır)
    window.startSession = async (lessonCode, config) => {
        const safeConfig = config || { mode: 'study' };
        if (!quizUI) {
            const module = await import('./ui/quizUI.js');
            const QuizUI = module.QuizUI;
            quizUI = new QuizUI(loader, db, () => { dashboard.render(); });
        }
        await quizUI.start(lessonCode, safeConfig);
    };

    // 5. Ayarlar Butonunu Bağla (Header'daki çark ikonu)
    const settingsBtn = document.getElementById('btn-settings');
    if(settingsBtn) {
        settingsBtn.onclick = () => dashboard.openSettings();
    }

    // 6. İlk Ekranı Çiz
    dashboard.render();

    const drain = async () => {
        await db.drainSyncQueue(async (payload) => {
            if (!payload) return;
            if (payload.type === 'push') { await sync.pushAll(); }
            else if (payload.type === 'pull') { await sync.pullAll(); }
        });
    };
    if (navigator.onLine) { drain(); }
    window.addEventListener('online', drain);
}

// Sayfa tamamen yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initApp);
