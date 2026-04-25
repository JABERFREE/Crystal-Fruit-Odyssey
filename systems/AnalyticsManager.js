/**
 * Crystal Fruit Odyssey - Automated Analytics Logger
 * Tracks player progression, milestones, and engagement metrics.
 * 
 * Optimized for production-ready reporting up to Level 25.
 */

class AnalyticsManager {
    constructor() {
        this.prefix = '💎 [Odyssey Analytics]';
        this.trackedMilestones = new Set();
        this.isProduction = true; // Toggle for detailed logging
    }

    log(eventName, params = {}) {
        const timestamp = new Date().toISOString();
        const data = {
            event: eventName,
            timestamp,
            ...params,
            session_id: this._getSessionId()
        };

        // Console logger (Production-grade formatting)
        const logStyle = 'color: #00ffff; font-weight: bold; background: #1a0a2e; padding: 2px 5px; border-radius: 3px;';
        console.log(`%c${this.prefix} ${eventName.toUpperCase()}`, logStyle, data);

        // Here is where you would integrate with a backend SDK (e.g., Firebase, Mixpanel, NexApp SDK)
        // Example: firebase.analytics().logEvent(eventName, params);
    }

    trackLevelStart(levelId) {
        this.log('level_start', { level_id: levelId });
    }

    trackLevelEnd(levelId, result, score, stars) {
        this.log('level_end', {
            level_id: levelId,
            result: result ? 'win' : 'fail',
            score: score,
            stars: stars,
            is_early_game: levelId <= 25
        });

        // Specific Milestone Tracking
        if (result && levelId === 18) {
            this.trackMilestone('mid_journey_boss_cleared', { level: 18 });
        }
        if (result && levelId === 25) {
            this.trackMilestone('first_biome_completed', { level: 25 });
        }
    }

    trackMilestone(milestoneName, params = {}) {
        if (this.trackedMilestones.has(milestoneName)) return;
        
        this.trackedMilestones.add(milestoneName);
        this.log('milestone_reached', {
            milestone: milestoneName,
            ...params
        });
    }

    trackEngagement(action, context = '') {
        this.log('engagement', { action, context });
    }

    _getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
        }
        return this.sessionId;
    }
}

export const analyticsManager = new AnalyticsManager();
