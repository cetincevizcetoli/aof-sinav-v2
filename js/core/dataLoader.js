import { SRS } from './srs.js';

/**
 * DataLoader
 * JSON dosyalarını okur, ID atar ve veritabanı bilgisiyle birleştirir.
 */
export class DataLoader {
    constructor(dbInstance) {
        this.db = dbInstance;
        this.cachedLessons = {}; // Bellekte tutulan dersler
    }

    // Config dosyasını çekip ders listesini döndürür
    async getLessonList() {
        try {
            const response = await fetch('data/config.json');
            if (!response.ok) throw new Error("Config okunamadı");
            const data = await response.json();
            return data.lessons;
        } catch (error) {
            console.error("Ders listesi yüklenemedi:", error);
            return [];
        }
    }

    // Belirli bir dersi yükler ve işler
    async loadLessonData(lessonCode, fileName) {
        // 1. JSON dosyasını çek
        let rawData = [];
        try {
            const response = await fetch(`data/${fileName}`);
            if (!response.ok) throw new Error("Ders dosyası bulunamadı: " + fileName);
            rawData = await response.json();
        } catch (error) {
            console.error(error);
            return [];
        }

        // 2. Veritabanındaki tüm ilerlemeyi çek (Bu ders için olanları filtreleyeceğiz)
        const allProgress = await this.db.getAllProgress();
        // Performans için ilerleme dizisini bir Map'e çevirelim: { "ID": {data} }
        const progressMap = new Map(allProgress.map(item => [item.id, item]));

        // 3. JSON verisini işle ve ID ata
        const processedCards = rawData.map((item, index) => {
            // Benzersiz ID Üretimi: DERS_UNITE_INDEX
            // Örn: BIL203U_U1_Q5
            const uniqueId = `${lessonCode}_U${item.unit}_Q${index}`;
            
            // DB'den bu sorunun durumunu bul
            const userState = progressMap.get(uniqueId);

            return {
                ...item,           // Orijinal soru verisi (question, options, answer...)
                id: uniqueId,      // Bizim ürettiğimiz ID
                
                // Kullanıcı Durumu (DB'de varsa onu kullan, yoksa varsayılan)
                level: userState ? userState.level : 0,
                nextReview: userState ? userState.nextReview : 0,
                isDue: userState ? (userState.nextReview <= Date.now()) : true // Süresi gelmiş mi?
            };
        });

        console.log(`${lessonCode} yüklendi. Toplam Soru: ${processedCards.length}`);
        return processedCards;
    }
}