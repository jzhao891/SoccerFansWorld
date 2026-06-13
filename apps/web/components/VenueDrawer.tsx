'use client';

import { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useMapStore } from '@/store/mapStore';
import { useMergedPlaces } from '@/hooks/useMergedPlaces';
import type { LiveStatus } from '@sfw/shared';

const CROWD_OPTIONS: LiveStatus['crowd_index'][] = ['Chill', 'Buzzing', 'Packed', 'Wild'];

const CROWD_EMOJI: Record<string, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
  Wild: '🦁',
};

interface Props {
  onCreateParty?: (location: { lat: number; lng: number }, source: 'google' | 'osm' | 'custom', venue_id: string | null) => void;
}

export default function VenueDrawer({ onCreateParty }: Props) {
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const setSelectedPlaceId = useMapStore((s) => s.setSelectedPlaceId);
  const selectedOsmVenue = useMapStore((s) => s.selectedOsmVenue);
  const setSelectedOsmVenue = useMapStore((s) => s.setSelectedOsmVenue);
  const liveStatuses = useMapStore((s) => s.liveStatuses);
  const mergedPlaces = useMergedPlaces();
  const [saving, setSaving] = useState(false);

  const osmVenue = selectedOsmVenue;
  const place = osmVenue ? null : (mergedPlaces.find((p) => p.id === selectedPlaceId) ?? null);
  const venueId = place?.fanZone?.id ?? null;
  const liveStatus = venueId ? liveStatuses[venueId] ?? null : null;

  async function checkIn(patch: Partial<Pick<LiveStatus, 'crowd_index' | 'sound'>>) {
    if (!venueId) return;
    setSaving(true);
    await setDoc(
      doc(db, 'live_statuses', venueId),
      { venue_id: venueId, ...liveStatus, ...patch, updated_at: Date.now() },
      { merge: true },
    );
    setSaving(false);
  }

  const isOpen = osmVenue !== null || place !== null;

  function dismiss() {
    setSelectedPlaceId(null);
    setSelectedOsmVenue(null);
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={dismiss} />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-20 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* OSM venue — name and category only */}
        {osmVenue && (
          <div className="p-5 pb-safe">
            <div className="flex justify-center pt-1 pb-3 -mx-5 -mt-5 mb-2 cursor-pointer" onClick={dismiss}>
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{osmVenue.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5 capitalize">{osmVenue.category}</p>
              </div>
              <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
            </div>
            {onCreateParty && (
              <div className="border-t pt-4">
                <button
                  onClick={() => { onCreateParty(osmVenue.location, 'osm', osmVenue.id); dismiss(); }}
                  className="w-full py-3 rounded-xl bg-gray-500/10 text-sm font-medium text-gray-600 hover:bg-gray-500/15 flex items-center justify-center gap-2"
                >
                  🎉 Create watch party here
                </button>
              </div>
            )}
          </div>
        )}

        {place && (
          <div className="p-5 pb-safe max-h-[75vh] overflow-y-auto">
            {/* Handle — tall tap target, visually thin bar */}
            <div className="flex justify-center pt-1 pb-3 -mx-5 -mt-5 mb-2 cursor-pointer" onClick={dismiss}>
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{place.name}</h2>
                {place.googleData?.vicinity && (
                  <p className="text-sm text-gray-500 mt-0.5">{place.googleData.vicinity}</p>
                )}
              </div>
              <button
                onClick={dismiss}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
              >
                ×
              </button>
            </div>

            {/* Google data row */}
            <div className="flex gap-4 mb-4 text-sm text-gray-600">
              {place.googleData?.rating && (
                <span>⭐ {place.googleData.rating}</span>
              )}
              {place.googleData?.open_now !== undefined && (
                <span className={place.googleData.open_now ? 'text-green-600' : 'text-red-500'}>
                  {place.googleData.open_now ? 'Open now' : 'Closed'}
                </span>
              )}
              <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${
                place.source === 'fanzone' ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {place.source === 'fanzone' ? (place.fanZone?.source ?? 'fanzone') : 'google'}
              </span>
            </div>

            {/* Fan zone data */}
            {place.fanZone && (
              <>
                <div className="border-t pt-3 mb-3">
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    📺 {place.fanZone.event_title}
                  </p>
                  {place.fanZone.kickoff_time > 0 && (
                    <p className="text-xs text-gray-500 mb-2">
                      🕐 {new Date(place.fanZone.kickoff_time).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  )}
                  {place.fanZone.description && (
                    <p className="text-xs text-gray-500 mb-2 italic">{place.fanZone.description}</p>
                  )}
                  {place.fanZone.watching_teams.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {place.fanZone.watching_teams.map((team) => (
                        <span key={team} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                          {team}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {place.fanZone.amenities.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Amenities</p>
                    <div className="flex flex-wrap gap-1">
                      {place.fanZone.amenities.map((a) => (
                        <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                          {a.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Live status */}
            {liveStatus && (
              <div className="border-t pt-3 flex gap-6 text-sm mb-4">
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

            {/* Create watch party */}
            {onCreateParty && (
              <div className="border-t pt-4 mb-2">
                <button
                  onClick={() => {
                    const src = place.source === 'google' ? 'google' : (place.fanZone?.source ?? 'custom');
                    const vid = place.source === 'google' ? place.id : (place.fanZone?.venue_id ?? null);
                    onCreateParty(place.location, src, vid);
                    setSelectedPlaceId(null);
                  }}
                  className="w-full py-3 rounded-xl bg-gray-500/10 text-sm font-medium text-gray-600 hover:bg-gray-500/15 flex items-center justify-center gap-2"
                >
                  🎉 Create watch party here
                </button>
              </div>
            )}

            {/* Check-in */}
            {venueId && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Check in {saving && <span className="font-normal normal-case">Saving...</span>}
                </p>

                <p className="text-xs text-gray-500 mb-2">How&apos;s the crowd?</p>
                <div className="flex gap-2 mb-4">
                  {CROWD_OPTIONS.map((option) => {
                    const selected = liveStatus?.crowd_index === option;
                    return (
                      <button
                        key={option}
                        onClick={() => checkIn({ crowd_index: option })}
                        disabled={saving}
                        style={{ backgroundColor: selected ? '#111827' : '#fff', color: selected ? '#fff' : '#374151' }}
                        className="flex-1 py-3 rounded-lg text-sm font-medium border border-gray-200 transition-colors"
                      >
                        {CROWD_EMOJI[option!]} {option}
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mb-2">Sound on?</p>
                <div className="flex gap-2">
                  {(['On', 'Off'] as const).map((option) => {
                    const selected = liveStatus?.sound === option;
                    return (
                    <button
                      key={option}
                      onClick={() => checkIn({ sound: option })}
                      disabled={saving}
                      style={{ backgroundColor: selected ? '#111827' : '#fff', color: selected ? '#fff' : '#374151' }}
                      className="px-6 py-3 rounded-lg text-sm font-medium border border-gray-200 transition-colors"
                    >
                      {option === 'On' ? '🔊 On' : '🔇 Off'}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
