# Check-in & RSVP — LLD Decisions

> **Active design: client-aggregation voting.** Signed-in fans cast a single per-venue "check-in" vote (current vibe + whether there's a big screen + whether sound is on). Every viewer reads the raw votes and **aggregates them client-side** for display. RSVP is a separate, simpler per-user headcount. The whole thing runs on the **Spark** plan — no Cloud Functions, no Blaze. See `AUTH_LLD_DECISIONS.md` (`users/{uid}` metadata) and `FIRESTORE_LLD_DECISION.md` for the surrounding data model.

## Why client-aggregation (and not the alternatives)

| Model | Verdict | Reason |
|---|---|---|
| **Last-write-wins** (one shared "live status" doc per venue) | ❌ Rejected | Any signed-in user overwrites everyone else's view; no notion of consensus; trivially defaced. |
| **Server-side aggregation** (private votes → tamper-proof summary doc via Cloud Function) | ⏸ Deferred | Tamper-proof, but **requires Blaze** (Cloud Functions). Our project is on Spark. Revisit if abuse appears. |
| **Client-aggregation voting** (public per-user votes, each viewer tallies) | ✅ Chosen | Works on Spark. No forgeable summary — every viewer recomputes from raw votes. Integrity comes from the **owner-scoped rule** (one vote per uid), so ballot-stuffing needs sybil accounts. |

**Trust model / honest caveat.** Auth ≠ integrity. A signed-in user can still POST a lie directly to Firestore via the SDK/REST (a valid ID token is obtainable from the public Auth API — the app UI is *not* the security boundary; the rules are). What the rules **do** guarantee: the vote doc id is the caller's `uid`, so **each user gets exactly one vote per venue** (writing again overwrites their own). Stuffing the count therefore requires many real accounts (sybil), not a loop. Binding requests to the genuine app (App Check) is deferred. See the "Secure check-in / live-status writes" backlog item.

## Data model

```
venues/{venueId}/check_ins/{uid}   // one check-in vote per user per venue
  = {
      user_id:     string,         // == uid == the doc id (redundant, convenient)
      vibe:        'Chill' | 'Buzzing' | 'Packed',   // REQUIRED, single-select, ordinal
      big_screen?: boolean,        // OPTIONAL, crowd-verified: "big screen right now?" (field omitted if not answered)
      sound?:      boolean,        // OPTIONAL, crowd-verified: "sound on right now?" (field omitted if not answered)
      updated_at:  Timestamp,      // drives the freshness window + decay
    }

venues/{venueId}/rsvps/{uid}       // one RSVP per user per venue
  = { user_id: string, created_at: Timestamp }
```

**Scope: per event, not per physical venue.** `venueId` is a document id in the `venues` collection — i.e. a **FanZone (event) doc id** (`fz.id`), so check-ins/RSVPs hang off a specific match, not the bar. This is deliberate: the vibe/sound/big-screen metrics *describe the physical venue's state*, but a check-in is only meaningful in the context of the match you're there for, and only **one event is ever live at a moment** — so the live event's check-ins *are* the venue's right-now vibe. It's also the only scope where the freshness window (`start_time − 2h`) has a concrete anchor. The drawer renders check-in/RSVP per event; the soonest/live event (`rep = events[0]`, past events swept away) acts as the venue's headline. RSVP is likewise per-event ("going to this match").

**Why the vote lives under the venue (`venues/{venueId}/check_ins/{uid}`)** and not `users/{uid}/check_ins/{venueId}`: the dominant read is "all votes for *this* event," which is a single direct subcollection read here vs. a collection-group query in the user-keyed layout.

**One vote per user is enforced by the path itself** — the doc id *is* the uid. No rule logic needed for that part; a second write from the same user overwrites their own doc.

**`big_screen` / `sound` are crowd-verified, not venue properties.** We deliberately keep them **out of the venue-creation sheet** (keep create simple) and trust the people actually in the room over the creator's self-description. They therefore live in the check-in vote and are aggregated across recent votes. **They are optional per vote** (only `vibe` is required) — a user can check in with just a vibe. An unanswered binary is *omitted* from the doc, so it doesn't count as a "no."

## Aggregation algorithm (client-side, per venue)

Runs whenever the `check_ins` subcollection snapshot changes (its own realtime subscription — the parent venue doc is **never** touched by a check-in; see "Venue doc stays untouched" below).

### 1. Freshness window (event-anchored, rolling fallback)
Keep only votes with `updated_at ≥ windowStart`, where:
```
windowStart = start_time != null ? (start_time − 2h) : (now − 2h)
```
When the venue has a `start_time`, the window is **anchored to the event** — fans arrive up to ~2h early, and older votes are stale. When it doesn't (TBD-time knockout events, which stay optional — see Prerequisites), it degrades gracefully to a **rolling "last 2h from now"** window. One expression covers both.

- **Upper bound is handled elsewhere.** A separate expiry sweeper inactivates/removes venues after `end_time` ("Fan zone expiry sweep" backlog item), so a past-event venue simply isn't on the map and receives no check-ins. The aggregation needs **only the lower bound**; we do **not** rules-enforce "no check-in after end."
- **`start_time` stays optional.** ~33 seeded TBD-time knockout events (Round of 16/32, Quarter-Finals) have no kickoff time. Rather than backfill, the rolling fallback covers them; upgrade to a concrete anchor if/when real kickoff times get filled in.

### 2. Recency decay (exponential)
Within the window, weight each surviving vote by its age (age measured from *now*):
```
weight = 0.5 ^ (ageMinutes / HALF_LIFE_MIN)     // HALF_LIFE_MIN ≈ 30 (tunable)
```
Fresh vote ≈ 1.0; a 30-min-old vote ≈ 0.5; a 60-min-old vote ≈ 0.25.

### 3. Vibe → ordinal weighted mean
Vibe is **ordinal** (an ordered scale, not unrelated buckets): `Chill < Buzzing < Packed`. Map to numbers, take the recency-weighted mean, round back to a label:
```
Chill = 0, Buzzing = 1, Packed = 2
mean  = Σ(weight × level) / Σ(weight)
label = round(mean) → back to Chill / Buzzing / Packed
```
**Worked example** — votes `(level, weight)`: `Packed(2,1.0), Packed(2,0.8), Buzzing(1,0.5), Chill(0,0.2)`
→ `Σ(w·level)=4.1`, `Σw=2.5`, `mean=1.64` → `round→2` → **Packed**.

Why the mean and not "most common": a venue split `Chill(0)` / `Packed(2)` at equal weight averages to `1 → Buzzing` (the sensible middle) — plurality would tie and pick arbitrarily, hiding the ordering. (If trolls skew the mean later, swap in a weighted **median** — same inputs, more outlier-resistant.)

**Note:** each user picks exactly **one** vibe. The mean is *across users* — it is not a user selecting multiple vibes.

### 4. Big screen / Sound → weighted yes-fraction (per-metric denominator)
Each is binary and **optional**, so its "average" is the recency-weighted fraction that said yes **among the votes that answered it** — *not* over all votes:
```
bigScreenWeight = Σ(weight of votes that answered big_screen)
bigScreenFraction = Σ(weight of "yes" answers) / bigScreenWeight
badge           = bigScreenFraction > 0.5 ? yes : no    // optionally surface %, e.g. "🔊 On (85%)"
```
Same for `sound`. This is why the aggregation carries **per-metric weights** (`bigScreenWeight`, `soundWeight`) distinct from the vibe weight — a vote that skipped a binary contributes to `vibe` but not to that binary's denominator. ("Weighted majority" and "average of a binary" are the same computation.)

### 5. Confidence gate (per-metric)
Each metric is gated on **its own** surviving weight: if `vibeWeight` / `bigScreenWeight` / `soundWeight` is below a small threshold (too few / too stale answers), that metric shows **no badge** rather than a misleading one from a single vote. So a venue can show a Vibe while hiding Sound if few people answered Sound.

## RSVP count
Separate, simpler feature (RSVP = "planning to go," distinct from check-in = "here now"). One `rsvps/{uid}` doc per user per venue; the display is just **`count(rsvps)`** ("👥 42 going"). No vibe / decay / window math — a plain headcount.

## Drawer display
Per venue: **Vibe** (Chill/Buzzing/Packed) · **Big screen** (👍/👎) · **Sound** (🔊/🔇) · **RSVP** (👥 count). Check-in and RSVP write actions are auth-gated (open `SignInSheet`, resume on success — same lazy-auth pattern as Create).

## Venue doc stays untouched by check-ins
A check-in does **not** bump any `last_modified` on `venues/{venueId}`, because:
- **Not needed** — the crowd badge is driven by the `check_ins` subcollection's own realtime subscription; the parent doc isn't in that path.
- **Would force opening the locked venue rule** to client writes, with a fiddly "only the timestamp changed" carve-out on the doc we most want protected.
- **Cost + hotspot** — it would re-trigger the map's venue-query `onSnapshot` for *every* viewer on every check-in, and funnel a popular venue's check-ins into one contended doc (~1 sustained write/sec/doc). The per-uid vote docs have none of this.

The timestamp that matters (`updated_at`) lives **on the check-in doc**, which is exactly what the window/decay math reads.

## Owner-scoped venue edit (included in this work)
Venue **updates** are opened but restricted to the doc's creator via the existing `created_by` field:

```
match /venues/{venueId} {
  allow read: if true;

  allow create: if isValidFanZone(request.resource.data)
                && request.resource.data.activity_status == 'INACTIVE'
                && request.resource.data.created_by == request.auth.uid;   // stamp self, requires auth

  allow update: if request.auth != null
                && resource.data.created_by == request.auth.uid                 // only the owner
                && request.resource.data.created_by == resource.data.created_by // can't reassign owner
                && request.resource.data.activity_status == 'INACTIVE'          // edits re-enter moderation
                && isValidFanZone(request.resource.data);

  allow delete: if request.auth != null
                && resource.data.created_by == request.auth.uid;
}
```

Key guards:
- **`resource.data`** = doc as it exists; **`request.resource.data`** = doc after the write.
- `resource.data.created_by == request.auth.uid` → you may only touch a venue you created.
- `request.resource.data.created_by == resource.data.created_by` → blocks the reassign-ownership bypass (stamping your own uid onto someone else's venue).
- Forcing `activity_status == 'INACTIVE'` on update → an edit **re-enters LLM moderation** (the sweeper re-activates), and the owner can't self-promote to `ACTIVE`.

Even with updates open, a random checked-in user still can't bump the venue (not the owner) — so the "venue doc untouched" property holds regardless.

## Code organization (shared vs per-app)
This feature ships to **both web and mobile** (mobile may lag/break temporarily, but the design targets both). So **everything that isn't a rendered component lives in `packages/shared`** and is consumed identically by `apps/web` and `apps/mobile`:

| Layer | Home | Notes |
|---|---|---|
| Types (`CheckIn`, `Rsvp`, `Vibe`) | `packages/shared` | Single source of truth. |
| Aggregation (window/decay/mean/yes-fraction) | `packages/shared` | Pure fn, unit-tested, no UI/SDK deps. |
| Subscription hooks (`check_ins`, `rsvps`) | `packages/shared/src/hooks` | Same `firebase/firestore` SDK works in web + RN (mirrors existing `useVenueSubscription`). |
| Write helpers (`writeCheckIn`, `writeRsvp`, `updateVenue`) | `packages/shared` | Thin functions taking `{ venueId, uid, ... }`; both apps call them. |
| Validation (`isValidFanZone`, `isValidCheckIn`) | `packages/shared` + `firestore.rules` | Keep the client validator and the rule in lockstep. |
| **Presentational UI** (drawer sections, buttons, toggles) | `apps/web`, `apps/mobile` | The **only** per-app layer. Reads from shared hooks, calls shared write helpers. |

Rule of thumb: if it touches the DOM / React Native primitives → per-app; otherwise → shared.

## Prerequisites (must land first)
1. **Require sign-in to create a venue + stamp `created_by = request.auth.uid`.** Create is currently unauthed and stamps `created_by: currentUser?.uid ?? ''`, so venues can be born ownerless (`''`) and un-editable — the owner rule can't work without this. Web has auth today; mobile create must also require auth (or web-first only) — this is the real dependency (the previously deferred "require sign-in to create," blocked on mobile auth).

> **`start_time` stays optional** (decided against making it required): ~33 seeded TBD-time knockout events lack a kickoff time, and the aggregator's rolling fallback (§ Aggregation) handles them without a backfill.

## Rules summary (deltas from current)
- `venues` — open `update`/`delete` to the owner (`created_by`), keep create auth-stamped, re-moderate on edit (above).
- `venues/{venueId}/check_ins/{uid}` — `allow read: if true;` (public, so every viewer can aggregate); `allow write: if request.auth != null && request.auth.uid == uid && isValidCheckIn(request.resource.data);`.
- `venues/{venueId}/rsvps/{uid}` — `allow read: if true;` `allow write: if request.auth != null && request.auth.uid == uid;`.
- Retire the disabled `live_statuses` collection (dead code once this ships).

## Tuning knobs (defaults, revisit with real data)
`HALF_LIFE_MIN ≈ 30` · window lower bound `start_time − 2h` · confidence-gate minimum weight · median-vs-mean for vibe.
