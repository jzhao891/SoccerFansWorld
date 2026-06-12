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
    inputs: [
      { id: "city", label: "City", placeholder: "Seattle", maxLength: 20 },
      { id: "score", label: "Scoreline", placeholder: "2 - 1", maxLength: 12 },
    ],
    layers: [
      // Background stadium (customer picks day/night)
      { type: "asset", source: "stadium", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "cover" },
      // Weather atmosphere over the backdrop (optional)
      { type: "asset", source: "weather", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "cover" },
      // The customer's photo, in a rounded window
      { type: "photo", rect: { x: 140, y: 250, w: 800, h: 800 }, fit: "cover", mask: "rounded" },
      // Static decorative frame border (template-owned)
      { type: "overlay", src: "/frames/assets/border-classic.svg", rect: { x: 0, y: 0, w: 1080, h: 1350 }, fit: "fill" },
      // City line
      {
        type: "text",
        bind: { kind: "input", field: "city" },
        rect: { x: 90, y: 1110, w: 900, h: 96 },
        style: { fontFamily: "Arial, sans-serif", fontSize: 66, color: "#ffffff", weight: 800, align: "center", uppercase: true, letterSpacing: 4 },
      },
      // Scoreline
      {
        type: "text",
        bind: { kind: "input", field: "score" },
        rect: { x: 90, y: 1208, w: 900, h: 72 },
        style: { fontFamily: "Arial, sans-serif", fontSize: 46, color: "#7CF6C9", weight: 700, align: "center", letterSpacing: 2 },
      },
      // Free-tier watermark (skipped on hd by the renderer)
      { type: "watermark" },
    ],
  },
];

export function getTemplate(id: string): FrameTemplate | undefined {
  return FRAME_TEMPLATES.find((t) => t.id === id);
}
