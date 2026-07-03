// Client-side aggregation of a venue's check-in votes into a display summary.
// Pure — no React, no Firestore, no clock unless injected. See docs/CHECKIN_LLD_DECISIONS.md.
//
// Pipeline: freshness window → exponential recency decay → ordinal weighted mean (vibe) +
// per-metric weighted yes-fraction (big_screen, sound) → per-metric confidence gate.

import type { CheckIn, CheckinAggregate, Vibe } from '../types/map';
import { VIBE_LEVELS } from '../types/map';

// --- Tunable knobs (revisit with real data) ---
export const CHECKIN_WINDOW_MS = 2 * 60 * 60 * 1000;  // freshness window: 2h
export const CHECKIN_HALF_LIFE_MS = 30 * 60 * 1000;   // decay half-life: 30m
// Per-metric confidence gate: minimum surviving weight for a metric to show a badge.
// 0.5 = one vote up to 30 min old qualifies; raise once traffic grows.
export const CHECKIN_MIN_WEIGHT = 0.5;

// Ordinal value of a vibe = its index in VIBE_LEVELS (Chill=0, Buzzing=1, Packed=2).
function vibeLevel(v: Vibe): number {
  return VIBE_LEVELS.indexOf(v);
}

// Round an ordinal mean back to the nearest vibe label (clamped to the scale).
function vibeFromLevel(mean: number): Vibe {
  const i = Math.max(0, Math.min(VIBE_LEVELS.length - 1, Math.round(mean)));
  return VIBE_LEVELS[i];
}

// Recency weight: 0.5 ^ (age / halfLife). Fresh → 1.0; one half-life old → 0.5.
function decayWeight(ageMs: number, halfLifeMs: number): number {
  if (ageMs <= 0) return 1;
  return Math.pow(0.5, ageMs / halfLifeMs);
}

export type AggregateOptions = {
  now?: number;                    // injectable clock (tests); defaults to Date.now()
  startTime?: number | null;       // venue start_time (ms); null/undefined → rolling window
  windowMs?: number;
  halfLifeMs?: number;
  minWeight?: number;
};

// The all-null / zero aggregate returned when there's nothing to show.
function emptyAggregate(): CheckinAggregate {
  return {
    vibe: null,
    bigScreen: null,
    sound: null,
    bigScreenFraction: 0,
    soundFraction: 0,
    vibeWeight: 0,
    bigScreenWeight: 0,
    soundWeight: 0,
    count: 0,
  };
}

export function aggregateCheckins(checkins: CheckIn[], opts: AggregateOptions = {}): CheckinAggregate {
  const now = opts.now ?? Date.now();
  const windowMs = opts.windowMs ?? CHECKIN_WINDOW_MS;
  const halfLifeMs = opts.halfLifeMs ?? CHECKIN_HALF_LIFE_MS;
  const minWeight = opts.minWeight ?? CHECKIN_MIN_WEIGHT;

  // Lower bound: anchored to (start_time − window) when start_time is in the past (event is
  // live or recently ended), else rolling (now − window). A future start_time would push the
  // window entirely into the future, filtering out all current votes — fall back to now.
  const anchor = (opts.startTime != null && opts.startTime <= now) ? opts.startTime : now;
  const windowStart = anchor - windowMs;

  let vibeWeight = 0;
  let vibeWeightedSum = 0;
  let bigScreenWeight = 0;
  let bigScreenYesWeight = 0;
  let soundWeight = 0;
  let soundYesWeight = 0;
  let count = 0;

  for (const c of checkins) {
    if (c.updated_at < windowStart || c.updated_at > now) continue; // outside window / future
    const w = decayWeight(now - c.updated_at, halfLifeMs);
    count += 1;

    // vibe — always present
    vibeWeight += w;
    vibeWeightedSum += w * vibeLevel(c.vibe);

    // big_screen / sound — optional; a skipped answer contributes to neither weight nor yes-count
    if (c.big_screen !== undefined) {
      bigScreenWeight += w;
      if (c.big_screen) bigScreenYesWeight += w;
    }
    if (c.sound !== undefined) {
      soundWeight += w;
      if (c.sound) soundYesWeight += w;
    }
  }

  if (count === 0) return emptyAggregate();

  const bigScreenFraction = bigScreenWeight > 0 ? bigScreenYesWeight / bigScreenWeight : 0;
  const soundFraction = soundWeight > 0 ? soundYesWeight / soundWeight : 0;

  return {
    vibe: vibeWeight >= minWeight ? vibeFromLevel(vibeWeightedSum / vibeWeight) : null,
    bigScreen: bigScreenWeight >= minWeight ? bigScreenFraction > 0.5 : null,
    sound: soundWeight >= minWeight ? soundFraction > 0.5 : null,
    bigScreenFraction,
    soundFraction,
    vibeWeight,
    bigScreenWeight,
    soundWeight,
    count,
  };
}
