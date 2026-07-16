import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Config comes from .env (never hardcode keys in source). VITE_-prefixed vars
// are inlined into the client bundle at build time by Vite.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase config: set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID in .env (see .env.example) before building.'
  );
}

const app = initializeApp(firebaseConfig);
// Persistent local cache so the app works offline (mobile connectivity).
// VITE_FIREBASE_DATABASE_ID targets a named Firestore database; leave it unset
// to use the (default) database — required to stay on the Firebase free tier,
// whose quota only covers the default database.
const firestoreSettings = {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
};
const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
export const db = databaseId
  ? initializeFirestore(app, firestoreSettings, databaseId)
  : initializeFirestore(app, firestoreSettings);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
