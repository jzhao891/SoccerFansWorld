import Anthropic from '@anthropic-ai/sdk';
import type { SeedVenue } from '../../scripts/seed-venues';
import { JUDGE_AND_EXTRACT_SYSTEM_PROMPT } from '../prompts/judge-and-extract-prompt';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export type JudgmentEntry = {
  venue_name: string;
  included: boolean;
  reason: string;
};

export type JudgeAndExtractResult = {
  venues: SeedVenue[];
  judgments: JudgmentEntry[];
};

// Claude sometimes prefaces the JSON with a sentence or two of reasoning despite
// being told not to. Slice out the outermost {...} span so a stray preamble/postamble
// doesn't fail the whole parse.
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

export async function judgeAndExtractVenues(
  content: string,
  sourceLabel: string,
): Promise<JudgeAndExtractResult> {
  const response = await getClient().messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8192,
    system: JUDGE_AND_EXTRACT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';

  try {
    const parsed = JSON.parse(extractJsonObject(text));
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray(parsed.venues) ||
      !Array.isArray(parsed.judgments)
    ) {
      throw new Error('Response is not a { venues, judgments } object');
    }
    return { venues: parsed.venues as SeedVenue[], judgments: parsed.judgments as JudgmentEntry[] };
  } catch {
    console.error(`[extract] Failed to parse Claude response for "${sourceLabel}":`);
    console.error(text.slice(0, 500));
    return { venues: [], judgments: [] };
  }
}
