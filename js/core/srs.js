/**
 * SRS (Spaced Repetition System) Mantığı
 * Leitner Sisteminin basitleştirilmiş bir varyasyonu.
 */
export const SRS = {
    // Seviyeye göre bekleme süreleri (Gün cinsinden)
    // Seviye 0: Yeni / Bilinmiyor (Aynı gün)
    // Seviye 1: 1 gün sonra
    // Seviye 2: 3 gün sonra
    // Seviye 3: 1 hafta sonra
    // Seviye 4: 2 hafta sonra
    // Seviye 5: 1 ay sonra (Ezberlendi kabul edilir)
    INTERVALS: [0, 1, 3, 7, 14, 30],

    /**
     * Bir kartın cevabına göre yeni durumunu hesaplar.
     * @param {number} currentLevel - Mevcut seviye (0-5 arası)
     * @param {boolean} isCorrect - Doğru bilindi mi?
     * @returns {object} { level, nextReview } - Yeni seviye ve milisaniye cinsinden tarih
     */
    calculate(currentLevel, isCorrect) {
        let newLevel = currentLevel;

        if (isCorrect) {
            // Doğruysa seviye artır (Maksimum 5)
            if (newLevel < this.INTERVALS.length - 1) {
                newLevel++;
            }
        } else {
            // Yanlışsa cezalandır: Seviyeyi 1'e düşür (0 yapmıyoruz ki hemen "yeni" muamelesi görmesin, ama sık sorulsun)
            newLevel = 1; 
        }

        // Bir sonraki tekrar zamanını hesapla
        const daysToAdd = this.INTERVALS[newLevel];
        const now = new Date();
        
        // Şu anki zamana 'daysToAdd' gün ekle
        // Eğer seviye 0 ise (veya yanlışsa) süre ekleme, hemen tekrar sorulabilir olsun.
        let nextReviewTime = now.getTime(); 
        
        if (daysToAdd > 0) {
            // Gelecek bir tarihe ayarla
            const futureDate = new Date();
            futureDate.setDate(now.getDate() + daysToAdd);
            futureDate.setHours(4, 0, 0, 0); // Sabah 04:00'e ayarla (Gece çalışanlar için gün karışmasın)
            nextReviewTime = futureDate.getTime();
        }

        return {
            level: newLevel,
            nextReview: nextReviewTime
        };
    }
};