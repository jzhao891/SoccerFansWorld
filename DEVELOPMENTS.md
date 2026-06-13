# Development Reference

## Install Dependencies

```bash
npm install
```

## Build All (Web + Mobile)

```bash
npx turbo build
```

---

## Web (`apps/web`)

### Verify Build

```bash
cd apps/web && npm run build
```

### Run Dev Server

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null; echo "done"
cd apps/web && npm run dev:next
```

Open http://localhost:3000

### Lint

```bash
cd apps/web && npm run lint
```

### Run Tests

```bash
cd apps/web && npm run test
```

### Run Tests (watch mode)

```bash
cd apps/web && npm run test:watch
```

---

## Mobile (`apps/mobile`)

### Run Tests

```bash
cd apps/mobile && npm run test
```

### Verify Build (no device needed)

```bash
# Exports both iOS and Android platforms
cd apps/mobile && npm run build
```

### Run Dev Server

```bash
cd apps/mobile && npm run start

OR

cd apps/mobile && npx expo start --tunnel
```

Press `i` to open on iOS Simulator, `a` for Android Emulator.
Requires the dev client build to be installed first (see EAS Build below).
**Note:** Expo Go is not supported — the app uses `@rnmapbox/maps` which requires a dev client.

### Run on iOS Simulator (Mac + Xcode required)

```bash
cd apps/mobile && npm run ios
```

---

## EAS Build (Cloud — no local Xcode needed)

EAS Build compiles the native iOS/Android app on Expo's servers. Required because
`@rnmapbox/maps` is a native module not supported by Expo Go.

### Build profiles

| Profile | Purpose |
|---|---|
| `development` | Dev client for iOS Simulator — use for daily development |
| `preview` | Internal build for a real device (no App Store) |
| `production` | App Store submission |

### First-time setup

**1. Log in to EAS**
```bash
cd apps/mobile && npx eas login
```

**2. Store secrets on Expo's servers (run once per secret)**

Values come from `apps/mobile/.env.local` — never put them in `eas.json`.

```bash
cd apps/mobile
npx eas secret:create --scope project --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN --value sk.xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_MAPBOX_TOKEN --value pk.xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value AIza...
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value AIza...
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value xxx
npx eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value xxx
```

**3. Build dev client for iOS Simulator**
```bash
cd apps/mobile && npx eas build --profile development --platform ios
```

EAS builds on Expo's servers (no Xcode needed locally). When done, EAS will offer
to install the `.app` directly on the simulator. After this one-time build, use
`npm run start` + press `i` for daily development — no rebuild needed unless
native dependencies change.

### Rebuild when needed

Only required when native dependencies change (new native package, changes to
`app.config.ts` plugins):
```bash
cd apps/mobile && npx eas build --profile development --platform ios
```

### Android physical device

```bash
cd apps/mobile && npx eas build --profile development --platform android
```

Install the resulting `.apk` on your Android device.
