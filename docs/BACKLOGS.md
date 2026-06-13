# Backlogs

- **Check-in trust model (Option A — voting with decay):** Replace the current last-write-wins check-in with an aggregated voting system. Store individual check-ins as timestamped votes in a `check_ins` subcollection under each venue. Compute `crowd_index` and `sound` from votes within a rolling time window (e.g. last 30 min), weighted so recent votes count more and old votes expire. The `live_statuses` doc becomes a computed summary rather than a direct user write. Requires either Firebase Cloud Functions for server-side aggregation or client-side recomputation on each check-in.

- **Event title editing via trust model:** Allow users to suggest edits to a venue's `event_title` from the drawer. Treat suggestions as votes — the most-voted title within a time window wins. Same voting-with-decay algorithm as the check-in trust model above. Guards against a single user setting a misleading event title.

- **Amenities editing via trust model:** Allow users to add or remove amenities from the drawer. Treat each amenity toggle as a vote — an amenity appears if a majority of recent votes include it. Same voting-with-decay algorithm. Prevents one user from cluttering or clearing the amenities list.

- **Authentication flow:** Add Firebase Auth (Google/Apple sign-in) so actions like creating a watch party, checking in, and RSVPing are tied to a real user identity. Required before shipping RSVP or host controls. `created_by` field in FanZone already expects a user ID — currently unpopulated.

- **Watch party RSVP / attendance:** Allow users to respond to a custom watch party ("Going", "Interested", "Not going"). Store responses in an `rsvps` subcollection under each FanZone doc `{ user_id, status, responded_at }`. Surface attendee count on the map pin and full attendee list in the drawer. Requires auth flow above.

- **Multiple watch parties at the same location:** The current data model assumes one FanZone per Google Place (`google_place_id` as a bridge key). When multiple custom watch parties exist at or near the same point (e.g. two parties both hosted at the same bar), `useMergedPlaces` only surfaces one pin per location. Need to decide: (1) data model — allow multiple FanZone docs with the same `google_place_id` or same coordinates; (2) pin rendering — stack pins, show a cluster marker with a count badge, or offset overlapping pins; (3) drawer UX — when a clustered pin is tapped, show a list of all parties at that location before drilling into one. Related to the Google venue registration flow (a bar as a venue vs. multiple watch parties hosted at that bar are fundamentally different objects).  Perhaps what we need is a sorting
mechanism where the nearest two to three events are displayed.

- **Advanced filter:** Sort by venues enlisted by me or by event title.

- **Hot event:** Additional display for live event that is currently trending.

- **Live chat:** Live chat for what events are happening atm.

- **Bracket prediction:** Event page and bracket prediction.

- **Match info:** Main page or map page, we need to display the match info (e.g. dates) and maybe live stats.

- **Firestore security rules:** Currently all Firestore reads and writes are open. Add proper security rules: `live_statuses` and `venues` should require Auth for writes; read access can remain open. Watch party creation (`venues` collection) should only allow writes from authenticated users and enforce that `created_by` matches the requesting user's UID. Consider rate-limiting rules to prevent abuse.

- **Mobile Places API key security (pre-production):** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` is currently restricted to Places API only (set in Google Cloud Console). Two remaining steps before production: (1) **Set quota caps** — upgrade Google Cloud account to paid and set a daily request cap on Places API (New) to limit abuse; (2) **Switch to native Google Places SDK** — replace the current JS `fetch()` calls with the native `GooglePlacesSwift` SDK (iOS) and `places:places` Android library so that Google Cloud **Application Restrictions** (iOS bundle ID `com.soccerfansworld.app` + Android SHA-1 certificate fingerprint) can be enforced. Bundle ID/SHA restrictions only apply to native SDK calls, not raw HTTP calls. Requires writing a custom Expo native module wrapping `GooglePlacesSwift.searchNearby` (~60 lines Swift + JS bindings) and a full EAS rebuild. Alternative: proxy all Places calls through the deployed Next.js `/api/places` route and restrict that key by HTTP referrer instead.

- **Venue name search via Google Places Text Search:** Extend the search bar to support searching by venue name (e.g. "Yard House", "Buffalo Wild Wings"). When the user types a venue name, call the Google Places Text Search API (`POST /api/places/search`) at runtime to find matching places globally, not just within the current viewport. Selecting a result should pan the map to the venue and load its fan zone if one exists. Note: Text Search is a separate, more expensive endpoint than the nearby search currently used — consider debouncing aggressively and rate-limiting per user session.
