import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    addDoc
} from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref as rtdbRef, onValue, query as rtdbQuery, orderByChild } from "firebase/database";
import { db, rtdb, auth } from "./firebase.js";

const USERS_COL        = "users";
const LOGS_COL         = "activityLogs";
const SESSIONS_COL     = "gameplaySessions";
const LEADERBOARD_COL  = "leaderboard";

// ─── Role check ───────────────────────────────────────────────────────────────

/**
 * Returns true if the given UID has role "admin" in Firestore.
 * @param {string} uid
 */
export async function isAdmin(uid) {
    if (!uid) return false;
    const snap = await getDoc(doc(db, USERS_COL, uid));
    return snap.exists() && snap.data().role === "admin";
}

// ─── User CRUD ────────────────────────────────────────────────────────────────

/**
 * Returns all user documents from Firestore.
 * @returns {Promise<Array>}
 */
export async function getAllUsers() {
    const snap = await getDocs(query(collection(db, USERS_COL), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to all users for real-time status updates in admin panel.
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToUsers(callback) {
    const q = query(collection(db, USERS_COL), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

/**
 * Creates a new Firebase Auth user + Firestore doc.
 * @param {{email, password, username, role}} data
 */
export async function createUser(data) {
    const { email, password, username, role = "user" } = data;
    // We use a secondary auth instance trick to avoid logging out the admin.
    // Since we can't use Admin SDK on the client, we create the account and
    // immediately write the Firestore doc. The admin stays signed in.
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: username });
    await setDoc(doc(db, USERS_COL, cred.user.uid), {
        uid: cred.user.uid,
        username,
        email,
        role,
        level: 1,
        totalScore: 0,
        createdAt: serverTimestamp()
    });
    return cred.user;
}

/**
 * Updates a Firestore user document.
 * @param {string} uid
 * @param {{username?, role?, level?}} data
 */
export async function updateUser(uid, data) {
    await updateDoc(doc(db, USERS_COL, uid), data);
}

/**
 * Deletes a Firestore user document.
 * Note: Firebase Auth entry must be removed manually from the Console
 * (Admin SDK is required for programmatic Auth deletion on the client).
 * @param {string} uid
 */
export async function deleteUserDoc(uid) {
    await deleteDoc(doc(db, USERS_COL, uid));
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

/**
 * Writes an activity log entry to Firestore.
 * @param {{userId, username, action, details}} entry
 */
export async function logActivity(entry) {
    try {
        await addDoc(collection(db, LOGS_COL), {
            ...entry,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.warn("logActivity failed:", e);
    }
}

/**
 * Fetches the most recent activity logs.
 * @param {number} maxResults
 */
export async function getActivityLogs(maxResults = 50) {
    const q = query(collection(db, LOGS_COL), orderBy("timestamp", "desc"), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to live activity log updates.
 * @param {number} maxResults
 * @param {Function} callback
 * @returns {Function} unsubscribe
 */
export function subscribeToActivityLogs(maxResults = 50, callback) {
    const q = query(collection(db, LOGS_COL), orderBy("timestamp", "desc"), limit(maxResults));
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
}

// ─── Gameplay Sessions ────────────────────────────────────────────────────────

/**
 * Starts a gameplay session document in Firestore.
 * @param {string} userId
 * @param {string} username
 * @returns {Promise<string>} session document ID
 */
export async function startSession(userId, username) {
    const ref = await addDoc(collection(db, SESSIONS_COL), {
        userId,
        username,
        startedAt: serverTimestamp(),
        endedAt: null,
        durationSec: 0,
        roundsPlayed: 0,
        pointsEarned: 0
    });
    return ref.id;
}

/**
 * Ends a gameplay session and writes final stats.
 * @param {string} sessionId
 * @param {{durationSec, roundsPlayed, pointsEarned}} stats
 */
export async function endSession(sessionId, stats) {
    if (!sessionId) return;
    await updateDoc(doc(db, SESSIONS_COL, sessionId), {
        endedAt: serverTimestamp(),
        ...stats
    });
}

/**
 * Fetches all gameplay sessions for the admin monitor.
 * @param {number} maxResults
 */
export async function getGameplaySessions(maxResults = 100) {
    const q = query(collection(db, SESSIONS_COL), orderBy("startedAt", "desc"), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/**
 * Fetches top leaderboard entries from Firestore for the admin panel.
 * @param {number} maxResults
 */
export async function getAdminLeaderboard(maxResults = 20) {
    const q = query(collection(db, LEADERBOARD_COL), orderBy("score", "desc"), limit(maxResults));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Stats Summary ────────────────────────────────────────────────────────────

/**
 * Returns high-level overview stats for the admin overview panel.
 */
export async function getOverviewStats() {
    const [usersSnap, leaderSnap, sessionsSnap] = await Promise.all([
        getDocs(collection(db, USERS_COL)),
        getDocs(query(collection(db, LEADERBOARD_COL), orderBy("score", "desc"), limit(1))),
        getDocs(query(collection(db, SESSIONS_COL), orderBy("startedAt", "desc"), limit(100)))
    ]);

    const totalUsers = usersSnap.size;
    const topScore = leaderSnap.empty ? 0 : leaderSnap.docs[0].data().score;
    const topPlayer = leaderSnap.empty ? "—" : leaderSnap.docs[0].data().username;

    // Calculate today's sessions
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todaySessions = sessionsSnap.docs.filter(d => {
        const ts = d.data().startedAt?.toDate?.();
        return ts && ts >= todayStart;
    });
    const totalPlayTimeSec = sessionsSnap.docs.reduce((acc, d) => acc + (d.data().durationSec || 0), 0);

    return { totalUsers, topScore, topPlayer, todaySessions: todaySessions.length, totalPlayTimeSec };
}
