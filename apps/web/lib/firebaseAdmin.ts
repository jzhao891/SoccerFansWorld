import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// Lazily initialized so the module is safe to import in any Next.js runtime.
let _app: App | undefined;
let _db: Firestore | undefined;

function adminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }
  _app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Vercel stores newlines as literal \n in env vars
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
  return _app;
}

export function getAdminDb(): Firestore {
  if (!_db) _db = getFirestore(adminApp());
  return _db;
}
