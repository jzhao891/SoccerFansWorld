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
  // Use explicit service account when vars are present (Vercel production).
  // Falls back to Application Default Credentials for local dev
  // (requires GOOGLE_APPLICATION_CREDENTIALS or gcloud auth ADC).
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    _app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    _app = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  }
  return _app;
}

export function getAdminDb(): Firestore {
  if (!_db) _db = getFirestore(adminApp());
  return _db;
}
