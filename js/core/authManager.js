import { SyncManager } from './sync.js'

export class AuthManager {
    constructor(db){ this.db = db; this.sync = new SyncManager(db) }
    hasToken(){ return !!localStorage.getItem('auth_token') }
    async login(email,password){ const ok = await this.sync.login(email,password); if(ok){ await this.sync.pullAll(); } return ok }
    async register(email,password,name){ const res = await this.sync.register(email,password); if(res.exists){ return { ok:false, exists:true } } if(res.ok){ const logged = await this.sync.login(email,password); if(logged){ await this.sync.pullAll(); if(name){ await this.db.setUserName(name) } } return { ok:logged } } return { ok:false }
    }
    async deleteAccount(){ return await this.sync.deleteAccount() }
    async wipeRemote(){ return await this.sync.wipeRemote() }
}
