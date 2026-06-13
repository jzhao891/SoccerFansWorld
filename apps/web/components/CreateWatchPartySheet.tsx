'use client';

import { useState } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '@/lib/firebase';
import { useMapStore } from '@/store/mapStore';
import { WORLD_CUP_2026_TEAMS } from '@sfw/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultLocation?: { lat: number; lng: number };
}

function defaultKickoffValue() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreateWatchPartySheet({ isOpen, onClose, defaultLocation }: Props) {
  const viewState = useMapStore((s) => s.viewState);

  const [partyName, setPartyName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoffTime, setKickoffTime] = useState(defaultKickoffValue);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const meetingPoint = gpsLocation ?? defaultLocation ?? { lat: viewState.latitude, lng: viewState.longitude };

  function toggleTeam(team: string) {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team],
    );
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
    setPartyName('');
    setEventTitle('');
    setDescription('');
    setKickoffTime(defaultKickoffValue());
    setSelectedTeams([]);
    setGpsLocation(null);
    onClose();
  }

  async function handleSubmit() {
    if (!partyName.trim() || !eventTitle.trim() || !kickoffTime) return;
    setSaving(true);
    try {
      const ref = doc(collection(db, 'venues'));
      await setDoc(ref, {
        google_place_id: null,
        name: partyName.trim(),
        event_title: eventTitle.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        location: meetingPoint,
        geohash: geohashForLocation([meetingPoint.lat, meetingPoint.lng]),
        kickoff_time: new Date(kickoffTime).getTime(),
        watching_teams: selectedTeams,
        amenities: [],
        is_active: true,
        created_by: '',
        created_at: Date.now(),
      });
      resetAndClose();
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = partyName.trim() && eventTitle.trim() && kickoffTime;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-20" onClick={resetAndClose} />}

      <div
        className={`fixed bottom-0 left-0 right-0 z-30 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="p-5 max-h-[88vh] overflow-y-auto">
          {/* Handle */}
          <div
            className="flex justify-center pt-1 pb-3 -mx-5 -mt-5 mb-2 cursor-pointer"
            onClick={resetAndClose}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">Host a watch party</h2>
            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Party name */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Party name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. WC Watch Party"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
            />
          </div>

          {/* What are you watching */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              What are you watching? <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. USA vs England — Group Stage"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50"
            />
          </div>

          {/* Date & time */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Date & time <span className="text-red-400">*</span>
            </label>
            <input
              type="datetime-local"
              value={kickoffTime}
              onChange={(e) => setKickoffTime(e.target.value)}
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
                {gpsLocation
                  ? `📍 ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
                  : `Map center (${viewState.latitude.toFixed(4)}, ${viewState.longitude.toFixed(4)})`}
              </div>
              <button
                onClick={useGPS}
                disabled={gpsLoading}
                className="flex-shrink-0 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 font-medium hover:bg-gray-50"
              >
                {gpsLoading ? '…' : 'Use GPS'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Pan the map to your meeting point, or use GPS</p>
          </div>

          {/* Teams */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
              Teams{selectedTeams.length > 0 && <span className="font-normal normal-case ml-1 text-gray-400">({selectedTeams.length} selected)</span>}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
              {WORLD_CUP_2026_TEAMS.map((team) => {
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
                    className="px-2.5 py-1 rounded-full text-xs font-medium border"
                  >
                    {team}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              Description <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              placeholder="e.g. Meet here first, then we'll head somewhere together"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 bg-gray-50 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            style={{ backgroundColor: canSubmit && !saving ? '#111827' : '#D1D5DB' }}
            className="w-full py-3.5 rounded-xl text-white text-sm font-semibold"
          >
            {saving ? 'Creating…' : 'Create watch party'}
          </button>
        </div>
      </div>
    </>
  );
}
