'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function MapPage() {
  return (
    <main className="w-screen h-screen">
      <MapView />
    </main>
  );
}
