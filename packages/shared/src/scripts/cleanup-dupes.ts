import * as dotenv from 'dotenv';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const VENUE_ID = 'ChIJnYWp_4pTwokRMiFcokpnOEg'; // NYNJ Fan Hub at Sports Illustrated Stadium

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

  const snap = await getDocs(query(collection(db, 'venues'), where('venue_id', '==', VENUE_ID)));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // Group by event_title
  const byTitle: Record<string, any[]> = {};
  for (const d of docs) {
    const title = d.event_title ?? '(unknown)';
    byTitle[title] = byTitle[title] ?? [];
    byTitle[title].push(d);
  }

  let deleted = 0;
  for (const [title, group] of Object.entries(byTitle)) {
    if (group.length <= 1) continue;
    // Sort oldest first (lowest created_at), delete the rest
    group.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
    const toDelete = group.slice(1);
    for (const d of toDelete) {
      console.log(`  Deleting duplicate: "${title}" (id: ${d.id}, created_at: ${d.created_at})`);
      await deleteDoc(doc(db, 'venues', d.id));
      deleted++;
    }
  }

  console.log(`\nDone — deleted ${deleted} duplicate(s).`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
