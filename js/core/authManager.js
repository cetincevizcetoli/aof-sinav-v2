

https://github.com/cetincevizcetoli/aof-sinav-v2import { SyncManager } from './sync.js'

export class AuthManager {
    constructor(db){ this.db = db; this.sync = new SyncManager(db) }
    hasToken(){ return !!localStorage.getItem('auth_token') }
    async hasLocalData(){ const p = await this.db.getAllProgress(); const h = await this.db.getHistory(); const s = await this.db.getUserStats(); const sHas = ((s.xp||0) > 0) || ((s.streak||0) > 0) || ((s.totalQuestions||0) > 0); return (Array.isArray(p) && p.length>0) || (Array.isArray(h) && h.length>0) || sHas }
    async login(email,password){ const ok = await this.sync.login(email,password); if(ok){ const hasLocal = await this.hasLocalData(); if(hasLocal){ const pushed = await this.sync.pushAll(); if(!pushed){ await this.db.enqueueSync({ type:'push' }); } } else { await this.sync.pullAll(); } } return ok }
    async register(email,password,name){ const res = await this.sync.register(email,password); if(res.exists){ return { ok:false, exists:true } } if(res.ok){ const logged = await this.sync.login(email,password); if(logged){ const hasLocal = await this.hasLocalData(); if(hasLocal){ const pushed = await this.sync.pushAll(); if(!pushed){ await this.db.enqueueSync({ type:'push' }); } } else { await this.sync.pullAll(); } if(name){ await this.db.setUserName(name) } } return { ok:logged } } return { ok:false }
    }
    async deleteAccount(){ return await this.sync.deleteAccount() }
    async wipeRemote(){ return await this.sync.wipeRemote() }
}
