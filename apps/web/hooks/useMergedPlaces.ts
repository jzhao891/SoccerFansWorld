'use client';

import { useMemo } from 'react';
import { useMapStore } from '@/store/mapStore';
import type { MergedPlace } from '@sfw/shared';

export function useMergedPlaces(): MergedPlace[] {
  const places = useMapStore((s) => s.places);
  const fanZones = useMapStore((s) => s.fanZones);

  return useMemo(() => {
    const merged = new Map<string, MergedPlace>();

    // Index Google Places results by place_id
    for (const place of places) {
      merged.set(place.place_id, {
        place_id: place.place_id,
        name: place.name,
        location: place.location,
        source: 'google',
        placeData: place,
      });
    }

    for (const fanZone of fanZones) {
      const googlePlaceId = fanZone.google_place_id;

      if (googlePlaceId === null) {
        // Truly custom venue — no Google Places entry exists
        merged.set(fanZone.id, {
          place_id: fanZone.id,
          name: fanZone.name,
          location: fanZone.location,
          source: 'custom',
          fanZone,
        });
      } else if (merged.has(googlePlaceId)) {
        // Google venue that Places returned — upgrade to merged
        const existing = merged.get(googlePlaceId)!;
        merged.set(googlePlaceId, {
          ...existing,
          source: 'merged',
          fanZone,
        });
      }
      // else: has google_place_id but Places didn't return it — skip until user zooms in closer
    }

    return Array.from(merged.values());
  }, [places, fanZones]);
}
