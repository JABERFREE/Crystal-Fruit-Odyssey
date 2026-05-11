export const getLevelData = (level) => {
    const id = Math.max(1, level); // Removed the 50 cap to allow for infinite odyssey
    
    // Difficulty progression factors - cycling every 50 levels for base logic
    const cycleId = ((id - 1) % 50) + 1;
    const type = id % 6;
    const baseMoves = 20;
    const moves = baseMoves + Math.floor(id / 2);
    const goalCount = 15 + Math.floor(id * 1.5);
    const targetScore = 500 + (id * 300);
    
    // Feature probability curve
    let frostProb = 0;
    let stoneProb = 0;
    let vineProb = 0;
    let bombs = [];

    if (id > 5 && id <= 15) {
        // Levels 6-15: Intro to Vines
        vineProb = 0.05 + (id - 5) * 0.02;
    } else if (id > 15 && id <= 25) {
        // Levels 16-25: Frozen Gems + Vines
        frostProb = 0.1 + (id - 15) * 0.03;
        vineProb = 0.1;
    } else if (id > 25 && id < 77) {
        // Levels 26-76: Crystal Stones + High Frost + Vines
        frostProb = 0.2 + (id - 25) * 0.01;
        stoneProb = 0.05 + (id - 25) * 0.01;
        vineProb = 0.15;
    } else if (id >= 77) {
        // Level 77+: "Expanded Infinite Odyssey" - Focused on Flow & High Score
        // Removing gameplay barriers while maintaining aesthetic
        frostProb = 0;
        stoneProb = 0;
        vineProb = 0;
        // Higher probability for special fruits to keep it exciting
    }

    // Add some bombs for flavor in mid-to-high levels
    if (id % 5 === 0 && id >= 10) {
        bombs = [
            { r: 2, c: 2, count: 10 - Math.floor(id/10) },
            { r: 2, c: 5, count: 10 - Math.floor(id/10) }
        ];
    }

    // New Level Objective System: 
    // Levels divisible by 3 now have Star Gem goals
    const starGoalCount = id % 3 === 0 ? Math.floor(2 + id / 10) : 0;

    // Type selection logic based on difficulty
    let allowedTypes = [0, 1, 2, 3]; // Default start
    if (id > 5 && id <= 12) allowedTypes = [0, 1, 2, 3, 4];
    else if (id > 12 && id <= 25) allowedTypes = [0, 1, 2, 3, 4, 5];
    else if (id > 25 && id <= 35) {
        // Biome 2 starts: Varied sets of 6
        const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        // Pick 6 unique ones, ensuring at least some variety
        allowedTypes = [0, 1, 2, 3, 4, 5]; 
        if (id % 2 === 0) allowedTypes = [0, 1, 2, 6, 7, 8]; // Mix in some variants
    } else if (id > 35) {
        // Late game: 7+ types or very similar types
        allowedTypes = [0, 1, 2, 3, 4, 5, 6, 7]; // 8 types makes it quite hard
        if (id > 45) allowedTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // All 10 types! Very hard.
    }

    // Adjust goal type to be one of the allowed types
    const goalType = allowedTypes[id % allowedTypes.length];

    let holes = null;
    if (id === 18) {
        // Milestone Level 18: Special Challenge
        return {
            id,
            goal: { type: cycleId % 6, count: 50 },
            starGoal: 5,
            moves: 25,
            frostProb: 0.1,
            stoneProb: 0.1,
            vineProb: 0.1,
            fruitProb: 0.03,
            targetScore: 15000,
            bombs: [{ r: 3, c: 3, count: 12 }],
            holes: [[0,0], [0,7], [7,0], [7,7]],
            allowedTypes: [0, 1, 2, 3, 4, 5]
        };
    }

    if (id === 50) {
        // Level 50 Finale: Unique shape and mega-bombs
        holes = [
            [0, 0], [0, 1], [0, 6], [0, 7],
            [1, 0], [1, 7],
            [6, 0], [6, 7],
            [7, 0], [7, 1], [7, 6], [7, 7]
        ];
        bombs = [
            { r: 2, c: 2, count: 8 },
            { r: 2, c: 5, count: 8 },
            { r: 5, c: 2, count: 8 },
            { r: 5, c: 5, count: 8 }
        ];
        stoneProb = 0.15;
        frostProb = 0.3;
        vineProb = 0.2;
        allowedTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Ultimate challenge
    }

    return {
        id,
        goal: { type: goalType, count: goalCount },
        starGoal: starGoalCount,
        moves,
        frostProb,
        stoneProb,
        vineProb,
        fruitProb: id >= 77 ? 0.04 : (0.01 + (id * 0.005)), // Higher special fruit density for Level 77+
        targetScore,
        bombs,
        holes,
        allowedTypes
    };
};
