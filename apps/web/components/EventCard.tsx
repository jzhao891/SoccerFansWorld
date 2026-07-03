'use client';

import { useMapStore } from '@/store/mapStore';
import {
  useVenueCheckins,
  writeCheckIn,
  removeCheckIn,
  writeRsvp,
  removeRsvp,
  VIBE_LEVELS,
} from '@sfw/shared';
import type { FanZone, Vibe } from '@sfw/shared';

const VIBE_EMOJI: Record<Vibe, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
};

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

export default function EventCard({
  fz,
  onRequireSignIn,
  onEdit,
}: {
  fz: FanZone;
  onRequireSignIn: (onSuccess?: () => void) => void;
  onEdit?: () => void;
}) {
  const { myCheckin, hasRsvped, rsvpCount } = useVenueCheckins(fz.id, fz.start_time ?? null);
  const watchParty = isWatchParty(fz);

  // Run `action` with the signed-in uid, gating through sign-in when needed. Reads uid fresh
  // from the store at call time so a *resumed* action (after sign-in) sees the new user.
  function withAuth(action: (uid: string) => void) {
    const uid = useMapStore.getState().currentUser?.uid;
    if (uid) {
      action(uid);
      return;
    }
    onRequireSignIn(() => {
      const freshUid = useMapStore.getState().currentUser?.uid;
      if (freshUid) action(freshUid);
    });
  }

  function chooseVibe(vibe: Vibe) {
    withAuth((uid) =>
      writeCheckIn(fz.id, uid, { vibe, big_screen: myCheckin?.big_screen, sound: myCheckin?.sound }),
    );
  }

  // Optional binary: needs a vibe first. Clicking the active value clears it (back to unanswered).
  function toggleBinary(field: 'big_screen' | 'sound', value: boolean) {
    if (!myCheckin) return;
    const next = myCheckin[field] === value ? undefined : value;
    withAuth((uid) =>
      writeCheckIn(fz.id, uid, {
        vibe: myCheckin.vibe,
        big_screen: field === 'big_screen' ? next : myCheckin.big_screen,
        sound: field === 'sound' ? next : myCheckin.sound,
      }),
    );
  }

  function clearCheckin() {
    withAuth((uid) => removeCheckIn(fz.id, uid));
  }

  function toggleRsvp() {
    withAuth((uid) => (hasRsvped ? removeRsvp(fz.id, uid) : writeRsvp(fz.id, uid)));
  }

  const pillStyle = (active: boolean) => ({
    backgroundColor: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#6B7280',
  });

  return (
    <div className="rounded-xl border border-gray-200 p-3.5 mb-3">
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{fz.event_title}</p>
        {rsvpCount > 0 && <span className="text-[10px] text-gray-500 shrink-0">👥 {rsvpCount}</span>}
      </div>

      {/* Date & time */}
      <p className="text-xs text-gray-500 mt-1.5">{formatStart(fz.start_time)}</p>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Fan Zone</span>
        {watchParty && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Watch Party</span>
        )}
        {fz.admission && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
            fz.admission === 'free' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {fz.admission}
          </span>
        )}
      </div>

      {fz.description && <p className="text-xs text-gray-500 mt-1 italic">{fz.description}</p>}

      {/* Teams */}
      {watchParty && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {isTeamsTBD(fz) ? (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Match TBD</span>
          ) : (
            fz.watching_teams!.map((team) => (
              <span key={team} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{team}</span>
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
        <a href={fz.url} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
          Event page
        </a>
      )}

      {/* Check-in controls */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Vibe</p>
        <div className="flex gap-1 mb-2">
          {VIBE_LEVELS.map((option) => (
            <button
              key={option}
              onClick={() => chooseVibe(option)}
              style={pillStyle(myCheckin?.vibe === option)}
              className="flex-1 py-0.5 rounded-md text-[10px] font-medium border border-gray-200 cursor-pointer"
            >
              {VIBE_EMOJI[option]} {option}
            </button>
          ))}
        </div>

        {/* Optional binaries — enabled once a vibe is chosen */}
        <div className={`flex gap-4 mb-2 ${myCheckin ? '' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">Big screen</span>
            {([['Yes', true], ['No', false]] as const).map(([label, val]) => (
              <button key={label} onClick={() => toggleBinary('big_screen', val)}
                style={pillStyle(myCheckin?.big_screen === val)}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-gray-200 cursor-pointer">
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 mr-0.5">Sound</span>
            {([['🔊', true], ['🔇', false]] as const).map(([label, val]) => (
              <button key={label} onClick={() => toggleBinary('sound', val)}
                style={pillStyle(myCheckin?.sound === val)}
                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-gray-200 cursor-pointer">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* RSVP + clear */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRsvp}
            style={pillStyle(hasRsvped)}
            className="px-3 py-0.5 rounded-md text-[10px] font-semibold border border-gray-200 cursor-pointer"
          >
            RSVP
          </button>
          {hasRsvped && <span className="text-[10px] text-green-600 font-semibold">✓</span>}
          {myCheckin && (
            <button onClick={clearCheckin}
              className="ml-1 text-[10px] text-gray-400 hover:text-gray-600 underline cursor-pointer">
              Clear my check-in
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit}
              className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 underline cursor-pointer">
              Edit event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
