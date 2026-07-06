import * as dotenv from 'dotenv';
import * as path from 'path';
import type Anthropic from '@anthropic-ai/sdk';
import { getAdminDb } from '../lib/admin';
import { getAnthropic } from '../lib/llm';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

// ANTHROPIC_API_KEY loads from backend/.env (gitignored) — a backend-only secret, kept out
// of the apps' env. Resolved relative to this file, so it works from any cwd. The Admin SDK
// auths via serviceAccountKey.json (see lib/admin.ts), so no Firebase env is needed here.
// The key is a SECRET — never hardcode it. See backend/.env.example.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * Background venue activation sweeper.
 *
 * User-created fan zones are written `activity_status: 'INACTIVE'` and stay hidden until
 * approved. This sweep scans INACTIVE `venues` docs and runs each through two gates:
 *   1. STRUCTURAL — shape/type validation, plus the checks the Firestore rules *can't* do
 *      (the rules language has no list iteration) — notably per-team validation of
 *      `watching_teams`. A failure here leaves the doc INACTIVE, NOT REJECTED, because:
 *      re-checking it next run is free (no LLM), and it can self-resolve — the only check
 *      here the create rules don't already enforce is `watching_teams` vs KNOWN_TEAMS, so a
 *      stale team list can fail a legit doc today and pass it after we update the list.
 *   2. CONTENT — a cheap LLM sanity check (Claude Haiku 4.5) that flags gibberish, spam,
 *      profanity, and obvious placeholder/test data that pass the structural gate but aren't
 *      real listings. A failure here marks the doc REJECTED: re-checking costs an LLM call
 *      and the verdict won't change, so REJECTED drops it out of future INACTIVE scans.
 *      Skippable with --no-llm.
 * Docs that pass both gates are set `activity_status: 'ACTIVE'`. Runs on demand now;
 * designed to be lifted into a scheduled job.
 *
 *   npx tsx backend/sweepers/venue-activation-sweeper.ts            # dry run (report only, no writes)
 *   npx tsx backend/sweepers/venue-activation-sweeper.ts --apply    # write ACTIVE / REJECTED
 *   npx tsx backend/sweepers/venue-activation-sweeper.ts --no-llm   # structural gate only (no API key needed)
 *
 * Uses the Admin SDK (bypasses security rules, which lock client updates).
 */
const KNOWN_TEAMS = new Set(WORLD_CUP_2026_TEAMS);

// Cheapest/fastest Claude model — ample for a binary "is this a real listing?" classification.
const LLM_MODEL = 'claude-haiku-4-5';

// Structured-output schema: forces a clean { ok, reason } JSON verdict.
const SANITY_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['ok', 'reason'],
  additionalProperties: false,
} as const;

// LLM content gate. Returns ok=false ONLY for clear problems; biased toward passing so it
// never blocks a legitimate venue on a borderline call. Fails OPEN (activates with a logged
// note) on a refusal or unparseable response — a transient model issue shouldn't permanently
// hide a real listing, and the sweep is re-runnable.
async function llmSanityCheck(
  client: Anthropic,
  d: Record<string, any>,
): Promise<{ ok: boolean; reason: string }> {
  const payload = {
    name: d.name,
    event_title: d.event_title,
    description: d.description,
    address: d.address,
    admission: d.admission,
    amenities: d.amenities,
    organizers: d.organizers,
    watching_teams: d.watching_teams,
  };

  const response = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: 256,
    system:
      'You are a SPAM/JUNK filter for a FIFA World Cup 2026 fan-zone map. You are given one ' +
      'user-submitted venue/event listing as JSON. Your ONLY job is to decide whether it is a ' +
      'plausible real listing or obvious junk. Set ok=false ONLY for: gibberish or ' +
      'keyboard-mash text, spam or advertising unrelated to football, profanity or hateful ' +
      'content, or obvious test/placeholder data (e.g. "foo", "asdf", "test test", "aaaa", ' +
      '"lorem ipsum"). Do NOT judge the factual accuracy of event details — team names, dates, ' +
      'kickoff times, match stages (e.g. "Round of 32" is a real 2026 stage), or tournament ' +
      'format. Those are validated elsewhere and your knowledge of the 2026 tournament may be ' +
      'incomplete; never reject a listing because a detail seems factually off. When in doubt, ' +
      'set ok=true — most submissions are legitimate. Keep reason under 15 words.',
    messages: [{ role: 'user', content: JSON.stringify(payload, null, 2) }],
    output_config: { format: { type: 'json_schema', schema: SANITY_SCHEMA } },
  });

  if (response.stop_reason === 'refusal') {
    return { ok: true, reason: 'llm refused to classify — passed through' };
  }

  const block = response.content.find((b) => b.type === 'text');
  const text = block && block.type === 'text' ? block.text : '';
  try {
    const parsed = JSON.parse(text) as { ok?: boolean; reason?: string };
    return { ok: parsed.ok !== false, reason: parsed.reason ?? '' };
  } catch {
    return { ok: true, reason: 'unparseable llm response — passed through' };
  }
}

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
  const useLlm = !process.argv.includes('--no-llm');
  const db = getAdminDb();

  // Fail fast on a missing key before scanning, so a misconfigured run doesn't half-process.
  const llm = useLlm ? getAnthropic() : null;

  const snap = await db.collection('venues').where('activity_status', '==', 'INACTIVE').get();
  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'}${useLlm ? '' : ' (no LLM)'} — scanning ${snap.size} INACTIVE doc(s)\n`,
  );

  let activated = 0;
  let rejected = 0;
  let skipped = 0; // structural failures — left INACTIVE for re-scan (free; may self-resolve)

  for (const d of snap.docs) {
    const data = d.data() as Record<string, any>;

    // Gate 1 — structural. A malformed doc can't be activated, but it isn't REJECTED either:
    // leave it INACTIVE so a fix (e.g. an updated team list) lets it through on a later run.
    const errors = validateFanZone(data);
    if (errors.length > 0) {
      skipped++;
      console.log(`• ${d.id} — "${data.name}" left INACTIVE (structural):`);
      errors.forEach((e) => console.log(`    - ${e}`));
      continue;
    }

    // Gate 2 — LLM content sanity check. A content failure is a real rejection: mark it
    // REJECTED so it drops out of future INACTIVE scans (no repeat LLM cost).
    if (llm) {
      const verdict = await llmSanityCheck(llm, data);
      if (!verdict.ok) {
        rejected++;
        console.log(`✗ ${d.id} — "${data.name}" → REJECTED (content): ${verdict.reason}`);
        if (apply) await db.collection('venues').doc(d.id).update({ activity_status: 'REJECTED' });
        continue;
      }
    }

    activated++;
    console.log(`✓ ${d.id} — "${data.name}" / "${data.event_title}" → ACTIVE`);
    if (apply) await db.collection('venues').doc(d.id).update({ activity_status: 'ACTIVE' });
  }

  const v = apply ? '' : 'would ';
  console.log(
    `\nDone — ${v}activate ${activated}, ${v}reject ${rejected}, ${skipped} left INACTIVE (structural).`,
  );
  if (!apply && (activated > 0 || rejected > 0)) {
    console.log('Re-run with --apply to write these changes.');
  }
  process.exit(0);
}

main().catch((e) => {
  // Clean one-line message for expected errors (e.g. missing key); full error otherwise.
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
