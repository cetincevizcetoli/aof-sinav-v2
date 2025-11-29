export class AuthManager {
    constructor(db){ this.db = db }
    hasToken(){ return false }
    async hasLocalData(){ const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const sHas = ((s.xp||0) > 0) || ((s.streak||0) > 0) || ((s.totalQuestions||0) > 0); return (Array.isArray(p) && p.length>0) || (Array.isArray(h) && h.length>0) || sHas }
    async setName(name){ if (name && name.trim().length>0) await this.db.setUserName(name.trim()); return true }
}
