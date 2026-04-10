import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Use environment variables if available (for Vercel/GitHub), 
// otherwise fall back to the JSON file (for AI Studio/local dev).
const firebaseConfig = {
  // @ts-ignore
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.VITE_PROJECT_ID || firebaseConfigJson.projectId,
  // @ts-ignore
  appId: import.meta.env.VITE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  // @ts-ignore
  apiKey: import.meta.env.VITE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  // @ts-ignore
  authDomain: import.meta.env.VITE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  // @ts-ignore
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
  // @ts-ignore
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  // @ts-ignore
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  // @ts-ignore
  measurementId: import.meta.env.VITE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
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
