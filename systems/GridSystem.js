import { CONFIG } from '../config.js';

export class GridSystem {
    constructor(rows, cols, currentLevel = 1) {
        this.rows = rows;
        this.cols = cols;
        this.currentLevel = currentLevel;
        this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
        this.frost = Array.from({ length: rows }, () => Array(cols).fill(0));
        this.stones = Array.from({ length: rows }, () => Array(cols).fill(0)); 
        this.vines = Array.from({ length: rows }, () => Array(cols).fill(0));
        this.treasure = Array.from({ length: rows }, () => Array(cols).fill(false));
        this.holes = Array.from({ length: rows }, () => Array(cols).fill(0)); 
        this.specials = Array.from({ length: rows }, () => Array(cols).fill(null));
        this.bombCounters = Array.from({ length: rows }, () => Array(cols).fill(0));
        this.isStable = true;
        this.allowedTypes = [0, 1, 2, 3, 4, 5]; // Default
    }

    fillBoard(frostProbability = 0.2, stoneProbability = 0, vineProbability = 0, holes = null, allowedTypes = null) {
        if (allowedTypes) this.allowedTypes = allowedTypes;
        if (holes) {
            holes.forEach(([r, c]) => {
                if (this.isInBounds(r, c)) this.holes[r][c] = 1;
            });
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.holes[r][c]) {
                    this.grid[r][c] = null;
                    continue;
                }

                if (!this.grid[r][c]) {
                    this.grid[r][c] = this.getRandomType();
                }
                if (Math.random() < frostProbability) {
                    this.frost[r][c] = 1;
                }
                if (Math.random() < stoneProbability) {
                    this.stones[r][c] = 1;
                }
                if (Math.random() < vineProbability) {
                    this.vines[r][c] = 1;
                }
            }
        }
        this.preventInitialMatches();
    }

    getRandomType() {
        const idx = Math.floor(Math.random() * this.allowedTypes.length);
        return this.allowedTypes[idx];
    }

    preventInitialMatches() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.holes[r][c]) continue;
                let safety = 0;
                while (this.getMatchesAt(r, c).length >= 3 && safety < 10) {
                    // Cycle through allowed types
                    const currentIdx = this.allowedTypes.indexOf(this.grid[r][c]);
                    const nextIdx = (currentIdx + 1) % this.allowedTypes.length;
                    this.grid[r][c] = this.allowedTypes[nextIdx];
                    safety++;
                }
            }
        }
    }

    getMatchesAt(r, c) {
        if (this.holes[r][c]) return [];
        const type = this.grid[r][c];
        const horizontal = this.getMatchDirection(r, c, 0, 1, type);
        const vertical = this.getMatchDirection(r, c, 1, 0, type);
        
        const hMatches = horizontal.length >= 3 ? horizontal : [];
        const vMatches = vertical.length >= 3 ? vertical : [];
        
        return [...new Set([...hMatches, ...vMatches])];
    }

    getMatchDirection(r, c, dr, dc, type) {
        if (type === null) return [];
        const matches = [[r, c]];
        // Positive direction
        let nr = r + dr, nc = c + dc;
        while (this.isInBounds(nr, nc) && !this.holes[nr][nc] && this.grid[nr][nc] === type) {
            matches.push([nr, nc]);
            nr += dr; nc += dc;
        }
        // Negative direction
        nr = r - dr; nc = c - dc;
        while (this.isInBounds(nr, nc) && !this.holes[nr][nc] && this.grid[nr][nc] === type) {
            matches.push([nr, nc]);
            nr -= dr; nc -= dc;
        }
        return matches;
    }

    isInBounds(r, c) {
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    checkAllMatches(swapTarget = null) {
        const matches = [];
        const checked = new Set();
        const specials = []; // { r, c, type, specialType }

        // Robust scan for all matches on the board
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.holes[r][c] || this.grid[r][c] === null) continue;
                
                const type = this.grid[r][c];
                
                // Horizontal scan from this piece
                let hMatch = [ [r, c] ];
                let nc = c + 1;
                while (this.isInBounds(r, nc) && !this.holes[r][nc] && this.grid[r][nc] === type) {
                    hMatch.push([r, nc]);
                    nc++;
                }
                
                // Vertical scan from this piece
                let vMatch = [ [r, c] ];
                let nr = r + 1;
                while (this.isInBounds(nr, c) && !this.holes[nr][c] && this.grid[nr][c] === type) {
                    vMatch.push([nr, c]);
                    nr++;
                }

                // A match is found if either line is >= 3
                const isH = hMatch.length >= 3;
                const isV = vMatch.length >= 3;
                
                if (isH || isV) {
                    // Collect all pieces in this specific intersection
                    const matchGroup = new Set();
                    if (isH) hMatch.forEach(m => matchGroup.add(`${m[0]}-${m[1]}`));
                    if (isV) vMatch.forEach(m => matchGroup.add(`${m[0]}-${m[1]}`));

                    // Check if we've already recorded this match (via any of its pieces)
                    let alreadyFound = false;
                    for (const coord of matchGroup) {
                        if (checked.has(coord)) {
                            alreadyFound = true;
                            break;
                        }
                    }

                    if (!alreadyFound) {
                        const matchCoords = Array.from(matchGroup).map(s => s.split('-').map(Number));
                        matches.push(matchCoords);
                        matchCoords.forEach(([mr, mc]) => checked.add(`${mr}-${mc}`));

                        // Powerup logic
                        let specialType = null;
                        if (hMatch.length >= 5 || vMatch.length >= 5) specialType = CONFIG.SPECIALS.RAINBOW_PEARL;
                        else if (isH && isV) specialType = CONFIG.SPECIALS.CRYSTAL_BOMB;
                        else if (hMatch.length === 4) specialType = CONFIG.SPECIALS.LINE_BLAST_V;
                        else if (vMatch.length === 4) specialType = CONFIG.SPECIALS.LINE_BLAST_H;

                        if (specialType) {
                            let specialPos = [r, c];
                            if (swapTarget) {
                                const targetKey = `${swapTarget.r}-${swapTarget.c}`;
                                if (matchGroup.has(targetKey)) specialPos = [swapTarget.r, swapTarget.c];
                            }
                            specials.push({ r: specialPos[0], c: specialPos[1], type, specialType });
                        }
                    }
                }
            }
        }
        return { matches, specials };
    }

    swap(r1, c1, r2, c2) {
        const temp = this.grid[r1][c1];
        this.grid[r1][c1] = this.grid[r2][c2];
        this.grid[r2][c2] = temp;

        const tempSpecial = this.specials[r1][c1];
        this.specials[r1][c1] = this.specials[r2][c2];
        this.specials[r2][c2] = tempSpecial;

        const tempBomb = this.bombCounters[r1][c1];
        this.bombCounters[r1][c1] = this.bombCounters[r2][c2];
        this.bombCounters[r2][c2] = tempBomb;
    }

    findAvailableMatch() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                // Check horizontal swap
                if (c < this.cols - 1 && this.canSwap(r, c, r, c + 1)) {
                    this.swap(r, c, r, c + 1);
                    const { matches } = this.checkAllMatches();
                    this.swap(r, c, r, c + 1);
                    if (matches.length > 0) return { r1: r, c1: c, r2: r, c2: c + 1 };
                }
                // Check vertical swap
                if (r < this.rows - 1 && this.canSwap(r, c, r + 1, c)) {
                    this.swap(r, c, r + 1, c);
                    const { matches } = this.checkAllMatches();
                    this.swap(r, c, r + 1, c);
                    if (matches.length > 0) return { r1: r, c1: c, r2: r + 1, c2: c };
                }
            }
        }
        return null;
    }

    hasAvailableMatches() {
        return this.findAvailableMatch() !== null;
    }

    reshuffle() {
        const pieces = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== null && this.holes[r][c] === 0) {
                    pieces.push({
                        type: this.grid[r][c],
                        special: this.specials[r][c],
                        bomb: this.bombCounters[r][c]
                    });
                }
            }
        }

        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            // Shuffle pieces
            for (let i = pieces.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
            }

            let idx = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (this.grid[r][c] !== null && this.holes[r][c] === 0) {
                        const p = pieces[idx++];
                        this.grid[r][c] = p.type;
                        this.specials[r][c] = p.special;
                        this.bombCounters[r][c] = p.bomb;
                    }
                }
            }

            if (this.hasAvailableMatches()) {
                return true;
            }
            attempts++;
        }

        // Emergency fallback: If no matches found after 50 shuffles, force one
        this.forceAvailableMatch();
        return true;
    }

    forceAvailableMatch() {
        // Find two adjacent crystals and swap them to create a match
        // Or simply replace a 3-long segment with the same type
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols - 2; c++) {
                if (this.grid[r][c] !== null && this.grid[r][c+1] !== null && this.grid[r][c+2] !== null) {
                    const type = this.grid[r][c];
                    this.grid[r][c+1] = type;
                    this.grid[r][c+2] = type;
                    // Swap neighbor to create a match-able move
                    if (c < this.cols - 3) {
                        const currentIdx = this.allowedTypes.indexOf(type);
                        const nextIdx = (currentIdx + 1) % this.allowedTypes.length;
                        this.grid[r][c+3] = this.allowedTypes[nextIdx];
                    }
                    return;
                }
            }
        }
    }

    removeMatches(matches, isPowerUp = false) {
        const clearedObstacles = [];
        const flatMatches = matches.flat();
        const processedTiles = new Set();

        flatMatches.forEach(([r, c]) => {
            const key = `${r}-${c}`;
            if (processedTiles.has(key)) return;
            processedTiles.add(key);

            let crystalCleared = true;

            // Check if blocked by vines or frost
            if (this.vines[r][c] > 0) {
                this.vines[r][c] = 0; 
                clearedObstacles.push({ r, c, type: CONFIG.OBSTACLES.VINES });
                // Power-ups clear obstacles AND the crystal, matches only clear the obstacle
                // For level 77+, we always clear both to maintain "Fluid Odyssey" flow
                if (!isPowerUp && this.currentLevel < 77) crystalCleared = false;
            }

            if (this.frost[r][c] > 0) {
                this.frost[r][c] = 0; 
                clearedObstacles.push({ r, c, type: CONFIG.OBSTACLES.FROST });
                if (!isPowerUp && this.currentLevel < 77) crystalCleared = false;
            }

            // Power-ups clear stones directly
            if (isPowerUp && this.stones[r][c] > 0) {
                this.stones[r][c] = 0;
                clearedObstacles.push({ r, c, type: CONFIG.OBSTACLES.STONE });
            }

            if (crystalCleared && this.stones[r][c] === 0) {
                if (this.treasure[r][c]) {
                    this.treasure[r][c] = false;
                    clearedObstacles.push({ r, c, type: CONFIG.OBSTACLES.TREASURE });
                }
                this.grid[r][c] = null;
                this.specials[r][c] = null;
                this.bombCounters[r][c] = 0;
            }
        });

        // Stones clear on adjacent match (traditional match-3)
        flatMatches.forEach(([r, c]) => {
            const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
            neighbors.forEach(([nr, nc]) => {
                if (this.isInBounds(nr, nc)) {
                    if (this.stones[nr][nc] > 0) {
                        this.stones[nr][nc] = 0;
                        clearedObstacles.push({ r: nr, c: nc, type: CONFIG.OBSTACLES.STONE });
                    }
                }
            });
        });

        return clearedObstacles;
    }

    canSwap(r1, c1, r2, c2) {
        if (!this.isInBounds(r1, c1) || !this.isInBounds(r2, c2)) return false;
        // Holes prevent swapping always
        if (this.holes[r1][c1] > 0 || this.holes[r2][c2] > 0) return false;
        
        // For Level 77+, we ignore obstacles for swapping to ensure high fluidity
        if (this.currentLevel < 77) {
            if (this.stones[r1][c1] > 0 || this.stones[r2][c2] > 0) return false;
            if (this.vines[r1][c1] > 0 || this.vines[r2][c2] > 0) return false;
        }
        return true;
    }

    applyGravity(fruitProb = 0.05) {
        const movements = [];
        for (let c = 0; c < this.cols; c++) {
            // Drop existing pieces
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] === null && this.stones[r][c] === 0 && this.holes[r][c] === 0) {
                    // Find first movable piece above
                    for (let kr = r - 1; kr >= 0; kr--) {
                        if (this.holes[kr][c]) continue; // Skip holes when looking for pieces above
                        if (this.grid[kr][c] !== null && this.stones[kr][c] === 0 && this.vines[kr][c] === 0) {
                            this.grid[r][c] = this.grid[kr][c];
                            this.specials[r][c] = this.specials[kr][c];
                            this.bombCounters[r][c] = this.bombCounters[kr][c];
                            
                            movements.push({ 
                                from: [kr, c], 
                                to: [r, c], 
                                type: this.grid[r][c], 
                                specialType: this.specials[r][c],
                                bombCounter: this.bombCounters[r][c]
                            });

                            this.grid[kr][c] = null;
                            this.specials[kr][c] = null;
                            this.bombCounters[kr][c] = 0;
                            break;
                        } else if (this.stones[kr][c] > 0) {
                            break; 
                        }
                    }
                }
            }
            
            // Refill empty cells at the top
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.grid[r][c] === null && this.stones[r][c] === 0 && this.holes[r][c] === 0) {
                    const hasFruit = this.grid.some(row => row[c] === CONFIG.FRUIT_TYPE);
                    const type = (!hasFruit && Math.random() < fruitProb) ? CONFIG.FRUIT_TYPE : this.getRandomType();
                    
                    this.grid[r][c] = type;
                    this.specials[r][c] = null;
                    this.bombCounters[r][c] = 0;
                    
                    movements.push({ from: [r - this.rows, c], to: [r, c], type, isNew: true });
                }
            }
        }
        return movements;
    }
}
