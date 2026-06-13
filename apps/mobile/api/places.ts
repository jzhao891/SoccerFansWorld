import type { PlaceResult } from '@sfw/shared';

const PLACES_API_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK_PLACES === 'true';

const MOCK_PLACES: PlaceResult[] = [
  {
    place_id: 'mock-lumen-field',
    name: 'Lumen Field',
    location: { lat: 47.5952, lng: -122.3316 },
    types: ['stadium'],
    vicinity: '800 Occidental Ave S, Seattle, WA',
    rating: 4.7,
    open_now: true,
  },
  {
    place_id: 'mock-climate-pledge',
    name: 'Climate Pledge Arena',
    location: { lat: 47.6218, lng: -122.3542 },
    types: ['stadium'],
    vicinity: '334 1st Ave N, Seattle, WA',
    rating: 4.6,
    open_now: true,
  },
  {
    place_id: 'mock-pike-pub',
    name: 'Pike Pub & Brewery',
    location: { lat: 47.6089, lng: -122.3402 },
    types: ['bar', 'restaurant'],
    vicinity: '1415 1st Ave, Seattle, WA',
    rating: 4.2,
    open_now: true,
  },
  {
    place_id: 'mock-pyramid-ale',
    name: 'Pyramid Alehouse',
    location: { lat: 47.5958, lng: -122.3308 },
    types: ['bar', 'restaurant'],
    vicinity: '1201 1st Ave S, Seattle, WA',
    rating: 4.1,
    open_now: true,
  },
  {
    place_id: 'mock-chipper',
    name: 'The Chipper Truck Cafe',
    location: { lat: 47.6062, lng: -122.3321 },
    types: ['restaurant'],
    vicinity: 'Downtown Seattle, WA',
    rating: 4.3,
    open_now: false,
  },
];

export async function searchNearby(lat: number, lng: number, radiusMeters = 2000): Promise<PlaceResult[]> {
  if (USE_MOCK) return MOCK_PLACES;
  const res = await fetch(PLACES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.location,places.types,places.formattedAddress,places.rating,places.currentOpeningHours',
    },
    body: JSON.stringify({
      includedTypes: ['bar', 'restaurant', 'stadium', 'sports_club'],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  return (data.places ?? []).map((p: Record<string, unknown>): PlaceResult => {
    const loc = p.location as { latitude: number; longitude: number } | undefined;
    const display = p.displayName as { text?: string } | undefined;
    return {
      place_id: p.id as string,
      name: display?.text ?? '',
      location: { lat: loc?.latitude ?? 0, lng: loc?.longitude ?? 0 },
      types: (p.types as string[]) ?? [],
      vicinity: p.formattedAddress as string | undefined,
      rating: p.rating as number | undefined,
      open_now: (p.currentOpeningHours as { openNow?: boolean } | undefined)?.openNow,
    };
  });
}
