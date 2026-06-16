# AUTH LLD Decisions

## Web

### Provider Matrix

| Provider | Web | iOS | Android |
|---|---|---|---|
| Google | ✅ | ✅ | ✅ |
| Apple | ✅ | ✅ | ❌ |
| Email / Password | ✅ | ✅ | ✅ |

### Shared Data Model (`packages/shared`)

- Add `AuthUser` type — lean struct, no Firebase SDK dependency in shared:
  ```ts
  type AuthUser = {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null; // profile pic from OAuth provider; null for Apple
  };
  ```
- Add to Zustand store: `currentUser: AuthUser | null` + `setCurrentUser`

### New Components (`apps/web/components`)

| Component | Responsibility |
|---|---|
| `AuthProvider.tsx` | Client component wrapping the layout; runs `onAuthStateChanged` on mount, maps `FirebaseUser → AuthUser`, writes to Zustand |
| `AuthSheet.tsx` | Bottom sheet with Google, Apple, Email/Password options; accepts `onSuccess?: () => void` callback to resume pending action after sign-in |
| `ProfileAvatar.tsx` | Always visible in top bar; signed-out → opens `AuthSheet`; signed-in → shows photo or initials, opens `ProfileSheet` |
| `ProfileSheet.tsx` | Mini bottom sheet: display name, email, sign-out button |

### New Lib (`apps/web/lib/auth.ts`)

Single file for all Firebase Auth calls:
- `signInWithGoogle()` — `signInWithPopup` + `GoogleAuthProvider`
- `signInWithApple()` — `signInWithPopup` + `OAuthProvider('apple.com')`
- `signInWithEmail(email, password)` — `signInWithEmailAndPassword`
- `signOut()` — `signOut(auth)`

### Gating Write Actions (`app/page.tsx`)

Pending action pattern — `AuthSheet` receives `onSuccess` callback:
```ts
function handleCreateParty(...args) {
  if (!currentUser) {
    openAuthSheet(() => handleCreateParty(...args));
    return;
  }
  // proceed
}
```
Same pattern applies to check-in and RSVP when those are built (Phase 10).

### `created_by` Population (`CreateWatchPartySheet.tsx`)

```ts
{ ...partyData, created_by: currentUser!.uid }
```

### Layout Wiring (`app/layout.tsx`)

Wrap children with `<AuthProvider>` so `onAuthStateChanged` runs once at the app root and every component can read `currentUser` from Zustand.

### One-Time Firebase Console Setup (Prereqs)

| Task | Location |
|---|---|
| Enable Email/Password provider | Firebase Console → Auth → Sign-in method |
| Enable Google provider | Firebase Console → Auth → Sign-in method |
| Enable Apple provider | Firebase Console → Auth → Sign-in method |
| Add `fandar.ai` to authorized domains | Firebase Console → Auth → Settings → Authorized domains |
| Apple: create Service ID + private key | Apple Developer Console → Certificates, IDs & Profiles |

---

## Mobile (LLD TBD)

Mobile auth LLD to be designed separately. Key differences from web:
- `signInWithPopup` not available in React Native — requires native OAuth flows
- Google: `expo-auth-session` or `@react-native-google-signin/google-signin`
- Apple: `expo-apple-authentication` (iOS only)
- Android: Google + Email/Password only (no Apple Sign-in)
