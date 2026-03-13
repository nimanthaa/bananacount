/**
 * User Dashboard
 * Hub for players to access the game, view leaderboard, and manage account.
 */
import { getTopScores } from "./leaderboardManager.js";
import { getAdminLeaderboard } from "./adminManager.js"; // Re-use for full list
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase.js";

export async function renderUserDashboard(container, authManager, router) {
    const user = authManager.getCurrentUser();
    
    container.innerHTML = `
        <div class="admin-layout">
            <aside class="admin-sidebar">
                <div class="admin-brand">
                    <span class="admin-logo">🍌</span>
                    <span>Player Hub</span>
                </div>
                <nav class="admin-nav">
                    <button class="admin-nav-btn active" data-tab="home">
                        <span>🏠</span> Home
                    </button>
                    <button class="admin-nav-btn" data-tab="leaderboard">
                        <span>🏆</span> Leaderboard
                    </button>
                    <button class="admin-nav-btn" data-tab="settings">
                        <span>⚙️</span> Settings
                    </button>
                </nav>
                <button id="user-logout-btn" class="admin-logout-btn">
                    <span>🚪</span> Logout
                </button>
            </aside>
            <main class="admin-main" id="user-content">
                <div class="admin-loading">Loading hub...</div>
            </main>
        </div>
    `;

    const showTab = async (tab) => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        const content = document.getElementById('user-content');
        content.innerHTML = '<div class="admin-loading">Loading...</div>';

        switch (tab) {
            case 'home':      await renderHome(content, user, router); break;
            case 'leaderboard': await renderLeaderboard(content); break;
            case 'settings':    renderSettings(content, authManager, router); break;
        }
    };

    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    document.getElementById('user-logout-btn').addEventListener('click', async () => {
        await authManager.logout();
        router.navigateTo('/login');
    });

    await showTab('home');
}

async function renderHome(container, user, router) {
    // Fetch personal best from Firestore
    let personalBest = 0;
    let rank = "—";
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            personalBest = userDoc.data().totalScore || 0;
        }
    } catch (e) { console.error(e); }

    container.innerHTML = `
        <div class="admin-page-header">
            <h2>Welcome, ${user.displayName || 'Player'}!</h2>
            <p>Ready for more banana counting?</p>
        </div>
        
        <div class="stats-cards">
            <div class="stat-card">
                <div class="stat-card-icon">🍌</div>
                <div class="stat-card-val">${personalBest}</div>
                <div class="stat-card-lbl">Personal Best</div>
            </div>
            <div class="stat-card" style="background: rgba(255, 225, 53, 0.05); border-color: var(--color-primary);">
                <div class="stat-card-icon">🚀</div>
                <button id="play-game-btn" class="btn-primary" style="margin-top:0.5rem; border-radius:12px;">PLAY NOW</button>
            </div>
        </div>

        <div class="admin-card" style="margin-top:2rem;">
            <h3>Quick Tip</h3>
            <p style="color:var(--text-muted); margin-top:0.5rem;">
                The faster you solve, the more points you get! Watch out for the timer—it shrinks every 3 correct answers.
            </p>
        </div>
    `;

    document.getElementById('play-game-btn').onclick = () => {
        router.navigateTo('/game');
    };
}

async function renderLeaderboard(container) {
    const scores = await getAdminLeaderboard(50);
    container.innerHTML = `
        <div class="admin-page-header">
            <h2>World Leaderboard</h2>
            <p>See where you stand against other players</p>
        </div>
        <div class="admin-card">
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>Rank</th><th>Player</th><th>High Score</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        ${scores.map((s, i) => `
                            <tr>
                                <td><span class="rank-pill ${i < 3 ? 'rank-top' : ''}">${i + 1}</span></td>
                                <td><strong>${s.username}</strong></td>
                                <td style="color:var(--color-primary);font-weight:700;">${s.score}</td>
                                <td style="color:var(--text-muted);font-size:0.8rem;">${s.timestamp?.toDate?.()?.toLocaleDateString() || '—'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;">No scores yet</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSettings(container, authManager, router) {
    const user = authManager.getCurrentUser();
    container.innerHTML = `
        <div class="admin-page-header">
            <h2>Account Settings</h2>
            <p>Manage your profile and security</p>
        </div>

        <div class="admin-card" style="margin-bottom:1.5rem;">
            <h3>Profile Information</h3>
            <form id="update-profile-form" class="admin-form" style="margin-top:1rem;">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" id="set-username" value="${user.displayName || ''}" required>
                </div>
                <button type="submit" class="btn-admin-primary">Update Username</button>
                <div id="profile-msg" style="margin-top:0.5rem; font-size:0.85rem;"></div>
            </form>
        </div>

        <div class="admin-card" style="margin-bottom:1.5rem;">
            <h3>Security</h3>
            <form id="update-password-form" class="admin-form" style="margin-top:1rem;">
                <div class="form-group">
                    <label>Current Password</label>
                    <input type="password" id="cur-password" required>
                </div>
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="new-password" required>
                </div>
                <button type="submit" class="btn-admin-primary">Change Password</button>
                <div id="pass-msg" style="margin-top:0.5rem; font-size:0.85rem;"></div>
            </form>
        </div>

        <div class="admin-card" style="border-color: rgba(248, 113, 113, 0.3);">
            <h3 style="color:#f87171;">Danger Zone</h3>
            <p style="color:var(--text-muted); font-size:0.85rem; margin:0.5rem 0 1rem;">Once you delete your account, there is no going back. Please be certain.</p>
            <button id="delete-account-btn" class="btn-tbl-del" style="padding:0.6rem 1.2rem;">Delete Account</button>
        </div>

        <div id="modal-delete" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:100; align-items:center; justify-content:center;">
             <div class="glass-card" style="max-width:400px; padding:2rem;">
                <h3>Confirm Deletion</h3>
                <p style="margin:1rem 0; font-size:0.9rem;">To confirm, please enter your password:</p>
                <input type="password" id="del-password" placeholder="••••••••" style="margin-bottom:1.5rem;">
                <div style="display:flex; gap:1rem;">
                    <button id="confirm-del-btn" class="btn-primary" style="background:#f87171; color:white;">Delete Forever</button>
                    <button id="cancel-del-btn" class="btn-admin-ghost">Cancel</button>
                </div>
                <div id="del-error" style="color:#f87171; margin-top:1rem; font-size:0.85rem;"></div>
             </div>
        </div>
    `;

    const profileForm = document.getElementById('update-profile-form');
    const profileMsg = document.getElementById('profile-msg');
    profileForm.onsubmit = async (e) => {
        e.preventDefault();
        profileMsg.textContent = "Updating...";
        const res = await authManager.updateUsername(document.getElementById('set-username').value);
        profileMsg.textContent = res.success ? "✅ Username updated!" : "❌ " + res.message;
        profileMsg.style.color = res.success ? "var(--color-secondary)" : "#f87171";
    };

    const passForm = document.getElementById('update-password-form');
    const passMsg = document.getElementById('pass-msg');
    passForm.onsubmit = async (e) => {
        e.preventDefault();
        passMsg.textContent = "Updating...";
        const res = await authManager.updatePassword(
            document.getElementById('cur-password').value,
            document.getElementById('new-password').value
        );
        passMsg.textContent = res.success ? "✅ Password changed!" : "❌ " + res.message;
        passMsg.style.color = res.success ? "var(--color-secondary)" : "#f87171";
        if (res.success) passForm.reset();
    };

    const modal = document.getElementById('modal-delete');
    document.getElementById('delete-account-btn').onclick = () => modal.style.display = 'flex';
    document.getElementById('cancel-del-btn').onclick = () => modal.style.display = 'none';

    document.getElementById('confirm-del-btn').onclick = async () => {
        const pass = document.getElementById('del-password').value;
        if (!pass) return;
        const err = document.getElementById('del-error');
        err.textContent = "Deleting...";
        const res = await authManager.deleteAccount(pass);
        if (res.success) {
            router.navigateTo('/login');
        } else {
            err.textContent = "❌ " + res.message;
        }
    };
}
