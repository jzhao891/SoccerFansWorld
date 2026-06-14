# CI/CD

## Web — Vercel Production Deployment

### One-time Vercel dashboard setup

Go to: `vercel.com/fandarai-s-projects/web/settings` → **General** → **Build & Development Settings**

| Setting | Value |
|---|---|
| **Root Directory** | *(leave blank — monorepo root)* |
| **Build Command** | `npx turbo build --filter=@sfw/web` |
| **Output Directory** | `apps/web/.next` |
| **Install Command** | `npm install` |

### Environment variables

Add in dashboard → **Environment Variables**:

| Variable | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app | Public |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | mapbox.com → Account → Access tokens | Public — restrict to domain after deploy |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → APIs & Services → Credentials | Server-side only |
| `FAL_KEY` | fal.ai dashboard | Optional — only needed for face-swap feature |
| `HF_TOKEN` | huggingface.co/settings/tokens | Optional — only needed for face-swap feature |
| `FACE_SWAP_PROVIDER` | `fal` or `hf` | Optional — only needed for face-swap feature |

### Deploy to production

```bash
cd apps/web && npx vercel --prod
```

### Post-deploy security checklist

- [ ] Restrict Mapbox token to production domain: mapbox.com → Account → Access tokens → edit → Allowed URLs
- [ ] Restrict Google Places API key to production domain: Google Cloud Console → APIs & Services → Credentials → HTTP referrers
- [ ] Add Firestore security rules (see BACKLOGS.md)

---

## Mobile — EAS Production Build (iOS)

> Requires Apple Developer account and production Firebase config.

```bash
# Build signed .ipa
npx eas build --profile production --platform ios

# Submit to TestFlight
npx eas submit --platform ios
```

See BACKLOGS.md for full prerequisites.
