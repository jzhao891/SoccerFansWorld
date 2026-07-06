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

// Fields an owner may edit via the venue-edit sheet — exactly the create sheet's content fields.
// Everything else is frozen: identity/provenance (id, source, venue_id), derived (location,
// address, geohash), and system (created_by, created_at, activity_status). Editing re-enters
// moderation (activity_status → INACTIVE). See docs/CHECKIN_LLD_DECISIONS.md.
export type VenueEditableFields = Pick<
  FanZone,
  | 'name'
  | 'event_title'
  | 'description'
  | 'start_time'
  | 'end_time'
  | 'watching_teams'
  | 'admission'
  | 'amenities'
  | 'organizers'
  | 'url'
>;

// A live status document stored in Firestore (live_statuses collection)
// Populated by user check-ins — fields may be empty until users engage
// DEPRECATED: superseded by the check-in voting model (CheckIn below + client aggregation).
// Retained until both web + mobile drawers migrate off it; removed in the check-in cleanup.
// See docs/CHECKIN_LLD_DECISIONS.md.
export type LiveStatus = {
  venue_id: string;          // google_place_id or FanZone.id
  crowd_index: 'Chill' | 'Buzzing' | 'Packed' | 'Wild' | null;
  fan_ratio: string | null;  // e.g. "60/40" — null until check-ins exist
  sound: 'On' | 'Off' | null;
  updated_at: number;        // Unix timestamp ms
};

// ---- Check-in voting model (client-aggregation) — docs/CHECKIN_LLD_DECISIONS.md ----

// Crowd vibe: an ORDINAL scale (Chill < Buzzing < Packed), single-select per user.
export type Vibe = 'Chill' | 'Buzzing' | 'Packed';

// Ordered vibe levels — index is the ordinal value used by the aggregation's weighted mean.
export const VIBE_LEVELS: readonly Vibe[] = ['Chill', 'Buzzing', 'Packed'] as const;

// One check-in vote per user per venue, stored at venues/{venueId}/check_ins/{uid} (snake_case
// = persisted Firestore shape). The doc id IS the uid, so each user has exactly one vote per
// venue (enforced by the path). `vibe` is required; the binaries are OPTIONAL — an unanswered
// big_screen/sound is omitted from the doc entirely (not stored as false), so it never counts
// as a "no" in the aggregation.
export type CheckIn = {
  user_id: string;       // == uid == the doc id
  vibe: Vibe;            // REQUIRED
  big_screen?: boolean;  // OPTIONAL — omitted if the user didn't answer
  sound?: boolean;       // OPTIONAL — omitted if the user didn't answer
  updated_at: number;    // Unix timestamp ms — drives the freshness window + decay
};

// One RSVP per user per venue, stored at venues/{venueId}/rsvps/{uid}. A plain headcount.
export type Rsvp = {
  user_id: string;       // == uid == the doc id
  created_at: number;    // Unix timestamp ms
};

// Client-side aggregation of a venue's check-ins for display. Never persisted (it's the output
// of a pure fn), so camelCase. `null` verdict fields mean the per-metric confidence gate wasn't
// met (too few / too stale answers) — show nothing rather than mislead. Because the binaries are
// optional, each metric has its OWN surviving weight (denominator): a vote that skipped a binary
// counts toward `vibeWeight` but not that binary's weight.
export type CheckinAggregate = {
  vibe: Vibe | null;                 // ordinal weighted-mean → rounded label
  bigScreen: boolean | null;         // weighted majority (bigScreenFraction > 0.5)
  sound: boolean | null;             // weighted majority
  bigScreenFraction: number;         // 0..1, recency-weighted "yes" share among answerers
  soundFraction: number;             // 0..1
  vibeWeight: number;                // total surviving decay weight (all votes have a vibe)
  bigScreenWeight: number;           // surviving weight of votes that answered big_screen
  soundWeight: number;               // surviving weight of votes that answered sound
  count: number;                     // raw votes inside the freshness window
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
