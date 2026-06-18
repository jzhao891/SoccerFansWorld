import sharp from "sharp";
import type { RenderTier } from "@sfw/shared";

// Shared free/hd tier policy, used by every product that renders through the
// compositor (frame shop, fan card). Free = watermarked + downscaled; hd =
// clean + full resolution.

export const FREE_MAX_WIDTH = 640;

// Whether the watermark layer should be drawn for this tier.
export function watermarkVisible(tier: RenderTier): boolean {
  return tier === "free";
}

// Downscale a finished render for the free tier; hd passes through untouched.
export async function applyTierResolution(
  png: Buffer,
  tier: RenderTier,
  sourceWidth: number,
): Promise<Buffer> {
  if (tier === "free" && sourceWidth > FREE_MAX_WIDTH) {
    return sharp(png).resize(FREE_MAX_WIDTH).png().toBuffer();
  }
  return png;
}
