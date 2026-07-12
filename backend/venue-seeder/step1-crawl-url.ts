import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/web/.env.local') });

const URLS_FILENAME = 'crawl-urls.txt';
const PROCESSED_FILENAME = 'step1-processed-urls.json';
const FETCHED_FILENAME = 'step1and2-fetched-pages.json';
const MIN_TEXT_LENGTH = 300;

const RESOURCES = path.resolve(process.cwd(), 'backend/venue-seeder/resources');
const URLS_FILE = path.join(RESOURCES, URLS_FILENAME);
const PROCESSED_FILE = path.join(RESOURCES, PROCESSED_FILENAME);
const FETCHED_FILE = path.join(RESOURCES, FETCHED_FILENAME);

export type FetchedPage = { url: string; text: string };

export function loadUrls(file: string = URLS_FILE): string[] {
  if (!fs.existsSync(file)) {
    throw new Error(`Input file not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

// No batching concept for now (step1 is assumed to run once per crawl-urls.txt) —
// both files below are plain flat arrays.
//
// Dedup (step1-processed-urls.json) is intentionally scoped PER BATCH, not global
// across every crawl-urls.txt run that will ever happen.
//
// Why: the plan is to reintroduce a "pipeline" concept later, where crawl-urls.txt
// becomes an array of arrays (each inner array is one batch), and a pipeline
// execution runs step1 -> step2 -> step3 once per batch, identified by an
// execution id (a UUID generated per run, or supplied by the caller to resume/
// retry a prior execution). If dedup were one global ledger shared across every
// batch ever run, a URL that legitimately appears in two different batches would
// be silently skipped the second time — even though the two batches are meant to
// be independent units of work. Scoping dedup to the batch means each batch
// decides for itself whether a URL is new, with no cross-batch memory.
//
// Today, step1 only ever processes a single batch (the entirety of
// crawl-urls.txt, in one run), so this file's scope already equals "one batch"
// by construction — no code change is needed for that yet. Once the pipeline/
// execution-id system exists, this ledger should become execution-scoped
// (e.g. step1-processed-urls-<execution_id>.json) instead of the single shared
// file it is today.
export function loadProcessed(file: string = PROCESSED_FILE): Set<string> {
  if (!fs.existsSync(file)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(file, 'utf-8')));
}

export function saveProcessed(processed: Set<string>, file: string = PROCESSED_FILE) {
  fs.writeFileSync(file, JSON.stringify([...processed], null, 2));
}

export function loadFetchedPages(file: string = FETCHED_FILE): FetchedPage[] {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export function appendFetchedPages(pages: FetchedPage[], file: string = FETCHED_FILE) {
  const existing = loadFetchedPages(file);
  fs.writeFileSync(file, JSON.stringify([...existing, ...pages], null, 2));
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

export async function run(resourcesDir: string): Promise<void> {
  const urlsFile = path.join(resourcesDir, URLS_FILENAME);
  const processedFile = path.join(resourcesDir, PROCESSED_FILENAME);
  const fetchedFile = path.join(resourcesDir, FETCHED_FILENAME);

  const urls = loadUrls(urlsFile);

  if (urls.length === 0) {
    console.log(`No URLs in ${urlsFile}. Add one URL per line.`);
    return;
  }

  const processed = loadProcessed(processedFile);

  // Fetch all URLs, skipping already-processed ones
  const pages: FetchedPage[] = [];

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
    return;
  }

  appendFetchedPages(pages, fetchedFile);
  console.log(`\nFetched ${pages.length} page(s) → appended to ${fetchedFile}`);

  // Mark all fetched URLs as processed (even though extraction hasn't run yet — avoid re-fetching)
  for (const { url } of pages) processed.add(url);
  saveProcessed(processed, processedFile);

  console.log(`\nDone. Processed URLs saved to ${processedFile}`);
  console.log('Run: npx tsx backend/venue-seeder/step2-judge-and-extract.ts');
}

if (require.main === module) {
  run(RESOURCES).catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
