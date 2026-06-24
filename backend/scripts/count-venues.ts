import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

async function main() {
  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const snap = await getDocs(collection(db, 'venues'));
  console.log(`Total: ${snap.size}`);
  const byVenue: Record<string, number> = {};
  for (const doc of snap.docs) {
    const name = (doc.data().name as string) ?? '(unknown)';
    byVenue[name] = (byVenue[name] ?? 0) + 1;
  }
  for (const [name, count] of Object.entries(byVenue).sort()) {
    console.log(`  ${count.toString().padStart(3)}  ${name}`);
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
