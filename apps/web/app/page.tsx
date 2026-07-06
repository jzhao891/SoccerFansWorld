'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Marker } from 'react-map-gl/mapbox';
import MapMarkers from '@/components/MapMarkers';
import VenueDrawer from '@/components/VenueDrawer';
import MapTopBar from '@/components/MapTopBar';
import MapStatusOverlay from '@/components/MapStatusOverlay';
import CreateWatchPartySheet from '@/components/CreateWatchPartySheet';
import MapContextMenu from '@/components/MapContextMenu';
import ProfileAvatar from '@/components/ProfileAvatar';
import SignInSheet from '@/components/SignInSheet';
import ProfileSheet from '@/components/ProfileSheet';
import { useMapStore } from '@/store/mapStore';
import { useVenueSubscription } from '@/hooks/useVenueSubscription';
import { usePlacesSearch } from '@/hooks/usePlacesSearch';
import type { BoundingBox, FanZone } from '@sfw/shared';
import type { MapClickPayload } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });

export default function MapPage() {
  const setBounds = useMapStore((s) => s.setBounds);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);

  // Pin and menu are always paired — null means both hidden
  const [mapPin, setMapPin] = useState<{
    location: { lat: number; lng: number };
    menuPos: { x: number; y: number };
  } | null>(null);

  // Venue context passed into the creation sheet (captured before pin/drawer is cleared)
  const [sheetDefaultLocation, setSheetDefaultLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [sheetSource, setSheetSource] = useState<'google' | 'osm' | 'custom'>('custom');
  const [sheetVenueId, setSheetVenueId] = useState<string | null>(null);
  const [sheetAddress, setSheetAddress] = useState<string | undefined>(undefined);

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<FanZone | null>(null);

  // Auth UI. openSignIn stashes an optional onSuccess to resume a pending action (used by the
  // create-party gate, #31); the avatar opens it with no resume.
  const [signInOpen, setSignInOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingResume = useRef<(() => void) | null>(null);
  const openSignIn = useCallback((onSuccess?: () => void) => {
    pendingResume.current = onSuccess ?? null;
    setSignInOpen(true);
  }, []);

  useVenueSubscription();
  usePlacesSearch();

  const handleBoundsChange = (bounds: BoundingBox) => setBounds(bounds);

  // Clear drop-pin when a venue is selected from the markers
  useEffect(() => {
    if (selectedPlaceId) setMapPin(null);
  }, [selectedPlaceId]);

  const handleMapClick = useCallback(({ lngLat, point, osmVenue }: MapClickPayload) => {
    if (osmVenue) {
      // OSM POI tap — open drawer directly, no pin-drop
      setSelectedPlaceId(null);
      setSelectedOsmVenue(osmVenue);
      setMapPin(null);
      return;
    }
    // Empty map tap — pin+menu visible → dismiss, hidden → drop pin and open menu
    setSelectedOsmVenue(null);
    setMapPin((prev) =>
      prev ? null : { location: lngLat, menuPos: { x: point.x, y: point.y } },
    );
  }, [setSelectedOsmVenue, setSelectedPlaceId]);

  function handleCreateParty(
    location?: { lat: number; lng: number },
    source: 'google' | 'osm' | 'custom' = 'custom',
    venue_id: string | null = null,
    address?: string,
  ) {
    // Gate: creating a fan zone requires sign-in. Stash this exact call and resume it
    // after the user signs in (the SignInSheet calls onSuccess on success).
    //
    // Read the store directly (not the hook-bound `currentUser`) — when this call is
    // the *resumed* pending action, it's the same closure created back when the gate
    // first fired, so the outer `currentUser` is stale (still null from that render).
    // useMapStore.getState() always reflects the live store, sidestepping the race
    // between the auth-state update and React re-rendering this component.
    if (!useMapStore.getState().currentUser) {
      openSignIn(() => handleCreateParty(location, source, venue_id, address));
      return;
    }
    setSheetDefaultLocation(location ?? mapPin?.location);
    setSheetSource(source);
    setSheetVenueId(venue_id);
    setSheetAddress(address);
    setMapPin(null);
    setCreateSheetOpen(true);
  }

  return (
    <main className="w-screen h-screen relative bg-gray-200">
      <MapTopBar />
      <ProfileAvatar onRequestAuth={() => openSignIn()} onOpenProfile={() => setProfileOpen(true)} />
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
        isOpen={createSheetOpen || editingVenue !== null}
        defaultLocation={sheetDefaultLocation}
        defaultSource={sheetSource}
        defaultVenueId={sheetVenueId}
        defaultAddress={sheetAddress}
        editingVenue={editingVenue}
        onClose={() => {
          const wasEditing = editingVenue !== null;
          setCreateSheetOpen(false);
          setEditingVenue(null);
          if (wasEditing) {
            setSelectedPlaceId(null);
            setSelectedOsmVenue(null);
          }
        }}
      />
      <VenueDrawer
        onCreateParty={(loc, src, vid, addr) => handleCreateParty(loc, src, vid, addr)}
        onRequireSignIn={openSignIn}
        onEditVenue={(fz) => setEditingVenue(fz)}
      />

      <SignInSheet
        isOpen={signInOpen}
        onClose={() => setSignInOpen(false)}
        onSuccess={() => { pendingResume.current?.(); pendingResume.current = null; }}
      />
      <ProfileSheet isOpen={profileOpen} onClose={() => setProfileOpen(false)} />

      {/* Studio FAB — disabled for now */}
      <Link
        href="/studio/card"
        aria-disabled="true"
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
        className="absolute bottom-6 left-6 z-10 flex items-center gap-2 px-4 py-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 text-white/50 text-sm font-medium shadow-lg pointer-events-none cursor-not-allowed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>
        </svg>
        GenAI Studio
      </Link>
    </main>
  );
}
