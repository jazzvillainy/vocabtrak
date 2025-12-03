import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Read Firebase config from Vite environment variables (prefixed with VITE_)
const env = import.meta.env as unknown as Record<string, string>;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || "",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

// Initialize Firebase services
export const initializeFirebase = (): {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
} => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  return { app, db, auth };
};
