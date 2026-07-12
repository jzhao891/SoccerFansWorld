import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { judgeAndExtractVenues, type JudgeAndExtractResult } from './lib/extract';
import { loadFetchedPages, type FetchedPage } from './step1-crawl-url';
import type { SeedVenue } from '../scripts/seed-venues';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const FETCHED_FILENAME = 'step1and2-fetched-pages.json';
const OUTPUT_FILENAME = 'step2and3-venues.json';
const JUDGMENTS_FILENAME = 'step2-judgements.json';

const RESOURCES = path.resolve(process.cwd(), 'backend/venue-seeder/resources');
const FETCHED_FILE = path.join(RESOURCES, FETCHED_FILENAME);
const OUTPUT_FILE = path.join(RESOURCES, OUTPUT_FILENAME);
const JUDGMENTS_FILE = path.join(RESOURCES, JUDGMENTS_FILENAME);

export function appendVenues(venues: SeedVenue[], file: string = OUTPUT_FILE) {
  const existing: SeedVenue[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify([...existing, ...venues], null, 2));
}

// The raw judgeAndExtractVenues() result, unmodified, so rejected venues stay
// inspectable even though they never appear in step2and3-venues.json.
export function appendJudgments(result: JudgeAndExtractResult, file: string = JUDGMENTS_FILE) {
  const existing: JudgeAndExtractResult[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify([...existing, result], null, 2));
}

function toBatchContent(pages: FetchedPage[]): string {
  return pages
    .map((p, i) => `--- SOURCE ${i + 1}: ${p.url} ---\n${p.text}`)
    .join('\n\n');
}

export async function run(resourcesDir: string): Promise<void> {
  const fetchedFile = path.join(resourcesDir, FETCHED_FILENAME);
  const outputFile = path.join(resourcesDir, OUTPUT_FILENAME);
  const judgmentsFile = path.join(resourcesDir, JUDGMENTS_FILENAME);

  const pages = loadFetchedPages(fetchedFile);

  if (pages.length === 0) {
    console.log('No fetched pages to extract. Run step1-crawl-url.ts first.');
    return;
  }

  console.log(`\nJudging and extracting ${pages.length} page(s) in one Claude call...`);

  const result = await judgeAndExtractVenues(toBatchContent(pages), `${pages.length} URL(s)`);

  for (const j of result.judgments) {
    console.log(`  [judgment] "${j.venue_name}" — ${j.included ? 'included' : 'rejected'}: ${j.reason}`);
  }
  appendJudgments(result, judgmentsFile);

  if (result.venues.length > 0) {
    appendVenues(result.venues, outputFile);
    console.log(`\nExtracted ${result.venues.length} venue(s) → appended to ${outputFile}`);
  } else {
    console.log('\nNo venues extracted.');
  }

  console.log(`Judgment reasoning saved to ${judgmentsFile}`);
  console.log('Review step2and3-venues.json then run: npx tsx backend/venue-seeder/step3-post-process.ts');
}

if (require.main === module) {
  run(RESOURCES).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
