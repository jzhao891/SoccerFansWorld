import type { RenderTier } from "@sfw/shared";

// Fan-card domain types. Shared by the /create front end and the server-side
// card renderer so the two can't drift.

export type FanStats = {
  passion: number;
  energy: number;
  style: number;
  loyalty: number;
  stamina: number;
  crowdImpact: number;
};

export type AiCardResponse = {
  archetype: string;
  stats: FanStats;
  specialAbility: string;
  weakness: string;
  description: string;
};

// Order + short labels used on the card's stat strip.
export const STAT_LABELS: Array<[keyof FanStats, string]> = [
  ["passion", "PAS"],
  ["energy", "ENE"],
  ["style", "STY"],
  ["loyalty", "LOY"],
  ["stamina", "STA"],
  ["crowdImpact", "CRO"],
];

// Everything the server needs to composite a finished fan card.
export type CardRenderRequest = {
  playerImage: string; // face-swap result — data URL or http(s) URL
  name: string;
  team: string;
  city: string;
  overall: number;
  card: AiCardResponse;
  tier: RenderTier;
};
