import * as THREE from 'three';
import { CONFIG } from '../config.js';

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = {};

// Shared geometries for performance
const GEOMETRIES = {
    icosahedron: new THREE.IcosahedronGeometry(0.45, 0),
    torusKnot: new THREE.TorusKnotGeometry(0.3, 0.1, 32, 8), // Lower detail
    sphere: new THREE.SphereGeometry(0.55, 16, 16), // Lower detail
    shadow: new THREE.CircleGeometry(0.3, 16),
    vein: new THREE.TorusGeometry(0.35, 0.015, 6, 16),
    outerPrism: new THREE.IcosahedronGeometry(0.55, 1) // Lower detail
};

export class Crystal extends THREE.Group {
    constructor(typeId, r, c, specialType = null, bombCounter = 0) {
        super();
        this.typeId = typeId;
        this.specialType = specialType;
        this.bombCounter = bombCounter;
        this.gridPos = { r, c };
        this.config = CONFIG.CRYSTAL_TYPES.find(t => t.id === typeId) || { color: 0xffffff, asset: null };
        
        this.createMesh();
    }

    setObstacles(frost = 0, stones = 0, vines = 0, treasure = false) {
        if (frost > 0) {
            if (!this.frostOverlay) {
                const mat = new THREE.SpriteMaterial({ 
                    map: textureLoader.load(CONFIG.OBSTACLE_ASSETS.FROST),
                    transparent: true,
                    opacity: 0.8
                });
                this.frostOverlay = new THREE.Sprite(mat);
                this.frostOverlay.scale.set(1.2, 1.2, 1);
                this.frostOverlay.position.z = 0.1;
                this.add(this.frostOverlay);
            }
        } else if (this.frostOverlay) {
            this.remove(this.frostOverlay);
            this.frostOverlay = null;
        }

        if (vines > 0) {
            if (!this.vinesOverlay) {
                const mat = new THREE.SpriteMaterial({ 
                    map: textureLoader.load(CONFIG.OBSTACLE_ASSETS.VINES),
                    transparent: true,
                    opacity: 0.9
                });
                this.vinesOverlay = new THREE.Sprite(mat);
                this.vinesOverlay.scale.set(1.3, 1.3, 1);
                this.vinesOverlay.position.z = 0.2;
                this.add(this.vinesOverlay);
            }
        } else if (this.vinesOverlay) {
            this.remove(this.vinesOverlay);
            this.vinesOverlay = null;
        }

        if (stones > 0) {
            if (!this.stoneMesh) {
                const mat = new THREE.SpriteMaterial({ 
                    map: textureLoader.load(CONFIG.OBSTACLE_ASSETS.STONE),
                    transparent: true,
                    opacity: 1.0
                });
                this.stoneMesh = new THREE.Sprite(mat);
                this.stoneMesh.scale.set(1.1, 1.1, 1);
                this.add(this.stoneMesh);
                if (this.mesh) this.mesh.visible = false;
            }
        } else if (this.stoneMesh) {
            this.remove(this.stoneMesh);
            this.stoneMesh = null;
            if (this.mesh) this.mesh.visible = true;
        }

        if (treasure) {
            if (!this.treasureOverlay) {
                const mat = new THREE.SpriteMaterial({ 
                    map: textureLoader.load(CONFIG.OBSTACLE_ASSETS.TREASURE),
                    transparent: true,
                    opacity: 1.0
                });
                this.treasureOverlay = new THREE.Sprite(mat);
                this.treasureOverlay.scale.set(0.9, 0.9, 1);
                this.treasureOverlay.position.z = 0.3;
                this.add(this.treasureOverlay);
            }
        } else if (this.treasureOverlay) {
            this.remove(this.treasureOverlay);
            this.treasureOverlay = null;
        }
    }

    createMesh() {
        let assetPath = this.config.asset;
        if (this.typeId === CONFIG.FRUIT_TYPE) assetPath = CONFIG.FRUIT_ASSET;
        
        if (assetPath) {
            if (!textureCache[assetPath]) {
                textureCache[assetPath] = textureLoader.load(assetPath);
            }
            
            // Standard Sprite Material is highly mobile-optimized in Three.js
            const material = new THREE.SpriteMaterial({ 
                map: textureCache[assetPath],
                color: 0xffffff,
                transparent: true,
                opacity: 1.0,
                depthWrite: false // Performance boost for transparency
            });
            
            this.mesh = new THREE.Sprite(material);
            const scale = this.config.scale || 1.1;
            this.mesh.scale.set(scale, scale, 1);
        } else {
            // Simplified geometry and material for non-asset crystals
            const geometry = GEOMETRIES.icosahedron;
            const material = new THREE.MeshStandardMaterial({
                color: this.config.color || 0xffffff,
                metalness: 0.5,
                roughness: 0.5,
                transparent: true,
                opacity: 0.9
            });
            this.mesh = new THREE.Mesh(geometry, material);
        }

        this.add(this.mesh);

        if (this.specialType) {
            this.addSpecialVFX();
            const lightColor = this.specialType === CONFIG.SPECIALS.RAINBOW_PEARL ? 0xffffff : (this.config.color || 0xffffff);
            // Mobile Optimization: PointLights are expensive. We only use one per special crystal and limit its range.
            this.specialLight = new THREE.PointLight(lightColor, 1.2, 2.5);
            this.add(this.specialLight);
        }

        if (this.bombCounter > 0) {
            this.createBombText();
        }
    }

    createBombText() {
        if (this.bombTextSprite) {
            this.remove(this.bombTextSprite);
            if (this.bombTextSprite.material.map) this.bombTextSprite.material.map.dispose();
            this.bombTextSprite.material.dispose();
        }

        const canvas = document.createElement('canvas');
        canvas.width = 64; // Smaller canvas
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeText(this.bombCounter, 32, 32);
        ctx.fillText(this.bombCounter, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        this.bombTextSprite = new THREE.Sprite(material);
        this.bombTextSprite.scale.set(0.6, 0.6, 1);
        this.bombTextSprite.position.set(0, 0, 0.2);
        this.add(this.bombTextSprite);
    }

    addSpecialVFX() {
        const color = this.config.color || 0xffffff;
        
        if (this.specialType === CONFIG.SPECIALS.LINE_BLAST_H || this.specialType === CONFIG.SPECIALS.LINE_BLAST_V) {
            const vfxGroup = new THREE.Group();
            
            // Aura using a shared gradient texture if possible, but canvas is okay if created once
            if (!textureCache['aura']) {
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, 64, 64);
                textureCache['aura'] = new THREE.CanvasTexture(canvas);
            }

            const aura = new THREE.Sprite(new THREE.SpriteMaterial({ 
                map: textureCache['aura'], 
                transparent: true, 
                blending: THREE.AdditiveBlending 
            }));
            aura.scale.set(1.8, 1.8, 1);
            vfxGroup.add(aura);
            this.aura = aura;

            const veinGroup = new THREE.Group();
            for (let i = 0; i < 3; i++) { // Reduced count
                const veinMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
                const vein = new THREE.Mesh(GEOMETRIES.vein, veinMat);
                vein.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                if (this.specialType === CONFIG.SPECIALS.LINE_BLAST_H) vein.scale.y = 0.5;
                else vein.scale.x = 0.5;
                veinGroup.add(vein);
            }
            vfxGroup.add(veinGroup);
            this.add(vfxGroup);
            this.specialVFX = vfxGroup;
            this.veinGroup = veinGroup;
        } else if (this.specialType === CONFIG.SPECIALS.CRYSTAL_BOMB) {
            const bombGroup = new THREE.Group();
            const bombMat = new THREE.MeshPhysicalMaterial({
                color: color,
                transparent: true,
                opacity: 0.3,
                metalness: 0.5,
                roughness: 0.2,
                transmission: 0.4,
                thickness: 0.4
            });
            const bomb = new THREE.Mesh(GEOMETRIES.sphere, bombMat);
            bombGroup.add(bomb);
            
            const innerCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const innerCore = new THREE.Mesh(GEOMETRIES.icosahedron, innerCoreMat);
            innerCore.scale.setScalar(0.4);
            bomb.add(innerCore);
            
            this.add(bombGroup);
            this.specialVFX = bombGroup;
            this.specialVFX.bomb = bomb;
            this.specialVFX.innerCore = innerCore;
        } else if (this.specialType === CONFIG.SPECIALS.RAINBOW_PEARL) {
            const outerMat = new THREE.MeshPhysicalMaterial({ 
                color: 0xffffff,
                transmission: 1.0,
                thickness: 0.8,
                ior: 2.0, // Reduced slightly
                roughness: 0.05,
                metalness: 0.1,
                transparent: true,
                opacity: 0.7
            });
            const outer = new THREE.Mesh(GEOMETRIES.outerPrism, outerMat);
            this.add(outer);
            this.specialVFX = outer;
        } else if (this.specialType === CONFIG.SPECIALS.TIME_BOMB) {
            const bombMat = new THREE.MeshPhysicalMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.3,
                emissive: 0xff0000,
                emissiveIntensity: 0.3
            });
            const outer = new THREE.Mesh(GEOMETRIES.icosahedron, bombMat);
            outer.scale.setScalar(1.1);
            this.add(outer);
            this.specialVFX = outer;
        }
    }

    destroy() {
        this.children.forEach(child => {
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
            if (child.geometry) child.geometry.dispose();
        });
        this.clear();
        if (this.parent) this.parent.remove(this);
    }

    updateType(newTypeId) {
        this.typeId = newTypeId;
        this.config = CONFIG.CRYSTAL_TYPES.find(t => t.id === newTypeId) || { color: 0xffffff, asset: null };
        
        // Proper cleanup before recreation
        this.children.forEach(child => {
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
            if (child.geometry && child.geometry !== GEOMETRIES.icosahedron && child.geometry !== GEOMETRIES.torusKnot && child.geometry !== GEOMETRIES.sphere && child.geometry !== GEOMETRIES.shadow && child.geometry !== GEOMETRIES.vein && child.geometry !== GEOMETRIES.outerPrism) {
                child.geometry.dispose();
            }
        });
        this.clear();
        this.createMesh();
    }

    update(time) {
        if (this.mesh && this.mesh.isMesh) {
            this.mesh.rotation.y += 0.01;
            this.mesh.rotation.x += 0.005;
        } else if (this.mesh && this.mesh.isSprite) {
            const s = this.config.scale || 1.1;
            this.mesh.scale.set(s, s, 1);
        }
        
        // Base pulse for all active pieces
        let pulseIntensity = 0.03;
        let pulseSpeed = 0.002;
        let baseScale = 1.0;

        // Special behavior for Crystal Banana (ID: 5)
        if (this.typeId === 5) {
            if (this.isHovered || this.isCollecting) {
                pulseIntensity = 0.15;
                pulseSpeed = 0.01;
                baseScale = 1.15;
                
                // Add a glowing effect to the material if it's a sprite
                if (this.mesh && this.mesh.material) {
                    // Flash the color slightly
                    const flash = 0.8 + Math.sin(Date.now() * 0.01) * 0.2;
                    this.mesh.material.color.setRGB(1, 1, flash);
                }
            } else {
                // Subtle golden shimmer for idle bananas
                pulseIntensity = 0.05;
                pulseSpeed = 0.003;
            }
        }

        const pulse = baseScale + Math.sin(Date.now() * pulseSpeed + this.gridPos.r + this.gridPos.c) * pulseIntensity;
        this.scale.setScalar(pulse);

        if (this.specialVFX) {
            const t = Date.now() * 0.003; // Throttled update rate
            if (this.specialType === CONFIG.SPECIALS.LINE_BLAST_H || this.specialType === CONFIG.SPECIALS.LINE_BLAST_V) {
                if (this.aura) {
                    this.aura.scale.setScalar(1.6 + Math.sin(t * 2) * 0.15);
                    this.aura.material.opacity = 0.3 + Math.sin(t * 2) * 0.15;
                }
                if (this.veinGroup) {
                    this.veinGroup.children.forEach((vein, i) => {
                        vein.rotation.z += 0.015;
                        vein.material.opacity = 0.6 + Math.sin(t * 3 + i) * 0.3;
                    });
                }
            } else if (this.specialType === CONFIG.SPECIALS.CRYSTAL_BOMB) {
                const pulse = 1 + Math.sin(t * 2.5) * 0.08;
                this.specialVFX.scale.setScalar(pulse);
                if (this.specialVFX.innerCore) {
                    this.specialVFX.innerCore.material.opacity = 0.5 + Math.sin(t * 5) * 0.4;
                }
            } else if (this.specialType === CONFIG.SPECIALS.RAINBOW_PEARL) {
                this.specialVFX.rotation.y += 0.025;
                this.specialVFX.rotation.z += 0.015;
                const hue = (t * 0.04) % 1;
                this.specialVFX.material.emissive.setHSL(hue, 0.7, 0.5);
                this.specialVFX.material.emissiveIntensity = 0.4 + Math.sin(t * 2) * 0.4;
            } else if (this.specialType === CONFIG.SPECIALS.TIME_BOMB) {
                const s = 1.05 + Math.sin(t * 3.5) * 0.05;
                this.specialVFX.scale.setScalar(s);
            }
        }
    }
}
