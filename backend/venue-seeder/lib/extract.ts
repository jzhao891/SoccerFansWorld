import Anthropic from '@anthropic-ai/sdk';
import type { SeedVenue } from '../../scripts/seed-venues';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

const SYSTEM_PROMPT = `You are building entries for a venues.json file used to seed a FIFA World Cup 2026 fan zone app.

OUTPUT FORMAT
Return only valid JSON — no markdown, no explanation. The output must be an array of venue objects.

SCHEMA
Each venue object:
{
  "venue_name": string,           // Display name of this sub-venue or section
  "venue_search_query": string,   // Search query to find it on Google Maps (include city + address for precision)
  "events": [ ...SeedEvent ]
}

Each SeedEvent object:
{
  "event_title": string,          // Descriptive title, e.g. "Belgium vs. Egypt" or "Round of 32 – Match 81: ..."
  "start_time": string,           // ISO 8601 with offset, e.g. "2026-06-15T14:30:00-07:00" (Seattle = -07:00 in summer)
  "end_time": string,             // Optional. ISO 8601 with offset.
  "watching_teams": string[],     // Optional. Must be exact FIFA World Cup 2026 team names or "TBD" for knockout rounds. Omit if not a match screening.
  "admission": "free" | "paid",
  "amenities": string[],          // e.g. ["big screen", "beer garden", "food trucks"]
  "description": string,          // Optional. Promotional text for the event.
  "organizers": string[],         // Optional. Organizer name(s).
  "url": string,                  // Optional. Direct link to event page (not venue homepage).
  "is_active": true,
  "skip_dedupe_check": true       // Include ONLY if this sub-venue shares a Google Place ID with another venue in the file AND has the same start_time + watching_teams.
}

RULES
1. TEAM NAMES: Use only exact FIFA World Cup 2026 participant names. Common ones: Algeria, Argentina, Australia, Austria, Belgium, Bolivia, Bosnia and Herzegovina, Brazil, Cameroon, Canada, Cape Verde, Chile, Colombia, Costa Rica, Croatia, Czechia, DR Congo, Denmark, Ecuador, Egypt, England, France, Germany, Ghana, Haiti, Honduras, Hungary, Indonesia, Iran, Iraq, Israel, Japan, Jordan, Kenya, Mexico, Morocco, Netherlands, New Zealand, Nigeria, Norway, Panama, Paraguay, Peru, Portugal, Qatar, Saudi Arabia, Scotland, Senegal, South Africa, South Korea, Spain, Sweden, Switzerland, Türkiye, Tunisia, Ukraine, Uruguay, USA, Uzbekistan, Venezuela, Curaçao. Use "TBD" for knockout round matches where teams are not yet known.
2. TIMES: Infer the UTC offset from the city/venue location. Seattle/Pacific summer = -07:00, New York/Eastern summer = -04:00, Dallas/Central summer = -05:00, etc.
3. MULTIPLE SUB-VENUES: If one physical location has distinct ticketed areas (e.g. an indoor hall vs. an outdoor barge), create a separate venue object for each with a descriptive venue_name.
4. skip_dedupe_check: Add this field (value: true) when a sub-venue shares a physical location and has events at the same time with the same teams as another venue object in this file.
5. AMENITIES: Extract from the event description. Keep values short and consistent (e.g. "food trucks" not "various food trucks").
6. MISSING DATA: If a field is unknown, omit it entirely (do not use null or empty string).
7. If no watch-party or fan-zone events are found in the content, return [].`;

export async function extractVenues(
  content: string,
  sourceLabel: string,
): Promise<SeedVenue[]> {
  const response = await getClient().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');
    return parsed as SeedVenue[];
  } catch {
    console.error(`[extract] Failed to parse Claude response for "${sourceLabel}":`);
    console.error(text.slice(0, 500));
    return [];
  }
}
