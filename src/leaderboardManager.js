import {
    collection,
    addDoc,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp
} from "firebase/firestore";
import {
    ref,
    set,
    get,
    onValue,
    query as rtdbQuery,
    orderByChild,
    limitToLast
} from "firebase/database";
import { db, rtdb } from "./firebase.js";

const LEADERBOARD_COLLECTION = "leaderboard";
const RTDB_LEADERBOARD_PATH = "leaderboard";

/**
 * Saves a high score to BOTH Firestore and Realtime Database.
 *
 * Firestore  → stores the full history of every score submitted
 * Realtime DB → stores each user's personal best (live-synced key-value)
 *
 * @param {string} username - Player display name
 * @param {number} score    - Score to save
 */
export const saveHighScore = async (username, score) => {
    try {
        // 1. Append to Firestore history
        await addDoc(collection(db, LEADERBOARD_COLLECTION), {
            username,
            score,
            timestamp: serverTimestamp()
        });

        // 2. Update Realtime DB only if this beats the player's current best
        const safeKey = username.replace(/[.#$\[\]]/g, '_');
        const rtdbRef = ref(rtdb, `${RTDB_LEADERBOARD_PATH}/${safeKey}`);
        const snapshot = await get(rtdbRef);
        const existing = snapshot.exists() ? snapshot.val() : null;

        if (!existing || score > existing.score) {
            await set(rtdbRef, {
                username,
                score,
                updatedAt: Date.now()
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Error saving score:", error);
        return { success: false };
    }
};

/**
 * Fetches the top N scores from Firestore (history-based, sorted server-side).
 *
 * @param {number} maxResults
 * @returns {Promise<Array<{username: string, score: number}>>}
 */
export const getTopScores = async (maxResults = 5) => {
    try {
        const q = query(
            collection(db, LEADERBOARD_COLLECTION),
            orderBy("score", "desc"),
            limit(maxResults)
        );
        const querySnapshot = await getDocs(q);
        const scores = [];
        querySnapshot.forEach((doc) => {
            scores.push(doc.data());
        });
        return scores;
    } catch (error) {
        console.error("Error fetching leaderboard from Firestore:", error);
        return [];
    }
};

/**
 * Subscribes to real-time leaderboard updates from Firebase Realtime Database.
 * Calls `callback` immediately with current data and on every subsequent change.
 *
 * @param {number}   maxResults - Max entries to return (sorted by score desc)
 * @param {Function} callback   - Called with Array<{username, score}> on each change
 * @returns {Function} unsubscribe – call to stop listening
 */
export const subscribeToLiveLeaderboard = (maxResults = 5, callback) => {
    const leaderRef = rtdbQuery(
        ref(rtdb, RTDB_LEADERBOARD_PATH),
        orderByChild("score"),
        limitToLast(maxResults)       // limitToLast gives highest scores when ordered asc
    );

    const unsubscribe = onValue(leaderRef, (snapshot) => {
        const raw = snapshot.val();
        if (!raw) { callback([]); return; }

        // Convert to array and sort descending
        const sorted = Object.values(raw)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        callback(sorted);
    }, (error) => {
        console.error("Realtime DB leaderboard error:", error);
        callback([]);
    });

    return unsubscribe;
};
