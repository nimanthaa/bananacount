/**
 * Timer Module
 * Handles the game countdown.
 * Duration can be updated between rounds to support difficulty scaling.
 */

export class GameTimer {
    constructor(initialTime = 30) {
        this.initialTime = initialTime;
        this.timeLeft = initialTime;
        this.timerId = null;
        this.onTick = null;
        this.onTimeUp = null;
    }

    /**
     * Update the time for the next round without restarting.
     * @param {number} seconds
     */
    setDuration(seconds) {
        this.initialTime = seconds;
    }

    start() {
        this.stop();
        this.timeLeft = this.initialTime;
        if (this.onTick) this.onTick(this.timeLeft); // show immediately
        this.timerId = setInterval(() => {
            this.timeLeft--;
            if (this.onTick) this.onTick(this.timeLeft);
            
            if (this.timeLeft <= 0) {
                this.stop();
                if (this.onTimeUp) this.onTimeUp();
            }
        }, 1000);
    }

    stop() {
        if (this.timerId) {
            clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    reset() {
        this.stop();
        this.timeLeft = this.initialTime;
    }
}
