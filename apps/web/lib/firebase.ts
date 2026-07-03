import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { setDb } from '@sfw/shared';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Skip init when env vars are absent — Next.js imports this module during static generation
// of built-in pages (/_not-found) even though AuthProvider is 'use client'. Without a guard,
// initializeApp throws auth/invalid-api-key in preview builds where vars aren't injected.
const app = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0])
  : null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = app ? initializeFirestore(app, { localCache: persistentLocalCache() }) : null as any;
if (app) setDb(db);

// Firebase Auth. Default web persistence is browserLocalPersistence (IndexedDB), so the
// session survives reloads/relaunches — see AUTH_HLD §4.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = app ? getAuth(app) : null as any;
