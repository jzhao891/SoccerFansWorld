# Map Application Feature Specification & Technical Architecture (V2)

## 1. Core Map Architecture & Infrastructure

### Flow 1: Dynamic Viewport Search & Hybrid Data Orchestration

**User Flow:** The user pans or zooms the map. The frontend waits for the user to stop moving (300ms debounce), captures the bounding box coordinates of the screen, and automatically displays all nearby restaurants, bars, and stadiums alongside custom user-generated fan zones.

**Underlying Problem:** You cannot manually insert or maintain a database of every business in the world. However, if you query a global provider (like Google Places) for every map movement and try to combine it with custom real-time sports data, you risk creating slow loading times, visual stuttering, and high API fees.

**Solution & Technology (The ID Bridge Pattern):** Implement a hybrid architecture that splits data fetching into two parallel pipelines:

- **Global Third-Party Layer:** The app queries the Google Places New API (Radar Search) or Mapbox Search API on the fly using the map's current bounding box. This pulls standard metadata (business name, address, categories) without saving those businesses to your database.
- **Custom Real-Time Layer:** For custom fan zones or watch parties, the app queries your Firebase Firestore database. To make this fast, Firestore uses a Geohash index (via the `geofire-common` library) which converts 2D map coordinates into 1D searchable string quadrants.
- **The Frontend Merge:** The frontend matches incoming Google Places elements with your Firestore data by linking them to the business's unique ID (`google_place_id`). If a match is found, your custom World Cup overlays are layered right onto the map marker.

---

### Flow 2: User-Generated Venue Creation & Live Broadcasting

**User Flow:** A user holds down their finger on an empty spot on the map to pin a pop-up watch party or outdoor fan gathering. The app automatically calculates the street address. Once they hit "Create," the venue is instantly added to the database and a live notification is blasted to all nearby active users without requiring a manual page refresh.

**Underlying Problem:** Converting a raw coordinate click into a postal address (Reverse Geocoding) requires an immense asset network. Once created, broadcasting that pin to thousands of active nearby users can choke network bandwidth if updates are pushed globally rather than locally.

**Solution & Technology:**

- **Reverse Geocoding:** The frontend captures the tap coordinates and forwards them to the Mapbox Geocoding API, which instantly returns a human-readable street address string to pre-populate the creation form.
- **Targeted Live Broadcasting:** Save the new location record straight to Firebase Firestore. Active user apps run localized Firestore snapshot listeners (`onSnapshot`) filtered exactly to their current Geohash grid prefix range. When a new event document drops into that specific quadrant, only the devices looking at that section of the city are alerted, preserving data and rendering the new pulsing pin instantly.

---

## 2. Interface, Navigation, & Data Syncing

### Flow 3: Bidirectional Map-List Syncing

**User Flow:** When a user pans the map, the adjacent list feed dynamically refreshes to show only visible venues. Conversely, when a user taps a venue card in the list feed, the map smoothly zooms and centers (`flyTo`) on that specific venue pin.

**Underlying Problem (The Sync Loop):** This creates a classic circular layout bug. Selecting a list element programmatically shifts the map viewport. The map viewport framework interprets this as a manual navigation event and immediately triggers a new bounding-box calculation, refetching data and clearing out the user's focus state in the list.

**Solution & Technology:** Manage state via a unified frontend coordinator (such as Zustand or Redux). Introduce a state flag called `isProgrammaticMove`. When a user strikes a card in the list, set `isProgrammaticMove = true` right before calling the map instance's positioning methods. Inside your map's movement listener (`moveend`), wrap your network execution block in a conditional statement: if the flag is true, toggle it back to false and bypass the network query. Only allow physical pointer drags (`isProgrammaticMove === false`) to trigger database lookups.

---

### Flow 4: High-Contrast View Toggle

**User Flow:** A user steps out into direct sunlight at a stadium fan zone and toggles "High Contrast" mode. The map instantly switches to an ultra-readable theme without reloading any venue pins.

**Underlying Problem:** Forcing a map engine to change styling elements individually across custom DOM markers causes massive layout shifts and slows performance. Maps rely on tile management to handle high granularities efficiently.

**Solution & Technology:** Leverage Mapbox Studio to pre-bake two distinct, vector map tile stylesheets. The styles are hosted on a Content Delivery Network (CDN) for minimum latency. When high contrast is toggled, call `map.setStyle()` via the Mapbox SDK to pass the high-contrast style ID. The client's WebGL graphics card will instantly re-render the structural layers (roads, boundaries, landmasses) under your coordinates without dropping or reloading the venue data layer sitting on top.

---

## 3. Real-Time Metrics & Cost Optimization

### Flow 5: Live Crowd Indexing, Fan Ratios, & Status Streaming

**User Flow:** Users see a live, fluctuating crowd capacity meter (e.g., Wild, Packed, Chill), a color-coded percentage bar of competing fan fanbases, and instant status updates (e.g., "Bar is Full" or "Sound On") updating instantly on their screen during a live game.

**Underlying Problem (Firebase Read & Network Costs):** Firebase charges a fee per document read, alongside network egress fees for moving data out of the cloud. If highly volatile real-time updates are written inside a dense primary venue document containing image URLs, descriptions, and static data, every tiny crowd change forces a full file download. If thousands of users are looking at that area, your bandwidth bills will skyrocket and devices on congested stadium cell towers will freeze.

**Solution & Technology (The Data Isolation Pattern):** Create two completely separate collections inside your Firestore database to isolate your data by how fast it changes:

- **`venues` Collection (Slow-Moving Layer):** Stores fixed info that rarely changes (custom fanzone descriptions, organizer profiles, fixed structures).
- **`live_statuses` Collection (Fast-Moving Layer):** A collection of hyper-lean documents containing only tiny, volatile text strings: `{ venueId: "GOOGLE_ID_OR_CUSTOM_ID", crowdIndex: "Packed", fanRatio: "60/40", sound: "On" }`. The frontend attaches active snapshot web-socket listeners exclusively to this lightweight collection, reducing data transfer size by over 99%, dropping bandwidth costs, and ensuring smooth updates over slow stadium networks.

---

### Flow 6: Offline Data Fallback

**User Flow:** A user enters a packed stadium where cellular data network connection is completely dropped. The app falls back to displaying the last known map state, caches user interactions locally, and displays a clear offline indicator warning that live metrics may be stale.

**Underlying Problem:** Complete cellular drops break image tile streaming and disconnect real-time web sockets, causing the screen to freeze or show missing textures.

**Solution & Technology:**

- **Map Geometry Caching:** Use the Mapbox Offline Storage API to download local map tile fragments directly to the device database ahead of time.
- **State Persistence:** Activate Firestore Offline Persistence within your initialization code. Firebase automatically mounts an on-device cache to catch read and write operations.
- **UI State Syncing:** Observe connectivity changes through network status flags alongside welfare checks on Firestore's native document metadata snapshot property (`snapshot.metadata.fromCache`). If a query reveals `fromCache === true`, the application instantly forces an "Offline Map" header banner onto the screen and adds a warning icon beside all real-time crowd indexes to signal that data synchronization is paused until cell service resumes.
