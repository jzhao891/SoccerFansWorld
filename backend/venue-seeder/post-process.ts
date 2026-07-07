import * as path from 'path';
import * as fs from 'fs';
import type { SeedVenue, SeedEvent } from '../scripts/seed-venues';

const RESOURCES = path.resolve(process.cwd(), 'backend/venue-seeder/resources');
const OUTPUT_FILE = path.join(RESOURCES, 'venues.json');

function main() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`venues.json not found at ${OUTPUT_FILE}. Run crawl first.`);
    process.exit(1);
  }

  const venues: SeedVenue[] = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  const now = Date.now();

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

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2));

  console.log(`\nDone — removed ${removedEvents} past event(s), ${removedVenues} empty venue(s).`);
  console.log(`${filtered.length} venue(s) remaining in venues.json.`);
  console.log('Run: npx tsx backend/scripts/seed-venues.ts');
}

main();
