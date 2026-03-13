/**
 * Score Manager
 * Tracks scores, levels, and correct answers.
 * Level increases every 3 correct answers.
 */

export class ScoreManager {
    constructor() {
        this.score = 0;
        this.level = 1;
        this.correctStreak = 0;
        this._prevLevel = 1;
    }

    /**
     * Add points and check for level-up.
     * @param {number} points
     * @returns {boolean} true if player just leveled up this call
     */
    addPoints(points = 10) {
        this._prevLevel = this.level;
        this.score += points;
        this.correctStreak++;

        // Level up every 3 correct answers
        if (this.correctStreak % 3 === 0) {
            this.level++;
        }

        return this.level > this._prevLevel;
    }

    /**
     * Returns the recommended timer duration for the current level.
     * Starts at 30s, decreases 4s per level, minimum 6s.
     * @returns {number} seconds
     */
    getTimerDuration() {
        return Math.max(6, 30 - (this.level - 1) * 4);
    }

    resetStreak() {
        this.correctStreak = 0;
    }

    getGameState() {
        return {
            score: this.score,
            level: this.level
        };
    }

    reset() {
        this.score = 0;
        this.level = 1;
        this.correctStreak = 0;
        this._prevLevel = 1;
    }
}
