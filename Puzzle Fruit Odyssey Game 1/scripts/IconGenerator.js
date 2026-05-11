/**
 * Crystal Fruit Odyssey - Native Asset Generation Script
 * Handles icon resizing for iOS and Android high-density displays.
 * 
 * This script is designed to be run in a browser environment or utility page 
 * to generate the full suite of production icons from the master Sapphire Pineapple asset.
 */

export const ICON_MANIFEST = {
    android: [
        { name: 'mipmap-mdpi', size: 48 },
        { name: 'mipmap-hdpi', size: 72 },
        { name: 'mipmap-xhdpi', size: 96 },
        { name: 'mipmap-xxhdpi', size: 144 },
        { name: 'mipmap-xxxhdpi', size: 192 },
        { name: 'playstore-icon', size: 512 }
    ],
    ios: [
        { name: 'Icon-20@2x', size: 40 },
        { name: 'Icon-20@3x', size: 60 },
        { name: 'Icon-29@2x', size: 58 },
        { name: 'Icon-29@3x', size: 87 },
        { name: 'Icon-40@2x', size: 80 },
        { name: 'Icon-40@3x', size: 120 },
        { name: 'Icon-60@2x', size: 120 },
        { name: 'Icon-60@3x', size: 180 },
        { name: 'Icon-76@2x', size: 152 },
        { name: 'Icon-83.5@2x', size: 167 },
        { name: 'Icon-1024', size: 1024 }
    ]
};

export class IconGenerator {
    constructor(sourcePath = 'assets/sapphire-crystal-pineapple-marker.webp') {
        this.sourcePath = sourcePath;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Processes the source image and triggers downloads for all specified densities.
     */
    async generateAll() {
        console.log(`%c [IconGenerator] Initializing generation from: ${this.sourcePath}`, 'color: #00ccff; font-weight: bold;');
        
        const img = await this.loadImage(this.sourcePath);
        
        // Process Android
        for (const config of ICON_MANIFEST.android) {
            await this.resizeAndDownload(img, config, 'android');
        }

        // Process iOS
        for (const config of ICON_MANIFEST.ios) {
            await this.resizeAndDownload(img, config, 'ios');
        }

        console.log('%c [IconGenerator] All assets generated successfully!', 'color: #00ff88; font-weight: bold;');
    }

    async resizeAndDownload(img, config, platform) {
        const { name, size } = config;
        this.canvas.width = size;
        this.canvas.height = size;

        // Apply high-quality smoothing
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // Clear and draw
        this.ctx.clearRect(0, 0, size, size);
        this.ctx.drawImage(img, 0, 0, size, size);

        // Convert to blob and download
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${platform}_${name}.png`;
                a.click();
                URL.revokeObjectURL(url);
                console.log(`Generated: ${platform}_${name} (${size}x${size})`);
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
