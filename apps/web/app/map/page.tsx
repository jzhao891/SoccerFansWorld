'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Marker } from 'react-map-gl/mapbox';
import MapMarkers from '@/components/MapMarkers';
import VenueDrawer from '@/components/VenueDrawer';
import MapTopBar from '@/components/MapTopBar';
import MapStatusOverlay from '@/components/MapStatusOverlay';
import CreateWatchPartySheet from '@/components/CreateWatchPartySheet';
import MapContextMenu from '@/components/MapContextMenu';
import { useMapStore } from '@/store/mapStore';
import { useVenueSubscription } from '@/hooks/useVenueSubscription';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import type { BoundingBox } from '@sfw/shared';
import type { MapClickPayload } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function MapPage() {
  const setBounds = useMapStore((s) => s.setBounds);

  // Pin and menu are always paired — null means both hidden
  const [mapPin, setMapPin] = useState<{
    location: { lat: number; lng: number };
    menuPos: { x: number; y: number };
  } | null>(null);

  // Location passed into the creation sheet (captured before mapPin is cleared)
  const [sheetDefaultLocation, setSheetDefaultLocation] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);

  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  useVenueSubscription();
  usePlacesSearch();

  const handleBoundsChange = (bounds: BoundingBox) => setBounds(bounds);

  const handleMapClick = useCallback(({ lngLat, point }: MapClickPayload) => {
    // Pin+menu visible → dismiss both
    // Pin+menu hidden → drop pin and open menu
    setMapPin((prev) =>
      prev ? null : { location: lngLat, menuPos: { x: point.x, y: point.y } },
    );
  }, []);

  function handleCreateParty(location?: { lat: number; lng: number }) {
    // Capture location before clearing the pin
    setSheetDefaultLocation(location ?? mapPin?.location);
    setMapPin(null);
    setCreateSheetOpen(true);
  }

  return (
    <main className="w-screen h-screen relative">
      <MapTopBar />
      <MapView onBoundsChange={handleBoundsChange} onMapClick={handleMapClick}>
        <MapMarkers />

        {mapPin && (
          <Marker longitude={mapPin.location.lng} latitude={mapPin.location.lat} anchor="bottom">
            <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z" fill="#111827"/>
              <circle cx="14" cy="14" r="5" fill="white"/>
            </svg>
          </Marker>
        )}
      </MapView>

      <MapStatusOverlay />

      {mapPin && (
        <MapContextMenu
          x={mapPin.menuPos.x}
          y={mapPin.menuPos.y}
          onCreateParty={() => handleCreateParty()}
          onClose={() => setMapPin(null)}
        />
      )}

      <CreateWatchPartySheet
        isOpen={createSheetOpen}
        defaultLocation={sheetDefaultLocation}
        onClose={() => setCreateSheetOpen(false)}
      />
      <VenueDrawer onCreateParty={(loc) => handleCreateParty(loc)} />
    </main>
  );
}
