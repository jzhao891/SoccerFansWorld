# CI/CD

## Web — Vercel Production Deployment

> Build settings are version-controlled in `vercel.json` at the repo root — no manual dashboard configuration needed.

### Environment variables

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

Run from the monorepo root. Each command prompts for the value interactively. Select **Production + Preview + Development** for all except `GOOGLE_PLACES_API_KEY` (Production + Preview only — locally `.env.local` is used directly).

```bash
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY
vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID
vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
vercel env add NEXT_PUBLIC_FIREBASE_APP_ID
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN
vercel env add GOOGLE_PLACES_API_KEY
```

### Deploy to production

Run from the **monorepo root** (e.g. /Users/sl5234/Workspace/soccerfansworld) — `vercel.json` lives there, and Vercel uses the root as the project root so `npm install` correctly sets up workspace symlinks.

```bash
npx vercel --prod --archive=tgz
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
