import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate };
  },
}));

import { judgeAndExtractVenues } from '../../../venue-seeder/lib/extract';

const VALID_VENUE = {
  venue_name: 'The Pub',
  venue_search_query: 'The Pub 123 Main St Seattle WA',
  events: [{ event_title: 'Belgium vs. Egypt', admission: 'free', amenities: ['big screen'], is_active: true }],
};

const VALID_JUDGMENT = {
  venue_name: 'The Pub',
  included: true,
  reason: 'Official watch party, corroborated by two sources.',
};

function mockResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  });
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe('judgeAndExtractVenues', () => {
  it('returns parsed venues and judgments on a valid response', async () => {
    mockResponse(JSON.stringify({ venues: [VALID_VENUE], judgments: [VALID_JUDGMENT] }));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result.venues).toHaveLength(1);
    expect(result.venues[0].venue_name).toBe('The Pub');
    expect(result.judgments).toEqual([VALID_JUDGMENT]);
  });

  it('returns empty venues/judgments on invalid JSON and logs error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResponse('not valid json at all');
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result).toEqual({ venues: [], judgments: [] });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse'));
    consoleSpy.mockRestore();
  });

  it('returns empty venues/judgments when response is a bare array (old shape)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResponse(JSON.stringify([VALID_VENUE]));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result).toEqual({ venues: [], judgments: [] });
    consoleSpy.mockRestore();
  });

  it('returns empty venues/judgments when "venues" field is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResponse(JSON.stringify({ judgments: [VALID_JUDGMENT] }));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result).toEqual({ venues: [], judgments: [] });
    consoleSpy.mockRestore();
  });

  it('returns empty venues/judgments when "judgments" field is missing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockResponse(JSON.stringify({ venues: [VALID_VENUE] }));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result).toEqual({ venues: [], judgments: [] });
    consoleSpy.mockRestore();
  });

  it('returns rejected judgments even when no venues pass', async () => {
    mockResponse(JSON.stringify({
      venues: [],
      judgments: [{ venue_name: 'Random Bar', included: false, reason: 'Single uncorroborated mention.' }],
    }));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result.venues).toEqual([]);
    expect(result.judgments).toHaveLength(1);
    expect(result.judgments[0].included).toBe(false);
  });

  it('returns multiple venues', async () => {
    mockResponse(JSON.stringify({
      venues: [VALID_VENUE, { ...VALID_VENUE, venue_name: 'Bar B' }],
      judgments: [VALID_JUDGMENT, { venue_name: 'Bar B', included: true, reason: 'Chain location with official signage.' }],
    }));
    const result = await judgeAndExtractVenues('some page text', 'test source');
    expect(result.venues).toHaveLength(2);
  });

  it('passes the correct model to Claude', async () => {
    mockResponse(JSON.stringify({ venues: [], judgments: [] }));
    await judgeAndExtractVenues('content', 'src');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-8' }),
    );
  });

  it('passes content as user message', async () => {
    mockResponse(JSON.stringify({ venues: [], judgments: [] }));
    await judgeAndExtractVenues('my page content', 'src');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'my page content' }],
      }),
    );
  });

  it('handles missing text block in response gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockResolvedValueOnce({ content: [] });
    const result = await judgeAndExtractVenues('content', 'src');
    expect(result).toEqual({ venues: [], judgments: [] });
    consoleSpy.mockRestore();
  });
});
