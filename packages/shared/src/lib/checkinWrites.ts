// Write helpers for the check-in / RSVP / owner-edit flows. Thin wrappers over Firestore,
// shared by web + mobile (same firebase JS SDK). See docs/CHECKIN_LLD_DECISIONS.md.
//
// Timestamps are client-side (Date.now()) — consistent with the aggregation's clock and the
// "auth ≠ integrity, low-stakes" trust model. The rules cap one vote/RSVP per uid (doc id).

import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getDb } from './firebase';
import type { Vibe, VenueEditableFields } from '../types/map';

const VENUES = 'venues';
const CHECK_INS = 'check_ins';
const RSVPS = 'rsvps';

export type CheckInVote = {
  vibe: Vibe;            // required
  big_screen?: boolean;  // optional — omit to leave unanswered (not stored as false)
  sound?: boolean;       // optional
};

// Upsert the caller's single vote at venues/{eventId}/check_ins/{uid}. eventId is a FanZone
// (event) doc id — check-ins are per event. Only answered binaries are written.
export function writeCheckIn(eventId: string, uid: string, vote: CheckInVote): Promise<void> {
  const data: Record<string, unknown> = {
    user_id: uid,
    vibe: vote.vibe,
    updated_at: Date.now(),
  };
  if (vote.big_screen !== undefined) data.big_screen = vote.big_screen;
  if (vote.sound !== undefined) data.sound = vote.sound;
  return setDoc(doc(getDb(), VENUES, eventId, CHECK_INS, uid), data);
}

export function removeCheckIn(eventId: string, uid: string): Promise<void> {
  return deleteDoc(doc(getDb(), VENUES, eventId, CHECK_INS, uid));
}

// Add the caller's RSVP at venues/{eventId}/rsvps/{uid} (one per user — a plain headcount).
export function writeRsvp(eventId: string, uid: string): Promise<void> {
  return setDoc(doc(getDb(), VENUES, eventId, RSVPS, uid), {
    user_id: uid,
    created_at: Date.now(),
  });
}

export function removeRsvp(eventId: string, uid: string): Promise<void> {
  return deleteDoc(doc(getDb(), VENUES, eventId, RSVPS, uid));
}

// Owner-scoped venue edit. `patch` is limited to the editable content fields (VenueEditableFields);
// identity/provenance/derived fields are frozen (enforced by the rules' == checks). Forces
// activity_status back to INACTIVE so the edit re-enters the Admin-SDK moderation sweep (owner
// can't self-publish). See docs/CHECKIN_LLD_DECISIONS.md.
export function updateVenue(eventId: string, patch: Partial<VenueEditableFields>): Promise<void> {
  return updateDoc(doc(getDb(), VENUES, eventId), { ...patch, activity_status: 'INACTIVE' });
}
