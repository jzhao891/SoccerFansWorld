import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/places', () => {
  describe('mock mode (MOCK_PLACES=true)', () => {
    beforeEach(() => {
      vi.stubEnv('MOCK_PLACES', 'true');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns mock places without calling Google API', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch');
      const { POST } = await import('@/app/api/places/route');
      const res = await POST(makeRequest({ lat: 47.6, lng: -122.3 }));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.places)).toBe(true);
      expect(data.places.length).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  describe('live mode (no MOCK_PLACES)', () => {
    beforeEach(() => {
      vi.stubEnv('MOCK_PLACES', '');
      vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns 500 when API key is not configured', async () => {
      const { POST } = await import('@/app/api/places/route');
      const res = await POST(makeRequest({ lat: 47.6, lng: -122.3 }));
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toMatch(/key/i);
    });

    it('returns 400 when lat/lng are missing', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
      const { POST } = await import('@/app/api/places/route');
      const res = await POST(makeRequest({ lat: 'not-a-number', lng: -122.3 }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/lat/i);
    });
  });
});
