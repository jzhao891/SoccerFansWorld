# Venue Seeding Pipeline

Automated discovery and ingestion of World Cup 2026 watch-party venues into Firestore.

## Pipeline stages

```
[1] Crawl    → fetch raw content from a source → raw text
[2] Extract  → Claude converts raw text → SeedVenue[] (venues.json schema)
[3] Seed     → seed-venues.ts writes SeedVenue[] to Firestore  ✅ done
```

Stages 1 and 2 happen in the same script run (fetch → extract → append to `venues.json`). Stage 3 is a separate manual step (`npm run seed`).

---

## Source scripts

One script per source type. All output to `backend/resources/venues.json` (appending, not overwriting).

| Script | Command | Input |
|---|---|---|
| `backend/crawlers/crawl-url.ts` | `npm run crawl:url` | List of URLs in `backend/resources/crawl-urls.txt` |
| `backend/crawlers/crawl-reddit.ts` | `npm run crawl:reddit` | List of subreddit + thread IDs in `backend/resources/crawl-reddit.txt` |
| `backend/crawlers/crawl-x.ts` | `npm run crawl:x` | List of search queries in `backend/resources/crawl-x.txt` |

### 1. URL crawler (`crawl-url.ts`)

- Read URLs from `crawl-urls.txt` (one per line)
- For each URL: `fetch(url)` → strip HTML to plain text (Cheerio)
- If stripped text < 300 chars: log warning, skip (likely JS-rendered SPA)
- Dedup: skip if URL already in `backend/resources/processed-urls.json`
- **Batch**: collect all non-skipped page texts into one Claude call
- Claude outputs `SeedVenue[]` → append to `venues.json`
- On success: record URL in `processed-urls.json`

### 2. Reddit crawler (`crawl-reddit.ts`)

- Read entries from `crawl-reddit.txt` (one per line, format: `r/Seattle/<thread_id>`)
- Fetch via public JSON API: `reddit.com/r/<sub>/comments/<id>.json` — no auth, requires `User-Agent` header
- Flatten post + all comments into one text blob
- Dedup: skip if thread URL already in `processed-urls.json`
- One Claude call per thread
- Claude outputs `SeedVenue[]` → append to `venues.json`
- On success: record thread URL in `processed-urls.json`

### 3. X crawler (`crawl-x.ts`)

- Read search queries from `crawl-x.txt` (one per line, e.g. `"World Cup watch party Seattle" lang:en -is:retweet`)
- Fetch via X API v2 recent search (`GET /2/tweets/search/recent`) — requires Bearer Token
- Watermark per query string in `backend/resources/x-watermarks.json`:
  - First run: fetch tweets, save the newest tweet ID (`newest_id`) for this query
  - Subsequent runs: pass `since_id = newest_id` → API returns only tweets posted after the last run
  - No redundant LLM calls across runs — the API itself filters out already-seen tweets
- Concatenate all tweet texts from the result, one Claude call per query
- Claude outputs `SeedVenue[]` → append to `venues.json`

---

## Dedup strategy

| Layer | What it catches | Cost |
|---|---|---|
| `processed-urls.json` | Same URL or Reddit thread processed before | Free — file lookup |
| `x-watermarks.json` (since_id) | Already-seen X tweets per query | Free — API-side filter |
| Firestore dedup in `seed-venues.ts` | Same venue + same day + overlapping teams | Free — Firestore query |

Same event appearing from two different source URLs (e.g. a venue's own page and a city fan-zone listing) may produce two LLM calls and two extracted entries — the Firestore dedup in stage 3 catches the duplicate at write time. Acceptable tradeoff given the low frequency of this case.

---

## Optimizing LLM calls

**Model:** `claude-opus-4-8`

**Prompt contract:**
- System: the `SeedVenue` schema definition + FIFA 2026 team name list + extraction rules (from `DEVELOPMENTS.md`)
- User: raw text content from the source
- Output: `SeedVenue[]` as JSON (no markdown, no explanation)

**Batching (URL crawler):** All non-skipped URLs in a single run are batched into one Claude call instead of one call per URL. Each page text is delimited with its source URL so Claude can attribute venues correctly.

**Cross-run dedup:** `processed-urls.json` prevents re-sending the same page to Claude on subsequent runs. `x-watermarks.json` (`since_id`) prevents fetching already-seen tweets entirely.

**Failure handling:**
- If Claude returns invalid JSON: log error, skip, do not write partial output
- If Claude returns `[]`: log "no venues found", still record URL as processed to avoid retrying

---

## State files

All state files are gitignored. They live in `backend/resources/` alongside the input config files.

| File | Purpose | Committed? |
|---|---|---|
| `crawl-urls.txt` | Input: URLs to crawl | ✅ yes |
| `crawl-reddit.txt` | Input: Reddit threads to crawl | ✅ yes |
| `crawl-x.txt` | Input: X search queries | ✅ yes |
| `venues.json` | Output: extracted SeedVenue[] ready for `npm run seed` | ❌ no |
| `processed-urls.txt` | State: URLs/threads already crawled | ❌ no |
| `x-watermarks.json` | State: since_id per X query | ❌ no |
