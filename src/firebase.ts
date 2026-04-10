import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../firebase-applet-config.json';

// Use environment variables if available (for Vercel/GitHub), 
// otherwise fall back to the JSON file (for AI Studio/local dev).
const firebaseConfig = {
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || (import.meta as any).env?.VITE_PROJECT_ID || firebaseConfigJson.projectId,
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || (import.meta as any).env?.VITE_APP_ID || firebaseConfigJson.appId,
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || (import.meta as any).env?.VITE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || (import.meta as any).env?.VITE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  firestoreDatabaseId: (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (import.meta as any).env?.VITE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId,
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || (import.meta as any).env?.VITE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (import.meta as any).env?.VITE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || (import.meta as any).env?.VITE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
