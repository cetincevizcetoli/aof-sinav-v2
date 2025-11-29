import { ExamDatabase } from './core/db.js';
import { DataLoader } from './core/dataLoader.js';
import { Dashboard } from './ui/dashboard.js';
import { UpdateManager } from './core/updateManager.js';
window.__disablePull = true;
window.manualUpdateNow = async () => { try { if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) { await r.unregister(); } } } catch{} try { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } } catch{} location.reload(); };

let db, loader, dashboard, quizUI;
async function ensureTokenFromProfile() { return; }

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
    await ensureTokenFromProfile();
    window.db = db;
    
    // Dashboard'u başlat
    dashboard = new Dashboard(loader, db);
    window.dashboard = dashboard;
    
    

    // 4. Global Başlatıcı Fonksiyonu (Dashboard'dan çağrılır)
    window.startSession = async (lessonCode, config) => {
        const safeConfig = config || { mode: 'study' };
        window.__inSession = true;
        const unitNo = (safeConfig && safeConfig.specificUnit) ? safeConfig.specificUnit : 0;
        let sessions = [];
        try { sessions = await db.getSessionsByUnit(lessonCode, unitNo); } catch {}
        const active = Array.isArray(sessions) ? sessions.find(r => !r.ended_at || r.ended_at === 0) : null;
        if (active) {
            window.__sessionUUID = active.uuid;
            window.__sessionCycleNo = parseInt(active.cycle_no)||0;
        } else {
            const lastSession = (Array.isArray(sessions) ? sessions.slice().sort((a,b)=> (b.started_at||0)-(a.started_at||0)) : [])[0];
            const currentMax = lastSession ? (parseInt(lastSession.cycle_no)||0) : 0;
            const cycleNo = (lastSession && lastSession.ended_at && lastSession.ended_at > 0) ? (currentMax + 1) : currentMax;
            const sessUUID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8); return v.toString(16)});
            if (db && typeof db.startSessionRecord === 'function') {
                const assigned = await db.startSessionRecord(lessonCode, unitNo, safeConfig.mode || 'study', sessUUID, cycleNo);
                window.__sessionUUID = assigned || sessUUID;
            } else {
                window.__sessionUUID = sessUUID;
            }
            window.__sessionCycleNo = cycleNo;
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

    await ensureTokenFromProfile();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { updater.checkUpdates(true); } });
}

// Sayfa tamamen yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initApp);
