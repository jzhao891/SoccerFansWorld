import { useMemo } from 'react';
import { useMapStore } from '../store/mapStore';
import type { MergedPlace } from '../types/map';

export function useMergedPlaces(): MergedPlace[] {
  const places = useMapStore((s) => s.places);
  const fanZones = useMapStore((s) => s.fanZones);

  return useMemo(() => {
    const merged = new Map<string, MergedPlace>();

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
        merged.set(fanZone.id, {
          place_id: fanZone.id,
          name: fanZone.name,
          location: fanZone.location,
          source: 'custom',
          fanZone,
        });
      } else if (merged.has(googlePlaceId)) {
        const existing = merged.get(googlePlaceId)!;
        merged.set(googlePlaceId, {
          ...existing,
          source: 'merged',
          fanZone,
        });
      }
      // FanZone has a google_place_id but Places didn't return it in this search radius/cap —
      // skip here; it will appear as 'merged' once the user zooms in close enough.
    }

    return Array.from(merged.values());
  }, [places, fanZones]);
}
