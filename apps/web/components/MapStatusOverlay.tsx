'use client';

import { useMapStore } from '@/store/mapStore';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import { ALLOWED_REGIONS } from '@sfw/shared';

export default function MapStatusOverlay() {
  const isFetchingPlaces = useMapStore((s) => s.isFetchingPlaces);
  const bounds = useMapStore((s) => s.bounds);
  const mergedPlaces = useMergedPlaces();
  const selectedTeam = useMapStore((s) => s.selectedTeam);

  const inAllowedRegion =
    bounds != null &&
    ALLOWED_REGIONS.some(
      ({ bounds: r }) =>
        bounds.west < r.east &&
        bounds.east > r.west &&
        bounds.south < r.north &&
        bounds.north > r.south,
    );

  const visiblePlaces = selectedTeam
    ? mergedPlaces.filter(
        (p) => p.fanZone?.watching_teams.includes(selectedTeam) ?? false,
      )
    : mergedPlaces;

  if (isFetchingPlaces) {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-lg border border-gray-100 text-sm text-gray-600">
          <svg
            className="animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Finding venues…
        </div>
      </div>
    );
  }

  if (!inAllowedRegion) {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-white rounded-2xl px-5 py-3 shadow-lg border border-gray-100 text-sm text-gray-500 text-center">
          Pan to a supported city to see fan venues
        </div>
      </div>
    );
  }

  if (visiblePlaces.length === 0) {
    return (
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-white rounded-2xl px-5 py-3 shadow-lg border border-gray-100 text-sm text-gray-500 text-center">
          {selectedTeam
            ? `No venues watching ${selectedTeam} in this area`
            : 'No fan venues found in this area'}
        </div>
      </div>
    );
  }

  return null;
}
