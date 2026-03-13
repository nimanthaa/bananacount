/**
 * UI Manager
 * Handles all DOM manipulations and visual feedback.
 */

export class UIManager {
    constructor() {
        this.selectors = {
            puzzleHost: document.getElementById('puzzle-host'),
            answerInput: document.getElementById('answer-input'),
            submitBtn: document.getElementById('submit-btn'),
            timerDisplay: document.getElementById('timer-display'),
            timerProgress: document.getElementById('timer-progress'),
            scoreDisplay: document.getElementById('score-display'),
            levelDisplay: document.getElementById('level-display'),
            charMessage: document.getElementById('char-message'),
            gamePanel: document.getElementById('game-panel')
        };
        
        this.circleCircumference = 339.292; // 2 * PI * 54
    }

    updatePuzzle(imageUrl) {
        this.selectors.puzzleHost.innerHTML = `<img src="${imageUrl}" alt="Banana Puzzle">`;
        this.selectors.answerInput.value = '';
        this.selectors.answerInput.focus();
    }

    updateTimer(seconds, totalSeconds = 30) {
        this.selectors.timerDisplay.textContent = seconds;
        const offset = this.circleCircumference - (seconds / totalSeconds) * this.circleCircumference;
        this.selectors.timerProgress.style.strokeDashoffset = offset;
        
        // Change color when time is low
        if (seconds <= 5) {
            this.selectors.timerProgress.style.stroke = 'var(--error)';
        } else {
            this.selectors.timerProgress.style.stroke = 'var(--accent-secondary)';
        }
    }

    updateStats(score, level) {
        this.selectors.scoreDisplay.textContent = score;
        this.selectors.levelDisplay.textContent = level;
    }

    setMessage(text, type = 'normal') {
        this.selectors.charMessage.textContent = text;
        
        if (type === 'success') {
            this.selectors.gamePanel.classList.add('correct-flash');
            setTimeout(() => this.selectors.gamePanel.classList.remove('correct-flash'), 500);
        } else if (type === 'error') {
            this.selectors.gamePanel.classList.add('shake');
            setTimeout(() => this.selectors.gamePanel.classList.remove('shake'), 400);
        }
    }

    showLoading() {
        this.selectors.puzzleHost.innerHTML = '<div class="loader">Loading new challenge...</div>';
    }

    getInputValue() {
        return parseInt(this.selectors.answerInput.value);
    }
}
