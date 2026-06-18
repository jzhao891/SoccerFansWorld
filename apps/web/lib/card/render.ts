import { readFile } from "fs/promises";
import { join } from "path";
import { composite, type CompositeLayer } from "../compose/compositor";
import { watermarkSvg } from "../compose/watermark";
import { applyTierResolution, watermarkVisible } from "../compose/tier";
import { backdropSvg, chromeSvg, CARD_SIZE } from "./chrome";
import type { CardRenderRequest } from "./types";

// Server-only fan-card renderer. Composites stadium → backdrop → player →
// chrome → watermark through the shared compose engine, then applies the shared
// free/hd tier policy. This replaces the old client-side html-to-image export.

const PUBLIC_DIR = join(process.cwd(), "public");

// Player image fills the upper-middle of the card, above the stat strip.
const PLAYER_RECT = { x: 0, y: 150, w: CARD_SIZE.w, h: 1060 };

// Face-swap results may be a data URL or a remote (HuggingFace) URL.
async function loadImageRef(ref: string): Promise<Buffer> {
  if (ref.startsWith("data:")) {
    return Buffer.from(ref.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`Failed to fetch player image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function renderCard(req: CardRenderRequest): Promise<Buffer> {
  if (!req.playerImage) throw new Error("Missing player image");

  const layers: CompositeLayer[] = [
    { input: await readFile(join(PUBLIC_DIR, "stadium-bg.jpg")), rect: { x: 0, y: 0, ...CARD_SIZE }, fit: "cover" },
    { input: backdropSvg(), rect: { x: 0, y: 0, ...CARD_SIZE }, fit: "fill" },
    { input: await loadImageRef(req.playerImage), rect: PLAYER_RECT, fit: "contain" },
    { input: chromeSvg(req.card, req.name, req.team, req.city, req.overall), rect: { x: 0, y: 0, ...CARD_SIZE }, fit: "fill" },
  ];

  if (watermarkVisible(req.tier)) {
    layers.push({ input: watermarkSvg(CARD_SIZE), rect: { x: 0, y: 0, ...CARD_SIZE }, fit: "fill" });
  }

  const out = await composite(CARD_SIZE, layers);
  return applyTierResolution(out, req.tier, CARD_SIZE.w);
}
