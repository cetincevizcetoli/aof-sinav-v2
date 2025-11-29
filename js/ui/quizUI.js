import { SRS } from '../core/srs.js';
import { Gamification } from '../core/gamification.js';
import { ExamManager } from '../core/examManager.js';

function escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export class QuizUI {
    constructor(dataLoader, db, onBack) {
        this.loader = dataLoader;
        this.db = db;
        this.onBack = onBack;
        this.container = document.getElementById('app-container');
        this.currentCards = [];
        this.currentIndex = 0;
        this.sessionHistory = {}; 
        this.isExamMode = false;
    }

    async start(lessonCode, config = { mode: 'study' }) {
        this.container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Sorular Hazırlanıyor...</p></div>';
        this.sessionHistory = {}; 

        const lessons = await this.loader.getLessonList();
        const targetLesson = lessons.find(l => l.code === lessonCode);
        
        if (!targetLesson) { alert("Ders bulunamadı!"); this.onBack(); return; }

        let allCards = await this.loader.loadLessonData(targetLesson.code, targetLesson.file);

        // --- ÜNİTE FİLTRESİ ---
        if (config.specificUnit) {
            allCards = allCards.filter(card => card.unit === config.specificUnit);
        }

        // --- SORU SEÇİM ALGORİTMASI ---
        if (config.mode === 'exam') {
            const manager = new ExamManager();
            this.currentCards = manager.createExam(allCards, config.type, config.count);
            this.isExamMode = true;
        } else {
            this.currentCards = allCards.sort((a, b) => {
                if (config.specificUnit) {
                    if (a.level === 0 && b.level !== 0) return -1;
                    if (a.level !== 0 && b.level === 0) return 1;
                    if (a.isDue && !b.isDue) return -1;
                    if (!a.isDue && b.isDue) return 1;
                    return 0.5 - Math.random();
                }
                if (a.level === 0 && b.level !== 0) return -1;
                if (a.level !== 0 && b.level === 0) return 1;
                if (a.isDue && !b.isDue) return -1;
                if (!a.isDue && b.isDue) return 1;
                return 0;
            });
            this.isExamMode = false;
        }

        if (this.currentCards.length === 0) { alert("Bu ünitede soru bulunamadı."); this.onBack(); return; }

        this.currentIndex = 0;
        this.renderCard();
    }

    renderCard() {
        const card = this.currentCards[this.currentIndex];
        const progress = `${this.currentIndex + 1} / ${this.currentCards.length}`;
        const givenAnswer = this.sessionHistory[this.currentIndex];
        const isAnswered = givenAnswer !== undefined;

        let stats = { correct: 0, wrong: 0, skipped: 0 };
        Object.keys(this.sessionHistory).forEach(key => {
            const ans = this.sessionHistory[key];
            const q = this.currentCards[key];
            if (ans === 'SKIPPED') stats.skipped++;
            else if (ans === q.correct_option) stats.correct++;
            else stats.wrong++;
        });

        if (!card.shuffledOptions) {
            card.shuffledOptions = [...card.options].sort(() => Math.random() - 0.5);
        }

        const detailsDisplay = isAnswered ? 'block' : 'none';
        
        const codeBlock = card.code_example ? `
            <div class="code-snippet" style="display: ${detailsDisplay}; margin-top: 15px;">
                <div style="color: #94a3b8; font-size: 0.8rem; margin-bottom: 5px; font-weight:bold;">📝 Açıklama:</div>
                <pre><code>${escapeHTML(card.code_example)}</code></pre>
            </div>
        ` : '';

        const sourceBlock = card.source_type ? `
            <div class="source-box" style="display: ${detailsDisplay};">
                <i class="fa-solid fa-book-open"></i> 
                <span>${escapeHTML(card.source_type)}</span>
            </div>
        ` : '';

        let html = `
            <div class="quiz-header">
                <button id="btn-exit" class="icon-btn"><i class="fa-solid fa-arrow-left"></i> Çıkış</button>
                <div class="live-stats">
                    <span class="stat-tag correct"><i class="fa-solid fa-check"></i> ${stats.correct}</span>
                    <span class="stat-tag wrong"><i class="fa-solid fa-xmark"></i> ${stats.wrong}</span>
                    <span class="stat-tag skip"><i class="fa-solid fa-forward"></i> ${stats.skipped}</span>
                </div>
                <span class="quiz-progress">${progress}</span>
            </div>

            <div class="question-card-container">
                <div class="question-card">
                    <div class="card-meta-top">
                        <span class="topic-badge">${escapeHTML(card.topic || 'Genel')}</span>
                        <span class="unit-badge">Ünite ${card.unit}</span>
                    </div>
                    <div class="question-text">
                        <p>${escapeHTML(card.question)}</p>
                    </div>
                    
                    <div class="options-list">
                        ${card.shuffledOptions.map(opt => {
                            let btnClass = 'option-btn';
                            let isDisabled = isAnswered ? 'disabled' : '';
                            if (isAnswered && givenAnswer !== 'SKIPPED') {
                                if (opt === card.correct_option) btnClass += ' correct';
                                else if (opt === givenAnswer) btnClass += ' incorrect';
                            }
                            if (givenAnswer === 'SKIPPED' && opt === card.correct_option) {
                                btnClass += ' skipped-reveal'; 
                            }
                            const safeOpt = opt.replace(/'/g, "\\'");
                            const safeLabel = escapeHTML(opt);
                            return `<button class="${btnClass}" ${isDisabled} onclick="window.handleAnswer(this, '${safeOpt}')">${safeLabel}</button>`;
                        }).join('')}
                    </div>

                    ${codeBlock}
                    ${sourceBlock}

                    <div class="quiz-actions" style="margin-top: 20px; display: flex; gap:10px; flex-wrap: wrap;">
                        <button id="btn-prev" class="nav-btn secondary" style="flex:1;" ${this.currentIndex === 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-chevron-left"></i> Önceki
                        </button>
                        ${!isAnswered ? `<button id="btn-skip" class="nav-btn warning" style="flex:1;" onclick="window.skipQuestion()">Atla / Boş Bırak</button>` : ''}
                        <button id="btn-next" class="nav-btn primary" style="flex:1; ${!isAnswered ? 'display:none' : ''}">
                            Sonraki <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        this.container.innerHTML = html;

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
        }
        this._keyHandler = (e) => {
            const key = e.key.toLowerCase();
            const options = card.shuffledOptions || card.options;
            if (!options) return;
            if (key >= '1' && key <= '4') {
                const idx = parseInt(key) - 1;
                const opt = options[idx];
                if (opt && !givenAnswer) {
                    window.handleAnswer(null, opt);
                }
            } else if (key === 's') {
                if (!givenAnswer) window.skipQuestion();
            } else if (key === 'enter') {
                const nextBtn = document.getElementById('btn-next');
                if (nextBtn && nextBtn.style.display !== 'none') this.nextQuestion();
            } else if (key === 'escape') {
                window.confirmExit();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
        document.getElementById('btn-exit').onclick = () => window.confirmExit();
        document.getElementById('btn-prev').onclick = () => { if(this.currentIndex > 0) { this.currentIndex--; this.renderCard(); } };
        if(document.getElementById('btn-next')) document.getElementById('btn-next').onclick = () => this.nextQuestion();

        window.handleAnswer = (btn, opt) => this.checkAnswer(opt, card);
        window.skipQuestion = () => this.skipCurrentQuestion(card);

        window.confirmExit = () => {
            const wrongs = [];
            for (let i = 0; i < this.currentCards.length; i++) {
                const ans = this.sessionHistory[i];
                const c = this.currentCards[i];
                if ((ans && ans !== c.correct_option) || ans === 'SKIPPED') {
                    wrongs.push({ q: c.question, given: ans === 'SKIPPED' ? 'Boş/Atlandı' : ans, correct: c.correct_option, exp: c.code_example });
                }
            }
            const id = 'confirm-exit-modal';
            const listHtml = wrongs.length > 0 ? `
                <div style="margin-top:12px; max-height:40vh; overflow:auto; text-align:left;">
                    ${wrongs.map((it,idx)=>`
                        <div class="mistake-card" style="background:white; padding:12px; border-radius:8px; border:1px solid #fecaca; margin-bottom:10px;">
                            <div style="font-weight:600; color:#1e293b; margin-bottom:6px;">${idx+1}. ${escapeHTML(it.q)}</div>
                            <div style="font-size:0.9rem; margin-bottom:4px; color:#ef4444;"><strong>Senin Cevabın:</strong> ${escapeHTML(it.given)}</div>
                            <div style="font-size:0.9rem; color:#10b981;"><strong>Doğru Cevap:</strong> ${escapeHTML(it.correct)}</div>
                            ${it.exp ? `<div style=\"margin-top:6px; font-size:0.85rem; background:#f1f5f9; padding:6px; border-radius:4px; color:#475569;\"><strong>📝 Açıklama:</strong> ${escapeHTML(it.exp)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : '<div style="margin-top:8px; color:#64748b;">Bu oturumda yanlış veya boş cevap yok.</div>';
            const html = `
            <div class="modal-overlay" id="${id}">
                <div class="modal-box">
                    <div class="modal-header"><h2 class="modal-title">Oturumu Kapat</h2><button class="icon-btn" onclick="document.getElementById('${id}').remove()"><i class="fa-solid fa-xmark"></i></button></div>
                    <p style="color:#64748b;">Aşağıda bu oturumdaki yanlış/boş sorularını görebilirsin.</p>
                    ${listHtml}
                    <div class="modal-actions" style="margin-top:12px; display:flex; gap:8px;">
                        <button class="nav-btn secondary" onclick="document.getElementById('${id}').remove()">Devam Et</button>
                        <button id="btn-exit-home" class="nav-btn warning">${escapeHTML('Ana Ekrana Dön')}</button>
                    </div>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
            const btn = document.getElementById('btn-exit-home');
            if (btn) btn.onclick = async () => { document.getElementById(id).remove(); const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function'){ await this.db.endSessionRecord(u); } window.__inSession=false; if (this.onBack) this.onBack(); else if (window.dashboard && window.dashboard.render) window.dashboard.render(); };
        };
    }

    async skipCurrentQuestion(card) {
        this.sessionHistory[this.currentIndex] = 'SKIPPED';
        this.renderCard();
    }

    async checkAnswer(selectedOption, card) {
        this.sessionHistory[this.currentIndex] = selectedOption;
        const isCorrect = selectedOption === card.correct_option;

        if (!this.isExamMode) {
            const newStatus = SRS.calculate(card.level, isCorrect);
            await this.db.saveProgress(card.id, {
                id: card.id,
                level: newStatus.level,
                nextReview: newStatus.nextReview,
                correct: (card.correct || 0) + (isCorrect ? 1 : 0),
                wrong: (card.wrong || 0) + (isCorrect ? 0 : 1)
            });
        }

        if (isCorrect) {
            const game = new Gamification(this.db);
            await game.addXP(10);
        }

        const parts = card.id.split('_');
        const lessonCode = parts[0];
        const cycle = (window.__sessionCycleNo!=null) ? (parseInt(window.__sessionCycleNo)||0) : 0;
        await this.db.logActivity(lessonCode, card.unit, isCorrect, card.id, selectedOption, cycle);

        this.renderCard();
    }

    nextQuestion() {
        if (this.currentIndex < this.currentCards.length - 1) {
            this.currentIndex++;
            this.renderCard();
        } else {
            this.showFinishScreen();
        }
    }

    showFinishScreen() {
        const total = this.currentCards.length;
        let correct = 0, wrong = 0, skipped = 0;
        for (let i = 0; i < total; i++) {
            const ans = this.sessionHistory[i];
            const card = this.currentCards[i];
            if (ans === 'SKIPPED') skipped++;
            else if (ans === card.correct_option) correct++;
            else if (ans) wrong++;
        }
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        const earnedXP = correct * 10;

        const wrongAnswers = [];
        for (let i = 0; i < this.currentCards.length; i++) {
            const ans = this.sessionHistory[i];
            const card = this.currentCards[i];
            if ((ans && ans !== card.correct_option) || ans === 'SKIPPED') {
                wrongAnswers.push({ question: card.question, given: ans === 'SKIPPED' ? 'Boş/Atlandı' : ans, correct: card.correct_option, explanation: card.code_example });
            }
        }

        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        const reviewHtml = wrongAnswers.length > 0 ? `
            <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <button class="nav-btn warning full-width" onclick="window.toggleMistakes()">
                    <i class="fa-solid fa-eye"></i> Yanlış Cevapları İncele (${wrongAnswers.length})
                </button>
                <div id="mistakes-container" style="display:none; margin-top: 15px; text-align: left;">
                    ${wrongAnswers.map((item, idx) => `
                        <div class="mistake-card" style="background:white; padding:15px; border-radius:8px; border:1px solid #fecaca; margin-bottom:10px;">
                            <div style="font-weight:600; color:#1e293b; margin-bottom:8px;">${idx + 1}. ${escapeHTML(item.question)}</div>
                            <div style="font-size:0.9rem; margin-bottom:4px;">
                                <span style="color:#ef4444; font-weight:bold;"><i class="fa-solid fa-xmark"></i> Senin Cevabın:</span>
                                <span style="color:#ef4444;">${escapeHTML(item.given)}</span>
                            </div>
                            <div style="font-size:0.9rem;">
                                <span style="color:#10b981; font-weight:bold;"><i class="fa-solid fa-check"></i> Doğru Cevap:</span>
                                <span style="color:#10b981;">${escapeHTML(item.correct)}</span>
                            </div>
                            ${item.explanation ? `
                                <div style="margin-top:8px; font-size:0.85rem; background:#f1f5f9; padding:8px; border-radius:4px; color:#475569;">
                                    <strong>📝 Açıklama:</strong> ${escapeHTML(item.explanation)}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                        <button class="nav-btn secondary" onclick="window.toggleMistakes()"><i class="fa-solid fa-chevron-up"></i> Listeyi Gizle</button>
                        <button class="primary-btn" onclick="(function(){ const b=document.getElementById('btn-finish-home'); if(b) b.click(); })()"><i class="fa-solid fa-house"></i> Ana Ekran</button>
                    </div>
                </div>
            </div>
        ` : '';

        this.container.innerHTML = `
            <div class="loading-state">
                <i class="fa-solid fa-flag-checkered" style="font-size: 3rem; color: #2563eb; margin-bottom: 20px;"></i>
                <h2>Oturum Tamamlandı!</h2>
                <div style="background: #fffbeb; color: #b45309; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin-bottom: 20px;">
                    +${earnedXP} XP Kazandın!
                </div>
                <div class="result-stats" style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center;">
                    <div class="stat-box correct"><span class="stat-value">${correct}</span><span class="stat-label">Doğru</span></div>
                    <div class="stat-box incorrect"><span class="stat-value">${wrong}</span><span class="stat-label">Yanlış</span></div>
                    <div class="stat-box skipped"><span class="stat-value">${skipped}</span><span class="stat-label">Boş</span></div>
                    <div class="stat-box score"><span class="stat-value">%${score}</span><span class="stat-label">Başarı</span></div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; margin-top:20px;">
                    <button id="btn-finish-home" class="primary-btn">Ana Ekrana Dön</button>
                    <button id="btn-restart" class="nav-btn">Tekrar Başla</button>
                </div>
                ${reviewHtml}
            </div>
        `;

        
        window.toggleMistakes = () => { const div = document.getElementById('mistakes-container'); if (!div) return; div.style.display = (div.style.display === 'none' || !div.style.display) ? 'block' : 'none'; if (div.style.display === 'block') { div.scrollIntoView({ behavior: 'smooth' }); } };
        const endUUID = window.__sessionUUID; if (endUUID && this.db && typeof this.db.endSessionRecord === 'function') { this.db.endSessionRecord(endUUID); }
        const btnHome = document.getElementById('btn-finish-home');
        if (btnHome) btnHome.onclick = async () => { const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function') { await this.db.endSessionRecord(u); } window.__inSession=false; if (this.onBack) this.onBack(); else if (window.dashboard && window.dashboard.render) window.dashboard.render(); };
        const btnRestart = document.getElementById('btn-restart');
        if (btnRestart) btnRestart.onclick = async () => { const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function') { await this.db.endSessionRecord(u); } const lesson = this.currentCards[0].id.split('_')[0]; const unit = this.currentCards[0].unit; window.__inSession=false; window.startSession(lesson, { mode:'study', specificUnit: unit }); };
        const escFinish = (e) => { if (e.key === 'Escape') { const u = window.__sessionUUID; if (u && this.db && typeof this.db.endSessionRecord==='function') { this.db.endSessionRecord(u); } window.__inSession=false; if (this.onBack) this.onBack(); else if (window.dashboard && window.dashboard.render) window.dashboard.render(); document.removeEventListener('keydown', escFinish); } };
        document.addEventListener('keydown', escFinish);
    }
}
