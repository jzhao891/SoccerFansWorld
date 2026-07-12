import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the Anthropic client the same way lib/extract.test.ts does, so step2 never
// makes a real API call — this test only exercises the pipeline's file wiring.
const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { run as runCrawl } from '../../venue-seeder/step1-crawl-url';
import { run as runJudgeAndExtract } from '../../venue-seeder/step2-judge-and-extract';
import { run as runPostProcess } from '../../venue-seeder/step3-post-process';
import { validateVenues } from '../../scripts/seed-venues';

const HTML_PAGE = (label: string) =>
  `<html><body><h1>${label}</h1><p>${'Watch party details. '.repeat(30)}</p></body></html>`;

function mockClaudeResponse(text: string) {
  mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text }] });
}

describe('venue-seeder pipeline (step1 -> step2 -> step3)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'venue-seeder-pipeline-test-'));
    mockCreate.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
    vi.unstubAllGlobals();
  });

  it('carries a future-dated venue through to step3-venues.json and drops a past-dated one', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'crawl-urls.txt'),
      [
        '# test fixture',
        'https://example.com/future-venue',
        'https://example.com/past-venue',
      ].join('\n'),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => ({
        ok: true,
        text: async () => HTML_PAGE(url),
      })),
    );

    mockClaudeResponse(
      JSON.stringify({
        venues: [
          {
            venue_name: 'Future Venue',
            venue_search_query: 'Future Venue Seattle WA',
            events: [
              {
                event_title: 'Future Match',
                start_time: '2999-01-01T12:00:00-07:00',
                admission: 'free',
                amenities: ['big screen'],
                is_active: true,
              },
            ],
          },
          {
            venue_name: 'Past Venue',
            venue_search_query: 'Past Venue Seattle WA',
            events: [
              {
                event_title: 'Past Match',
                start_time: '2020-01-01T12:00:00-07:00',
                admission: 'free',
                amenities: ['big screen'],
                is_active: true,
              },
            ],
          },
        ],
        judgments: [
          { venue_name: 'Future Venue', included: true, reason: 'Official source, corroborated, good amenities.' },
          { venue_name: 'Past Venue', included: true, reason: 'Official source, corroborated, good amenities.' },
          { venue_name: 'Random Blog Mention', included: false, reason: 'Single uncorroborated mention.' },
        ],
      }),
    );

    await runCrawl(tmpDir);
    await runJudgeAndExtract(tmpDir);
    runPostProcess(tmpDir);

    // step1: both URLs fetched and recorded as processed
    const processed: string[] = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'step1-processed-urls.json'), 'utf-8'),
    );
    expect(processed.sort()).toEqual(['https://example.com/future-venue', 'https://example.com/past-venue']);

    // step2: one Claude call, both venues initially extracted, all judgments logged
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const judgements = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'step2-judgements.json'), 'utf-8'),
    );
    expect(judgements).toHaveLength(1);
    expect(judgements[0].judgments.map((j: { venue_name: string }) => j.venue_name)).toEqual([
      'Future Venue',
      'Past Venue',
      'Random Blog Mention',
    ]);
    expect(judgements[0].judgments.find((j: { included: boolean }) => !j.included).venue_name).toBe(
      'Random Blog Mention',
    );

    // step2's own output is untouched by step3 — both venues still present there
    const step2Venues = JSON.parse(fs.readFileSync(path.join(tmpDir, 'step2-venues.json'), 'utf-8'));
    expect(step2Venues.map((v: { venue_name: string }) => v.venue_name).sort()).toEqual([
      'Future Venue',
      'Past Venue',
    ]);

    // step3: past-dated venue pruned, future-dated venue survives, written to its own file
    const step3Venues = JSON.parse(fs.readFileSync(path.join(tmpDir, 'step3-venues.json'), 'utf-8'));
    expect(step3Venues).toHaveLength(1);
    expect(step3Venues[0].venue_name).toBe('Future Venue');
    expect(step3Venues[0].events).toHaveLength(1);

    // step3 -> step4 wiring: step3's output must be directly consumable by seed-venues.ts's
    // own validation, without needing to mock Firestore/Google Places to prove compatibility.
    const { valid, invalid } = validateVenues(step3Venues);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('throws in step3 when step2-venues.json was never created', () => {
    expect(() => runPostProcess(tmpDir)).toThrow('step2-venues.json not found');
  });
});
