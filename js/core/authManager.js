import { SyncManager } from './sync.js'

export class AuthManager {
    constructor(db){ this.db = db; this.sync = new SyncManager(db) }
    hasToken(){ return !!localStorage.getItem('auth_token') }
    async login(email,password){ const ok = await this.sync.login(email,password); if(ok){ await this.sync.pullAll(); } return ok }
    async register(email,password,name){ const ok = await this.sync.register(email,password); if(ok){ await this.sync.login(email,password); await this.sync.pullAll(); if(name){ await this.db.setUserName(name) } } return ok }
}
