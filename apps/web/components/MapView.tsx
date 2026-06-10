'use client';

import { useRef, useCallback, useMemo } from 'react';
import Map, { Source, Layer, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { BoundingBox } from '@sfw/shared';
import { ALLOWED_REGIONS } from '@sfw/shared';
import { buildFogGeoJSON } from '@/lib/fogLayer';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

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

  const fogGeoJSON = useMemo(() => buildFogGeoJSON(ALLOWED_REGIONS), []);

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
    >
      <Source id="fog" type="geojson" data={fogGeoJSON}>
        <Layer
          id="fog-fill"
          type="fill"
          paint={{
            'fill-color': '#000000',
            'fill-opacity': 0.7,
          }}
        />
      </Source>
    </Map>
  );
}
