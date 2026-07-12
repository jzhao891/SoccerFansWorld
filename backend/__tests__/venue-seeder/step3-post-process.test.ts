import { describe, it, expect } from 'vitest';
import { filterStaleEvents } from '../../venue-seeder/step3-post-process';
import type { SeedVenue } from '../../scripts/seed-venues';

const NOW = new Date('2026-06-15T00:00:00Z').getTime();

const makeVenue = (name: string, events: SeedVenue['events']): SeedVenue => ({
  venue_name: name,
  venue_search_query: `${name} Seattle WA`,
  events,
});

const makeEvent = (title: string, startTime?: string) => ({
  event_title: title,
  start_time: startTime,
  admission: 'free' as const,
  amenities: ['big screen'],
  is_active: true,
});

describe('filterStaleEvents', () => {
  it('drops events with a start_time in the past', () => {
    const venues = [
      makeVenue('Bar A', [
        makeEvent('Past Match', '2026-06-01T00:00:00Z'),
        makeEvent('Future Match', '2026-07-01T00:00:00Z'),
      ]),
    ];

    const { filtered, removedEvents, removedVenues } = filterStaleEvents(venues, NOW);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].events.map((e) => e.event_title)).toEqual(['Future Match']);
    expect(removedEvents).toBe(1);
    expect(removedVenues).toBe(0);
  });

  it('keeps events with no start_time regardless of now', () => {
    const venues = [makeVenue('Bar A', [makeEvent('TBD Match', undefined)])];

    const { filtered, removedEvents } = filterStaleEvents(venues, NOW);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].events).toHaveLength(1);
    expect(removedEvents).toBe(0);
  });

  it('removes a venue entirely once all its events are past', () => {
    const venues = [
      makeVenue('Bar A', [makeEvent('Past Match', '2026-06-01T00:00:00Z')]),
    ];

    const { filtered, removedEvents, removedVenues } = filterStaleEvents(venues, NOW);

    expect(filtered).toHaveLength(0);
    expect(removedEvents).toBe(1);
    expect(removedVenues).toBe(1);
  });

  it('keeps a venue that has at least one future event', () => {
    const venues = [
      makeVenue('Bar A', [
        makeEvent('Past Match', '2026-06-01T00:00:00Z'),
        makeEvent('Future Match', '2026-07-01T00:00:00Z'),
      ]),
    ];

    const { filtered, removedVenues } = filterStaleEvents(venues, NOW);

    expect(filtered).toHaveLength(1);
    expect(removedVenues).toBe(0);
  });

  it('handles multiple venues independently', () => {
    const venues = [
      makeVenue('Bar A', [makeEvent('Past Match', '2026-06-01T00:00:00Z')]),
      makeVenue('Bar B', [makeEvent('Future Match', '2026-07-01T00:00:00Z')]),
    ];

    const { filtered, removedEvents, removedVenues } = filterStaleEvents(venues, NOW);

    expect(filtered.map((v) => v.venue_name)).toEqual(['Bar B']);
    expect(removedEvents).toBe(1);
    expect(removedVenues).toBe(1);
  });

  it('returns an empty array unchanged', () => {
    const { filtered, removedEvents, removedVenues } = filterStaleEvents([], NOW);
    expect(filtered).toEqual([]);
    expect(removedEvents).toBe(0);
    expect(removedVenues).toBe(0);
  });

  it('defaults `now` to the current time when not provided', () => {
    const venues = [makeVenue('Bar A', [makeEvent('Way Future Match', '2999-01-01T00:00:00Z')])];
    const { filtered } = filterStaleEvents(venues);
    expect(filtered).toHaveLength(1);
  });
});
