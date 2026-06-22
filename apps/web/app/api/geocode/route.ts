import { NextRequest, NextResponse } from 'next/server';

// Reverse geocoding: lat/lng -> human-readable address.
// Runs server-side so the API key never reaches the client.
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode/json';

function coordFallback(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse<{ address: string } | { error: string }>> {
  const { lat, lng } = await req.json();
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // No key (or mock mode) — return a coordinate string so the flow still works in dev.
  if (!apiKey || process.env.MOCK_PLACES === 'true') {
    return NextResponse.json({ address: coordFallback(lat, lng) });
  }

  try {
    const url = `${GEOCODE_BASE}?latlng=${lat},${lng}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; results?: { formatted_address: string }[] };

    if (data.status !== 'OK' || !data.results?.length) {
      // e.g. ZERO_RESULTS, or Geocoding API not enabled on the key — degrade gracefully
      return NextResponse.json({ address: coordFallback(lat, lng) });
    }
    return NextResponse.json({ address: data.results[0].formatted_address });
  } catch {
    return NextResponse.json({ address: coordFallback(lat, lng) });
  }
}
