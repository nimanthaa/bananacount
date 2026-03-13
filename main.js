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
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Bypassing Firebase Auth for admin as requested
        if (email === 'admin@gmail.com' && password === 'admin123') {
            sessionStorage.setItem('adminMode', 'true');
            router.navigateTo('/admin');
            return;
        }

        const res = await auth.login(email, password);
        if (res.success) {
            sessionStorage.removeItem('adminMode');
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

    const adminFlag = await isAdmin(user.uid);
    if (adminFlag) {
        router.navigateTo('/admin');
        return;
    }

    container.innerHTML = `
        <div class="game-container">
            <main class="glass-card" id="game-panel">
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

                <div id="char-message" style="text-align: center; margin-top: 1rem; min-height: 1.5rem; font-weight: 600; color: var(--color-secondary);"></div>

                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <input type="number" id="answer-input" placeholder="Value?" style="flex: 1; font-size: 1.5rem; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); border-radius: 12px; color: white;">
                    <button id="submit-btn" class="btn-primary" style="width: auto; padding: 0 2.5rem; margin: 0;">SUBMIT</button>
                </div>
            </main>

            <aside class="stats-grid">
                <div class="glass-card" style="padding: 1.5rem; text-align: center; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <svg width="120" height="120" viewBox="0 0 120 120" style="transform: rotate(-90deg);">
                        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" />
                        <circle id="timer-progress" cx="60" cy="60" r="54" fill="none" stroke="var(--color-primary)" stroke-width="8" 
                            stroke-dasharray="339.292" stroke-dashoffset="0" stroke-linecap="round" style="transition: stroke-dashoffset 1s linear, stroke 0.3s ease;" />
                    </svg>
                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                        <h2 id="timer-display" style="font-size: 2.5rem; font-weight: 800; color: white; margin: 0;">30</h2>
                    </div>
                    <p class="stat-lbl" style="margin-top: 0.5rem;">Seconds Left</p>
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

                <div class="glass-card" style="padding: 1.5rem;">
                    <h3 style="font-size: 1rem; text-transform: uppercase; color: var(--text-muted); text-align: center;">World Leaderboard</h3>
                    <ul class="leaderboard-list" id="leaderboard-list">
                        <li style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding-top: 1rem;">Loading rankings...</li>
                    </ul>
                </div>
            </aside>
        </div>

        <div id="game-over-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:1000; align-items:center; justify-content:center; backdrop-filter: blur(8px);">
            <div class="glass-card" style="width: 90%; max-width: 450px; text-align: center; padding: 3rem 2rem; border-color: var(--color-primary);">
                <span style="font-size: 4rem; display: block; margin-bottom: 1rem;">🍌</span>
                <h2 style="font-size: 2.5rem; font-weight: 800; color: white; margin-bottom: 0.5rem;">GAME OVER</h2>
                <p style="color: var(--text-muted); margin-bottom: 2rem;">You ran out of time!</p>
                
                <div style="background: rgba(255,255,255,0.05); border-radius: 16px; padding: 1.5rem; display: flex; justify-content: space-around; margin-bottom: 2rem;">
                    <div>
                        <div id="final-score" style="font-size: 2rem; font-weight: 800; color: var(--color-primary);">0</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Final Score</div>
                    </div>
                    <div>
                        <div id="final-level" style="font-size: 2rem; font-weight: 800; color: var(--color-primary);">1</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Max Level</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <button id="play-again-btn" class="btn-primary" style="margin: 0; padding: 1.2rem;">PLAY AGAIN</button>
                    <button id="back-to-hub-btn" style="background: transparent; border: 1px solid var(--glass-border); color: var(--text-vibrant); padding: 1rem; border-radius: 12px; cursor: pointer; font-weight: 600;">BACK TO DASHBOARD</button>
                </div>
            </div>
        </div>
    `;

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
    const isBypass = sessionStorage.getItem('adminMode') === 'true';

    if (!user && !isBypass) { 
        router.navigateTo('/login'); 
        return; 
    }

    if (user) {
        const adminFlag = await isAdmin(user.uid);
        if (!adminFlag && !isBypass) { router.navigateTo('/game'); return; }
    }

    await import('./src/adminDashboard.js').then(m => {
        m.renderAdminDashboard(container, async () => {
            sessionStorage.removeItem('adminMode');
            await auth.logout();
            router.navigateTo('/login');
        });
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

    const scores = await getTopScores(5);
    renderLeaderboardScores(scores);

    if (liveLeaderboardUnsub) liveLeaderboardUnsub();
    liveLeaderboardUnsub = subscribeToLiveLeaderboard(5, (liveScores) => {
        renderLeaderboardScores(liveScores);
    });
}

function initGameLogic() {
    const ui = new UIManager();
    const score = new ScoreManager();
    const timer = new GameTimer(30);
    let currentSolution = null;

    const startNewRound = async () => {
        ui.showLoading();
        timer.stop();
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
        if (!isNaN(val) && val == currentSolution) {
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

            const user = auth.getCurrentUser();
            if (user) {
                await saveHighScore(user.displayName, score.score);
                await logActivity({
                    userId: user.uid,
                    username: user.displayName || user.email,
                    action: "score",
                    details: `Scored ${pts} pts (total: ${score.score}, level: ${score.level})`
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
        if (liveLeaderboardUnsub) {
            liveLeaderboardUnsub();
            liveLeaderboardUnsub = null;
        }
        await cleanupSession();
        await auth.logout();
        router.navigateTo('/login');
    };

    timer.onTick = (t) => {
        const display = document.getElementById('timer-display');
        const progress = document.getElementById('timer-progress');
        if (display) display.textContent = t;
        if (progress) {
            const total = score.getTimerDuration();
            const offset = 339.292 - (t / total) * 339.292;
            progress.style.strokeDashoffset = offset;
            progress.style.stroke = t <= 5 ? '#f87171' : 'var(--color-primary)';
        }
    };
    
    timer.onTimeUp = async () => {
        audio.playGameOver();
        timer.stop();
        document.getElementById('final-score').textContent = score.score;
        document.getElementById('final-level').textContent = score.level;
        document.getElementById('game-over-modal').style.display = 'flex';
        await cleanupSession();
    };

    document.getElementById('play-again-btn').onclick = () => {
        document.getElementById('game-over-modal').style.display = 'none';
        score.reset();
        ui.updateStats(score.score, score.level);
        (async () => {
            const user = auth.getCurrentUser();
            sessionStartTime = Date.now();
            sessionRounds = 0;
            sessionPoints = 0;
            try {
                currentSessionId = await startSession(user.uid, user.displayName || user.email);
            } catch (e) { console.warn(e); }
            startNewRound();
        })();
    };

    document.getElementById('back-to-hub-btn').onclick = () => {
        if (liveLeaderboardUnsub) {
            liveLeaderboardUnsub();
            liveLeaderboardUnsub = null;
        }
        router.navigateTo('/dashboard');
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

auth.onAuthStateChanged(async (user) => {
    const path = window.location.pathname;
    const isBypass = sessionStorage.getItem('adminMode') === 'true';

    if (user || isBypass) {
        let adminFlag = isBypass;
        if (user && !adminFlag) adminFlag = await isAdmin(user.uid);

        if (adminFlag) {
            if (path !== '/admin') router.navigateTo('/admin');
        } else {
            if (path === '/login' || path === '/register' || path === '/admin' || path === '/game') {
                router.navigateTo('/dashboard');
            }
        }
    } else {
        if (path !== '/login' && path !== '/register') {
            router.navigateTo('/login');
        }
    }
});
