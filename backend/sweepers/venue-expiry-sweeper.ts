import * as dotenv from 'dotenv';
import * as path from 'path';
import { getAdminDb } from '../lib/admin';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Background venue expiry sweeper.
 *
 * Deletes past events so the `venues` collection doesn't accumulate stale docs.
 * A venue is expired when:
 *
 *   effective_end = end_time ?? (start_time + DEFAULT_DURATION_MS)
 *   now > effective_end + GRACE_MS
 *
 * Venues with no time info (no start_time, no end_time) are skipped — they
 * represent open-ended fan zones with no known schedule.
 *
 *   npx tsx backend/sweepers/venue-expiry-sweeper.ts           # dry run — logs what would be deleted
 *   npx tsx backend/sweepers/venue-expiry-sweeper.ts --apply   # permanently delete expired venues
 *
 * Uses the Admin SDK (bypasses security rules, which lock client deletes).
 */

export const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000; // 3h assumed duration when end_time absent
export const GRACE_MS = 2 * 60 * 60 * 1000;            // 2h grace after computed end

export function effectiveEndMs(data: Record<string, unknown>): number | null {
  if (typeof data.end_time === 'number') return data.end_time;
  if (typeof data.start_time === 'number') return data.start_time + DEFAULT_DURATION_MS;
  return null;
}

export function isExpired(data: Record<string, unknown>, now: number): boolean {
  const end = effectiveEndMs(data);
  return end !== null && now > end + GRACE_MS;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const now = Date.now();

  const db = getAdminDb();
  const snap = await db.collection('venues').get();

  const toDelete: { id: string; data: Record<string, unknown>; endMs: number }[] = [];
  let noTimeInfo = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const endMs = effectiveEndMs(data);
    if (endMs === null) { noTimeInfo++; continue; }
    if (now > endMs + GRACE_MS) {
      toDelete.push({ id: doc.id, data, endMs });
    }
  }

  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} — scanned ${snap.size} venue(s): ` +
    `${toDelete.length} expired, ${noTimeInfo} skipped (no time info)\n`,
  );

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    process.exit(0);
  }

  for (const { id, data, endMs } of toDelete) {
    console.log(
      `🗑  ${id} — "${data.name}" / "${data.event_title}" ` +
      `[${data.activity_status}] ended ${formatTime(endMs)}`,
    );
  }

  if (apply) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const { id } of toDelete.slice(i, i + BATCH_SIZE)) {
        batch.delete(db.collection('venues').doc(id));
      }
      await batch.commit();
    }
    console.log(`\nDeleted ${toDelete.length} expired venue(s).`);
  } else {
    console.log(`\nRe-run with --apply to delete these ${toDelete.length} venue(s).`);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
