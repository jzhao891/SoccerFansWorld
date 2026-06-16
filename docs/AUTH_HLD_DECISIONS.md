# AUTH HLD Decisions

## 1. Primary Architecture Stack

- **Identity Provider:** Firebase Auth, enforced natively alongside Firebase Firestore to allow secure database access via Firestore Security Rules (e.g., `request.auth.uid == resource.data.created_by`).
- **Authentication Requirement:** Auth is required for all write actions (creating watch parties, check-ins, RSVPs). Pure guest access is not used — a reliable user identity anchor is needed to prevent data dropping across sessions, track user credits, and secure async worker payloads.

## 2. Authentication Providers

| Provider | Web | Mobile | Notes |
|---|---|---|---|
| Email / Password | ✅ | ✅ | Manual sign-up flow |
| Google | ✅ | ✅ | `signInWithPopup` on web; `expo-auth-session` + native Google SDK on mobile |
| Apple | ✅ | ✅ | **Required** — Apple App Store Review Guideline 4.8 mandates Sign in with Apple whenever any third-party social provider is offered |

## 3. Instagram Integration (Extension Layer)

Instagram OAuth is strictly an **extension layer**, entirely isolated from the primary account identity:

1. User signs in via primary provider (Google, Apple, or Email)
2. Once authenticated, user can optionally trigger a separate Meta OAuth 2.0 connection to authorize Instagram publishing
3. Resulting short/long-lived access tokens are stored in the authenticated user's Firestore document
4. Revoking Instagram access does not affect the primary account

## 4. Session Persistence and Async Reconnection

- Firebase Auth state persists across app lifecycles (web: IndexedDB via `browserLocalPersistence`; mobile: native secure storage)
- If a user triggers a long-running GenAI job and exits the app, the backend process continues server-side
- On re-launch, the persistent auth session allows the frontend to immediately query Firestore for incomplete or recently finalized jobs tied to the user's `uid`

## 5. UX Pattern — Lazy Auth

The map and venue discovery are fully open (no login wall). Auth is triggered when a user initiates a write action or manually opens the profile.

| Action | Auth required | Reason |
|---|---|---|
| Browse map / venues | ❌ | Core discovery is open |
| Create watch party | ✅ | Party must be owned by a `uid`; orphaned records can't be edited, deleted, or surfaced as "mine" |
| Check-in | ✅ | Trust model requires identity |
| RSVP | ✅ | Attendance tracking requires identity |

**Avatar in top bar — always visible:**
- **Signed out:** generic person icon → taps to auth sheet (sign-in options)
- **Signed in:** user's profile photo or initials → taps to mini profile sheet (name, email, sign out)

**Gated action flow:**
1. User taps a write action (create party, check-in, RSVP)
2. If not signed in → auth bottom sheet slides up with provider options
3. After sign-in → sheet dismisses and the original action resumes automatically
