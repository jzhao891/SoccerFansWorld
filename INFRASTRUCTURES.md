# Infrastructure Reference

> One-time account and credential setup steps are in `ONETIME_SETUP.md`.

---

## Firebase

**Project:** `footballfansworld-d532e`
**Console:** https://console.firebase.google.com

### Firestore Collections
- `venues` — fan zones with geohash index for geo queries
- `live_statuses` — lightweight real-time crowd data per venue
- `jobs` — async fal.ai generation jobs (image + video); see [Async Job Queue](#async-job-queue) below

### Firestore Indexes
- `venues`: composite index on `is_active` (asc) + `geohash` (asc)
- `jobs`: single-field index on `falRequestId` (used by webhook query)

### Env vars (`apps/web/.env.local`)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Admin SDK env vars (server-side only — Vercel env + `.env.local`)
Used by the `/api/fal-webhook` route (firebase-admin, not the client SDK).
```
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=          # paste the full key; Vercel stores \n as literal \n (handled in code)
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

---

## Async Job Queue

Handles all fal.ai image and video generation without blocking on model run time.

### Flow

```
Client  →  Firestore jobs/{jobId} { status: "pending", endpoint, input, userEmail, jobType }
             ↓  onCreate trigger (Cloud Function, exits < 1 s)
           fal.queue.submit(endpoint, { input, webhookUrl })  →  request_id
           Firestore update: { status: "queued", falRequestId }

[fal runs the model independently — seconds to minutes]

fal  →  POST /api/fal-webhook?secret=...
             fal.queue.result(endpoint, { requestId })  →  outputUrl
             Firestore update: { status: "done", outputUrl, completedAt }
             Resend email → userEmail
```

### Job doc schema (`jobs/{jobId}`)

| Field | Type | Set by |
|---|---|---|
| `endpoint` | string | caller |
| `input` | object | caller (all assets must be fal storage URLs, not base64) |
| `jobType` | `"image"` \| `"video"` | caller |
| `userEmail` | string | caller |
| `status` | `"pending"` → `"queued"` → `"done"` \| `"error"` | pipeline |
| `falRequestId` | string | Cloud Function |
| `queuedAt` | Timestamp | Cloud Function |
| `outputUrl` | string | webhook |
| `completedAt` | Timestamp | webhook |
| `error` | string | webhook (on failure) |

### Files

| File | Purpose |
|---|---|
| `functions/src/index.ts` | Cloud Function (`dispatchFalJob`, Firestore onCreate) |
| `apps/web/app/api/fal-webhook/route.ts` | Webhook handler — fetches result, updates Firestore, emails |
| `apps/web/lib/firebaseAdmin.ts` | firebase-admin singleton for Next.js server routes |
| `packages/shared/src/types/jobs.ts` | Shared TypeScript types (`JobDoc`, `JobInput`, `JobStatus`) |

### Env vars

**Cloud Function** (set via `firebase functions:config:set` or Firebase Console):
```
FAL_KEY=
WEBHOOK_BASE_URL=https://fandar.ai
FAL_WEBHOOK_SECRET=          # random secret shared with Next.js webhook
```

**Next.js** (`apps/web/.env.local` + Vercel env):
```
FAL_KEY=
FAL_WEBHOOK_SECRET=          # same value as Cloud Function
RESEND_API_KEY=              # optional — email skipped if absent
```

### Deploy Cloud Function

```bash
cd functions && npm run build
firebase deploy --only functions
```

### Client usage pattern

```typescript
import { collection, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { fal } from "@fal-ai/client";

// 1. Pre-upload any local files to fal storage (so input contains only URLs)
fal.config({ credentials: FAL_KEY });
const imageUrl = await fal.storage.upload(file);

// 2. Create the job doc — Cloud Function picks it up instantly
const ref = await addDoc(collection(db, "jobs"), {
  endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
  input: { image_url: imageUrl, prompt: "...", aspect_ratio: "9:16" },
  jobType: "video",
  userEmail: user.email,
  status: "pending",
  createdAt: serverTimestamp(),
});

// 3. Listen for completion
onSnapshot(ref, (snap) => {
  const job = snap.data();
  if (job?.status === "done") console.log(job.outputUrl);
  if (job?.status === "error") console.error(job.error);
});
```

---

## Domain & DNS

**Domain:** `fandar.ai`
**Registrar:** Cloudflare
**DNS:** Cloudflare direct
**Hosting:** Vercel (`https://vercel.com/fandarai-s-projects/web`)

- `fandar.ai` and `www.fandar.ai` both active and green in Vercel dashboard
- DNS managed via Vercel Auto Configure (Cloudflare integration)
