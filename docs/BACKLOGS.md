# Backlogs

## 🔴 High Importance / High Urgency

- **Authentication flow:** Add Firebase Auth (Google/Apple sign-in) so actions like creating a watch party, checking in, and RSVPing are tied to a real user identity. Required before shipping RSVP or host controls. `created_by` field in FanZone already expects a user ID — currently unpopulated.

- **Firestore security rules:** Currently all Firestore reads and writes are open. Add proper security rules: `live_statuses` and `venues` should require Auth for writes; read access can remain open. Watch party creation (`venues` collection) should only allow writes from authenticated users and enforce that `created_by` matches the requesting user's UID. Consider rate-limiting rules to prevent abuse.

- **Multiple watch parties at the same location:** The current data model assumes one FanZone per Google Place (`google_place_id` as a bridge key). When multiple custom watch parties exist at or near the same point (e.g. two parties both hosted at the same bar), `useMergedPlaces` only surfaces one pin per location. Need to decide: (1) data model — allow multiple FanZone docs with the same `google_place_id` or same coordinates; (2) pin rendering — stack pins, show a cluster marker with a count badge, or offset overlapping pins; (3) drawer UX — when a clustered pin is tapped, show a list of all parties at that location before drilling into one. Perhaps display the nearest two or three events as a sorting mechanism; (4) shrink the size of subset of markers to make other ones more visible.

---

## 🟠 High Importance / Low Urgency

- **Watch party RSVP / attendance:** Allow users to respond to a custom watch party ("Going", "Interested", "Not going"). Store responses in an `rsvps` subcollection under each FanZone doc `{ user_id, status, responded_at }`. Surface attendee count on the map pin and full attendee list in the drawer. Requires auth flow above.

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.

- **Match info:** Display match info (e.g. dates, teams, live stats) on the main page or map page to give users soccer context alongside venue data.

- **Deploy web app to Vercel:** Connect the GitHub repo to Vercel, configure all environment variables (Firebase, Google Places, Mapbox), and enable auto-deploy on push to `main`. Set the custom domain once purchased. Blocked until Firestore security rules and auth are in place.

- **Submit mobile app to App Store:** Run `npx eas build --profile production --platform ios` to produce a signed `.ipa`, then `npx eas submit --platform ios` to push to TestFlight for internal testing before App Store review. Requires Apple Developer account, production Firebase config, and auth flow complete.

- **Domain setup:** Purchase domain via Cloudflare, then delegate DNS to the existing AWS Route 53 hosted zone by updating Cloudflare's nameservers to point at the Route 53 NS records. Add any remaining A/CNAME records in Route 53 (e.g. Vercel's DNS target for the web app).

- **Mobile Places API key security (pre-production):** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is currently restricted to Places API only (set in Google Cloud Console). Two remaining steps before production: (1) **Set quota caps** — upgrade Google Cloud account to paid and set a daily request cap on Places API (New) to limit abuse; (2) **Switch to native Google Places SDK** — replace the current JS `fetch()` calls with the native `GooglePlacesSwift` SDK (iOS) and Android Places library so that Google Cloud **Application Restrictions** (iOS bundle ID `com.soccerfansworld.app` + Android SHA-1 certificate fingerprint) can be enforced. Bundle ID/SHA restrictions only apply to native SDK calls, not raw HTTP calls. Requires writing a custom Expo native module wrapping `GooglePlacesSwift.searchNearby` (~60 lines Swift + JS bindings) and a full EAS rebuild. Alternative: proxy all Places calls through the deployed Next.js `/api/places` route and restrict that key by HTTP referrer instead.

---

## 🟡 Low Importance / High Urgency

- **Venue name search via Google Places Text Search:** Extend the search bar to support searching by venue name (e.g. "Yard House", "Buffalo Wild Wings"). When the user types a venue name, call the Google Places Text Search API (`POST /api/places/search`) at runtime to find matching places globally, not just within the current viewport. Selecting a result should pan the map to the venue and load its fan zone if one exists. Note: Text Search is a separate, more expensive endpoint than the nearby search currently used — consider debouncing aggressively and rate-limiting per user session.

- **Event title editing via trust model:** Allow users to suggest edits to a venue's `event_title` from the drawer. Treat suggestions as votes — the most-voted title within a time window wins. Same voting-with-decay algorithm as the check-in trust model. Guards against a single user setting a misleading event title.

- **Amenities editing via trust model:** Allow users to add or remove amenities from the drawer. Treat each amenity toggle as a vote — an amenity appears if a majority of recent votes include it. Same voting-with-decay algorithm. Prevents one user from cluttering or clearing the amenities list.

- **Web UX polish — map as landing page + smooth navigation to image edit:** Make `/map` the default landing page instead of the current root. Add smooth in-app navigation (e.g. a nav bar or floating button) from the map page to the image edit (`/create`) page so users don't need to manually change the URL.

- **Mobile UX polish — add image edit page and smooth navigation:** Build the image edit (fan card generator) screen in the mobile app and wire up navigation between the map screen and the image edit screen. Ensure transitions are smooth and the back navigation returns cleanly to the map.

- **Marker density UX — zoom-responsive sizing to handle venue clusters:** As the user zooms in, markers at the same or nearby coordinates overlap and become hard to tap individually. Scale marker size inversely with zoom level so dense clusters shrink as the user zooms out, and grow as they zoom in to a specific area. For tightly co-located venues (e.g. multiple parties in the same building), consider offsetting overlapping pins radially or showing a cluster badge with a count. Tapping a cluster should expand it or show a list of co-located venues.

---

- **Mobile Firestore persistence:** The Firebase JS SDK on React Native has no IndexedDB, so Firestore uses memory-only cache by default. Enabling persistence requires migrating to `@react-native-firebase/firestore` (native module, SQLite-backed). This involves a different API, EAS rebuild, and native module setup. Web already uses `persistentLocalCache()` via IndexedDB.

## 🟢 Low Importance / Low Urgency

- **Advanced filter:** Sort by venues enlisted by me or by event title.

- **Hot event:** Additional display for a live event that is currently trending.

- **Live chat:** Live chat for events happening in real time.

- **Bracket prediction:** Event page and bracket prediction.
