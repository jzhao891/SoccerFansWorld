import { useEffect, useRef } from 'react';
import { useMapStore, ALLOWED_REGIONS } from '@sfw/shared';
import type { BoundingBox } from '@sfw/shared';
import { searchNearby } from '../api/places';

const DEBOUNCE_MS = 600;
// Only refetch if center has moved more than ~500m
const FETCH_THRESHOLD_DEG = 0.005;

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
  const setIsFetchingPlaces = useMapStore((s) => s.setIsFetchingPlaces);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedCenterRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!bounds) return;
    if (!isWithinAllowedRegion(bounds)) {
      setPlaces([]);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const center = boundsCenter(bounds);
      const last = lastFetchedCenterRef.current;
      if (
        last &&
        Math.abs(center.lat - last.lat) < FETCH_THRESHOLD_DEG &&
        Math.abs(center.lng - last.lng) < FETCH_THRESHOLD_DEG
      ) return;
      lastFetchedCenterRef.current = center;
      setIsFetchingPlaces(true);
      try {
        const places = await searchNearby(center.lat, center.lng);
        setPlaces(places);
      } finally {
        setIsFetchingPlaces(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [bounds, setPlaces, setIsFetchingPlaces]);
}
