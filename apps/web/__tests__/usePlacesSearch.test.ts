import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import { useMapStore } from '@/store/mapStore';
import type { PlacesResponse } from '@sfw/shared';

const initialState = useMapStore.getState();

const seattleBounds = { north: 47.65, south: 47.55, east: -122.25, west: -122.40 };
const outsideBounds = { north: 51.6, south: 51.4, east: 0.2, west: -0.3 }; // London — not a host city

const mockPlacesResponse: PlacesResponse = {
  places: [
    { place_id: 'gp_001', name: 'The Pub', location: { lat: 47.6, lng: -122.3 }, types: ['bar'] },
  ],
};

beforeEach(() => {
  useMapStore.setState(initialState);
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPlacesResponse,
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePlacesSearch', () => {
  it('does not fetch when bounds are outside allowed regions', async () => {
    useMapStore.setState({ bounds: outsideBounds });
    renderHook(() => usePlacesSearch());
    await vi.runAllTimersAsync();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears places when bounds move outside allowed regions', async () => {
    useMapStore.setState({ bounds: outsideBounds, places: [
      { place_id: 'gp_001', name: 'Old', location: { lat: 47.6, lng: -122.3 }, types: [] },
    ]});
    renderHook(() => usePlacesSearch());
    await vi.runAllTimersAsync();
    expect(useMapStore.getState().places).toHaveLength(0);
  });

  it('fetches places after debounce when bounds are in allowed region', async () => {
    useMapStore.setState({ bounds: seattleBounds });
    renderHook(() => usePlacesSearch());
    // Before debounce fires
    expect(fetch).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('/api/places', expect.objectContaining({ method: 'POST' }));
  });

  it('sets isFetchingPlaces true during fetch and false after', async () => {
    let resolveFetch!: (v: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => { resolveFetch = resolve; }),
      ),
    );
    useMapStore.setState({ bounds: seattleBounds });
    renderHook(() => usePlacesSearch());
    await vi.runAllTimersAsync();
    expect(useMapStore.getState().isFetchingPlaces).toBe(true);
    resolveFetch({ ok: true, json: async () => mockPlacesResponse });
    await vi.runAllTimersAsync();
    expect(useMapStore.getState().isFetchingPlaces).toBe(false);
  });

  it('updates places store with fetched results', async () => {
    useMapStore.setState({ bounds: seattleBounds });
    renderHook(() => usePlacesSearch());
    await vi.runAllTimersAsync();
    expect(useMapStore.getState().places).toHaveLength(1);
    expect(useMapStore.getState().places[0].place_id).toBe('gp_001');
  });

  it('does not update places when fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    useMapStore.setState({ bounds: seattleBounds, places: [] });
    renderHook(() => usePlacesSearch());
    await vi.runAllTimersAsync();
    expect(useMapStore.getState().places).toHaveLength(0);
  });
});
