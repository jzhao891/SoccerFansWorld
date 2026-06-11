import { describe, it, expect } from 'vitest';
import { buildFogGeoJSON } from '@/lib/fogLayer';
import type { AllowedRegion } from '@sfw/shared';

const seattle: AllowedRegion = {
  name: 'Seattle',
  bounds: { north: 47.75, south: 47.45, east: -122.15, west: -122.55 },
};

const sf: AllowedRegion = {
  name: 'SF Bay Area',
  bounds: { north: 37.95, south: 37.25, east: -121.75, west: -122.65 },
};

describe('buildFogGeoJSON', () => {
  it('returns a GeoJSON Feature with Polygon geometry', () => {
    const result = buildFogGeoJSON([seattle]);
    expect(result.type).toBe('Feature');
    expect(result.geometry.type).toBe('Polygon');
  });

  it('first ring is the world bounding box', () => {
    const result = buildFogGeoJSON([seattle]);
    const worldRing = result.geometry.coordinates[0];
    expect(worldRing[0]).toEqual([-180, -85]);
    expect(worldRing[1]).toEqual([180, -85]);
    expect(worldRing[2]).toEqual([180, 85]);
    expect(worldRing[3]).toEqual([-180, 85]);
    expect(worldRing[4]).toEqual([-180, -85]); // closed
  });

  it('adds one hole per region', () => {
    const result = buildFogGeoJSON([seattle, sf]);
    // coordinates[0] = world ring, [1] = seattle hole, [2] = sf hole
    expect(result.geometry.coordinates).toHaveLength(3);
  });

  it('hole uses region bounds in clockwise order', () => {
    const result = buildFogGeoJSON([seattle]);
    const hole = result.geometry.coordinates[1];
    const { west, south, east, north } = seattle.bounds;
    expect(hole[0]).toEqual([west, south]);
    expect(hole[1]).toEqual([east, south]);
    expect(hole[2]).toEqual([east, north]);
    expect(hole[3]).toEqual([west, north]);
    expect(hole[4]).toEqual([west, south]); // closed
  });

  it('produces no holes when regions array is empty', () => {
    const result = buildFogGeoJSON([]);
    expect(result.geometry.coordinates).toHaveLength(1);
  });

  it('returns empty properties object', () => {
    const result = buildFogGeoJSON([seattle]);
    expect(result.properties).toEqual({});
  });
});
