import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { getLevelData } from '../config/LevelData.js';
import { progressManager } from '../systems/ProgressManager.js';
import { soundManager } from '../systems/SoundManager.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';

export class MapScene {
    constructor(onLevelSelect, justUnlockedLevel = null) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        const unlockedLevel = progressManager.getUnlockedLevel();
        const currentLevel = justUnlockedLevel ? justUnlockedLevel - 1 : unlockedLevel;
        const startY = (currentLevel - 1) * 14 - 15;
        this.camera.position.set(0, startY, 35);
        
        this.onLevelSelect = onLevelSelect;
        this.levelNodes = [];
        this.levelGroups = []; 
        this.beacons = [];
        this.labels = [];
        this.targetCameraY = startY;
        
        // Particle System
        this.particleSystem = new ParticleSystem(this.scene);
        
        // Interaction
        this.raycaster = new THREE.Raycaster();
        this.isDragging = false;
        this.lastPointerY = 0;
        this.dragVelocity = 0;
        this.dragThreshold = 0.05;
        this.totalDragDist = 0;
        
        // Transition state
        this.isTransitioning = false;
        this.isLaunching = false;

        // Visual level state
        this.visualLevel = currentLevel;
        
        this.setupBackground();
        this.createSagaPath();

        if (justUnlockedLevel) {
            setTimeout(() => this.triggerLevelProgressAnimation(justUnlockedLevel), 1000);
        }
    }

    getBiome(levelId) {
        if (levelId >= 76) return 'celestial';
        if (levelId >= 51) return 'archipelago';
        if (levelId >= 26) return 'caves';
        return 'forest';
    }

    triggerLevelProgressAnimation(targetLevel) {
        // Smoothly move pineapple from Node (target-1) to Node target
        const startPos = this.pathPoints[targetLevel - 2];
        const endPos = this.pathPoints[targetLevel - 1];
        if (!startPos || !endPos) return;

        soundManager.playBloopZip();
        
        const start = Date.now();
        const duration = 2000;
        
        const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress * (2 - progress); // Ease out
            
            const currentPos = new THREE.Vector3().lerpVectors(startPos, endPos, ease);
            this.playerMarker.position.copy(currentPos);
            this.playerMarker.position.z += 2;
            
            // Visual FX during move: cartoon trails, gold sparkles, music notes
            this.particleSystem.createCartoonTrail(currentPos.x, currentPos.y, currentPos.z);
            
            this.visualLevel = targetLevel - 1 + progress;
            this.targetCameraY = currentPos.y;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.visualLevel = targetLevel;
                soundManager.playSuccessFanfare();
            }
        };
        animate();
    }

    onScroll(delta) {
        if (this.isTransitioning) return;
        this.dragVelocity += delta * 0.02;
    }

    handleInput(pointer, type) {
        if (this.isTransitioning) return;
        if (type === 'start') {
            this.isDragging = true;
            this.lastPointerY = pointer.y;
            this.totalDragDist = 0;
        } else if (type === 'move') {
            if (this.isDragging) {
                const dy = pointer.y - this.lastPointerY;
                this.targetCameraY -= dy * 80;
                this.dragVelocity = -dy * 20;
                this.lastPointerY = pointer.y;
                this.totalDragDist += Math.abs(dy);
            }
        } else if (type === 'end') {
            if (this.isDragging) {
                this.isDragging = false;
                if (this.totalDragDist < this.dragThreshold) {
                    this.checkNodeClick(pointer);
                }
            }
        }
    }

    checkNodeClick(pointer) {
        this.raycaster.setFromCamera(pointer, this.camera);
        const intersects = this.raycaster.intersectObjects(this.levelNodes);
        if (intersects.length > 0) {
            const node = intersects[0].object;
            const { levelIndex } = node.userData;
            if (progressManager.isUnlocked(levelIndex)) {
                soundManager.playClink();
                this.onLevelSelect(levelIndex);
            }
        }
    }

    triggerLaunchAnimation(levelIndex, callback) {
        this.isTransitioning = true;
        this.isLaunching = true;
        soundManager.playLevelStart();
        const start = Date.now();
        const duration = 800;
        const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const ease = progress * progress * progress;
            this.camera.position.z = 35 - (ease * 25); 
            if (progress < 1) requestAnimationFrame(animate);
            else callback();
        };
        animate();
    }

    setupBackground() {
        const loader = new THREE.TextureLoader();
        loader.setCrossOrigin('anonymous');
        this.bgGroup = new THREE.Group();
        this.scene.add(this.bgGroup);
        
        const totalHeight = 1500; 
        
        loader.load('assets/luxury-crystal-seascape-map-bg-webp.webp', (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 15);
            const planeGeo = new THREE.PlaneGeometry(160, totalHeight);
            const planeMat = new THREE.MeshBasicMaterial({ map: texture });
            const plane = new THREE.Mesh(planeGeo, planeMat);
            plane.position.set(0, totalHeight / 2 - 100, -2); 
            this.bgGroup.add(plane);
        });

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        this.scene.fog = new THREE.FogExp2(0x0d0415, 0.001);
    }

    createSagaPath() {
        const totalLevels = 100;
        const pathGroup = new THREE.Group();
        this.scene.add(pathGroup);
        this.pathPoints = [];
        
        const loader = new THREE.TextureLoader();
        loader.load('assets/rhombus-crystal-node.webp', (nodeTex) => {
            loader.load('assets/golden-halo-glow.webp', (haloTex) => {
                loader.load('assets/map-lock-icon.webp', (lockTex) => {
                    for (let i = 0; i < totalLevels; i++) {
                        const levelId = i + 1;
                        const isUnlocked = progressManager.isUnlocked(levelId);
                        const unlockedLevel = progressManager.getUnlockedLevel();
                        const isTarget = levelId === unlockedLevel;
                        
                        // Verticalized path: extremely subtle variation for natural growth but following image_76 verticality
                        const x = Math.sin(i * 0.1) * 1.5; 
                        const y = i * 14 - 15;
                        const pos = new THREE.Vector3(x, y, 0);
                        this.pathPoints.push(pos);
                        
                        const nodeGroup = new THREE.Group();
                        nodeGroup.position.set(pos.x, pos.y, pos.z + 1.5);
                        nodeGroup.userData = { levelIndex: levelId };
                        pathGroup.add(nodeGroup);
                        this.levelGroups.push(nodeGroup);

                        // Is this a boss/guardian node? (50, 100 or Node 18 as requested)
                        const isBoss = levelId % 50 === 0 || levelId === 18;
                        const nodeScale = isBoss ? 10 : 6;

                        // Crystalline Rhombus Gem Node
                        const nodeMat = new THREE.SpriteMaterial({ 
                            map: nodeTex, 
                            transparent: true,
                            opacity: isUnlocked ? 1.0 : 0.6,
                            color: isUnlocked ? (isBoss ? 0xffaa00 : 0xffffff) : 0x555555
                        });
                        const nodeSprite = new THREE.Sprite(nodeMat);
                        nodeSprite.scale.set(nodeScale, nodeScale, 1);
                        nodeGroup.add(nodeSprite);

                        if (!isUnlocked) {
                            // Lock icon for locked levels
                            const lockMat = new THREE.SpriteMaterial({ map: lockTex, transparent: true });
                            const lockSprite = new THREE.Sprite(lockMat);
                            lockSprite.scale.set(3, 4, 1);
                            lockSprite.position.z = 0.5;
                            nodeGroup.add(lockSprite);
                        } else if (isTarget || (levelId === 18 && isUnlocked)) {
                            // Dynamic Golden Halo for active level or Level 18 landmark
                            const haloMat = new THREE.SpriteMaterial({ 
                                map: haloTex, 
                                transparent: true, 
                                blending: THREE.AdditiveBlending,
                                color: levelId === 18 ? 0xffcc00 : 0xffffff
                            });
                            const halo = new THREE.Sprite(haloMat);
                            const haloScale = levelId === 18 ? 16 : 12;
                            halo.scale.set(haloScale, haloScale, 1);
                            nodeGroup.add(halo);
                            this.beacons.push({ mesh: halo, index: i });
                        }

                        const hitMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ visible: false }));
                        hitMesh.userData = nodeGroup.userData;
                        nodeGroup.add(hitMesh);
                        this.levelNodes.push(hitMesh);
                        
                        this.createLayeredLabel(levelId, pos, i, isUnlocked);
                    }

                    this.curve = new THREE.CatmullRomCurve3(this.pathPoints);
                    this.setupPathVisuals();
                    this.createPlayerMarker(this.pathPoints[Math.floor(this.visualLevel-1)], Math.floor(this.visualLevel-1));
                });
            });
        });
    }

    setupPathVisuals() {
        // Continuous Thin Branch with Gold/Crystal Veins
        const pathTubeGeo = new THREE.TubeGeometry(this.curve, 800, 0.35, 12, false);
        
        const loader = new THREE.TextureLoader();
        loader.load('assets/crystalline-branch-segment.webp', (tex) => {
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(100, 1);
            
            const biome = this.getBiome(progressManager.getUnlockedLevel());
            let emissiveColor = 0x00ffff;
            if (biome === 'caves') emissiveColor = 0x00ff00;
            if (biome === 'archipelago') emissiveColor = 0x0088ff;
            if (biome === 'celestial') emissiveColor = 0xff00ff;

            this.basePathMaterial = new THREE.MeshStandardMaterial({
                map: tex,
                transparent: true,
                metalness: 0.8,
                roughness: 0.2,
                emissive: emissiveColor,
                emissiveIntensity: 0.2
            });

            this.basePathMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = { value: 0 };
                shader.fragmentShader = `uniform float uTime;\n` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    `
                    #include <map_fragment>
                    float noise = sin(vMapUv.x * 20.0 + uTime * 2.0) * 0.5 + 0.5;
                    diffuseColor.rgb += vec3(0.0, 0.5, 0.5) * noise * 0.3;
                    `
                );
                this.basePathMaterial.userData.shader = shader;
            };
            
            this.branch = new THREE.Mesh(pathTubeGeo, this.basePathMaterial);
            this.branch.position.z = 0.5;
            this.scene.add(this.branch);
        });
    }

    createLayeredLabel(num, pos, index, isUnlocked) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 70px Fredoka One, Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isUnlocked ? 'white' : '#777777';
        ctx.strokeStyle = isUnlocked ? '#2a0845' : '#333333';
        ctx.lineWidth = 6;
        
        if (isUnlocked) {
            ctx.strokeText(num, 64, 64);
            ctx.fillText(num, 64, 64);
        } else {
            // Smaller text for locked
            ctx.font = 'bold 40px Fredoka One, Arial';
            ctx.fillText(num, 64, 94); // Position below lock
        }

        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
        sprite.position.set(pos.x, pos.y, pos.z + 2.5); 
        sprite.scale.set(4, 4, 1);
        sprite.userData = { baseY: pos.y, index };
        this.labels.push(sprite);
        this.scene.add(sprite);
    }

    refreshVisuals() {
        // Refresh path
        if (this.branch) {
            this.scene.remove(this.branch);
        }
        this.setupPathVisuals();

        // Refresh player
        if (this.playerMarker) {
            this.scene.remove(this.playerMarker);
        }
        const currentPos = this.pathPoints[Math.floor(this.visualLevel - 1)];
        this.createPlayerMarker(currentPos, Math.floor(this.visualLevel - 1));
    }

    createPlayerMarker(pos, index) {
        const markerGroup = new THREE.Group();
        if (pos) markerGroup.position.set(pos.x, pos.y, pos.z + 2);
        
        // Multi-faceted Sapphire Blue Crystal Pineapple Character
        const assetPath = 'assets/sapphire-crystal-pineapple-marker.webp';

        new THREE.TextureLoader().load(assetPath, (tex) => {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
            sprite.scale.set(6, 12, 1); // AAA Look: Elongated and slender
            markerGroup.add(sprite);
        });
        this.playerMarker = markerGroup;
        this.scene.add(markerGroup);
    }

    update(time) {
        if (!this.isDragging && !this.isTransitioning) {
            this.targetCameraY += this.dragVelocity;
            this.dragVelocity *= 0.94;
        }
        this.targetCameraY = Math.max(-15, Math.min(1385, this.targetCameraY));
        this.camera.position.y += (this.targetCameraY - this.camera.position.y) * 0.1;
        
        if (this.pathPoints && this.pathPoints.length > 0) {
            const progressY = (this.camera.position.y + 15) / 14;
            const idx = Math.max(0, Math.min(this.pathPoints.length - 1, Math.floor(progressY)));
            const ratio = progressY % 1;
            const nextIdx = Math.min(this.pathPoints.length - 1, idx + 1);
            
            const p1 = this.pathPoints[idx];
            const p2 = this.pathPoints[nextIdx];
            
            if (p1 && p2) {
                const targetX = p1.x + (p2.x - p1.x) * ratio;
                this.camera.position.x += (targetX - this.camera.position.x) * 0.05;
                this.camera.lookAt(this.camera.position.x * 0.5, this.camera.position.y + 4, 0);
            }

            // Ambient Biome VFX
            const currentLevel = Math.floor(progressY) + 1;
            const biome = this.getBiome(currentLevel);
            
            // Dynamic Atmosphere
            if (this.basePathMaterial) {
                let targetEmissive = 0x00ffff;
                if (biome === 'caves') targetEmissive = 0x00ff00;
                else if (biome === 'archipelago') targetEmissive = 0x0088ff;
                else if (biome === 'celestial') targetEmissive = 0xff00ff;
                
                this.basePathMaterial.emissive.lerp(new THREE.Color(targetEmissive), 0.05);
            }

            if (biome === 'forest') {
                this.scene.fog.color.lerp(new THREE.Color(0x0d0415), 0.05);
            } else if (biome === 'caves') {
                this.scene.fog.color.lerp(new THREE.Color(0x150d04), 0.05);
            } else if (biome === 'archipelago') {
                this.scene.fog.color.lerp(new THREE.Color(0x041015), 0.05);
            } else if (biome === 'celestial') {
                this.scene.fog.color.lerp(new THREE.Color(0x150415), 0.05);
            }

            if (biome === 'archipelago' && Math.random() < 0.05) {
                // Random splashes around the path in Archipelago
                const pIdx = Math.max(0, Math.min(this.pathPoints.length - 1, Math.floor(progressY + (Math.random() - 0.5) * 5)));
                const p = this.pathPoints[pIdx];
                if (p) {
                    this.particleSystem.createWaterSplash(p.x + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 5, -1);
                }
            }
        }

        const t = time * 0.001;
        // Check if material and uniforms exist before updating time
        if (this.basePathMaterial && this.basePathMaterial.userData && this.basePathMaterial.userData.shader) {
            this.basePathMaterial.userData.shader.uniforms.uTime.value = t;
        }
        
        this.labels.forEach(l => l.position.y = l.userData.baseY + Math.sin(t * 2 + l.userData.index) * 0.2);
        this.beacons.forEach(b => {
            b.mesh.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
            b.mesh.material.opacity = 0.5 + Math.sin(t * 4) * 0.2;
        });

        if (this.particleSystem) this.particleSystem.update();
    }
}
