export class ExamManager {
    /**
     * Sınav sorularını oluşturur
     * @param {Array} allQuestions - Dersin tüm soruları
     * @param {string} type - 'midterm' (Ara) veya 'final'
     * @param {number} count - Soru sayısı (5, 10, 20)
     */
    createExam(allQuestions, type, count) {
        let selectedQuestions = [];

        // 1. Havuzları Oluştur
        // Ara Sınav Havuzu: Ünite 1, 2, 3, 4
        const poolMidterm = allQuestions.filter(q => q.unit <= 4);
        
        // Final İkinci Yarı Havuzu: Ünite 5, 6, 7, 8
        const poolFinalSecondHalf = allQuestions.filter(q => q.unit > 4);

        // Tüm Dönem Havuzu (Final için genel veya yedek)
        const poolAll = allQuestions;

        // 2. Seçim Mantığı
        if (type === 'midterm') {
            // ARA SINAV: Sadece ilk 4 üniteden rastgele seç
            selectedQuestions = this.shuffleAndPick(poolMidterm, count);
        } 
        else if (type === 'final') {
            // FINAL SINAVI
            
            if (count === 20) {
                // --- ÖZEL KURAL (20 Soru) ---
                // %30 (6 Soru) -> Ünite 1-4
                // %70 (14 Soru) -> Ünite 5-8
                
                const countFromFirstHalf = 6;   // 20 * 0.30
                const countFromSecondHalf = 14; // 20 * 0.70

                const part1 = this.shuffleAndPick(poolMidterm, countFromFirstHalf);
                const part2 = this.shuffleAndPick(poolFinalSecondHalf, countFromSecondHalf);

                // İki parçayı birleştir
                selectedQuestions = [...part1, ...part2];
            } 
            else {
                // --- DİĞER DURUMLAR (5 veya 10 Soru) ---
                // Standart Final: Tüm konulardan (1-8) rastgele seçilir.
                selectedQuestions = this.shuffleAndPick(poolAll, count);
            }
        }
        else {
            // Hata durumu veya genel çalışma modu: Hepsinden rastgele
            selectedQuestions = this.shuffleAndPick(poolAll, count);
        }

        // 3. Son Karıştırma
        // Soruların ünite sırasına göre (1-1-1... 8-8-8) gelmesini engellemek için son listeyi tekrar karıştırıyoruz.
        return this.shuffleAndPick(selectedQuestions, count);
    }

    // Yardımcı: Bir diziyi karıştır ve içinden N tane al
    shuffleAndPick(array, n) {
        // Dizi boşsa boş dön (Hata önleyici)
        if (!array || array.length === 0) return [];
        
        // Fisher-Yates Karıştırma Algoritması (Daha adil dağılım için)
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled.slice(0, n);
    }
}