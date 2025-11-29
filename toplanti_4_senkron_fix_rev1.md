Teknik Görev: UI Optimization – "No-Flash" Smart Updates
Sorun
Sistem şu an refreshAndRender() çağrıldığında innerHTML'i temizleyip tüm DOM'u baştan oluşturuyor. Bu durum, özellikle otomatik senkronizasyon sırasında kullanıcının ekranında rahatsız edici bir parlamaya (flicker) neden oluyor.

Hedef
Veri güncellendiğinde tüm sayfayı yıkıp yapmak yerine, sadece değişen değerleri (progress bar genişliği, doğru/yanlış sayıları, level bilgisi) DOM üzerinde doğrudan güncelleyen bir "Akıllı Güncelleme" (Smart Update/Patching) mekanizması kur.

Yapılacak Değişiklikler
1. js/ui/dashboard.js - ID Tabanlı HTML Yapısı
Öncelikle, render edilen HTML elemanlarına (özellikle değişecek olanlara) benzersiz ID'ler vermelisin ki onları DOM'da bulabilelim.

renderLessonCard veya benzeri HTML üreten fonksiyonunda şu ID pattern'lerini ekle:

Progress Bar: id="prog-bar-${lessonCode}"

Progress Text (%): id="prog-text-${lessonCode}"

Doğru Sayısı: id="stat-correct-${lessonCode}"

Yanlış Sayısı: id="stat-wrong-${lessonCode}"

Level Badge: id="badge-level-${lessonCode}"

2. js/ui/dashboard.js - updateUIValues() Metodu
Dashboard sınıfına, HTML'i bozmadan sadece değerleri güncelleyen yeni bir metod ekle.

JavaScript

// Dashboard sınıfı içine eklenecek:

async updateUIValues() {
    // 1. Verileri taze çek (ama this.lessons'ı silme, sadece güncelle)
    // Cache resetleme işlemi dışarıda yapıldı varsayıyoruz
    const freshLessons = await this.loader.getLessons();
    const freshStats = await this.loader.getUserStats();

    // 2. Ders Kartlarını Gez ve DOM'u Güncelle
    let domChanged = false;

    freshLessons.forEach(lesson => {
        const code = lesson.code; // veya id
        
        // Elemanları Seç
        const elBar = document.getElementById(`prog-bar-${code}`);
        const elText = document.getElementById(`prog-text-${code}`);
        const elCorrect = document.getElementById(`stat-correct-${code}`);
        const elWrong = document.getElementById(`stat-wrong-${code}`);
        // ... diğerleri

        // Eğer elemanlar DOM'da yoksa (yeni ders gelmiş olabilir), tam render gerekir
        if (!elBar) {
            domChanged = true; 
            return;
        }

        // Yerinde Güncelleme (Flash yapmaz)
        // Progress Bar
        const percent = lesson.totalQuestions > 0 
            ? Math.round((lesson.correct / lesson.totalQuestions) * 100) 
            : 0; // Kendi hesaplama mantığını kullan
            
        // Sadece değer değiştiyse DOM'a dokun (Optimizasyon)
        if (elBar.style.width !== `${percent}%`) elBar.style.width = `${percent}%`;
        if (elText.innerText !== `%${percent}`) elText.innerText = `%${percent}`;
        
        // İstatistikler
        if (elCorrect.innerText != lesson.correct) elCorrect.innerText = lesson.correct;
        if (elWrong.innerText != lesson.wrong) elWrong.innerText = lesson.wrong;
    });

    // Header İstatistiklerini Güncelle (XP, Streak vb.)
    if (freshStats) {
        const elXp = document.getElementById('dash-xp-value');
        if (elXp) elXp.innerText = freshStats.xp;
        // ... streak vb.
    }

    // 3. Eğer yeni ders eklendiyse veya yapısal değişiklik varsa tam render yap
    if (domChanged) {
        console.log("⚠️ Yapısal değişiklik var, tam render yapılıyor...");
        this.lessons = freshLessons; // State'i güncelle
        await this.render();
    } else {
        console.log("✨ UI Parlamadan güncellendi (Smart Update).");
        this.lessons = freshLessons; // State'i sessizce güncelle
    }
}
3. refreshAndRender Metodunu Güncelle
Eski "yık-yap" metodunu, önce akıllı güncellemeyi deneyecek şekilde revize et.

JavaScript

async refreshAndRender() {
    // 1. Loader cache temizle
    if (this.loader.resetCache) this.loader.resetCache();
    
    // 2. DOM dolu mu kontrol et (İlk açılış mı?)
    const container = document.getElementById('dashboard-container'); // Senin container ID'n
    if (!container || container.children.length === 0) {
        // Sayfa boşsa mecbur tam render
        await this.render();
    } else {
        // Sayfa doluysa, sadece değerleri güncelle (No Flash)
        await this.updateUIValues();
    }
}
Özet
Bu değişiklik ile app:data-updated eventi tetiklendiğinde:

Sistem önce DOM'daki mevcut kartları bulur.

İçeriklerini (text ve style) günceller.

innerHTML = '' işlemi yapılmadığı için beyaz parlama (flash) oluşmaz.

Kullanıcı sadece rakamların değiştiğini görür. }