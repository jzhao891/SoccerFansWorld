import type { BoundingBox } from './types/map';

export interface AllowedRegion {
  name: string;
  bounds: BoundingBox;
}

// FIFA World Cup 2026 — 48 qualified teams
export const WORLD_CUP_2026_TEAMS: string[] = [
  // Hosts (3)
  'Canada', 'Mexico', 'USA',
  // CONMEBOL (6)
  'Argentina', 'Brazil', 'Colombia', 'Ecuador', 'Paraguay', 'Uruguay',
  // UEFA (16)
  'Austria', 'Croatia', 'Czech Republic', 'Denmark', 'England',
  'France', 'Germany', 'Hungary', 'Italy', 'Netherlands',
  'Portugal', 'Scotland', 'Serbia', 'Spain', 'Switzerland', 'Ukraine',
  // CAF (9)
  'Algeria', 'DR Congo', 'Egypt', 'Ghana', 'Ivory Coast',
  'Morocco', 'Nigeria', 'Senegal', 'South Africa',
  // AFC (8)
  'Australia', 'Iran', 'Iraq', 'Japan', 'Jordan',
  'Saudi Arabia', 'South Korea', 'Uzbekistan',
  // CONCACAF non-host (3)
  'Honduras', 'Jamaica', 'Panama',
  // OFC (1)
  'New Zealand',
  // Inter-confederation playoffs (2)
  'Indonesia', 'Venezuela',
];

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
