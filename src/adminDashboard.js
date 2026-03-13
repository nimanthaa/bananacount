import {
    getAllUsers,
    subscribeToUsers,
    createUser,
    updateUser,
    deleteUserDoc,
    getAdminLeaderboard,
    subscribeToActivityLogs,
    getGameplaySessions,
    getOverviewStats
} from "./adminManager.js";

const ADMIN_EMAIL = "admin@gmail.com";

/**
 * Renders the full Admin Dashboard into the given container.
 * @param {HTMLElement} container
 * @param {Function} onLogout - called when admin clicks logout
 */
export async function renderAdminDashboard(container, onLogout) {
    container.innerHTML = `
        <div class="admin-layout">
            <aside class="admin-sidebar">
                <div class="admin-brand">
                    <span class="admin-logo">🍌</span>
                    <span>Admin Panel</span>
                </div>
                <nav class="admin-nav">
                    <button class="admin-nav-btn active" data-tab="overview">
                        <span>📊</span> Overview
                    </button>
                    <button class="admin-nav-btn" data-tab="users">
                        <span>👥</span> Users
                    </button>
                    <button class="admin-nav-btn" data-tab="leaderboard">
                        <span>🏆</span> Leaderboard
                    </button>
                    <button class="admin-nav-btn" data-tab="logs">
                        <span>📋</span> Activity Logs
                    </button>
                    <button class="admin-nav-btn" data-tab="monitor">
                        <span>🎮</span> Monitor
                    </button>
                </nav>
                <button id="admin-logout-btn" class="admin-logout-btn">
                    <span>🚪</span> Logout
                </button>
            </aside>
            <main class="admin-main" id="admin-content">
                <div class="admin-loading">Loading dashboard...</div>
            </main>
        </div>
    `;

    // Tab navigation
    let activeLiveUnsub = null;

    const showTab = async (tab) => {
        if (activeLiveUnsub) { activeLiveUnsub(); activeLiveUnsub = null; }
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        const content = document.getElementById('admin-content');
        content.innerHTML = '<div class="admin-loading">Loading...</div>';

        switch (tab) {
            case 'overview':    activeLiveUnsub = await renderOverview(content); break;
            case 'users':       activeLiveUnsub = await renderUsers(content); break;
            case 'leaderboard': await renderLeaderboard(content); break;
            case 'logs':        activeLiveUnsub = renderLogs(content); break;
            case 'monitor':     await renderMonitor(content); break;
        }
    };

    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
    });

    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        if (activeLiveUnsub) activeLiveUnsub();
        onLogout();
    });

    await showTab('overview');
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

async function renderOverview(container) {
    const stats = await getOverviewStats();
    const playHours = Math.floor(stats.totalPlayTimeSec / 3600);
    const playMins  = Math.floor((stats.totalPlayTimeSec % 3600) / 60);

    container.innerHTML = `
        <div class="admin-page-header">
            <h2>Dashboard Overview</h2>
            <p>Welcome back, Admin!</p>
        </div>
        <div class="stats-cards">
            <div class="stat-card">
                <div class="stat-card-icon">👥</div>
                <div class="stat-card-val">${stats.totalUsers}</div>
                <div class="stat-card-lbl">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon">🎮</div>
                <div class="stat-card-val">${stats.todaySessions}</div>
                <div class="stat-card-lbl">Sessions Today</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon">🏆</div>
                <div class="stat-card-val">${stats.topScore}</div>
                <div class="stat-card-lbl">Top Score</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon">⏱️</div>
                <div class="stat-card-val">${playHours}h ${playMins}m</div>
                <div class="stat-card-lbl">Total Play Time</div>
            </div>
        </div>
        <div class="admin-card" style="margin-top:1.5rem;">
            <h3>Top Player</h3>
            <p style="font-size:1.5rem; font-weight:700; color:var(--color-primary); margin-top:0.5rem;">
                🥇 ${stats.topPlayer} &nbsp;<span style="color:var(--text-muted);font-size:1rem;">(${stats.topScore} pts)</span>
            </p>
        </div>
    `;
    return null; // no live unsub needed
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

async function renderUsers(container) {
    container.innerHTML = `
        <div class="admin-page-header">
            <h2>User Management</h2>
            <button class="btn-admin-primary" id="create-user-btn">+ Create User</button>
        </div>

        <!-- Create / Edit Form (hidden by default) -->
        <div class="admin-card" id="user-form-card" style="display:none; margin-bottom:1.5rem;">
            <h3 id="form-title">Create New User</h3>
            <form id="user-form" class="admin-form">
                <input type="hidden" id="edit-uid">
                <div class="form-row">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="f-username" placeholder="CountMaster99" required>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="f-email" placeholder="user@example.com" required>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Password <span id="pw-hint" style="font-size:0.75rem;color:var(--text-muted)">(required for new users)</span></label>
                        <input type="password" id="f-password" placeholder="••••••••">
                    </div>
                    <div class="form-group">
                        <label>Role</label>
                        <select id="f-role">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex;gap:1rem;margin-top:1rem;">
                    <button type="submit" class="btn-admin-primary" id="form-submit-btn">Create User</button>
                    <button type="button" class="btn-admin-ghost" id="cancel-form-btn">Cancel</button>
                </div>
                <div id="form-error" style="color:#f87171;margin-top:0.5rem;font-size:0.85rem;"></div>
            </form>
        </div>

        <!-- Users Table -->
        <div class="admin-card">
            <div class="admin-table-wrap">
                <table class="admin-table" id="users-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Level</th>
                            <th>Score</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody">
                        <tr><td colspan="7" style="text-align:center;padding:2rem">Loading users...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    setupUserFormHandlers(container);

    // Live subscription
    const tbody = document.getElementById('users-tbody');
    return subscribeToUsers(
        (users) => {
            if (tbody) tbody.innerHTML = renderUserRows(users);
        },
        (err) => {
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#f87171;padding:2rem">
                    <strong>Error:</strong> ${err.code === 'permission-denied' ? 'Permission Denied (Sign-in required)' : err.message}
                </td></tr>`;
            }
        }
    );
}

function renderUserRows(users) {
    if (!users.length) return `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No users found</td></tr>`;
    return users.map(u => `
        <tr data-uid="${u.id}">
            <td>
                <span class="status-indicator ${u.isOnline ? 'status-online' : 'status-offline'}"></span>
                <span style="font-size:0.75rem; color:var(--text-muted)">${u.isOnline ? 'Online' : 'Offline'}</span>
            </td>
            <td><strong>${u.username || '—'}</strong></td>
            <td>${u.email || '—'}</td>
            <td><span class="role-badge role-${u.role || 'user'}">${u.role || 'user'}</span></td>
            <td>${u.level || 1}</td>
            <td>${u.totalScore || 0}</td>
            <td>
                <button class="btn-tbl-edit" data-uid="${u.id}" 
                    data-username="${u.username || ''}" 
                    data-email="${u.email || ''}" 
                    data-role="${u.role || 'user'}">Edit</button>
                <button class="btn-tbl-del" data-uid="${u.id}" ${u.email === ADMIN_EMAIL ? 'disabled title="Cannot delete admin"' : ''}>Delete</button>
            </td>
        </tr>
    `).join('');
}

function setupUserFormHandlers(container) {
    const formCard   = document.getElementById('user-form-card');
    const form       = document.getElementById('user-form');
    const formTitle  = document.getElementById('form-title');
    const submitBtn  = document.getElementById('form-submit-btn');
    const pwHint     = document.getElementById('pw-hint');
    const errDiv     = document.getElementById('form-error');
    let editMode = false;

    document.getElementById('create-user-btn').addEventListener('click', () => {
        editMode = false;
        formTitle.textContent = 'Create New User';
        submitBtn.textContent = 'Create User';
        form.reset();
        document.getElementById('edit-uid').value = '';
        document.getElementById('f-email').disabled = false;
        document.getElementById('f-password').required = true;
        pwHint.textContent = '(required for new users)';
        formCard.style.display = 'block';
    });

    document.getElementById('cancel-form-btn').addEventListener('click', () => {
        formCard.style.display = 'none';
        form.reset();
    });

    // Edit buttons
    container.addEventListener('click', async (e) => {
        const uid = e.target.dataset.uid;

        if (e.target.classList.contains('btn-tbl-edit')) {
            editMode = true;
            formTitle.textContent = 'Edit User';
            submitBtn.textContent = 'Save Changes';
            document.getElementById('edit-uid').value = uid;
            document.getElementById('f-username').value = e.target.dataset.username;
            document.getElementById('f-email').value = e.target.dataset.email;
            document.getElementById('f-email').disabled = true;
            document.getElementById('f-role').value = e.target.dataset.role;
            document.getElementById('f-password').required = false;
            pwHint.textContent = '(leave blank to keep unchanged)';
            formCard.style.display = 'block';
            formCard.scrollIntoView({ behavior: 'smooth' });
        }

        if (e.target.classList.contains('btn-tbl-del')) {
            if (!confirm(`Delete user ${uid}? This removes their Firestore record.`)) return;
            try {
                await deleteUserDoc(uid);
                e.target.closest('tr').remove();
            } catch (err) {
                alert('Delete failed: ' + err.message);
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errDiv.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const username = document.getElementById('f-username').value.trim();
        const email    = document.getElementById('f-email').value.trim();
        const password = document.getElementById('f-password').value;
        const role     = document.getElementById('f-role').value;
        const uid      = document.getElementById('edit-uid').value;

        try {
            if (editMode && uid) {
                await updateUser(uid, { username, role });
                // Refresh row
                const row = document.querySelector(`tr[data-uid="${uid}"]`);
                if (row) {
                    row.querySelector('td:nth-child(1)').innerHTML = `<strong>${username}</strong>`;
                    row.querySelector('td:nth-child(3)').innerHTML = `<span class="role-badge role-${role}">${role}</span>`;
                }
            } else {
                if (!password) { errDiv.textContent = 'Password is required.'; return; }
                await createUser({ email, password, username, role });
                // Re-render table
                const users = await getAllUsers();
                document.getElementById('users-tbody').innerHTML = renderUserRows(users);
            }
            formCard.style.display = 'none';
            form.reset();
        } catch (err) {
            errDiv.textContent = 'Error: ' + err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = editMode ? 'Save Changes' : 'Create User';
        }
    });
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────

async function renderLeaderboard(container) {
    const scores = await getAdminLeaderboard(20);
    container.innerHTML = `
        <div class="admin-page-header">
            <h2>World Leaderboard</h2>
            <p>Top 20 all-time scores</p>
        </div>
        <div class="admin-card">
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>#</th><th>Player</th><th>Score</th><th>Recorded At</th></tr>
                    </thead>
                    <tbody>
                        ${scores.map((s, i) => `
                            <tr>
                                <td><span class="rank-pill ${i < 3 ? 'rank-top' : ''}">${i + 1}</span></td>
                                <td><strong>${s.username}</strong></td>
                                <td style="color:var(--color-primary);font-weight:700;">${s.score}</td>
                                <td style="color:var(--text-muted);font-size:0.8rem;">${s.timestamp?.toDate?.()?.toLocaleString() || '—'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted)">No scores yet</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ─── Activity Logs Tab ────────────────────────────────────────────────────────

function renderLogs(container) {
    container.innerHTML = `
        <div class="admin-page-header">
            <h2>Activity Logs</h2>
            <p>Live feed — updates in real-time</p>
        </div>
        <div class="admin-card">
            <div class="log-feed" id="log-feed">
                <div style="text-align:center;padding:2rem;color:var(--text-muted)">Connecting...</div>
            </div>
        </div>
    `;

    const feed = document.getElementById('log-feed');

    const unsub = subscribeToActivityLogs(50, (logs) => {
        if (!feed) return;
        if (logs.length === 0) {
            feed.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted)">No activity yet</div>';
            return;
        }
        feed.innerHTML = logs.map(l => `
            <div class="log-entry">
                <span class="log-action log-${l.action?.replace(/\s+/g, '-').toLowerCase()}">${l.action || 'event'}</span>
                <span class="log-user">${l.username || l.userId || 'unknown'}</span>
                <span class="log-detail">${l.details || ''}</span>
                <span class="log-time">${l.timestamp?.toDate?.()?.toLocaleString() || ''}</span>
            </div>
        `).join('');
    });

    return unsub;
}

// ─── Gameplay Monitor Tab ─────────────────────────────────────────────────────

async function renderMonitor(container) {
    const sessions = await getGameplaySessions(100);

    // Aggregate by user
    const byUser = {};
    sessions.forEach(s => {
        if (!byUser[s.userId]) {
            byUser[s.userId] = { username: s.username, sessions: 0, totalSec: 0, totalRounds: 0, totalPoints: 0 };
        }
        byUser[s.userId].sessions++;
        byUser[s.userId].totalSec    += s.durationSec    || 0;
        byUser[s.userId].totalRounds += s.roundsPlayed   || 0;
        byUser[s.userId].totalPoints += s.pointsEarned   || 0;
    });

    const rows = Object.values(byUser).sort((a, b) => b.totalPoints - a.totalPoints);

    container.innerHTML = `
        <div class="admin-page-header">
            <h2>Gameplay Monitor</h2>
            <p>Aggregated per-player statistics from all sessions</p>
        </div>
        <div class="admin-card">
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Sessions</th>
                            <th>Total Play Time</th>
                            <th>Rounds Played</th>
                            <th>Points Earned</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length === 0
                            ? '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">No sessions recorded yet</td></tr>'
                            : rows.map(r => `
                                <tr>
                                    <td><strong>${r.username}</strong></td>
                                    <td>${r.sessions}</td>
                                    <td>${Math.floor(r.totalSec / 60)}m ${r.totalSec % 60}s</td>
                                    <td>${r.totalRounds}</td>
                                    <td style="color:var(--color-primary);font-weight:700;">${r.totalPoints}</td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>

        <div class="admin-page-header" style="margin-top:2rem;">
            <h2>Recent Sessions</h2>
        </div>
        <div class="admin-card">
            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr><th>Player</th><th>Started</th><th>Duration</th><th>Rounds</th><th>Points</th></tr>
                    </thead>
                    <tbody>
                        ${sessions.slice(0, 20).map(s => `
                            <tr>
                                <td><strong>${s.username}</strong></td>
                                <td style="font-size:0.8rem;color:var(--text-muted)">${s.startedAt?.toDate?.()?.toLocaleString() || '—'}</td>
                                <td>${s.durationSec || 0}s</td>
                                <td>${s.roundsPlayed || 0}</td>
                                <td style="color:var(--color-primary);font-weight:700;">${s.pointsEarned || 0}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" style="text-align:center;padding:1rem;color:var(--text-muted)">No sessions</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
