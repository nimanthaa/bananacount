/**
 * Score Manager
 * Tracks scores, levels, and correct answers.
 */

export class ScoreManager {
    constructor() {
        this.score = 0;
        this.level = 1;
        this.correctStreak = 0;
    }

    addPoints(points = 10) {
        this.score += points;
        this.correctStreak++;
        
        // Level up every 3 correct answers
        if (this.correctStreak % 3 === 0) {
            this.level++;
        }
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
    }
}
