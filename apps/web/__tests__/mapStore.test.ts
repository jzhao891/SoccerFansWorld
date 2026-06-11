import { describe, it, expect, beforeEach } from 'vitest';
import { useMapStore } from '@/store/mapStore';
import type { LiveStatus } from '@sfw/shared';

const initialState = useMapStore.getState();

beforeEach(() => {
  useMapStore.setState(initialState);
});

describe('mapStore', () => {
  it('setSelectedTeam stores the team', () => {
    useMapStore.getState().setSelectedTeam('England');
    expect(useMapStore.getState().selectedTeam).toBe('England');
  });

  it('setSelectedTeam(null) clears the team', () => {
    useMapStore.getState().setSelectedTeam('England');
    useMapStore.getState().setSelectedTeam(null);
    expect(useMapStore.getState().selectedTeam).toBeNull();
  });

  it('setFlyToTarget stores the target', () => {
    useMapStore.getState().setFlyToTarget({ lng: -122.3, lat: 47.6, zoom: 13 });
    expect(useMapStore.getState().flyToTarget).toEqual({ lng: -122.3, lat: 47.6, zoom: 13 });
  });

  it('setFlyToTarget(null) clears the target', () => {
    useMapStore.getState().setFlyToTarget({ lng: -122.3, lat: 47.6 });
    useMapStore.getState().setFlyToTarget(null);
    expect(useMapStore.getState().flyToTarget).toBeNull();
  });

  it('setSelectedPlaceId stores the id', () => {
    useMapStore.getState().setSelectedPlaceId('place_123');
    expect(useMapStore.getState().selectedPlaceId).toBe('place_123');
  });

  it('setLiveStatus adds an entry keyed by venue_id', () => {
    const status: LiveStatus = {
      venue_id: 'v1',
      crowd_index: 'Buzzing',
      sound: 'On',
      fan_ratio: null,
      updated_at: 1000,
    };
    useMapStore.getState().setLiveStatus(status);
    expect(useMapStore.getState().liveStatuses['v1']).toEqual(status);
  });

  it('removeLiveStatus deletes the entry', () => {
    const status: LiveStatus = {
      venue_id: 'v1',
      crowd_index: 'Wild',
      sound: 'Off',
      fan_ratio: null,
      updated_at: 1000,
    };
    useMapStore.getState().setLiveStatus(status);
    useMapStore.getState().removeLiveStatus('v1');
    expect(useMapStore.getState().liveStatuses['v1']).toBeUndefined();
  });

  it('setBounds updates bounds', () => {
    const bounds = { north: 47.75, south: 47.45, east: -122.15, west: -122.55 };
    useMapStore.getState().setBounds(bounds);
    expect(useMapStore.getState().bounds).toEqual(bounds);
  });

  it('isFetchingPlaces toggles correctly', () => {
    expect(useMapStore.getState().isFetchingPlaces).toBe(false);
    useMapStore.getState().setIsFetchingPlaces(true);
    expect(useMapStore.getState().isFetchingPlaces).toBe(true);
    useMapStore.getState().setIsFetchingPlaces(false);
    expect(useMapStore.getState().isFetchingPlaces).toBe(false);
  });
});
