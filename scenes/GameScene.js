import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Crystal } from '../entities/Crystal.js';
import { GridSystem } from '../systems/GridSystem.js';
import { soundManager } from '../systems/SoundManager.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

import { analyticsManager } from '../systems/AnalyticsManager.js';

export class GameScene {
    constructor(levelData, onGameOver, updateUI, selectedBoosters = []) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 15;
        this.camera.position.y = 0;

        this.onGameOver = onGameOver;
        this.updateUI = updateUI;
        this.levelData = levelData;
        this.selectedBoosters = selectedBoosters;
        
        this.grid = new GridSystem(CONFIG.GRID_SIZE.rows, CONFIG.GRID_SIZE.cols, levelData.id);
        this.crystalGroup = new THREE.Group();
        this.scene.add(this.crystalGroup);
        
        this.particles = new ParticleSystem(this.scene);
        
        this.crystals = Array.from({ length: CONFIG.GRID_SIZE.rows }, () => Array(CONFIG.GRID_SIZE.cols).fill(null));
        
        this.setupLights();
        this.setupBackground();
        this.setupGridBackground();
        
        this.selectedCrystal = null;
        this.isProcessing = false;
        this.moves = levelData.moves;
        this.score = 0;
        this.goal = { ...levelData.goal }; 
        this.starGoal = levelData.starGoal || 0;
        this.stars = 0;
        this.shakeIntensity = 0;
        this.comboCount = 0;
        this.starMeter = 0;
        this.isGameOver = false;
        
        // Hint system state
        this.idleTime = 0;
        this.hintCrystals = [];
        this.HINT_THRESHOLD = 6000; // 6 seconds of idle time to show hint

        this.initBoard();
        this.applyStartBoosters();

        analyticsManager.trackLevelStart(levelData.id);
    }

    applyStartBoosters() {
        if (!this.selectedBoosters || this.selectedBoosters.length === 0) return;

        this.selectedBoosters.forEach(booster => {
            // Find a random valid position that isn't already a special or a hole
            const validPositions = [];
            for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
                for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                    if (!this.grid.holes[r][c] && !this.grid.specials[r][c]) {
                        validPositions.push({ r, c });
                    }
                }
            }

            if (validPositions.length > 0) {
                const pos = validPositions[Math.floor(Math.random() * validPositions.length)];
                let specialType;
                
                if (booster === 'shaker') specialType = CONFIG.SPECIALS.LINE_BLAST_H;
                else if (booster === 'bomb') specialType = CONFIG.SPECIALS.CRYSTAL_BOMB;
                else if (booster === 'prism') specialType = CONFIG.SPECIALS.RAINBOW_PEARL;

                if (specialType) {
                    this.grid.specials[pos.r][pos.c] = specialType;
                    const crystal = this.crystals[pos.r][pos.c];
                    if (crystal) {
                        crystal.specialType = specialType;
                        crystal.addSpecialVFX();
                    }
                }
            }
        });
        
        soundManager.playPowerUp();
        this.showFloatingText("BOOSTERS ACTIVE!", 0, 0, "#00ffff", true);
    }

    updateStarMeter(amount) {
        if (this.isProcessing && amount > 0 && this.starMeter >= CONFIG.STAR_METER_MAX) return; // Prevent double trigger
        
        this.starMeter = Math.min(CONFIG.STAR_METER_MAX, this.starMeter + amount);
        const fillEl = document.getElementById('star-meter-fill');
        if (fillEl) {
            const percent = (this.starMeter / CONFIG.STAR_METER_MAX) * 100;
            fillEl.style.width = `${percent}%`;
            
            if (this.starMeter >= CONFIG.STAR_METER_MAX) {
                fillEl.style.background = 'linear-gradient(90deg, #ffffff, #ff00ff, #ffffff)';
                fillEl.style.boxShadow = '0 0 20px #ffffff';
                this.triggerRainbowBlast();
            } else {
                fillEl.style.background = 'linear-gradient(90deg, #ffdd00, #ff00ff)';
                fillEl.style.boxShadow = '0 0 10px rgba(255, 221, 0, 0.5)';
            }
        }
    }

    async triggerRainbowBlast() {
        if (this.isProcessing) {
            // If already processing, wait a bit and check if we can trigger
            // (Actually we should only trigger when the board is stable or about to be matched)
            // But for "Rainbow Blast", we want it to feel like a reward.
        }

        this.starMeter = 0; // Reset
        const fillEl = document.getElementById('star-meter-fill');
        if (fillEl) fillEl.style.width = '0%';

        soundManager.playObstacleBreaker();
        this.showFloatingText("RAINBOW BLAST!", 0, 0, "#ffffff", true);
        this.triggerShake(1.2);
        this.triggerBoardFlash(0.6, '#ffffff');

        const toClear = [];
        for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                if (this.grid.grid[r][c] !== null) toClear.push([r, c]);
            }
        }

        // Sequential blast effect
        for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                const pos = this.getGridPosition(r, c);
                this.particles.createBurst(pos.x, pos.y, 0xffffff, 2, 0.1);
            }
            await new Promise(res => setTimeout(res, 50));
        }

        await this.handleMatches([toClear], [], true);
    }

    triggerGameOver(win) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        const bombExploded = this.grid.bombCounters.some(row => row.some(count => count === -1));
        this.onGameOver(win, this.score, bombExploded);
    }

    screenToWorld(selector) {
        const el = document.querySelector(selector);
        if (!el) return new THREE.Vector3(0, 0, 0);
        const rect = el.getBoundingClientRect();
        const x = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1;
        const y = -((rect.top + rect.height / 2) / window.innerHeight) * 2 + 1;
        const vector = new THREE.Vector3(x, y, 0.5);
        vector.unproject(this.camera);
        const dir = vector.sub(this.camera.position).normalize();
        const distance = -this.camera.position.z / dir.z;
        return this.camera.position.clone().add(dir.multiplyScalar(distance));
    }

    showFloatingText(text, x, y, color = '#00ffff', isSpecial = false) {
        const div = document.createElement('div');
        div.className = isSpecial ? 'floating-text special-combo' : 'floating-text';
        div.innerText = text;
        div.style.position = 'absolute';
        
        // Project 3D to 2D
        const vector = new THREE.Vector3(x, y, 0);
        vector.project(this.camera);
        const screenX = (vector.x + 1) * window.innerWidth / 2;
        const screenY = (-vector.y + 1) * window.innerHeight / 2;
        
        div.style.left = `${screenX}px`;
        div.style.top = `${screenY}px`;
        div.style.transform = 'translate(-50%, -50%)';
        div.style.pointerEvents = 'none';
        div.style.zIndex = '1000';
        div.style.color = color;
        div.style.fontSize = isSpecial ? '2.8em' : '2.2em';
        div.style.fontWeight = 'bold';
        div.style.textShadow = `0 0 15px ${color}, 2px 2px #000`;
        div.style.animation = 'combo-float 1.2s ease-out forwards';
        
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 1200);
    }

    showComboText(x, y) {
        const texts = ['NICE!', 'SPARKLING!', 'CRYSTAL CLEAR!', 'MAGICAL!', 'INCREDIBLE!', 'LEGENDARY!', 'UNSTOPPABLE!'];
        const text = texts[Math.min(this.comboCount - 1, texts.length - 1)];
        this.showFloatingText(text, x, y, this.comboCount > 3 ? '#ffaa00' : '#00ffff');
        this.updateComboUI(this.comboCount);
    }

    updateComboUI(multiplier) {
        const comboUI = document.getElementById('combo-ui');
        const comboMult = document.getElementById('combo-multiplier');
        if (!comboUI || !comboMult) return;

        if (multiplier > 1) {
            comboMult.innerText = `x${multiplier}`;
            comboUI.style.transform = 'translateX(-50%) scale(1)';
            comboUI.style.opacity = '1';
            
            // Add a small "pop" effect
            comboUI.classList.remove('combo-pulse');
            void comboUI.offsetWidth; // Trigger reflow
            comboUI.classList.add('combo-pulse');
        } else {
            comboUI.style.transform = 'translateX(-50%) scale(0)';
            comboUI.style.opacity = '0';
        }
    }

    showScorePopup(points, multiplier, x, y, color = '#ffffff') {
        const total = points * multiplier;
        const text = multiplier > 1 ? `+${points} x${multiplier}` : `+${points}`;
        this.showFloatingText(text, x, y, color, multiplier > 3);
    }

    triggerShake(intensity = 0.5) {
        this.shakeIntensity = intensity;
    }

    setupGridBackground() {
        const rows = CONFIG.GRID_SIZE.rows;
        const cols = CONFIG.GRID_SIZE.cols;
        const tileSize = CONFIG.TILE_SIZE;
        
        const gridBGGroup = new THREE.Group();
        gridBGGroup.position.z = -0.1; // Just behind the crystals
        this.scene.add(gridBGGroup);

        const tileGeo = new THREE.PlaneGeometry(tileSize * 0.95, tileSize * 0.95);
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (this.grid.holes[r][c]) continue;

                const opacity = this.levelData.id >= 77 ? 0.15 : 0.08;
                const tileMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: opacity,
                    side: THREE.DoubleSide,
                });

                const tile = new THREE.Mesh(tileGeo, tileMat);
                const x = (c - (cols - 1) / 2) * tileSize;
                const y = ((rows - 1) / 2 - r) * tileSize;
                tile.position.set(x, y, 0);
                gridBGGroup.add(tile);
                
                // For Level 77+, add a faint crystalline frame
                if (this.levelData.id >= 77) {
                    const edgeGeo = new THREE.EdgesGeometry(tileGeo);
                    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
                    const frame = new THREE.LineSegments(edgeGeo, edgeMat);
                    frame.position.copy(tile.position);
                    gridBGGroup.add(frame);
                }
            }
        }
    }

    setupLights() {
        // Shift to deep blue/purple ambient tones (image_67 style)
        const ambient = new THREE.AmbientLight(0x1a0a2e, 0.9);
        this.scene.add(ambient);

        const spot = new THREE.SpotLight(0x00ffff, 1.2);
        spot.position.set(5, 10, 15);
        spot.angle = Math.PI / 4;
        spot.penumbra = 0.5;
        this.scene.add(spot);

        // Rim lighting for crystalline refraction look
        const rimLight = new THREE.PointLight(0xff00ff, 0.8, 30);
        rimLight.position.set(-8, 5, 5);
        this.scene.add(rimLight);

        const fillLight = new THREE.PointLight(0x0088ff, 0.5, 20);
        fillLight.position.set(8, -5, 2);
        this.scene.add(fillLight);
    }

    setupBackground() {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        
        const bgAsset = 'assets/unified-crystal-garden-bg-saga.webp';
        
        loader.load(bgAsset, (texture) => {
            const aspect = texture.image.width / texture.image.height;
            const planeGeo = new THREE.PlaneGeometry(50 * aspect, 50);
            const planeMat = new THREE.MeshBasicMaterial({ 
                map: texture,
                fog: false,
                color: 0xcccccc 
            });
            this.bgPlane = new THREE.Mesh(planeGeo, planeMat);
            this.bgPlane.position.z = -7; 
            this.bgPlane.raycast = () => {}; 
            this.scene.add(this.bgPlane);
        });
        
        // Preserve and refine ambient shimmering sparkles
        const starGeo = new THREE.BufferGeometry();
        const starCount = 150;
        const posArr = new Float32Array(starCount * 3);
        const color = 0x000088; 
        for(let i=0; i < starCount * 3; i+=3) {
            posArr[i] = (Math.random() - 0.5) * 40;
            posArr[i+1] = (Math.random() - 0.5) * 40;
            posArr[i+2] = -3; 
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
        const starMat = new THREE.PointsMaterial({ 
            color: color, 
            size: 0.15, 
            transparent: true, 
            opacity: 0.7, 
            blending: THREE.AdditiveBlending 
        });
        this.ambientSparkles = new THREE.Points(starGeo, starMat);
        this.ambientSparkles.raycast = () => {}; // Do not block clicks
        this.scene.add(this.ambientSparkles);

        this.scene.fog = new THREE.Fog(0x0a1a2a, 20, 60);
    }

    initBoard() {
        this.grid.fillBoard(
            this.levelData.frostProb || 0, 
            this.levelData.stoneProb || 0, 
            this.levelData.vineProb || 0, 
            this.levelData.holes,
            this.levelData.allowedTypes
        ); 
        
        // Add Treasure Hunt Chests if event is active
        if (progressManager.progress.treasureHunt.active && Math.random() < 0.8) {
            const count = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const r = Math.floor(Math.random() * CONFIG.GRID_SIZE.rows);
                const c = Math.floor(Math.random() * CONFIG.GRID_SIZE.cols);
                if (!this.grid.holes[r][c] && !this.grid.stones[r][c] && !this.grid.frost[r][c]) {
                    this.grid.treasure[r][c] = true;
                }
            }
        }
        
        // Initial bomb setup from level data if any
        if (this.levelData.bombs) {
            this.levelData.bombs.forEach(b => {
                if (this.grid.isInBounds(b.r, b.c) && !this.grid.holes[b.r][b.c]) {
                    this.grid.specials[b.r][b.c] = CONFIG.SPECIALS.TIME_BOMB;
                    this.grid.bombCounters[b.r][b.c] = b.count || 5;
                }
            });
        }
        
        for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                if (this.grid.holes[r][c]) continue;
                
                const type = this.grid.grid[r][c];
                const special = this.grid.specials[r][c];
                const counter = this.grid.bombCounters[r][c];
                const crystal = this.spawnCrystal(type, r, c, special, counter);
                
                crystal.setObstacles(this.grid.frost[r][c], this.grid.stones[r][c], this.grid.vines[r][c], this.grid.treasure[r][c]);
            }
        }
    }

    spawnCrystal(type, r, c, specialType = null, bombCounter = 0) {
        const crystal = new Crystal(type, r, c, specialType, bombCounter);
        const x = (c - (CONFIG.GRID_SIZE.cols - 1) / 2) * CONFIG.TILE_SIZE;
        const y = ((CONFIG.GRID_SIZE.rows - 1) / 2 - r) * CONFIG.TILE_SIZE;
        crystal.position.set(x, y, 0);
        this.crystalGroup.add(crystal);
        
        // Synchronize with logic grid
        if (r >= 0 && r < CONFIG.GRID_SIZE.rows && c >= 0 && c < CONFIG.GRID_SIZE.cols) {
            this.crystals[r][c] = crystal;
        }
        
        return crystal;
    }

    handleInput(pointer, eventType) {
        if (this.isProcessing) return;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(pointer, this.camera);
        const intersects = raycaster.intersectObjects(this.crystalGroup.children, true);

        if (eventType === 'start') {
            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && !(obj instanceof Crystal)) obj = obj.parent;
                
                if (obj instanceof Crystal) {
                    this.selectedCrystal = obj;
                    obj.scale.set(1.2, 1.2, 1.2);
                    soundManager.playClink();
                }
            }
        } else if (eventType === 'move') {
            // Update hovered state for bananas (ID: 5)
            this.crystalGroup.children.forEach(c => {
                if (c instanceof Crystal && c.typeId === 5) {
                    c.isHovered = false;
                }
            });

            if (intersects.length > 0) {
                let obj = intersects[0].object;
                while (obj.parent && !(obj instanceof Crystal)) obj = obj.parent;
                if (obj instanceof Crystal && obj.typeId === 5) {
                    obj.isHovered = true;
                }

                if (this.selectedCrystal && obj instanceof Crystal && obj !== this.selectedCrystal) {
                    const r1 = this.selectedCrystal.gridPos.r;
                    const c1 = this.selectedCrystal.gridPos.c;
                    const r2 = obj.gridPos.r;
                    const c2 = obj.gridPos.c;

                    const isAdjacent = Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
                    if (isAdjacent && this.grid.canSwap(r1, c1, r2, c2)) {
                        this.trySwap(r1, c1, r2, c2);
                    }
                }
            }
            
            // Sparkle trails
            if (intersects.length > 0 && Math.random() < 0.4) {
                const intersect = intersects[0];
                this.particles.createSparkleTrail(intersect.point.x, intersect.point.y, 'emerald');
                this.particles.createSparkleTrail(intersect.point.x, intersect.point.y, 'sapphire');
            }
        } else if (eventType === 'end') {
            if (this.selectedCrystal) {
                this.selectedCrystal.scale.set(1, 1, 1);
                this.selectedCrystal = null;
            }
            // Clear all hovered states
            this.crystalGroup.children.forEach(c => {
                if (c instanceof Crystal) c.isHovered = false;
            });
        }
    }

    async trySwap(r1, c1, r2, c2) {
        this.isProcessing = true;
        this.comboCount = 0; // Reset combo for a new move
        try {
            if (this.selectedCrystal) this.selectedCrystal.scale.set(1, 1, 1);
            
            const crystal1 = this.crystals[r1][c1];
            const crystal2 = this.crystals[r2][c2];

            if (!crystal1 || !crystal2) return;

            // Combo check
            if (crystal1.specialType && crystal2.specialType) {
                await this.animateSwap(r1, c1, r2, c2);
                this.grid.swap(r1, c1, r2, c2);
                await this.handleSpecialCombo(r1, c1, r2, c2);
                this.moves--;
                await this.decrementBombCounters();
                this.updateUI(this.score, this.moves, this.goal, this.starGoal);
                return;
            }

            // Prism swap check
            if (crystal1.specialType === CONFIG.SPECIALS.RAINBOW_PEARL || crystal2.specialType === CONFIG.SPECIALS.RAINBOW_PEARL) {
                await this.animateSwap(r1, c1, r2, c2);
                this.grid.swap(r1, c1, r2, c2);
                const prism = crystal1.specialType === CONFIG.SPECIALS.RAINBOW_PEARL ? crystal1 : crystal2;
                const other = prism === crystal1 ? crystal2 : crystal1;
                await this.handlePrismSwap(prism, other);
                this.moves--;
                await this.decrementBombCounters();
                this.updateUI(this.score, this.moves, this.goal, this.starGoal);
                return;
            }

            await this.animateSwap(r1, c1, r2, c2);
            this.grid.swap(r1, c1, r2, c2);

            const swapTarget = { r: r2, c: c2 }; 
            const { matches, specials } = this.grid.checkAllMatches(swapTarget);
            if (matches.length > 0) {
                this.moves--;
                await this.handleMatches(matches, specials);
                await this.decrementBombCounters();
                this.updateUI(this.score, this.moves, this.goal, this.starGoal);
            } else {
                await this.animateSwap(r1, c1, r2, c2);
                this.grid.swap(r1, c1, r2, c2);
            }
        } catch (e) {
            console.error("Swap failed", e);
        } finally {
            this.selectedCrystal = null;
            this.isProcessing = false;
            
            // Check for bomb explosion game over
            const bombExploded = this.grid.bombCounters.some(row => row.some(count => count === -1));
            
            if (this.moves <= 0 || (this.goal.count <= 0 && this.starGoal <= 0) || bombExploded) {
                this.triggerGameOver((this.goal.count <= 0 && this.starGoal <= 0) && !bombExploded); 
            }
        }
    }

    async decrementBombCounters() {
        let anyExploded = false;
        for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                if (this.grid.specials[r][c] === CONFIG.SPECIALS.TIME_BOMB) {
                    this.grid.bombCounters[r][c]--;
                    const crystal = this.crystals[r][c];
                    if (crystal) {
                        crystal.bombCounter = this.grid.bombCounters[r][c];
                        crystal.createBombText();
                        
                        if (this.grid.bombCounters[r][c] <= 0) {
                            anyExploded = true;
                            this.grid.bombCounters[r][c] = -1; // Flag for explosion
                            this.particles.createMegaExplosion(crystal.position.x, crystal.position.y, 0xff0000);
                            soundManager.playResinShatter();
                        }
                    }
                }
            }
        }
        if (anyExploded) {
            this.triggerShake(1.0);
            await new Promise(r => setTimeout(r, 500));
        }
    }

    async handleSpecialCombo(r1, c1, r2, c2) {
        const s1 = this.grid.specials[r1][c1];
        const s2 = this.grid.specials[r2][c2];
        const toClear = new Set();
        const addToClear = (r, c) => {
            if (this.grid.isInBounds(r, c)) toClear.add(`${r}-${c}`);
        };

        const color = CONFIG.CRYSTAL_TYPES[this.grid.grid[r2][c2]]?.color || 0xffffff;

        // Prism + Prism
        if (s1 === CONFIG.SPECIALS.RAINBOW_PEARL && s2 === CONFIG.SPECIALS.RAINBOW_PEARL) {
            this.particles.createMegaExplosion(this.getGridPosition(r2, c2).x, this.getGridPosition(r2, c2).y, 0xffffff);
            for (let r = 0; r < this.grid.rows; r++) {
                for (let c = 0; c < this.grid.cols; c++) addToClear(r, c);
            }
        }
        // Prism + Line/Bomb
        else if (s1 === CONFIG.SPECIALS.RAINBOW_PEARL || s2 === CONFIG.SPECIALS.RAINBOW_PEARL) {
            const prismPos = s1 === CONFIG.SPECIALS.RAINBOW_PEARL ? { r: r1, c: c1 } : { r: r2, c: c2 };
            const otherPos = prismPos.r === r1 ? { r: r2, c: c2 } : { r: r1, c: c1 };
            const otherType = this.grid.grid[otherPos.r][otherPos.c];
            const otherSpecial = prismPos.r === r1 ? s2 : s1;

            this.particles.createPrismEffect(this.getGridPosition(prismPos.r, prismPos.c).x, this.getGridPosition(prismPos.r, prismPos.c).y, 0xffffff);
            
            // Turn all of otherType into otherSpecial
            for (let r = 0; r < this.grid.rows; r++) {
                for (let c = 0; c < this.grid.cols; c++) {
                    if (this.grid.grid[r][c] === otherType) {
                        this.grid.specials[r][c] = otherSpecial;
                        
                        // Transform visually
                        const oldCrystal = this.crystals[r][c];
                        if (oldCrystal) {
                            this.crystalGroup.remove(oldCrystal);
                            const newSpecial = this.spawnCrystal(otherType, r, c, otherSpecial);
                            this.animatePop(newSpecial);
                        }
                        
                        // Trigger it
                        this.addSpecialToClear({ r, c, type: otherType, specialType: otherSpecial }, addToClear);
                    }
                }
            }
            addToClear(prismPos.r, prismPos.c);
        }
        // Line + Line = Cross
        else if ((s1.startsWith('line') && s2.startsWith('line'))) {
            for (let i = 0; i < CONFIG.GRID_SIZE.cols; i++) addToClear(r2, i);
            for (let i = 0; i < CONFIG.GRID_SIZE.rows; i++) addToClear(i, c2);
        }
        // Bomb + Bomb = Mega Blast
        else if (s1 === CONFIG.SPECIALS.CRYSTAL_BOMB && s2 === CONFIG.SPECIALS.CRYSTAL_BOMB) {
            this.particles.createMegaExplosion(this.getGridPosition(r2, c2).x, this.getGridPosition(r2, c2).y, color);
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) addToClear(r2 + dr, c2 + dc);
            }
        }
        // Line + Bomb = Triple Cross
        else if ((s1.startsWith('line') && s2 === CONFIG.SPECIALS.CRYSTAL_BOMB) || (s2.startsWith('line') && s1 === CONFIG.SPECIALS.CRYSTAL_BOMB)) {
            for (let i = -1; i <= 1; i++) {
                for (let j = 0; j < CONFIG.GRID_SIZE.cols; j++) addToClear(r2 + i, j);
                for (let j = 0; j < CONFIG.GRID_SIZE.rows; j++) addToClear(j, c2 + i);
            }
        }

        await this.handleMatches(Array.from(toClear).map(s => [s.split('-').map(Number)]), [], true);
    }

    async handlePrismSwap(prism, other) {
        if (other.specialType) {
            await this.handleSpecialCombo(prism.gridPos.r, prism.gridPos.c, other.gridPos.r, other.gridPos.c);
            return;
        }

        const r = prism.gridPos.r;
        const c = prism.gridPos.c;
        const toClear = new Set();
        
        const addToClear = (tr, tc) => {
            if (this.grid.isInBounds(tr, tc)) toClear.add(`${tr}-${tc}`);
        };

        // Trigger the Cross Blast (Row + Column)
        this.addSpecialToClear({ r, c, type: prism.typeId, specialType: CONFIG.SPECIALS.RAINBOW_PEARL }, addToClear);

        // Wait a bit for the blast VFX
        await new Promise(res => setTimeout(res, 400));

        // Clear targets and the prism
        const clearList = Array.from(toClear).map(s => s.split('-').map(Number));
        await this.handleMatches([clearList], [], true);
    }

    async animateSwap(r1, c1, r2, c2) {
        const crystal1 = this.crystals[r1][c1];
        const crystal2 = this.crystals[r2][c2];

        const p1 = crystal1.position.clone();
        const p2 = crystal2.position.clone();

        // Level 77+ gets faster swap for "fluid odyssey"
        const duration = this.levelData.id >= 77 ? 150 : 200;

        return new Promise(resolve => {
            let start = null;
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                crystal1.position.lerpVectors(p1, p2, progress);
                crystal2.position.lerpVectors(p2, p1, progress);

                // Add magical sparkle trails during swap
                if (progress < 1) {
                    const sparkType = this.levelData.id >= 77 ? 'emerald' : 'sapphire';
                    this.particles.createSparkleTrail(crystal1.position.x, crystal1.position.y, sparkType);
                    this.particles.createSparkleTrail(crystal2.position.x, crystal2.position.y, sparkType);
                }

                if (progress < 1) requestAnimationFrame(step);
                else {
                    this.crystals[r1][c1] = crystal2;
                    this.crystals[r2][c2] = crystal1;
                    crystal1.gridPos = { r: r2, c: c2 };
                    crystal2.gridPos = { r: r1, c: c1 };
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    async handleMatches(matches, specials, isPowerUp = false) {
        this.comboCount++;
        let allMatchedCores = matches.flat();
        let toClear = new Set();
        let checkedForSpecials = new Set();
        
        // Show combo text for cascades
        if (this.comboCount > 1 && allMatchedCores.length > 0) {
            const firstMatch = allMatchedCores[0];
            const pos = this.getGridPosition(firstMatch[0], firstMatch[1]);
            this.showComboText(pos.x, pos.y);
            soundManager.playPop(); 
        }

        const addToClear = (r, c) => {
            const key = `${r}-${c}`;
            if (toClear.has(key)) return;
            toClear.add(key);

            if (this.grid.specials[r][c] && !checkedForSpecials.has(key)) {
                checkedForSpecials.add(key);
                this.addSpecialToClear({ r, c, type: this.grid.grid[r][c], specialType: this.grid.specials[r][c] }, addToClear);
            }
        };

        allMatchedCores.forEach(([r, c]) => addToClear(r, c));
        
        const finalMatchesToProcess = [Array.from(toClear).map(s => s.split('-').map(Number))];
        const clearedObstacles = this.grid.removeMatches(finalMatchesToProcess, isPowerUp || checkedForSpecials.size > 0);
        
        const scoreTarget = this.screenToWorld('#score');
        const goalTarget = this.screenToWorld('.goal-display');
        const starGoalTarget = this.screenToWorld('#star-goal');

        // Handle cleared obstacles VFX
        if (clearedObstacles.length >= 5) {
            const firstObs = clearedObstacles[0];
            const pos = this.getGridPosition(firstObs.r, firstObs.c);
            this.showFloatingText("OBSTACLE BREAKER!", pos.x, pos.y, "#ffcc00", true);
            this.triggerShake(0.6);
            this.particles.createMegaExplosion(pos.x, pos.y, 0xffcc00);
            soundManager.playObstacleBreaker();
        }

        clearedObstacles.forEach(obs => {
            const pos = this.getGridPosition(obs.r, obs.c);
            const crystal = this.crystals[obs.r][obs.c];
            if (crystal) crystal.setObstacles(this.grid.frost[obs.r][obs.c], this.grid.stones[obs.r][obs.c], this.grid.vines[obs.r][obs.c]);
            
            if (obs.type === CONFIG.OBSTACLES.FROST) {
                this.particles.createBurst(pos.x, pos.y, 0xffffff, 5);
                soundManager.playClink();
            } else if (obs.type === CONFIG.OBSTACLES.STONE) {
                this.particles.createBurst(pos.x, pos.y, 0xaaaaaa, 10);
                soundManager.playResinShatter();
            } else if (obs.type === CONFIG.OBSTACLES.VINES) {
                this.particles.createBurst(pos.x, pos.y, 0x228822, 10);
                soundManager.playPop();
            } else if (obs.type === CONFIG.OBSTACLES.TREASURE) {
                this.handleTreasureCollection(obs.r, obs.c);
            }
        });

        const finalToClear = finalMatchesToProcess[0];

        // Apply combo multiplier to scoring
        const multiplier = Math.max(1, this.comboCount);
        let matchPoints = 0;
        let lastMatchPos = { x: 0, y: 0 };

        for (const [r, c] of finalToClear) {
            const crystal = this.crystals[r][c];
            // Only destroy if it was actually cleared in the logic grid
            if (crystal && this.grid.grid[r][c] === null) {
                const isBecomingSpecial = specials.some(s => s.r === r && s.c === c);
                if (isBecomingSpecial && !checkedForSpecials.has(`${r}-${c}`)) continue; 

                lastMatchPos = { x: crystal.position.x, y: crystal.position.y };

                // Special "Sparkling Shatter" for Crystal Banana (ID: 5)
                if (crystal.typeId === 5) {
                    crystal.isCollecting = true;
                    this.particles.createSparklingShatter(crystal.position.x, crystal.position.y, crystal.config.color);
                    this.triggerShake(0.12); // Slightly more feedback for bananas
                    soundManager.playMagicChime();
                    // Small delay to see the pulse before destruction
                    await new Promise(res => setTimeout(res, 100));
                } else if (crystal.typeId === 6) {
                    // Unique particle explosion for Crystal Pineapple (ID: 6)
                    this.particles.createPineappleExplosion(crystal.position.x, crystal.position.y);
                    this.triggerShake(0.2); // Powerful feedback for pineapples
                    this.showFloatingText("PINEAPPLE BONUS!", crystal.position.x, crystal.position.y + 0.5, "#ffaa00", true);
                    this.showScorePopup(250, multiplier, crystal.position.x, crystal.position.y, '#ffffff');
                    soundManager.playSpecial();
                    soundManager.playClink();
                    this.score += 250 * multiplier;
                    matchPoints += 250;
                } else {
                    // Add intense sparkle and shatter VFX for normal matches
                    this.particles.createBurst(crystal.position.x, crystal.position.y, crystal.config.color, 12, 0.2);
                    this.particles.createBombEffect(crystal.position.x, crystal.position.y, crystal.config.color);
                }

                if (crystal.typeId === this.goal.type) {
                    this.goal.count = Math.max(0, this.goal.count - 1);
                    this.particles.createShatterToTarget(crystal.position.x, crystal.position.y, goalTarget, crystal.config.color, true);
                    if (this.goal.count <= 0 && this.starGoal <= 0) {
                        this.updateUI(this.score, this.moves, this.goal, this.starGoal);
                        setTimeout(() => this.triggerGameOver(true), 800);
                        return;
                    }
                } else if (crystal.typeId === CONFIG.FRUIT_TYPE) {
                    this.starGoal = Math.max(0, this.starGoal - 1);
                    this.particles.createShatterToTarget(crystal.position.x, crystal.position.y, starGoalTarget, 0xffdd00, true);
                    this.particles.createStarExplosion(crystal.position.x, crystal.position.y);
                    this.triggerBoardFlash(0.2, '#ffdd00');
                    this.score += 100 * multiplier;
                    matchPoints += 100;
                    soundManager.playSpecial();
                } else {
                    this.particles.createShatterToTarget(crystal.position.x, crystal.position.y, scoreTarget, crystal.config.color, false);
                }
                
                this.score += 10 * multiplier;
                matchPoints += 10;
                if (crystal.typeId !== CONFIG.FRUIT_TYPE) {
                    this.updateStarMeter(1);
                }

                crystal.destroy();
                this.crystals[r][c] = null;
            } else if (crystal) {
                // Crystal wasn't cleared because it was blocked by vines/frost, update its visual state
                crystal.setObstacles(this.grid.frost[r][c], this.grid.stones[r][c], this.grid.vines[r][c]);
            }
        }

        if (matchPoints > 0) {
            const displayColor = this.comboCount > 3 ? '#ffcc00' : '#ffffff';
            this.showScorePopup(matchPoints, multiplier, lastMatchPos.x, lastMatchPos.y, displayColor);
        }

        if (specials.length > 0) {
            const mergePromises = specials.map(async (s) => {
                const targetPos = this.getGridPosition(s.r, s.c);
                const relatedMatches = matches.find(m => m.some(([mr, mc]) => mr === s.r && mc === s.c)) || [];
                
                const animations = relatedMatches.map(mPos => {
                    const crystal = this.crystals[mPos[0]][mPos[1]];
                    if (!crystal) return Promise.resolve();
                    
                    if (Math.random() < 0.5) this.particles.createGatheringEffect(crystal.position.x, crystal.position.y, targetPos.x, targetPos.y, crystal.config.color);
                    
                    if (mPos[0] === s.r && mPos[1] === s.c) return Promise.resolve();
                    return this.animateMerge(crystal, targetPos);
                });
                await Promise.all(animations);
            });
            await Promise.all(mergePromises);
        }

        specials.forEach(s => {
            const existing = this.crystals[s.r][s.c];
            if (existing) {
                this.crystalGroup.remove(existing);
                this.crystals[s.r][s.c] = null;
            }
            this.grid.grid[s.r][s.c] = s.type;
            this.grid.specials[s.r][s.c] = s.specialType;
            const newCrystal = this.spawnCrystal(s.type, s.r, s.c, s.specialType);
            
            newCrystal.scale.set(0, 0, 0);
            this.animatePop(newCrystal);
            soundManager.playPowerUp();
            this.particles.createBurst(newCrystal.position.x, newCrystal.position.y, 0xffffff, 8, 0.2);
        });
        
        if (specials.length > 0 || checkedForSpecials.size > 0) {
            soundManager.playBoosterExplosion();
            this.triggerShake(specials.length * 0.15 + checkedForSpecials.size * 0.1 + 0.3);
            this.triggerBoardFlash(0.4); 
        } else if (finalToClear.length > 0) {
            soundManager.playMatch(this.comboCount); 
            this.triggerShake(0.08); 
            this.triggerBoardFlash(0.1); 
        }

        await this.applyGravity();
        await this.collectFruits();

        const result = this.grid.checkAllMatches();
        if (result.matches.length > 0) {
            await this.handleMatches(result.matches, result.specials);
        } else {
            this.updateComboUI(0); // Hide combo UI when cascade ends
            if (!this.grid.hasAvailableMatches()) {
                await this.triggerReshuffle();
            }
        }
    }

    async triggerReshuffle() {
        this.isProcessing = true;
        
        // Reshuffle UI animation: sparklers and board shake
        this.triggerShake(0.6);
        this.showFloatingText("NO MATCHES! SHUFFLING...", 0, 0, "#00ffff", true);
        
        this.crystalGroup.children.forEach(c => {
            if (c instanceof Crystal) {
                this.particles.createSparkleTrail(c.position.x, c.position.y, 'emerald');
                this.particles.createSparkleTrail(c.position.x, c.position.y, 'sapphire');
            }
        });
        soundManager.playMagicChime();
        
        await new Promise(r => setTimeout(r, 1200));
        
        this.grid.reshuffle();
        
        // Update crystal visual types and specials
        for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) {
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
                const crystal = this.crystals[r][c];
                if (crystal && !this.grid.holes[r][c]) {
                    const type = this.grid.grid[r][c];
                    const special = this.grid.specials[r][c];
                    const bomb = this.grid.bombCounters[r][c];
                    
                    // Full visual update for each piece
                    crystal.updateType(type);
                    crystal.specialType = special;
                    crystal.bombCounter = bomb;
                    
                    // Re-add VFX if it was a special
                    if (crystal.specialVFX) crystal.remove(crystal.specialVFX);
                    if (crystal.specialLight) crystal.remove(crystal.specialLight);
                    if (crystal.bombTextSprite) crystal.remove(crystal.bombTextSprite);
                    
                    if (special) crystal.addSpecialVFX();
                    if (bomb > 0) crystal.createBombText();
                    
                    this.animatePop(crystal);
                }
            }
        }
        
        this.isProcessing = false;
    }

    animateMerge(crystal, targetPos) {
        const startPos = crystal.position.clone();
        return new Promise(resolve => {
            let start = null;
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / 200, 1);
                crystal.position.lerpVectors(startPos, targetPos, progress);
                crystal.scale.setScalar(1 - progress);
                if (progress < 1) requestAnimationFrame(step);
                else resolve();
            };
            requestAnimationFrame(step);
        });
    }

    animatePop(crystal) {
        let start = null;
        const duration = 400;
        const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            
            // Elastic overshoot effect
            let s;
            if (progress < 0.3) {
                s = (progress / 0.3) * 1.4; // Fast swell
            } else if (progress < 0.6) {
                s = 1.4 - ((progress - 0.3) / 0.3) * 0.5; // Snap back
            } else {
                s = 0.9 + ((progress - 0.6) / 0.4) * 0.1; // Settle to 1.0
            }
            
            crystal.scale.setScalar(s);
            if (progress < 1) requestAnimationFrame(step);
            else crystal.scale.setScalar(1);
        };
        requestAnimationFrame(step);
    }

    triggerBoardFlash(intensity = 0.3, color = 'white') {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = color;
        overlay.style.opacity = intensity.toString();
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1000';
        document.body.appendChild(overlay);

        let opacity = intensity;
        const fade = () => {
            opacity -= 0.05;
            overlay.style.opacity = opacity.toString();
            if (opacity > 0) requestAnimationFrame(fade);
            else overlay.remove();
        };
        requestAnimationFrame(fade);
    }

    getGridPosition(r, c) {
        const x = (c - (CONFIG.GRID_SIZE.cols - 1) / 2) * CONFIG.TILE_SIZE;
        const y = ((CONFIG.GRID_SIZE.rows - 1) / 2 - r) * CONFIG.TILE_SIZE;
        return new THREE.Vector3(x, y, 0);
    }

    addSpecialToClear(s, addToClear) {
        const pos = this.getGridPosition(s.r, s.c);
        const color = CONFIG.CRYSTAL_TYPES.find(t => t.id === s.type)?.color || 0xffffff;

        if (s.specialType === CONFIG.SPECIALS.LINE_BLAST_H) {
            this.particles.createLineEffect(pos.x, pos.y, true, color);
            soundManager.playLaserZap();
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) addToClear(s.r, c);
        } else if (s.specialType === CONFIG.SPECIALS.LINE_BLAST_V) {
            this.particles.createLineEffect(pos.x, pos.y, false, color);
            soundManager.playLaserZap();
            for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) addToClear(r, s.c);
        } else if (s.specialType === CONFIG.SPECIALS.CRYSTAL_BOMB) {
            this.particles.createBombEffect(pos.x, pos.y, color);
            soundManager.playCrystalBlast();
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (this.grid.isInBounds(s.r + dr, s.c + dc)) addToClear(s.r + dr, s.c + dc);
                }
            }
        } else if (s.specialType === CONFIG.SPECIALS.RAINBOW_PEARL) {
            // Rare 'Rainbow Pearl' clears an entire row AND column (Cross Blast)
            this.particles.createPrismEffect(pos.x, pos.y, 0xffffff);
            this.particles.createLineEffect(pos.x, pos.y, true, 0xffffff);
            this.particles.createLineEffect(pos.x, pos.y, false, 0xffffff);
            soundManager.playSpecial();
            soundManager.playLaserZap();
            
            // Add Row
            for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) addToClear(s.r, c);
            // Add Column
            for (let r = 0; r < CONFIG.GRID_SIZE.rows; r++) addToClear(r, s.c);
            
            this.triggerShake(0.5);
            this.triggerBoardFlash(0.3, '#ffffff');
        }
    }

    async collectFruits() {
        const r = CONFIG.GRID_SIZE.rows - 1;
        const starGoalTarget = this.screenToWorld('#star-goal');
        const scoreTarget = this.screenToWorld('#score');
        
        let collected = false;
        for (let c = 0; c < CONFIG.GRID_SIZE.cols; c++) {
            const crystal = this.crystals[r][c];
            if (crystal && crystal.typeId === CONFIG.FRUIT_TYPE) {
                collected = true;
                this.score += 100;
                
                if (this.starGoal > 0) {
                    this.starGoal = Math.max(0, this.starGoal - 1);
                    this.particles.createShatterToTarget(crystal.position.x, crystal.position.y, starGoalTarget, 0xffdd00, true);
                } else {
                    this.particles.createShatterToTarget(crystal.position.x, crystal.position.y, scoreTarget, 0xffdd00, false);
                }
                
                // Simplified Star VFX as requested
                this.particles.createStarExplosion(crystal.position.x, crystal.position.y);
                this.triggerBoardFlash(0.2, '#ffdd00'); // Yellow Glow flash
                crystal.destroy(); // Instant memory cleanup
                this.crystals[r][c] = null;
                this.grid.grid[r][c] = null;
                soundManager.playSpecial();
            }
        }
        
        if (collected) {
            this.updateUI(this.score, this.moves, this.goal, this.starGoal);
            await this.applyGravity();
            
            // Check win condition after collecting
            if (this.goal.count <= 0 && this.starGoal <= 0) {
                setTimeout(() => this.triggerGameOver(true), 1000);
            }
        }
    }

    async handleTreasureCollection(r, c) {
        const pos = this.getGridPosition(r, c);
        const eventBtnTarget = this.screenToWorld('#event-button');
        
        soundManager.playSpecial();
        this.particles.createMegaExplosion(pos.x, pos.y, 0xffaa00);
        this.particles.createShatterToTarget(pos.x, pos.y, eventBtnTarget, 0xffaa00, true);
        this.showFloatingText("TREASURE FOUND!", pos.x, pos.y, "#ffaa00", true);
        
        progressManager.collectTreasure(1);
    }

    async applyGravity() {
        const movements = this.grid.applyGravity(this.levelData.fruitProb);
        const animations = [];

        movements.forEach(m => {
            if (m.isNew) {
                const crystal = this.spawnCrystal(m.type, m.from[0], m.to[1], m.specialType, m.bombCounter);
                // Obstacles don't typically spawn on new falling pieces in this logic, 
                // but let's be safe if the grid system ever supports it.
                crystal.setObstacles(this.grid.frost[m.to[0]][m.to[1]], this.grid.stones[m.to[0]][m.to[1]], this.grid.vines[m.to[0]][m.to[1]]);
                animations.push(this.animateFall(crystal, m.to[0]));
            } else {
                const crystal = this.crystals[m.from[0]][m.from[1]];
                if (crystal) {
                    this.crystals[m.from[0]][m.from[1]] = null;
                    animations.push(this.animateFall(crystal, m.to[0]));
                }
            }
        });

        await Promise.all(animations);
    }

    animateFall(crystal, targetR) {
        if (!crystal) return Promise.resolve();
        const targetY = ((CONFIG.GRID_SIZE.rows - 1) / 2 - targetR) * CONFIG.TILE_SIZE;
        const startY = crystal.position.y;
        
        // Level 77+ gets faster fall for more "satisfying" pace
        const duration = this.levelData.id >= 77 ? 220 : 300;

        return new Promise(resolve => {
            let start = null;
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = Math.min((timestamp - start) / duration, 1);
                crystal.position.y = startY + (targetY - startY) * progress;
                if (progress < 1) requestAnimationFrame(step);
                else {
                    crystal.gridPos.r = targetR;
                    this.crystals[targetR][crystal.gridPos.c] = crystal;
                    resolve();
                }
            };
            requestAnimationFrame(step);
        });
    }

    update(time) {
        this.particles.update();
        
        // Handle screen shake
        if (this.shakeIntensity > 0) {
            this.camera.position.x = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
            if (this.shakeIntensity < 0.01) {
                this.shakeIntensity = 0;
                this.camera.position.set(0, 0, 15);
            }
        }

        // Idle hint system
        if (!this.isProcessing && !this.selectedCrystal && !this.isGameOver) {
            this.idleTime += 16; // Approx 60fps
            if (this.idleTime > this.HINT_THRESHOLD && this.hintCrystals.length === 0) {
                this.showHint();
            }
        } else {
            this.clearHint();
            this.idleTime = 0;
        }

        // Subtle background movement
        if (this.bgPlane) {
            const t = Date.now() * 0.0005;
            this.bgPlane.position.x = Math.sin(t) * 0.5;
            this.bgPlane.position.y = Math.cos(t * 0.8) * 0.3;
        }

        if (this.ambientSparkles) {
            const t = Date.now() * 0.001;
            this.ambientSparkles.material.opacity = 0.3 + Math.sin(t) * 0.2;
            this.ambientSparkles.position.y = Math.sin(t * 0.2) * 0.5;
        }

        this.crystalGroup.children.forEach(c => {
            if (c instanceof Crystal) {
                c.update(time);
                // Pulse effect for hints
                if (this.hintCrystals.includes(c)) {
                    const pulse = 1.0 + Math.sin(Date.now() * 0.01) * 0.15;
                    c.scale.set(pulse, pulse, pulse);
                }
            }
        });
    }

    showHint() {
        const match = this.grid.findAvailableMatch();
        if (match) {
            const c1 = this.crystals[match.r1][match.c1];
            const c2 = this.crystals[match.r2][match.c2];
            if (c1 && c2) {
                this.hintCrystals = [c1, c2];
            }
        }
    }

    clearHint() {
        if (this.hintCrystals.length > 0) {
            this.hintCrystals.forEach(c => {
                if (c && c.scale) c.scale.set(1, 1, 1);
            });
            this.hintCrystals = [];
        }
    }
}
