import type { BoundingBox } from './types/map';

export interface AllowedRegion {
  name: string;
  bounds: BoundingBox;
}

export const ALLOWED_REGIONS: AllowedRegion[] = [
  {
    name: 'Seattle',
    bounds: { north: 47.75, south: 47.45, east: -122.15, west: -122.55 },
  },
  {
    name: 'SF Bay Area',
    bounds: { north: 37.95, south: 37.25, east: -121.75, west: -122.65 },
  },
  {
    name: 'Los Angeles',
    bounds: { north: 34.35, south: 33.70, east: -117.65, west: -118.75 },
  },
  {
    name: 'Vancouver',
    bounds: { north: 49.40, south: 49.10, east: -122.95, west: -123.30 },
  },
];
