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

// Per-EVENT check-in + RSVP. Check-ins are keyed by the FanZone doc id (fz.id); the live
// summary is the client-side aggregate. See docs/CHECKIN_LLD_DECISIONS.md.

const VIBE_EMOJI: Record<Vibe, string> = {
  Chill: '😌',
  Buzzing: '🔥',
  Packed: '🤯',
};

export default function EventCheckin({
  fz,
  onRequireSignIn,
}: {
  fz: FanZone;
  onRequireSignIn: (onSuccess?: () => void) => void;
}) {
  const { aggregate, rsvpCount, myCheckin, hasRsvped } = useVenueCheckins(fz.id, fz.start_time ?? null);

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
    // Upsert the vote, preserving any binaries the user already answered.
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

  const hasLive =
    aggregate.vibe !== null || aggregate.bigScreen !== null || aggregate.sound !== null || rsvpCount > 0;

  const binaryBtn = (active: boolean) => ({
    backgroundColor: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#6B7280',
  });

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Live summary — confidence-gated (null metrics hidden) */}
      {hasLive && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2.5 text-xs">
          {aggregate.vibe && (
            <span className="text-gray-700">
              <span className="text-gray-400">Vibe </span>
              {VIBE_EMOJI[aggregate.vibe]} {aggregate.vibe}
            </span>
          )}
          {aggregate.bigScreen !== null && (
            <span className="text-gray-700">
              <span className="text-gray-400">Screen </span>
              {aggregate.bigScreen ? '🖥️ Yes' : '🚫 No'}
            </span>
          )}
          {aggregate.sound !== null && (
            <span className="text-gray-700">
              <span className="text-gray-400">Sound </span>
              {aggregate.sound ? '🔊 On' : '🔇 Off'}
            </span>
          )}
          {rsvpCount > 0 && <span className="text-gray-700">👥 {rsvpCount} going</span>}
        </div>
      )}

      {/* Vibe — required, single-select (tap to check in) */}
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
        How&apos;s it right now?
      </p>
      <div className="flex gap-1 mb-2">
        {VIBE_LEVELS.map((option) => {
          const selected = myCheckin?.vibe === option;
          return (
            <button
              key={option}
              onClick={() => chooseVibe(option)}
              style={binaryBtn(selected)}
              className="flex-1 py-1 rounded-md text-[11px] font-medium border border-gray-200 cursor-pointer"
            >
              {VIBE_EMOJI[option]} {option}
            </button>
          );
        })}
      </div>

      {/* Optional binaries — enabled once a vibe is chosen */}
      <div className={`flex gap-4 mb-2.5 ${myCheckin ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-400 mr-0.5">Big screen</span>
          {([['Yes', true], ['No', false]] as const).map(([label, val]) => (
            <button
              key={label}
              onClick={() => toggleBinary('big_screen', val)}
              style={binaryBtn(myCheckin?.big_screen === val)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium border border-gray-200 cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-400 mr-0.5">Sound</span>
          {([['🔊', true], ['🔇', false]] as const).map(([label, val]) => (
            <button
              key={label}
              onClick={() => toggleBinary('sound', val)}
              style={binaryBtn(myCheckin?.sound === val)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium border border-gray-200 cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* RSVP + clear */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleRsvp}
          style={binaryBtn(hasRsvped)}
          className="px-3 py-1 rounded-md text-[11px] font-semibold border border-gray-200 cursor-pointer"
        >
          {hasRsvped ? '✓ Going' : 'RSVP'}
        </button>
        {myCheckin && (
          <button
            onClick={clearCheckin}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline cursor-pointer"
          >
            Clear my check-in
          </button>
        )}
      </div>
    </div>
  );
}
