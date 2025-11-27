export class ExamDatabase {
    constructor() {
        this.dbName = 'AofSinavDB_v2';
        this.dbVersion = 6;
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
                unit
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
            tx.objectStore('user_stats').put({ key: 'main_stats', ...stats });
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

    async logActivity(lessonCode, unit, isCorrect) {
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['exam_history'], 'readwrite');
            const store = tx.objectStore('exam_history');
            store.add({
                date: Date.now(),
                lesson: lessonCode,
                unit: parseInt(unit) || 0,
                isCorrect: isCorrect
            });
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
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
        return new Promise((resolve) => {
            if (!this.db) return resolve(false);
            const tx = this.db.transaction(['sync_queue'], 'readwrite');
            const store = tx.objectStore('sync_queue');
            const req = store.getAll();
            req.onsuccess = async () => {
                const items = req.result || [];
                for (const it of items) { try { await handler(it.payload); } catch {} }
                store.clear();
                resolve(true);
            };
            req.onerror = () => resolve(false);
        });
    }
}
