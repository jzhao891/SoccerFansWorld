import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { WORLD_CUP_2026_TEAMS as KNOWN_TEAM_NAMES } from '@sfw/shared';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

// ---- Logger (console + file) ----

let logStream: fs.WriteStream | null = null;

export function createLogger(logPath: string) {
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
}

function write(level: 'log' | 'warn' | 'error', msg: string) {
  console[level](msg);
  logStream?.write(`[${level.toUpperCase()}] ${msg}\n`);
}

export const log = {
  info: (msg: string) => write('log', msg),
  warn: (msg: string) => write('warn', msg),
  error: (msg: string) => write('error', msg),
};

// ---- Input types (venues.json shape) ----

export type SeedEvent = {
  event_title: string;
  start_time?: string;        // ISO 8601 e.g. "2026-06-15T14:30:00-07:00"
  end_time?: string;
  watching_teams?: string[];
  admission: 'free' | 'paid';
  amenities: string[];
  description?: string;
  organizers?: string[];
  url?: string;
  is_active?: boolean;
  skip_dedupe_check?: boolean; // if true, skip dedup check and always write
};

export type SeedVenue = {
  venue_name: string;
  venue_search_query: string;
  events: SeedEvent[];
};

// ---- Known teams ----

const WORLD_CUP_2026_TEAMS = new Set(KNOWN_TEAM_NAMES);

export function validateVenues(venues: SeedVenue[]): { valid: SeedVenue[]; invalid: SeedVenue[] } {
  const valid: SeedVenue[] = [];
  const invalid: SeedVenue[] = [];

  for (const venue of venues) {
    const errors: string[] = [];

    for (const event of venue.events) {
      if (!event.watching_teams) continue;
      for (const team of event.watching_teams) {
        if (team !== 'TBD' && !WORLD_CUP_2026_TEAMS.has(team)) {
          errors.push(`event "${event.event_title}" has unknown team "${team}"`);
        }
      }
    }

    if (errors.length > 0) {
      log.error(`\n✗ Skipping venue "${venue.venue_name}":`);
      errors.forEach((e) => log.error(`    - ${e}`));
      invalid.push(venue);
    } else {
      valid.push(venue);
    }
  }

  return { valid, invalid };
}

// ---- Google Places lookup ----

type PlaceResult = {
  place_id: string;
  formatted_address: string;
  lat: number;
  lng: number;
};

async function findGooglePlace(searchQuery: string): Promise<PlaceResult | null> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; results: any[] };

  if (data.status !== 'OK' || !data.results?.length) {
    log.error(`  Google Places returned ${data.status} for: "${searchQuery}"`);
    return null;
  }

  const r = data.results[0];
  return {
    place_id: r.place_id,
    formatted_address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}

// ---- Dedup check ----

export type FirestoreDoc = { id: string; [key: string]: any };

// Returns docs that match BOTH strategies (same day AND overlapping teams).
// If watching_teams is absent or TBD, only the day strategy is used.
export async function findPotentialDuplicates(
  db: ReturnType<typeof getFirestore>,
  venueId: string,
  startTimeMs: number,
  watchingTeams: string[] | undefined,
): Promise<FirestoreDoc[]> {
  const dayStart = new Date(startTimeMs);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startTimeMs);
  dayEnd.setHours(23, 59, 59, 999);

  // Strategy 3: same venue_id + same calendar day
  const daySnap = await getDocs(
    query(
      collection(db, 'venues'),
      where('venue_id', '==', venueId),
      where('start_time', '>=', dayStart.getTime()),
      where('start_time', '<=', dayEnd.getTime()),
    ),
  );
  const byDay = daySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // If no teams to check, day match alone is sufficient to flag
  const hasTeams = watchingTeams && watchingTeams.length > 0 && !watchingTeams.includes('TBD');
  if (!hasTeams) return byDay;

  // Strategy 2: from the day matches, keep only those with overlapping teams (intersection)
  return byDay.filter((doc) => {
    const existing: string[] = doc.watching_teams ?? [];
    return watchingTeams!.some((t) => existing.includes(t));
  });
}

export function logDuplicateWarning(incoming: SeedEvent, venueName: string, matches: FirestoreDoc[]) {
  log.warn(`\n  ⚠ Potential duplicate — skipping. Set skip_dedupe_check: true to override.`);
  log.warn(`\n    Incoming:`);
  log.warn(`      venue:          ${venueName}`);
  log.warn(`      event_title:    ${incoming.event_title}`);
  log.warn(`      start_time:     ${incoming.start_time}`);
  log.warn(`      watching_teams: ${JSON.stringify(incoming.watching_teams ?? [])}`);
  log.warn(`\n    Existing in Firestore (${matches.length} match${matches.length > 1 ? 'es' : ''}):`);
  for (const m of matches) {
    log.warn(`      id:             ${m.id}`);
    log.warn(`      venue:          ${m.name ?? '(unknown)'}`);
    log.warn(`      event_title:    ${m.event_title}`);
    log.warn(`      start_time:     ${new Date(m.start_time).toISOString()}`);
    log.warn(`      watching_teams: ${JSON.stringify(m.watching_teams ?? [])}`);
    log.warn('');
  }
}

// ---- Main ----

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.resolve(process.cwd(), `logs/seed-venues-${timestamp}.log`);
  createLogger(logPath);
  log.info(`Logging to ${logPath}\n`);

  const venuesPath = path.resolve(process.cwd(), 'backend/resources/venues3.json');
  if (!fs.existsSync(venuesPath)) {
    log.error(`venues.json not found at ${venuesPath}`);
    process.exit(1);
  }

  const venues: SeedVenue[] = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'));

  log.info('Validating venues.json...');
  const { valid, invalid } = validateVenues(venues);

  log.info(`  ${valid.length} venue(s) passed validation.`);
  log.info(`  ${invalid.length} venue(s) failed validation and will be skipped.`);

  if (valid.length === 0) {
    log.error('No valid venues to seed. Exiting.');
    process.exit(1);
  }

  log.info(`\nProceeding...\n`);

  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const venuesCol = collection(db, 'venues');

  let created = 0;
  let skippedDedupe = 0;
  let skippedNoPlace = 0;

  for (const venue of valid) {
    log.info(`Looking up: "${venue.venue_search_query}"`);
    const place = await findGooglePlace(venue.venue_search_query);

    if (!place) {
      log.error(`  ✗ Skipping ${venue.events.length} event(s) — no Google Place found`);
      skippedNoPlace += venue.events.length;
      continue;
    }

    log.info(`  ✓ ${place.formatted_address} (${place.place_id})`);
    const geohash = geohashForLocation([place.lat, place.lng]);

    for (const event of venue.events) {
      const startTimeMs = event.start_time ? new Date(event.start_time).getTime() : undefined;

      if (startTimeMs === undefined) {
        log.info(`  (no start_time — dedup skipped for "${event.event_title}")`);
      } else if (event.skip_dedupe_check) {
        log.info(`  ⚡ skip_dedupe_check set — bypassing dedup for "${event.event_title}"`);
      } else {
        const duplicates = await findPotentialDuplicates(db, place.place_id, startTimeMs, event.watching_teams);
        if (duplicates.length > 0) {
          logDuplicateWarning(event, venue.venue_name, duplicates);
          skippedDedupe++;
          continue;
        }
      }

      const doc = {
        source: 'google' as const,
        venue_id: place.place_id,
        name: venue.venue_name,
        address: place.formatted_address,
        location: { lat: place.lat, lng: place.lng },
        geohash,
        event_title: event.event_title,
        ...(startTimeMs !== undefined ? { start_time: startTimeMs } : {}),
        ...(event.end_time ? { end_time: new Date(event.end_time).getTime() } : {}),
        ...(event.watching_teams ? { watching_teams: event.watching_teams } : {}),
        admission: event.admission,
        amenities: event.amenities,
        ...(event.description ? { description: event.description } : {}),
        ...(event.organizers ? { organizers: event.organizers } : {}),
        ...(event.url ? { url: event.url } : {}),
        is_active: event.is_active ?? true,
        created_by: 'admin',
        created_at: Date.now(),
      };

      await addDoc(venuesCol, doc);
      log.info(`  + ${event.event_title}${event.start_time ? ` (${event.start_time})` : ''}`);
      created++;
    }
  }

  log.info(`\nDone — created: ${created} | skipped (dedupe): ${skippedDedupe} | skipped (no place): ${skippedNoPlace} | venues failed validation: ${invalid.length}`);
  logStream?.end();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    log.error(String(err));
    process.exit(1);
  });
}
