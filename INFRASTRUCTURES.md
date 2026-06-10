# Infrastructure Setup

## Firebase (Firestore)

**Project:** `footballfansworld-d532e`
**Console:** https://console.firebase.google.com

### Setup Steps
1. Create project at console.firebase.google.com
2. Disable Google Analytics (not needed)
3. Enable Firestore Database → Start in test mode → Region: `us-west2` (Oregon)
4. Register a web app (named `fanzone-web`) → copy `firebaseConfig` into `apps/web/.env.local`

### Collections
- `venues` — fan zones with geohash index for geo queries
- `live_statuses` — lightweight real-time crowd data per venue

### Indexes
- `venues`: composite index on `is_active` (asc) + `geohash` (asc)
  - Created via Firestore Console → Indexes → Structured → Create index

### Env vars (add to `apps/web/.env.local`)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## Google Places API

**Service:** Places API (New)
**Console:** https://console.cloud.google.com

### Setup Steps
1. Create or select a project at console.cloud.google.com
2. Go to APIs & Services → Library → search **Places API (New)** → Enable
3. Go to APIs & Services → Credentials → Create Credentials → API key
4. Edit the key → API restrictions → restrict to **Places API (New)**
5. Add key to `apps/web/.env.local`

### Usage
- Called server-side only via `/api/places` proxy route
- Key is never exposed to the browser
- Restricted to Places API (New) to limit blast radius if leaked

### Env vars (add to `apps/web/.env.local`)
```
GOOGLE_PLACES_API_KEY=
```

---

## Mapbox

**Console:** https://mapbox.com → Account → Access Tokens

### Setup Steps
1. Create an account at mapbox.com
2. Go to Account → Access Tokens → Create a token
3. Restrict token to allowed URLs in production
4. Add token to `apps/web/.env.local`

### Env vars (add to `apps/web/.env.local`)
```
NEXT_PUBLIC_MAPBOX_TOKEN=
```
