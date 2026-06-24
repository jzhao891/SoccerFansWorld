import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { validateVenues, findPotentialDuplicates, logDuplicateWarning, log } from '../seed-venues';
import type { SeedVenue, SeedEvent, FirestoreDoc } from '../seed-venues';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn().mockReturnValue({}),
  where: vi.fn().mockReturnValue({}),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(),
}));

const makeEvent = (overrides: Partial<SeedEvent> = {}): SeedEvent => ({
  event_title: 'Belgium vs. Egypt',
  start_time: '2026-06-15T14:30:00-07:00',
  watching_teams: ['Belgium', 'Egypt'],
  admission: 'free',
  amenities: ['big screen'],
  ...overrides,
});

const makeVenue = (overrides: Partial<SeedVenue> = {}): SeedVenue => ({
  venue_name: 'Match Alley',
  venue_search_query: 'Match Alley 505 1st Ave S Seattle WA',
  events: [makeEvent()],
  ...overrides,
});

// ---- validateVenues ----

describe('validateVenues', () => {
  it('passes a venue with known teams', () => {
    const { valid, invalid } = validateVenues([makeVenue()]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('passes a venue with TBD teams', () => {
    const venue = makeVenue({ events: [makeEvent({ watching_teams: ['TBD'] })] });
    const { valid, invalid } = validateVenues([venue]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('passes a venue with no watching_teams (non-match event)', () => {
    const venue = makeVenue({ events: [makeEvent({ watching_teams: undefined })] });
    const { valid, invalid } = validateVenues([venue]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('skips entire venue when any event has an unknown team', () => {
    const venue = makeVenue({
      events: [
        makeEvent({ watching_teams: ['Belgium', 'Egypt'] }),
        makeEvent({ event_title: 'Bad event', watching_teams: ['NotATeam'] }),
      ],
    });
    const { valid, invalid } = validateVenues([venue]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('skips only the invalid venue and keeps valid ones', () => {
    const good = makeVenue({ venue_name: 'Good Venue' });
    const bad = makeVenue({
      venue_name: 'Bad Venue',
      events: [makeEvent({ watching_teams: ['FakeCountry'] })],
    });
    const { valid, invalid } = validateVenues([good, bad]);
    expect(valid).toHaveLength(1);
    expect(valid[0].venue_name).toBe('Good Venue');
    expect(invalid).toHaveLength(1);
    expect(invalid[0].venue_name).toBe('Bad Venue');
  });

  it('handles empty venues array', () => {
    const { valid, invalid } = validateVenues([]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it('handles a venue with no events', () => {
    const venue = makeVenue({ events: [] });
    const { valid, invalid } = validateVenues([venue]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('logs error for skipped venues', () => {
    const spy = vi.spyOn(log, 'error');
    const venue = makeVenue({ events: [makeEvent({ watching_teams: ['FakeTeam'] })] });
    validateVenues([venue]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Skipping venue'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('unknown team "FakeTeam"'));
  });
});

// ---- validateVenues against fixture file ----

describe('validateVenues (fixture file)', () => {
  it('passes all venues in the test fixture', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures/venues.json');
    const venues: SeedVenue[] = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const { invalid } = validateVenues(venues);
    expect(invalid).toHaveLength(0);
  });
});

// ---- findPotentialDuplicates ----

describe('findPotentialDuplicates', () => {
  const START = new Date('2026-06-15T14:30:00-07:00').getTime();

  beforeEach(() => vi.clearAllMocks());

  function makeSnap(docs: FirestoreDoc[]) {
    return { docs: docs.map((d) => ({ id: d.id, data: () => ({ ...d }) })) };
  }

  it('returns empty when no docs exist', async () => {
    const { getDocs } = await import('firebase/firestore');
    (getDocs as Mock).mockResolvedValue(makeSnap([]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, ['Belgium', 'Egypt']);
    expect(result).toHaveLength(0);
  });

  it('flags when BOTH same-day AND overlapping teams match (intersection)', async () => {
    const { getDocs } = await import('firebase/firestore');
    const existing: FirestoreDoc = {
      id: 'doc1', venue_id: 'place_123', start_time: START,
      event_title: 'BEL vs EGY', watching_teams: ['Belgium', 'Egypt'],
    };
    (getDocs as Mock).mockResolvedValueOnce(makeSnap([existing]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, ['Belgium', 'Egypt']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('doc1');
  });

  it('does not flag when same day but different teams', async () => {
    const { getDocs } = await import('firebase/firestore');
    const existing: FirestoreDoc = {
      id: 'doc2', venue_id: 'place_123', start_time: START,
      event_title: 'USA vs Mexico', watching_teams: ['USA', 'Mexico'],
    };
    (getDocs as Mock).mockResolvedValueOnce(makeSnap([existing]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, ['Belgium', 'Egypt']);
    expect(result).toHaveLength(0);
  });

  it('does not flag when teams overlap but different day', async () => {
    const { getDocs } = await import('firebase/firestore');
    // Day query returns nothing (different day), so intersection is empty
    (getDocs as Mock).mockResolvedValueOnce(makeSnap([]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, ['Belgium', 'Egypt']);
    expect(result).toHaveLength(0);
  });

  it('uses only day strategy when watching_teams is TBD', async () => {
    const { getDocs } = await import('firebase/firestore');
    const existing: FirestoreDoc = { id: 'doc3', venue_id: 'place_123', start_time: START };
    (getDocs as Mock).mockResolvedValueOnce(makeSnap([existing]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, ['TBD']);
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it('uses only day strategy when watching_teams is absent', async () => {
    const { getDocs } = await import('firebase/firestore');
    (getDocs as Mock).mockResolvedValueOnce(makeSnap([]));
    const result = await findPotentialDuplicates({} as any, 'place_123', START, undefined);
    expect(getDocs).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(0);
  });
});

// ---- logDuplicateWarning ----

describe('logDuplicateWarning', () => {
  it('logs skip_dedupe_check instruction', () => {
    const spy = vi.spyOn(log, 'warn');
    const event = makeEvent();
    const match: FirestoreDoc = { id: 'abc', event_title: 'BEL vs EGY', start_time: Date.now(), watching_teams: ['Belgium', 'Egypt'] };
    logDuplicateWarning(event, 'Match Alley', [match]);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('skip_dedupe_check: true'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Belgium vs. Egypt'));
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('abc'));
  });
});
