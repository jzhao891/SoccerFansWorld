import { getAdminDb } from './lib/admin';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

/**
 * Background venue activation sweeper.
 *
 * User-created fan zones are written `is_active: false` and stay hidden until approved.
 * This sweep scans inactive `venues` docs, validates each against the FanZone contract,
 * and activates (`is_active: true`) the ones that pass. Failing docs stay inactive and
 * are logged for review. Runs on demand now; designed to be lifted into a scheduled job.
 *
 * It also performs the checks the Firestore rules *can't* (the rules language has no list
 * iteration) — notably per-team validation of `watching_teams`.
 *
 *   npx tsx backend/venue-activation-sweeper.ts            # dry run (report only, no writes)
 *   npx tsx backend/venue-activation-sweeper.ts --apply    # activate the passing docs
 *
 * Uses the Admin SDK (bypasses security rules, which lock client updates).
 */
const KNOWN_TEAMS = new Set(WORLD_CUP_2026_TEAMS);

// Returns a list of validation errors; empty means the doc passes and may be activated.
function validateFanZone(d: Record<string, any>): string[] {
  const errors: string[] = [];

  const requireStr = (f: string) => {
    if (typeof d[f] !== 'string' || !d[f].trim()) errors.push(`missing/empty ${f}`);
  };
  requireStr('name');
  requireStr('address');
  requireStr('geohash');
  requireStr('event_title');

  if (!['google', 'osm', 'custom'].includes(d.source)) errors.push(`invalid source "${d.source}"`);
  if (!d.location || typeof d.location.lat !== 'number' || typeof d.location.lng !== 'number') {
    errors.push('missing/invalid location');
  }
  if (d.admission !== 'free' && d.admission !== 'paid') errors.push(`invalid admission "${d.admission}"`);
  if (typeof d.created_by !== 'string') errors.push('missing created_by');
  if (typeof d.created_at !== 'number') errors.push('missing created_at');
  if (!(d.venue_id === null || typeof d.venue_id === 'string')) errors.push('invalid venue_id');

  // Optional fields — validated only when present.
  if (d.start_time !== undefined && typeof d.start_time !== 'number') errors.push('invalid start_time');
  if (d.amenities !== undefined && !Array.isArray(d.amenities)) errors.push('amenities must be an array');

  // The check the rules can't do: every watching_team must be a known team or "TBD".
  if (d.watching_teams !== undefined) {
    if (!Array.isArray(d.watching_teams)) {
      errors.push('watching_teams must be an array');
    } else {
      for (const t of d.watching_teams) {
        if (t !== 'TBD' && !KNOWN_TEAMS.has(t)) errors.push(`unknown team "${t}"`);
      }
    }
  }

  return errors;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const db = getAdminDb();

  const snap = await db.collection('venues').where('is_active', '==', false).get();
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — scanning ${snap.size} inactive doc(s)\n`);

  let passed = 0;
  let failed = 0;

  for (const d of snap.docs) {
    const data = d.data() as Record<string, any>;
    const errors = validateFanZone(data);

    if (errors.length === 0) {
      passed++;
      console.log(`✓ ${d.id} — "${data.name}" / "${data.event_title}" → activate`);
      if (apply) await db.collection('venues').doc(d.id).update({ is_active: true });
    } else {
      failed++;
      console.log(`✗ ${d.id} — "${data.name}" left inactive:`);
      errors.forEach((e) => console.log(`    - ${e}`));
    }
  }

  console.log(`\nDone — ${passed} ${apply ? 'activated' : 'would activate'}, ${failed} left inactive.`);
  if (!apply && passed > 0) console.log('Re-run with --apply to activate the passing docs.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
