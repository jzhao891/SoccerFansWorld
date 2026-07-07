import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { extractVenues } from './lib/extract';
import type { SeedVenue } from '../scripts/seed-venues';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const RESOURCES = path.resolve(process.cwd(), 'backend/venue-seeder/resources');
const URLS_FILE = path.join(RESOURCES, 'crawl-urls.txt');
const PROCESSED_FILE = path.join(RESOURCES, 'processed-urls.json');
const OUTPUT_FILE = path.join(RESOURCES, 'venues.json');
const MIN_TEXT_LENGTH = 300;

export function loadProcessed(file: string = PROCESSED_FILE): Set<string> {
  if (!fs.existsSync(file)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(file, 'utf-8')));
}

export function saveProcessed(processed: Set<string>, file: string = PROCESSED_FILE) {
  fs.writeFileSync(file, JSON.stringify([...processed], null, 2));
}

export function appendVenues(venues: SeedVenue[], file: string = OUTPUT_FILE) {
  const existing: SeedVenue[] = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf-8'))
    : [];
  fs.writeFileSync(file, JSON.stringify([...existing, ...venues], null, 2));
}

export function stripHtml(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, noscript, iframe').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FandarAI-VenueSeeder/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.log(`  [skip] HTTP ${res.status}: ${url}`);
      return null;
    }
    const html = await res.text();
    const text = stripHtml(html);
    if (text.length < MIN_TEXT_LENGTH) {
      console.log(`  [skip] Too short (${text.length} chars, likely JS-rendered): ${url}`);
      return null;
    }
    return text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [skip] Fetch error (${msg}): ${url}`);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(URLS_FILE)) {
    console.error(`Input file not found: ${URLS_FILE}`);
    process.exit(1);
  }

  const urls = fs.readFileSync(URLS_FILE, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (urls.length === 0) {
    console.log('No URLs in crawl-urls.txt. Add one URL per line.');
    process.exit(0);
  }

  const processed = loadProcessed();

  // Fetch all URLs, skipping already-processed ones
  const pages: { url: string; text: string }[] = [];

  for (const url of urls) {
    if (processed.has(url)) {
      console.log(`  [skip] Already processed: ${url}`);
      continue;
    }
    console.log(`  Fetching: ${url}`);
    const text = await fetchText(url);
    if (text) pages.push({ url, text });
  }

  if (pages.length === 0) {
    console.log('\nNothing new to process.');
    process.exit(0);
  }

  // Batch all pages into a single Claude call
  console.log(`\nExtracting venues from ${pages.length} page(s) in one Claude call...`);

  const batchContent = pages
    .map((p, i) => `--- SOURCE ${i + 1}: ${p.url} ---\n${p.text}`)
    .join('\n\n');

  const venues = await extractVenues(batchContent, `${pages.length} URL(s)`);

  if (venues.length > 0) {
    appendVenues(venues);
    console.log(`\nExtracted ${venues.length} venue(s) → appended to ${OUTPUT_FILE}`);
  } else {
    console.log('\nNo venues extracted.');
  }

  // Mark all fetched URLs as processed (even if no venues found — avoid retrying)
  for (const { url } of pages) processed.add(url);
  saveProcessed(processed);

  console.log(`\nDone. Processed URLs saved to ${PROCESSED_FILE}`);
  console.log('Review venues.json then run: npx tsx backend/scripts/seed-venues.ts');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
