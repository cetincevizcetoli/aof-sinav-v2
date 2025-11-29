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

    escapeHTML(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }

    async getAccountStatusText(){
        const hasToken = !!localStorage.getItem('auth_token');
        const accEmail = await this.db.getProfile('account_email');
        return hasToken ? `Bulut: Aktif${accEmail?` (${accEmail})`:''}` : 'Bulut: Bağlı Değil';
    }

    async ensureActiveAccountToken(){ return; }

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

        const done = await this.db.getProfile('onboarding_done');
        const userName = await this.db.getUserName();
        if (!done && (!userName || String(userName).trim().length === 0)) { this.showWelcomeOverlay(); return; }

        const lessons = await this.loader.getLessonList();
        
        const game = new Gamification(this.db);
        const stats = await this.db.getUserStats();
        const rank = game.getRank(stats.xp);

        const history = await this.db.getHistory();
        const activityStats = await this.calculateActivityStats(history);
        const lessonStats = await this.calculateLessonStats(lessons);

        const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));

        const statusText = await this.getAccountStatusText();
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
            const tips = await fetch('data/tooltips.json?t=' + Date.now()).then(r => r.json()).catch(() => ({}));
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
            // Tamamlama bazlı tekrar sayısı hesapla
            const allHistory = await this.db.getHistory();
            const unitHistory = (allHistory||[]).filter(h => String(h.lesson||'')===String(code) && parseInt(h.unit||0)===parseInt(i||0)).sort((a,b)=> (a.date||0)-(b.date||0));
            let completedCount = 0; let lastEnd = 0; { const learnedSet = new Set(); const totalQs = u.total; for (const h of unitHistory){ const qid = h.qid||''; if (h.isCorrect && qid) learnedSet.add(qid); if (totalQs>0 && learnedSet.size>=totalQs){ completedCount++; learnedSet.clear(); lastEnd = h.date||Date.now(); } } }
            const hasAfter = unitHistory.some(h => (h.date||0) > (lastEnd||0));
            let repLabel = hasAfter && completedCount>0 ? `${completedCount}. tekrar` : '';
            
            let statusBadge = '';
            let statusClass = '';
            
            if (repLabel) {
                statusBadge = `<i class="fa-solid fa-rotate"></i> ${repLabel}`;
                statusClass = 'status-blue';
            } else if (percent === 0) {
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
            // Tamamlama bazlı + tamamlama sonrası yeni oturum başladığında yeni grup
            const allHistory2 = await this.db.getHistory();
            const unitHistory2 = (allHistory2||[]).filter(h => String(h.lesson||'')===String(lessonCode) && parseInt(h.unit||0)===parseInt(unitNo||0)).sort((a,b)=> (a.date||0)-(b.date||0));
            const fileName2 = this.currentLessonFile;
            const data2 = (this.loader && this.loader.loadLessonData) ? await this.loader.loadLessonData(lessonCode, fileName2) : [];
            const unitCards2 = data2.filter(c => parseInt(c.unit||0)===parseInt(unitNo||0));
            const totalQs2 = unitCards2.length;
            const groups=[]; {
                // Basit: her tamamlama eşiğinde grubu kapat; sonraki kayıtlar yeni gruba eklenir
                const learned = new Set(); let cur=[]; let start=0; let end=0;
                for (const h of unitHistory2){
                    if (cur.length===0) start = h.date || Date.now();
                    cur.push(h); end = h.date || start;
                    if (h.isCorrect && h.qid) learned.add(h.qid);
                    if (totalQs2>0 && learned.size>=totalQs2){
                        const c = cur.filter(x=>x.isCorrect).length; const w = cur.length - c;
                        groups.push({ started_at: start, ended_at: end, correct: c, wrong: w });
                        cur = []; start = 0; end = 0; learned.clear();
                    }
                }
                if (cur.length>0){ const c = cur.filter(x=>x.isCorrect).length; const w = cur.length - c; groups.push({ started_at: start, ended_at: end, correct: c, wrong: w }); }
            }
            const id = 'unit-history-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box large">
                    <div class="modal-header"><h2 class="modal-title">Ünite ${unitNo} Geçmişi</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:60vh; overflow:auto;">
                        ${groups.length===0 ? '<div style="color:#64748b; padding:12px;">Kayıt yok</div>' : groups.map((g,idx)=>`
                            <div class="lesson-card" style="display:flex; align-items:center; justify-content:space-between;">
                                <div>
                                    <div style="font-weight:600; color:#334155;">${idx+1}. ${new Date(g.started_at||Date.now()).toLocaleString()}${g.ended_at?` - ${new Date(g.ended_at).toLocaleString()}`:''} • ${idx===0?'İlk bitiriş':`${idx}. tekrar`}</div>
                                    <small style="color:#64748b;">Doğru: ${g.correct} • Yanlış: ${g.wrong}</small>
                                </div>
                                <button class="sm-btn" onclick="window.viewGroupMistakes('${lessonCode}', ${unitNo}, ${idx})">Yanlışları Gör</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };
        window.viewGroupMistakes = async (lessonCode, unitNo, groupIndex) => {
            const allHistory = await this.db.getHistory();
            const unitHistory = (allHistory||[]).filter(h => String(h.lesson||'')===String(lessonCode) && parseInt(h.unit||0)===parseInt(unitNo||0)).sort((a,b)=> (a.date||0)-(b.date||0));
            const fileName = this.currentLessonFile;
            const data = (this.loader && this.loader.loadLessonData) ? await this.loader.loadLessonData(lessonCode, fileName) : [];
            const cards = data.filter(c => parseInt(c.unit||0) === parseInt(unitNo||0));
            const map = new Map(cards.map(c => [c.id, c]));
            const totalQs = cards.length; const learnedSet=new Set(); const lastResult=new Map(); const groups=[]; let cur=[]; let start=0; let end=0;
            for (const h of unitHistory){ if (cur.length===0) start=h.date||Date.now(); cur.push(h); end=h.date||start; const qid=h.qid||''; if (qid){ lastResult.set(qid, !!h.isCorrect); if (h.isCorrect) learnedSet.add(qid); } if (totalQs>0 && learnedSet.size>=totalQs){ groups.push({ items:cur.slice(), start,end,lastResult:new Map(lastResult) }); cur=[]; start=0; end=0; learnedSet.clear(); lastResult.clear(); } }
            if (cur.length>0) groups.push({ items:cur.slice(), start,end,lastResult:new Map(lastResult) });
            const g = groups[groupIndex] || { items:[], lastResult:new Map() };
            const wrongQIDs = Array.from(g.lastResult.entries()).filter(([qid,res]) => res!==true).map(([qid])=>qid);
            const wrongs = g.items.filter(x=> wrongQIDs.includes(x.qid||''));
            const id = 'session-mistakes-modal';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Yanlışlar</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div style="max-height:50vh; overflow:auto;">
                        ${wrongs.length===0?'<div style="color:#64748b; padding:12px;">Yanlış yok</div>':wrongs.map((w,idx)=>{
                            const q = w.card;
                            const expl = q && q.code_example ? `<div style=\"margin-top:6px; font-size:0.85rem; background:#f1f5f9; padding:6px; border-radius:4px; color:#475569;\"><strong>📝 Açıklama:</strong> ${this.escapeHTML(q.code_example)}</div>` : '';
                            const opts = Array.isArray(q && q.options) ? q.options.map(o => {
                                const isGiven = w.given && String(w.given) === String(o);
                                const isCorrect = q && String(q.correct_option) === String(o);
                                const color = isCorrect ? '#10b981' : (isGiven ? '#ef4444' : '#334155');
                                const icon = isCorrect ? 'fa-check' : (isGiven ? 'fa-xmark' : 'fa-circle');
                                return `<div style=\"font-size:0.9rem; color:${color}; display:flex; align-items:center; gap:6px;\"><i class=\"fa-solid ${icon}\"></i> ${this.escapeHTML(o)}</div>`;
                            }).join('') : '';
                            return `<div class=\"lesson-card\" style=\"padding:12px; border-left:4px solid #ef4444;\">
                                <div style=\"font-weight:600; color:#334155; margin-bottom:6px;\">${idx+1}. ${q ? this.escapeHTML(q.question) : 'Soru bulunamadı'}</div>
                                <div style=\"display:flex; flex-direction:column; gap:4px;\">${opts}</div>
                                <div style=\"font-size:0.9rem; color:#ef4444;\"><strong>Senin Cevabın:</strong> ${w.given ? this.escapeHTML(w.given) : '-'}</div>
                                <div style=\"font-size:0.9rem; color:#10b981;\"><strong>Doğru Cevap:</strong> ${q ? this.escapeHTML(q.correct_option) : '-'}</div>
                                ${expl}
                                <small style=\"color:#64748b;\">Tarih: ${new Date(w.date).toLocaleString()}</small>
                            </div>`;
                        }).join('')}
                        <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                            <button class="nav-btn secondary" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-chevron-up"></i> Kapat</button>
                            <button class="primary-btn" onclick="(function(){ document.getElementById('${id}').remove(); if(window.dashboard&&window.dashboard.render) window.dashboard.render(); })()"><i class="fa-solid fa-house"></i> Ana Ekran</button>
                        </div>
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
            const activeEmail2 = await this.db.getProfile('account_email');
            if (activeEmail2 && activeEmail2 === email) {
                localStorage.removeItem('auth_token');
                await this.db.setProfile('account_email','');
                await this.db.setProfile('server_reset_at', 0);
                await this.db.setProfile('last_reset_ack', 0);
                await this.db.setProfile('last_sync', 0);
                const mini=document.getElementById('account-mini'); if (mini) mini.textContent='Misafir';
                await this.refreshAccountStatus();
            }
            const m = document.getElementById('accounts-modal'); if (m) m.remove();
            this.render();
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
                            <div class="icon-box blue" style="width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Sunucuya Yedekle</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Verileri buluta yedekle</span>
                            </div>
                        </button>

                        <button class="menu-item" id="btn-pull-now" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box green" style="width:32px; height:32px; border-radius:8px; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-cloud-arrow-down"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Sunucudan Geri Yükle</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Buluttaki yedeği bu cihaza al</span>
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
                        <h4 class="group-title" style="margin:8px 12px; font-size:0.9rem; color:#334155;">Profil ve Uygulama</h4>
                        <button class="menu-item" id="btn-reset-data" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box orange" style="width:32px; height:32px; border-radius:8px; background:#ffedd5; color:#f97316; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-eraser"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">İlerlemeyi Sıfırla</span>
                            </div>
                        </button>
                        <button class="menu-item" id="btn-uninstall" style="width:100%; display:flex; align-items:center; gap:10px; padding:10px 12px; border:none; background:transparent;">
                            <div class="icon-box" style="width:32px; height:32px; border-radius:8px; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-trash-can"></i></div>
                            <div class="text-box" style="display:flex; flex-direction:column; align-items:flex-start;">
                                <span class="menu-label" style="font-weight:600; color:#0f172a;">Uygulamayı Kaldır</span>
                                <span class="menu-sub" style="font-size:0.8rem; color:#64748b;">Tüm yerel veriler ve önbellek silinir</span>
                            </div>
                        </button>
                    </div>

                    <div class="settings-danger-zone" style="padding:12px; border-top:1px solid #f1f5f9;">
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
            const nameLocal = await this.db.getUserName();
            const badgeEl = document.getElementById('menu-user-badge');
            const nameEl = document.getElementById('menu-user-name');
            const verEl = document.getElementById('version-text');
            const versionInfo = await fetch('version.json?t=' + Date.now()).then(r => r.json()).catch(() => ({ version: 'unknown' }));
            if (verEl) verEl.textContent = `v${versionInfo.version}`;
            if (nameEl) nameEl.textContent = nameLocal || '-';
            if (badgeEl) { badgeEl.textContent = `Profil`; badgeEl.style.color = '#334155'; }
        })();
        (async () => {})();

        document.getElementById('btn-sync-now').onclick = async () => {
            const sm = new SyncManager(this.db);
            const t = sm.getToken();
            if (!t) {
                const id = 'cloud-login-modal';
                const pendingEmail = await this.db.getProfile('account_email_pending')||'';
                const pendingPass = await this.db.getProfile('account_pass_pending')||'';
                const html = `
                <div class="modal-overlay" id="${id}">
                  <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Bulut Yedekleme</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="form-group"><input type="email" id="cloud-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none" value="${pendingEmail}"></div>
                    <div class="form-group"><input type="password" id="cloud-pass" class="form-select" placeholder="Şifre" autocomplete="new-password" value="${pendingPass}"></div>
                    <div class="modal-actions" style="display:flex; gap:8px;">
                      <button class="nav-btn secondary" onclick="document.getElementById('${id}').remove()">İptal</button>
                      <button class="primary-btn" onclick="window.cloudLoginDo()">Giriş Yap ve Yedekle</button>
                    </div>
                  </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html);
                window.cloudLoginDo = async () => {
                    const e = (document.getElementById('cloud-email')||{}).value||'';
                    const p = (document.getElementById('cloud-pass')||{}).value||'';
                    let res={ ok:false, code:0 }; try { res = await sm.login(e,p); } catch{}
                    if (!res.ok) { try { alert(res.code===404 ? 'Bu e‑posta ile kayıt bulunamadı' : (res.code===401 ? 'Şifre hatalı' : 'Giriş başarısız')); } catch{} return; }
                    await this.db.setProfile('account_email', e);
                    const token = localStorage.getItem('auth_token')||'';
                    if (token) { await this.db.setProfile('account_token', token); }
                    const info = await sm.me().catch(()=>null); if (info && info.name) { await this.db.setUserName(info.name); }
                    let pushed=false; try { pushed = await sm.pushAll(); } catch{}
                    const m = document.getElementById(id); if (m) m.remove();
                    const ov = document.getElementById('settings-menu-overlay'); if (ov) ov.remove();
                    this.render();
                    try { alert(pushed ? 'Yedekleme tamam' : 'Yedekleme başarısız'); } catch{}
                };
                return;
            }
            let okPush = false;
            try { okPush = await sm.pushAll(); } catch {}
            try { document.dispatchEvent(new CustomEvent('app:data-updated')); } catch {}
            const ov = document.getElementById('settings-menu-overlay'); if (ov) ov.remove();
            this.render();
            try { alert(okPush ? 'Yedekleme tamam' : 'Yedekleme başarısız'); } catch{}
        };
        document.getElementById('btn-check-update').onclick = () => { window.checkUpdatesNow(); };
        document.getElementById('btn-pull-now').onclick = async () => {
            const sm = new SyncManager(this.db);
            const t = sm.getToken();
            if (!t) {
                const id = 'cloud-login-modal';
                const pendingEmail = await this.db.getProfile('account_email_pending')||'';
                const pendingPass = await this.db.getProfile('account_pass_pending')||'';
                const html = `
                <div class="modal-overlay" id="${id}">
                  <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Buluttan Geri Yükle</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <div class="form-group"><input type="email" id="cloud-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none" value="${pendingEmail}"></div>
                    <div class="form-group"><input type="password" id="cloud-pass" class="form-select" placeholder="Şifre" autocomplete="new-password" value="${pendingPass}"></div>
                    <div class="modal-actions" style="display:flex; gap:8px;">
                      <button class="nav-btn secondary" onclick="document.getElementById('${id}').remove()">İptal</button>
                      <button class="primary-btn" onclick="window.cloudLoginPull()">Giriş Yap ve Yükle</button>
                    </div>
                  </div>
                </div>`;
                document.body.insertAdjacentHTML('beforeend', html);
                window.cloudLoginPull = async () => {
                    const e = (document.getElementById('cloud-email')||{}).value||'';
                    const p = (document.getElementById('cloud-pass')||{}).value||'';
                    let res={ ok:false, code:0 }; try { res = await sm.login(e,p); } catch{}
                    if (!res.ok) { try { alert(res.code===404 ? 'Bu e‑posta ile kayıt bulunamadı' : (res.code===401 ? 'Şifre hatalı' : 'Giriş başarısız')); } catch{} return; }
                    await this.db.setProfile('account_email', e);
                    const token = localStorage.getItem('auth_token')||'';
                    if (token) { await this.db.setProfile('account_token', token); }
                    const info = await sm.me().catch(()=>null); if (info && info.name) { await this.db.setUserName(info.name); }
                    let pulled=false; try { pulled = await sm.pullAll(true); } catch{}
                    const m = document.getElementById(id); if (m) m.remove();
                    const ov = document.getElementById('settings-menu-overlay'); if (ov) ov.remove();
                    this.render();
                    try { alert(pulled ? 'Geri yükleme tamam' : 'Geri yükleme başarısız'); } catch{}
                };
                return;
            }
            const info = await sm.me().catch(()=>null); if (info && info.name) { await this.db.setUserName(info.name); }
            let okPull=false; try { okPull = await sm.pullAll(true); } catch{}
            const ov = document.getElementById('settings-menu-overlay'); if (ov) ov.remove();
            this.render();
            try { alert(okPull ? 'Geri yükleme tamam' : 'Geri yükleme başarısız'); } catch{}
        };
        
        document.getElementById('btn-reset-data').onclick = () => { window.confirmReset(); };
        const uninstallBtn = document.getElementById('btn-uninstall'); if (uninstallBtn) uninstallBtn.onclick = () => { window.confirmUninstall(); };

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

        

        window.confirmUninstall = () => {
            const html = `
            <div class="modal-overlay" id="confirm-uninstall-modal">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Uygulamayı Kaldır</h2><button class="icon-btn" onclick="document.getElementById('confirm-uninstall-modal').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Uygulamaya ait tüm yerel veriler ve önbellek silinecek. Emin misin?</p>
                    <div class="modal-actions">
                        <button class="nav-btn secondary" onclick="document.getElementById('confirm-uninstall-modal').remove()">İptal</button>
                        <button class="primary-btn" style="background-color:#ef4444;" onclick="window.uninstallApp()">Evet, Kaldır</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        window.uninstallApp = async () => {
            try { if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) { await r.unregister(); } } } catch{}
            try { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); } } catch{}
            try { await this.db.wipeDevice(); } catch{}
            try { localStorage.clear(); } catch{}
            window.location.reload();
        };

        window.resetApp = async () => {
            const auth = new AuthManager(this.db);
            if (auth.hasToken()) { await auth.wipeRemote().catch(()=>{}); }
            if (this.db.resetProgressOnly) { await this.db.resetProgressOnly(); } else { await this.db.resetAllData(); }
            await this.refreshAccountStatus();
            document.dispatchEvent(new CustomEvent('app:data-updated'));
            const cm = document.getElementById('confirm-reset-modal'); if (cm) cm.remove();
            const overlay = document.getElementById('settings-menu-overlay'); if (overlay) overlay.remove();
            try { alert('İlerleme sıfırlandı'); } catch{}
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

        window.logoutNow = async () => { localStorage.removeItem('auth_token'); await this.db.setProfile('account_email',''); await this.db.setProfile('account_token',''); await this.db.setProfile('server_reset_at', 0); await this.db.setProfile('last_reset_ack', 0); await this.db.setProfile('last_sync', 0); await this.refreshAccountStatus(); const s=document.getElementById('settings-menu-overlay'); if (s) s.remove(); this.render(); };
    }

    showWelcomeOverlay(){
        const existing = document.getElementById('welcome-overlay');
        if (existing) return;
        const pendingEmail = '';
        const pendingPass = '';
        const html = `
        <div id="welcome-overlay" style="position:fixed; inset:0; background:rgba(17,24,39,0.6); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:9999;">
            <div class="modal-box" style="max-width:560px; width:90%;">
                <div class="modal-header" style="border:none;">
                    <h2 class="modal-title" style="display:flex; align-items:center; gap:10px;">
                        <img src="assets/logo.png" alt="logo" style="width:32px; height:32px;"> Sınav Asistanı
                    </h2>
                </div>
                <div style="display:flex; gap:8px; padding:6px 0;">
                    <button class="nav-btn primary" id="tab-local" onclick="window.switchOnboarding('local')">Yerel Başla</button>
                    <button class="nav-btn" id="tab-cloud" onclick="window.switchOnboarding('cloud')">Bulut Giriş</button>
                </div>
                <div id="onb-local" style="margin-top:8px; display:block;">
                    <p style="color:#64748b; margin-top:-2px;">Yerel modda çalışır. Lütfen adınızı girin.</p>
                    <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
                        <input type="text" id="welcome-name" class="form-select" placeholder="Adınız" autocomplete="off">
                        <div style="background:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:10px;">
                            <div style="font-size:0.9rem; color:#334155; font-weight:600; margin-bottom:6px;">Opsiyonel: Bulut Yedekleme</div>
                            <div style="font-size:0.85rem; color:#64748b; margin-bottom:8px;">Bu bilgileri doldurursanız verileriniz buluta yedeklenir ve başka cihazdan erişebilirsiniz. Doldurmazsanız verileriniz bu cihazda güvenle saklanır.</div>
                            <input type="email" id="welcome-cloud-email" class="form-select" placeholder="E-posta (opsiyonel)" autocomplete="off" autocapitalize="none" value="${pendingEmail}">
                            <input type="password" id="welcome-cloud-pass" class="form-select" placeholder="Şifre (opsiyonel)" style="margin-top:8px;" autocomplete="new-password" value="${pendingPass}">
                        </div>
                        <div class="modal-actions" style="margin-top:6px;">
                            <button class="primary-btn" onclick="window.handleSetName()">Başla</button>
                        </div>
                    </div>
                </div>
                <div id="onb-cloud" style="margin-top:8px; display:none;">
                    <p style="color:#64748b; margin-top:-2px;">Mevcut bulut hesabınızla giriş yapın.</p>
                    <div style="margin-top:8px; display:flex; flex-direction:column; gap:8px;">
                        <input type="email" id="onb-email" class="form-select" placeholder="E-posta" autocomplete="off" autocapitalize="none" value="${pendingEmail}">
                        <input type="password" id="onb-pass" class="form-select" placeholder="Şifre" autocomplete="new-password" value="${pendingPass}">
                        <div class="modal-actions" style="margin-top:6px; display:flex; gap:8px;">
                            <button class="nav-btn" onclick="window.handleCloudLogin()">Giriş Yap</button>
                            <button class="primary-btn" onclick="window.handleCloudLoginRestore()">Giriş Yap ve Geri Yükle</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        (async () => {
            const pe = await this.db.getProfile('account_email_pending')||'';
            const pp = await this.db.getProfile('account_pass_pending')||'';
            const em = document.getElementById('welcome-cloud-email'); if (em) em.value = pe||'';
            const pw = document.getElementById('welcome-cloud-pass'); if (pw) pw.value = pp||'';
            const em2 = document.getElementById('onb-email'); if (em2) em2.value = pe||'';
            const pw2 = document.getElementById('onb-pass'); if (pw2) pw2.value = pp||'';
        })();
        window.switchOnboarding = (tab) => { const l = document.getElementById('onb-local'); const c = document.getElementById('onb-cloud'); const tl = document.getElementById('tab-local'); const tc = document.getElementById('tab-cloud'); if (tab==='cloud'){ l.style.display='none'; c.style.display='block'; tl.classList.remove('primary'); tc.classList.add('primary'); } else { l.style.display='block'; c.style.display='none'; tl.classList.add('primary'); tc.classList.remove('primary'); } };
        window.handleSetName = async () => {
            const n = (document.getElementById('welcome-name').value||'').trim();
            if (n.length>0) { await this.db.setUserName(n); }
            const e = (document.getElementById('welcome-cloud-email')||{}).value||'';
            const p = (document.getElementById('welcome-cloud-pass')||{}).value||'';
            if (e) { await this.db.setProfile('account_email_pending', e); }
            if (p) { await this.db.setProfile('account_pass_pending', p); }
            await this.db.setProfile('onboarding_done', 1);
            const ov = document.getElementById('welcome-overlay'); if (ov) ov.remove();
            try { document.dispatchEvent(new CustomEvent('app:data-updated')); } catch{}
            this.render();
        };
        window.handleCloudLogin = async () => { const e = (document.getElementById('onb-email')||{}).value||''; const p = (document.getElementById('onb-pass')||{}).value||''; const sm = new SyncManager(this.db); let res={ ok:false, code:0 }; try { res = await sm.login(e,p); } catch{} if (!res.ok) { try { alert(res.code===404 ? 'Bu e‑posta ile kayıt bulunamadı' : (res.code===401 ? 'Şifre hatalı' : 'Giriş başarısız')); } catch{} return; } await this.db.setProfile('account_email', e); const token = localStorage.getItem('auth_token')||''; if (token) { await this.db.setProfile('account_token', token); } const info = await sm.me().catch(()=>null); if (info && info.name) { await this.db.setUserName(info.name); } await this.db.setProfile('onboarding_done', 1); const ov = document.getElementById('welcome-overlay'); if (ov) ov.remove(); this.render(); };
        window.handleCloudLoginRestore = async () => { const e = (document.getElementById('onb-email')||{}).value||''; const p = (document.getElementById('onb-pass')||{}).value||''; const sm = new SyncManager(this.db); let res={ ok:false, code:0 }; try { res = await sm.login(e,p); } catch{} if (!res.ok) { try { alert(res.code===404 ? 'Bu e‑posta ile kayıt bulunamadı' : (res.code===401 ? 'Şifre hatalı' : 'Giriş başarısız')); } catch{} return; } await this.db.setProfile('account_email', e); const token = localStorage.getItem('auth_token')||''; if (token) { await this.db.setProfile('account_token', token); } const info = await sm.me().catch(()=>null); if (info && info.name) { await this.db.setUserName(info.name); } let pulled=false; try { pulled = await sm.pullAll(true); } catch{} await this.db.setProfile('onboarding_done', 1); const ov = document.getElementById('welcome-overlay'); if (ov) ov.remove(); this.render(); try { alert(pulled ? 'Geri yükleme tamam' : 'Geri yükleme başarısız'); } catch{} };
    }
    
    async getAccountStatusText(){ const name = await this.db.getUserName(); return `Profil: ${name||'-'}`; }

    async refreshAccountStatus(){ const txt = await this.getAccountStatusText(); const pill = document.querySelector('.account-pill'); if (pill) { pill.textContent = txt; } }
}
