import * as THREE from 'three';
import { GameScene } from './scenes/GameScene.js';
import { MapScene } from './scenes/MapScene.js';
import { CONFIG } from './config.js';
import { getLevelData } from './config/LevelData.js';
import { progressManager } from './systems/ProgressManager.js';
import { soundManager } from './systems/SoundManager.js';
import { analyticsManager } from './systems/AnalyticsManager.js';
import { TransitionSystem } from './systems/TransitionSystem.js';

class Game {
    constructor() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: window.devicePixelRatio < 2, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);

        this.renderer.toneMapping = THREE.NoToneMapping;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.info.autoReset = true; // For performance monitoring if needed

        this.transition = new TransitionSystem(this.renderer);
        this.currentScene = null;
        this.currentLevel = 1;
        this.pointer = new THREE.Vector2();
        this.selectedBoosters = new Set();
        this.hasWatchedAdForMoves = false;

        window.addEventListener('resize', () => this.onResize());
        
        this.init();
    }

    onScroll(e) {
        if (this.currentScene instanceof MapScene) {
            this.currentScene.onScroll(e.deltaY);
        }
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        if (this.currentScene) {
            this.currentScene.camera.aspect = window.innerWidth / window.innerHeight;
            this.currentScene.camera.updateProjectionMatrix();
        }
        if (this.transition) {
            this.transition.onResize();
        }
    }

    onPointer(e, type) {
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        if (this.currentScene && this.currentScene.handleInput) {
            this.currentScene.handleInput(this.pointer, type);
        }
    }

    init() {
        // Simulate loading for splash screen using shared loading system
        const loadingSystem = document.getElementById('loading-system');
        const loadingBar = document.getElementById('global-loading-bar');
        const loadingText = document.getElementById('loading-text');
        const splashScreen = document.getElementById('splash-screen');
        
        if (loadingSystem) loadingSystem.style.display = 'flex';
        if (loadingText) loadingText.innerText = 'Initializing Garden...';

        // Start loading music as soon as user interacts or on load
        soundManager.playLoadingMusic();

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20; // Faster jump
            if (loadingBar) loadingBar.style.width = Math.min(progress, 100) + '%';
            
            if (progress >= 105) {
                clearInterval(interval);
                if (splashScreen) {
                    splashScreen.style.opacity = '0';
                    setTimeout(() => splashScreen.style.display = 'none', 1000);
                }
                if (loadingSystem) loadingSystem.style.display = 'none';
                if (loadingText) loadingText.innerText = 'Crystal Loading...'; // Reset for transitions

                this.transition.start();
                this.showMap();
            }
        }, 80); // Faster interval (from 150ms)

        this.animate();
        window.game = this;
        window.progressManager = progressManager; // Make progressManager global for UI handlers

        // Initialize HUD
        progressManager.updateHUD();

        // Start life regen timer
        setInterval(() => progressManager.checkLifeRegen(), 1000);

        // Set up event listeners
        window.addEventListener('mousedown', (e) => {
            this.onPointer(e, 'start');
            soundManager.ensureAudioContext(); // Initialize audio on first click
        });
        window.addEventListener('mousemove', (e) => this.onPointer(e, 'move'));
        window.addEventListener('mouseup', (e) => this.onPointer(e, 'end'));
        
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) this.onPointer(e.touches[0], 'start');
            soundManager.ensureAudioContext();
        });
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) this.onPointer(e.touches[0], 'move');
        });
        window.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) this.onPointer(e.changedTouches[0], 'end');
        });
        
        window.addEventListener('wheel', (e) => this.onScroll(e), { passive: false });
    }

    showMap(justUnlockedLevel = null) {
        document.getElementById('game-ui').style.display = 'none';
        document.getElementById('map-ui').style.display = 'flex';
        this.toggleModal(null, false);
        this.currentScene = new MapScene((level) => this.showLevelPreview(level), justUnlockedLevel);
        
        if (justUnlockedLevel) {
            this.showLevelUnlockUI(justUnlockedLevel);
        } else {
            // Priority: 1. Daily Login, 2. Daily Spin
            setTimeout(() => {
                if (progressManager.canClaimDaily()) {
                    this.showDailyLoginModal();
                } else if (progressManager.canSpin()) {
                    this.toggleModal('spin-modal', true);
                }
            }, 1000);
        }
        
        soundManager.playMapMusic();
        this.updateSpinButton();
        this.updateDailyRewardDot();
    }

    updateDailyRewardDot() {
        const canClaim = progressManager.canClaimDaily();
        const dot = document.getElementById('daily-notif-dot');
        if (dot) dot.style.display = canClaim ? 'block' : 'none';
    }

    showDailyLoginModal() {
        const calendar = document.getElementById('login-calendar');
        const claimBtn = document.getElementById('claim-daily-btn');
        const closeBtn = document.getElementById('close-daily-btn');
        
        calendar.innerHTML = '';
        const isDouble = progressManager.isDoubleRewardsActive();

        const rewards = [
            { name: '50 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp', amount: 50 },
            { name: '2 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp', amount: 2 },
            { name: '150 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp', amount: 150 },
            { name: '5 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp', amount: 5 },
            { name: '300 Dragon Gems', icon: 'assets/rose-quartz-dragonfruit-jewel.webp', amount: 300 },
            { name: '10 Spirit Hearts', icon: 'assets/ui-spirits-heart-circular-purple.webp', amount: 10 },
            { name: 'EMPEROR BUNDLE', icon: 'assets/fruit-mega-png.webp', amount: 1 }
        ];

        if (isDouble) {
            const doubleBanner = document.createElement('div');
            doubleBanner.style.gridColumn = '1 / -1';
            doubleBanner.style.background = 'linear-gradient(90deg, #ff00ff, #00ffff)';
            doubleBanner.style.color = '#fff';
            doubleBanner.style.padding = '10px';
            doubleBanner.style.borderRadius = '15px';
            doubleBanner.style.fontWeight = 'bold';
            doubleBanner.style.marginBottom = '10px';
            doubleBanner.style.fontSize = '0.9em';
            doubleBanner.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
            doubleBanner.style.animation = 'juicy-pulse 2s infinite ease-in-out';
            doubleBanner.innerText = '🔥 DOUBLE REWARDS EVENT ACTIVE! 🔥';
            calendar.appendChild(doubleBanner);
        }

        const currentDay = (progressManager.progress.streak % 7) + 1;
        const canClaim = progressManager.canClaimDaily();

        rewards.forEach((reward, i) => {
            const dayNum = i + 1;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            if (dayNum < currentDay) dayEl.classList.add('claimed');
            if (dayNum === currentDay && canClaim) dayEl.classList.add('current');
            if (dayNum === currentDay && !canClaim) dayEl.classList.add('claimed');
            
            let displayName = reward.name;
            if (isDouble && reward.amount > 1 && reward.name !== 'EMPEROR BUNDLE') {
                displayName = `${reward.amount * 2} ${reward.name.split(' ').slice(1).join(' ')}`;
            } else if (isDouble && reward.name === 'EMPEROR BUNDLE') {
                displayName = 'DOUBLE EMPEROR';
            }

            dayEl.innerHTML = `
                <div class="calendar-day-label">DAY ${dayNum}</div>
                <div class="calendar-day-icon" style="background-image: url('${reward.icon}')"></div>
                <div class="calendar-day-reward" style="${isDouble ? 'color: #ff00ff; font-weight: bold;' : ''}">${displayName}</div>
            `;
            calendar.appendChild(dayEl);
        });

        // Add Cumulative Bonus Tracker
        const cumulativeArea = document.createElement('div');
        cumulativeArea.style.gridColumn = '1 / -1';
        cumulativeArea.style.marginTop = '15px';
        cumulativeArea.style.background = 'rgba(0,0,0,0.4)';
        cumulativeArea.style.padding = '15px';
        cumulativeArea.style.borderRadius = '20px';
        cumulativeArea.style.border = '1px solid rgba(255,255,255,0.1)';
        cumulativeArea.style.display = 'flex';
        cumulativeArea.style.flexDirection = 'column';
        cumulativeArea.style.gap = '15px';
        
        const progress = progressManager.progress.cumulativeBonus;
        const percent = (progress / 7) * 100;
        
        cumulativeArea.innerHTML = `
            <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; margin-bottom: 8px;">
                    <span>STREAK: ${progressManager.progress.streak} DAYS</span>
                    <span style="color: #ffcc00; font-weight: bold;">LOYALTY BONUS: ${progress}/7</span>
                </div>
                <div style="width: 100%; height: 10px; background: #222; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);">
                    <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #00ffff, #00ff88); box-shadow: 0 0 10px #00ffff;"></div>
                </div>
                <div style="font-size: 0.6em; opacity: 0.6; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px;">
                    ${isDouble ? '🔥 DOUBLE LOYALTY CHEST ACTIVE! 🔥' : 'Complete 7 days for the SAGA LOYALTY CHEST!'}
                </div>
            </div>
            
            <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.1);"></div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 0, 255, 0.1); padding: 10px 15px; border-radius: 15px; border: 1px solid rgba(255, 0, 255, 0.3); cursor: pointer;" onclick="window.game.watchAdForLives()" id="daily-ad-button">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="video-play-icon" style="width: 35px; height: 35px; animation: none;"></div>
                    <div style="text-align: left;">
                        <div style="font-size: 0.9em; font-weight: bold; color: #ff00ff;">AD REWARD</div>
                        <div style="font-size: 0.65em; opacity: 0.8;" id="daily-ad-sublabel">Watch to gain extra spirits</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <div class="hud-icon hud-icon-lives" style="width: 20px; height: 20px;"></div>
                    <div style="font-size: 1.1em; font-weight: bold; color: #ff00ff;">+5</div>
                </div>
            </div>
        `;
        calendar.appendChild(cumulativeArea);

        claimBtn.innerText = `CLAIM DAY ${currentDay}${isDouble ? ' (DOUBLE!)' : ''}`;
        claimBtn.style.display = canClaim ? 'block' : 'none';
        closeBtn.style.display = canClaim ? 'none' : 'block';

        this.toggleModal('daily-login-modal', true);
    }

    claimDailyReward() {
        const reward = progressManager.claimDaily();
        if (reward) {
            analyticsManager.trackEngagement('claim_daily_reward', reward.name);
            this.showToast(`Claimed: ${reward.name}! ✨`);
            soundManager.playSuccessFanfare();
            this.createSparkleBurst();
            
            if (reward.megaBonus) {
                setTimeout(() => {
                    this.showToast(`MEGA BONUS: ${reward.megaBonus.name} UNLOCKED! 🎁`);
                    this.createSparkleBurst();
                    soundManager.playLevelStart();
                }, 1000);
            }
            
            // Re-render modal to show claimed state
            this.showDailyLoginModal();
            this.updateDailyRewardDot();
            
            // Allow closing after claim
            document.getElementById('claim-daily-btn').style.display = 'none';
            document.getElementById('close-daily-btn').style.display = 'block';
        }
    }

    updateSpinButton() {
        const canSpin = progressManager.canSpin();
        const dot = document.getElementById('spin-dot');
        if (dot) dot.style.display = canSpin ? 'block' : 'none';
    }

    async spinWheel() {
        if (!progressManager.canSpin()) {
            this.showToast("Next spin tomorrow!", true);
            return;
        }

        const btn = document.getElementById('spin-btn');
        const closeBtn = document.getElementById('spin-close-btn');
        btn.disabled = true;
        btn.style.opacity = '0.5';
        closeBtn.style.display = 'none';

        const wheel = document.getElementById('wheel');
        const segments = 8;
        const degreesPerSegment = 360 / segments;
        
        // Randomly pick a reward
        const rewardIndex = Math.floor(Math.random() * segments);
        const extraSpins = 5 + Math.floor(Math.random() * 5); // Spin at least 5 times
        const finalRotation = extraSpins * 360 + (segments - rewardIndex) * degreesPerSegment;
        
        wheel.style.transform = `rotate(${finalRotation}deg)`;
        
        soundManager.playCrystalChime(); // Play initial sound

        const rewards = [
            { type: 'shaker', amount: 3, name: '3 Magic Shakers', icon: '🚀' },
            { type: 'prism', amount: 1, name: '1 Rainbow Prism', icon: '🌈' },
            { type: 'gold', amount: 250, name: '250 Kiwis', icon: '🥝' },
            { type: 'lives', amount: 1, name: '1 Heart Crystal', icon: '💖' },
            { type: 'bomb', amount: 2, name: '2 Crystal Bombs', icon: '💣' },
            { type: 'gems', amount: 50, name: '50 Amber Gems', icon: '💎' },
            { type: 'boosters', amount: 1, name: 'Jade Fruit Pack', icon: '🎁' },
            { type: 'gems', amount: 500, name: 'MEGA FRUIT JACKPOT!', icon: '🌟' }
        ];

        setTimeout(() => {
            const reward = rewards[rewardIndex];
            
            if (reward.type === 'boosters') {
                progressManager.grantReward('shaker', 2);
                progressManager.grantReward('bomb', 1);
                progressManager.grantReward('prism', 1);
            } else {
                progressManager.grantReward(reward.type, reward.amount);
            }
            
            analyticsManager.trackEngagement('daily_spin_complete', reward.name);
            progressManager.recordSpin();
            
            this.showToast(`REWARD: ${reward.name} ${reward.icon}`);
            this.createSparkleBurst();
            soundManager.playSuccessFanfare();
            
            this.updateSpinButton();
            
            setTimeout(() => {
                this.toggleModal('spin-modal', false);
                btn.disabled = false;
                btn.style.opacity = '1';
                closeBtn.style.display = 'block';
                // Reset rotation for next time (instantly)
                wheel.style.transition = 'none';
                wheel.style.transform = `rotate(${finalRotation % 360}deg)`;
                setTimeout(() => wheel.style.transition = '', 50);
            }, 2000);
        }, 4000);
    }

    showLevelUnlockUI(level) {
        const banner = document.getElementById('level-unlock-banner');
        const num = document.getElementById('unlock-number');
        if (banner && num) {
            num.innerText = level;
            // Delay until path reaches node (approx 2s in triggerUnlockSequence)
            setTimeout(() => {
                banner.style.opacity = '1';
                banner.style.transform = 'translate(-50%, -50%) scale(1)';
                
                setTimeout(() => {
                    banner.style.opacity = '0';
                    banner.style.transform = 'translate(-50%, -50%) scale(0)';
                }, 2500);
            }, 2500); 
        }
    }

    showLevelPreview(level) {
        this.selectedBoosters.clear();
        const levelData = getLevelData(level);
        const starsCount = progressManager.getStars(level);
        
        const previewTitle = document.getElementById('preview-title');
        const previewStars = document.getElementById('preview-stars');
        const previewCount = document.getElementById('preview-count');
        const previewIcon = document.getElementById('preview-icon');
        const previewStarGoalItem = document.getElementById('preview-star-goal-item');
        const previewStarCount = document.getElementById('preview-star-count');
        const previewGoalText = document.getElementById('preview-goal-text');
        const playButton = document.getElementById('play-button');
        
        previewTitle.innerText = `LEVEL ${level}`;
        previewStars.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const star = document.createElement('span');
            star.innerText = i < starsCount ? '⭐' : '☆';
            star.style.fontSize = '1.5em';
            star.style.margin = '0 5px';
            previewStars.appendChild(star);
        }
        
        // Main Crystal Goal
        previewCount.innerText = levelData.goal.count;
        const goalConfig = CONFIG.CRYSTAL_TYPES[levelData.goal.type];
        previewIcon.style.backgroundImage = `url(${goalConfig.asset})`;
        previewIcon.style.backgroundSize = 'contain';
        previewIcon.style.backgroundRepeat = 'no-repeat';
        previewIcon.style.backgroundPosition = 'center';
        previewIcon.style.boxShadow = 'none';
        previewIcon.style.border = 'none';

        // Star Goal
        if (levelData.starGoal > 0) {
            previewStarGoalItem.style.display = 'flex';
            previewStarCount.innerText = levelData.starGoal;
        } else {
            previewStarGoalItem.style.display = 'none';
        }
        
        previewGoalText.innerText = `Collect ${goalConfig.name}`;
        
        // Update booster availability in preview
        ['shaker', 'bomb', 'prism'].forEach(type => {
            const countEl = document.getElementById(`count-${type}`);
            if (countEl) {
                const item = countEl.parentElement;
                const count = progressManager.getBoosterCount(type);
                item.classList.remove('selected');
                countEl.innerText = count;
                
                // Map logical boosters to the visual fruit icons from the image
                const iconMap = {
                    'shaker': 'assets/luxury-ruby-strawberry.webp',
                    'bomb': 'assets/fruit-sapphire-png.webp',
                    'prism': 'assets/golden-pear-gem.webp'
                };
                const icon = item.querySelector('.hud-icon');
                if (icon) icon.style.backgroundImage = `url(${iconMap[type]})`;
            }
        });

        playButton.onclick = () => {
            if (progressManager.useLife()) {
                // Deduct selected boosters from inventory
                const boostersToApply = Array.from(this.selectedBoosters);
                boostersToApply.forEach(b => {
                    if (progressManager.progress.boosters[b] > 0) {
                        progressManager.progress.boosters[b]--;
                    }
                });
                progressManager.save();
                progressManager.updateHUD();

                this.toggleModal('level-preview-modal', false);
                
                // Trigger the cinematic zoom before starting the game
                if (this.currentScene instanceof MapScene) {
                    this.currentScene.triggerLaunchAnimation(level, () => {
                        this.startGame(level, boostersToApply);
                    });
                } else {
                    this.startGame(level, boostersToApply);
                }
            } else {
                this.toggleModal('lives-modal', true);
            }
        };
        
        this.toggleModal('level-preview-modal', true);
        this.createSparkleBurst();
    }

    createSparkleBurst() {
        const overlay = document.getElementById('modal-overlay');
        for (let i = 0; i < 15; i++) {
            const sparkle = document.createElement('div');
            sparkle.innerHTML = '✨';
            sparkle.style.position = 'fixed';
            sparkle.style.left = '50%';
            sparkle.style.top = '50%';
            sparkle.style.fontSize = (10 + Math.random() * 20) + 'px';
            sparkle.style.pointerEvents = 'none';
            sparkle.style.zIndex = '1000';
            overlay.appendChild(sparkle);

            const angle = Math.random() * Math.PI * 2;
            const dist = 100 + Math.random() * 200;
            const tx = Math.cos(angle) * dist;
            const ty = Math.sin(angle) * dist;

            const anim = sparkle.animate([
                { transform: 'translate(-50%, -50%) scale(0)', opacity: 1 },
                { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.5)`, opacity: 0 }
            ], {
                duration: 800 + Math.random() * 400,
                easing: 'cubic-bezier(0.1, 0.8, 0.3, 1)'
            });

            anim.onfinish = () => sparkle.remove();
        }
    }

    createLevelSuccessAnimation() {
        // Success Label
        const label = document.createElement('div');
        label.className = 'success-label';
        label.innerText = 'LEVEL 78 COMPLETE!';
        document.body.appendChild(label);
        setTimeout(() => label.remove(), 2000);

        // Success Stars
        const starCount = 40;
        for (let i = 0; i < starCount; i++) {
            setTimeout(() => {
                const star = document.createElement('div');
                star.className = 'success-star';
                star.innerHTML = i % 2 === 0 ? '⭐' : '✨';
                star.style.left = '50%';
                star.style.top = '50%';
                
                const angle = Math.random() * Math.PI * 2;
                const dist = 200 + Math.random() * 600;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                
                star.style.setProperty('--tx', `${tx}px`);
                star.style.setProperty('--ty', `${ty}px`);
                
                document.body.appendChild(star);
                setTimeout(() => star.remove(), 1500);
                
                if (i % 5 === 0) soundManager.playClink();
            }, i * 30);
        }
    }

    toggleBooster(type) {
        const el = document.getElementById(`booster-preview-${type}`);
        if (this.selectedBoosters.has(type)) {
            this.selectedBoosters.delete(type);
            el.classList.remove('selected');
        } else {
            const count = progressManager.getBoosterCount(type);
            if (count > 0) {
                this.selectedBoosters.add(type);
                el.classList.add('selected');
                soundManager.playClink();
            } else {
                soundManager.playError();
                this.showToast(`No ${type}s left! Visit shop.`, true);
            }
        }
    }

    startGame(level, selectedBoosters = []) {
        this.currentLevel = level;
        this.hasWatchedAdForMoves = false;
        document.getElementById('map-ui').style.display = 'none';
        document.getElementById('game-ui').style.display = 'flex';
        this.toggleModal(null, false);

        const levelData = getLevelData(level);
        const goalType = levelData.goal.type;
        
        // Setup goals UI
        const starGoalEl = document.getElementById('star-goal');
        if (starGoalEl) {
            starGoalEl.style.display = levelData.starGoal > 0 ? 'flex' : 'none';
        }

        const crystalIcon = document.querySelector('#crystal-goal .crystal-icon');
        if (crystalIcon) {
            const goalConfig = CONFIG.CRYSTAL_TYPES[goalType];
            crystalIcon.style.backgroundImage = `url(${goalConfig.asset})`;
            crystalIcon.style.backgroundSize = '80%';
            crystalIcon.style.boxShadow = 'none';
            crystalIcon.style.border = 'none';
        }

        this.currentScene = new GameScene(
            levelData,
            (win, score, bombExploded) => this.onGameOver(win, score, bombExploded),
            (score, moves, goal, starGoal) => this.updateUI(score, moves, goal, starGoal),
            selectedBoosters
        );
        
        this.updateUI(0, levelData.moves, levelData.goal, levelData.starGoal);
        soundManager.playGameMusic(level);
    }

    toggleMusic() {
        const enabled = soundManager.toggleMusic();
        const el = document.getElementById('music-status');
        if (el) el.innerText = enabled ? 'On' : 'Off';
        this.showToast(`Music ${enabled ? 'On' : 'Off'} 🎵`);
    }

    toggleSFX() {
        const enabled = soundManager.toggleSFX();
        const el = document.getElementById('sfx-status');
        if (el) el.innerText = enabled ? 'On' : 'Off';
        this.showToast(`Sound Effects ${enabled ? 'On' : 'Off'} 🔊`);
    }

    buyExtraMoves() {
        const cost = 100;
        if (progressManager.progress.gems >= cost) {
            progressManager.progress.gems -= cost;
            progressManager.save();
            progressManager.updateHUD();
            
            if (this.currentScene instanceof GameScene) {
                this.currentScene.moves += 5; // Reduced to 5 to match the UI button
                this.updateUI(this.currentScene.score, this.currentScene.moves, this.currentScene.goal, this.currentScene.starGoal);
                this.currentScene.isGameOver = false; // Reset game over flag
                this.currentScene.isProcessing = false; // Ensure it's not stuck
            }
            
            this.toggleModal('fail-modal', false);
            this.showToast("5 Moves Added! 💎");
            soundManager.playMatch();
        } else {
            soundManager.playError();
            this.showToast("Not enough Gems! 💎", true);
        }
    }

    async shareGame() {
        const shareData = {
            title: 'Puzzle Fruit Odyssey',
            text: 'I\'m exploring the magical Crystal Garden! Join me in this puzzle odyssey.',
            url: 'https://rosebud.ai/p/crystal-clink-chronicles'
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
                this.grantShareReward();
            } else {
                // Fallback for browsers that don't support Web Share API
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`, '_blank');
                // We'll give reward anyway for the fallback to be nice
                this.grantShareReward();
            }
        } catch (err) {
            console.log('Share failed:', err);
            if (err.name !== 'AbortError') {
                this.showToast("Sharing cancelled or failed.", true);
            }
        }
    }

    grantShareReward() {
        progressManager.grantViralReward();
        this.toggleModal('share-modal', false);
        this.showToast("SUCCESS! +50 LIVES CREDITED! 💖");
        this.createSparkleBurst(); // Reuse the sparkle effect for success
        soundManager.playSuccessFanfare();
    }

    showTreasureHuntModal() {
        const modal = document.getElementById('treasure-hunt-modal');
        const fill = document.getElementById('treasure-progress-fill');
        const text = document.getElementById('treasure-progress-text');
        
        const collected = progressManager.progress.treasureHunt.collected;
        const target = progressManager.progress.treasureHunt.target;
        const percent = Math.min(100, (collected / target) * 100);
        
        fill.style.width = `${percent}%`;
        text.innerText = `${collected}/${target}`;
        
        this.toggleModal('treasure-hunt-modal', true);
    }

    onGameOver(win, score, bombExploded) {
        const levelData = getLevelData(this.currentLevel);
        
        let stars = 0;
        if (score >= levelData.targetScore * 1.5) stars = 3;
        else if (score >= levelData.targetScore * 1.2) stars = 2;
        else if (score >= levelData.targetScore) stars = 1;

        if (win && stars === 0) stars = 1;

        analyticsManager.trackLevelEnd(this.currentLevel, win, score, stars);

        let justUnlocked = null;
        let rewards = null;
        if (win) {
            const oldUnlocked = progressManager.getUnlockedLevel();
            rewards = progressManager.completeLevel(this.currentLevel, stars, score);
            const newUnlocked = progressManager.getUnlockedLevel();
            if (newUnlocked > oldUnlocked) justUnlocked = newUnlocked;

            // Trigger Special Level 78 Success Animation
            if (this.currentLevel === 78) {
                this.createLevelSuccessAnimation();
            }
        }

        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = 'flex';
        
        const winModal = document.getElementById('win-modal');
        const failModal = document.getElementById('fail-modal');
        const rewardsModal = document.getElementById('rewards-modal');
        
        winModal.style.display = 'none';
        failModal.style.display = 'none';
        rewardsModal.style.display = 'none';

        if (win) {
            soundManager.playSuccessFanfare();
            winModal.style.display = 'block';
            document.getElementById('win-score').innerText = score;
            
            const starSlots = [
                document.getElementById('win-star-1'),
                document.getElementById('win-star-2'),
                document.getElementById('win-star-3')
            ];
            
            starSlots.forEach((slot, i) => {
                slot.classList.remove('filled');
                if (i < stars) {
                    setTimeout(() => {
                        slot.classList.add('filled');
                        soundManager.playCrystalChime(); 
                    }, 500 + i * 400);
                }
            });
            
            const claimBtn = document.getElementById('win-claim-btn');
            claimBtn.onclick = () => {
                winModal.style.display = 'none';
                this.showRewardsModal(rewards, stars, score, justUnlocked);
            };
        } else {
            soundManager.playLoseSound();
            failModal.style.display = 'block';
            const failTitle = document.getElementById('fail-title');
            const failIcon = document.getElementById('fail-icon');
            const failMessage = document.getElementById('fail-message');
            const buyMovesBtn = document.getElementById('buy-moves-btn');
            const adMovesBtn = document.getElementById('ad-moves-btn');
            const adLivesBtn = document.getElementById('ad-lives-btn');
            const progressDisplay = document.getElementById('fail-progress-display');

            // Populate progress display
            if (progressDisplay && this.currentScene instanceof GameScene) {
                progressDisplay.innerHTML = '';
                
                // Crystal Goal
                const goalGroup = document.createElement('div');
                goalGroup.style.display = 'flex';
                goalGroup.style.flexDirection = 'column';
                goalGroup.style.alignItems = 'center';
                
                const goalIcon = document.createElement('div');
                goalIcon.className = 'crystal-icon large';
                const goalConfig = CONFIG.CRYSTAL_TYPES[this.currentScene.goal.type];
                goalIcon.style.backgroundImage = `url(${goalConfig.asset})`;
                goalIcon.style.backgroundSize = 'contain';
                goalIcon.style.backgroundRepeat = 'no-repeat';
                goalIcon.style.backgroundPosition = 'center';
                
                const goalCount = document.createElement('div');
                goalCount.className = 'stat-value';
                goalCount.style.fontSize = '2.5em';
                goalCount.innerText = this.currentScene.goal.count;
                
                goalGroup.appendChild(goalIcon);
                goalGroup.appendChild(goalCount);
                progressDisplay.appendChild(goalGroup);

                // Star Goal if exists
                if (this.currentScene.starGoal > 0) {
                    const starGroup = document.createElement('div');
                    starGroup.style.display = 'flex';
                    starGroup.style.flexDirection = 'column';
                    starGroup.style.alignItems = 'center';
                    
                    const starIcon = document.createElement('div');
                    starIcon.className = 'hud-icon hud-icon-stars';
                    starIcon.style.width = '65px';
                    starIcon.style.height = '65px';
                    
                    const starCount = document.createElement('div');
                    starCount.className = 'stat-value';
                    starCount.style.fontSize = '2.5em';
                    starCount.style.color = '#ffdd00';
                    starCount.innerText = this.currentScene.starGoal;
                    
                    starGroup.appendChild(starIcon);
                    starGroup.appendChild(starCount);
                    progressDisplay.appendChild(starGroup);
                }
            }

            if (bombExploded) {
                failTitle.innerText = "BOMB EXPLODED!";
                failIcon.innerText = "💥";
                failMessage.innerText = "The crystal bomb shattered! Try matching it faster next time.";
                buyMovesBtn.style.display = 'none'; // Cannot buy moves if bomb exploded
                if (adMovesBtn) adMovesBtn.style.display = 'none';
                if (adLivesBtn) adLivesBtn.style.display = 'none';
            } else {
                failTitle.innerText = "OUT OF MOVES!";
                failIcon.innerText = "😢";
                failMessage.innerText = "So close! Add 5 more moves to keep your progress and win!";
                buyMovesBtn.style.display = 'block';
                if (adMovesBtn) {
                    adMovesBtn.style.display = this.hasWatchedAdForMoves ? 'none' : 'flex';
                }
                if (adLivesBtn) {
                    adLivesBtn.style.display = progressManager.progress.lives === 0 ? 'flex' : 'none';
                }
            }
        }
    }

    showRewardsModal(rewards, stars, score, justUnlocked) {
        const modal = document.getElementById('rewards-modal');
        modal.style.display = 'block';
        
        const stageTitle = document.getElementById('reward-stage-title');
        if (stageTitle) stageTitle.innerText = `LEVEL ${this.currentLevel}`;

        const scoreText = document.getElementById('reward-score-text');
        if (scoreText) scoreText.innerHTML = `Score: <span style="color: #ffcc00;">${score.toLocaleString()}</span>`;

        const starsDisplay = document.getElementById('reward-stars-display');
        starsDisplay.innerText = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
        
        const list = document.getElementById('rewards-list');
        list.innerHTML = '';
        
        // Gold (Crystal Kiwis)
        this.addRewardItem(list, 'assets/crystal-kiwi-slice.webp', `+${rewards.gold}`, 'Crystal Kiwis');
        // Gems (Dragon Gems)
        this.addRewardItem(list, 'assets/rose-quartz-dragonfruit-jewel.webp', `+${rewards.gems}`, 'Dragon Gems');
        
        // Boosters
        const boosterIcons = {
            'shaker': 'assets/booster-shaker-magic.webp',
            'bomb': 'assets/booster-bomb-crystal.webp',
            'prism': 'assets/booster-prism-rainbow.webp'
        };
        
        rewards.boosters.forEach(b => {
            this.addRewardItem(list, boosterIcons[b], `+1`, b.charAt(0).toUpperCase() + b.slice(1));
        });
        
        // Add Ad Reward Icon to the rewards list
        this.addAdRewardListItem(list);

        const collectBtn = document.getElementById('reward-collect-btn');
        collectBtn.onclick = () => {
            soundManager.playClink();
            this.showMap(justUnlocked);
        };
        
        this.createSparkleBurst();
    }

    addRewardItem(container, iconUrl, amountText, labelText) {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        item.style.animation = 'star-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both';
        item.style.animationDelay = `${container.children.length * 0.15}s`;
        
        const icon = document.createElement('div');
        icon.style.width = '70px';
        icon.style.height = '70px';
        icon.style.backgroundImage = `url(${iconUrl})`;
        icon.style.backgroundSize = 'contain';
        icon.style.backgroundRepeat = 'no-repeat';
        icon.style.backgroundPosition = 'center';
        icon.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))';
        
        const amount = document.createElement('div');
        amount.innerText = amountText;
        amount.style.fontSize = '1.3em';
        amount.style.color = '#ffcc00';
        amount.style.fontWeight = 'bold';
        amount.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';

        const label = document.createElement('div');
        label.innerText = labelText;
        label.style.fontSize = '0.6em';
        label.style.color = 'rgba(255,255,255,0.7)';
        label.style.textTransform = 'uppercase';
        label.style.letterSpacing = '1px';
        
        item.appendChild(icon);
        item.appendChild(amount);
        item.appendChild(label);
        container.appendChild(item);
    }

    addAdRewardListItem(container) {
        const item = document.createElement('div');
        item.id = 'reward-list-ad-item';
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        item.style.animation = 'star-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both';
        item.style.animationDelay = `${container.children.length * 0.15}s`;
        item.style.cursor = 'pointer';
        item.onclick = () => window.game.watchAdForLives();
        
        const icon = document.createElement('div');
        icon.style.width = '70px';
        icon.style.height = '70px';
        icon.style.backgroundImage = `url('assets/ui-spirits-heart-circular-purple.webp')`;
        icon.style.backgroundSize = 'contain';
        icon.style.backgroundRepeat = 'no-repeat';
        icon.style.backgroundPosition = 'center';
        icon.style.position = 'relative';
        icon.style.filter = 'drop-shadow(0 4px 12px rgba(255,0,255,0.4))';

        const playOverlay = document.createElement('div');
        playOverlay.className = 'video-play-icon';
        playOverlay.style.position = 'absolute';
        playOverlay.style.width = '30px';
        playOverlay.style.height = '30px';
        playOverlay.style.bottom = '-5px';
        playOverlay.style.right = '-5px';
        playOverlay.style.animation = 'ad-icon-pulse 1.5s infinite';
        icon.appendChild(playOverlay);
        
        const amount = document.createElement('div');
        amount.innerText = '+5';
        amount.style.fontSize = '1.3em';
        amount.style.color = '#ff00ff';
        amount.style.fontWeight = 'bold';
        amount.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';

        const label = document.createElement('div');
        label.innerText = 'AD BONUS';
        label.style.fontSize = '0.6em';
        label.style.color = 'rgba(255,255,255,0.7)';
        label.style.textTransform = 'uppercase';
        label.style.letterSpacing = '1px';
        
        item.appendChild(icon);
        item.appendChild(amount);
        item.appendChild(label);
        container.appendChild(item);
    }

    showBoutiqueModal() {
        const skinGrid = document.getElementById('skin-grid');
        const branchGrid = document.getElementById('branch-grid');
        
        skinGrid.innerHTML = '';
        branchGrid.innerHTML = '';
        
        const skins = [
            { id: 'pineapple', name: 'Sapphire Pineapple', icon: 'assets/luxury-crystal-pineapple.webp', cost: 0 },
            { id: 'strawberry', name: 'Ruby Strawberry', icon: 'assets/luxury-ruby-strawberry.webp', cost: 500 },
            { id: 'orange', name: 'Amber Orange', icon: 'assets/luxury-crystal-orange.webp', cost: 750 },
            { id: 'grape', name: 'Amethyst Grape', icon: 'assets/fruit-amethyst-png.webp', cost: 1000 }
        ];

        const branches = [
            { id: 'gold', name: 'Golden Veins', color: '#ffcc00', cost: 0 },
            { id: 'crystal', name: 'Crystal Frost', color: '#00ffff', cost: 800 },
            { id: 'emerald', name: 'Emerald Vines', color: '#00ff88', cost: 1200 }
        ];

        const ownedSkins = progressManager.getOwnedSkins();
        const currentSkin = progressManager.getCurrentSkin();

        skins.forEach(skin => {
            const isOwned = ownedSkins.includes(skin.id);
            const isSelected = currentSkin === skin.id;
            
            const card = document.createElement('div');
            card.className = `shop-card ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="shop-card-info">
                    <div class="hud-icon" style="background-image: url('${skin.icon}'); width: 45px; height: 45px;"></div>
                    <div class="shop-card-text">
                        <div class="shop-card-name">${skin.name}</div>
                        <div class="shop-card-desc">${isOwned ? (isSelected ? 'ACTIVE' : 'OWNED') : 'PERMANENT SKIN'}</div>
                    </div>
                </div>
                <div class="price-pill ${isOwned ? 'free' : ''}">${isOwned ? (isSelected ? 'SELECTED' : 'SELECT') : skin.cost + ' 💎'}</div>
            `;
            
            card.onclick = () => {
                if (isOwned) {
                    progressManager.selectSkin(skin.id);
                    soundManager.playClink();
                    this.showBoutiqueModal(); // Refresh
                } else if (progressManager.buySkin(skin.id, skin.cost)) {
                    soundManager.playSuccessFanfare();
                    this.createSparkleBurst();
                    this.showBoutiqueModal();
                } else {
                    soundManager.playError();
                    this.showToast("Not enough Gems! 💎", true);
                }
            };
            skinGrid.appendChild(card);
        });

        const ownedBranches = progressManager.getOwnedBranches();
        const currentBranch = progressManager.getCurrentBranch();

        branches.forEach(branch => {
            const isOwned = ownedBranches.includes(branch.id);
            const isSelected = currentBranch === branch.id;

            const card = document.createElement('div');
            card.className = `shop-card ${isSelected ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="shop-card-info">
                    <div style="width: 45px; height: 10px; background: ${branch.color}; border-radius: 5px; box-shadow: 0 0 10px ${branch.color};"></div>
                    <div class="shop-card-text">
                        <div class="shop-card-name">${branch.name}</div>
                        <div class="shop-card-desc">${isOwned ? (isSelected ? 'ACTIVE' : 'OWNED') : 'MAP ENHANCEMENT'}</div>
                    </div>
                </div>
                <div class="price-pill ${isOwned ? 'free' : ''}">${isOwned ? (isSelected ? 'SELECTED' : 'SELECT') : branch.cost + ' 💎'}</div>
            `;

            card.onclick = () => {
                if (isOwned) {
                    progressManager.selectBranch(branch.id);
                    soundManager.playClink();
                    this.showBoutiqueModal();
                } else if (progressManager.buyBranch(branch.id, branch.cost)) {
                    soundManager.playSuccessFanfare();
                    this.createSparkleBurst();
                    this.showBoutiqueModal();
                } else {
                    soundManager.playError();
                    this.showToast("Not enough Gems! 💎", true);
                }
            };
            branchGrid.appendChild(card);
        });

        this.toggleModal('boutique-modal', true);
    }

    toggleModal(id, show) {
        const overlay = document.getElementById('modal-overlay');
        overlay.style.display = show ? 'flex' : 'none';
        
        const modals = overlay.querySelectorAll('.modal-content');
        modals.forEach(m => m.style.display = 'none');
        
        // Apply filter sweep when modal is shown
        soundManager.applyFilter(show);

        if (!show) {
            // If we closed the boutique, refresh map visuals
            if (this.currentScene instanceof MapScene) {
                this.currentScene.refreshVisuals();
            }
        }

        if (show && id) {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = 'block';
            if (id === 'lives-modal') progressManager.updateHUD(); // Refresh display
            if (id === 'treasure-hunt-modal') this.updateTreasureHuntUI();
        }
    }

    updateTreasureHuntUI() {
        const fill = document.getElementById('treasure-progress-fill');
        const text = document.getElementById('treasure-progress-text');
        if (!fill || !text) return;

        const progress = progressManager.getTreasureProgress();
        fill.style.width = `${progress.percent}%`;
        text.innerText = `${progress.collected}/${progress.target}`;
    }

    buyLife() {
        const result = progressManager.buyLife();
        if (result === 'SUCCESS') {
            soundManager.playMatch();
            this.showToast("Life Purchased! ❤️");
        } else if (result === 'FULL') {
            soundManager.playError();
            this.showToast("Lives are already full! ❤️", true);
        } else {
            soundManager.playError();
            this.showToast("Not enough Gems! 💎", true);
        }
    }

    refillLives() {
        const result = progressManager.refillLives();
        if (result === 'SUCCESS') {
            soundManager.playMatch();
            this.showToast("Lives Refilled! 💖");
        } else if (result === 'FULL') {
            soundManager.playError();
            this.showToast("Lives are already full! ❤️", true);
        } else {
            soundManager.playError();
            this.showToast("Not enough Gems! 💎", true);
        }
    }

    buyBooster(type, cost, name) {
        if (progressManager.buyBooster(type, cost)) {
            soundManager.playMatch();
            this.showToast(`${name} Purchased! ✨`);
        } else {
            soundManager.playError();
            this.showToast("Not enough Gems! 💎", true);
        }
    }

    showToast(message, isError = false) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    updateUI(score, moves, goal, starGoal) {
        const scoreEl = document.getElementById('score');
        const movesEl = document.getElementById('moves');
        const goalEl = document.getElementById('goal-count');
        const crystalGoalContainer = document.getElementById('crystal-goal');
        const starGoalEl = document.getElementById('star-goal-count');
        const starGoalContainer = document.getElementById('star-goal');
        
        if (scoreEl && scoreEl.innerText !== score.toString()) {
            scoreEl.innerText = score;
            scoreEl.classList.add('pulse');
            setTimeout(() => scoreEl.classList.remove('pulse'), 300);
        }
        
        if (movesEl) movesEl.innerText = moves;
        
        if (goalEl && goalEl.innerText !== goal.count.toString()) {
            goalEl.innerText = goal.count;
            if (crystalGoalContainer) {
                crystalGoalContainer.classList.add('pulse');
                setTimeout(() => crystalGoalContainer.classList.remove('pulse'), 300);
            }
        }

        if (starGoalEl && starGoalEl.innerText !== (starGoal || 0).toString()) {
            starGoalEl.innerText = starGoal || 0;
            if (starGoalContainer) {
                starGoalContainer.classList.add('pulse');
                setTimeout(() => starGoalContainer.classList.remove('pulse'), 300);
            }
        }
        
        const levelData = getLevelData(this.currentLevel);
        let starsStr = '☆☆☆';
        if (score >= levelData.targetScore * 1.5) starsStr = '⭐⭐⭐';
        else if (score >= levelData.targetScore * 1.2) starsStr = '⭐⭐☆';
        else if (score >= levelData.targetScore) starsStr = '⭐☆☆';
        
        const starsEl = document.getElementById('stars');
        if (starsEl) starsEl.innerText = starsStr;
    }

    async watchAdForLives() {
        if (progressManager.progress.lives >= progressManager.MAX_LIVES) {
            this.showToast("Lives are already full! ❤️", true);
            soundManager.playError();
            return;
        }

        const cooldown = progressManager.getAdCooldownRemaining();
        if (cooldown > 0) {
            const timeStr = progressManager.getFormattedAdCooldown();
            this.showToast(`Ad on cooldown! Please wait ${timeStr} ⏳`, true);
            soundManager.playError();
            return;
        }

        this.showToast("Loading Magical Reward Ad... 💎");
        
        // Mocking Ad Flow
        const adDuration = 3000;
        await new Promise(res => setTimeout(res, adDuration));

        const success = Math.random() > 0.1;

        if (success) {
            progressManager.grantAdReward(5);
            this.createHeartParticleReward();
            this.showToast("AD COMPLETE! +5 SPIRITS GRANTED! 💖");
            soundManager.playSuccessFanfare();
            
            // If we are in the fail modal, we might want to stay there to allow buying moves
            // but usually players want to go back to the map if they are just getting lives.
            // Let's just update the HUD and let them decide.
            const adLivesBtn = document.getElementById('ad-lives-btn');
            if (adLivesBtn) adLivesBtn.style.display = 'none';
        } else {
            this.showToast("Ad closed early. No Spirits granted.", true);
            soundManager.playError();
        }
    }

    async watchRewardedAd() {
        // Alias for UI buttons in other modals
        await this.watchAdForLives();
    }

    async watchAdForMoves() {
        if (this.hasWatchedAdForMoves) {
            this.showToast("Only one free revive per attempt!", true);
            soundManager.playError();
            return;
        }

        this.showToast("Loading Reward Ad... 🎬");
        
        // Mocking Ad Flow
        const adDuration = 3000;
        await new Promise(res => setTimeout(res, adDuration));

        const success = Math.random() > 0.05; // 95% success rate for moves

        if (success) {
            this.hasWatchedAdForMoves = true;
            if (this.currentScene instanceof GameScene) {
                this.currentScene.moves += 5;
                this.updateUI(this.currentScene.score, this.currentScene.moves, this.currentScene.goal, this.currentScene.starGoal);
                this.currentScene.isGameOver = false;
                this.currentScene.isProcessing = false;
            }
            
            this.toggleModal('fail-modal', false);
            this.showToast("AD COMPLETE! +5 MOVES GRANTED! 💎");
            soundManager.playSuccessFanfare();
        } else {
            this.showToast("Ad closed early.", true);
            soundManager.playError();
        }
    }

    createHeartParticleReward() {
        const source = document.getElementById('modal-lives-heart-icon');
        const target = document.querySelector('.crystal-frame-ui .hud-icon-lives');
        if (!source || !target) return;

        const sourceRect = source.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const count = 10;
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'reward-particle';
                particle.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
                particle.style.top = `${sourceRect.top + sourceRect.height / 2}px`;
                document.body.appendChild(particle);

                const anim = particle.animate([
                    { left: particle.style.left, top: particle.style.top, transform: 'scale(1)', opacity: 1 },
                    { left: `${targetRect.left + targetRect.width / 2}px`, top: `${targetRect.top + targetRect.height / 2}px`, transform: 'scale(0.5)', opacity: 0.8 }
                ], {
                    duration: 1000 + (Math.random() * 500),
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
                });

                anim.onfinish = () => {
                    particle.remove();
                    if (i === count - 1) {
                        const parent = target.parentElement;
                        parent.classList.add('heart-ui-glow');
                        setTimeout(() => parent.classList.remove('heart-ui-glow'), 1000);
                    }
                };
            }, i * 100);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const time = performance.now();

        // Update Life Timer in Modal
        const lifeCountdown = document.getElementById('life-countdown');
        if (lifeCountdown && lifeCountdown.offsetParent !== null) {
            const timeStr = progressManager.getTimeToNextLife();
            lifeCountdown.innerText = timeStr || "FULL";
        }

        // Update Ad Cooldowns
        const adCooldownStr = progressManager.getFormattedAdCooldown();
        
        // 1. Daily Login Modal Ad
        const dailyAdSublabel = document.getElementById('daily-ad-sublabel');
        const dailyAdButton = document.getElementById('daily-ad-button');
        if (dailyAdSublabel && dailyAdSublabel.offsetParent !== null) {
            if (adCooldownStr) {
                dailyAdSublabel.innerText = `Wait: ${adCooldownStr}`;
                dailyAdSublabel.style.color = '#ffcc00';
                if (dailyAdButton) dailyAdButton.style.opacity = '0.6';
            } else {
                dailyAdSublabel.innerText = "Watch to gain extra spirits";
                dailyAdSublabel.style.color = '';
                if (dailyAdButton) dailyAdButton.style.opacity = '1';
            }
        }

        // 2. Lives Modal Ad
        const livesModalAd = document.getElementById('ad-lives-btn'); 
        const livesModalAdAlt = document.getElementById('lives-modal-ad-btn');
        const updateAdBtn = (btn, defaultText) => {
            if (!btn || btn.offsetParent === null) return;
            const sublabel = btn.querySelector('.btn-sublabel') || btn.querySelector('.btn-sublabel-alt');
            if (adCooldownStr) {
                if (sublabel) sublabel.innerText = `COOLDOWN: ${adCooldownStr}`;
                btn.style.opacity = '0.6';
            } else {
                if (sublabel) sublabel.innerText = defaultText;
                btn.style.opacity = '1';
            }
        };

        updateAdBtn(livesModalAd, "WATCH AD FOR +5 SPIRITS");
        updateAdBtn(livesModalAdAlt, "WATCH AD FOR +5 SPIRITS");

        // 3. Rewards List Ad
        const rewardListAd = document.getElementById('reward-list-ad-item');
        if (rewardListAd && rewardListAd.offsetParent !== null) {
            const label = rewardListAd.lastElementChild;
            if (adCooldownStr) {
                label.innerText = adCooldownStr;
                rewardListAd.style.opacity = '0.5';
            } else {
                label.innerText = 'AD BONUS';
                rewardListAd.style.opacity = '1';
            }
        }

        if (this.currentScene) {
            this.currentScene.update(time);
            this.renderer.render(this.currentScene.scene, this.currentScene.camera);
        }
        if (this.transition && this.transition.isActive) {
            this.transition.update();
            this.transition.render();
        }
    }
}

new Game();