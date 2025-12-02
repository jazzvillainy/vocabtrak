import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyCNQaSaKvB8mYCgD7Um_oow6zUMVfpO-Rc",
  authDomain: "wordapp-ae5b5.firebaseapp.com",
  projectId: "wordapp-ae5b5",
  storageBucket: "wordapp-ae5b5.firebasestorage.app",
  messagingSenderId: "15749175952",
  appId: "1:15749175952:web:4a3f56eb942bf69883d615",
  measurementId: "G-JB0Q0KWNEE",
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
