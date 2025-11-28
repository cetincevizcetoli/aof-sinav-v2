import { Gamification } from '../core/gamification.js';
import { ExamManager } from '../core/examManager.js';
import { UpdateManager } from '../core/updateManager.js';
import { AuthManager } from '../core/authManager.js';
import { SyncManager } from '../core/sync.js';

export class Dashboard {
    constructor(dataLoader, db) {
        this.loader = dataLoader;
        this.db = db;
        this.container = document.getElementById('app-container');
    }

    // Ana Ekranı Çiz
    async render() {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Veriler Yükleniyor...</p></div>';

        const authGate = new AuthManager(this.db);
        if (!authGate.hasToken() && !localStorage.getItem('guest_mode')) {
            this.showWelcomeOverlay();
            return;
        }

        const userName = await this.db.getUserName();
        // Artık kullanıcı adı zorunlu değil; onboarding ile yönlendirilecek

        const lessons = await this.loader.getLessonList();
        
        const game = new Gamification(this.db);
        const stats = await this.db.getUserStats();
        const rank = game.getRank(stats.xp);

        const history = await this.db.getHistory();
        const activityStats = await this.calculateActivityStats(history);
        const lessonStats = await this.calculateLessonStats(lessons);

        const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));

        const hasToken = !!localStorage.getItem('auth_token');
        const accEmail = await this.db.getProfile('account_email');
        const lastSync = await this.db.getProfile('last_sync');
        const statusText = hasToken ? `Üye${accEmail?` • ${accEmail}`:''}${lastSync?` • Son Senkron: ${new Date(lastSync).toLocaleString()}`:''}` : 'Misafir (Veriler sadece bu cihazda)';
        let html = `
            <div class="dashboard-header" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                <div>
                    <h2>Derslerim</h2>
                    <p class="subtitle">Çalışmak veya Test olmak için bir ders seçin.</p>
                </div>
                <div class="account-pill" title="Hesap durumu" style="white-space:nowrap; background:#eef2ff; color:#3730a3; padding:8px 12px; border-radius:999px; font-size:0.85rem; border:1px solid #e2e8f0;">${statusText}</div>
            </div>
            
            <div class="lesson-grid" style="margin-bottom: 30px;">
        `;

        lessons.forEach(lesson => {
            const stat = lessonStats[lesson.code] || { total: 0, learned: 0, due: 0 };
            const percent = stat.total > 0 ? Math.round((stat.learned / stat.total) * 100) : 0;

            html += `
                <div class="lesson-card" onclick="window.openLessonDetail('${lesson.code}', '${lesson.file}')">
                    <div class="card-header">
                        <span class="course-code">${lesson.code}</span>
                        ${stat.due > 0 ? `<span class="badge due">${stat.due} Tekrar</span>` : ''}
                    </div>
                    <h3>${lesson.name}</h3>
                    <div class="progress-container">
                        <div class="progress-info"><span>İlerleme</span><span>%${percent}</span></div>
                        <div class="progress-bar"><div class="fill" style="width: ${percent}%"></div></div>
                    </div>
                </div>
            `;
        });

        html += `</div>`; // Grid kapanış

        // 2. BÖLÜM: PROFİL VE ANALİZ (ACCORDION)
        html += `
            <div class="analysis-accordion" style="margin-bottom: 40px;">
                <button class="accordion-btn" onclick="window.toggleAnalysis()">
                    <span><i class="fa-solid fa-chart-pie"></i> Profil ve Analiz Raporu</span>
                    <i class="fa-solid fa-chevron-down" id="accordion-icon"></i>
                </button>
                
                <div id="analysis-content" class="accordion-content" style="display:none; margin-top: 15px;">
                    <div class="user-profile-card">
                        <div class="profile-icon">${rank.icon}</div>
                        <div class="profile-info">
                            <div class="rank-title">${rank.title}</div>
                            <div class="user-name-display">${userName}</div>
                            <div class="xp-bar-container">
                                <div class="xp-info"><span>${stats.xp} XP</span><small>Sonraki: ${rank.next} XP</small></div>
                                <div class="xp-bar"><div class="xp-fill" style="width: ${(stats.xp / rank.next) * 100}%"></div></div>
                            </div>
                        </div>
                        <div class="streak-badge">🔥 ${stats.streak || 0} Gün</div>
                    </div>

                    <div class="activity-panel">
                        <div class="stats-grid">
                            <div class="stat-mini-card"><div class="stat-icon bg-blue"><i class="fa-solid fa-calendar-day"></i></div><div class="stat-data"><span class="stat-num">${activityStats.today}</span><span class="stat-desc">Bugün</span></div></div>
                            <div class="stat-mini-card"><div class="stat-icon bg-green"><i class="fa-solid fa-calendar-week"></i></div><div class="stat-data"><span class="stat-num">${activityStats.week}</span><span class="stat-desc">Bu Hafta</span></div></div>
                            <div class="stat-mini-card"><div class="stat-icon bg-orange"><i class="fa-solid fa-layer-group"></i></div><div class="stat-data"><span class="stat-num">${activityStats.total}</span><span class="stat-desc">Toplam</span></div></div>
                        </div>
                        
                        <div class="unit-breakdown" style="margin-top:20px; background:white; padding:15px; border-radius:12px; border:1px solid #e2e8f0;">
                            <h4 style="margin:0 0 15px 0; color:#1e293b; font-size:0.95rem;">Ders Bazlı İlerleme Detayı</h4>
                            <div style="display:flex; flex-direction:column; gap:12px;">
                                ${lessons.map(lesson => {
                                    const stat = lessonStats[lesson.code];
                                    const percent = stat.percent;
                                    const weakUnit = stat.weakestUnit ? `⚠️ Ünite ${stat.weakestUnit} zayıf` : '✅ Başlangıç seviyesi';
                                    const progressColor = percent > 50 ? '#10b981' : (percent > 20 ? '#3b82f6' : '#cbd5e1');
                                    return `
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div style="flex:1;">
                                            <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:3px;">
                                                <span style="font-weight:600; color:#334155;">${lesson.code}</span>
                                                <span style="font-size:0.75rem; color:#64748b;">${weakUnit}</span>
                                            </div>
                                            <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                                                <div style="height:100%; width:${percent}%; background:${progressColor};"></div>
                                            </div>
                                        </div>
                                        <span style="font-size:0.85rem; font-weight:bold; color:#334155; width:35px; text-align:right;">%${percent}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        html += `<div class="app-footer">Sürüm: v${versionInfo.version}</div>`;
        this.container.innerHTML = html;
        await this.refreshAccountStatus();
        
        // Global Eventler
        window.openLessonDetail = (code, file) => this.showLessonDetailModal(code, file);
        
        window.toggleAnalysis = () => {
            const content = document.getElementById('analysis-content');
            const icon = document.getElementById('accordion-icon');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            } else {
                content.style.display = 'none';
                icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            }
        };
        const auth = new AuthManager(this.db);
        if (!auth.hasToken() && !localStorage.getItem('guest_mode')) {
            this.showWelcomeOverlay();
        }
    }

    // --- DETAYLI DERS KARNESİ (MODAL) ---
    async showLessonDetailModal(code, file) {
        const modalHtml = `
            <div class="modal-overlay" id="detail-modal">
                <div class="modal-box large">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modal-lesson-title">${code} Analizi</h2>
                        <button class="icon-btn" onclick="document.getElementById('detail-modal').remove()"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div id="modal-content" style="max-height: 60vh; overflow-y: auto;">
                        <div class="spinner" style="margin: 20px auto;"></div>
                    </div>
                    <div class="modal-footer-actions">
                        <button class="primary-btn full-width" onclick="window.openExamConfig('${code}')">Genel Sınav / Tekrar Oluştur</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const allCards = await this.loader.loadLessonData(code, file);
        
        const units = {};
        for(let i=1; i<=8; i++) units[i] = { total: 0, learned: 0 };

        allCards.forEach(card => {
            const u = card.unit || 0;
            if(!units[u]) units[u] = { total: 0, learned: 0 };
            units[u].total++;
            if(card.level > 0) units[u].learned++;
        });

        let listHtml = `<div class="unit-list">`;
        
        for(let i=1; i<=8; i++) {
            const u = units[i];
            if(u.total === 0) continue;

            const percent = Math.round((u.learned / u.total) * 100);
            
            let statusBadge = '';
            let statusClass = '';
            
            if (percent === 0) {
                statusBadge = '<i class="fa-regular fa-circle"></i> Hiç Bakılmadı';
                statusClass = 'status-gray';
            } else if (percent === 100) {
                statusBadge = '<i class="fa-solid fa-circle-check"></i> Tamamlandı';
                statusClass = 'status-green';
            } else {
                statusBadge = '<i class="fa-solid fa-spinner"></i> Çalışılıyor';
                statusClass = 'status-blue';
            }

            listHtml += `
                <div class="unit-item">
                    <div class="unit-info">
                        <div style="display:flex; justify-content:space-between;">
                            <span class="unit-name">Ünite ${i}</span>
                            <span class="unit-status-badge ${statusClass}">${statusBadge}</span>
                        </div>
                        <div class="unit-progress-bg" style="width:100%; margin-top:5px;">
                            <div class="unit-progress-fill" style="width: ${percent}%; background-color: ${percent===0 ? '#e2e8f0' : 'var(--primary)'}"></div>
                        </div>
                        <small style="color:#64748b; font-size:0.75rem; margin-top:2px;">${u.learned} / ${u.total} Soru Öğrenildi</small>
                    </div>
                    <button class="sm-btn" onclick="window.startUnitStudy('${code}', ${i})">
                        <i class="fa-solid fa-play"></i> Çalış
                    </button>
                </div>
            `;
        }
        listHtml += `</div>`;

        document.getElementById('modal-content').innerHTML = listHtml;

        // Global Modal Fonksiyonları
        window.startUnitStudy = (lessonCode, unitNo) => {
            document.getElementById('detail-modal').remove();
            window.startSession(lessonCode, { mode: 'study', specificUnit: unitNo });
        };

        window.openExamConfig = (lessonCode) => {
            document.getElementById('detail-modal').remove();
            this.showExamConfigModal(lessonCode); 
        };
    }

    // --- HESAPLAMALAR ---
    async calculateLessonStats(lessons) {
        const stats = {};
        for (const lesson of lessons) {
            const lessonProgress = await this.db.getProgressByLesson(lesson.code);
            const estimatedTotal = 150;
            const learnedCount = lessonProgress.filter(p => p.level > 0).length;
            const dueCount = lessonProgress.filter(p => p.nextReview <= Date.now()).length;
            const unitCounts = {};
            lessonProgress.forEach(p => {
                const u = `U${p.unit || 0}`;
                if (!unitCounts[u]) unitCounts[u] = { total: 0, learned: 0 };
                unitCounts[u].total++;
                if (p.level > 0) unitCounts[u].learned++;
            });
            let weakest = null;
            Object.keys(unitCounts).forEach(u => {
                const info = unitCounts[u];
                if (info.total > 0 && (info.learned / info.total) < 0.5) weakest = u.replace('U', '');
            });
            stats[lesson.code] = {
                total: estimatedTotal,
                learned: learnedCount,
                due: dueCount,
                percent: Math.min(100, Math.round((learnedCount / estimatedTotal) * 100)),
                weakestUnit: weakest
            };
        }
        return stats;
    }

    async calculateActivityStats(history) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = startOfDay - (7 * 24 * 60 * 60 * 1000);
        const todayList = await this.db.getHistorySince(startOfDay);
        const weekList = await this.db.getHistorySince(startOfWeek);
        return { today: todayList.length, week: weekList.length, total: history.length, topUnits: [] };
    }

    // --- DİĞER MODALLAR ---
    showNameModal() {
        const html = `<div class="modal-overlay"><div class="modal-box"><h2 class="modal-title">👋 Merhaba!</h2><input type="text" id="inp-username" class="form-select" placeholder="Adınız..." autofocus><div class="modal-actions"><button class="primary-btn" onclick="window.saveName()">Başla</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.saveName = async () => {
            const name = document.getElementById('inp-username').value;
            if(name.trim().length > 0) { await this.db.setUserName(name); document.querySelector('.modal-overlay').remove(); this.render(); }
        };
    }

    showExamConfigModal(lessonCode) {
        const html = `<div class="modal-overlay" id="exam-modal"><div class="modal-box"><h2 class="modal-title">Genel Sınav / Tekrar</h2><div class="form-group"><label class="form-label">Mod Seçimi</label><select id="select-mode" class="form-select" onchange="window.toggleExamOptions()"><option value="study">📚 Akıllı Çalışma (Tüm Üniteler)</option><option value="exam">📝 Deneme Sınavı</option></select></div><div id="exam-options" style="display:none;"><div class="form-group"><label class="form-label">Sınav Türü</label><select id="select-type" class="form-select"><option value="midterm">Ara Sınav (Ünite 1-4)</option><option value="final">Final (Tümü - %30/%70)</option></select></div><div class="form-group"><label class="form-label">Soru Sayısı</label><select id="select-count" class="form-select"><option value="5">5 Soru</option><option value="10">10 Soru</option><option value="20" selected>20 Soru</option></select></div></div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('exam-modal').remove()">İptal</button><button class="primary-btn" onclick="window.startExam('${lessonCode}')">Başlat</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.toggleExamOptions = () => {
            const mode = document.getElementById('select-mode').value;
            document.getElementById('exam-options').style.display = (mode === 'exam') ? 'block' : 'none';
        };
        window.startExam = (code) => {
            const mode = document.getElementById('select-mode').value;
            const config = {
                mode: mode,
                type: document.getElementById('select-type').value,
                count: parseInt(document.getElementById('select-count').value)
            };
            document.getElementById('exam-modal').remove();
            window.startSession(code, config); 
        };
    }

    async openAccountInfo() {
        const hasTok = !!localStorage.getItem('auth_token');
        let email = await this.db.getProfile('account_email');
        const nameLocal = await this.db.getUserName();
        const lastSyncTs = await this.db.getProfile('last_sync');
        const status = hasTok ? 'Üye' : 'Misafir';
        if (hasTok && !email) {
            const sm = new SyncManager(this.db);
            const info = await sm.me();
            if (info && info.email) { email = info.email; await this.db.setProfile('account_email', email); }
        }
        const html = `
        <div class="modal-overlay" id="account-info-modal">
            <div class="modal-box">
                <div class="modal-header"><h2 class="modal-title">Kullanıcı Bilgileri</h2><button class="icon-btn" onclick="document.getElementById('account-info-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div><strong>Durum:</strong> ${status}</div>
                    <div><strong>E‑posta:</strong> ${email || '-'}</div>
                    <div><strong>Ad (Cihaz):</strong> ${nameLocal || '-'}</div>
                    <div><strong>Son Senkron:</strong> ${lastSyncTs ? new Date(lastSyncTs).toLocaleString() : '-'}</div>
                    <div style="margin-top:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                        <div style="font-weight:600; margin-bottom:6px;">Neden sunucuya aktarmalıyım?</div>
                        <ul style="margin:0; padding-left:18px; color:#334155; font-size:0.9rem;">
                            <li>Veriler bulutta yedeklenir; cihaz değiştirince geri yüklenir.</li>
                            <li>Birden fazla cihazda aynı hesabı kullanırsın.</li>
                            <li>İlerleme ve skorların kaybolmaz.</li>
                        </ul>
                    </div>
                    <div id="profile-sync-msg" style="display:none; margin-top:8px; background:#dcfce7; color:#166534; padding:8px 12px; border-radius:8px; font-weight:600;">İşlem tamamlandı.</div>
                </div>
                <div class="modal-actions" style="margin-top:12px; display:flex; gap:8px;">
                    ${hasTok ? '<button class="primary-btn" onclick="window.pushProfileToServer()">Sunucuya Aktar</button><button class="nav-btn" onclick="window.pullFromServer()">Sunucudan Çek</button>' : '<button class="primary-btn" onclick="document.getElementById(\'account-info-modal\').remove(); window.openAuthSync()">Üye Ol / Giriş Yap</button>'}
                    <button class="nav-btn secondary" onclick="document.getElementById('account-info-modal').remove()">Kapat</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.pushProfileToServer = async () => {
            const sm = new SyncManager(this.db);
            const uname = await this.db.getUserName();
            if (uname) { await sm.updateProfileName(uname); }
            const ok = await sm.pushAll();
            await this.refreshAccountStatus();
            const msg = document.getElementById('profile-sync-msg');
            if (msg) { msg.textContent = ok ? 'Buluta yedeklendi' : 'Aktarım başarısız'; msg.style.display = 'block'; msg.style.background = ok ? '#dcfce7' : '#fee2e2'; msg.style.color = ok ? '#166534' : '#991b1b'; }
        };
        window.pullFromServer = async () => {
            const sm = new SyncManager(this.db);
            const ok = await sm.pullAll();
            await this.refreshAccountStatus();
            const msg = document.getElementById('profile-sync-msg');
            if (msg) { msg.textContent = ok ? 'Sunucudan alındı' : 'Yükleme başarısız'; msg.style.display = 'block'; msg.style.background = ok ? '#dcfce7' : '#fee2e2'; msg.style.color = ok ? '#166534' : '#991b1b'; }
        };
    }

    async openAccounts() {
        const list = (await this.db.getProfile('accounts')) || [];
        const items = Array.isArray(list) ? list : [];
        const activeEmail = await this.db.getProfile('account_email');
        const html = `
        <div class="modal-overlay" id="accounts-modal">
            <div class="modal-box large">
                <div class="modal-header"><h2 class="modal-title">Kayıtlı Hesaplar</h2><button class="icon-btn" onclick="document.getElementById('accounts-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                <div style="display:flex; justify-content:flex-end; gap:8px; padding:8px 0;"><button class="nav-btn" onclick="document.getElementById('accounts-modal').remove(); window.openAuthSync()">Hesap Ekle</button></div>
                <div id="accounts-content" style="max-height:60vh; overflow:auto;">
                    ${items.length === 0 ? '<div style="padding:12px; color:#64748b;">Kayıtlı hesap bulunmuyor.</div>' : items.map(acc => {
                        const ts = acc.lastSync ? new Date(acc.lastSync).toLocaleString() : '-';
                        const active = (acc.email === activeEmail);
                        return `<div class=\"lesson-card\" style=\"display:flex; align-items:center; justify-content:space-between;\">
                            <div>
                                <div style=\"font-weight:600; display:flex; align-items:center; gap:8px;\">${acc.email} ${active ? '<span style=\\"background:#dcfce7; color:#166534; padding:2px 8px; border-radius:999px; font-size:0.75rem;\\">Aktif</span>' : ''}</div>
                                <small style=\"color:#64748b;\">Son Senkron: ${ts}</small>
                            </div>
                            <div style=\"display:flex; gap:8px;\">
                                <button class=\"nav-btn\" onclick=\"window.useAccount('${acc.email}')\">Kullan</button>
                                <button class=\"nav-btn warning\" onclick=\"window.removeAccount('${acc.email}')\">Kaldır</button>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.useAccount = async (email) => {
            const list2 = (await this.db.getProfile('accounts')) || [];
            const found = (Array.isArray(list2) ? list2 : []).find(a => a && a.email === email);
            if (!found) return;
            localStorage.setItem('auth_token', found.token || '');
            await this.db.setProfile('account_email', email);
            await this.refreshAccountStatus();
            document.getElementById('accounts-modal').remove();
            this.render();
        };
        window.removeAccount = async (email) => {
            const list2 = (await this.db.getProfile('accounts')) || [];
            const filtered = (Array.isArray(list2) ? list2 : []).filter(a => !a || a.email !== email);
            await this.db.setProfile('accounts', filtered);
            document.getElementById('accounts-modal').remove();
            this.openAccounts();
        };
    }

    openSettings() {
        const existing = document.getElementById('settings-menu-overlay');
        if (existing) existing.remove();
        const html = `
            <div id="settings-menu-overlay" style="position:fixed; inset:0; background:transparent;">
                <div id="settings-menu" style="position:fixed; right:16px; top:60px; background:white; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.08); border-radius:12px; min-width:280px; overflow:hidden;">
                    <div style="padding:10px 12px; font-weight:600; border-bottom:1px solid #f1f5f9;">Ayarlar</div>
                    <div style="padding:8px 12px; font-size:0.85rem; color:#334155; border-bottom:1px solid #f1f5f9;">Durum: ${localStorage.getItem('auth_token') ? 'Üye' : 'Misafir'}</div>
                    <div style="padding:8px 12px; font-size:0.8rem; color:#64748b; border-bottom:1px solid #f1f5f9;">Hesap</div>
                    <button class="nav-btn" style="width:100%; justify-content:flex-start;" onclick="window.openAccountInfo()">Kullanıcı Bilgileri</button>
                    <button class="nav-btn" style="width:100%; justify-content:flex-start;" onclick="window.openAccounts()">Kayıtlı Hesaplar</button>
                    <button class="nav-btn" style="width:100%; justify-content:flex-start;" onclick="window.openAuthSync()">Giriş / Senkronizasyon</button>
                    ${localStorage.getItem('auth_token') ? `<button class=\"nav-btn\" style=\"width:100%; justify-content:flex-start;\" onclick=\"window.logoutNow()\">Çıkış Yap</button>` : ''}
                    ${localStorage.getItem('auth_token') ? `<button class=\"nav-btn warning\" style=\"width:100%; justify-content:flex-start;\" onclick=\"window.confirmDeleteAccount()\">Hesabımı Sil</button>` : ''}
                    <div style="padding:8px 12px; font-size:0.8rem; color:#64748b; border-top:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9;">Veri</div>
                    <button class="nav-btn secondary" style="width:100%; justify-content:flex-start;" onclick="window.confirmReset()">Verileri Sıfırla (Sunucu+Lokal)</button>
                    <button class="nav-btn" style="width:100%; justify-content:flex-start;" onclick="window.openChangelog()">Sürüm Notları</button>
                    <div style="padding:8px 12px; font-size:0.8rem; color:#64748b; border-top:1px solid #f1f5f9; border-bottom:1px solid #f1f5f9;">Sistem</div>
                    <button class="nav-btn" style="width:100%; justify-content:flex-start;" onclick="window.checkUpdatesNow()">Güncellemeleri Kontrol Et</button>
                    <button class="nav-btn warning" style="width:100%; justify-content:flex-start;" onclick="window.manualUpdateNow()">Manuel Güncelle</button>
                    <button class="nav-btn secondary" style="width:100%; justify-content:flex-start;" onclick="document.getElementById('settings-menu-overlay').remove()">Kapat</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('settings-menu-overlay');
        overlay.addEventListener('click', (e) => { if (e.target.id === 'settings-menu-overlay') overlay.remove(); });
        const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);

        window.confirmReset = () => {
            const html = `
            <div class="modal-overlay" id="confirm-reset-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Onay</h2><button class="icon-btn" onclick="document.getElementById('confirm-reset-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Tüm ilerlemeni silmek istediğine emin misin?</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-reset-modal').remove()">İptal</button>
                        <button class="primary-btn" style="background-color:#ef4444;" onclick="window.resetApp()">Evet, Sıfırla</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.confirmDeleteAccount = () => {
            const html = `
            <div class="modal-overlay" id="confirm-del-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Hesabı Sil</h2><button class="icon-btn" onclick="document.getElementById('confirm-del-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Hesabın ve tüm verilerin kalıcı olarak silinecek. Emin misin?</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-del-modal').remove()">İptal</button>
                        <button class="primary-btn" style="background-color:#ef4444;" onclick="window.deleteAccountNow()">Evet, Sil</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.deleteAccountNow = async () => {
            const auth = new AuthManager(this.db);
            const ok = await auth.deleteAccount();
            if (ok) { await this.db.resetAllData(); localStorage.removeItem('guest_mode'); location.reload(); }
            else alert('Silme işlemi başarısız');
        };

        window.resetApp = async () => {
            const auth = new AuthManager(this.db);
            if (auth.hasToken()) { await auth.wipeRemote().catch(()=>{}); }
            await this.db.resetAllData();
            location.reload();
        };

        window.openChangelog = async () => {
            const res = await fetch('data/changelog.json?t=' + Date.now()).then(r => r.json()).catch(() => []);
            const list = Array.isArray(res) ? res : [];
            const sorted = list.sort((a,b) => b.version.localeCompare(a.version));
            const modalHtml = `
            <div class="modal-overlay" id="changelog-modal">
                <div class="modal-box large">
                    <div class="modal-header"><h2 class="modal-title">Sürüm Notları</h2><button class="icon-btn" onclick="document.getElementById('changelog-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div id="changelog-content" style="max-height:60vh; overflow-y:auto;">
                        ${sorted.map(item => `
                            <div class="lesson-card" style="cursor:pointer;" onclick="window.showReleaseNotes('${item.version}')">
                                <h3>v${item.version}</h3>
                                <small>${item.date || ''}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            window.showReleaseNotes = async (v) => {
                const res2 = await fetch('data/changelog.json?t=' + Date.now()).then(r => r.json()).catch(() => []);
                const list2 = Array.isArray(res2) ? res2 : [];
                const found = list2.find(x => x.version === v) || { items: [] };
                const notes = Array.isArray(found.items) ? found.items : [];
                const html2 = `
                <div class="modal-overlay" id="release-modal">
                    <div class="modal-box">
                        <div class="modal-header"><h2 class="modal-title">v${v} Sürüm Notları</h2><button class="icon-btn" onclick="document.getElementById('release-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                        <div style="max-height:50vh; overflow-y:auto;">
                            <ul style="padding-left:18px;">${notes.map(n => `<li>${n}</li>`).join('')}</ul>
                        </div>
                    </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html2);
            };
        };

        window.checkUpdatesNow = async () => {
            const updater = new UpdateManager();
            const overlayId = 'update-check-overlay';
            const overlayHtml = `<div class="modal-overlay" id="${overlayId}"><div class="modal-box"><div class="modal-header"><h2 class="modal-title">Güncelleme Kontrolü</h2><button class="icon-btn" onclick="document.getElementById('${overlayId}').remove()"><i class="fa-solid fa-xmark"></i></button></div><div id="update-check-content" class="loading-state"><div class="spinner"></div><p>Sunucu sürümü kontrol ediliyor...</p></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', overlayHtml);
            try {
                await updater.checkUpdates();
                const cont = document.getElementById('update-check-content');
                if (cont) cont.innerHTML = `<div style="padding:10px 0; color:#10b981; font-weight:600;">Güncel sürüm kullanılıyor.</div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('${overlayId}').remove()">Kapat</button></div>`;
            } catch {
                const cont = document.getElementById('update-check-content');
                if (cont) cont.innerHTML = `<div style="padding:10px 0; color:#ef4444; font-weight:600;">Kontrol sırasında hata oluştu.</div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('${overlayId}').remove()">Kapat</button></div>`;
            }
        };

        window.manualUpdateNow = async () => {
            const updater = new UpdateManager();
            const id = 'manual-update-overlay';
            const html = `<div class="modal-overlay" id="${id}"><div class="modal-box"><div class="modal-header"><h2 class="modal-title">Manuel Güncelle</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div><div class="loading-state"><div class="spinner"></div><p>Önbellek temizleniyor ve sayfa yenileniyor...</p></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            await updater.performCleanup();
            location.reload();
        };

        window.openAccountInfo = () => this.openAccountInfo();
        window.openAccounts = () => this.openAccounts();

        window.openAuthSync = async () => {
            const hasTokenNow = !!localStorage.getItem('auth_token');
            const accEmailNow = await this.db.getProfile('account_email');
            const lastSyncNow = await this.db.getProfile('last_sync');
            const statusNow = hasTokenNow ? `Üye${accEmailNow?` • ${accEmailNow}`:''}${lastSyncNow?` • Son Senkron: ${new Date(lastSyncNow).toLocaleString()}`:''}` : 'Misafir';
            const formHtml = hasTokenNow ? `<div style="padding:8px 12px; color:#334155; font-size:0.9rem;">Giriş yapmışsınız. Aşağıdan yedekleme işlemlerini kullanabilirsiniz.</div>` : `
                        <div class="form-group">
                            <input type="email" id="auth-email" class="form-select" placeholder="E-posta">
                            <input type="password" id="auth-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;">
                            <div class="modal-actions" style="margin-top:10px; display:flex; gap:8px;">
                                <button class="nav-btn" onclick="window.doRegister()">Kayıt Ol</button>
                                <button class="primary-btn" onclick="window.doLogin()">Giriş Yap</button>
                            </div>
                        </div>`;
            const html = `
            <div class="modal-overlay" id="auth-sync-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Giriş / Senkronizasyon</h2><button class="icon-btn" onclick="document.getElementById('auth-sync-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="background:#f1f5f9; color:#334155; padding:8px 12px; border-radius:8px; font-size:0.85rem; margin-bottom:10px;">Durum: ${statusNow}</div>
                    ${formHtml}
                    <div class="modal-actions" style="margin-top:16px; display:flex; gap:8px;">
                        <button class="nav-btn" onclick="window.doPushSync()">Sunucuya Yedekle</button>
                        <button class="nav-btn" onclick="window.doPullSync()">Sunucudan Yükle</button>
                        ${hasTokenNow ? '<button class="nav-btn warning" onclick="window.logoutNow()">Çıkış Yap</button>' : ''}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            const sm = new SyncManager(this.db);
            const auth = new AuthManager(this.db);
            window.doRegister = async () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; const res = await auth.register(e,p); if (res && res.exists) { alert('Bu e-posta ile kayıt zaten mevcut. Lütfen giriş yapın.'); return; } await auth.saveCurrentAccount(); alert(res && res.ok ? 'Kayıt başarılı' : 'Kayıt başarısız'); };
            window.doLogin = async () => { const e = document.getElementById('auth-email').value; const p = document.getElementById('auth-pass').value; const ok = await auth.login(e,p); if (ok) { await auth.saveCurrentAccount(); await this.refreshAccountStatus(); } alert(ok ? 'Giriş başarılı' : 'Giriş başarısız'); };
            window.doPushSync = async () => { const ok = await sm.pushAll().catch(async () => { const payload = { type:'push' }; await this.db.enqueueSync(payload); return false; }); alert(ok ? 'Yedekleme tamam' : 'Yedekleme başarısız'); };
            window.doPullSync = async () => { const ok = await sm.pullAll(); alert(ok ? 'Yükleme tamam' : 'Yükleme başarısız'); };
            window.logoutNow = async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); document.getElementById('auth-sync-modal').remove(); this.render(); };
        };

        window.logoutNow = async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); document.getElementById('settings-menu-overlay').remove(); this.render(); };
    }

    showWelcomeOverlay(){
        const existing = document.getElementById('welcome-overlay');
        if (existing) return;
        const html = `
        <div id="welcome-overlay" style="position:fixed; inset:0; background:rgba(17,24,39,0.6); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999;">
            <div class="modal-box" style="max-width:560px; width:90%;">
                <div class="modal-header" style="border:none;">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;">
                        <img src="assets/logo.png" alt="logo" style="width:32px; height:32px;"> AÖF Sınav Asistanı
                    </h2>
                </div>
                <p style="color:#64748b; margin-top:-6px;">Sınavlara her yerden hazırlan, ilerlemeni asla kaybetme.</p>
                <div id="local-data-banner" style="display:none; margin-top:8px; background:#ecfeff; color:#0e7490; padding:10px 12px; border-radius:10px; font-size:0.85rem;">Bu cihazda kayıtlı ilerleme bulundu. Üye olursan otomatik buluta taşınacak.</div>
                <div style="margin-top:12px; display:flex; gap:8px;">
                    <button class="nav-btn" onclick="window.switchAuthTab('login')" id="tab-login">Giriş Yap</button>
                    <button class="nav-btn" onclick="window.switchAuthTab('register')" id="tab-register">Kayıt Ol</button>
                </div>
                <div id="auth-forms" style="margin-top:12px;">
                    <div id="form-login">
                        <input type="email" id="welcome-email" class="form-select" placeholder="E-posta">
                        <input type="password" id="welcome-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;">
                        <div class="modal-actions" style="margin-top:10px;">
                            <button class="primary-btn" onclick="window.handleLogin()">Giriş Yap</button>
                        </div>
                    </div>
                    <div id="form-register" style="display:none;">
                        <input type="text" id="welcome-name" class="form-select" placeholder="Ad Soyad">
                        <input type="email" id="welcome-email-r" class="form-select" placeholder="E-posta" style="margin-top:8px;">
                        <input type="password" id="welcome-pass-r" class="form-select" placeholder="Şifre" style="margin-top:8px;">
                        <div class="modal-actions" style="margin-top:10px;">
                            <button class="primary-btn" onclick="window.handleRegister()">Kayıt Ol</button>
                        </div>
                    </div>
                </div>
                <div style="margin-top:12px; text-align:center;">
                    <button class="nav-btn secondary" style="opacity:0.8;" onclick="window.continueGuest()">Üye olmadan cihazımda devam et (Veriler sadece bu cihazda kalır)</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const auth = new AuthManager(this.db);
        (async () => { const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const has = (Array.isArray(p)&&p.length>0)||(Array.isArray(h)&&h.length>0)||((s.xp||0)>0||(s.streak||0)>0||(s.totalQuestions||0)>0); const banner = document.getElementById('local-data-banner'); if (banner && has) banner.style.display='block'; const name = await this.db.getUserName(); if (name) { const nm = document.getElementById('welcome-name'); if (nm) nm.value = name; } })();
        window.switchAuthTab = (tab) => {
            document.getElementById('form-login').style.display = (tab==='login') ? 'block':'none';
            document.getElementById('form-register').style.display = (tab==='register') ? 'block':'none';
            document.getElementById('tab-login').classList.toggle('primary', tab==='login');
            document.getElementById('tab-register').classList.toggle('primary', tab==='register');
        };
        window.handleLogin = async () => {
            const e = document.getElementById('welcome-email').value;
            const p = document.getElementById('welcome-pass').value;
            const ok = await auth.login(e,p);
            if (ok) { document.getElementById('welcome-overlay').remove(); this.render(); }
            else { alert('Giriş başarısız'); }
        };
        window.handleRegister = async () => {
            const n = document.getElementById('welcome-name').value;
            const e = document.getElementById('welcome-email-r').value;
            const p = document.getElementById('welcome-pass-r').value;
            const res = await auth.register(e,p,n);
            if (res && res.exists) { alert('Bu e-posta ile kayıt zaten mevcut. Lütfen giriş yapın.'); return; }
            if (res && res.ok) { document.getElementById('welcome-overlay').remove(); this.render(); }
            else { alert('Kayıt başarısız'); }
        };
        window.continueGuest = () => { localStorage.setItem('guest_mode','1'); const name = prompt('Adınızı girin (isteğe bağlı)'); if (name && name.trim().length>0) { this.db.setUserName(name.trim()); } document.getElementById('welcome-overlay').remove(); };
        window.switchAuthTab('login');
    }
    
    async getAccountStatusText(){
        const hasToken = !!localStorage.getItem('auth_token');
        const accEmail = await this.db.getProfile('account_email');
        const lastSync = await this.db.getProfile('last_sync');
        return hasToken ? `Üye${accEmail?` • ${accEmail}`:''}${lastSync?` • Son Senkron: ${new Date(lastSync).toLocaleString()}`:''}` : 'Misafir (Veriler sadece bu cihazda)';
    }

    async refreshAccountStatus(){
        const txt = await this.getAccountStatusText();
        const pill = document.querySelector('.account-pill');
        if (pill) { pill.textContent = txt; }
        const ua = document.querySelector('.user-actions');
        if (ua) {
            let mini = document.getElementById('account-mini');
            if (!mini) {
                mini = document.createElement('span');
                mini.id = 'account-mini';
                mini.style.marginRight = '8px';
                mini.style.fontSize = '0.85rem';
                mini.style.color = '#334155';
                mini.style.cursor = 'pointer';
                ua.insertBefore(mini, ua.firstChild);
            }
            const hasToken = !!localStorage.getItem('auth_token');
            const accEmail = await this.db.getProfile('account_email');
            mini.textContent = hasToken ? (accEmail || 'Üye') : 'Misafir';
            mini.title = 'Kayıtlı Hesaplar';
            mini.onclick = () => this.openAccounts();
        }
    }
}
