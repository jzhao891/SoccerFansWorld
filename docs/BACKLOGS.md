# Backlogs

## 🔴 High Importance / High Urgency

- **Deploy web app to Vercel:** Connect the GitHub repo to Vercel, configure all environment variables (Firebase, Google Places, Mapbox), and enable auto-deploy on push to `main`. Set the custom domain once purchased.

- **Domain setup:** Purchase domain, then wire DNS to Vercel's DNS target (A/CNAME). If using Cloudflare + Route 53, update Cloudflare's nameservers to point at the Route 53 NS records, then add the Vercel CNAME in Route 53.

- **Authentication flow:** Add Firebase Auth (Google/Apple sign-in) so actions like creating a watch party, checking in, and RSVPing are tied to a real user identity. Required before shipping RSVP or host controls. `created_by` field in FanZone already expects a user ID — currently unpopulated.

- **Firestore security rules:** Currently all Firestore reads and writes are open. Add proper security rules: `live_statuses` and `venues` should require Auth for writes; read access can remain open. Watch party creation (`venues` collection) should only allow writes from authenticated users and enforce that `created_by` matches the requesting user's UID. Consider rate-limiting rules to prevent abuse.

- **Mapbox token URL allowlist:** The `NEXT_PUBLIC_MAPBOX_TOKEN` is visible in the browser bundle. Restrict it to your domain in the Mapbox dashboard (Account → Access tokens → edit token → Allowed URLs) so it can't be used on other sites. Add both the Vercel preview URL and the custom domain once set up.

- **Apple Sign in with Apple — complete Service ID configuration:** Blocked until the iOS App ID (bundle ID) is registered. See `INFRASTRUCTURES.md` → Firebase Auth → Step 4 for the exact steps to complete.

- **Fan zone moderation sweep:** User-created fan zones are written `is_active: false` (pending moderation), so they do not appear on the map until approved. Write a sweep that scans inactive `venues` docs, validates each against the FanZone contract (required fields present; valid `source`/`admission`/`location`; `start_time` present; `watching_teams` entries are known teams or `TBD`), and flips `is_active: true` for passing docs — failing docs stay inactive and are logged for manual review. Run on demand for now; designed to be lifted into a scheduled job (Cloud Function / cron). Until this runs, newly created fan zones stay hidden.

---

## 🟠 High Importance / Low Urgency

- **LLM-powered venue creation from URL or text prompt:** Allow admins or users to paste an event URL or raw text description. An LLM parses the input and extracts structured FanZone fields (name, address, event_title, start_time, end_time, watching_teams, amenities, organizer, url, description). For seeding: bulk-generate many docs from a single schedule page (e.g. a venue hosting 30+ World Cup watch parties). For users: pre-fill the creation form for review and confirmation before submitting to Firestore.

- **Automated venue ingestion pipeline:** Unattended backend pipeline (scheduled/cron) that (1) crawls public internet sources — city / host-committee event pages, venue sites, fan-zone listings — for World Cup watch-party events; (2) uses an LLM to normalize each into the `venues.json` schema (validated team names, ISO start/end times with offsets, admission, amenities, organizers, url); (3) runs the existing `seed-venues.ts` writer to upsert into Firestore (reusing its Places lookup, geohash, validation, and dedupe). Distinct from the user-facing "LLM venue creation from URL/text" feature above — this is a bulk discovery-and-ingestion job, not a form helper. The current seed script is only stage 3; this item adds the crawl + LLM-extraction stages in front of it.

- **Submit mobile app to App Store:** Run `npx eas build --profile production --platform ios` to produce a signed `.ipa`, then `npx eas submit --platform ios` to push to TestFlight for internal testing before App Store review. Requires Apple Developer account and production Firebase config.

- **Mobile Places API key security (pre-production):** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is currently restricted to Places API only. Two remaining steps before production: (1) **Set quota caps** — upgrade Google Cloud account to paid and set a daily request cap; (2) **Switch to native Google Places SDK** — replace the current JS `fetch()` calls with `GooglePlacesSwift` (iOS) / Android Places library so that Google Cloud Application Restrictions (bundle ID / SHA-1) can be enforced. Alternative: proxy all Places calls through the deployed Next.js `/api/places` route and restrict that key by HTTP referrer instead.

- **Watch party RSVP / attendance:** Allow users to respond to a custom watch party ("Going", "Interested", "Not going"). Store responses in an `rsvps` subcollection under each FanZone doc `{ user_id, status, responded_at }`. Surface attendee count on the map pin and full attendee list in the drawer. Requires auth flow above.

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.

- **Match info:** Display match info (e.g. dates, teams, live stats) on the main page or map page to give users soccer context alongside venue data.

- **Fan zone expiry sweep:** Separate scheduled sweep that retires past events so the `venues` collection doesn't accumulate stale docs. Treat an event as complete when `end_time ?? (start_time + ~3h default window) < now`; after a grace period, deactivate (`is_active: false`) or delete it. Runs independently of the moderation sweep. `end_time` is optional and only sharpens the estimate.

---

## 🟡 Low Importance / High Urgency

- **Venue name search via Google Places Text Search:** Extend the search bar to support searching by venue name (e.g. "Yard House", "Buffalo Wild Wings"). When the user types a venue name, call the Google Places Text Search API (`POST /api/places/search`) at runtime to find matching places globally, not just within the current viewport. Selecting a result should pan the map to the venue and load its fan zone if one exists. Note: Text Search is a separate, more expensive endpoint — consider debouncing aggressively and rate-limiting per user session.

- **Mobile UX polish — add image edit page and smooth navigation:** Build the fan card generator screen in the mobile app and wire up navigation between the map screen and the image edit screen.

- **Marker density UX — zoom-responsive sizing to handle venue clusters:** Scale marker size inversely with zoom level so dense clusters shrink as the user zooms out. For tightly co-located venues, consider offsetting overlapping pins radially or showing a cluster badge with a count.

- **Mobile Firestore persistence:** The Firebase JS SDK on React Native has no IndexedDB, so Firestore uses memory-only cache by default. Enabling persistence requires migrating to `@react-native-firebase/firestore` (native module, SQLite-backed). Web already uses `persistentLocalCache()` via IndexedDB.

---

## 🟢 Low Importance / Low Urgency

- **Event title editing via trust model:** Allow users to suggest edits to a venue's `event_title` from the drawer. Treat suggestions as votes — the most-voted title within a time window wins.

- **Amenities editing via trust model:** Allow users to add or remove amenities from the drawer. Treat each amenity toggle as a vote — an amenity appears if a majority of recent votes include it.

- **Advanced filter:** Sort by venues enlisted by me or by event title.

- **Hot event:** Additional display for a live event that is currently trending.

- **Live chat:** Live chat for events happening in real time.

- **Bracket prediction:** Event page and bracket prediction.
