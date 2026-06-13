import type { AllowedRegion } from '../constants';

// Builds a GeoJSON polygon covering the entire world with holes cut out
// for each allowed region, used to render the fog overlay on the map.
export function buildFogGeoJSON(regions: AllowedRegion[]) {
  const worldRing: [number, number][] = [
    [-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85],
  ];

  // Interior rings must be clockwise (GeoJSON right-hand rule for holes)
  const holes: [number, number][][] = regions.map(({ bounds: { west, south, east, north } }) => [
    [west, south], [east, south], [east, north], [west, north], [west, south],
  ]);

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [worldRing, ...holes],
    },
    properties: {},
  };
}
