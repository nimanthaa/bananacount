/**
 * Timer Module
 * Handles the game countdown.
 */

export class GameTimer {
    constructor(initialTime = 30) {
        this.initialTime = initialTime;
        this.timeLeft = initialTime;
        this.timerId = null;
        this.onTick = null;
        this.onTimeUp = null;
    }

    start() {
        this.stop();
        this.timeLeft = this.initialTime;
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
