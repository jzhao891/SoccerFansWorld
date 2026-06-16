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

---

## Domain & DNS Setup (Cloudflare → Vercel)

**Domain:** `fandar.ai`
**Registrar:** Cloudflare
**DNS authority:** Cloudflare (direct — no Route 53 needed)
**Hosting:** Vercel

> Note: Route 53 is not needed. Cloudflare DNS is free, fast, and sufficient for Vercel hosting.

### Step 1 — Add domains to Vercel

```bash
vercel domains add fandar.ai
vercel domains add www.fandar.ai
```

### Step 2 — Auto-configure DNS via Vercel

Vercel dashboard → `https://vercel.com/fandarai-s-projects/web/settings/domains` → click a domain showing "DNS Change Recommended" → **Auto Configure** → **Authorize**.

Vercel will add a TXT verification record and a CNAME record directly to Cloudflare. Repeat for both domains. Both should show green/active within minutes.

---

## Firebase Auth

**Console:** https://console.firebase.google.com → `footballfansworld-d532e` → Authentication

### Step 1 — Initialize Authentication [DONE]
Firebase Console → Authentication → **Get started**

### Step 2 — Enable providers [DONE]
Firebase Console → Authentication → **Sign-in method**

- [DONE] **Email/Password** → toggle on → Save
- [DONE] **Google** → toggle on → set support email (`smin.lee5234@gmail.com`) → Save
- [ ] **Apple** → blocked until iOS App ID exists (see backlog)

### Step 3 — Add authorized domain [DONE]
Firebase Console → Authentication → **Settings** → **Authorized domains** → Add `fandar.ai`

### Step 4 — Apple Sign-in setup [ ] *(blocked — no iOS App ID yet)*
Complete once iOS App ID (bundle ID) is registered:

1. **Apple Developer** → Identifiers → `ai.fandar.web` (Service ID already created) → enable **Sign in with Apple** → Configure:
   - Primary App ID: select the iOS App ID once registered
   - Domains: `fandar.ai`
   - Return URL: `https://footballfansworld-d532e.firebaseapp.com/__/auth/handler`
2. **Apple Developer** → Keys → + → enable **Sign in with Apple** → Configure → select Primary App ID → Download `.p8` key file (once only) → note the **Key ID** and **Team ID** (top-right of Apple Developer dashboard)
3. **Firebase Console** → Authentication → Sign-in method → **Apple** → fill in:
   - Services ID: `ai.fandar.web`
   - Apple Team ID: *(from step 2)*
   - Key ID: *(from step 2)*
   - Private key: *(contents of `.p8` file)*
