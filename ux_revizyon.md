Tasarım Görevi: Ayarlar Menüsü UX/UI Revizyonu
Amaç: Uzun ve karmaşık buton listesini, modern, ikon tabanlı ve gruplandırılmış bir "Profil & Ayarlar" paneline dönüştürmek.

1. HTML Yapısı (admin/panel.html veya dashboard.js içindeki modal template)
Mevcut liste (<ul> veya div yığını) yerine şu yapıyı kur:

HTML

<div class="settings-profile-card">
    <div class="profile-avatar">
        <i class="fa-solid fa-user-circle"></i>
    </div>
    <div class="profile-info">
        <h3 id="menu-user-name">Ahmet Çetin</h3>
        <span class="badge badge-member">Üye</span>
    </div>
    <button class="btn-icon-logout" title="Çıkış Yap">
        <i class="fa-solid fa-right-from-bracket"></i>
    </button>
</div>

<div class="settings-group">
    <h4 class="group-title">Uygulama & Veri</h4>
    
    <button class="menu-item" id="btn-sync-now">
        <div class="icon-box blue"><i class="fa-solid fa-rotate"></i></div>
        <div class="text-box">
            <span class="menu-label">Senkronize Et</span>
            <span class="menu-sub">Verileri sunucuyla eşitle</span>
        </div>
    </button>

    <button class="menu-item" id="btn-check-update">
        <div class="icon-box green"><i class="fa-solid fa-cloud-arrow-down"></i></div>
        <div class="text-box">
            <span class="menu-label">Güncelleme Kontrol</span>
            <span class="menu-sub" id="version-text">v1.1.31</span>
        </div>
    </button>
</div>

<div class="settings-group">
    <h4 class="group-title">Hesap İşlemleri</h4>
    
    <button class="menu-item" id="btn-reset-data">
        <div class="icon-box orange"><i class="fa-solid fa-eraser"></i></div>
        <span class="menu-label">İlerlemeyi Sıfırla</span>
    </button>
    
    <button class="menu-item admin-only" id="btn-admin-panel" style="display:none;">
        <div class="icon-box purple"><i class="fa-solid fa-user-shield"></i></div>
        <span class="menu-label">Yönetici Paneli</span>
    </button>
</div>

<div class="settings-danger-zone">
    <button class="btn-text-danger" id="btn-delete-account">
        <i class="fa-solid fa-trash"></i> Hesabımı Kalıcı Olarak Sil
    </button>
    <div class="app-footer-info">
        AÖF Asistanı v1.1.31 <br>
        <a href="#" id="btn-changelog">Sürüm Notları</a>
    </div>
</div>
2. CSS Stili (css/modal.css)
Bu yapıyı destekleyecek modern CSS dokunuşları:

settings-profile-card: Hafif gri arka plan (#f8fafc), yuvarlatılmış köşeler (12px), flex layout.

menu-item: Klasik buton görünümünden ziyade, iOS ayarlar menüsü gibi satır görünümü. Tıklanınca hafif renk değişimi (hover). Border yok, sadece altta ince çizgi.

icon-box: İkonların arkasında yuvarlak ve renkli bir zemin.

.blue -> bg-blue-100 text-blue-600

.orange -> bg-orange-100 text-orange-600

settings-danger-zone: Üstten margin-top: 20px ile ayrılmış, butonlar kırmızı metinli ve çerçevesiz.

3. Kullanılabilirlik Notları
"Senkronu Zorla" butonu artık ana menüde "Senkronize Et" olarak şık bir özellik haline geldi (Debug havasından çıktı).

"Manuel Güncelle" ve "Kontrol Et" birleştirildi.

"Giriş/Kayıtlı Hesaplar" karmaşası kaldırıldı; Profil kartına tıklandığında detay açılabilir veya direkt orada yönetilebilir.