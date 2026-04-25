export class ProgressManager {
    constructor() {
        this.progress = this.load();
        this.LIFE_REGEN_TIME = 15 * 60 * 1000; // 15 minutes in ms
        this.AD_COOLDOWN = 30 * 60 * 1000; // 30 minutes in ms
        this.MAX_LIVES = 5;
        this.checkLifeRegen();
    }

    getAdCooldownRemaining() {
        if (!this.progress.lastAdLifeClaimTime) return 0;
        const now = Date.now();
        const elapsed = now - this.progress.lastAdLifeClaimTime;
        return Math.max(0, this.AD_COOLDOWN - elapsed);
    }

    getFormattedAdCooldown() {
        const remaining = this.getAdCooldownRemaining();
        if (remaining <= 0) return null;
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
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
                    prism: 1
                },
                permanentUpgrades: {
                    branchStyle: 'gold', 
                    playerSkin: 'pineapple'
                },
                lastLifeRegen: Date.now(),
                lastSpinTime: 0,
                lastLoginClaimTime: 0,
                lastAdLifeClaimTime: 0,
                streak: 0,
                cumulativeBonus: 0,
                events: {
                    doubleRewards: {
                        active: true,
                        endTime: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
                    }
                },
                treasureHunt: {
                    active: true,
                    collected: 0,
                    target: 20,
                    endTime: Date.now() + (48 * 60 * 60 * 1000)
                }
            };
        }
        
        // Ensure new fields exist
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
        if (state.lastAdLifeClaimTime === undefined) state.lastAdLifeClaimTime = 0;
        if (state.loginDayCount === undefined) state.loginDayCount = 0;
        if (!state.treasureHunt) {
            state.treasureHunt = {
                active: true,
                collected: 0,
                target: 20,
                endTime: Date.now() + (48 * 60 * 60 * 1000)
            };
        }
        if (!state.events) {
            state.events = {
                doubleRewards: {
                    active: true,
                    endTime: Date.now() + (24 * 60 * 60 * 1000)
                }
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

    isDoubleRewardsActive() {
        const event = this.progress.events?.doubleRewards;
        if (!event || !event.active) return false;
        return Date.now() < event.endTime;
    }

    claimDaily() {
        if (!this.canClaimDaily()) return null;

        const day = (this.progress.streak % 7) + 1;
        let rewards = [
            { type: 'gems', amount: 50, name: '50 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp' },
            { type: 'lives', amount: 2, name: '2 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp' },
            { type: 'gems', amount: 150, name: '150 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp' },
            { type: 'lives', amount: 5, name: '5 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp' },
            { type: 'gems', amount: 300, name: '300 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp' },
            { type: 'lives', amount: 10, name: '10 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp' },
            { type: 'jackpot', amount: 1, name: 'EMPEROR BUNDLE', icon: 'assets/fruit-mega-png.webp' }
        ];

        let reward = { ...rewards[day - 1] };
        const isDouble = this.isDoubleRewardsActive();

        if (isDouble) {
            reward.amount *= 2;
            if (reward.type !== 'jackpot') {
                reward.name = `${reward.amount} ${reward.name.split(' ').slice(1).join(' ')}`;
            } else {
                reward.name = `DOUBLE ${reward.name}`;
            }
        }

        if (reward.type === 'jackpot') {
            const multiplier = isDouble ? 2 : 1;
            this.grantReward('gems', 500 * multiplier);
            this.grantReward('lives', 10 * multiplier);
            this.grantReward('shaker', 5 * multiplier);
            this.grantReward('bomb', 5 * multiplier);
            this.grantReward('prism', 5 * multiplier);
        } else {
            this.grantReward(reward.type, reward.amount);
        }

        this.progress.lastLoginClaimTime = Date.now();
        this.progress.streak++;
        this.progress.cumulativeBonus = Math.min(7, this.progress.cumulativeBonus + 1);
        
        let megaBonus = null;
        if (this.progress.cumulativeBonus >= 7) {
            const megaMultiplier = isDouble ? 2 : 1;
            megaBonus = { name: isDouble ? 'DOUBLE SAGA LOYALTY CHEST' : 'SAGA LOYALTY CHEST', gems: 500 * megaMultiplier, gold: 1000 * megaMultiplier };
            this.grantReward('gems', 500 * megaMultiplier);
            this.grantReward('gold', 1000 * megaMultiplier);
            this.progress.cumulativeBonus = 0; 
        }

        this.save();
        return { ...reward, day, megaBonus, isDouble };
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
            this.progress.boosters[type] = (this.progress.boosters[type] || 0) + (type === 'shaker' ? 5 : type === 'bomb' ? 3 : 1);
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

    refillLives(cost = 200) {
        if (this.progress.lives < this.MAX_LIVES && this.progress.gems >= cost) {
            this.progress.gems -= cost;
            this.progress.lives = this.MAX_LIVES;
            this.save();
            return 'SUCCESS';
        }
        return this.progress.lives >= this.MAX_LIVES ? 'FULL' : 'FAIL';
    }

    completeLevel(levelId, stars, score) {
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