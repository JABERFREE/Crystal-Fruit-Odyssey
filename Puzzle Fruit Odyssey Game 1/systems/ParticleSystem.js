import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        
        // Shared geometries
        this.shardGeometry = new THREE.IcosahedronGeometry(0.1, 0);
        this.flareGeometry = new THREE.SphereGeometry(1, 8, 8); 
        this.boltGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 4);
        
        // Materials cache
        this.materials = {
            trail: new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending }),
            burst: new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
            flare: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }),
            bolt: new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, blending: THREE.AdditiveBlending }),
            glass: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })
        };
    }

    createSparkleTrail(x, y, colorType = 'emerald', z = 0.5) {
        const colors = {
            emerald: 0x00ff88,
            sapphire: 0x0088ff,
            white: 0xffffff,
            gold: 0xffcc00,
            amber: 0xff8800
        };
        const color = colors[colorType] || (typeof colorType === 'number' ? colorType : 0xffffff);
        
        const mat = this.materials.trail.clone();
        mat.color.set(color);
        const mesh = new THREE.Mesh(this.shardGeometry, mat);
        
        const size = 0.04 + Math.random() * 0.06;
        mesh.scale.setScalar(size);
        mesh.position.set(x + (Math.random() - 0.5) * 0.15, y + (Math.random() - 0.5) * 0.15, z);
        
        this.scene.add(mesh);
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, 0.01),
            life: 1.0,
            decay: 0.06 + Math.random() * 0.04,
            isTrail: true
        });
    }

    createSparklingShatter(x, y, color) {
        // Combine a dense burst with glittery sparkles
        this.createBurst(x, y, color, 14, 0.2);
        
        // Add extra high-velocity glittery sparkles
        for (let i = 0; i < 10; i++) {
            const mat = this.materials.trail.clone();
            mat.color.set(0xffffff);
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            
            mesh.scale.setScalar(0.02 + Math.random() * 0.04);
            mesh.position.set(x, y, 0.6);
            
            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, Math.random() * 0.1),
                life: 1.2,
                decay: 0.03 + Math.random() * 0.02,
                isTrail: true,
                isGlitter: true
            });
        }
    }

    createBurst(x, y, color, count = 6, size = 0.15) {
        // Reduced count significantly for 60FPS
        for (let i = 0; i < count; i++) {
            const mat = this.materials.burst.clone();
            mat.color.set(color);
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            mesh.position.set(x, y, 0.5);
            
            const pSize = size * (0.3 + Math.random() * 0.5);
            mesh.scale.setScalar(pSize);
            
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.3
            );

            this.particles.push({
                mesh,
                velocity,
                life: 1.0,
                decay: 0.04 + Math.random() * 0.05,
                rotation: new THREE.Vector3(Math.random() * 0.15, Math.random() * 0.15, Math.random() * 0.15)
            });
            
            this.scene.add(mesh);
        }

        // Central flash flare (Simpler)
        const flareMat = this.materials.flare.clone();
        const flare = new THREE.Mesh(this.flareGeometry, flareMat);
        flare.scale.setScalar(size * 0.4);
        flare.position.set(x, y, 0.6);
        this.scene.add(flare);
        this.particles.push({ mesh: flare, velocity: new THREE.Vector3(0,0,0), life: 1.0, decay: 0.18, isExpanding: true, expandRate: 1.15 });
    }

    createLineEffect(x, y, isHorizontal, color) {
        const geo = new THREE.PlaneGeometry(isHorizontal ? 18 : 0.3, isHorizontal ? 0.3 : 18);
        const mat = new THREE.MeshBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, 0.6);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.0,
            decay: 0.08,
            isExpanding: true,
            expandRate: 1.03,
            disposeGeo: true
        });
        
        for(let i=0; i<4; i++) {
            const offset = (Math.random() - 0.5) * 6;
            this.createBurst(
                isHorizontal ? x + offset : x, 
                isHorizontal ? y : y + offset, 
                0xffffff, 1, 0.04
            );
        }
    }

    createBombEffect(x, y, color) {
        const flareMat = this.materials.flare.clone();
        flareMat.color.set(color);
        const mesh = new THREE.Mesh(this.flareGeometry, flareMat);
        mesh.position.set(x, y, 0.6);
        mesh.scale.setScalar(0.1);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.0,
            decay: 0.08,
            isExpanding: true,
            expandRate: 1.25
        });

        this.createBurst(x, y, color, 10, 0.2);
        
        // Glass shards (Simpler)
        for(let i=0; i<6; i++) {
            const shard = new THREE.Mesh(this.shardGeometry, this.materials.glass.clone());
            shard.position.set(x, y, 0.6);
            shard.scale.setScalar(0.08 + Math.random() * 0.08);
            this.scene.add(shard);
            this.particles.push({
                mesh: shard,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.2),
                life: 1.0,
                decay: 0.05,
                rotation: new THREE.Vector3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2)
            });
        }
    }

    createMegaExplosion(x, y, color) {
        this.createBombEffect(x, y, color);
        this.createBurst(x, y, color, 16, 0.25);
    }

    createPrismEffect(x, y) {
        // Enhanced Rainbow Pearl Effect
        const mat = this.materials.flare.clone();
        mat.color.set(0xffffff);
        const mesh = new THREE.Mesh(this.flareGeometry, mat);
        mesh.position.set(x, y, 1.2);
        mesh.scale.setScalar(0.5);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.5,
            decay: 0.02,
            isExpanding: true,
            expandRate: 1.12,
            isPrism: true
        });

        // Add rainbow burst shards
        for (let i = 0; i < 20; i++) {
            const shardMat = this.materials.burst.clone();
            shardMat.color.setHSL(Math.random(), 0.8, 0.6);
            const shard = new THREE.Mesh(this.shardGeometry, shardMat);
            shard.position.set(x, y, 0.8);
            shard.scale.setScalar(0.1 + Math.random() * 0.1);
            this.scene.add(shard);

            this.particles.push({
                mesh: shard,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.4
                ),
                life: 1.2,
                decay: 0.03,
                rotation: new THREE.Vector3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2)
            });
        }
    }

    createBoltEffect(fromX, fromY, toX, toY, color) {
        const distance = Math.sqrt((toX - fromX)**2 + (toY - fromY)**2);
        const mat = this.materials.bolt.clone();
        mat.color.set(color);
        
        const mesh = new THREE.Mesh(this.boltGeometry, mat);
        mesh.scale.set(1, distance, 1);
        mesh.position.set((fromX + toX) / 2, (fromY + toY) / 2, 0.8);
        
        const direction = new THREE.Vector3(toX - fromX, toY - fromY, 0).normalize();
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        
        this.scene.add(mesh);
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.0,
            decay: 0.15,
            isBolt: true
        });
    }

    createGatheringEffect(fromX, fromY, toX, toY, color) {
        const count = 3;
        for (let i = 0; i < count; i++) {
            const mat = this.materials.burst.clone();
            mat.color.set(color);
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            mesh.position.set(fromX + (Math.random() - 0.5) * 0.3, fromY + (Math.random() - 0.5) * 0.3, 0.5);
            mesh.scale.setScalar(0.06);
            this.scene.add(mesh);

            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(0, 0, 0),
                target: new THREE.Vector3(toX, toY, 0.5),
                life: 1.0,
                decay: 0.07,
                isGathering: true
            });
        }
    }

    createShatterToTarget(x, y, targetPos, color, isGoal = false) {
        const count = isGoal ? 3 : 1; // Drastically reduced
        for (let i = 0; i < count; i++) {
            const mat = this.materials.burst.clone();
            mat.color.set(color);
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            
            const offset = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1);
            mesh.position.set(x + offset.x, y + offset.y, 0.5 + offset.z);
            mesh.scale.setScalar(0.06 + Math.random() * 0.03);
            
            this.scene.add(mesh);

            this.particles.push({
                mesh,
                velocity: offset.multiplyScalar(0.03),
                target: targetPos,
                life: 1.5,
                decay: 0.03,
                isFlyingToUI: true,
                delay: Math.random() * 0.08,
                speed: 0.14 + Math.random() * 0.05
            });
        }
    }

    createStarExplosion(x, y) {
        // High-performance instant Fade-Out & Glow for Star Gems (no shards/particles)
        const mat = this.materials.flare.clone();
        mat.color.set(0xffdd00);
        const mesh = new THREE.Mesh(this.flareGeometry, mat);
        mesh.position.set(x, y, 0.7);
        mesh.scale.setScalar(0.1);
        this.scene.add(mesh);

        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.0,
            decay: 0.12, // Faster fade
            isExpanding: true,
            expandRate: 1.25 // Quick glow swell
        });
    }

    createPineappleExplosion(x, y) {
        // High-fidelity Golden & Emerald burst for the Pineapple Crown
        this.createBurst(x, y, 0xffcc00, 20, 0.3); // More golden shards
        
        // Add faceted emerald crystal shards for the crown
        for (let i = 0; i < 12; i++) {
            const mat = this.materials.burst.clone();
            mat.color.set(0x00ffaa); // Bright emerald
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            mesh.position.set(x, y, 0.6);
            mesh.scale.setScalar(0.06 + Math.random() * 0.1);
            this.scene.add(mesh);

            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.8,
                    (Math.random() - 0.5) * 0.5
                ),
                life: 1.4,
                decay: 0.025,
                rotation: new THREE.Vector3(Math.random() * 0.4, Math.random() * 0.4, Math.random() * 0.4)
            });
        }

        // Add a primary golden flash core
        const flareMat = this.materials.flare.clone();
        flareMat.color.set(0xffdd00);
        const flare = new THREE.Mesh(this.flareGeometry, flareMat);
        flare.scale.setScalar(0.3);
        flare.position.set(x, y, 0.7);
        this.scene.add(flare);
        this.particles.push({ mesh: flare, velocity: new THREE.Vector3(0,0,0), life: 1.2, decay: 0.08, isExpanding: true, expandRate: 1.35 });

        // Add secondary sparkling glitter
        for (let i = 0; i < 15; i++) {
            this.createSparkleTrail(x, y, 'gold', 0.8);
        }
    }

    createLevelUnlockBloom(x, y, z = 0.5) {
        // High-fidelity blooming crystal effect for the Saga Path
        const colorTurquoise = 0x00ffff;
        const colorGold = 0xffcc00;
        const colorWhite = 0xffffff;

        // 1. Central flash flare
        const flareMat = this.materials.flare.clone();
        flareMat.color.set(colorWhite);
        const flare = new THREE.Mesh(this.flareGeometry, flareMat);
        flare.scale.setScalar(0.2);
        flare.position.set(x, y, z + 1.0);
        this.scene.add(flare);
        this.particles.push({ mesh: flare, velocity: new THREE.Vector3(0,0,0), life: 1.5, decay: 0.03, isExpanding: true, expandRate: 1.15 });

        // 2. Blooming "Petal" Shards - Radial burst
        const petalCount = 16;
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const mat = this.materials.burst.clone();
            mat.color.set(i % 3 === 0 ? colorWhite : (i % 3 === 1 ? colorTurquoise : colorGold));
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            mesh.position.set(x, y, z);
            mesh.scale.setScalar(0.1 + Math.random() * 0.15);
            this.scene.add(mesh);

            const speed = 0.15 + Math.random() * 0.2;
            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed, 0.05 + Math.random() * 0.1),
                life: 2.0,
                decay: 0.015,
                rotation: new THREE.Vector3(Math.random() * 0.3, Math.random() * 0.3, Math.random() * 0.3),
                isExpanding: true,
                expandRate: 1.01
            });
        }

        // 3. High-velocity glitter sparkles
        for (let i = 0; i < 30; i++) {
            const t = i / 30;
            const angle = t * Math.PI * 2;
            const speed = 0.4 + Math.random() * 0.3;
            this.createSparkleTrail(x, y, i % 2 === 0 ? 'gold' : 'white', z + 0.5);
        }

        // 4. Double ring expansion
        [0.1, 0.3].forEach((delay, idx) => {
            setTimeout(() => {
                const ringGeo = new THREE.RingGeometry(0.1, 0.4, 32);
                const ringMat = new THREE.MeshBasicMaterial({ 
                    color: idx === 0 ? colorTurquoise : colorGold, 
                    transparent: true, 
                    opacity: 0.7, 
                    side: THREE.DoubleSide, 
                    blending: THREE.AdditiveBlending 
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.position.set(x, y, z - 0.2);
                this.scene.add(ring);
                this.particles.push({ mesh: ring, velocity: new THREE.Vector3(0,0,0), life: 1.2, decay: 0.03, isExpanding: true, expandRate: 1.1, disposeGeo: true });
            }, delay * 1000);
        });
    }

    createWaterSplash(x, y, z = 0.5) {
        const count = 10;
        const color = 0x00ccff;
        for (let i = 0; i < count; i++) {
            const mat = this.materials.burst.clone();
            mat.color.set(color);
            const mesh = new THREE.Mesh(this.shardGeometry, mat);
            mesh.position.set(x + (Math.random() - 0.5) * 1.5, y, z);
            
            const size = 0.08 + Math.random() * 0.12;
            mesh.scale.setScalar(size);
            
            const angle = Math.random() * Math.PI * 2;
            const horizontalForce = 0.05 + Math.random() * 0.1;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * horizontalForce,
                0.15 + Math.random() * 0.2, // Upward splash
                (Math.random() - 0.5) * 0.05
            );

            this.particles.push({
                mesh,
                velocity,
                life: 1.0,
                decay: 0.03 + Math.random() * 0.02,
                rotation: new THREE.Vector3(Math.random() * 0.2, Math.random() * 0.2, Math.random() * 0.2)
            });
            
            this.scene.add(mesh);
        }
    }

    createMusicNote(x, y, z = 0.5) {
        const loader = new THREE.TextureLoader();
        loader.load('assets/musical-note-sparkle.webp', (tex) => {
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending });
            const sprite = new THREE.Sprite(mat);
            sprite.position.set(x, y, z);
            sprite.scale.set(3, 3, 1);
            this.scene.add(sprite);
            
            this.particles.push({
                mesh: sprite,
                velocity: new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.2 + Math.random() * 0.2, 0),
                life: 1.2,
                decay: 0.02,
                isNote: true
            });
        });
    }

    createCartoonTrail(x, y, z = 0.5) {
        // High-fidelity Trail with gold sparkles and subtle speed lines
        this.createPathSparkle(x, y, z);
        if (Math.random() < 0.3) this.createSpeedLines(x, y, z);
        if (Math.random() < 0.2) this.createMusicNote(x, y, z + 1);
    }

    createSpeedLines(x, y, z = 0.5) {
        const geo = new THREE.PlaneGeometry(0.1, 3);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        
        const angle = Math.random() * Math.PI * 2;
        mesh.rotation.z = angle;
        mesh.position.set(x + Math.cos(angle) * 2, y + Math.sin(angle) * 2, z);
        
        this.scene.add(mesh);
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0, 0),
            life: 1.0,
            decay: 0.1,
            isExpanding: true,
            expandRate: 1.1,
            disposeGeo: true
        });
    }

    createPathSparkle(x, y, z = 0.5) {
        // Opulent jewelry-grade path sparkle
        const mat = this.materials.trail.clone();
        const colors = [0xffcc00, 0xffd700, 0xffffff, 0xffaa00];
        mat.color.set(colors[Math.floor(Math.random() * colors.length)]);
        
        const mesh = new THREE.Mesh(this.shardGeometry, mat);
        const size = 0.05 + Math.random() * 0.12;
        mesh.scale.setScalar(size);
        mesh.position.set(
            x + (Math.random() - 0.5) * 1.5, 
            y + (Math.random() - 0.5) * 1.5, 
            z + (Math.random() - 0.5) * 0.5
        );
        
        // Random rotation for faceted look
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        
        this.scene.add(mesh);
        this.particles.push({
            mesh,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.02, 
                (Math.random() - 0.5) * 0.02, 
                0.02 + Math.random() * 0.02
            ),
            rotation: new THREE.Vector3(Math.random() * 0.1, Math.random() * 0.1, Math.random() * 0.1),
            life: 0.8 + Math.random() * 0.7,
            decay: 0.02 + Math.random() * 0.02,
            isSparkle: true
        });
    }

    update() {
        const delta = 0.016;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.isFlyingToUI) {
                if (p.delay > 0) {
                    p.delay -= delta;
                    p.mesh.position.add(p.velocity);
                    p.velocity.multiplyScalar(0.94);
                } else if (p.target) {
                    const direction = p.target.clone().sub(p.mesh.position).normalize();
                    const dist = p.mesh.position.distanceTo(p.target);
                    const speed = p.speed * (1.2 + (1.8 - p.life));
                    p.mesh.position.add(direction.multiplyScalar(speed));
                    if (dist < 0.35) p.life -= 0.2;
                } else {
                    p.life = 0; // Safety for missing target
                }
                p.mesh.rotation.x += 0.2;
                p.mesh.rotation.y += 0.2;
            } else if (p.isGathering) {
                p.mesh.position.lerp(p.target, 0.25);
                if (p.mesh.position.distanceTo(p.target) < 0.1) p.life = 0;
            } else if (p.isBolt) {
                p.mesh.scale.x *= 0.75;
                p.mesh.scale.z *= 0.75;
            } else {
                p.mesh.position.add(p.velocity);
                if (p.velocity.length() > 0) p.velocity.y -= 0.0015;
                if (p.rotation) {
                    p.mesh.rotation.x += p.rotation.x;
                    p.mesh.rotation.y += p.rotation.y;
                    p.mesh.rotation.z += p.rotation.z;
                }
            }

            if (p.isExpanding) p.mesh.scale.multiplyScalar(p.expandRate || 1.1);
            if (p.isPrism) {
                p.mesh.material.color.setHSL((Date.now() * 0.001) % 1, 0.7, 0.5);
            }

            p.life -= p.decay;
            p.mesh.material.opacity = Math.max(0, p.life);
            
            if (!p.isExpanding && !p.isGathering && !p.isBolt && !p.isFlyingToUI) {
                p.mesh.scale.multiplyScalar(0.95);
            }

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.material) p.mesh.material.dispose();
                if (p.disposeGeo && p.mesh.geometry) p.mesh.geometry.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}
