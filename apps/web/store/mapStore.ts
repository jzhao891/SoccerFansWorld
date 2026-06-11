import { create } from 'zustand';
import type { BoundingBox, FanZone, LiveStatus, PlaceResult } from '@sfw/shared';

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
  fanZones: FanZone[];
  liveStatuses: Record<string, LiveStatus>;
  isProgrammaticMove: boolean;
  selectedPlaceId: string | null;
  selectedTeam: string | null;
  flyToTarget: FlyToTarget | null;
  isFetchingPlaces: boolean;

  setViewState: (vs: ViewState) => void;
  setBounds: (bounds: BoundingBox) => void;
  setPlaces: (places: PlaceResult[]) => void;
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
  fanZones: [],
  liveStatuses: {},
  isProgrammaticMove: false,
  selectedPlaceId: null,
  selectedTeam: null,
  flyToTarget: null,
  isFetchingPlaces: false,

  setViewState: (vs) => set({ viewState: vs }),
  setBounds: (bounds) => set({ bounds }),
  setPlaces: (places) => set({ places }),
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
