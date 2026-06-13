'use client';

import { useRef, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import Map, { Source, Layer, type MapRef, type ViewStateChangeEvent, type MapEvent, type MapMouseEvent } from 'react-map-gl/mapbox';
import { useMapStore } from '@/store/mapStore';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { BoundingBox, OsmVenue } from '@sfw/shared';
import { ALLOWED_REGIONS } from '@sfw/shared';
import { buildFogGeoJSON } from '@/lib/fogLayer';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

const SEATTLE: { longitude: number; latitude: number; zoom: number } = {
  longitude: -122.3321,
  latitude: 47.6062,
  zoom: 13,
};

export interface MapClickPayload {
  lngLat: { lat: number; lng: number };
  point: { x: number; y: number };
  osmVenue?: OsmVenue;
}

interface MapViewProps {
  onBoundsChange?: (bounds: BoundingBox) => void;
  onMapClick?: (payload: MapClickPayload) => void;
  children?: ReactNode;
}

export default function MapView({ onBoundsChange, onMapClick, children }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const flyToTarget = useMapStore((s) => s.flyToTarget);
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget);

  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom ?? 13,
      duration: 1400,
    });
    setFlyToTarget(null);
  }, [flyToTarget, setFlyToTarget]);

  const fogGeoJSON = useMemo(() => buildFogGeoJSON(ALLOWED_REGIONS), []);

  const fireBoundsChange = useCallback(
    (map: mapboxgl.Map) => {
      if (!onBoundsChange) return;
      const bounds = map.getBounds();
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

  const handleLoad = useCallback(
    (e: MapEvent) => fireBoundsChange(e.target),
    [fireBoundsChange],
  );

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => fireBoundsChange(e.target),
    [fireBoundsChange],
  );

  const poiCursorActive = useRef(false);
  const handleMouseMove = useCallback((e: MapMouseEvent) => {
    const features = e.target.queryRenderedFeatures(e.point, { layers: ['poi-label'] });
    const canvas = e.target.getCanvas();
    if (features.length > 0) {
      canvas.style.cursor = 'pointer';
      poiCursorActive.current = true;
    } else if (poiCursorActive.current) {
      canvas.style.cursor = '';
      poiCursorActive.current = false;
    }
  }, []);

  const handleClick = useCallback(
    (e: MapMouseEvent) => {
      if (!onMapClick) return;

      // Check if user clicked a Mapbox-rendered POI label (OSM data, zero network cost)
      const features = e.target.queryRenderedFeatures(e.point, { layers: ['poi-label'] });
      if (features.length > 0) {
        const f = features[0];
        const props = f.properties ?? {};
        const osmVenue: OsmVenue = {
          source: 'osm',
          id: f.id != null ? `osm-${f.id}` : `osm-${props.name ?? 'unknown'}-${e.lngLat.lat.toFixed(5)}-${e.lngLat.lng.toFixed(5)}`,
          name: props.name ?? 'Unknown venue',
          location: { lat: e.lngLat.lat, lng: e.lngLat.lng },
          category: props.class ?? props.type ?? 'place',
        };
        onMapClick({ lngLat: { lat: e.lngLat.lat, lng: e.lngLat.lng }, point: { x: e.point.x, y: e.point.y }, osmVenue });
        return;
      }

      onMapClick({ lngLat: { lat: e.lngLat.lat, lng: e.lngLat.lng }, point: { x: e.point.x, y: e.point.y } });
    },
    [onMapClick],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={SEATTLE}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
      mapboxAccessToken={MAPBOX_TOKEN}
      onLoad={handleLoad}
      onMoveEnd={handleMoveEnd}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
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
      {children}
    </Map>
  );
}
