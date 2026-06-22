'use client';

import { useState, useEffect } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '@/lib/firebase';
import { useMapStore } from '@/store/mapStore';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultLocation?: { lat: number; lng: number };
  defaultSource?: 'google' | 'osm' | 'custom';
  defaultVenueId?: string | null;
  defaultAddress?: string; // already-known address (google / existing fan zone); osm & custom geocode instead
}

// "TBD" first so it leads the list and is the default for knockout/unknown matches.
const TEAM_OPTIONS = ['TBD', ...WORLD_CUP_2026_TEAMS];

function defaultKickoffValue() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreateWatchPartySheet({ isOpen, onClose, defaultLocation, defaultSource, defaultVenueId, defaultAddress }: Props) {
  const viewState = useMapStore((s) => s.viewState);

  const [venueName, setVenueName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoffTime, setKickoffTime] = useState(defaultKickoffValue);
  const [endTime, setEndTime] = useState('');
  const [isWatchParty, setIsWatchParty] = useState(true);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(['TBD']);
  const [admission, setAdmission] = useState<'free' | 'paid'>('free');
  const [organizers, setOrganizers] = useState('');
  const [url, setUrl] = useState('');
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const meetingPoint = gpsLocation ?? defaultLocation ?? { lat: viewState.latitude, lng: viewState.longitude };

  // Resolve a human-readable address for the meeting point. Google places and
  // existing fan zones already have one (defaultAddress); osm/custom + any GPS
  // override get reverse-geocoded server-side.
  useEffect(() => {
    if (!isOpen) return;
    const { lat, lng } = meetingPoint;

    if (defaultAddress && !gpsLocation) {
      setAddress(defaultAddress);
      return;
    }

    let cancelled = false;
    setAddressLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng }),
        });
        const data = await res.json() as { address?: string };
        if (!cancelled) setAddress(data.address ?? null);
      } catch {
        if (!cancelled) setAddress(null);
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAddress, gpsLocation, meetingPoint.lat, meetingPoint.lng]);

  function toggleTeam(team: string) {
    setSelectedTeams((prev) => {
      if (prev.includes(team)) return prev.filter((t) => t !== team);
      if (prev.length >= 2) return prev; // a match has at most two teams
      return [...prev, team];
    });
  }

  function useGPS() {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 10000 },
    );
  }

  function resetAndClose() {
    setVenueName('');
    setEventTitle('');
    setDescription('');
    setKickoffTime(defaultKickoffValue());
    setEndTime('');
    setIsWatchParty(true);
    setSelectedTeams(['TBD']);
    setAdmission('free');
    setOrganizers('');
    setUrl('');
    setGpsLocation(null);
    setAddress(null);
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const organizerList = organizers.split(',').map((o) => o.trim()).filter(Boolean);
      const ref = doc(collection(db, 'venues'));
      await setDoc(ref, {
        source: defaultSource ?? 'custom',
        venue_id: defaultVenueId ?? null,
        name: venueName.trim(),
        event_title: eventTitle.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        location: meetingPoint,
        address: address ?? `${meetingPoint.lat.toFixed(5)}, ${meetingPoint.lng.toFixed(5)}`,
        geohash: geohashForLocation([meetingPoint.lat, meetingPoint.lng]),
        start_time: new Date(kickoffTime).getTime(),
        ...(endTime ? { end_time: new Date(endTime).getTime() } : {}),
        // watching_teams present => watch party; omitted => Fan Zone only
        ...(isWatchParty ? { watching_teams: selectedTeams } : {}),
        admission,
        amenities: [],
        ...(organizerList.length ? { organizers: organizerList } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
        is_active: false, // created inactive; a moderation sweep validates + activates it (see BACKLOGS.md)
        created_by: '',
        created_at: Date.now(),
      });
      resetAndClose();
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = Boolean(
    venueName.trim() && eventTitle.trim() && kickoffTime &&
    (!isWatchParty || selectedTeams.length > 0),
  );

  return (
    <>
      {/* Transparent click-catcher: a click anywhere dismisses the panel (map stays visible).
          The next click then reaches the map/marker and opens the relevant panel. */}
      {isOpen && <div className="fixed inset-0 z-20" onClick={resetAndClose} />}

      <div
        className={`fixed top-4 left-4 z-30 w-[380px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1.5rem)]'
        }`}
      >
        <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Create a fan zone</h2>
          <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer">×</button>
        </div>

        {/* Venue name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Venue name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. The Football Factory"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* Event title */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Event title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. USA vs England — Group Stage"
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* Event description */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Event description <span className="font-normal normal-case text-gray-400">(optional)</span>
          </label>
          <textarea
            placeholder="e.g. Meet here first, then we'll head somewhere together"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50 resize-none"
          />
        </div>

        {/* Date & time */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Start <span className="text-red-400">*</span>
          </label>
          <input
            type="datetime-local"
            value={kickoffTime}
            onChange={(e) => setKickoffTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* End time (optional) */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            End <span className="font-normal normal-case text-gray-400">(optional)</span>
          </label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* Meeting point */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Meeting point
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500 truncate">
              {addressLoading
                ? 'Finding address…'
                : address
                  ? `📍 ${address}`
                  : `${meetingPoint.lat.toFixed(4)}, ${meetingPoint.lng.toFixed(4)}`}
            </div>
            <button
              onClick={useGPS}
              disabled={gpsLoading}
              className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 font-medium hover:bg-gray-50 cursor-pointer"
            >
              {gpsLoading ? '…' : 'Use GPS'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Pan the map to your meeting point, or use GPS</p>
        </div>

        {/* Watch party toggle */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Watch party?
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={isWatchParty}
              onClick={() => setIsWatchParty((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                isWatchParty ? 'bg-gray-900' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                isWatchParty ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* Teams — only when this is a watch party */}
          {isWatchParty && (
            <div className="mt-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                Teams <span className="font-normal normal-case text-gray-400">(pick up to 2)</span>
                {selectedTeams.length > 0 && <span className="font-normal normal-case ml-1 text-gray-400">— {selectedTeams.length} selected</span>}
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {TEAM_OPTIONS.map((team) => {
                  const selected = selectedTeams.includes(team);
                  return (
                    <button
                      key={team}
                      onClick={() => toggleTeam(team)}
                      style={{
                        backgroundColor: selected ? '#111827' : '#F9FAFB',
                        color: selected ? '#fff' : '#374151',
                        borderColor: selected ? '#111827' : '#E5E7EB',
                      }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer"
                    >
                      {team}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Admission */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Admission <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            {(['free', 'paid'] as const).map((option) => {
              const selected = admission === option;
              return (
                <button
                  key={option}
                  onClick={() => setAdmission(option)}
                  style={{ backgroundColor: selected ? '#111827' : '#fff', color: selected ? '#fff' : '#374151' }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 capitalize cursor-pointer"
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Organizers (optional) */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Organizers <span className="font-normal normal-case text-gray-400">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Local Supporters Club, Pub Co"
            value={organizers}
            onChange={(e) => setOrganizers(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* URL (optional) */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            Event page URL <span className="font-normal normal-case text-gray-400">(optional)</span>
          </label>
          <input
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || saving}
          style={{ backgroundColor: canSubmit && !saving ? '#111827' : '#D1D5DB' }}
          className="w-full py-3.5 rounded-xl text-white text-sm font-semibold cursor-pointer"
        >
          {saving ? 'Creating…' : 'Create fan zone'}
        </button>
        </div>
      </div>
    </>
  );
}
