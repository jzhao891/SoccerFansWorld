'use client';

import { Marker } from 'react-map-gl/mapbox';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import { useMapStore } from '@/store/mapStore';
import type { MergedPlace } from '@sfw/shared';

const SOURCE_COLORS: Record<MergedPlace['source'], string> = {
  google:  '#3B82F6',  // blue — Google place with no FanZone
  fanzone: '#F97316',  // orange — user-created FanZone (any origin)
};

export default function MapMarkers() {
  const mergedPlaces = useMergedPlaces();
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedTeam = useMapStore((s) => s.selectedTeam);

  const visiblePlaces = selectedTeam
    ? mergedPlaces.filter(
        (p) => p.fanZone?.watching_teams.includes(selectedTeam) ?? false,
      )
    : mergedPlaces;

  return (
    <>
      {visiblePlaces.map((place) => (
        <Marker
          key={place.id}
          longitude={place.location.lng}
          latitude={place.location.lat}
          anchor="bottom"
          onClick={(e) => { e.originalEvent.stopPropagation(); setSelectedPlaceId(place.id); }}
        >
          <div
            style={{ backgroundColor: SOURCE_COLORS[place.source] }}
            className="w-4 h-4 rounded-full border-2 border-white shadow-md cursor-pointer"
            title={place.name}
          />
        </Marker>
      ))}
    </>
  );
}
