// Server-side Firebase initialization for API routes.
//
// The app runs Firestore in open/test mode (see firestore.rules), so the
// standard Firebase *client* SDK can read and write from server routes using
// the same NEXT_PUBLIC_* config the browser app uses. This module lazily
// initializes a single Firebase app instance shared across API requests.

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.apiKey !== 'your-api-key' &&
    firebaseConfig.projectId !== 'your-project-id'
  );
};

let cachedDb: Firestore | null = null;

// Returns a Firestore instance, or null if Firebase isn't configured.
export const getServerDb = (): Firestore | null => {
  if (!isFirebaseConfigured()) return null;
  if (cachedDb) return cachedDb;

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cachedDb = getFirestore(app);
  return cachedDb;
};
