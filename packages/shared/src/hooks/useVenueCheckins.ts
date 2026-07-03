// Subscribes to ONE event's check_ins + rsvps subcollections and returns the aggregated
// display summary + the caller's own vote/RSVP. Drawer-only: pass the open event's FanZone
// doc id (eventId); pass null to subscribe to nothing. See docs/CHECKIN_LLD_DECISIONS.md.

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { useMapStore } from '../store/mapStore';
import { aggregateCheckins } from '../lib/checkinAggregation';
import type { CheckIn, CheckinAggregate, Rsvp } from '../types/map';

const VENUES = 'venues';
const CHECK_INS = 'check_ins';
const RSVPS = 'rsvps';

// While the drawer is open, re-tick so recency decay + the rolling window stay honest between
// Firestore snapshots (votes age / fall out of the window without a data change).
const RECOMPUTE_INTERVAL_MS = 60 * 1000;

export type VenueCheckins = {
  aggregate: CheckinAggregate;
  rsvpCount: number;
  myCheckin: CheckIn | null; // caller's current vote, if signed in and voted
  hasRsvped: boolean;
};

export function useVenueCheckins(eventId: string | null, startTime?: number | null): VenueCheckins {
  const uid = useMapStore((s) => s.currentUser?.uid ?? null);

  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!eventId) {
      setCheckins([]);
      return;
    }
    const unsub = onSnapshot(
      collection(getDb(), VENUES, eventId, CHECK_INS),
      (snap) => setCheckins(snap.docs.map((d) => d.data() as CheckIn)),
      (err) => console.warn('[useVenueCheckins] check_ins:', err.code, eventId),
    );
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setRsvps([]);
      return;
    }
    const unsub = onSnapshot(
      collection(getDb(), VENUES, eventId, RSVPS),
      (snap) => setRsvps(snap.docs.map((d) => d.data() as Rsvp)),
      (err) => console.warn('[useVenueCheckins] rsvps:', err.code, eventId),
    );
    return unsub;
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const id = setInterval(() => setTick((t) => t + 1), RECOMPUTE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [eventId]);

  const aggregate = useMemo(
    () => aggregateCheckins(checkins, { startTime: startTime ?? null }),
    // `tick` forces a periodic recompute so decay/window advance with wall-clock time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkins, startTime, tick],
  );

  const myCheckin = useMemo(
    () => (uid ? checkins.find((c) => c.user_id === uid) ?? null : null),
    [checkins, uid],
  );

  return {
    aggregate,
    rsvpCount: rsvps.length,
    myCheckin,
    hasRsvped: uid ? rsvps.some((r) => r.user_id === uid) : false,
  };
}
