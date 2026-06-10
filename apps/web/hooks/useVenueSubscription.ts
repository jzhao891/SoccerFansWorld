'use client';

import { useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { db } from '@/lib/firebase';
import { useMapStore } from '@/store/mapStore';
import type { FanZone, LiveStatus } from '@sfw/shared';

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
  return distanceBetween(
    [center.lat, center.lng],
    [bounds.north, bounds.east],
  );
}

export function useVenueSubscription() {
  const bounds = useMapStore((s) => s.bounds);
  const setFanZones = useMapStore((s) => s.setFanZones);
  const setLiveStatus = useMapStore((s) => s.setLiveStatus);
  const removeLiveStatus = useMapStore((s) => s.removeLiveStatus);

  useEffect(() => {
    if (!bounds) return;

    const center = boundsToCenter(bounds);
    const radiusKm = boundsToRadiusKm(bounds);
    const geohashBounds = geohashQueryBounds([center.lat, center.lng], radiusKm * 1000);

    const venueQueryDbConnCleanupFns: (() => void)[] = [];
    const venueMap = new Map<string, FanZone>();
    const liveStatusDbConnCleanupFnByVenueId = new Map<string, () => void>();

    function subscribeToLiveStatusForVenue(venueId: string) {
      if (liveStatusDbConnCleanupFnByVenueId.has(venueId)) return;

      const liveStatusDbConnCleanupFn = onSnapshot(
        doc(db, LIVE_STATUSES_COLLECTION, venueId),
        (statusDoc) => {
          if (statusDoc.exists()) {
            setLiveStatus({ venue_id: venueId, ...statusDoc.data() } as LiveStatus);
          } else {
            removeLiveStatus(venueId);
          }
        },
      );
      liveStatusDbConnCleanupFnByVenueId.set(venueId, liveStatusDbConnCleanupFn);
    }

    function unsubscribeFromLiveStatusForVenue(venueId: string) {
      liveStatusDbConnCleanupFnByVenueId.get(venueId)?.();
      liveStatusDbConnCleanupFnByVenueId.delete(venueId);
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

      const venueQueryDbConnCleanupFn = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const venue = { id: change.doc.id, ...change.doc.data() } as FanZone;
          if (change.type === 'removed') {
            venueMap.delete(venue.id);
            unsubscribeFromLiveStatusForVenue(venue.id);
          } else {
            venueMap.set(venue.id, venue);
            subscribeToLiveStatusForVenue(venue.id);
          }
        });

        setFanZones(Array.from(venueMap.values()));
      });

      venueQueryDbConnCleanupFns.push(venueQueryDbConnCleanupFn);
    }

    return () => {
      venueQueryDbConnCleanupFns.forEach((cleanupFn) => cleanupFn());
      liveStatusDbConnCleanupFnByVenueId.forEach((cleanupFn) => cleanupFn());
      liveStatusDbConnCleanupFnByVenueId.clear();
    };
  }, [bounds, setFanZones, setLiveStatus, removeLiveStatus]);
}
