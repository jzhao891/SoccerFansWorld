import { create } from 'zustand';
import type { BoundingBox, FanZone, LiveStatus, PlaceResult } from '@sfw/shared';

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

interface MapState {
  viewState: ViewState;
  bounds: BoundingBox | null;
  places: PlaceResult[];
  fanZones: FanZone[];
  liveStatuses: Record<string, LiveStatus>;
  isProgrammaticMove: boolean;

  setViewState: (vs: ViewState) => void;
  setBounds: (bounds: BoundingBox) => void;
  setPlaces: (places: PlaceResult[]) => void;
  setFanZones: (fanZones: FanZone[]) => void;
  setLiveStatus: (status: LiveStatus) => void;
  removeLiveStatus: (venueId: string) => void;
  setIsProgrammaticMove: (value: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewState: { longitude: -122.3321, latitude: 47.6062, zoom: 13 },
  bounds: null,
  places: [],
  fanZones: [],
  liveStatuses: {},
  isProgrammaticMove: false,

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
}));
