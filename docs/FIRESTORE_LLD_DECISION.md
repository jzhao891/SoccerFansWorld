# Firestore Security — Low-Level Design Decisions

Decision record for how we secure Firestore access for FandarAI (web + mobile).
Captures the reasoning behind the **interim "partial rules + App Check"** approach
we're adopting *before* user authentication exists.

Project: `footballfansworld-d532e`

---

## 1. Context & threat model

- The web and mobile apps talk to Firestore **directly via the client SDK** — there is
  no backend API in front of the `venues` collection.
- The Firebase config (`apiKey`, project id, etc.) is **public** — it ships in the
  browser bundle and the mobile binary. It is an *identifier, not a secret*.
- Therefore **security rules are the only thing** between the public internet and the
  database. Today the rules are in the default **open/test** state → anyone who reads
  the JS bundle can **read, overwrite, or delete every document**.

Collections in use:
- **`venues`** — fan zones / watch parties shown on the map. One doc **per event**;
  many event docs can share one `venue_id`.
- **`live_statuses`** — the computed "right now" crowd/sound summary, keyed **per
  physical venue** (`venue_id`). One summary doc per place. Currently **no write path**
  (check-in UI is disabled).
- **`check_ins`** (future) — raw individual votes for the trust model. Does not exist yet.

---

## 2. How Firestore security rules work (reference)

- Rules live in `firestore.rules`, deployed via the Firebase Console or
  `firebase deploy --only firestore:rules`. They run **on Google's servers** on every
  read/write. **Default deny**: if no `allow` matches, access is rejected.
- Shape: `match /collection/{id} { allow read | create | update | delete | write: if <condition>; }`
  (`read` = get + list; `write` = create + update + delete).
- Key objects in conditions:
  - `request.auth` — `null` when not signed in; `request.auth.uid` + `request.auth.token`
    (decoded ID-token claims) when authenticated.
  - `resource.data` — the **existing** doc (read/update/delete).
  - `request.resource.data` — the **incoming** doc (create/update).
- **Rules are not row filters.** A `list`/query is **rejected entirely** if it *could*
  return a disallowed doc — Firestore never silently drops them. If reads were
  restricted (e.g. `is_active == true`), the client query would have to include the
  matching `where('is_active','==',true)` filter or be rejected. Since we keep reads
  **open**, all our geohash queries just work.

### What "sign in" means — and that it does not exist yet

- "Sign in" = authenticate via **Firebase Authentication** (a separate product). The
  user logs in (Google/Apple/email) → Firebase mints a signed **ID token** (a JWT)
  carrying a `uid` (the `sub` claim). The client SDK **auto-attaches** that token to
  every Firestore request; the rules engine verifies the signature against Google's
  public keys and populates `request.auth`. A client cannot forge a `uid` without
  Google's private key.
- **Confirmed: there is zero auth code in the repo** — `lib/firebase.ts` only
  initializes Firestore. So **`request.auth` is always `null` today.** Building auth is
  its own backlog item (design in `AUTH_LLD_DECISIONS.md`, no implementation yet).

---

## 3. Decision: partial rules now, defer user auth

Write-protection rules that require `request.auth.uid` are meaningless until auth
exists (every authed-only write would be **denied**, breaking "Create fan zone"). So
the **interim** posture is:

| Collection | read | create | update / delete |
|---|---|---|---|
| `venues` | open | allowed **but shape-validated** (`isValidFanZone`) | **locked** (`if false`) |
| `live_statuses` | open (summary is public; it's what we display) | **locked** | **locked** |
| `/{document=**}` | deny | deny | deny |

Rationale:
- **Open reads** — the map must read venues + the public live-status summary.
- **Validated creates** — even without auth, a writer cannot dump arbitrary keys, wrong
  types, oversized strings, or bad enums; every new doc must match the FanZone contract.
  This bounds the blast radius of an open create. ("Validate shape" = the rule inspects
  required keys / types / enums / size caps on `request.resource.data`.)
- **Locked update/delete** — kills tampering and destruction from clients. Privileged
  mutation (cleanup, moderation, expiry) moves to the **Admin SDK** (§5).
- **`live_statuses` writes locked** — nothing writes them today (check-in disabled), and
  an open write rule would let anyone spoof a venue's crowd status. Re-open with auth +
  the trust model later.

We tighten creates to **owner-scoped** (`created_by == request.auth.uid`) once auth lands.

---

## 4. App Check — the primary "no-auth" abuse protection

App Check answers *"is this request from a genuine, unmodified copy of my app?"* It is
**separate from user auth** and is the main lever for staying safe without a login.

Attestation providers:
- **reCAPTCHA Enterprise/v3 (web)** — behavioral bot detection; confirms a real browser
  session on our domain. **Weakest** (browsers are open environments).
- **App Attest / DeviceCheck (iOS)** — App Attest generates a key in the **Secure
  Enclave** (hardware) that Apple cryptographically attests belongs to a genuine build
  of our app. Hardware-rooted → very hard to forge.
- **Play Integrity (Android)** — attests the app binary is the one we signed/shipped via
  Play, on a genuine device. Hardware-backed.

Enforce App Check on Firestore → requests from random scripts/bots are rejected **before
rules run**.

### Honest limits (why App Check is a *first* layer, not the whole wall)

- **Key vs token.** The Secure-Enclave private key **never leaves the device** and is not
  extractable, even by a malicious process on the same device. But App Check mints a
  short-lived **token** (a bearer string) the SDK attaches to requests. On a
  **jailbroken/rooted** device — or via a proxy in front of the real app, or a stealth
  headless browser on web — an attacker can **copy a valid token and replay it** for its
  lifetime. They never forge the app or steal the key; they **borrow a valid ticket**.
- **What a stolen token grants:** only what the **rules** already allow an
  unauthenticated caller to do (read public data, create *validated* venues that are
  `is_active:false` → hidden). The token does **not** expand powers beyond the rules.
  This is *why* rules + locked mutations matter more than App Check.
- **Token TTL** (confirmed from Firebase docs): configurable **30 min – 7 days**,
  **default 1 hour** (library refreshes at ~half-TTL). Shorter TTL = smaller replay
  window but **more attestation churn** (latency, Play Integrity quota, cost). For true
  anti-replay on sensitive calls, use **limited-use (single-use) tokens** rather than a
  shorter global TTL. **Decision:** keep the default 1h.
- App Check / rules **cannot rate-limit by volume** (rules are stateless). A script with a
  harvested token can still write within the window → mitigate with **budget alerts**
  (and, if ever needed, a rate-limited server proxy — currently **dropped** as not worth
  the cost).

---

## 5. Client vs server trust boundary (Admin SDK)

The **Admin SDK bypasses security rules entirely** (service-account credential).
Critically, it **runs only on trusted infrastructure** — Cloud Functions, a server
route, or a local/CI script — **never in the app**, and the service-account key is
**never bundled** in a client (not `NEXT_PUBLIC_*`, not in the binary).

| | Runs where | Credential | Bypasses rules? | Forgeable? |
|---|---|---|---|---|
| **Client SDK** (app) | user device | public config + App Check token | No (bound by rules) | Yes (distributed) |
| **Admin SDK** (sweeps, seeding, aggregation) | **server only** | service-account key (secret) | **Yes** | No (attacker can't reach the server) |

Consequences:
- Forging/rebuilding the app yields **only the client** code — there is **no Admin SDK or
  key to steal**, so a forged app is still bound by rules + App Check.
- **The one rule you must never break:** never put the Admin SDK or its key in a client.
- Privileged work runs server-side with the Admin key: `seed-venues.ts`,
  `cleanup-dupes.ts`, the **moderation sweep**, the **expiry sweep**, and the future
  **vote-aggregation** function (which must **not** live in client/app logic — a forged
  client could otherwise write any summary).

---

## 6. Check-in / live status — three separable concerns

When check-in is re-enabled, the threats decompose into three, each with its own tool —
and **most are not auth-dependent**:

1. **Don't expose raw data** — the public `live_statuses` **summary** is fine to read
   (it's the "Crowded?" we display); individual votes must not be client-readable. Put
   raw votes in a separate **`check_ins`** collection with `allow read: if false`
   (clients write-only). **Solved by rules + data model — no auth needed.**
2. **Limit volume/spam writes** — rules are stateless and **cannot rate-limit**. Mitigate
   with **App Check** + per-doc validation + **budget alerts**. **Not solved by auth.**
3. **Vote integrity** (one actor casting many votes to skew the vibe) — needs a per-user
   **identity** to dedupe. This is the **only** part that requires identity.

### On Anonymous Auth (the identity for concern #3)

- **Firebase Anonymous Auth mints a unique `uid` per install** (no login UI) — *not* a
  shared id. Same install reuses its uid; different installs get different uids. This
  makes per-user dedup **possible** (e.g. vote doc id = `uid` so re-votes overwrite).
- **It is a deterrent, not a guarantee.** Anonymous uids are cheap to **reset**
  (reinstall / clear data) or **mint in bulk**, so it only *raises the cost* of
  ballot-stuffing. Full Auth (Google/Apple) is stronger (real accounts are costly to
  mass-create).
- **Integrity is layered:** identity (anonymous → full) + App Check (identities must come
  from the genuine app) + **server-side weighted/decay aggregation** so a few fake votes
  don't swing the displayed vibe. No single layer is a guarantee.

---

## 7. Summary of decisions

1. **Partial rules now, defer user auth.** Reads open; creates validated; update/delete
   locked; `live_statuses` writes locked; deny-all fallback.
2. **App Check is the primary no-auth protection** — enforce on Firestore across web/iOS/
   Android. Keep token TTL at the default **1 hour**.
3. **Admin SDK for all privileged/background writes** — server-side only, key never in a
   client. Migrate seeding/cleanup; back the sweeps and future aggregation.
4. **`live_statuses` / check-in stays disabled** until the trust model — then split into
   public summary vs. locked raw `check_ins`, with server-side aggregation.
5. **Budget alerts** cover the volume abuse rules can't stop. **Rate-limited proxy:
   dropped** (not worth the cost for now).

### Known gaps / deferred (and why)

- **`is_active == false` is app-enforced, not rule-enforced** today — making it a hard
  rule requires the seeder to stop writing `is_active:true`, i.e. **move seeding to the
  Admin SDK first**.
- **Owner-scoped updates/deletes** (users editing/deleting their own venues) and
  **trustworthy check-in** both **require auth** — deferred to the Auth task.

### Related backlog items
- 🔴 Authentication flow · 🔴 Firestore security rules · 🔴 Fan zone moderation sweep ·
  🔴 Secure check-in / live-status writes
- 🟠 Fan zone expiry sweep · 🟠 Venue/event deletion flow · 🟠 Check-in trust model
