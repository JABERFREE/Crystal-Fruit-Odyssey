export class ProgressManager {
    constructor() {
        this.progress = this.load();
        this.LIFE_REGEN_TIME = 15 * 60 * 1000; // 15 minutes in ms
        this.AD_COOLDOWN = 30 * 60 * 1000; // 30 minutes in ms
        this.MAX_LIVES = 5;
        this.checkLifeRegen();
    }

    load() {
        const data = localStorage.getItem('crystal_match_saga_progress');
        let state;
        if (data) {
            state = JSON.parse(data);
        } else {
            state = {
                unlockedLevel: 1,
                levels: {}, 
                gems: 100,
                gold: 500,
                lives: 5,
                boosters: {
                    shaker: 3,
                    bomb: 2,
                    prism: 1,
                    tripleKiwis: 1
                },
                permanentUpgrades: {
                    branchStyle: 'gold', 
                    playerSkin: 'pineapple'
                },
                lastLifeRegen: Date.now(),
                lastAdLifeClaimTime: 0,
                lastSpinTime: 0,
                lastLoginClaimTime: 0,
                streak: 0,
                cumulativeBonus: 0,
                treasureHunt: {
                    active: true,
                    collected: 0,
                    target: 20,
                    endTime: Date.now() + (48 * 60 * 60 * 1000)
                }
            };
        }
        
        // Ensure new fields exist
        if (state.lastAdLifeClaimTime === undefined) state.lastAdLifeClaimTime = 0;
        if (state.streak === undefined) state.streak = state.loginDayCount || 0;
        if (state.cumulativeBonus === undefined) state.cumulativeBonus = 0;
        if (!state.permanentUpgrades) {
            state.permanentUpgrades = {
                branchStyle: 'gold',
                playerSkin: 'pineapple'
            };
        }
        if (!state.ownedSkins) {
            state.ownedSkins = ['pineapple'];
        }
        if (!state.ownedBranches) {
            state.ownedBranches = ['gold'];
        }
        if (!state.lastSpinTime) state.lastSpinTime = 0;
        if (state.lastLoginClaimTime === undefined) state.lastLoginClaimTime = 0;
        if (state.loginDayCount === undefined) state.loginDayCount = 0;
        if (state.boosters.tripleKiwis === undefined) state.boosters.tripleKiwis = 0;
        if (!state.treasureHunt) {
            state.treasureHunt = {
                active: true,
                collected: 0,
                target: 20,
                endTime: Date.now() + (48 * 60 * 60 * 1000)
            };
        }
        return state;
    }

    collectTreasure(amount = 1) {
        if (!this.progress.treasureHunt.active) return;
        this.progress.treasureHunt.collected += amount;
        this.save();
    }

    canClaimDaily() {
        const now = new Date();
        const lastClaim = new Date(this.progress.lastLoginClaimTime || 0);
        
        // Reset streak if missed more than 1 day
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        
        if (this.progress.lastLoginClaimTime > 0 && 
            lastClaim.toDateString() !== now.toDateString() && 
            lastClaim.toDateString() !== yesterday.toDateString()) {
            this.progress.streak = 0;
            this.progress.cumulativeBonus = 0;
            this.save();
        }

        return now.toDateString() !== lastClaim.toDateString();
    }

    claimDaily() {
        if (!this.canClaimDaily()) return null;

        const day = (this.progress.streak % 7) + 1;
        const rewards = [
            { type: 'gold', amount: 150, name: '150 Kiwis', icon: 'assets/crystal-kiwi-slice.webp' },
            { type: 'shaker', amount: 1, name: '1 Shaker', icon: 'assets/booster-shaker-magic.webp' },
            { type: 'gems', amount: 75, name: '75 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp' },
            { type: 'bomb', amount: 1, name: '1 Bomb', icon: 'assets/booster-bomb-crystal.webp' },
            { type: 'gold', amount: 300, name: '300 Kiwis', icon: 'assets/crystal-kiwi-slice.webp' },
            { type: 'prism', amount: 1, name: '1 Prism', icon: 'assets/booster-prism-rainbow.webp' },
            { type: 'jackpot', amount: 1, name: 'MEGA BUNDLE', icon: 'assets/fruit-mega-png.webp' }
        ];

        const reward = rewards[day - 1];
        if (reward.type === 'jackpot') {
            this.grantReward('gems', 300);
            this.grantReward('gold', 500);
            this.grantReward('shaker', 2);
            this.grantReward('bomb', 2);
            this.grantReward('prism', 2);
        } else {
            this.grantReward(reward.type, reward.amount);
        }

        this.progress.lastLoginClaimTime = Date.now();
        this.progress.streak++;
        this.progress.cumulativeBonus = Math.min(7, this.progress.cumulativeBonus + 1);
        
        let megaBonus = null;
        if (this.progress.cumulativeBonus >= 7) {
            megaBonus = { name: 'SAGA LOYALTY CHEST', gems: 500, gold: 1000 };
            this.grantReward('gems', 500);
            this.grantReward('gold', 1000);
            this.progress.cumulativeBonus = 0; 
        }

        this.save();
        return { ...reward, day, megaBonus };
    }

    canSpin() {
        const now = new Date();
        const lastSpin = new Date(this.progress.lastSpinTime || 0);
        return now.toDateString() !== lastSpin.toDateString();
    }

    recordSpin() {
        this.progress.lastSpinTime = Date.now();
        this.save();
    }

    grantReward(type, amount) {
        if (type === 'lives') this.progress.lives += amount;
        else if (type === 'gems') this.progress.gems += amount;
        else if (type === 'gold') this.progress.gold = (this.progress.gold || 0) + amount;
        else if (this.progress.boosters[type] !== undefined) {
            this.progress.boosters[type] += amount;
        }
        this.save();
        this.updateHUD();
    }

    buyBooster(type, cost) {
        if (this.progress.gems >= cost) {
            this.progress.gems -= cost;
            const amountToAdd = {
                'shaker': 5,
                'bomb': 3,
                'prism': 1,
                'tripleKiwis': 3
            }[type] || 1;
            this.progress.boosters[type] = (this.progress.boosters[type] || 0) + amountToAdd;
            this.save();
            return true;
        }
        return false;
    }

    buyBundle(cost = 250) {
        if (this.progress.gems >= cost) {
            this.progress.gems -= cost;
            this.progress.boosters['shaker'] = (this.progress.boosters['shaker'] || 0) + 1;
            this.progress.boosters['bomb'] = (this.progress.boosters['bomb'] || 0) + 1;
            this.progress.boosters['prism'] = (this.progress.boosters['prism'] || 0) + 1;
            this.progress.boosters['tripleKiwis'] = (this.progress.boosters['tripleKiwis'] || 0) + 1;
            this.save();
            return true;
        }
        return false;
    }

    getBoosterCount(type) {
        return this.progress.boosters[type] || 0;
    }

    checkLifeRegen() {
        if (this.progress.lives >= this.MAX_LIVES) {
            this.progress.lastLifeRegen = Date.now();
            return;
        }

        const now = Date.now();
        const elapsed = now - this.progress.lastLifeRegen;
        const livesToGain = Math.floor(elapsed / this.LIFE_REGEN_TIME);

        if (livesToGain > 0) {
            this.progress.lives = Math.min(this.MAX_LIVES, this.progress.lives + livesToGain);
            this.progress.lastLifeRegen += livesToGain * this.LIFE_REGEN_TIME;
            this.save();
        }
    }

    getTimeToNextLife() {
        if (this.progress.lives >= this.MAX_LIVES) return null;
        const now = Date.now();
        const nextLifeAt = this.progress.lastLifeRegen + this.LIFE_REGEN_TIME;
        const remaining = Math.max(0, nextLifeAt - now);
        
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    save() {
        localStorage.setItem('crystal_match_saga_progress', JSON.stringify(this.progress));
        this.updateHUD();
    }

    getTotalStars() {
        return Object.values(this.progress.levels).reduce((sum, lvl) => sum + (lvl.stars || 0), 0);
    }

    updateHUD() {
        const livesEl = document.getElementById('hud-lives');
        if (livesEl) livesEl.innerText = this.progress.lives;

        const gemsEl = document.getElementById('hud-gems');
        if (gemsEl) gemsEl.innerText = this.progress.gems;

        const kiwisEl = document.getElementById('hud-kiwis');
        if (kiwisEl) kiwisEl.innerText = this.progress.gold || 0;

        // Energy Bar (lightning icon HUD item)
        const energyFill = document.querySelector('.energy-bar-fill');
        if (energyFill) {
            energyFill.style.width = '100%'; // Always full for luxury aesthetic
        }

        const scoreEl = document.getElementById('hud-score-display');
        if (scoreEl) {
            const totalScore = Object.values(this.progress.levels).reduce((sum, lvl) => sum + (lvl.score || 0), 0);
            scoreEl.innerText = totalScore || 51984; 
        }

        const modalLivesEl = document.getElementById('modal-lives-display');
        if (modalLivesEl) modalLivesEl.innerText = `${this.progress.lives}/5 ❤️`;
    }

    addGems(amount) {
        this.progress.gems += amount;
        this.save();
    }

    grantViralReward() {
        this.progress.lives += 50;
        this.save();
        this.updateHUD();
    }

    useLife() {
        if (this.progress.lives > 0) {
            this.progress.lives--;
            if (this.progress.lives < this.MAX_LIVES && !this.progress.lastLifeRegen) {
                this.progress.lastLifeRegen = Date.now();
            }
            this.save();
            return true;
        }
        return false;
    }

    buyLife(cost = 100) {
        if (this.progress.lives < this.MAX_LIVES && (this.progress.gold || 0) >= cost) {
            this.progress.gold -= cost;
            this.progress.lives++;
            this.save();
            return 'SUCCESS';
        }
        return this.progress.lives >= this.MAX_LIVES ? 'FULL' : 'FAIL';
    }

    grantAdReward(amount = 5) {
        this.progress.lives = Math.min(this.MAX_LIVES, this.progress.lives + amount);
        this.progress.lastAdLifeClaimTime = Date.now();
        this.save();
        this.updateHUD();
    }

    canClaimAdLife() {
        const now = Date.now();
        const lastClaim = this.progress.lastAdLifeClaimTime || 0;
        return (now - lastClaim) >= this.AD_COOLDOWN;
    }

    getFormattedAdCooldown() {
        if (this.canClaimAdLife()) return null;
        const now = Date.now();
        const lastClaim = this.progress.lastAdLifeClaimTime || 0;
        const remaining = Math.max(0, (lastClaim + this.AD_COOLDOWN) - now);
        
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    refillLives(cost = 200) {
        if (this.progress.lives < this.MAX_LIVES && this.progress.gems >= cost) {
            this.progress.gems -= cost;
            this.progress.lives = this.MAX_LIVES;
            this.save();
            return 'SUCCESS';
        }
        return this.progress.lives >= this.MAX_LIVES ? 'FULL' : 'FAIL';
    }

    completeLevel(levelId, stars, score, coinMultiplier = 1) {
        const current = this.progress.levels[levelId] || { stars: 0, score: 0 };
        const rewards = { gold: 50, gems: 5, boosters: [] };

        if (stars >= 2) {
            rewards.gold += 50;
            rewards.gems += 5;
            const bTypes = ['shaker', 'bomb', 'prism'];
            rewards.boosters.push(bTypes[Math.floor(Math.random() * bTypes.length)]);
        }
        if (stars >= 3) {
            rewards.gold += 100;
            rewards.gems += 15;
            const bTypes = ['shaker', 'bomb', 'prism'];
            rewards.boosters.push(bTypes[Math.floor(Math.random() * bTypes.length)]);
        }

        // Apply triple coins booster if used
        rewards.gold *= coinMultiplier;

        if (stars > current.stars) {
            this.progress.levels[levelId] = { stars, score };
        }
        
        // Apply rewards
        this.progress.gold = (this.progress.gold || 0) + rewards.gold;
        this.progress.gems = (this.progress.gems || 0) + rewards.gems;
        rewards.boosters.forEach(b => {
            this.progress.boosters[b] = (this.progress.boosters[b] || 0) + 1;
        });

        if (levelId === this.progress.unlockedLevel) {
            this.progress.unlockedLevel++;
        }
        this.save();
        this.updateHUD(); 
        return rewards;
    }

    getStars(levelId) {
        return this.progress.levels[levelId]?.stars || 0;
    }

    isUnlocked(levelId) {
        return levelId <= this.progress.unlockedLevel;
    }

    getUnlockedLevel() {
        return this.progress.unlockedLevel;
    }

    // Star Shop Methods
    getOwnedSkins() { return this.progress.ownedSkins || ['pineapple']; }
    getOwnedBranches() { return this.progress.ownedBranches || ['gold']; }
    getCurrentSkin() { return this.progress.permanentUpgrades.playerSkin; }
    getCurrentBranch() { return this.progress.permanentUpgrades.branchStyle; }

    buySkin(skinId, cost) {
        if (this.progress.gems >= cost && !this.getOwnedSkins().includes(skinId)) {
            this.progress.gems -= cost;
            if (!this.progress.ownedSkins) this.progress.ownedSkins = ['pineapple'];
            this.progress.ownedSkins.push(skinId);
            this.save();
            return true;
        }
        return false;
    }

    selectSkin(skinId) {
        if (this.getOwnedSkins().includes(skinId)) {
            this.progress.permanentUpgrades.playerSkin = skinId;
            this.save();
            return true;
        }
        return false;
    }

    buyBranch(branchId, cost) {
        if (this.progress.gems >= cost && !this.getOwnedBranches().includes(branchId)) {
            this.progress.gems -= cost;
            if (!this.progress.ownedBranches) this.progress.ownedBranches = ['gold'];
            this.progress.ownedBranches.push(branchId);
            this.save();
            return true;
        }
        return false;
    }

    selectBranch(branchId) {
        if (this.getOwnedBranches().includes(branchId)) {
            this.progress.permanentUpgrades.branchStyle = branchId;
            this.save();
            return true;
        }
        return false;
    }

    getTreasureProgress() {
        return {
            collected: this.progress.treasureHunt.collected,
            target: this.progress.treasureHunt.target,
            percent: Math.min(100, (this.progress.treasureHunt.collected / this.progress.treasureHunt.target) * 100)
        };
    }
}

export const progressManager = new ProgressManager();