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
      // else: FanZone has a google_place_id but Google Places didn't return it in this search.
      // This means the venue exists in Google but was outside the 2km radius or deprioritized
      // in the 20-result cap. Showing it as 'custom' here would be misleading — it would cause
      // the same pin to flicker between 'merged' and 'custom' as the user zooms in and out.
      // We skip it and let it appear correctly as 'merged' once the user zooms in close enough
      // for Places to include it. See docs/MAP_DESIGN_DECISION_PTS.md for full rationale.
    }

    return Array.from(merged.values());
  }, [places, fanZones]);
}
