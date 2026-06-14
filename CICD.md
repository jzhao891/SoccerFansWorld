# CI/CD

## Web — Vercel Production Deployment

### One-time Vercel dashboard setup

Go to: `vercel.com/fandarai-s-projects/web/settings` → **General** → **Build & Development Settings**

| Setting | Value |
|---|---|
| **Root Directory** | *(leave blank — monorepo root)* |
| **Build Command** | `cd apps/web && npx next build` |
| **Output Directory** | `apps/web/.next` |
| **Install Command** | `npm install` |

### Environment variables

Add in dashboard → **Environment Variables**:

> **Note:** Variables prefixed with `NEXT_PUBLIC_` are embedded into the browser bundle at build time and are visible to anyone — do not put secrets in them. Use them only for values that are designed to be public (Firebase client config, Mapbox token). All other variables are server-side only.

| Variable | Source | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app | Public |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Console | Public |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | mapbox.com → Account → Access tokens | Public |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → APIs & Services → Credentials | Server-side only |

### Deploy to production

```bash
cd apps/web && npx vercel --prod
```

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
