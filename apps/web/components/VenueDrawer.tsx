'use client';

import { useMapStore } from '@/store/mapStore';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import type { FanZone, LiveStatus } from '@sfw/shared';

const CROWD_OPTIONS: LiveStatus['crowd_index'][] = ['Chill', 'Buzzing', 'Packed', 'Wild'];

const CROWD_EMOJI: Record<string, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
  Wild: '🦁',
};

// A FanZone is a watch party iff it carries watching_teams (real teams or ["TBD"]).
// Without that field it's a general fan event — Fan Zone only.
function isWatchParty(fz: FanZone): boolean {
  return Array.isArray(fz.watching_teams) && fz.watching_teams.length > 0;
}

function isTeamsTBD(fz: FanZone): boolean {
  return isWatchParty(fz) && fz.watching_teams!.every((t) => t === 'TBD');
}

function formatStart(ms?: number): string {
  if (!ms) return 'Time TBD';
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Check-in is only meaningful for an event happening today.
function isToday(ms?: number): boolean {
  if (!ms) return false;
  const d = new Date(ms);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

interface Props {
  onCreateParty?: (location: { lat: number; lng: number }, source: 'google' | 'osm' | 'custom', venue_id: string | null, address?: string) => void;
}

export default function VenueDrawer({ onCreateParty }: Props) {
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const liveStatuses = useMapStore((s) => s.liveStatuses);
  const mergedPlaces = useMergedPlaces();

  const osmVenue = selectedOsmVenue;
  const place = osmVenue ? null : (mergedPlaces.find((p) => p.id === selectedPlaceId) ?? null);
  const events = place?.fanZones ?? [];
  const rep = events[0] ?? null;
  // Live status is keyed per physical venue: venue_id when present, else the lone event's id.
  const venueId = rep ? (rep.venue_id ?? rep.id) : null;
  const liveStatus = venueId ? liveStatuses[venueId] ?? null : null;

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
          {events.map((fz) => {
            const watchParty = isWatchParty(fz);
            const today = isToday(fz.start_time);
            return (
              <div key={fz.id} className="rounded-xl border border-gray-200 p-3.5 mb-3">
                {/* Title */}
                <p className="text-sm font-semibold text-gray-900">{fz.event_title}</p>

                {/* Date & time */}
                <p className="text-xs text-gray-500 mt-1.5">{formatStart(fz.start_time)}</p>

                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                    Fan Zone
                  </span>
                  {watchParty && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      Watch Party
                    </span>
                  )}
                  {fz.admission && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      fz.admission === 'free' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {fz.admission}
                    </span>
                  )}
                </div>

                {fz.description && (
                  <p className="text-xs text-gray-500 mt-1 italic">{fz.description}</p>
                )}

                {/* Teams */}
                {watchParty && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {isTeamsTBD(fz) ? (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Match TBD</span>
                    ) : (
                      fz.watching_teams!.map((team) => (
                        <span key={team} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {team}
                        </span>
                      ))
                    )}
                  </div>
                )}

                {/* Amenities */}
                {fz.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {fz.amenities.map((a) => (
                      <span key={a} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                        {a.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Event page */}
                {fz.url && (
                  <a
                    href={fz.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Event page
                  </a>
                )}

                {/* Check-in — only for events happening today.
                    Disabled until auth lands (check-in/RSVP require a signed-in user). */}
                {today && venueId && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Check in <span className="font-normal normal-case">(sign in required)</span>
                    </p>

                    <div className="opacity-50 pointer-events-none select-none" aria-disabled="true">
                      <p className="text-xs text-gray-400 mb-1.5">How&apos;s the crowd?</p>
                      <div className="flex gap-1.5 mb-3">
                        {CROWD_OPTIONS.map((option) => (
                          <button
                            key={option}
                            disabled
                            className="flex-1 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-400"
                          >
                            {CROWD_EMOJI[option!]} {option}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-gray-400 mb-1.5">Screen sound on?</p>
                      <div className="flex gap-1.5">
                        {(['On', 'Off'] as const).map((option) => (
                          <button
                            key={option}
                            disabled
                            className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-400"
                          >
                            {option === 'On' ? '🔊 On' : '🔇 Off'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {place.source === 'fanzone' && events.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-4">
              No upcoming events.
            </div>
          )}

          {/* Live status summary (read-only) */}
          {liveStatus && (liveStatus.crowd_index || liveStatus.sound || liveStatus.fan_ratio) && (
            <div className="border-t pt-3 flex gap-6 text-sm mt-2">
              {liveStatus.crowd_index && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Crowd</p>
                  <p className="font-medium text-gray-900">
                    {CROWD_EMOJI[liveStatus.crowd_index]} {liveStatus.crowd_index}
                  </p>
                </div>
              )}
              {liveStatus.sound && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Sound</p>
                  <p className="font-medium text-gray-900">{liveStatus.sound === 'On' ? '🔊 On' : '🔇 Off'}</p>
                </div>
              )}
              {liveStatus.fan_ratio && (
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Fan ratio</p>
                  <p className="font-medium text-gray-900">{liveStatus.fan_ratio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </>
  );
}
