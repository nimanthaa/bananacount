import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "firebase/firestore";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "firebase/auth";
import { auth, db } from "./firebase.js";

const DEFAULT_LEVELS = [
    { levelId: 1, name: "Beginner",     minScore: 0,    maxScore: 99,   description: "Just getting started!" },
    { levelId: 2, name: "Apprentice",   minScore: 100,  maxScore: 249,  description: "Finding your groove." },
    { levelId: 3, name: "Intermediate", minScore: 250,  maxScore: 499,  description: "Getting good at this." },
    { levelId: 4, name: "Advanced",     minScore: 500,  maxScore: 999,  description: "Sharp eyes, quick math." },
    { levelId: 5, name: "Expert",       minScore: 1000, maxScore: 1999, description: "Banana counting master." },
    { levelId: 6, name: "Legend",       minScore: 2000, maxScore: Infinity, description: "Beyond human limits." }
];

/**
 * Seeds the default `levels` collection in Firestore if it doesn't exist.
 */
export async function seedLevels() {
    for (const level of DEFAULT_LEVELS) {
        const ref = doc(db, "levels", String(level.levelId));
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, level);
        }
    }
}

/**
 * Ensures an admin user document exists in Firestore for admin@gmail.com.
 * Call this after the admin logs in for the first time.
 *
 * @param {string} uid - The Firebase Auth UID of the admin user
 */
export async function ensureAdminDoc(uid) {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, {
            uid,
            username: "Admin",
            email: "admin@gmail.com",
            role: "admin",
            level: 99,
            totalScore: 0,
            createdAt: serverTimestamp()
        });
    } else {
        // Ensure role is set to admin even if doc exists
        const data = snap.data();
        if (data.role !== "admin") {
            await setDoc(ref, { role: "admin" }, { merge: true });
        }
    }
}

/**
 * Creates a Firestore user doc for a newly registered player.
 *
 * @param {string} uid
 * @param {string} email
 * @param {string} username
 */
export async function createUserDoc(uid, email, username) {
    await setDoc(doc(db, "users", uid), {
        uid,
        username,
        email,
        role: "user",
        level: 1,
        totalScore: 0,
        createdAt: serverTimestamp()
    });
}

/**
 * Returns level info for a given score.
 * @param {number} score
 * @returns {{levelId: number, name: string}}
 */
export function getLevelForScore(score) {
    return DEFAULT_LEVELS.findLast(l => score >= l.minScore) || DEFAULT_LEVELS[0];
}
