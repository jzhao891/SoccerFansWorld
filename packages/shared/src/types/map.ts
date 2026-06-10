// Shared map types — no React, no React Native dependencies

export type LatLng = {
  lat: number;
  lng: number;
};

export type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};

// A result from Google Places Nearby Search API
export type PlaceResult = {
  place_id: string;
  name: string;
  location: LatLng;
  types: string[];
  vicinity?: string;
  rating?: number;
  open_now?: boolean;
};

// A custom fan zone stored in Firestore (venues collection)
export type FanZone = {
  id: string;
  google_place_id: string | null; // Bridge key — null for standalone zones
  name: string;
  location: LatLng;
  geohash: string;
  event_title: string;
  kickoff_time: number;     // Unix timestamp ms
  watching_teams: string[]; // e.g. ["USA", "England"]
  amenities: string[];      // e.g. ["big screen", "outdoor seating"]
  is_active: boolean;
  created_by: string;
  created_at: number;       // Unix timestamp ms
};

// A live status document stored in Firestore (live_statuses collection)
// Populated by user check-ins — fields may be empty until users engage
export type LiveStatus = {
  venue_id: string;          // google_place_id or FanZone.id
  crowd_index: 'Chill' | 'Buzzing' | 'Packed' | 'Wild' | null;
  fan_ratio: string | null;  // e.g. "60/40" — null until check-ins exist
  sound: 'On' | 'Off' | null;
  updated_at: number;        // Unix timestamp ms
};

// The merged result rendered on the map
export type MergedPlace = {
  place_id: string;
  name: string;
  location: LatLng;
  source: 'google' | 'custom' | 'merged';
  placeData?: PlaceResult;
  fanZone?: FanZone;
  liveStatus?: LiveStatus;
};
