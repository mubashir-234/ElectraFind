// ─────────────────────────────────────────────────────────────
//  Firebase Configuration — ElectraFind
//  Replace values below with your own Firebase project keys
//  Get them from: https://console.firebase.google.com
// ─────────────────────────────────────────────────────────────
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZz4TN0qEXOZZyEUQf1cLEj3fTgvF-8J8",
  authDomain: "electrafind-87abc.firebaseapp.com",
  projectId: "electrafind-87abc",
  storageBucket: "electrafind-87abc.firebasestorage.app",
  messagingSenderId: "324731272406",
  appId: "1:324731272406:web:d63352e3e6497f9ac49d77"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
