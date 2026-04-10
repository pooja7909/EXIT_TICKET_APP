import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Use environment variables if available (for Vercel/GitHub), 
// otherwise fall back to the JSON file (for AI Studio/local dev).
const firebaseConfig = {
  // @ts-ignore
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  // @ts-ignore
  appId: process.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  // @ts-ignore
  apiKey: process.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  // @ts-ignore
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  // @ts-ignore
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
  // @ts-ignore
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  // @ts-ignore
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  // @ts-ignore
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
};

// Validate config before initializing
const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId;

let app: any;
let db: any;
let auth: any;

if (isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
} else {
  console.error("Firebase config is missing required fields. Check environment variables or firebase-applet-config.json.");
}

export { db, auth, firebaseConfig };
