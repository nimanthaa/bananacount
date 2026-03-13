import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase configuration for the Banana Count game
const firebaseConfig = {
  apiKey: "AIzaSyAsBXARA228VYA3KSfvZHTkyDkjzl5nvWU",
  authDomain: "bananacount-6812f.firebaseapp.com",
  projectId: "bananacount-6812f",
  storageBucket: "bananacount-6812f.firebasestorage.app",
  messagingSenderId: "599718506380",
  appId: "1:599718506380:web:ec6acebb4a85591732b0a9",
  measurementId: "G-LPQXB83W5G",
  // Required for Realtime Database
  databaseURL: "https://bananacount-6812f-default-rtdb.firebaseio.com"
};

// Initialize Firebase app (singleton)
const app = initializeApp(firebaseConfig);

// Firebase Authentication
export const auth = getAuth(app);

// Firestore (for persisting best scores per user)
export const db = getFirestore(app);

// Realtime Database (for live leaderboard syncing)
export const rtdb = getDatabase(app);
