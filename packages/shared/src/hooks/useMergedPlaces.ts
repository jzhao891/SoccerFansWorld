import { useMemo } from 'react';
import { useMapStore } from '../store/mapStore';
import type { MergedPlace } from '../types/map';

export function useMergedPlaces(): MergedPlace[] {
  const places = useMapStore((s) => s.places);
  const fanZones = useMapStore((s) => s.fanZones);

  return useMemo(() => {
    const result: MergedPlace[] = [];

    // Google venue ids covered by a FanZone — suppress their blue dot
    const coveredGoogleIds = new Set(
      fanZones
        .filter((fz) => fz.source === 'google' && fz.venue_id)
        .map((fz) => fz.venue_id!)
    );

    // All FanZones always shown regardless of origin
    for (const fz of fanZones) {
      result.push({
        id: fz.id,
        name: fz.name,
        location: fz.location,
        source: 'fanzone',
        fanZone: fz,
      });
    }

    // Google places shown only if no FanZone covers them
    for (const venue of places) {
      if (venue.source === 'google' && !coveredGoogleIds.has(venue.id)) {
        result.push({
          id: venue.id,
          name: venue.name,
          location: venue.location,
          source: 'google',
          googleData: venue,
        });
      }
    }

    // All OSM venues always shown automatically by Mapbox.

    return result;
  }, [places, fanZones]);
}
