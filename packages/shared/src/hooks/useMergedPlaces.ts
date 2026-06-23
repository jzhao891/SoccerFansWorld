import { useMemo } from 'react';
import { useMapStore } from '../store/mapStore';
import type { FanZone, MergedPlace } from '../types/map';

// Sort by start_time ascending, then event_title ascending.
// Events without a start_time (TBD) sort after timed events.
function byDateThenName(a: FanZone, b: FanZone): number {
  const at = a.start_time ?? Number.POSITIVE_INFINITY;
  const bt = b.start_time ?? Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return a.event_title.localeCompare(b.event_title);
}

export function useMergedPlaces(): MergedPlace[] {
  const places = useMapStore((s) => s.places);
  const fanZones = useMapStore((s) => s.fanZones);

  return useMemo(() => {
    const result: MergedPlace[] = [];

    // Only active events surface on the map / in the drawer.
    const active = fanZones.filter((fz) => fz.is_active);

    // Group events by physical venue: by venue_id when present, otherwise
    // each custom party (null venue_id) stands alone keyed by its own id.
    const groups = new Map<string, FanZone[]>();
    for (const fz of active) {
      const key = fz.venue_id ? `vid:${fz.venue_id}` : `fz:${fz.id}`;
      const arr = groups.get(key);
      if (arr) arr.push(fz);
      else groups.set(key, [fz]);
    }

    // Google venue ids covered by an active FanZone — suppress their blue dot
    const coveredGoogleIds = new Set<string>();

    for (const group of groups.values()) {
      group.sort(byDateThenName);
      const rep = group[0]; // representative event (earliest) drives pin identity
      if (rep.source === 'google' && rep.venue_id) {
        coveredGoogleIds.add(rep.venue_id);
      }
      result.push({
        // One pin per venue: stable id derived from venue_id, else the lone event's id.
        id: rep.venue_id ? `venue:${rep.venue_id}` : rep.id,
        name: rep.name,
        location: rep.location,
        source: 'fanzone',
        fanZones: group,
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
