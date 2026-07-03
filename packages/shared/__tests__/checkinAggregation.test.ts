import { describe, it, expect } from 'vitest';
import { aggregateCheckins } from '../src/lib/checkinAggregation';
import type { CheckIn, Vibe } from '../src/types/map';

const NOW = 1_700_000_000_000; // fixed clock for determinism
const MIN = 60 * 1000;

// A vote `ageMin` minutes before NOW. big_screen/sound spread in only when provided,
// so "not answered" is a genuinely absent field (not `false`).
function vote(
  ageMin: number,
  vibe: Vibe,
  extra: Partial<Pick<CheckIn, 'big_screen' | 'sound'>> = {},
  id = 'u' + Math.random(),
): CheckIn {
  return { user_id: id, vibe, updated_at: NOW - ageMin * MIN, ...extra };
}

describe('aggregateCheckins', () => {
  it('returns an empty aggregate for no votes', () => {
    const agg = aggregateCheckins([], { now: NOW });
    expect(agg.count).toBe(0);
    expect(agg.vibe).toBeNull();
    expect(agg.bigScreen).toBeNull();
    expect(agg.sound).toBeNull();
  });

  describe('freshness window', () => {
    it('rolling (no start_time): drops votes older than the window', () => {
      const agg = aggregateCheckins([vote(10, 'Packed'), vote(200, 'Chill')], { now: NOW });
      expect(agg.count).toBe(1); // 200min > 120min window
    });

    it('ignores future-dated votes', () => {
      const agg = aggregateCheckins([vote(-10, 'Packed'), vote(5, 'Chill')], { now: NOW });
      expect(agg.count).toBe(1);
    });

    it('anchored: window is start_time − 2h when start_time is present', () => {
      const startTime = NOW - 30 * MIN; // event started 30m ago → window opened 150m ago
      const agg = aggregateCheckins([vote(140, 'Packed'), vote(160, 'Chill')], { now: NOW, startTime });
      expect(agg.count).toBe(1); // 140m in (<150), 160m out (>150)
    });
  });

  describe('vibe — ordinal weighted mean', () => {
    it('rounds the weighted mean back to a label (3×Packed + 1×Chill → Packed)', () => {
      // fresh votes, equal weight: mean = (2+2+2+0)/4 = 1.5 → round → 2 → Packed
      const agg = aggregateCheckins(
        [vote(0, 'Packed'), vote(0, 'Packed'), vote(0, 'Packed'), vote(0, 'Chill')],
        { now: NOW },
      );
      expect(agg.vibe).toBe('Packed');
    });

    it('an even Chill/Packed split averages to the middle (Buzzing)', () => {
      const agg = aggregateCheckins([vote(0, 'Chill'), vote(0, 'Packed')], { now: NOW });
      expect(agg.vibe).toBe('Buzzing');
    });

    it('recency decay lets a fresh vote outweigh an old one', () => {
      // halfLife 30m: fresh Packed w=1.0, 60m-old Chill w=0.25 → mean = 2/1.25 = 1.6 → Packed
      const agg = aggregateCheckins([vote(0, 'Packed'), vote(60, 'Chill')], { now: NOW });
      expect(agg.vibe).toBe('Packed');
    });
  });

  describe('optional binaries — per-metric weights', () => {
    it('a skipped binary is not counted as a "no"', () => {
      // one vibe-only vote + one that says big_screen:true → fraction is 1/1, not 1/2
      const agg = aggregateCheckins([vote(0, 'Buzzing'), vote(0, 'Chill', { big_screen: true })], { now: NOW });
      expect(agg.vibeWeight).toBeCloseTo(2);
      expect(agg.bigScreenWeight).toBeCloseTo(1); // only one vote answered
      expect(agg.bigScreenFraction).toBeCloseTo(1);
      expect(agg.bigScreen).toBe(true);
    });

    it('a metric no one answered stays null with zero weight', () => {
      const agg = aggregateCheckins([vote(0, 'Buzzing'), vote(0, 'Chill')], { now: NOW });
      expect(agg.soundWeight).toBe(0);
      expect(agg.sound).toBeNull();
    });

    it('yes-fraction majority decides the badge (0.5 is not a majority)', () => {
      const agg = aggregateCheckins(
        [
          vote(0, 'Buzzing', { big_screen: true }),
          vote(0, 'Buzzing', { big_screen: true }),
          vote(0, 'Buzzing', { big_screen: true }),
          vote(0, 'Buzzing', { big_screen: false }),
          vote(0, 'Buzzing', { sound: true }),
          vote(0, 'Buzzing', { sound: false }),
        ],
        { now: NOW },
      );
      expect(agg.bigScreenFraction).toBeCloseTo(0.75);
      expect(agg.bigScreen).toBe(true);
      expect(agg.soundFraction).toBeCloseTo(0.5);
      expect(agg.sound).toBe(false); // 0.5 is not > 0.5
    });
  });

  describe('confidence gate (per-metric)', () => {
    it('a single fresh vote qualifies (weight 1.0 ≥ threshold)', () => {
      expect(aggregateCheckins([vote(0, 'Packed')], { now: NOW }).vibe).toBe('Packed');
    });

    it('a single half-decayed vote is gated out (weight 0.5 < 1.0)', () => {
      const agg = aggregateCheckins([vote(30, 'Packed')], { now: NOW });
      expect(agg.count).toBe(1); // counted in the window…
      expect(agg.vibe).toBeNull(); // …but below the confidence gate
    });
  });
});
