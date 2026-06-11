'use client';

import { useEffect, useRef } from 'react';
import { useMapStore } from '@/store/mapStore';
import { ALLOWED_REGIONS } from '@sfw/shared';
import type { BoundingBox, PlacesRequest, PlacesResponse } from '@sfw/shared';

const DEBOUNCE_MS = 600;

function boundsCenter(bounds: BoundingBox) {
  return {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };
}

function isWithinAllowedRegion(bounds: BoundingBox): boolean {
  return ALLOWED_REGIONS.some(
    ({ bounds: r }) =>
      bounds.west < r.east &&
      bounds.east > r.west &&
      bounds.south < r.north &&
      bounds.north > r.south,
  );
}

export function usePlacesSearch() {
  const bounds = useMapStore((s) => s.bounds);
  const setPlaces = useMapStore((s) => s.setPlaces);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (!isWithinAllowedRegion(bounds)) {
      setPlaces([]);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const center = boundsCenter(bounds);
      const body: PlacesRequest = { lat: center.lat, lng: center.lng };

      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) return;

      const data: PlacesResponse = await res.json();
      setPlaces(data.places);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [bounds, setPlaces]);
}
