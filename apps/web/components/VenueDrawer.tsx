'use client';

import { useMapStore } from '@/store/mapStore';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import EventCard from '@/components/EventCard';
import { useVenueCheckins } from '@sfw/shared';
import type { FanZone, Vibe } from '@sfw/shared';

const VIBE_EMOJI: Record<Vibe, string> = { Chill: '😌', Buzzing: '🔥', Packed: '🤯' };

function VibeBadges({ eventId, startTime }: { eventId: string; startTime?: number | null }) {
  const { aggregate } = useVenueCheckins(eventId, startTime ?? null);
if (!aggregate.vibe) return null;
  return (
    <span className="text-[11px] text-gray-500 mt-0.5">
      {VIBE_EMOJI[aggregate.vibe]} {aggregate.vibe}
    </span>
  );
}

interface Props {
  onCreateParty?: (location: { lat: number; lng: number }, source: 'google' | 'osm' | 'custom', venue_id: string | null, address?: string) => void;
  onRequireSignIn: (onSuccess?: () => void) => void;
  onEditVenue?: (fz: FanZone) => void;
}

export default function VenueDrawer({ onCreateParty, onRequireSignIn, onEditVenue }: Props) {
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const currentUser = useMapStore((s) => s.currentUser);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const mergedPlaces = useMergedPlaces();

  const osmVenue = selectedOsmVenue;
  const place = osmVenue ? null : (mergedPlaces.find((p) => p.id === selectedPlaceId) ?? null);
  const events = place?.fanZones ?? [];
  const rep = events[0] ?? null;

  const isOpen = osmVenue !== null || place !== null;

  function dismiss() {
    setSelectedPlaceId(null);
    setSelectedOsmVenue(null);
  }

  return (
    <>
      {/* Transparent click-catcher: a click anywhere dismisses the panel (map stays visible).
          The next click then reaches the map and drops a pin / opens the relevant panel. */}
      {isOpen && <div className="fixed inset-0 z-10" onClick={dismiss} />}

      <div
        className={`fixed top-4 left-4 z-20 w-[380px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1.5rem)]'
        }`}
      >
      {/* OSM venue — name and category only */}
      {osmVenue && (
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{osmVenue.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5 capitalize">{osmVenue.category}</p>
            </div>
            <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>
          {onCreateParty && (
            <button
              onClick={() => { onCreateParty(osmVenue.location, 'osm', osmVenue.id); dismiss(); }}
              className="px-4 py-2 rounded-lg bg-gray-900/80 text-xs font-semibold text-white hover:bg-gray-900/90 cursor-pointer"
            >
              Create fan zone here
            </button>
          )}
        </div>
      )}

      {place && (
        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
              {events[0] && <VibeBadges eventId={events[0].id} startTime={events[0].start_time} />}
              {(rep?.address || place.googleData?.vicinity) && (
                <p className="text-sm text-gray-500 mt-0.5">{rep?.address ?? place.googleData?.vicinity}</p>
              )}
              {place.googleData && (place.googleData.rating || place.googleData.open_now !== undefined) && (
                <div className="flex gap-4 mt-1.5 text-sm text-gray-600">
                  {place.googleData.rating && <span>⭐ {place.googleData.rating}</span>}
                  {place.googleData.open_now !== undefined && (
                    <span className={place.googleData.open_now ? 'text-green-600' : 'text-red-500'}>
                      {place.googleData.open_now ? 'Open now' : 'Closed'}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={dismiss}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
            >
              ×
            </button>
          </div>

          {/* Primary action — prominent, top */}
          {onCreateParty && (
            <button
              onClick={() => {
                const src = place.source === 'google' ? 'google' : (rep?.source ?? 'custom');
                const vid = place.source === 'google' ? place.id : (rep?.venue_id ?? null);
                // Google place + existing fan zone already carry an address — reuse it (no geocode).
                const addr = place.source === 'google' ? place.googleData?.vicinity : rep?.address;
                onCreateParty(place.location, src, vid, addr);
                setSelectedPlaceId(null);
              }}
              className="px-4 py-2 rounded-lg bg-gray-900/80 text-xs font-semibold text-white hover:bg-gray-900/90 cursor-pointer mb-4"
            >
              Create fan zone here
            </button>
          )}

          {/* Events list — sorted by date then name in useMergedPlaces */}
          {events.map((fz) => (
            <EventCard
              key={fz.id}
              fz={fz}
              onRequireSignIn={onRequireSignIn}
              onEdit={currentUser?.uid === fz.created_by ? () => onEditVenue?.(fz) : undefined}
            />
          ))}

          {/* Empty state */}
          {place.source === 'fanzone' && events.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No upcoming events.
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
