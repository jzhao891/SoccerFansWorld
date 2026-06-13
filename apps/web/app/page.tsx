'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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

      {/* Studio FAB */}
      <Link
        href="/studio/card"
        className="absolute bottom-6 left-6 z-10 flex items-center gap-2 px-4 py-3 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white text-sm font-medium shadow-lg hover:bg-black/65 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
        GenAI Studio
      </Link>
    </main>
  );
}
