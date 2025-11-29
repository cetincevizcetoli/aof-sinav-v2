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
    updater.checkUpdates(true);

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
    window.db = db;
    
    // Dashboard'u başlat
    dashboard = new Dashboard(loader, db);
    window.dashboard = dashboard;
    
    

    // 4. Global Başlatıcı Fonksiyonu (Dashboard'dan çağrılır)
    window.startSession = async (lessonCode, config) => {
        const safeConfig = config || { mode: 'study' };
        window.__inSession = true;
        const sessUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8); return v.toString(16)});
        const unitNo = (safeConfig && safeConfig.specificUnit) ? safeConfig.specificUnit : 0;
        let cycleNo = 0;
        try {
            // Determine cycle number based on completion state
            const lessons = await loader.getLessonList();
            const target = lessons.find(l => l.code === lessonCode);
            const cards = await loader.loadLessonData(target.code, target.file);
            const unitCards = unitNo ? cards.filter(c => c.unit === unitNo) : cards;
            const allLearned = unitCards.length>0 && unitCards.every(c => (c.level||0) > 0);
            const maxCycle = await db.getMaxCycleNo(lessonCode, unitNo);
            cycleNo = allLearned ? (maxCycle+1) : maxCycle;
        } catch(e){ cycleNo = 0; }
        if (db && typeof db.startSessionRecord === 'function') {
            const assigned = await db.startSessionRecord(lessonCode, unitNo, safeConfig.mode || 'study', sessUUID, cycleNo);
            window.__sessionUUID = assigned || sessUUID;
        } else {
            window.__sessionUUID = sessUUID;
        }
        if (loader && typeof loader.resetCache === 'function') { loader.resetCache(); }
        if (!quizUI) {
            const module = await import('./ui/quizUI.js');
            const QuizUI = module.QuizUI;
            quizUI = new QuizUI(loader, db, () => { window.__inSession = false; if (dashboard.refreshAndRender) { dashboard.refreshAndRender(); } else { dashboard.render(); } });
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

    let __refreshLock = false;
    document.addEventListener('app:data-updated', async () => {
        try {
            if (window.__inSession) return;
            if (__refreshLock) return;
            __refreshLock = true;
            console.log('♻️ Veri değişti algılandı. UI tam tazeleme...');
            if (dashboard && typeof dashboard.refreshAndRender === 'function') {
                await dashboard.refreshAndRender();
            } else {
                if (loader && typeof loader.resetCache === 'function') { loader.resetCache(); }
                await dashboard.render();
            }
            setTimeout(() => { __refreshLock = false; }, 1500);
        } catch(e) { __refreshLock = false; }
    });

    const drain = async () => {
        if (!sync.getToken()) return;
        await db.drainSyncQueue(async (payload) => {
            if (!payload) return;
            if (payload.type === 'push') { await sync.autoSync(); }
            else if (payload.type === 'pull') { await sync.autoSync(); }
        });
        await sync.autoSync();
    };
    if (navigator.onLine) { await drain(); }
    window.addEventListener('online', drain);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { updater.checkUpdates(true); if (navigator.onLine) drain(); } });
    setInterval(() => { if (navigator.onLine) drain(); }, 60000);
    const shortPoll = async () => {
        const token = sync.getToken(); if(!token) return;
        const r = await fetch(`./api/sync.php?action=check_version&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` }, cache:'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const lastServer = (j && j.data && j.data.last_server_update) ? parseInt(j.data.last_server_update) : 0;
        const lastLocal = await db.getProfile('last_sync') || 0;
        if (lastServer > lastLocal) { await drain(); }
    };
    setInterval(() => { if (navigator.onLine) shortPoll(); }, 10000);
}

// Sayfa tamamen yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initApp);
