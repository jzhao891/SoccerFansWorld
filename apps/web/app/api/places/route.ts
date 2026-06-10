import { NextRequest, NextResponse } from 'next/server';
import type { PlaceResult, PlacesRequest, PlacesResponse, PlacesErrorResponse } from '@sfw/shared';

const PLACES_API_BASE = 'https://places.googleapis.com/v1/places:searchNearby';

export async function POST(req: NextRequest): Promise<NextResponse<PlacesResponse | PlacesErrorResponse>> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Places API key not configured' }, { status: 500 });
  }

  const { lat, lng, radiusMeters = 2000 }: PlacesRequest = await req.json();
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const body = {
    includedTypes: ['bar', 'restaurant', 'stadium', 'sports_club'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters,
      },
    },
  };

  const res = await fetch(PLACES_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.location,places.types,places.formattedAddress,places.rating,places.currentOpeningHours',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();

  const places = (data.places ?? []).map((p: Record<string, unknown>) => {
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
    } satisfies PlaceResult;
  });

  return NextResponse.json({ places });
}
