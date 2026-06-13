import { useRef, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, PixelRatio } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { useMapStore, buildFogGeoJSON, ALLOWED_REGIONS } from '@sfw/shared';
import type { BoundingBox } from '@sfw/shared';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
const SEATTLE_CENTER: [number, number] = [-122.3321, 47.6062];
const SEATTLE_ZOOM = 13;

interface MapViewProps {
  onBoundsChange?: (bounds: BoundingBox) => void;
  onMapPress?: (lngLat: { lat: number; lng: number }, screen: { x: number; y: number }) => void;
  children?: React.ReactNode;
}

export default function MapView({ onBoundsChange, onMapPress, children }: MapViewProps) {
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  const hasInitialized = useRef(false);
  const lastBoundsRef = useRef<BoundingBox | null>(null);
  const flyToTarget = useMapStore((s) => s.flyToTarget);
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget);

  const handleMapLoad = useCallback(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: SEATTLE_CENTER,
      zoomLevel: SEATTLE_ZOOM,
      animationDuration: 0,
      animationMode: 'none',
    });
  }, []);

  useEffect(() => {
    if (!flyToTarget || !cameraRef.current) return;
    cameraRef.current.flyTo([flyToTarget.lng, flyToTarget.lat], 1400);
    setFlyToTarget(null);
  }, [flyToTarget, setFlyToTarget]);

  const fogGeoJSON = useMemo(() => buildFogGeoJSON(ALLOWED_REGIONS), []);

  const handleRegionDidChange = useCallback(async () => {
    if (!onBoundsChange || !mapRef.current) return;
    const raw = await mapRef.current.getVisibleBounds();
    const next: BoundingBox = {
      north: raw[0][1],
      south: raw[1][1],
      east: raw[0][0],
      west: raw[1][0],
    };
    // Skip if the viewport hasn't meaningfully moved (~10m threshold)
    const prev = lastBoundsRef.current;
    const EPS = 0.0001;
    if (
      prev &&
      Math.abs(next.north - prev.north) < EPS &&
      Math.abs(next.south - prev.south) < EPS &&
      Math.abs(next.east - prev.east) < EPS &&
      Math.abs(next.west - prev.west) < EPS
    ) return;
    lastBoundsRef.current = next;
    onBoundsChange(next);
  }, [onBoundsChange]);

  const handlePress = useCallback(
    async (feature: GeoJSON.Feature<GeoJSON.Geometry>) => {
      if (!onMapPress) return;
      if (feature.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates;
      let screen = { x: 0, y: 0 };
      try {
        if (mapRef.current) {
          const pt = await mapRef.current.getPointInView([lng, lat]);
          const ratio = PixelRatio.get();
          screen = { x: pt[0] / ratio, y: pt[1] / ratio };
        }
      } catch {}
      onMapPress({ lat, lng }, screen);
    },
    [onMapPress],
  );

  return (
    <Mapbox.MapView
      ref={mapRef}
      style={styles.map}
      styleURL={MAP_STYLE}
      onRegionDidChange={handleRegionDidChange}
      onPress={handlePress}
      onDidFinishLoadingMap={handleMapLoad}
    >
      <Mapbox.Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: SEATTLE_CENTER,
          zoomLevel: SEATTLE_ZOOM,
        }}
      />
      <Mapbox.ShapeSource id="fog" shape={fogGeoJSON}>
        <Mapbox.FillLayer
          id="fog-fill"
          style={{ fillColor: '#000000', fillOpacity: 0.7 }}
        />
      </Mapbox.ShapeSource>
      {children}
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
