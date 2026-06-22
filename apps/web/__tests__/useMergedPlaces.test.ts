import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import { useMapStore } from '@/store/mapStore';
import type { GoogleVenue, FanZone } from '@sfw/shared';

const initialState = useMapStore.getState();

beforeEach(() => {
  useMapStore.setState(initialState);
});

const place: GoogleVenue = {
  source: 'google',
  id: 'gp_001',
  name: 'The Pub',
  location: { lat: 47.6, lng: -122.3 },
  types: ['bar'],
  rating: 4.5,
};

const fanZoneBase: Omit<FanZone, 'id' | 'source' | 'venue_id'> = {
  name: 'The Fan Zone',
  address: '1 Test St, Seattle, WA',
  location: { lat: 47.6, lng: -122.3 },
  geohash: 'c23nb',
  event_title: 'World Cup 2026',
  start_time: 0,
  watching_teams: ['England'],
  amenities: [],
  is_active: true,
  created_by: 'user_1',
  created_at: 0,
};

describe('useMergedPlaces', () => {
  it('returns google source when no matching fan zone', () => {
    useMapStore.setState({ places: [place], fanZones: [] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].source).toBe('google');
    expect(result.current[0].id).toBe('gp_001');
  });

  it('returns fanzone source and suppresses google dot when fan zone covers a place', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_001', source: 'google', venue_id: 'gp_001' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    // Google dot suppressed; only the FanZone dot shown
    expect(result.current).toHaveLength(1);
    expect(result.current[0].source).toBe('fanzone');
    expect(result.current[0].id).toBe('venue:gp_001');
    expect(result.current[0].fanZones?.[0].id).toBe('fz_001');
  });

  it('returns fanzone source for a custom fan zone with no linked venue', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_custom', source: 'custom', venue_id: null, name: 'Custom Bar' };
    useMapStore.setState({ places: [], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].source).toBe('fanzone');
    expect(result.current[0].id).toBe('fz_custom');
  });

  it('shows fanzone even when its venue_id is not in current places results', () => {
    // FanZone points to a google place that wasn't returned by the nearby search
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_skip', source: 'google', venue_id: 'gp_not_returned' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    // FanZone always shown; gp_001 is not covered (only gp_not_returned is), so both appear
    expect(result.current).toHaveLength(2);
    expect(result.current.find((p) => p.id === 'venue:gp_not_returned')).toBeDefined();
    expect(result.current.find((p) => p.id === 'gp_001')).toBeDefined();
  });

  it('handles empty store state', () => {
    useMapStore.setState({ places: [], fanZones: [] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(0);
  });

  it('custom fanzone is shown alongside an uncovered google place', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_custom', source: 'custom', venue_id: null, name: 'Custom Bar' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(2);
    const sources = result.current.map((p) => p.source).sort();
    expect(sources).toEqual(['fanzone', 'google']);
  });

  it('groups events sharing a venue_id into one place, sorted by date then name', () => {
    const events: FanZone[] = [
      { ...fanZoneBase, id: 'e_late', source: 'google', venue_id: 'gp_001', event_title: 'B match', start_time: 3000 },
      { ...fanZoneBase, id: 'e_early', source: 'google', venue_id: 'gp_001', event_title: 'A match', start_time: 1000 },
      { ...fanZoneBase, id: 'e_tie_b', source: 'google', venue_id: 'gp_001', event_title: 'Zebra', start_time: 2000 },
      { ...fanZoneBase, id: 'e_tie_a', source: 'google', venue_id: 'gp_001', event_title: 'Apple', start_time: 2000 },
    ];
    useMapStore.setState({ places: [place], fanZones: events });
    const { result } = renderHook(() => useMergedPlaces());
    // All four collapse into one pin
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('venue:gp_001');
    // Sorted by start_time asc, then event_title asc for the tie at 2000
    expect(result.current[0].fanZones?.map((fz) => fz.id)).toEqual([
      'e_early', 'e_tie_a', 'e_tie_b', 'e_late',
    ]);
  });

  it('excludes inactive events', () => {
    const events: FanZone[] = [
      { ...fanZoneBase, id: 'e_active', source: 'custom', venue_id: null, is_active: true },
      { ...fanZoneBase, id: 'e_inactive', source: 'custom', venue_id: null, is_active: false },
    ];
    useMapStore.setState({ places: [], fanZones: events });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('e_active');
  });
});
