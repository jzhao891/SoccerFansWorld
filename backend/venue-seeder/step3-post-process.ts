import * as path from 'path';
import * as fs from 'fs';
import type { SeedVenue, SeedEvent } from '../scripts/seed-venues';

const INPUT_FILENAME = 'step2-venues.json';
const OUTPUT_FILENAME = 'step3-venues.json';

const RESOURCES = path.resolve(process.cwd(), 'backend/venue-seeder/resources');
const OUTPUT_FILE = path.join(RESOURCES, OUTPUT_FILENAME);

export function filterStaleEvents(
  venues: SeedVenue[],
  now: number = Date.now(),
): { filtered: SeedVenue[]; removedEvents: number; removedVenues: number } {
  let removedEvents = 0;
  let removedVenues = 0;

  const filtered = venues
    .map((venue) => {
      const kept: SeedEvent[] = [];
      const dropped: SeedEvent[] = [];

      for (const event of venue.events) {
        if (event.start_time && new Date(event.start_time).getTime() < now) {
          dropped.push(event);
        } else {
          kept.push(event);
        }
      }

      if (dropped.length > 0) {
        for (const e of dropped) {
          console.log(`  [removed] "${venue.venue_name}" / "${e.event_title}" (${e.start_time})`);
          removedEvents++;
        }
      }

      return { ...venue, events: kept };
    })
    .filter((venue) => {
      if (venue.events.length === 0) {
        console.log(`  [removed venue] "${venue.venue_name}" — no remaining events`);
        removedVenues++;
        return false;
      }
      return true;
    });

  return { filtered, removedEvents, removedVenues };
}

export function run(resourcesDir: string): void {
  const inputFile = path.join(resourcesDir, INPUT_FILENAME);
  const outputFile = path.join(resourcesDir, OUTPUT_FILENAME);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`step2-venues.json not found at ${inputFile}. Run step1-crawl-url.ts and step2-judge-and-extract.ts first.`);
  }

  // Reads step2's raw output without mutating it, and always writes a fresh
  // step3-venues.json — so re-running step3 is safe and reproducible from
  // step2's untouched data, and nothing is ever destructively overwritten.
  const venues: SeedVenue[] = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const { filtered, removedEvents, removedVenues } = filterStaleEvents(venues);

  fs.writeFileSync(outputFile, JSON.stringify(filtered, null, 2));

  console.log(`\nDone — removed ${removedEvents} past event(s), ${removedVenues} empty venue(s).`);
  console.log(`${filtered.length} venue(s) remaining → written to ${outputFile}`);
  console.log('Run: npx tsx backend/scripts/seed-venues.ts');
}

if (require.main === module) {
  try {
    run(RESOURCES);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
