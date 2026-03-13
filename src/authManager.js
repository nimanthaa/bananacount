import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    updateProfile, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";
import { auth } from "./firebase.js";

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
            return { success: true, user: credential.user };
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
            return { success: true, user: credential.user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async logout() {
        await signOut(auth);
    }

    isAuthenticated() {
        return !!auth.currentUser;
    }

    getCurrentUser() {
        return auth.currentUser;
    }
}
