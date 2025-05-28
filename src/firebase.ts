
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
// Removed Firebase Storage import

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;


const firebaseConfig = {
  apiKey: apiKey,
  authDomain: authDomain,
  projectId: projectId,
  storageBucket: storageBucket, // Kept for potential future use, not actively used by core app now
  messagingSenderId: messagingSenderId,
  appId: appId,
};

// Initialize Firebase
let app;
let auth;
let db;
// let storage; // Storage initialization removed

if (firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId) {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  // storage = getStorage(app); // Storage initialization removed
} else {
  console.error("Firebase config is missing critical values (apiKey, authDomain, or projectId). Please check your .env.local file and ensure all NEXT_PUBLIC_FIREBASE_ variables are set correctly and you have restarted your development server.");
  // auth, db will be undefined, and Firebase dependent features will fail.
}

export { app, auth, db }; // Removed storage from exports
