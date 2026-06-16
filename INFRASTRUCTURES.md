# Infrastructure Reference

> One-time account and credential setup steps are in `ONETIME_SETUP.md`.

---

## Firebase

**Project:** `footballfansworld-d532e`
**Console:** https://console.firebase.google.com

### Firestore Collections
- `venues` — fan zones with geohash index for geo queries
- `live_statuses` — lightweight real-time crowd data per venue

### Firestore Indexes
- `venues`: composite index on `is_active` (asc) + `geohash` (asc)

### Env vars (`apps/web/.env.local`)
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

### Usage
- Called server-side only via `/api/places` proxy route
- Key is never exposed to the browser
- Restricted to Places API (New) to limit blast radius if leaked

### Env vars (`apps/web/.env.local`)
```
GOOGLE_PLACES_API_KEY=
```

---

## Mapbox

**Console:** https://mapbox.com → Account → Access Tokens

### Env vars (`apps/web/.env.local`)
```
NEXT_PUBLIC_MAPBOX_TOKEN=
```

---

## Domain & DNS

**Domain:** `fandar.ai`
**Registrar:** Cloudflare
**DNS:** Cloudflare direct
**Hosting:** Vercel (`https://vercel.com/fandarai-s-projects/web`)

- `fandar.ai` and `www.fandar.ai` both active and green in Vercel dashboard
- DNS managed via Vercel Auto Configure (Cloudflare integration)
