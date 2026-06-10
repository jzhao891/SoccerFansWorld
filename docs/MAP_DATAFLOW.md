# Map Feature Data Flow

## Overview

When the user pans or zooms the map, three hooks fire in parallel off the updated `bounds` in Zustand, then converge into a single merged list of places rendered as map markers.

## Flow Diagram

```
User pans/zooms map
        │
        ▼
  bounds updates in Zustand
        │
        ├──────────────────────────────┐
        ▼                              ▼
usePlacesSearch              useVenueSubscription
  (hooks/usePlacesSearch.ts)   (hooks/useVenueSubscription.ts)
        │                              │
  Debounces 600ms              Converts bounds to geohash range
  Checks allowed region        Opens real-time Firestore listeners
  Calls POST /api/places       (venues + live_statuses collections)
        │                              │
  setPlaces([...])             setFanZones([...])
                               setLiveStatus({...})
        └──────────────┬───────────────┘
                       ▼
              Zustand store holds:
              places[], fanZones[], liveStatuses{}
                       │
                       ▼
             useMergedPlaces
          (hooks/useMergedPlaces.ts)
                       │
          Deduplicates by google_place_id:
          - google_place_id match → source: 'merged'
          - Firestore only        → source: 'custom'
          - Google Places only    → source: 'google'
                       │
                       ▼
              MergedPlace[]
                       │
                       ▼
        Map markers (components/MapMarkers.tsx)
        Venue detail drawer (components/VenueDrawer.tsx)
```

## State Layer (Zustand)

Zustand is a global state store — any hook or component can read from or write to it. Components that read from it re-render automatically when the value changes.

File: `apps/web/store/mapStore.ts`

| Field | Written by | Read by |
|---|---|---|
| `bounds` | `MapView` (on map move) | `usePlacesSearch`, `useVenueSubscription` |
| `places` | `usePlacesSearch` | `useMergedPlaces` |
| `fanZones` | `useVenueSubscription` | `useMergedPlaces` |
| `liveStatuses` | `useVenueSubscription` | `VenueDrawer` |
| `isProgrammaticMove` | Map page | `usePlacesSearch`, `useVenueSubscription` |

## Allowed Regions

Places and venue queries are gated to allowed regions defined in `packages/shared/src/constants.ts`. Outside these regions, the map renders with a fog overlay and no API calls are made.

Current regions: Seattle, SF Bay Area, Los Angeles, Vancouver.
