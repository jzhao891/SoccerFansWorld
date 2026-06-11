'use client';

import dynamic from 'next/dynamic';
import MapMarkers from '@/components/MapMarkers';
import VenueDrawer from '@/components/VenueDrawer';
import MapTopBar from '@/components/MapTopBar';
import MapStatusOverlay from '@/components/MapStatusOverlay';
import { useMapStore } from '@/store/mapStore';
import { useVenueSubscription } from '@/hooks/useVenueSubscription';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import type { BoundingBox } from '@sfw/shared';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function MapPage() {
  const setBounds = useMapStore((s) => s.setBounds);

  useVenueSubscription();
  usePlacesSearch();

  const handleBoundsChange = (bounds: BoundingBox) => setBounds(bounds);

  return (
    <main className="w-screen h-screen relative">
      <MapTopBar />
      <MapView onBoundsChange={handleBoundsChange}>
        <MapMarkers />
      </MapView>
      <MapStatusOverlay />
      <VenueDrawer />
    </main>
  );
}
