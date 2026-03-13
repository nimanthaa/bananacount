import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    signOut, 
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    deleteUser
} from "firebase/auth";
import { auth } from "./firebase.js";
import { createUserDoc, ensureAdminDoc } from "./firestoreInit.js";
import { logActivity } from "./adminManager.js";

const ADMIN_EMAIL = "admin@gmail.com";

export class AuthManager {
    constructor() {
        this.user = auth.currentUser;
        onAuthStateChanged(auth, (user) => {
            this.user = user;
        });
    }

    async login(email, password) {
        try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            const user = credential.user;

            // Ensure admin doc is tagged correctly in Firestore
            if (email.toLowerCase() === ADMIN_EMAIL) {
                await ensureAdminDoc(user.uid);
            }

            await logActivity({
                userId:   user.uid,
                username: user.displayName || email,
                action:   "login",
                details:  `Signed in from web`
            });

            return { success: true, user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async register(email, password, confirmPassword, username) {
        if (password !== confirmPassword) {
            return { success: false, message: 'Passwords do not match.' };
        }
        if (!username || username.trim() === '') {
            return { success: false, message: 'Username is required.' };
        }

        try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(credential.user, { displayName: username });

            // Create Firestore user document
            await createUserDoc(credential.user.uid, email, username);

            await logActivity({
                userId:   credential.user.uid,
                username: username,
                action:   "register",
                details:  `New account created`
            });

            return { success: true, user: credential.user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async logout() {
        const user = auth.currentUser;
        if (user) {
            await logActivity({
                userId:   user.uid,
                username: user.displayName || user.email,
                action:   "logout",
                details:  `Signed out`
            });
        }
        await signOut(auth);
    }

    isAuthenticated() {
        return !!auth.currentUser;
    }

    getCurrentUser() {
        return auth.currentUser;
    }

    async updatePassword(currentPassword, newPassword) {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "Not logged in" };
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async updateUsername(newUsername) {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "Not logged in" };
        try {
            await updateProfile(user, { displayName: newUsername });
            await createUserDoc(user.uid, user.email, newUsername); // Re-use the doc creation helper to update
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async deleteAccount(password) {
        const user = auth.currentUser;
        if (!user) return { success: false, message: "Not logged in" };
        try {
            const credential = EmailAuthProvider.credential(user.email, password);
            await reauthenticateWithCredential(user, credential);
            
            // Clean up Firestore doc
            const { deleteUserDoc } = await import("./adminManager.js");
            await deleteUserDoc(user.uid);
            
            // Delete Auth user
            await deleteUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    onAuthStateChanged(callback) {
        return onAuthStateChanged(auth, callback);
    }
}
