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
cd apps/web && npm run dev
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
cd apps/mobile && npx expo export --platform ios
cd apps/mobile && npx expo export --platform android
```

### Run Dev Server (universal — scan QR with Expo Go on any device)

```bash
cd apps/mobile && npm run start
```

### Run on iOS Simulator (Mac + Xcode required, auto-launches simulator)

```bash
cd apps/mobile && npm run ios
```

### Run on Android Emulator (Android Studio required)

```bash
cd apps/mobile && npm run android
```
