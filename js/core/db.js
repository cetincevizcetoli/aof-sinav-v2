export class ExamDatabase {
    constructor() {
        this.dbName = 'AofSinavDB_v2';
        this.dbVersion = 7;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;
                let progressStore;
                if (!db.objectStoreNames.contains('progress')) {
                    progressStore = db.createObjectStore('progress', { keyPath: 'id' });
                } else {
                    progressStore = tx.objectStore('progress');
                }
                if (progressStore.indexNames && !progressStore.indexNames.contains('by_lesson')) {
                    progressStore.createIndex('by_lesson', 'lesson', { unique: false });
                }
                if (progressStore.indexNames && !progressStore.indexNames.contains('by_lesson_unit')) {
                    progressStore.createIndex('by_lesson_unit', ['lesson', 'unit'], { unique: false });
                }

                let userStatsStore;
                if (!db.objectStoreNames.contains('user_stats')) {
                    userStatsStore = db.createObjectStore('user_stats', { keyPath: 'key' });
                }

                let profileStore;
                if (!db.objectStoreNames.contains('profile')) {
                    profileStore = db.createObjectStore('profile', { keyPath: 'key' });
                }

                let historyStore;
                if (!db.objectStoreNames.contains('exam_history')) {
                    historyStore = db.createObjectStore('exam_history', { keyPath: 'id', autoIncrement: true });
                } else {
                    historyStore = tx.objectStore('exam_history');
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_date')) {
                    historyStore.createIndex('by_date', 'date', { unique: false });
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_lesson')) {
                    historyStore.createIndex('by_lesson', 'lesson', { unique: false });
                }
                if (historyStore.indexNames && !historyStore.indexNames.contains('by_unit')) {
                    historyStore.createIndex('by_unit', 'unit', { unique: false });
                }
                if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });

                if (!db.objectStoreNames.contains('sessions')) {
                    const sess = db.createObjectStore('sessions', { keyPath: 'uuid' });
                    sess.createIndex('by_lesson', 'lesson', { unique: false });
                    sess.createIndex('by_lesson_unit', ['lesson','unit'], { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;

                // --- OTO-KONTROL (SİGORTA) ---
                // Veritabanı açıldı ama tablolar eksik mi? Kontrol et.
                // Eğer 'exam_history' tablosu yoksa, veritabanı bozuktur.
                if (!this.db.objectStoreNames.contains('exam_history') || 
                    !this.db.objectStoreNames.contains('progress')) {
                    
                    console.warn("🚨 Kritik: Tablolar eksik! Veritabanı otomatik onarılıyor...");
                    this.db.close(); // Bağlantıyı kes
                    
                    // Veritabanını sil ve sayfayı yenile (Tertemiz kurulum yapsın)
                    const deleteReq = indexedDB.deleteDatabase(this.dbName);
                    deleteReq.onsuccess = () => {
                        window.location.reload();
                    };
                    return; // İşlemi durdur
                }

                console.log("✅ Veritabanı ve Tablolar Sağlam.");
                resolve(this);
            };

            // Versiyon çakışması olursa (Auto-Heal)
            request.onerror = (event) => {
                console.error("DB Hatası:", event.target.error);
                // Hata ne olursa olsun, veritabanını silip sıfırdan başlat
                // Bu sayede kullanıcı asla takılı kalmaz.
                const deleteReq = indexedDB.deleteDatabase(this.dbName);
                deleteReq.onsuccess = () => window.location.reload();
            };
        });
    }

    // --- DİĞER METOTLAR (AYNEN KALIYOR) ---

    async saveProgress(cardId, data) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['progress'], 'readwrite');
            const parts = (cardId || data.id || '').split('_');
            const lesson = parts[0] || '';
            let unit = 0;
            if (parts.length > 1) {
                const u = parts[1];
                const m = /U(\d+)/.exec(u);
                unit = m ? parseInt(m[1]) : 0;
            }
            tx.objectStore('progress').put({
                ...data,
                id: cardId || data.id,
                lesson,
                unit,
                updated_at: Date.now()
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getAllProgress() {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['progress'], 'readonly');
            const req = tx.objectStore('progress').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getProgressByLesson(lessonCode) {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['progress'], 'readonly');
            const store = tx.objectStore('progress');
            const idx = store.index('by_lesson');
            const range = IDBKeyRange.only(lessonCode);
            const results = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { results.push(cursor.value); cursor.continue(); } else { resolve(results); }
            };
            req.onerror = () => resolve([]);
        });
    }

    async getUserStats() {
        return new Promise((resolve) => {
            if (!this.db) return resolve({ xp: 0, streak: 0, totalQuestions: 0 });
            const tx = this.db.transaction(['user_stats'], 'readonly');
            const req = tx.objectStore('user_stats').get('main_stats');
            req.onsuccess = () => resolve(req.result || { xp: 0, streak: 0, totalQuestions: 0 });
            req.onerror = () => resolve({ xp: 0, streak: 0, totalQuestions: 0 });
        });
    }

    async updateUserStats(stats) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['user_stats'], 'readwrite');
            tx.objectStore('user_stats').put({ key: 'main_stats', ...stats, updated_at: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getUserName() {
        return new Promise(resolve => {
            if (!this.db) return resolve(null);
            const tx = this.db.transaction(['profile'], 'readonly');
            const req = tx.objectStore('profile').get('username');
            req.onsuccess = () => resolve(req.result ? req.result.val : null);
            req.onerror = () => resolve(null);
        });
    }

    async setUserName(name) {
        if (!this.db) return;
        const tx = this.db.transaction(['profile'], 'readwrite');
        tx.objectStore('profile').put({ key: 'username', val: name });
        tx.onerror = () => {};
    }

    async getProfile(key) {
        return new Promise(resolve => {
            if (!this.db) return resolve(null);
            const tx = this.db.transaction(['profile'], 'readonly');
            const req = tx.objectStore('profile').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.val : null);
            req.onerror = () => resolve(null);
        });
    }

    async setProfile(key, val) {
        if (!this.db) return false;
        return new Promise(resolve => {
            const tx = this.db.transaction(['profile'], 'readwrite');
            tx.objectStore('profile').put({ key, val });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async logActivity(lessonCode, unit, isCorrect, qid, givenOption) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['exam_history'], 'readwrite');
            const store = tx.objectStore('exam_history');
            const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0, v = c=='x'?r:(r&0x3|0x8); return v.toString(16)});
            store.add({
                date: Date.now(),
                lesson: lessonCode,
                unit: parseInt(unit) || 0,
                isCorrect: isCorrect,
                qid: qid || '',
                given_option: givenOption || '',
                uuid
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async startSessionRecord(lesson, unit, mode, uuid){
        if (!this.db) return null;
        // Reuse active session if exists
        const active = await this.hasActiveSessionForUnit(lesson, unit);
        if (active) {
            const list = await this.getSessionsByUnit(lesson, unit);
            const current = list.find(r => !r.ended_at || r.ended_at === 0);
            return current ? current.uuid : uuid;
        }
        return new Promise((resolve) => {
            const tx = this.db.transaction(['sessions'], 'readwrite');
            tx.objectStore('sessions').put({ uuid, lesson, unit: parseInt(unit)||0, mode: mode||'study', started_at: Date.now(), ended_at: 0 });
            tx.oncomplete = () => resolve(uuid);
            tx.onerror = () => resolve(null);
        });
    }

    async endSessionRecord(uuid){
        return new Promise(async (resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sessions'], 'readwrite');
            const store = tx.objectStore('sessions');
            const req = store.get(uuid);
            req.onsuccess = (e) => {
                const row = e.target.result;
                if (!row) { resolve(false); return; }
                row.ended_at = Date.now();
                store.put(row);
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async getAllSessions(){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['sessions'],'readonly');
            const req = tx.objectStore('sessions').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async upsertSession(row){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sessions'],'readwrite');
            tx.objectStore('sessions').put({ uuid: row.uuid, lesson: row.lesson, unit: parseInt(row.unit)||0, mode: row.mode||'study', started_at: parseInt(row.started_at)||Date.now(), ended_at: parseInt(row.ended_at)||0 });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async importSessions(rows){
        if (!Array.isArray(rows) || rows.length===0) return true;
        for (const r of rows) { await this.upsertSession(r); }
        return true;
    }

    async countLessonRepeats(lesson){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(0);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson');
            const range = IDBKeyRange.only(lesson);
            let cnt = 0;
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ cnt++; c.continue(); } else resolve(cnt); };
            req.onerror = ()=>resolve(0);
        });
    }

    async countUnitRepeats(lesson, unit){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(0);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson_unit');
            const range = IDBKeyRange.only([lesson, parseInt(unit)||0]);
            let completed = 0;
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ const v = c.value; if (v && v.ended_at && v.ended_at > 0) completed++; c.continue(); } else { const repeats = Math.max(0, completed - 1); resolve(repeats); } };
            req.onerror = ()=>resolve(0);
        });
    }

    async getSessionsByUnit(lesson, unit){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['sessions'],'readonly');
            const idx = tx.objectStore('sessions').index('by_lesson_unit');
            const range = IDBKeyRange.only([lesson, parseInt(unit)||0]);
            const rows = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ rows.push(c.value); c.continue(); } else resolve(rows.sort((a,b)=> (b.started_at||0)-(a.started_at||0))); };
            req.onerror = ()=>resolve([]);
        });
    }

    async hasActiveSessionForUnit(lesson, unit){
        const list = await this.getSessionsByUnit(lesson, unit);
        return list.some(r => !r.ended_at || r.ended_at === 0);
    }

    async getHistoryRange(lesson, unit, startTs, endTs){
        return new Promise((resolve)=>{
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'],'readonly');
            const idx = tx.objectStore('exam_history').index('by_date');
            const range = IDBKeyRange.lowerBound(startTs||0);
            const rows = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e)=>{ const c = e.target.result; if (c){ const v = c.value; if ((!endTs || v.date <= endTs) && v.lesson === lesson && (parseInt(v.unit)||0) === (parseInt(unit)||0)) { rows.push(v); } c.continue(); } else resolve(rows); };
            req.onerror = ()=>resolve([]);
        });
    }

    async getHistory() {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'], 'readonly');
            const req = tx.objectStore('exam_history').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    }

    async getHistorySince(timestamp) {
        return new Promise((resolve) => {
            if (!this.db) return resolve([]);
            const tx = this.db.transaction(['exam_history'], 'readonly');
            const store = tx.objectStore('exam_history');
            const idx = store.index('by_date');
            const range = IDBKeyRange.lowerBound(timestamp);
            const results = [];
            const req = idx.openCursor(range);
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) { results.push(cursor.value); cursor.continue(); } else { resolve(results); }
            };
            req.onerror = () => resolve([]);
        });
    }

    async resetAllData() {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['progress', 'user_stats', 'profile', 'exam_history'], 'readwrite');
            tx.objectStore('progress').clear();
            tx.objectStore('user_stats').clear();
            tx.objectStore('profile').clear();
            tx.objectStore('exam_history').clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async resetProgressOnly(){
        return new Promise((resolve)=>{
            if (!this.db) return resolve(false);
            const stores = ['progress','user_stats','exam_history'];
            // sessions store eklenmişse onu da temizle
            const hasSessions = this.db.objectStoreNames && this.db.objectStoreNames.contains('sessions');
            const tx = this.db.transaction(hasSessions ? [...stores,'sessions'] : stores, 'readwrite');
            tx.objectStore('progress').clear();
            tx.objectStore('user_stats').clear();
            tx.objectStore('exam_history').clear();
            if (hasSessions) { tx.objectStore('sessions').clear(); }
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async enqueueSync(payload) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            tx.objectStore('sync_queue').add({ payload, ts: Date.now() });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    }

    async drainSyncQueue(handler) {
        if (!this.db) return false;
        const items = await new Promise((resolve) => {
            const tx = this.db.transaction(['sync_queue'], 'readonly');
            const store = tx.objectStore('sync_queue');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
        for (const it of items) { try { await handler(it.payload); } catch {} }
        await new Promise((resolve) => {
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            tx.objectStore('sync_queue').clear();
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
        return true;
    }
}
