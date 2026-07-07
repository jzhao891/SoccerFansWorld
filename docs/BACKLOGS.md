# Backlogs

## 🔴 High Importance / High Urgency

- **Authentication flow:** Add Firebase Auth (Google/Apple sign-in) so actions like creating a watch party, checking in, and RSVPing are tied to a real user identity. Required before shipping RSVP or host controls. `created_by` field in FanZone already expects a user ID — currently unpopulated.

- **Firestore security rules:** Currently all Firestore reads and writes are open. Add proper security rules: `live_statuses` and `venues` should require Auth for writes; read access can remain open. Watch party creation (`venues` collection) should only allow writes from authenticated users and enforce that `created_by` matches the requesting user's UID. Consider rate-limiting rules to prevent abuse.

- **Complete venue seeding pipeline — add crawler stage:** The seed pipeline currently has two of three stages: (2) LLM normalization (`seed-venues.ts`) and (3) Firestore write. Stage (1) — automated discovery — is missing. Build a crawler that finds World Cup 2026 watch-party events from public sources (city fan-zone pages, venue websites, host-committee listings, Eventbrite/Meetup searches) and outputs a `venues.json`-compatible payload for stage 2. Subtasks:
  - **[design]** Identify target sources per host city (Seattle, NYC, LA, Dallas, SF, KC, Miami, Atlanta, Boston, Philadelphia). Prioritize official FIFA/city fan-zone pages and high-signal event aggregators.
  - **[code]** `backend/crawlers/venue-crawler.ts` — HTTP fetch + HTML parse (Cheerio or Playwright for JS-rendered pages); extract venue name, address, event title, date/time, teams, URL per listing.
  - **[code]** Pipe crawler output through the existing LLM normalization step (`lib/llm.ts`) to produce validated `SeedVenue[]` — reuse the team-name validation and schema enforcement already in `seed-venues.ts`.
  - **[code]** Wire into a `npm run crawl` script in `backend/package.json`; optionally chain directly into `npm run seed` for a single-command ingest.
  - **[ops]** Schedule as a nightly cron (Cloud Scheduler → Cloud Run or a simple cron on a VPS) so new events auto-populate without manual runs.

- **Automatic advertisement:** Automatically promote FandarAI and newly added fan zones across channels to drive discovery and sign-ups. Subtasks:
  - **[social · X/Twitter]** Auto-post when a new fan zone goes ACTIVE: "🏟️ New watch party added in [City] — [event_title] at [name]. Find it on fandar.ai #FIFAWorldCup2026". Use the X API v2 (`POST /2/tweets`) with an app-level bearer token stored in `backend/.env`.
  - **[social · Instagram/Threads]** Queue a card-image post (use the existing fan-card compositor in `apps/web/lib/compose/`) per new fan zone batch. Threads API or Buffer/Zapier integration.
  - **[email · waitlist/digest]** Weekly digest email to signed-up users listing new fan zones near their last known city. Resend or SendGrid, triggered by a backend cron.
  - **[SEO]** Generate static city landing pages (`/seattle`, `/nyc`, etc.) listing active fan zones — makes FandarAI indexable and drives organic search traffic for "World Cup 2026 watch party [city]".
  - **[ops]** Track performance (clicks, sign-ups, fan-zone opens) per channel using UTM params + a simple Firestore `ad_events` collection or a Plausible/PostHog event.

- **Mapbox token URL allowlist:** The `NEXT_PUBLIC_MAPBOX_TOKEN` is visible in the browser bundle. Restrict it to your domain in the Mapbox dashboard (Account → Access tokens → edit token → Allowed URLs) so it can't be used on other sites. Add both the Vercel preview URL and the custom domain once set up.

- **Apple Sign in with Apple — complete Service ID configuration:** Blocked until the iOS App ID (bundle ID) is registered. See `INFRASTRUCTURES.md` → Firebase Auth → Step 4 for the exact steps to complete.

- **Fan zone moderation sweep:** User-created fan zones are written `is_active: false` (pending moderation), so they do not appear on the map until approved. Write a sweep that scans inactive `venues` docs, validates each against the FanZone contract (required fields present; valid `source`/`admission`/`location`; `start_time` present; `watching_teams` entries are known teams or `TBD`), and flips `is_active: true` for passing docs — failing docs stay inactive and are logged for manual review. Run on demand for now; designed to be lifted into a scheduled job (Cloud Function / cron). Until this runs, newly created fan zones stay hidden.

- **Secure check-in / live-status writes:** Re-enable check-ins (currently disabled in the UI). Three distinct concerns, each with its own tool:
  1. **Don't expose raw data** — the public `live_statuses` summary is fine to read (it's the "Crowded?" we display), but individual votes must not be client-readable. Put raw votes in a separate `check_ins` collection with `allow read: if false` (clients write-only). Solved by rules + data model — **no auth needed.**
  2. **Limit volume/spam writes** (e.g. a script writing hundreds of docs/sec) — security rules are stateless and **cannot rate-limit**. Mitigate with **App Check** (only the genuine app can write), per-doc shape/size validation, and **budget alerts**. **Not solved by auth.**
  3. **Vote integrity** (stop one actor casting many votes to skew the vibe) — needs a per-user **identity** to dedupe. **Firebase Anonymous Auth** mints a unique `uid` per install (no login UI), which makes per-user dedup *possible* (e.g. vote doc id = `uid` so re-votes overwrite). But it is a **deterrent, not a guarantee**: anonymous uids are cheap to reset (reinstall / clear data) or mint in bulk, so it only *raises the cost* of ballot-stuffing. Full Auth (Google/Apple) is much stronger (real accounts are costly to mass-create). True integrity is **layered**: identity (anonymous → full) + App Check (identities must come from the genuine app) + **server-side weighted/decay aggregation** so a few fake votes don't swing the displayed vibe.
  Aggregation runs **server-side** (Cloud Function / scheduled job, Admin SDK) into the public summary — never in client logic (a forged client could write any summary). Pairs with the "Check-in trust model" item below. Identity is a pre-req for concern #3 only.

---

## 🟠 High Importance / Low Urgency

- **Mobile authentication (Firebase) — implement:** Web auth is live; the mobile (Expo) app has none. Design is in `docs/AUTH_LLD_DECISIONS.md` → *Mobile Implementation (Firebase)*. Decided: **`@react-native-google-signin/google-signin`** (Google), **`expo-apple-authentication`** (Apple, iOS-only), Email/Password via `firebase/auth`. Mirrors web (shared `AuthUser` + store + `onAuthStateChanged`) plus RN persistence + native config. **Before coding, verify exact APIs against the Expo SDK 56 docs (per `apps/mobile/AGENTS.md`)** — the firebase-12 `getReactNativePersistence` path + google-signin/apple-auth usage have drifted. Subtasks:
  - **[prereq · Apple Developer]** App ID + "Sign in with Apple" capability, Services ID, sign-in private key (+ Key ID), Team ID.
  - **[prereq · Firebase Console]** enable Apple provider (Services ID / Team ID / Key ID / key); Google iOS + Android OAuth client IDs; download `GoogleService-Info.plist` + `google-services.json`; note the Web client ID (for `GoogleSignin.configure`).
  - **[code]** native deps + `app.config.ts` plugins: `@react-native-async-storage/async-storage`, `@react-native-google-signin/google-signin`, `expo-apple-authentication`; config plugins + `ios.usesAppleSignIn`; wire the native config files.
  - **[code]** `lib/firebase.ts`: `initializeAuth` + `getReactNativePersistence(AsyncStorage)`. `lib/auth.ts`: `signInWithGoogle` (native → `signInWithCredential`), `signInWithApple` (expo-apple-authentication + nonce, iOS-only), `signInWithEmail`, `signUpWithEmail`, `sendPasswordReset`, `signOut`.
  - **[code]** auth listener (`onAuthStateChanged → AuthUser → store`, in `App.tsx`) + RN `SignInSheet`/`ProfileSheet`/`ProfileAvatar` (Animated bottom-sheet pattern); mount avatar in `MapTopBar`, sheets in `MapScreen`.
  - **[code]** gate `openCreateParty` (SignInSheet + resume) + `created_by = uid` in the mobile create sheet.
  - **[prereq · EAS]** dev-client rebuild (`npx eas build --profile development`) — native modules require it; the new auth can't run/test until then.
  - **[finalize]** test Google/Apple/Email + gated create + forgot-password + persistence on device, then enable the deferred venue create-auth rule (`request.auth != null && created_by == request.auth.uid`) — closes the create-auth half of #22 once both platforms authenticate.

- **Mobile check-in + RSVP — enable UI:** The shared layer is fully ready (types, aggregation, `useVenueCheckins`, `writeCheckIn`/`removeCheckIn`, `writeRsvp`/`removeRsvp`, Firestore rules). **Pre-req: mobile auth above** — check-ins and RSVPs require a signed-in `uid`. Once auth lands, the mobile work is:
  - **[code]** Wire `useVenueCheckins(eventId, startTime)` into `apps/mobile/components/VenueDrawer.tsx` (mirroring `EventCard.tsx` on web): vibe pills (Chill / Buzzing / Packed), optional big-screen + sound binaries, RSVP button + count, "Clear my check-in" link.
  - **[code]** Show vibe badge beside venue name in the drawer header (mirrors `VibeBadges` on web).
  - **[code]** Gate check-in/RSVP writes behind sign-in (same `withAuth` pattern as web — open `SignInSheet` if no uid, resume after success).
  - **[finalize]** Verify live vibe aggregation and RSVP count update in real time on device.

- **LLM-powered venue creation from URL or text prompt:** Allow admins or users to paste an event URL or raw text description. An LLM parses the input and extracts structured FanZone fields (name, address, event_title, start_time, end_time, watching_teams, amenities, organizer, url, description). For seeding: bulk-generate many docs from a single schedule page (e.g. a venue hosting 30+ World Cup watch parties). For users: pre-fill the creation form for review and confirmation before submitting to Firestore.

- **Automated venue ingestion pipeline:** Unattended backend pipeline (scheduled/cron) that (1) crawls public internet sources — city / host-committee event pages, venue sites, fan-zone listings — for World Cup watch-party events; (2) uses an LLM to normalize each into the `venues.json` schema (validated team names, ISO start/end times with offsets, admission, amenities, organizers, url); (3) runs the existing `seed-venues.ts` writer to upsert into Firestore (reusing its Places lookup, geohash, validation, and dedupe). Distinct from the user-facing "LLM venue creation from URL/text" feature above — this is a bulk discovery-and-ingestion job, not a form helper. The current seed script is only stage 3; this item adds the crawl + LLM-extraction stages in front of it.

- **Submit mobile app to App Store:** Run `npx eas build --profile production --platform ios` to produce a signed `.ipa`, then `npx eas submit --platform ios` to push to TestFlight for internal testing before App Store review. Requires Apple Developer account and production Firebase config.

- **Mobile Places API key security (pre-production):** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is currently restricted to Places API only. Two remaining steps before production: (1) **Set quota caps** — upgrade Google Cloud account to paid and set a daily request cap; (2) **Switch to native Google Places SDK** — replace the current JS `fetch()` calls with `GooglePlacesSwift` (iOS) / Android Places library so that Google Cloud Application Restrictions (bundle ID / SHA-1) can be enforced. Alternative: proxy all Places calls through the deployed Next.js `/api/places` route and restrict that key by HTTP referrer instead.

- **Watch party RSVP / attendance:** Allow users to respond to a custom watch party ("Going", "Interested", "Not going"). Store responses in an `rsvps` subcollection under each FanZone doc `{ user_id, status, responded_at }`. Surface attendee count on the map pin and full attendee list in the drawer. Requires auth flow above.

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.

- **Match info:** Display match info (e.g. dates, teams, live stats) on the main page or map page to give users soccer context alongside venue data.

- **Venue/event deletion flow (user-initiated):** Let users delete their own fan zones/events from the UI. **Pre-req: Auth flow** — deletion must be owner-scoped (`allow delete: if request.auth != null && resource.data.created_by == request.auth.uid`), which requires a signed-in identity. Without auth there's no way to identify the owner, so client deletes can't be allowed safely (anyone could delete anything) — which is why the interim security rules lock client deletes entirely. Distinct from the background expiry/cleanup deletion, which runs via the Admin SDK and is not user-initiated.

- **Cost controls — remaining items (budget alert DONE):** Cost spans **three independent billing surfaces**; here's the state of each.
  - **Google Maps Platform** — the Places/Geocoding key lives in project **"My First Project"** (under the `footballfansworld-labs-org` org; project id `project-13ef97d5-…`), billing account **`01ABFD-44E37C-F64E9D`** ("My Billing Account"), currently on the **$300 / 90-day free trial** (~$170 already burned). ✅ **Budget alert set** (tracks the $300 trial, alerts at 50/90/100% — the "trial running out" signal; the trial is itself a hard ceiling, so no surprise charge until we manually upgrade to paid). ⬜ **TODO: per-API daily quota caps** on Places + Geocoding (APIs & Services → Quotas → daily request limit) — a *hard* stop. Important because the **mobile Places key is exposed in the app bundle** and could be scraped; protects the remaining trial credit now and is the real guardrail once we upgrade to paid (no $300 ceiling then). See the "Mobile Places API key security" item above.
  - **Firebase / Firestore** (`footballfansworld-d532e`) — on the **Spark free plan, billing disabled**, so it *cannot* be charged (free-tier caps, then services stop). ⬜ **Deferred: set a Cloud Billing budget only once we upgrade to Blaze** for World Cup traffic (Firestore free tier ≈ 50k reads/day won't survive launch). Note a GCP budget is an *alert, not a hard cap* — true auto-shutoff needs a Pub/Sub-triggered Cloud Function that disables billing.
  - **Anthropic** (Haiku activation-sweeper) — billed by Anthropic, not GCP; key is backend-only (`backend/.env`), so no scraping risk, and cost is fractions of a cent per run. ⬜ **TODO (low priority): set a monthly spend limit + usage alert** in the Anthropic console (Settings → Billing/Limits). Prepaid credits already act as a natural ceiling; the thing to guard is auto-reload.

---

## 🟡 Low Importance / High Urgency

- **Venue name search via Google Places Text Search:** Extend the search bar to support searching by venue name (e.g. "Yard House", "Buffalo Wild Wings"). When the user types a venue name, call the Google Places Text Search API (`POST /api/places/search`) at runtime to find matching places globally, not just within the current viewport. Selecting a result should pan the map to the venue and load its fan zone if one exists. Note: Text Search is a separate, more expensive endpoint — consider debouncing aggressively and rate-limiting per user session.

- **Mobile UX polish — add image edit page and smooth navigation:** Build the fan card generator screen in the mobile app and wire up navigation between the map screen and the image edit screen.

- **Marker density UX — zoom-responsive sizing to handle venue clusters:** Scale marker size inversely with zoom level so dense clusters shrink as the user zooms out. For tightly co-located venues, consider offsetting overlapping pins radially or showing a cluster badge with a count.

- **Mobile Firestore persistence:** The Firebase JS SDK on React Native has no IndexedDB, so Firestore uses memory-only cache by default. Enabling persistence requires migrating to `@react-native-firebase/firestore` (native module, SQLite-backed). Web already uses `persistentLocalCache()` via IndexedDB.

- **Improve Firebase auth emails (password reset / verification) — off-brand + landing in spam:** the default emails are generic and currently hit the **spam folder**. The spam is almost certainly the default sender `noreply@…firebaseapp.com` — a **shared** Firebase domain with no per-project reputation and not SPF/DKIM/DMARC-aligned to `fandar.ai`, so receivers distrust it. **Primary fix (stays on Firebase, no backend): "Customize domain"** (Auth → Templates → Customize domain) → verify `fandar.ai` and add the **SPF + DKIM (+ a DMARC)** DNS records, so mail sends from `noreply@fandar.ai` — this fixes **both** the spam/deliverability **and** the sender branding at once. Also tweak sender name / subject / body in the template editor (limited: no logo or custom HTML). *Optional, far-future only if we ever want fully-designed HTML emails (logo/layout):* generate the link server-side (`admin.auth().generatePasswordResetLink`) and send via an own provider (Resend/SendGrid) — needs a backend, **not** required for the spam fix. Triggered by the web forgot-password flow now shipping.

---

## 🟢 Low Importance / Low Urgency

- **Editable venue location on edit:** The owner venue-edit sheet freezes `location`/`address`/`geohash` in v1 (edit = content fields only). Allow moving the pin later — but handle the `venue_id` desync first (a `google`/`osm` venue's `venue_id` points at a specific real place, so moving it while keeping `venue_id` is inconsistent; likely clear `venue_id`/`source` → `custom` on move) plus recompute address + geohash. See docs/CHECKIN_LLD_DECISIONS.md (owner-scoped venue edit).

- **Event title editing via trust model:** Allow users to suggest edits to a venue's `event_title` from the drawer. Treat suggestions as votes — the most-voted title within a time window wins.

- **Amenities editing via trust model:** Allow users to add or remove amenities from the drawer. Treat each amenity toggle as a vote — an amenity appears if a majority of recent votes include it.

- **Advanced filter:** Sort by venues enlisted by me or by event title.

- **Hot event:** Additional display for a live event that is currently trending.

- **Live chat:** Live chat for events happening in real time.

- **Bracket prediction:** Event page and bracket prediction.
