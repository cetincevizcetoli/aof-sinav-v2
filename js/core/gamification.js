export class Gamification {
    constructor(db) {
        this.db = db;
    }

    getRank(xp) {
        if (xp < 200) return { title: "Stajyer", icon: "🌱", next: 200 };
        if (xp < 1000) return { title: "Junior Dev", icon: "💻", next: 1000 };
        if (xp < 3000) return { title: "Senior Dev", icon: "🚀", next: 3000 };
        if (xp < 6000) return { title: "Tech Lead", icon: "🔥", next: 6000 };
        return { title: "CTO", icon: "👑", next: 100000 };
    }

    async addXP(amount) {
        const stats = await this.db.getUserStats();
        stats.xp = (stats.xp || 0) + amount;
        
        // Günlük seri (Streak) kontrolü
        const today = new Date().toDateString();
        if (stats.lastStudyDate !== today) {
             const yesterday = new Date();
             yesterday.setDate(yesterday.getDate() - 1);
             if (stats.lastStudyDate === yesterday.toDateString()) {
                 stats.streak = (stats.streak || 0) + 1;
             } else {
                 stats.streak = 1;
             }
             stats.lastStudyDate = today;
        }

        await this.db.updateUserStats(stats);

        return {
            currentXP: stats.xp,
            rank: this.getRank(stats.xp)
        };
    }
}