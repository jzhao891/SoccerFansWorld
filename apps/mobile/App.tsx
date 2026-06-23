import './lib/firebase'; // initializes Firebase and calls setDb
import { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useMapStore } from '@sfw/shared';
import { useVenueSubscription } from '@sfw/shared';
import { usePlacesSearch } from './hooks/usePlacesSearch';
import MapView from './components/MapView';
import MapMarkers from './components/MapMarkers';
import MapTopBar from './components/MapTopBar';
import MapStatusOverlay from './components/MapStatusOverlay';
import MapContextPopup from './components/MapContextPopup';
import MapPressActionBar from './components/MapPressActionBar';
import VenueDrawer from './components/VenueDrawer';
import CreateWatchPartySheet from './components/CreateWatchPartySheet';
import type { BoundingBox, OsmVenue } from '@sfw/shared';

function MapScreen() {
  const setBounds = useMapStore((s) => s.setBounds);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const [mapPressPoint, setMapPressPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPressScreen, setMapPressScreen] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [createPartyLocation, setCreatePartyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [createPartySource, setCreatePartySource] = useState<'google' | 'osm' | 'custom'>('custom');
  const [createPartyVenueId, setCreatePartyVenueId] = useState<string | null>(null);
  const [createPartyAddress, setCreatePartyAddress] = useState<string | undefined>(undefined);
  const suppressNextMapPress = useRef(false);
  const lastMapPressTime = useRef(0);

  useVenueSubscription();
  usePlacesSearch();

  useEffect(() => {
    if (selectedPlaceId) setMapPressPoint(null);
  }, [selectedPlaceId]);

  function handleBoundsChange(bounds: BoundingBox) {
    setBounds(bounds);
  }

  function handleMapPress(lngLat: { lat: number; lng: number }, screen: { x: number; y: number }, osmVenue?: OsmVenue) {
    const now = Date.now();
    if (now - lastMapPressTime.current < 400) return;
    lastMapPressTime.current = now;
    if (suppressNextMapPress.current) {
      suppressNextMapPress.current = false;
      return;
    }
    // Tapped an OSM POI label — select it (opens the drawer), even from another open drawer.
    if (osmVenue) {
      setSelectedPlaceId(null);
      setSelectedOsmVenue(osmVenue);
      setMapPressPoint(null);
      return;
    }
    // If anything is open — a venue/OSM drawer or the dropped pin + create popup —
    // a map tap just dismisses it (no marker). Only when nothing is open does a tap
    // drop the pin and show the create action. So: tap to close, tap again to create.
    if (selectedPlaceId !== null || selectedOsmVenue !== null || mapPressPoint !== null) {
      setSelectedPlaceId(null);
      setSelectedOsmVenue(null);
      setMapPressPoint(null);
      return;
    }
    setMapPressScreen(screen);
    setMapPressPoint(lngLat);
  }

  function openCreateParty(
    location: { lat: number; lng: number },
    source: 'google' | 'osm' | 'custom' = 'custom',
    venue_id: string | null = null,
    address?: string,
  ) {
    suppressNextMapPress.current = true;
    setCreatePartyLocation(location);
    setCreatePartySource(source);
    setCreatePartyVenueId(venue_id);
    setCreatePartyAddress(address);
    setMapPressPoint(null);
    setCreatePartyOpen(true);
  }

  return (
    <View style={styles.container}>
      <MapView onBoundsChange={handleBoundsChange} onMapPress={handleMapPress}>
        <MapMarkers />
        {mapPressPoint && (
          <MapContextPopup location={mapPressPoint} />
        )}
      </MapView>
      <MapTopBar />
      <MapStatusOverlay />
      {mapPressPoint && (
        <MapPressActionBar
          screen={mapPressScreen}
          onCreateParty={() => openCreateParty(mapPressPoint)}
        />
      )}
      <VenueDrawer onCreateParty={openCreateParty} />
      <CreateWatchPartySheet
        visible={createPartyOpen}
        defaultLocation={createPartyLocation ?? undefined}
        defaultSource={createPartySource}
        defaultVenueId={createPartyVenueId}
        defaultAddress={createPartyAddress}
        onClose={() => { setCreatePartyOpen(false); setCreatePartyLocation(null); }}
      />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MapScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
