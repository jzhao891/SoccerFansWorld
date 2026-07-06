import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// Initializes the Firebase Admin SDK from a service-account key and returns Firestore.
//
// The Admin SDK authenticates as a service account and BYPASSES Firestore security
// rules — use it only here in trusted server-side jobs (seeding, cleanup, moderation),
// NEVER in the web/mobile apps. The key is a SECRET (gitignored).
//
// Key resolution order:
//   1. GOOGLE_APPLICATION_CREDENTIALS env var (absolute path to the JSON), or
//   2. ./serviceAccountKey.json at the repo root.
//
// Download it from: Firebase Console -> Project Settings -> Service accounts ->
//   Generate new private key.
export function getAdminDb(): Firestore {
  if (getApps().length === 0) {
    const keyPath =
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      path.resolve(process.cwd(), 'serviceAccountKey.json');

    if (!fs.existsSync(keyPath)) {
      throw new Error(
        `Service-account key not found at "${keyPath}".\n` +
        `Download it from Firebase Console -> Project Settings -> Service accounts ` +
        `-> Generate new private key, save it as serviceAccountKey.json at the repo root ` +
        `(it is gitignored), or set GOOGLE_APPLICATION_CREDENTIALS to its path.`,
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}
