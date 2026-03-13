/**
 * Audio Manager
 * Handles background music, game over sounds, and mute states.
 */
export class AudioManager {
    constructor() {
        this.isMuted = localStorage.getItem('gameMuted') === 'true';
        
        // Background Music
        this.bgMusic = new Audio('/src/assets/mondamusic-retro-arcade-game-music-491667.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;

        // Game Over Music
        this.gameOverMusic = new Audio('/src/assets/delon_boomkin-game-over-retro-arcade-game-422478.mp3');
        this.gameOverMusic.volume = 0.6;
    }

    playBackground() {
        if (this.isMuted) return;
        this.bgMusic.play().catch(e => console.warn("Auto-play blocked or audio error:", e));
    }

    stopBackground() {
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
    }

    playGameOver() {
        if (this.isMuted) return;
        this.stopBackground();
        this.gameOverMusic.play().catch(e => console.warn("Audio error:", e));
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('gameMuted', this.isMuted);
        
        if (this.isMuted) {
            this.bgMusic.pause();
            this.gameOverMusic.pause();
        } else {
            // Only resume background music if it was playing (manual logic in main.js handles this)
        }
        
        return this.isMuted;
    }
}
