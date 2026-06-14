# Map Feature Design Decisions

- **FanZone visibility rule in `useMergedPlaces`:** A FanZone with a non-null `google_place_id` that was not returned by the Google Places API is silently skipped — not shown as `source: 'custom'`. Only FanZones with `google_place_id: null` are shown as custom. Rationale: a non-null `google_place_id` means the venue exists in Google but was deprioritized by Google Places API because the user hasn't zoomed in close enough to the center. Showing it as `custom` would be misleading and cause the same pin to flicker between `merged` and `custom` depending on zoom level. It will appear correctly as `merged` once the user zooms in and Places returns it.

---

## Venue Sources, Markers, and Caching Architecture

### The Three Marker Types

**1. Google venue (blue dot)**
- Source: Google Places Nearby Search API, fetched server-side via `/api/places`
- Shown only when no FanZone exists at the same location (`venue_id` match)
- Tapping opens VenueDrawer with name, vicinity, rating, open_now
- Represents a discoverable bar/restaurant/stadium — no user content yet

**2. OSM venue (Mapbox POI label)**
- Source: OpenStreetMap data baked into Mapbox Streets vector tiles
- We render no dot marker — Mapbox renders the POI label itself
- Tapping a POI label fires `queryRenderedFeatures` on the `poi-label` layer, returning name, category, and coordinates instantly from already-loaded tile memory
- Opens VenueDrawer with name and category only — no rating, no hours
- Coexists with a FanZone dot if a FanZone was created at the same OSM venue (Mapbox label + our dot visible simultaneously — acceptable tradeoff, cannot suppress Mapbox labels for specific features)

**3. FanZone (colored dot)**
- Source: Firestore `venues` collection, real-time subscription
- Always shown — FanZones are the primary user-generated content
- Color reflects how the FanZone was created:
  - Created from a Google place → dot at that Google place's coordinates
  - Created from an OSM venue → dot at that OSM venue's coordinates
  - Created freehand (no source venue) → dot at user-chosen location
- Tapping opens VenueDrawer with event title, kickoff time, amenities, check-in, and source venue info

### FanZone Schema

FanZones store their origin explicitly:
```ts
source: 'google' | 'osm' | 'custom'
venue_id: string | null  // Google place_id, OSM feature id, or null for custom
```
Replaces the old `google_place_id: string | null` which was Google-only.

### Why We Merge (Dedup) and How

When a FanZone exists at a Google place, we do not want two dots at the same coordinates. The rule is:

> Show all FanZone dots. Show a Google dot only if no FanZone has `venue_id` matching that Google `id`.

Computed in `useMergedPlaces`. OSM venues are excluded from this dedup — we render no dot for OSM venues ourselves so there is nothing to suppress.

### Caching and Eviction

| Source | Cache? | Where | Eviction | Owner |
|---|---|---|---|---|
| Google | Yes | `placesCache: Record<string, Venue>` in Zustand | Distance-based ~15km, deferred via `requestAnimationFrame` after paint | Us |
| FanZone | No | `fanZones: FanZone[]` in Zustand, replaced per bounds change | Automatic — Firestore subscription tears down and rebuilds on bounds change | Firestore SDK |
| OSM | No | Mapbox tile memory | Automatic — Mapbox loads/evicts tiles per viewport | Mapbox SDK |

**Why Google needs its own cache:** The Places API returns at most 20 results per call. Without caching, panning replaces those 20 with a new 20 and previous venues disappear. Accumulating across pans grows the visible dataset.

**Why FanZones don't need a separate cache:** Firestore's `onSnapshot` is backed by an in-memory SDK cache that serves the current result set. The geohash-scoped query subscribes only to nearby FanZones. Teardown and rebuild on bounds change naturally scopes to the new area.

**Why OSM doesn't need a cache:** Tile data is already in memory for the current viewport — that is how Mapbox renders the POI labels. `queryRenderedFeatures` reads from that in-memory tile data instantly. You can only tap what is visible, so the data is always available at the moment it is needed. Mapbox manages its own tile cache and eviction transparently.

### Firestore Persistence (Web)

Enabled via `persistentLocalCache()` in Firebase init. Firestore caches documents in IndexedDB so returning users get an instant cache hit on page load before the real-time listener catches up. Mobile uses the Firebase JS SDK which has no IndexedDB — persistence on mobile requires migrating to `@react-native-firebase` (backlogged).
