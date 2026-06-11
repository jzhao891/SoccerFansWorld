import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import { useMapStore } from '@/store/mapStore';
import type { PlaceResult, FanZone } from '@sfw/shared';

const initialState = useMapStore.getState();

beforeEach(() => {
  useMapStore.setState(initialState);
});

const place: PlaceResult = {
  place_id: 'gp_001',
  name: 'The Pub',
  location: { lat: 47.6, lng: -122.3 },
  types: ['bar'],
  rating: 4.5,
};

const fanZoneBase: Omit<FanZone, 'id' | 'google_place_id'> = {
  name: 'The Fan Zone',
  location: { lat: 47.6, lng: -122.3 },
  geohash: 'c23nb',
  event_title: 'World Cup 2026',
  kickoff_time: 0,
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
    expect(result.current[0].place_id).toBe('gp_001');
  });

  it('returns merged source when fan zone google_place_id matches a place', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_001', google_place_id: 'gp_001' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].source).toBe('merged');
    expect(result.current[0].fanZone?.id).toBe('fz_001');
  });

  it('returns custom source when fan zone has google_place_id: null', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_custom', google_place_id: null, name: 'Custom Bar' };
    useMapStore.setState({ places: [], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].source).toBe('custom');
    expect(result.current[0].place_id).toBe('fz_custom');
  });

  it('skips fan zone when google_place_id is set but not in Places results', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_skip', google_place_id: 'gp_not_returned' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    // Only the google place should appear; skipped fan zone is not shown
    expect(result.current).toHaveLength(1);
    expect(result.current[0].place_id).toBe('gp_001');
    expect(result.current.find((p) => p.place_id === 'fz_skip')).toBeUndefined();
  });

  it('handles empty store state', () => {
    useMapStore.setState({ places: [], fanZones: [] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(0);
  });

  it('custom pin is still shown alongside google pins', () => {
    const fanZone: FanZone = { ...fanZoneBase, id: 'fz_custom', google_place_id: null, name: 'Custom Bar' };
    useMapStore.setState({ places: [place], fanZones: [fanZone] });
    const { result } = renderHook(() => useMergedPlaces());
    expect(result.current).toHaveLength(2);
    const sources = result.current.map((p) => p.source).sort();
    expect(sources).toEqual(['custom', 'google']);
  });
});
