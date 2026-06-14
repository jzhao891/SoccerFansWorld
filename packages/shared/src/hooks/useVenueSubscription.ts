import { useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { getDb } from '../lib/firebase';
import { useMapStore } from '../store/mapStore';
import type { FanZone, LiveStatus } from '../types/map';

const VENUES_COLLECTION = 'venues';
const LIVE_STATUSES_COLLECTION = 'live_statuses';

function boundsToCenter(bounds: { north: number; south: number; east: number; west: number }) {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

function boundsToRadiusKm(bounds: { north: number; south: number; east: number; west: number }) {
  const center = boundsToCenter(bounds);
  return distanceBetween([center.lat, center.lng], [bounds.north, bounds.east]);
}

export function useVenueSubscription() {
  const bounds = useMapStore((s) => s.bounds);
  const setFanZones = useMapStore((s) => s.setFanZones);
  const setLiveStatus = useMapStore((s) => s.setLiveStatus);
  const removeLiveStatus = useMapStore((s) => s.removeLiveStatus);

  useEffect(() => {
    if (!bounds) return;

    const db = getDb();
    const center = boundsToCenter(bounds);
    const radiusKm = boundsToRadiusKm(bounds);
    const geohashBounds = geohashQueryBounds([center.lat, center.lng], radiusKm * 1000);

    const venueQueryCleanupFns: (() => void)[] = [];
    const venueMap = new Map<string, FanZone>();
    const liveStatusCleanupByVenueId = new Map<string, () => void>();

    function subscribeToLiveStatus(venueId: string) {
      if (liveStatusCleanupByVenueId.has(venueId)) return;
      const unsub = onSnapshot(doc(db, LIVE_STATUSES_COLLECTION, venueId), (statusDoc) => {
        if (statusDoc.exists()) {
          setLiveStatus({ venue_id: venueId, ...statusDoc.data() } as LiveStatus);
        } else {
          removeLiveStatus(venueId);
        }
      });
      liveStatusCleanupByVenueId.set(venueId, unsub);
    }

    function unsubscribeFromLiveStatus(venueId: string) {
      liveStatusCleanupByVenueId.get(venueId)?.();
      liveStatusCleanupByVenueId.delete(venueId);
      removeLiveStatus(venueId);
    }

    for (const [start, end] of geohashBounds) {
      const q = query(
        collection(db, VENUES_COLLECTION),
        where('is_active', '==', true),
        orderBy('geohash'),
        where('geohash', '>=', start),
        where('geohash', '<=', end),
      );

      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          // Backward compat: old docs have google_place_id instead of source/venue_id
          if (data.google_place_id !== undefined && data.source === undefined) {
            data.source = data.google_place_id ? 'google' : 'custom';
            data.venue_id = data.google_place_id ?? null;
          }
          const venue = { id: change.doc.id, ...data } as FanZone;
          if (change.type === 'removed') {
            venueMap.delete(venue.id);
            unsubscribeFromLiveStatus(venue.id);
          } else {
            venueMap.set(venue.id, venue);
            subscribeToLiveStatus(venue.id);
          }
        });
        setFanZones(Array.from(venueMap.values()));
      });

      venueQueryCleanupFns.push(unsub);
    }

    return () => {
      venueQueryCleanupFns.forEach((fn) => fn());
      liveStatusCleanupByVenueId.forEach((fn) => fn());
      liveStatusCleanupByVenueId.clear();
    };
  }, [bounds, setFanZones, setLiveStatus, removeLiveStatus]);
}
