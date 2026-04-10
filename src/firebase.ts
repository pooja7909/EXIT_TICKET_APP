import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Use environment variables if available (for Vercel/GitHub), 
// otherwise fall back to the JSON file (for AI Studio/local dev).
// Defensive configuration retrieval
const getEnv = (key: string) => {
  try {
    return (import.meta as any).env[key];
  } catch (e) {
    return undefined;
  }
};

const firebaseConfig = {
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || getEnv('VITE_PROJECT_ID') || firebaseConfigJson.projectId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || getEnv('VITE_APP_ID') || firebaseConfigJson.appId,
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || getEnv('VITE_API_KEY') || firebaseConfigJson.apiKey,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || getEnv('VITE_AUTH_DOMAIN') || firebaseConfigJson.authDomain,
  firestoreDatabaseId: getEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || getEnv('VITE_FIRESTORE_DATABASE_ID') || firebaseConfigJson.firestoreDatabaseId,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || getEnv('VITE_STORAGE_BUCKET') || firebaseConfigJson.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || getEnv('VITE_MESSAGING_SENDER_ID') || firebaseConfigJson.messagingSenderId,
  measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID') || getEnv('VITE_MEASUREMENT_ID') || firebaseConfigJson.measurementId,
};

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase initialization failed:", e);
  app = {} as any;
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
