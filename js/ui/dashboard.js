import { Gamification } from '../core/gamification.js';
import { ExamManager } from '../core/examManager.js';

export class Dashboard {
    constructor(dataLoader, db) {
        this.loader = dataLoader;
        this.db = db;
        this.container = document.getElementById('app-container');
    }

    // Ana Ekranı Çiz
    async render() {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Veriler Yükleniyor...</p></div>';

        const userName = await this.db.getUserName();
        if (!userName) { this.showNameModal(); return; }

        const lessons = await this.loader.getLessonList();
        
        const game = new Gamification(this.db);
        const stats = await this.db.getUserStats();
        const rank = game.getRank(stats.xp);

        const history = await this.db.getHistory();
        const activityStats = await this.calculateActivityStats(history);
        const lessonStats = await this.calculateLessonStats(lessons);

        let html = `
            <div class="dashboard-header">
                <h2>Derslerim</h2>
                <p class="subtitle">Çalışmak veya Test olmak için bir ders seçin.</p>
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

        html += `<div class="app-footer">Sürüm: v1.0.3</div>`;
        this.container.innerHTML = html;
        
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

    openSettings() {
        const html = `<div class="modal-overlay" id="settings-modal"><div class="modal-box"><h2 class="modal-title">Ayarlar</h2><div class="form-group"><p>Tüm ilerlemeni silmek istiyor musun?</p></div><div class="modal-actions"><button class="nav-btn secondary" onclick="document.getElementById('settings-modal').remove()">İptal</button><button class="primary-btn" style="background-color:#ef4444;" onclick="window.resetApp()">⚠️ Sıfırla</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        window.resetApp = async () => {
            if(confirm("Emin misin?")) { await this.db.resetAllData(); location.reload(); }
        };
    }
}
