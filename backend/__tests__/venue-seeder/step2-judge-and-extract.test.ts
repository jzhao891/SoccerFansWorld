import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendVenues, appendJudgments } from '../../venue-seeder/step2-judge-and-extract';
import type { SeedVenue } from '../../scripts/seed-venues';

// ---- appendVenues ----

describe('appendVenues', () => {
  let tmpDir: string;
  let tmpFile: string;

  const makeVenue = (name: string): SeedVenue => ({
    venue_name: name,
    venue_search_query: `${name} Seattle WA`,
    events: [{ event_title: 'Test Event', admission: 'free', amenities: ['big screen'], is_active: true }],
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-and-extract-test-'));
    tmpFile = path.join(tmpDir, 'step2and3-venues.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates a new file when none exists', () => {
    appendVenues([makeVenue('Bar A')], tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result).toHaveLength(1);
    expect(result[0].venue_name).toBe('Bar A');
  });

  it('appends to existing venues without overwriting', () => {
    fs.writeFileSync(tmpFile, JSON.stringify([makeVenue('Bar A')]));
    appendVenues([makeVenue('Bar B')], tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result).toHaveLength(2);
    expect(result.map((v: SeedVenue) => v.venue_name)).toEqual(['Bar A', 'Bar B']);
  });

  it('appends multiple venues at once', () => {
    appendVenues([makeVenue('Bar A'), makeVenue('Bar B'), makeVenue('Bar C')], tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result).toHaveLength(3);
  });

  it('handles empty venues array gracefully', () => {
    fs.writeFileSync(tmpFile, JSON.stringify([makeVenue('Bar A')]));
    appendVenues([], tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result).toHaveLength(1);
  });
});

// ---- appendJudgments ----

describe('appendJudgments', () => {
  let tmpDir: string;
  let tmpFile: string;

  const makeResult = (venueName: string) => ({
    venues: [],
    judgments: [
      { venue_name: venueName, included: true, reason: 'Official partnership with the city.' },
      { venue_name: 'Random Blog Mention', included: false, reason: 'Single uncorroborated mention.' },
    ],
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-and-extract-test-'));
    tmpFile = path.join(tmpDir, 'step2-judgements.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates a new file when none exists', () => {
    appendJudgments(makeResult('Bar A'), tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result).toHaveLength(1);
    expect(result[0].judgments).toHaveLength(2);
  });

  it('appends to existing entries without overwriting, one entry per batch, unmodified from judgeAndExtractVenues', () => {
    appendJudgments(makeResult('Bar A'), tmpFile);
    appendJudgments(makeResult('Bar B'), tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result.map((e: { judgments: { venue_name: string }[] }) => e.judgments[0].venue_name)).toEqual([
      'Bar A',
      'Bar B',
    ]);
  });

  it('preserves rejected judgments (included: false) alongside accepted ones', () => {
    appendJudgments(makeResult('Bar A'), tmpFile);
    const result = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(result[0].judgments.find((j: { included: boolean }) => !j.included)).toBeDefined();
  });
});
