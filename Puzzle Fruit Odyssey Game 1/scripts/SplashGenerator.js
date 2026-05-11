/**
 * Crystal Fruit Odyssey - Splash Screen Generation Script
 * Automates high-density launch images for Android and iOS.
 * 
 * Target: AAA Crystalline Visual Fidelity
 * Base Asset: assets/splash-screen-bg-odyssey.webp
 */

export const SPLASH_MANIFEST = {
    android: [
        { name: 'splash-port-ldpi', width: 200, height: 320 },
        { name: 'splash-port-mdpi', width: 320, height: 480 },
        { name: 'splash-port-hdpi', width: 480, height: 800 },
        { name: 'splash-port-xhdpi', width: 720, height: 1280 },
        { name: 'splash-port-xxhdpi', width: 960, height: 1600 },
        { name: 'splash-port-xxxhdpi', width: 1280, height: 1920 }
    ],
    ios: [
        { name: 'Default-568h@2x', width: 640, height: 1136 }, // iPhone SE
        { name: 'Default-667h@2x', width: 750, height: 1334 }, // iPhone 8
        { name: 'Default-736h@3x', width: 1242, height: 2208 }, // iPhone 8 Plus
        { name: 'Default-2436h', width: 1125, height: 2436 }, // iPhone X/11 Pro
        { name: 'Default-1792h', width: 828, height: 1792 }, // iPhone XR/11
        { name: 'Default-2688h', width: 1242, height: 2688 }, // iPhone 11 Pro Max
        { name: 'Default-Portrait@2x~ipad', width: 1536, height: 2048 },
        { name: 'Default-Portrait@3x~ipad', width: 2048, height: 2732 }
    ]
};

export class SplashGenerator {
    constructor(sourcePath = 'assets/splash-screen-bg-odyssey.webp') {
        this.sourcePath = sourcePath;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Generates the full distribution suite of splash screens.
     */
    async generateAll() {
        console.log(`%c [SplashGenerator] Initializing splash generation from: ${this.sourcePath}`, 'color: #ff00ff; font-weight: bold;');
        
        const img = await this.loadImage(this.sourcePath);
        
        // Android Sequence
        for (const config of SPLASH_MANIFEST.android) {
            await this.drawAndDownload(img, config, 'android');
        }

        // iOS Sequence
        for (const config of SPLASH_MANIFEST.ios) {
            await this.drawAndDownload(img, config, 'ios');
        }

        console.log('%c [SplashGenerator] Production splash suite complete!', 'color: #00ff88; font-weight: bold;');
    }

    async drawAndDownload(img, config, platform) {
        const { name, width, height } = config;
        this.canvas.width = width;
        this.canvas.height = height;

        // Apply high-end resampling
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Calculate aspect fill (cover) to avoid stretching the crystalline resin art
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > canvasAspect) {
            drawHeight = height;
            drawWidth = height * imgAspect;
            offsetX = -(drawWidth - width) / 2;
            offsetY = 0;
        } else {
            drawWidth = width;
            drawHeight = width / imgAspect;
            offsetX = 0;
            offsetY = -(drawHeight - height) / 2;
        }

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${platform}_${name}.png`;
                a.click();
                URL.revokeObjectURL(url);
                console.log(`Splash Generated: ${platform}_${name} (${width}x${height})`);
                resolve();
            }, 'image/png');
        });
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
}
