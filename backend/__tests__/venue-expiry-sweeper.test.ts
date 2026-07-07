import { describe, it, expect } from 'vitest';
import { effectiveEndMs, isExpired, DEFAULT_DURATION_MS, GRACE_MS } from '../sweepers/venue-expiry-sweeper';

const NOW = 1_783_000_000_000; // fixed reference timestamp

// ---- effectiveEndMs ----

describe('effectiveEndMs', () => {
  it('returns end_time when present', () => {
    expect(effectiveEndMs({ end_time: 1000 })).toBe(1000);
  });

  it('prefers end_time over start_time', () => {
    expect(effectiveEndMs({ start_time: 500, end_time: 1000 })).toBe(1000);
  });

  it('returns start_time + DEFAULT_DURATION_MS when only start_time is set', () => {
    expect(effectiveEndMs({ start_time: 1000 })).toBe(1000 + DEFAULT_DURATION_MS);
  });

  it('returns null when neither field is present', () => {
    expect(effectiveEndMs({})).toBeNull();
  });

  it('returns null when both fields are non-numeric', () => {
    expect(effectiveEndMs({ start_time: 'bad', end_time: null })).toBeNull();
  });

  it('returns null when start_time is a string (not a number)', () => {
    expect(effectiveEndMs({ start_time: '2026-06-15T14:30:00Z' })).toBeNull();
  });
});

// ---- isExpired ----

describe('isExpired', () => {
  it('returns false when no time info', () => {
    expect(isExpired({}, NOW)).toBe(false);
  });

  it('returns false when still within grace window (end_time present)', () => {
    const endTime = NOW - GRACE_MS + 1; // 1ms inside grace
    expect(isExpired({ end_time: endTime }, NOW)).toBe(false);
  });

  it('returns false exactly at grace boundary', () => {
    const endTime = NOW - GRACE_MS;
    expect(isExpired({ end_time: endTime }, NOW)).toBe(false);
  });

  it('returns true when past grace window (end_time present)', () => {
    const endTime = NOW - GRACE_MS - 1; // 1ms past grace
    expect(isExpired({ end_time: endTime }, NOW)).toBe(true);
  });

  it('returns false when event not yet over (end_time in future)', () => {
    expect(isExpired({ end_time: NOW + 1000 }, NOW)).toBe(false);
  });

  it('uses start_time + DEFAULT_DURATION_MS when no end_time', () => {
    // event started DEFAULT_DURATION_MS + GRACE_MS + 1ms ago → expired
    const startTime = NOW - DEFAULT_DURATION_MS - GRACE_MS - 1;
    expect(isExpired({ start_time: startTime }, NOW)).toBe(true);
  });

  it('not expired when only start_time and still within effective grace', () => {
    const startTime = NOW - DEFAULT_DURATION_MS - GRACE_MS + 1;
    expect(isExpired({ start_time: startTime }, NOW)).toBe(false);
  });

  it('returns false for an active ongoing event with start_time only', () => {
    // event started 1 hour ago — still within 3h assumed duration
    const startTime = NOW - 60 * 60 * 1000;
    expect(isExpired({ start_time: startTime }, NOW)).toBe(false);
  });
});
