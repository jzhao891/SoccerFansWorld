import type { AssetDefinition, AssetDimension, FrameTemplate } from "@sfw/shared";

// Pure data — no fs, no sharp, no React. Safe to import from BOTH the server
// render path and the client /frames UI (the picker needs labels + thumbnails).
// Adding a frame or artwork = editing this file + dropping assets in
// /public/frames/assets; no rendering code changes.

export const ASSET_REGISTRY: AssetDefinition[] = [
  {
    id: "stadium-day",
    dimension: "stadium",
    value: "day",
    label: "Daytime",
    src: "/frames/assets/stadium-day.svg",
    thumbnail: "/frames/assets/stadium-day.svg",
  },
  {
    id: "stadium-night",
    dimension: "stadium",
    value: "night",
    label: "Night",
    src: "/frames/assets/stadium-night.svg",
    thumbnail: "/frames/assets/stadium-night.svg",
  },
  {
    id: "weather-clear",
    dimension: "weather",
    value: "clear",
    label: "Clear",
    src: "/frames/assets/weather-clear.svg",
    thumbnail: "/frames/assets/weather-clear.svg",
  },
  {
    id: "weather-rain",
    dimension: "weather",
    value: "rain",
    label: "Rainy",
    src: "/frames/assets/weather-rain.svg",
    thumbnail: "/frames/assets/weather-rain.svg",
  },
];

export function assetsForDimension(dimension: AssetDimension): AssetDefinition[] {
  return ASSET_REGISTRY.filter((a) => a.dimension === dimension);
}

export function resolveAssetSrc(
  dimension: AssetDimension,
  value: string | undefined,
): string | null {
  if (!value) return null;
  return (
    ASSET_REGISTRY.find((a) => a.dimension === dimension && a.value === value)?.src ??
    null
  );
}

const CANVAS = { w: 1080, h: 1350 };

export const FRAME_TEMPLATES: FrameTemplate[] = [
  {
    id: "matchday-classic",
    name: "Matchday Classic",
    size: CANVAS,
    thumbnail: "/frames/assets/thumb-matchday.svg",
    price: 499,
    dimensions: [
      { dimension: "stadium", required: true },
      { dimension: "weather", required: false },
    ],
    // No text inputs — the studio UI has no field to fill "city"/"score"
    // (that picker was removed along with the scene picker), so a
    // TextInputField with nothing to drive it just clutters the template.
    inputs: [],
    layers: [
      // Background stadium (customer picks day/night)
      { type: "asset", source: "stadium", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "cover" },
      // Weather atmosphere over the backdrop (optional)
      { type: "asset", source: "weather", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "cover" },
      // The customer's photo, in a rounded window
      { type: "photo", rect: { x: 140, y: 250, w: 800, h: 800 }, fit: "cover", mask: "rounded" },
      // Static decorative frame border (template-owned)
      { type: "overlay", src: "/frames/assets/border-classic.svg", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "fill" },
      // Free-tier watermark (skipped on hd by the renderer)
      { type: "watermark" },
    ],
  },
  // Illustrated (generated-art) frames are NOT hardcoded here — they're
  // scanned dynamically from public/frames/assets/{general,daily/<date>}/
  // by lib/frames/loadFrames.ts (server-only). This array stays reserved for
  // parametric templates like the one above (swappable backgrounds/text),
  // which a directory of flat PNGs can't express. See tools/finalize-frame.mjs
  // for how an illustrated frame gets added.
];

export function getTemplate(id: string): FrameTemplate | undefined {
  return FRAME_TEMPLATES.find((t) => t.id === id);
}
