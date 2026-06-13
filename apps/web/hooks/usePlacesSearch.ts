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
  const clearPlaces = useMapStore((s) => s.clearPlaces);
  const mergePlaces = useMapStore((s) => s.mergePlaces);
  const evictFarPlaces = useMapStore((s) => s.evictFarPlaces);
  const setIsFetchingPlaces = useMapStore((s) => s.setIsFetchingPlaces);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (!isWithinAllowedRegion(bounds)) {
      clearPlaces();
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const center = boundsCenter(bounds);
      const body: PlacesRequest = { lat: center.lat, lng: center.lng };

      setIsFetchingPlaces(true);
      try {
        const res = await fetch('/api/places', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) return;
        const data: PlacesResponse = await res.json();
        // Step 1: merge new places — user sees them immediately on next paint
        mergePlaces(data.places);
        // Step 2: evict places far from current center after the browser has painted
        requestAnimationFrame(() => evictFarPlaces(center));
      } finally {
        setIsFetchingPlaces(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [bounds, clearPlaces, mergePlaces, evictFarPlaces, setIsFetchingPlaces]);
}
