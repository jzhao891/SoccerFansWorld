'use client';

import { useRef, useCallback } from 'react';
import Map, { type MapRef, type ViewStateChangeEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { BoundingBox } from '@sfw/shared';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

const SEATTLE: { longitude: number; latitude: number; zoom: number } = {
  longitude: -122.3321,
  latitude: 47.6062,
  zoom: 13,
};

interface MapViewProps {
  onBoundsChange?: (bounds: BoundingBox) => void;
}

export default function MapView({ onBoundsChange }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      if (!onBoundsChange) return;
      const bounds = e.target.getBounds();
      if (!bounds) return;
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
    [onBoundsChange],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={SEATTLE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      mapboxAccessToken={MAPBOX_TOKEN}
      onMoveEnd={handleMoveEnd}
    />
  );
}
