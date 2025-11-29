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

    async ensureActiveAccountToken(){
        const hasToken = !!localStorage.getItem('auth_token');
        if (hasToken) return;
        const list = (await this.db.getProfile('accounts')) || [];
        const items = Array.isArray(list) ? list : [];
        const activeEmail = await this.db.getProfile('account_email');
        let acc = items.find(a => a && a.email === activeEmail && a.token);
        if (!acc) acc = items.find(a => a && a.token);
        if (acc && acc.token) {
            localStorage.setItem('auth_token', acc.token);
            if (acc.email && !activeEmail) { await this.db.setProfile('account_email', acc.email); }
        }
    }

    async refreshAndRender(){
        const wrap = document.getElementById('dashboard-container');
        if (!wrap || !wrap.children || wrap.children.length === 0) {
            if (this.loader && typeof this.loader.resetCache === 'function') { this.loader.resetCache(); }
            await this.render();
            return;
        }
        await this.updateUIValues();
    }

    async updateUIValues(){
        const lessons = await this.loader.getLessonList();
        const stats = await this.db.getUserStats();
        const rank = new Gamification(this.db).getRank(stats.xp);
        const lessonStats = await this.calculateLessonStats(lessons);
        lessons.forEach(lesson => {
            const st = lessonStats[lesson.code] || { total:0, learned:0 };
            const percent = st.total>0 ? Math.round((st.learned/st.total)*100) : 0;
            const bar = document.getElementById(`prog-bar-${lesson.code}`);
            const txt = document.getElementById(`prog-text-${lesson.code}`);
            if (bar) bar.style.width = `${percent}%`;
            if (txt) txt.textContent = `%${percent}`;
        });
        const xpEl = document.getElementById('dash-xp-value');
        const xpFill = document.querySelector('.xp-fill');
        if (xpEl) xpEl.textContent = String(stats.xp||0);
        if (xpFill) xpFill.style.width = `${Math.min(100, (stats.xp / (rank.next||1)) * 100)}%`;
        await this.refreshAccountStatus();
    }

    // Ana Ekranı Çiz
    async render() {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Veriler Yükleniyor...</p></div>';

        await this.ensureActiveAccountToken();
        const authGate = new AuthManager(this.db);
        const inSession = !!window.__inSession;
        if (!authGate.hasToken() && !localStorage.getItem('guest_mode') && !inSession) {
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
        let html = `<div id="dashboard-container">
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
            const stat = lessonStats[lesson.code] || { total: 0, learned: 0, repeats: 0 };
            const percent = stat.total > 0 ? Math.round((stat.learned / stat.total) * 100) : 0;

            html += `
                <div class="lesson-card" onclick="window.openLessonDetail('${lesson.code}', '${lesson.file}')">
                    <div class="card-header">
                        <span class="course-code">${lesson.code}</span>
                    </div>
                    <h3>${lesson.name}</h3>
                    <div class="progress-container">
                        <div class="progress-info"><span>İlerleme</span><span id="prog-text-${lesson.code}">%${percent}</span></div>
                        <div class="progress-bar"><div class="fill" id="prog-bar-${lesson.code}" style="width: ${percent}%"></div></div>
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
                                <div class="xp-info"><span id="dash-xp-value">${stats.xp}</span> XP<small>Sonraki: ${rank.next} XP</small></div>
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
        html += `</div>`;
        this.container.innerHTML = html;
        await this.refreshAccountStatus();
        window.loadTooltips = async () => {
            const tips = await fetch('api/tooltips.php?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
            const nodes = document.querySelectorAll('[data-tip]');
            nodes.forEach(el => { const key = el.getAttribute('data-tip'); if (key && tips[key]) el.title = tips[key]; });
        };
        window.loadTooltips();
        
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
        const inSession2 = !!window.__inSession;
        if (!auth.hasToken() && !localStorage.getItem('guest_mode') && !inSession2) {
            this.showWelcomeOverlay();
        }
    }

    // --- DETAYLI DERS KARNESİ (MODAL) ---
    async showLessonDetailModal(code, file) {
        this.currentLessonFile = file;
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
            const rCount = (this.db.countUnitRepeats ? await this.db.countUnitRepeats(code, i) : 0);
            const activeRep = (this.db.hasActiveSessionForUnit ? await this.db.hasActiveSessionForUnit(code, i) : false);
            const repLabel = rCount > 0 ? `${rCount}. tekrar${activeRep ? ' • devam ediyor' : ''}` : '';
            
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
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="ghost-btn" onclick="window.startUnitStudy('${code}', ${i})" aria-label="Ünite ${i} çalış">
                            <i class="fa-solid fa-play"></i> Çalış
                        </button>
                        ${repLabel ? `<span style="font-size:0.85rem; color:#334155;">${repLabel}</span>` : ''}
                        <button class="sm-btn" onclick="window.openUnitHistory('${code}', ${i})">Geçmiş</button>
                    </div>
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
        window.openUnitHistory = async (lessonCode, unitNo) => {
            const sessions = (this.db.getSessionsByUnit ? await this.db.getSessionsByUnit(lessonCode, unitNo) : []);
            const rows = [];
            for (const s of sessions) {
                const list = (this.db.getHistoryRange ? await this.db.getHistoryRange(lessonCode, unitNo, s.started_at||0, s.ended_at||Date.now()) : []);
                let c=0,w=0; list.forEach(x=>{ if (x.isCorrect) c++; else w++; });
                rows.push({ started_at: s.started_at, ended_at: s.ended_at, mode: s.mode||'study', correct:c, wrong:w, uuid:s.uuid });
            }
            const id = 'unit-history-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box large">
                    <div class="modal-header"><h2 class="modal-title">Ünite ${unitNo} Geçmişi</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:60vh; overflow:auto;">
                        ${rows.length===0 ? '<div style="color:#64748b; padding:12px;">Kayıt yok</div>' : rows.map((r,idx)=>`
                            <div class="lesson-card" style="display:flex; align-items:center; justify-content:space-between;">
                                <div>
                                    <div style="font-weight:600; color:#334155;">${idx+1}. ${new Date(r.started_at||Date.now()).toLocaleString()}${r.ended_at?` - ${new Date(r.ended_at).toLocaleString()}`:''}</div>
                                    <small style="color:#64748b;">Mod: ${r.mode} • Doğru: ${r.correct} • Yanlış: ${r.wrong}</small>
                                </div>
                                <button class="sm-btn" onclick="window.viewSessionMistakes('${lessonCode}', ${unitNo}, ${r.started_at||0}, ${r.ended_at||0})">Yanlışları Gör</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };
        window.viewSessionMistakes = async (lessonCode, unitNo, startTs, endTs) => {
            const list = (this.db.getHistoryRange ? await this.db.getHistoryRange(lessonCode, unitNo, startTs, endTs) : []);
            const fileName = this.currentLessonFile;
            const data = (this.loader && this.loader.loadLessonData) ? await this.loader.loadLessonData(lessonCode, fileName) : { cards: [] };
            const cards = (data.cards||[]).filter(c => parseInt(c.unit)||0 === parseInt(unitNo)||0);
            const map = new Map(cards.map(c => [c.id, c]));
            const wrongs = list.filter(x=>!x.isCorrect).map(w => ({ date: w.date, qid: w.qid||'', card: map.get(w.qid||'') }));
            const id = 'session-mistakes-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Yanlışlar</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:50vh; overflow:auto;">
                        ${wrongs.length===0?'<div style="color:#64748b; padding:12px;">Yanlış yok</div>':wrongs.map((w,idx)=>{
                            const q = w.card;
                            const expl = q && q.code_example ? `<div style=\"margin-top:6px; font-size:0.85rem; background:#f1f5f9; padding:6px; border-radius:4px; color:#475569;\"><strong>📝 Açıklama:</strong> ${escapeHTML(q.code_example)}</div>` : '';
                            return `<div class=\"lesson-card\" style=\"padding:12px; border-left:4px solid #ef4444;\">
                                <div style=\"font-weight:600; color:#334155; margin-bottom:6px;\">${idx+1}. ${q ? escapeHTML(q.question) : 'Soru bulunamadı'}</div>
                                <div style=\"font-size:0.9rem; color:#10b981;\"><strong>Doğru Cevap:</strong> ${q ? escapeHTML(q.correct_option) : '-'}</div>
                                ${expl}
                                <small style=\"color:#64748b;\">Tarih: ${new Date(w.date).toLocaleString()}</small>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };
    }

    // --- HESAPLAMALAR ---
    async calculateLessonStats(lessons) {
        const stats = {};
        for (const lesson of lessons) {
            const lessonProgress = await this.db.getProgressByLesson(lesson.code);
            const estimatedTotal = 150;
            const learnedCount = lessonProgress.filter(p => p.level > 0).length;
            const repeatCount = (this.db.countLessonRepeats ? await this.db.countLessonRepeats(lesson.code) : 0);
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
                repeats: repeatCount,
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
        const sm = new SyncManager(this.db);
        const hasTok = !!localStorage.getItem('auth_token');
        const serverInfo = await sm.me().catch(()=>null) || {};
        const email = serverInfo.email || await this.db.getProfile('account_email') || '';
        const nameLocal = serverInfo.name || await this.db.getUserName() || '';
        const badgeText = hasTok ? 'Üye Hesabı' : 'Misafir (Yerel)';

        const html = `
        <div class="modal-overlay" id="account-info-modal">
          <div class="modal-box">
            <div class="modal-header"><h2 class="modal-title">Profil</h2><button class="icon-btn" onclick="document.getElementById('account-info-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="profile-edit-container">
              <div class="modal-header-center">
                <div class="profile-avatar-large"><i class="fa-solid fa-user"></i></div>
                <h3 id="profile-email-display">${email || '-'}</h3>
                <span class="badge badge-member">${badgeText}</span>
              </div>
              <form id="form-profile-update" class="modern-form">
                <div class="form-group">
                  <label for="edit-name">Ad Soyad</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-id-card"></i>
                    <input type="text" id="edit-name" placeholder="Adınız" required>
                  </div>
                </div>
                <div class="form-group">
                  <label for="edit-email">E-posta (Değiştirmek için)</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-envelope"></i>
                    <input type="email" id="edit-email" placeholder="yeni@mail.com">
                  </div>
                </div>
                <div class="form-group">
                  <label for="edit-pass">Yeni Şifre (Opsiyonel)</label>
                  <div class="input-wrapper">
                    <i class="fa-solid fa-lock"></i>
                    <input type="password" id="edit-pass" placeholder="••••••">
                  </div>
                </div>
                <button type="submit" class="btn-primary-block" id="btn-save-profile">
                  <i class="fa-solid fa-floppy-disk"></i> Değişiklikleri Kaydet
                </button>
              </form>
              <div class="form-footer-note">
                <i class="fa-solid fa-circle-info"></i> Değişiklikler anında sunucu ile senkronize edilir.
              </div>
            </div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById('edit-name').value = nameLocal || '';
        const overlay = document.getElementById('account-info-modal');
        if (overlay) {
          const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
          document.addEventListener('keydown', escHandler);
          overlay.addEventListener('click', (e) => { if (e.target && e.target.id === 'account-info-modal') overlay.remove(); });
        }
        const form = document.getElementById('form-profile-update');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newName = (document.getElementById('edit-name').value||'').trim();
          const newEmail = (document.getElementById('edit-email').value||'').trim();
          const newPass = (document.getElementById('edit-pass').value||'');
          const res = await sm.updateCredentials(newEmail, newPass, newName);
          if (res && res.ok) {
            if (newName) await this.db.setUserName(newName);
            if (res.data && res.data.email) await this.db.setProfile('account_email', res.data.email);
            document.dispatchEvent(new CustomEvent('app:data-updated'));
            document.getElementById('account-info-modal').remove();
          } else {
            alert(res && res.code===409 ? 'Bu e‑posta kullanımda' : 'Güncelleme başarısız');
          }
        });
      }

    async openAccounts() {
        let list = (await this.db.getProfile('accounts')) || [];
        let items = Array.isArray(list) ? list : [];
        if ((!items || items.length===0) && !!localStorage.getItem('auth_token')) {
            const sm = new SyncManager(this.db);
            const info = await sm.me().catch(()=>null);
            if (info && info.email) {
                await this.db.setProfile('account_email', info.email);
                const am = new AuthManager(this.db);
                await am.saveCurrentAccount();
                list = (await this.db.getProfile('accounts')) || [];
                items = Array.isArray(list) ? list : [];
            }
        }
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
                                <button class=\"nav-btn\" data-tip=\"accounts.use\" onclick=\"window.useAccount('${acc.email}')\">Kullan</button>
                                <button class=\"nav-btn warning\" data-tip=\"accounts.remove\" onclick=\"window.removeAccount('${acc.email}')\">Kaldır</button>
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

    async openAdminAccounts() {
        const html = `
        <div class="modal-overlay" id="admin-accounts-modal">
            <div class="modal-box large">
                <div class="modal-header"><h2 class="modal-title">Hesap Temizleme (Admin)</h2><button class="icon-btn" onclick="document.getElementById('admin-accounts-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                <div class="form-group"><input type="password" id="admin-secret" class="form-select" placeholder="Admin Secret"></div>
                <div class="modal-actions" style="margin-top:8px;"><button class="nav-btn" onclick="window.loadAdminAccounts()">Listele</button></div>
                <div id="admin-accounts-list" style="max-height:60vh; overflow:auto; margin-top:8px;"></div>
                <div class="modal-actions" style="margin-top:8px; display:flex; gap:8px;">
                    <button class="nav-btn warning" onclick="window.bulkDeleteSelected()">Seçili Hesapları Sil</button>
                    <button class="nav-btn secondary" onclick="document.getElementById('admin-accounts-modal').remove()">Kapat</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.loadAdminAccounts = async () => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            const res = await fetch(`api/admin_accounts.php?action=list&secret=${encodeURIComponent(sec)}`).then(r=>r.json()).catch(()=>({ data:[] }));
            const list = Array.isArray(res.data) ? res.data : [];
            const rows = list.map(u => `<div class=\"lesson-card\" style=\"display:flex; align-items:center; justify-content:space-between;\"><div><div style=\"font-weight:600;\">${u.email}</div><small style=\"color:#64748b;\">Ad: ${u.name||'-'} • ID: ${u.id}</small></div><div style=\"display:flex; gap:8px;\"><input type=\"checkbox\" class=\"admin-del\" value=\"${u.email}\"><button class=\"nav-btn warning\" onclick=\"window.deleteOne('${u.email}')\">Sil</button></div></div>`).join('');
            const el = document.getElementById('admin-accounts-list');
            if (el) el.innerHTML = rows || '<div style="padding:12px; color:#64748b;">Kayıt yok</div>';
        };
        window.deleteOne = async (email) => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            await fetch('api/admin_accounts.php?action=delete', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: `secret=${encodeURIComponent(sec)}&email=${encodeURIComponent(email)}` });
            window.loadAdminAccounts();
        };
        window.bulkDeleteSelected = async () => {
            const sec = (document.getElementById('admin-secret')||{}).value || '';
            const els = Array.from(document.querySelectorAll('.admin-del'));
            const emails = els.filter(e=>e.checked).map(e=>e.value);
            await fetch(`api/admin_accounts.php?action=bulk_delete&secret=${encodeURIComponent(sec)}`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ emails }) });
            window.loadAdminAccounts();
        };
    }

    openSettings() {
        const existing = document.getElementById('settings-menu-overlay');
        if (existing) existing.remove();
        const html = `
            <div id="settings-menu-overlay" style="position:fixed; inset:0; background:transparent;">
                <div id="settings-menu" class="settings-panel" style="position:fixed; right:16px; top:60px; background:white; border:1px solid #e2e8f0; box-shadow:0 10px 25px rgba(0,0,0,0.08); border-radius:12px; min-width:320px; overflow:hidden;">
                    <div class="settings-profile-card" style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="profile-avatar" style="width:40px; height:40px; border-radius:999px; background:#eef2ff; display:flex; align-items:center; justify-content:center; color:#3730a3;"><i class="fa-solid fa-user-circle"></i></div>
                            <div class="profile-info">
                                <h3 id="menu-user-name" style="margin:0; font-size:1rem; color:#0f172a;">-</h3>
                                <span class="badge badge-member" id="menu-user-badge" style="font-size:0.75rem; color:#334155;">-</span>
                            </div>
                        </div>
                        <button class="btn-icon-logout" title="Çıkış Yap" onclick="window.logoutNow()" style="border:none; background:transparent; color:#ef4444; font-size:1rem;"><i class="fa-solid fa-right-from-bracket"></i></button>
                    </div>

                    <div class="settings-group" style="padding:8px 0;">
                        <h4 class="group-title" style="margin:8px 12px; font-size:0.9rem; color:#334155;">Uygulama & Veri</h4>
                        <button class="menu-item" id="btn-sync-now" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box blue" style="width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-rotate"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Senkronize Et</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Verileri sunucuyla eşitle</span>
                            </div>
                        </button>

                        <button class="menu-item" id="btn-check-update" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box green" style="width:32px; height:32px; border-radius:8px; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-cloud-arrow-down"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Güncelleme Kontrol</span>
                                <span class="menu-sub" id="version-text" style="font-size:0.8rem; color:#64748b;">-</span>
                            </div>
                        </button>
                    </div>

                    <div class="settings-group" style="padding:8px 0; border-top:1px solid #f1f5f9;">
                        <h4 class="group-title" style="margin:8px 12px; font-size:0.9rem; color:#334155;">Hesap İşlemleri</h4>
                        <button class="menu-item" id="btn-update-cred" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box" style="width:32px; height:32px; border-radius:8px; background:#eef2ff; color:#3730a3; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user-pen"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Bilgileri Güncelle</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Ad / E‑posta / Şifre</span>
                            </div>
                        </button>
                        <button class="menu-item" id="btn-reset-data" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box orange" style="width:32px; height:32px; border-radius:8px; background:#ffedd5; color:#f97316; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-eraser"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">İlerlemeyi Sıfırla</span>
                            </div>
                        </button>
                        <button class="menu-item admin-only" id="btn-admin-panel" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box purple" style="width:32px; height:32px; border-radius:8px; background:#ede9fe; color:#7c3aed; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-user-shield"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Yönetici Paneli</span>
                            </div>
                        </button>
                        <button class="menu-item" id="btn-logout" style="width:100%; display:none; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box" style="width:32px; height:32px; border-radius:8px; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-right-from-bracket"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Çıkış Yap</span>
                            </div>
                        </button>
                    </div>

                    <div class="settings-danger-zone" style="padding:12px; border-top:1px solid #f1f5f9;">
                        <button class="btn-text-danger" id="btn-delete-account" style="border:none; background:transparent; color:#ef4444; font-weight:600;"><i class="fa-solid fa-trash"></i> Hesabımı Kalıcı Olarak Sil</button>
                        <div class="app-footer-info" style="margin-top:10px; color:#64748b; font-size:0.8rem;">
                            <span id="footer-version">AÖF Asistanı</span><br>
                            <a href="#" id="btn-changelog">Sürüm Notları</a>
                        </div>
                        <div style="display:flex; justify-content:flex-end; margin-top:8px;"><button class="nav-btn secondary" onclick="document.getElementById('settings-menu-overlay').remove()">Kapat</button></div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        const overlay = document.getElementById('settings-menu-overlay');
        overlay.addEventListener('click', (e) => { if (e.target.id === 'settings-menu-overlay') overlay.remove(); });
        const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
        document.addEventListener('keydown', escHandler);

        // Etkileşimler
        (async () => {
            await this.ensureActiveAccountToken();
            const hasToken = !!localStorage.getItem('auth_token');
            const nameLocal = await this.db.getUserName();
            const badgeEl = document.getElementById('menu-user-badge');
            const nameEl = document.getElementById('menu-user-name');
            const verEl = document.getElementById('version-text');
            const footVer = document.getElementById('footer-version');
            const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));
            if (verEl) verEl.textContent = `v${versionInfo.version}`;
            if (footVer) footVer.textContent = `AÖF Asistanı v${versionInfo.version}`;
            if (nameEl) nameEl.textContent = nameLocal || '-';
            if (badgeEl) { badgeEl.textContent = hasToken ? 'Üye' : 'Misafir'; badgeEl.style.color = hasToken ? '#166534' : '#334155'; }
        })();
        (async () => {
            await this.ensureActiveAccountToken();
            const hasToken = !!localStorage.getItem('auth_token');
            const btnUpd = document.getElementById('btn-update-cred'); if (btnUpd) btnUpd.style.display = hasToken ? 'flex' : 'none';
            const btnLogout = document.getElementById('btn-logout'); if (btnLogout) btnLogout.style.display = hasToken ? 'flex' : 'none';
        })();

        document.getElementById('btn-sync-now').onclick = async () => { const sm = new SyncManager(this.db); await sm.autoSync(); document.getElementById('settings-menu-overlay').remove(); };
        document.getElementById('btn-check-update').onclick = () => { window.checkUpdatesNow(); };
        const updBtn = document.getElementById('btn-update-cred'); if (updBtn) updBtn.onclick = async () => { window.openAccountInfo(); setTimeout(() => { const el = document.getElementById('acc-new-name'); if (el) el.focus(); }, 300); };
        document.getElementById('btn-reset-data').onclick = () => { window.confirmReset(); };
        const adminBtn = document.getElementById('btn-admin-panel'); if (adminBtn) adminBtn.onclick = () => { window.openAdminAccounts(); };
        const delBtn = document.getElementById('btn-delete-account'); if (delBtn) delBtn.onclick = () => { window.confirmDeleteAccount(); };
        const clBtn = document.getElementById('btn-changelog'); if (clBtn) clBtn.onclick = () => { window.openChangelog(); };
        const logoutBtn = document.getElementById('btn-logout'); if (logoutBtn) logoutBtn.onclick = () => { window.confirmLogout(); };

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

        window.confirmLogout = () => {
            const html = `
            <div class="modal-overlay" id="confirm-logout-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Çıkış Yap</h2><button class="icon-btn" onclick="document.getElementById('confirm-logout-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Çıkış yapmak istiyor musun? İlerlemelerin kaydedilecektir.</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-logout-modal').remove()">İptal</button>
                        <button class="primary-btn" onclick="window.doLogoutConfirmed()">Evet, Çıkış Yap</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.doLogoutConfirmed = async () => {
            const sm = new SyncManager(this.db);
            try { await sm.autoSync(); } catch {}
            await (async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.refreshAccountStatus(); })();
            const settings = document.getElementById('settings-menu-overlay'); if (settings) settings.remove();
            const cm = document.getElementById('confirm-logout-modal'); if (cm) cm.remove();
            const html = `
            <div class="modal-overlay" id="farewell-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Güle Güle 👋</h2><button class="icon-btn" onclick="document.getElementById('farewell-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">İlerlemeleriniz kaydedildi. Uygulamayı kullandığınız için teşekkür ederiz. Tekrar bekleriz!</p>
                    <div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('farewell-modal').remove()">Kapat</button></div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            this.render();
        };

        window.resetApp = async () => {
            const auth = new AuthManager(this.db);
            if (auth.hasToken()) { await auth.wipeRemote().catch(()=>{}); }
            if (this.db.resetProgressOnly) { await this.db.resetProgressOnly(); } else { await this.db.resetAllData(); }
            await this.refreshAccountStatus();
            document.dispatchEvent(new CustomEvent('app:data-updated'));
            const overlay = document.getElementById('settings-menu-overlay'); if (overlay) overlay.remove();
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

        window.forceSyncNow = async () => { const sm = new SyncManager(this.db); await sm.autoSync(); const pill = document.querySelector('.account-pill'); if (pill) { const lastSync = await this.db.getProfile('last_sync'); pill.textContent = await this.getAccountStatusText(); } document.getElementById('settings-menu-overlay').remove(); };

        window.openAccountInfo = () => this.openAccountInfo();
        window.openAccounts = () => this.openAccounts();
        window.openAdminAccounts = () => this.openAdminAccounts();

        window.openAuthSync = async () => {
            const hasTokenNow = !!localStorage.getItem('auth_token');
            const accEmailNow = await this.db.getProfile('account_email');
            const lastSyncNow = await this.db.getProfile('last_sync');
            const statusNow = hasTokenNow ? `Üye${accEmailNow?` • ${accEmailNow}`:''}${lastSyncNow?` • Son Senkron: ${new Date(lastSyncNow).toLocaleString()}`:''}` : 'Misafir';
            const formHtml = hasTokenNow ? `<div style="padding:8px 12px; color:#334155; font-size:0.9rem;">Giriş yapmışsınız. Aşağıdan yedekleme işlemlerini kullanabilirsiniz.</div>` : `
                        <div class="form-group">
                        <input type="email" id="auth-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none">
                        <input type="password" id="auth-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
                            <div class="modal-actions" style="margin-top:10px; display:flex; gap:8px;">
                                <button class="nav-btn" data-tip="register.push" onclick="window.doRegister()">Kayıt Ol</button>
                                <button class="primary-btn" data-tip="login.push" onclick="window.doLogin()">Giriş Yap</button>
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
                        <input type="email" id="welcome-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none">
                        <input type="password" id="welcome-pass" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
                        <input type="text" id="welcome-name-login" class="form-select" placeholder="Ad (Cihaz)" style="margin-top:8px;" autocomplete="off">
                        <div class="modal-actions" style="margin-top:10px;">
                            <button class="primary-btn" onclick="window.handleLogin()">Giriş Yap</button>
                        </div>
                    </div>
                    <div id="form-register" style="display:none;">
                        <input type="text" id="welcome-name" class="form-select" placeholder="Ad Soyad" autocomplete="off">
                        <input type="email" id="welcome-email-r" class="form-select" placeholder="E-posta" style="margin-top:8px;" autocomplete="off" autocapitalize="none">
                        <input type="password" id="welcome-pass-r" class="form-select" placeholder="Şifre" style="margin-top:8px;" autocomplete="new-password">
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
        (async () => { const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const has = (Array.isArray(p)&&p.length>0)||(Array.isArray(h)&&h.length>0)||((s.xp||0)>0||(s.streak||0)>0||(s.totalQuestions||0)>0); const banner = document.getElementById('local-data-banner'); if (banner && has) banner.style.display='block'; document.getElementById('welcome-email').value=''; document.getElementById('welcome-pass').value=''; document.getElementById('welcome-name-login').value=''; document.getElementById('welcome-email-r').value=''; document.getElementById('welcome-pass-r').value=''; document.getElementById('welcome-name').value=''; })();
        window.switchAuthTab = (tab) => {
            document.getElementById('form-login').style.display = (tab==='login') ? 'block':'none';
            document.getElementById('form-register').style.display = (tab==='register') ? 'block':'none';
            document.getElementById('tab-login').classList.toggle('primary', tab==='login');
            document.getElementById('tab-register').classList.toggle('primary', tab==='register');
        };
        window.handleLogin = async () => {
            const e = document.getElementById('welcome-email').value;
            const p = document.getElementById('welcome-pass').value;
            const nm = document.getElementById('welcome-name-login').value || '';
            const ok = await auth.login(e,p);
            if (ok) {
                if (nm && nm.trim().length>0) { await this.db.setUserName(nm.trim()); const sm = new SyncManager(this.db); await sm.updateProfileName(nm.trim()); }
                { const sm = new SyncManager(this.db); await sm.autoSync(); }
                document.getElementById('welcome-overlay').remove(); this.render();
            } else { alert('Giriş başarısız'); }
        };
        window.handleRegister = async () => {
            const n = document.getElementById('welcome-name').value;
            const e = document.getElementById('welcome-email-r').value;
            const p = document.getElementById('welcome-pass-r').value;
            const res = await auth.register(e,p,n);
            if (res && res.exists) { alert('Bu e-posta ile kayıt zaten mevcut. Lütfen giriş yapın.'); return; }
            if (res && res.ok) { const sm = new SyncManager(this.db); await sm.autoSync(); document.getElementById('welcome-overlay').remove(); this.render(); }
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
        await this.ensureActiveAccountToken();
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
