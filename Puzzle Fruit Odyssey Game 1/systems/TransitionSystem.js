import * as THREE from 'three';

export class TransitionSystem {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 20;
        
        this.rays = [];
        this.isActive = false;
        this.progress = 0;
        
        // Shared geometry for rays
        this.rayGeo = new THREE.CylinderGeometry(0.02, 0.08, 1, 4);
        this.rayMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
    }

    start() {
        this.isActive = true;
        this.progress = 0;
        this.rays.forEach(r => this.scene.remove(r));
        this.rays = [];

        // UI Update
        this.ui = document.getElementById('transition-ui');
        this.loadingSystem = document.getElementById('loading-system');
        this.bar = document.getElementById('global-loading-bar');
        
        if (this.ui) {
            this.ui.style.display = 'block';
            this.ui.style.opacity = '1';
        }
        if (this.loadingSystem) {
            this.loadingSystem.style.display = 'flex';
        }
        if (this.bar) this.bar.style.width = '0%';

        // Play fast-paced loading music
        import('./SoundManager.js').then(m => m.soundManager.playLoadingMusic());

        const count = 150;
        for (let i = 0; i < count; i++) {
            const ray = new THREE.Mesh(this.rayGeo, this.rayMat.clone());
            
            // Random direction from center
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            const dir = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            );
            
            ray.userData.direction = dir;
            ray.userData.speed = 0.5 + Math.random() * 1.5;
            ray.userData.rotationSpeed = (Math.random() - 0.5) * 0.1;
            
            // Align ray to its direction
            ray.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            
            this.scene.add(ray);
            this.rays.push(ray);
        }
    }

    update() {
        if (!this.isActive) return;

        this.progress += 0.025; // Snappier loading
        
        if (this.bar) {
            this.bar.style.width = `${this.progress * 100}%`;
        }

        this.rays.forEach(ray => {
            const speed = ray.userData.speed * (1 + this.progress * 5);
            ray.position.add(ray.userData.direction.clone().multiplyScalar(speed));
            
            // Stretch based on speed
            ray.scale.y = 1 + speed * 2;
            
            // Fade in and out
            if (this.progress < 0.2) {
                ray.material.opacity = this.progress * 5;
            } else {
                ray.material.opacity = Math.max(0, 1 - (this.progress - 0.2) * 1.5);
            }
        });

        if (this.progress >= 1) {
            this.isActive = false;
            if (this.ui) {
                this.ui.style.opacity = '0';
                setTimeout(() => {
                    this.ui.style.display = 'none';
                }, 500);
            }
            if (this.loadingSystem) {
                this.loadingSystem.style.display = 'none';
            }
        }
    }

    render() {
        if (!this.isActive) return;
        this.renderer.autoClear = false;
        this.renderer.render(this.scene, this.camera);
        this.renderer.autoClear = true;
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}