import { getAdminDb } from './lib/admin';

// Admin SDK (bypasses security rules — client deletes are locked). Deletes duplicate
// venue docs that share a venue_id + event_title, keeping the oldest by created_at.
const VENUE_ID = 'ChIJnYWp_4pTwokRMiFcokpnOEg'; // NYNJ Fan Hub at Sports Illustrated Stadium

async function main() {
  const db = getAdminDb();

  const snap = await db.collection('venues').where('venue_id', '==', VENUE_ID).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

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
      await db.collection('venues').doc(d.id).delete();
      deleted++;
    }
  }

  console.log(`\nDone — deleted ${deleted} duplicate(s).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
