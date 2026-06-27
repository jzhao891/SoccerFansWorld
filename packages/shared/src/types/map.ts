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
export type GoogleVenue = {
  source: 'google';
  id: string;
  name: string;
  location: LatLng;
  types: string[];
  vicinity?: string;
  rating?: number;
  open_now?: boolean;
};

// A POI sourced from Mapbox vector tile (OpenStreetMap data)
export type OsmVenue = {
  source: 'osm';
  id: string;
  name: string;
  location: LatLng;
  category: string; // e.g. 'bar', 'restaurant', 'stadium'
};

export type Venue = GoogleVenue | OsmVenue;

// Moderation lifecycle of a FanZone. Replaces the old is_active boolean so we can tell
// "awaiting review" (INACTIVE) apart from "reviewed and rejected" (REJECTED).
export type ActivityStatus = 'ACTIVE' | 'INACTIVE' | 'REJECTED';

// A custom fan zone stored in Firestore (venues collection)
export type FanZone = {
  id: string;
  // Provenance — where the FanZone was created from, stored in Firestore.
  // Distinct from MergedPlace.source which controls map rendering.
  // 'google': user tapped a Google venue dot; 'osm': user tapped a Mapbox POI label;
  // 'custom': user tapped empty map with no source venue.
  source: 'google' | 'osm' | 'custom';
  venue_id: string | null;  // Google place_id, OSM feature id, or null for custom
  name: string;
  address: string;          // reverse geocoded from location on pin drop
  location: LatLng;
  geohash: string;
  event_title: string;
  start_time?: number;      // Unix timestamp ms — event start at venue; omitted for TBD-time events
  end_time?: number;        // Unix timestamp ms — event end at venue
  // Present (real teams or ["TBD"]) => watch party. Absent => general fan event (Fan Zone only).
  watching_teams?: string[]; // e.g. ["USA", "England"] or ["TBD"] for knockout rounds
  admission?: 'free' | 'paid';
  amenities: string[];      // e.g. ["big screen", "outdoor seating"]
  description?: string;
  organizers?: string[];
  url?: string;
  // ACTIVE: passed validation + content review, shown on the map.
  // INACTIVE: awaiting the activation sweep (default for user-created fan zones).
  // REJECTED: failed the sweep's content gate — kept out of the sweep's re-scan.
  activity_status: ActivityStatus;
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

// The merged result rendered on the map.
// source 'osm' is intentionally absent — OSM venues are rendered by Mapbox as POI labels
// and never added to our marker layer. They surface transiently via selectedOsmVenue in
// the store when tapped, not as persistent MergedPlace entries.
export type MergedPlace = {
  id: string;
  name: string;
  location: LatLng;
  source: 'google' | 'fanzone';
  googleData?: GoogleVenue;
  // All active events at this physical venue, sorted by start_time asc then event_title asc.
  // Events sharing a venue_id are grouped here; custom parties (null venue_id) stand alone.
  fanZones?: FanZone[];
  liveStatus?: LiveStatus;
};
