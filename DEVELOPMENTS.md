# Development Reference

## Install Dependencies

```bash
npm install
```

## Build All (Web + Mobile)

```bash
npx turbo build
```

---

## Web (`apps/web`)

### Verify Build

```bash
cd apps/web && npm run build
```

### Run Dev Server

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; echo "done"
cd apps/web && npm run dev:next
```

Open http://localhost:3000

### Lint

```bash
cd apps/web && npm run lint
```

### Run Tests

```bash
cd apps/web && npm run test
```

### Run Tests (watch mode)

```bash
cd apps/web && npm run test:watch
```

---

## Mobile (`apps/mobile`)

### Run Tests

```bash
cd apps/mobile && npm run test
```

### Verify Build (no device needed)

```bash
# Exports both iOS and Android platforms
cd apps/mobile && npm run build
```

### Run Dev Server

```bash
cd apps/mobile && npm run start

OR

cd apps/mobile && npx expo start --tunnel
```

Press `i` to open on iOS Simulator, `a` for Android Emulator.
Requires the dev client build to be installed first (see EAS Build below).
**Note:** Expo Go is not supported — the app uses `@rnmapbox/maps` which requires a dev client.

### Run on iOS Simulator (Mac + Xcode required)

```bash
cd apps/mobile && npm run ios
```

---

## EAS Build (Cloud — no local Xcode needed)

EAS Build compiles the native iOS/Android app on Expo's servers. Required because
`@rnmapbox/maps` is a native module not supported by Expo Go.

### Build profiles

| Profile | Purpose |
|---|---|
| `development` | Dev client for iOS Simulator — use for daily development |
| `preview` | Internal build for a real device (no App Store) |
| `production` | App Store submission |

### First-time setup

**1. Log in to EAS**
```bash
cd apps/mobile && npx eas login
```

**2. Store secrets on Expo's servers (run once per secret)**

Values come from `apps/mobile/.env.local` — never put them in `eas.json`.

```bash
cd apps/mobile
npx eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value sk.xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value pk.xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value AIza...
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value AIza...
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value xxx
```

**3. Build dev client for iOS Simulator**
```bash
cd apps/mobile && npx eas build --profile development --platform ios
```

EAS builds on Expo's servers (no Xcode needed locally). When done, EAS will offer
to install the `.app` directly on the simulator. After this one-time build, use
`npm run start` + press `i` for daily development — no rebuild needed unless
native dependencies change.

### Rebuild when needed

Only required when native dependencies change (new native package, changes to
`app.config.ts` plugins):
```bash
cd apps/mobile && npx eas build --profile development --platform ios
```

### Android physical device

```bash
cd apps/mobile && npx eas build --profile development --platform android
```

Install the resulting `.apk` on your Android device.

---

## Deploy Firestore Rules & Indexes

Deploys `firestore.rules` and `firestore.indexes.json` to the Firebase project in `.firebaserc` (`footballfansworld-d532e`). Run from repo root. Changes **production** — for rules, review the diff and test a create in the Firebase Console **Rules Playground** before publishing.

```bash
# one-time, if not already authenticated
npx firebase-tools login

# deploy only the Firestore rules
npx firebase-tools deploy --only firestore:rules

# deploy only the composite indexes (adds any new ones in firestore.indexes.json)
npx firebase-tools deploy --only firestore:indexes
```

Look for `✔ cloud.firestore: rules file firestore.rules compiled successfully` and `✔ Deploy complete!`. See `docs/FIRESTORE_LLD_DECISION.md` for the rules design.

**Indexes notes:**
- Creating a new composite index triggers a backfill (Firestore scans existing docs to populate it) — the query that needs it errors until the build finishes. Adding a new equality+range query (e.g. on a new field) usually needs a matching composite index here.
- Composite indexes created out-of-band via the Console (e.g. from a query's "create index" link) are **not** in `firestore.indexes.json` until added manually — keep them tracked so they're version-controlled.
- **Pruning:** `npx firebase-tools deploy --only firestore:indexes --force` deletes any index in the project that is **not** in `firestore.indexes.json`. Confirm every still-used index is listed in the file first (run `npx firebase-tools firestore:indexes` to compare) — otherwise `--force` will delete a live index and its query will start failing. Deleting an index does not touch documents; only index creation reads them.

---

## Seed Venues

Populates Firestore `venues` from `backend/resources/venues3.json` via Google Places API. Run from repo root. (The `backend/` workspace is the server-side service — privileged data jobs run with the Admin SDK; it is never imported by any app. See `docs/FIRESTORE_LLD_DECISION.md`.)

**Step 1 — Write `venues.json`**

Group events by physical venue. Key fields: `venue_name`, `venue_search_query` (used for Google Places lookup), and an `events` array. Each event needs `event_title`, `start_time` (ISO 8601 with timezone), `admission` (`"free"` or `"paid"`), `amenities`, and optionally `end_time`, `watching_teams` (exact World Cup 2026 team names or `"TBD"`), `organizers`, `url`, `description`, `is_active`.

Use the following system prompt when asking an AI to convert raw event listings into `venues.json` entries:

```
You are building entries for a venues.json file used to seed a FIFA World Cup 2026 fan zone app.

OUTPUT FORMAT
Return only valid JSON — no markdown, no explanation. The output must be an array of venue objects.

SCHEMA
Each venue object:
{
  "venue_name": string,           // Display name of this sub-venue or section
  "venue_search_query": string,   // Search query to find it on Google Maps (include city + address for precision)
  "events": [ ...SeedEvent ]
}

Each SeedEvent object:
{
  "event_title": string,          // Descriptive title, e.g. "Belgium vs. Egypt" or "Round of 32 – Match 81: ..."
  "start_time": string,           // ISO 8601 with offset, e.g. "2026-06-15T14:30:00-07:00" (Seattle = -07:00 in summer)
  "end_time": string,             // Optional. ISO 8601 with offset.
  "watching_teams": string[],     // Optional. Must be exact FIFA World Cup 2026 team names or "TBD" for knockout rounds. Omit if not a match screening.
  "admission": "free" | "paid",
  "amenities": string[],          // e.g. ["big screen", "beer garden", "food trucks"]
  "description": string,          // Optional. Promotional text for the event.
  "organizers": string[],         // Optional. Organizer name(s).
  "url": string,                  // Optional. Direct link to event page (not venue homepage).
  "is_active": true,
  "skip_dedupe_check": true       // Include ONLY if this sub-venue shares a Google Place ID with another venue in the file AND has the same start_time + watching_teams.
}

RULES
1. TEAM NAMES: Use only exact FIFA World Cup 2026 participant names. Common ones: Algeria, Argentina, Australia, Austria, Belgium, Bolivia, Bosnia and Herzegovina, Brazil, Cameroon, Canada, Cape Verde, Chile, Colombia, Costa Rica, Croatia, Czechia, DR Congo, Denmark, Ecuador, Egypt, England, France, Germany, Ghana, Haiti, Honduras, Hungary, Indonesia, Iran, Iraq, Israel, Japan, Jordan, Kenya, Mexico, Morocco, Netherlands, New Zealand, Nigeria, Norway, Panama, Paraguay, Peru, Portugal, Qatar, Saudi Arabia, Scotland, Senegal, South Africa, South Korea, Spain, Sweden, Switzerland, Türkiye, Tunisia, Ukraine, Uruguay, USA, Uzbekistan, Venezuela, Curaçao. Use "TBD" for knockout round matches where teams are not yet known.
2. TIMES: All Seattle summer events use UTC offset -07:00 (PDT). Convert any "PST" references to -07:00.
3. MULTIPLE SUB-VENUES: If one physical location has distinct ticketed areas (e.g. an indoor hall vs. an outdoor barge), create a separate venue object for each with a descriptive venue_name. Use the same venue_search_query if they share the same address.
4. skip_dedupe_check: Add this field (value: true) when a sub-venue shares a physical location and has events at the same time with the same teams as another venue object in this file.
5. AMENITIES: Extract from the event description. Keep values short and consistent (e.g. "food trucks" not "various food trucks").
6. MISSING DATA: If a field is unknown, omit it entirely (do not use null or empty string).
```

**Step 2 — Run**

```bash
npx tsx backend/scripts/seed-venues.ts
```

Env vars load from `apps/web/.env.local`. Output is logged to console and a timestamped file in `logs/`.

**Count seeded venues**

```bash
npx tsx backend/scripts/count-venues.ts
```

Prints the total number of `venues` documents in Firestore, broken down by venue name.

**Step 3 — Review skipped events and potential duplicates**

- **Skipped venues**: team name failed validation — fix spelling in `venues.json` and re-run.
- **Potential duplicates**: an existing Firestore doc matched both the same calendar day and overlapping `watching_teams`. Review the logged side-by-side diff. If it is a genuinely different event, set `"skip_dedupe_check": true` on that event in `venues.json` and re-run.

## Venue Sweepers

### Activation sweeper

Scans `INACTIVE` venues, runs structural + LLM content validation, and flips passing docs to `ACTIVE`. Run from repo root.

```bash
# Dry run — report only, no writes
npx tsx backend/sweepers/venue-activation-sweeper.ts

# Apply — write ACTIVE / REJECTED
npx tsx backend/sweepers/venue-activation-sweeper.ts --apply

# Structural gate only (no LLM, no API key needed)
npx tsx backend/sweepers/venue-activation-sweeper.ts --apply --no-llm
```

### Expiry sweeper

Deletes past events so the collection stays clean. A venue is expired when `now > (end_time ?? start_time + 3h) + 2h grace`. Venues with no time info are skipped. Run from repo root.

```bash
# Dry run — log what would be deleted, no writes
npx tsx backend/sweepers/venue-expiry-sweeper.ts

# Apply — permanently delete expired venues
npx tsx backend/sweepers/venue-expiry-sweeper.ts --apply
```
