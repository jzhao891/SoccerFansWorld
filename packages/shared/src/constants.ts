import type { BoundingBox } from './types/map';

export interface AllowedRegion {
  name: string;
  bounds: BoundingBox;
}

// FIFA World Cup 2026 — 48 qualified teams. Single source of truth for both
// venue seed validation and the create-fan-zone team picker, so DB data stays
// consistent. Spellings match the names written to Firestore by the seed script.
export const WORLD_CUP_2026_TEAMS: string[] = [
  // Co-hosts (3)
  'Canada', 'Mexico', 'USA',
  // CONMEBOL (6)
  'Argentina', 'Brazil', 'Colombia', 'Ecuador', 'Paraguay', 'Uruguay',
  // UEFA (16)
  'Austria', 'Belgium', 'Bosnia and Herzegovina', 'Croatia', 'Czechia',
  'England', 'France', 'Germany', 'Netherlands', 'Norway',
  'Portugal', 'Scotland', 'Spain', 'Sweden', 'Switzerland', 'Türkiye',
  // CAF (10)
  'Algeria', 'Cape Verde', 'DR Congo', 'Cote d\'Ivoire', 'Egypt',
  'Ghana', 'Morocco', 'Senegal', 'South Africa', 'Tunisia',
  // AFC (9)
  'Australia', 'Iran', 'Iraq', 'Japan', 'Jordan',
  'South Korea', 'Qatar', 'Saudi Arabia', 'Uzbekistan',
  // Concacaf non-host (3)
  'Curaçao', 'Haiti', 'Panama',
  // OFC (1)
  'New Zealand',
];

// FIFA World Cup 2026 host city regions
export const ALLOWED_REGIONS: AllowedRegion[] = [
  // USA (11)
  { name: 'Atlanta',         bounds: { north: 34.00, south: 33.50, east: -84.10, west: -84.70 } },
  { name: 'Boston',          bounds: { north: 42.50, south: 41.90, east: -70.80, west: -71.40 } },
  { name: 'Dallas',          bounds: { north: 33.15, south: 32.50, east: -96.50, west: -97.50 } },
  { name: 'Houston',         bounds: { north: 30.10, south: 29.40, east: -95.00, west: -95.80 } },
  { name: 'Kansas City',     bounds: { north: 39.40, south: 38.85, east: -94.20, west: -94.80 } },
  { name: 'Los Angeles',     bounds: { north: 34.35, south: 33.70, east: -117.65, west: -118.75 } },
  { name: 'Miami',           bounds: { north: 26.30, south: 25.50, east: -80.00, west: -80.60 } },
  { name: 'New York',        bounds: { north: 41.00, south: 40.45, east: -73.65, west: -74.40 } },
  { name: 'Philadelphia',    bounds: { north: 40.15, south: 39.75, east: -74.90, west: -75.45 } },
  { name: 'SF Bay Area',     bounds: { north: 37.95, south: 37.25, east: -121.75, west: -122.65 } },
  { name: 'Seattle',         bounds: { north: 47.75, south: 47.45, east: -122.15, west: -122.55 } },
  // Mexico (3)
  { name: 'Guadalajara',     bounds: { north: 20.85, south: 20.45, east: -103.20, west: -103.55 } },
  { name: 'Mexico City',     bounds: { north: 19.65, south: 19.00, east: -98.90, west: -99.40 } },
  { name: 'Monterrey',       bounds: { north: 25.90, south: 25.45, east: -100.00, west: -100.50 } },
  // Canada (2)
  { name: 'Toronto',         bounds: { north: 43.90, south: 43.50, east: -79.10, west: -79.75 } },
  { name: 'Vancouver',       bounds: { north: 49.40, south: 49.10, east: -122.95, west: -123.30 } },
];
