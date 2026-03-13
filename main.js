import { AuthManager } from './src/authManager.js';
import { Router } from './src/router.js';
import { fetchPuzzle } from './src/apiManager.js';
import { GameTimer } from './src/timer.js';
import { ScoreManager } from './src/scoreManager.js';
import { UIManager } from './src/uiManager.js';
import { saveHighScore, getTopScores, subscribeToLiveLeaderboard } from './src/leaderboardManager.js';
import { renderUserDashboard } from './src/userDashboard.js';
import { isAdmin, startSession, endSession, logActivity } from './src/adminManager.js';
import { seedLevels, getLevelForScore } from './src/firestoreInit.js';
import { AudioManager } from './src/audioManager.js';

const auth = new AuthManager();
const audio = new AudioManager();
const app = document.getElementById('app');

// Store unsubscribe function for live leaderboard
let liveLeaderboardUnsub = null;
// Store current gameplay session ID
let currentSessionId = null;
let sessionStartTime = null;
let sessionRounds = 0;
let sessionPoints = 0;

// Seed Firestore levels on app load (no-op if already seeded)
seedLevels().catch(console.warn);

// --- VIEW GENERATORS ---

const renderLogin = (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="glass-card">
                <div class="auth-header">
                    <h1>Welcome Back</h1>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="email" placeholder="email address" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn-primary">Sign In</button>
                    <div id="auth-error" style="color: var(--color-accent); text-align: center; margin-top: 1rem; font-size: 0.8rem;"></div>
                </form>
                <div class="auth-footer">
                    Don't have an account? <a href="#" id="go-register">Sign up now</a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const res = await auth.login(email, password);
        if (res.success) {
            const adminFlag = await isAdmin(res.user.uid);
            router.navigateTo(adminFlag ? '/admin' : '/dashboard');
        } else {
            document.getElementById('auth-error').textContent = res.message;
        }
    };

    document.getElementById('go-register').onclick = (e) => {
        e.preventDefault();
        router.navigateTo('/register');
    };
};

const renderRegister = (container) => {
    container.innerHTML = `
        <div class="view-container">
            <div class="glass-card">
                <div class="auth-header">
                    <h1>Create Profile</h1>
                    <p>Enter a username to join the leaderboard</p>
                </div>
                <form id="register-form">
                    <div class="form-group">
                        <label>Username (Visible on Leaderboard)</label>
                        <input type="text" id="reg-username" placeholder="CountMaster99" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="reg-email" placeholder="email address" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="reg-password" placeholder="••••••••" required>
                    </div>
                    <div class="form-group">
                        <label>Confirm Password</label>
                        <input type="password" id="reg-confirm" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="btn-primary">Get Access</button>
                    <div id="reg-error" style="color: var(--color-accent); text-align: center; margin-top: 1rem; font-size: 0.8rem;"></div>
                </form>
                <div class="auth-footer">
                    Already have an account? <a href="#" id="go-login">Sign in</a>
                </div>
            </div>
        </div>
    `;

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        
        const res = await auth.register(email, password, confirm, username);
        if (res.success) router.navigateTo('/dashboard');
        else document.getElementById('reg-error').textContent = res.message;
    };

    document.getElementById('go-login').onclick = (e) => {
        e.preventDefault();
        router.navigateTo('/login');
    };
};

const renderGame = async (container) => {
    const user = auth.getCurrentUser();
    if (!user) {
        router.navigateTo('/login');
        return;
    }

    // Redirect admin away from game view
    const adminFlag = await isAdmin(user.uid);
    if (adminFlag) {
        router.navigateTo('/admin');
        return;
    }

    container.innerHTML = `
        <div class="game-container">
            <main class="glass-card">
                <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h1 style="color: var(--color-primary); font-size: 2rem;">Banana Count</h1>
                        <p style="color: var(--text-muted)">Welcome, <strong>${user.displayName || 'Player'}</strong></p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button id="mute-btn" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-vibrant); padding: 0.5rem 1rem; border-radius: 12px; cursor: pointer; font-size:1.2rem;">${audio.isMuted ? '🔇' : '🔊'}</button>
                        <button id="dashboard-btn" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: var(--text-vibrant); padding: 0.5rem 1rem; border-radius: 12px; cursor: pointer; font-weight:600;">Dashboard</button>
                        <button id="logout-btn" style="background: transparent; border: 1px solid var(--glass-border); color: rgba(248, 113, 113, 0.7); padding: 0.5rem 1rem; border-radius: 12px; cursor: pointer;">Logout</button>
                    </div>
                </header>

                <div class="puzzle-container" id="puzzle-host">
                    <div class="loader-spinner"></div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <input type="number" id="answer-input" placeholder="Value?" style="flex: 1; font-size: 1.5rem; text-align: center;">
                    <button id="submit-btn" class="btn-primary" style="width: auto; padding: 0 2.5rem; margin: 0;">SUBMIT</button>
                </div>
            </main>

            <aside class="stats-grid">
                <div class="glass-card" style="padding: 1.5rem; text-align: center;">
                    <h2 id="timer-display" style="font-size: 3rem; font-weight: 800; color: var(--color-accent);">15</h2>
                    <p class="stat-lbl">Seconds Left</p>
                </div>
                
                <div class="glass-card" style="padding: 1.5rem;">
                    <div class="stat-box" style="margin-bottom: 1rem;">
                        <span class="stat-val" id="score-display">0</span>
                        <span class="stat-lbl">Points</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-val" id="level-display">1</span>
                        <span class="stat-lbl">Level</span>
                    </div>
                </div>

                <!-- Leaderboard Section -->
                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="font-size: 1rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">World Leaderboard</h3>
                    <ul class="leaderboard-list" id="leaderboard-list">
                        <li style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding-top: 1rem;">Loading rankings...</li>
                    </ul>
                </div>
            </aside>
        </div>
    `;

    // Start a gameplay session
    sessionStartTime = Date.now();
    sessionRounds = 0;
    sessionPoints = 0;
    try {
        currentSessionId = await startSession(user.uid, user.displayName || user.email);
    } catch (e) { console.warn("Session start failed:", e); }

    initGameLogic();
    updateLeaderboard();
};

const renderAdmin = async (container) => {
    const user = auth.getCurrentUser();
    if (!user) { router.navigateTo('/login'); return; }

    const adminFlag = await isAdmin(user.uid);
    if (!adminFlag) { router.navigateTo('/game'); return; }

    await renderAdminDashboard(container, async () => {
        await auth.logout();
        router.navigateTo('/login');
    });
};

const renderDashboard = async (container) => {
    const user = auth.getCurrentUser();
    if (!user) { router.navigateTo('/login'); return; }

    const adminFlag = await isAdmin(user.uid);
    if (adminFlag) { router.navigateTo('/admin'); return; }

    await renderUserDashboard(container, auth, router);
};

// --- LOGIC & HELPERS ---

function renderLeaderboardScores(scores) {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    if (scores.length === 0) {
        list.innerHTML = '<li style="text-align: center; font-size: 0.8rem; color: var(--text-muted); padding: 1rem;">No scores yet!</li>';
        return;
    }
    list.innerHTML = scores.map((s, i) => `
        <li class="leaderboard-item">
            <span class="player-name">
                <span class="rank-pill ${i < 3 ? 'rank-top' : ''}">${i + 1}</span>
                ${s.username}
            </span>
            <span class="player-score">${s.score}</span>
        </li>
    `).join('');
}

async function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    // Initial load from Firestore
    const scores = await getTopScores(5);
    renderLeaderboardScores(scores);

    // Subscribe to live updates from Realtime Database
    if (liveLeaderboardUnsub) liveLeaderboardUnsub();
    liveLeaderboardUnsub = subscribeToLiveLeaderboard(5, (liveScores) => {
        renderLeaderboardScores(liveScores);
    });
}

function initGameLogic() {
    const ui = new UIManager();
    const score = new ScoreManager();
    // Start at 30s; timer duration recalculates each round based on level
    const timer = new GameTimer(30);
    let currentSolution = null;

    const startNewRound = async () => {
        ui.showLoading();
        timer.stop();
        // Apply level-based duration before every new round
        // Level 1 → 30s, Level 2 → 26s, Level 3 → 22s … min 6s
        timer.setDuration(score.getTimerDuration());
        const puzzle = await fetchPuzzle();
        if (puzzle) {
            currentSolution = puzzle.solution;
            ui.updatePuzzle(puzzle.question);
            audio.playBackground();
            timer.start();
        }
    };

    document.getElementById('mute-btn').onclick = () => {
        const isMuted = audio.toggleMute();
        document.getElementById('mute-btn').textContent = isMuted ? '🔇' : '🔊';
        if (!isMuted) audio.playBackground();
    };

    document.getElementById('submit-btn').onclick = async () => {
        const val = ui.getInputValue();
        if (val === currentSolution) {
            const pts = Math.max(10, timer.timeLeft);
            const leveledUp = score.addPoints(pts);
            sessionRounds++;
            sessionPoints += pts;
            ui.updateStats(score.score, score.level);

            if (leveledUp) {
                const newDuration = score.getTimerDuration();
                ui.setMessage(`🎉 Level ${score.level}! Timer: ${newDuration}s`);
            } else {
                ui.setMessage("Boom! +Points.");
            }

            // Save to leaderboard
            const user = auth.getCurrentUser();
            if (user) {
                await saveHighScore(user.displayName, score.score);

                // Log score event
                await logActivity({
                    userId:   user.uid,
                    username: user.displayName || user.email,
                    action:   "score",
                    details:  `Scored ${pts} pts (total: ${score.score}, level: ${score.level})`
                });

                updateLeaderboard();
            }
            
            setTimeout(startNewRound, 1000);
        } else {
            ui.setMessage("Try again!", "error");
        }
    };

    const cleanupSession = async () => {
        if (currentSessionId) {
            const durationSec = Math.floor((Date.now() - sessionStartTime) / 1000);
            await endSession(currentSessionId, {
                durationSec,
                roundsPlayed: sessionRounds,
                pointsEarned: sessionPoints
            });
            currentSessionId = null;
        }
    };

    document.getElementById('dashboard-btn').onclick = async () => {
        audio.stopBackground();
        if (liveLeaderboardUnsub) {
            liveLeaderboardUnsub();
            liveLeaderboardUnsub = null;
        }
        await cleanupSession();
        router.navigateTo('/dashboard');
    };

    document.getElementById('logout-btn').onclick = async () => {
        audio.stopBackground();
        // Clean up live leaderboard listener before logout
        if (liveLeaderboardUnsub) {
            liveLeaderboardUnsub();
            liveLeaderboardUnsub = null;
        }
        // End gameplay session
        await cleanupSession();
        await auth.logout();
        router.navigateTo('/login');
    };

    timer.onTick = (t) => {
        const display = document.getElementById('timer-display');
        if (display) display.textContent = t;
    };
    
    timer.onTimeUp = () => {
        audio.playGameOver();
        ui.setMessage("GAME OVER! Resetting...", "error");
        
        // Reset game state
        score.reset();
        ui.updateStats(score.score, score.level);
        
        setTimeout(startNewRound, 3000);
    };

    startNewRound();
}

// --- ROUTER & ENTRY ---

const routes = {
    '/login':     renderLogin,
    '/register':  renderRegister,
    '/game':      renderGame,
    '/admin':     renderAdmin,
    '/dashboard': renderDashboard
};

const router = new Router(app, routes);
router.init();

// Auth state redirect strategy
auth.onAuthStateChanged(async (user) => {
    if (user) {
        const path = window.location.pathname;
        const adminFlag = await isAdmin(user.uid);

        if (adminFlag) {
            if (path !== '/admin') router.navigateTo('/admin');
        } else {
            if (path === '/login' || path === '/register' || path === '/admin' || path === '/game') {
                router.navigateTo('/dashboard');
            }
        }
    } else {
        if (window.location.pathname !== '/register') {
            router.navigateTo('/login');
        }
    }
});
