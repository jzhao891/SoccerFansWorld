import { create } from 'zustand';
import type { BoundingBox, FanZone, LatLng, LiveStatus, PlaceResult } from '../types/map';

// ~15 km in degrees latitude — used for distance-based cache eviction
const EVICT_RADIUS_DEG = 0.135;

function isNear(place: PlaceResult, center: LatLng): boolean {
  return (
    Math.abs(place.location.lat - center.lat) <= EVICT_RADIUS_DEG &&
    Math.abs(place.location.lng - center.lng) <= EVICT_RADIUS_DEG
  );
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface FlyToTarget {
  lng: number;
  lat: number;
  zoom?: number;
}

interface MapState {
  viewState: ViewState;
  bounds: BoundingBox | null;
  places: PlaceResult[];
  placesCache: Record<string, PlaceResult>;
  fanZones: FanZone[];
  liveStatuses: Record<string, LiveStatus>;
  isProgrammaticMove: boolean;
  selectedPlaceId: string | null;
  selectedTeam: string | null;
  flyToTarget: FlyToTarget | null;
  isFetchingPlaces: boolean;

  setViewState: (vs: ViewState) => void;
  setBounds: (bounds: BoundingBox) => void;
  clearPlaces: () => void;
  mergePlaces: (newPlaces: PlaceResult[]) => void;
  evictFarPlaces: (center: LatLng) => void;
  setFanZones: (fanZones: FanZone[]) => void;
  setLiveStatus: (status: LiveStatus) => void;
  removeLiveStatus: (venueId: string) => void;
  setIsProgrammaticMove: (value: boolean) => void;
  setSelectedPlaceId: (id: string | null) => void;
  setSelectedTeam: (team: string | null) => void;
  setFlyToTarget: (target: FlyToTarget | null) => void;
  setIsFetchingPlaces: (value: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewState: { longitude: -122.3321, latitude: 47.6062, zoom: 13 },
  bounds: null,
  places: [],
  placesCache: {},
  fanZones: [],
  liveStatuses: {},
  isProgrammaticMove: false,
  selectedPlaceId: null,
  selectedTeam: null,
  flyToTarget: null,
  isFetchingPlaces: false,

  setViewState: (vs) => set({ viewState: vs }),
  setBounds: (bounds) => set({ bounds }),
  clearPlaces: () => set({ places: [], placesCache: {} }),
  mergePlaces: (newPlaces) =>
    set((state) => {
      const cache = { ...state.placesCache };
      for (const p of newPlaces) cache[p.place_id] = p;
      return { placesCache: cache, places: Object.values(cache) };
    }),
  evictFarPlaces: (center) =>
    set((state) => {
      const cache: Record<string, PlaceResult> = {};
      for (const [id, place] of Object.entries(state.placesCache)) {
        if (isNear(place, center)) cache[id] = place;
      }
      return { placesCache: cache, places: Object.values(cache) };
    }),
  setFanZones: (fanZones) => set({ fanZones }),
  setLiveStatus: (status) =>
    set((state) => ({
      liveStatuses: { ...state.liveStatuses, [status.venue_id]: status },
    })),
  removeLiveStatus: (venueId) =>
    set((state) => {
      const { [venueId]: _, ...rest } = state.liveStatuses;
      return { liveStatuses: rest };
    }),
  setIsProgrammaticMove: (value) => set({ isProgrammaticMove: value }),
  setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),
  setSelectedTeam: (team) => set({ selectedTeam: team }),
  setFlyToTarget: (target) => set({ flyToTarget: target }),
  setIsFetchingPlaces: (value) => set({ isFetchingPlaces: value }),
}));
