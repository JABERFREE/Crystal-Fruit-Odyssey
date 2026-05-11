export const CONFIG = {
    GRID_SIZE: { rows: 8, cols: 8 },
    TILE_SIZE: 1.2,
    CRYSTAL_TYPES: [
        { id: 0, color: 0xff0044, name: 'Ruby Strawberry', asset: 'assets/ruby-strawberry-jewel-v2.webp', scale: 1.1 },
        { id: 1, color: 0x00ff88, name: 'Emerald Apple', asset: 'assets/emerald-apple-jewel-v2.webp', scale: 1.1 },
        { id: 2, color: 0x0088ff, name: 'Sapphire Cherry', asset: 'assets/sapphire-cherry-jewel-v2.webp', scale: 1.1 },
        { id: 3, color: 0xffaa00, name: 'Jewel Orange', asset: 'assets/orange-gem-jewel-v2.webp', scale: 1.1 },
        { id: 4, color: 0xaa00ff, name: 'Amethyst Grape', asset: 'assets/amethyst-grape-jewel-v2.webp', scale: 1.1 },
        { id: 5, color: 0xff3366, name: 'Premium Strawberry', asset: 'assets/crystal-strawberry-premium.webp', scale: 1.1 },
        // Variants for high difficulty or special levels
        { id: 6, color: 0xff0044, name: 'Ruby Pomegranate', asset: 'assets/ruby-pomegranate-jewel.webp', scale: 1.1 },
        { id: 7, color: 0x44ff44, name: 'Jade Lime', asset: 'assets/fruit-jade-png.webp', scale: 1.1 },
        { id: 8, color: 0x0044ff, name: 'Sapphire Crackle Fruit', asset: 'assets/sapphire-crackle-fruit-jewel.webp', scale: 1.1 },
        { id: 9, color: 0xffaa44, name: 'Mystic Fig', asset: 'assets/mystic-fig-crystal-v3-compact.webp', scale: 1.1 }
    ],
    FRUIT_TYPE: 99,
    FRUIT_ASSET: 'assets/yellow-star-jewel-v2.webp',
    SPECIALS: {
        LINE_BLAST_H: 'line_blast_h',
        LINE_BLAST_V: 'line_blast_v',
        CRYSTAL_BOMB: 'crystal_bomb',
        RAINBOW_PEARL: 'rainbow_pearl',
        TIME_BOMB: 'time_bomb'
    },
    SPECIAL_POWER: 10, // Multiplier or identifier
    OBSTACLES: {
        FROST: 'frost',
        STONE: 'stone',
        VINES: 'vines',
        TREASURE: 'treasure'
    },
    OBSTACLE_ASSETS: {
        FROST: 'assets/obstacle-frost-layer.webp',
        VINES: 'assets/obstacle-vines-cage.webp',
        STONE: 'assets/crystal-kiwi-slice.webp',
        TREASURE: 'assets/ui-rewards-trophy-circular-purple.webp'
    },
    ANIMATION_SPEED: 300, 
    FALL_SPEED: 400, // ms
    STAR_METER_MAX: 100, // Threshold to trigger Rainbow Blast
    COLORS: {
        UI_BG: 'rgba(0, 0, 0, 0.4)',
        TEXT: '#ffffff',
        ACCENT: '#ffdd00'
    }
};