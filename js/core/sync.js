export class SyncManager {
    constructor(db){ this.db = db; this.base = './api'; }
    getToken(){ return localStorage.getItem('auth_token') || ''; }
    setToken(t){ localStorage.setItem('auth_token', t); }
    async me(){ const token = this.getToken(); if(!token) return null; const r = await fetch(`${this.base}/auth.php?action=me&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } }); if(!r.ok) return null; const j = await r.json(); return j && j.data ? j.data : null }
    async updateProfileName(name){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/auth.php?action=profile&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name }) }); if(!r.ok) return false; const j = await r.json(); return !!(j && j.ok !== false); }
    async updateCredentials(newEmail,newPassword,newName){ const token = this.getToken(); if(!token) return { ok:false, code:401 }; const r = await fetch(`${this.base}/auth.php?action=update&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ new_email:newEmail||'', new_password:newPassword||'', new_name:newName||'' }) }); if(!r.ok){ return { ok:false, code:r.status }; } const j = await r.json(); return { ok:true, data:j.data } }
    async emailExists(email){ const r = await fetch(`${this.base}/auth.php?action=exists`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email }) }); if(!r.ok) return false; const j = await r.json(); return !!(j && j.data && j.data.exists); }
    async register(email,password){ const r = await fetch(`${this.base}/auth.php?action=register`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) }); if (r.status === 409) return { ok:false, exists:true }; return { ok:r.ok } }
    async login(email,password){ const r = await fetch(`${this.base}/auth.php?action=login`,{ method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) }); if(!r.ok) return false; const j = await r.json(); if(j && j.data && j.data.token){ this.setToken(j.data.token); return true; } return false; }
    async pushAll(){ const token = this.getToken(); if(!token) return false; const progress = await this.db.getAllProgress(); const stats = await this.db.getUserStats(); const history = await this.db.getHistory(); const payload = { progress: progress.map(p=>({ ...p, updated_at: p.updated_at||Date.now() })), stats: { ...stats, updated_at: stats.updated_at||Date.now() }, history }; const r = await fetch(`${this.base}/sync.php?action=push&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) }); if(r.ok){ const ts = Date.now(); await this.db.setProfile('last_sync', ts); const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || []; const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); } } return r.ok; }
    async pullAll(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/sync.php?action=pull&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } }); if(!r.ok) return false; const j = await r.json(); const p = (j.data && j.data.progress) || []; const s = (j.data && j.data.stats) || { xp:0, streak:0, totalQuestions:0, updated_at:0 }; const h = (j.data && j.data.history) || []; for(const item of p){ await this.db.saveProgress(item.id,{ id:item.id, level:item.level, nextReview:item.nextReview, correct:item.correct, wrong:item.wrong, updated_at:item.updated_at||Date.now() }); } await this.db.updateUserStats(s); for(const hi of h){ await this.db.logActivity(hi.lesson, hi.unit, !!hi.isCorrect); } const ts = Date.now(); await this.db.setProfile('last_sync', ts); const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || []; const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); } return true; }
    async wipeRemote(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/sync.php?action=wipe&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Authorization': `Bearer ${token}` } }); return r.ok; }
    async deleteAccount(){ const token = this.getToken(); if(!token) return false; const r = await fetch(`${this.base}/auth.php?action=delete&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Authorization': `Bearer ${token}` } }); if (r.ok){ localStorage.removeItem('auth_token'); } return r.ok; }

    async autoSync(){
        const token = this.getToken(); if(!token) return false;
        const lastTs = await this.db.getProfile('last_sync') || 0;
        const r = await fetch(`${this.base}/sync.php?action=pull&token=${encodeURIComponent(token)}`,{ headers:{ 'Authorization': `Bearer ${token}` } });
        if(!r.ok) return false;
        const j = await r.json();
        const remoteP = (j.data && j.data.progress) || [];
        const remoteS = (j.data && j.data.stats) || { xp:0, streak:0, totalQuestions:0, updated_at:0 };
        const remoteH = (j.data && j.data.history) || [];
        const localP = await this.db.getAllProgress();
        const localS = await this.db.getUserStats();
        const merged = []; const pushQueue = [];
        const mapLocal = new Map(localP.map(x=>[x.id,x]));
        const mapRemote = new Map(remoteP.map(x=>[x.id,x]));
        const ids = new Set([...mapLocal.keys(), ...mapRemote.keys()]);
        for(const id of ids){ const l = mapLocal.get(id)||{}; const r = mapRemote.get(id)||{}; const lu = parseInt(l.updated_at||0); const ru = parseInt(r.updated_at||0); if (ru > lu) { merged.push({ id: r.id, level: r.level||0, nextReview: r.nextReview||0, correct: r.correct||0, wrong: r.wrong||0, updated_at: ru }); } else if (lu > ru) { merged.push({ id: l.id, level: l.level||0, nextReview: l.nextReview||0, correct: l.correct||0, wrong: l.wrong||0, updated_at: lu }); pushQueue.push({ id: l.id, level: l.level||0, nextReview: l.nextReview||0, correct: l.correct||0, wrong: l.wrong||0, updated_at: lu, lesson: l.lesson||'', unit: l.unit||0 }); } }
        for(const item of merged){ await this.db.saveProgress(item.id, item); }
        const lsU = parseInt(localS.updated_at||0); const rsU = parseInt(remoteS.updated_at||0);
        const finalStats = rsU > lsU ? remoteS : localS;
        await this.db.updateUserStats(finalStats);
        for(const hi of remoteH){ if (!lastTs || (hi.date||0) > lastTs) { await this.db.logActivity(hi.lesson, hi.unit, !!hi.isCorrect); } }
        const pushRes = pushQueue.length>0 ? await fetch(`${this.base}/sync.php?action=push&token=${encodeURIComponent(token)}`,{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ progress: pushQueue, stats: finalStats, history: [] }) }) : { ok:true };
        const ts = Date.now(); await this.db.setProfile('last_sync', ts);
        const email = await this.db.getProfile('account_email'); const accounts = (await this.db.getProfile('accounts')) || [];
        const i = Array.isArray(accounts) ? accounts.findIndex(a => a && a.email === email) : -1; if (i >= 0) { accounts[i].lastSync = ts; await this.db.setProfile('accounts', accounts); }
        return pushRes.ok;
    }
}
