import sharp from "sharp";
import type { ImageFit, PhotoMask, Rect } from "@sfw/shared";

// Generic, product-agnostic layer-stack renderer. Knows nothing about frames,
// fan cards, assets, or tiers — it just draws positioned images onto a canvas
// and returns a PNG. Both the frame shop and (later) the fan card can feed it.

// One resolved layer: actual image bytes plus where/how to place them. The
// orchestrator turns template layers + customer input into these.
export type CompositeLayer = {
  input: Buffer;      // png / jpg / svg bytes
  rect: Rect;
  fit: ImageFit;
  mask?: PhotoMask;   // optional clip applied after resize (e.g. circle photo)
};

const FIT_MAP: Record<ImageFit, keyof sharp.FitEnum> = {
  cover: "cover",
  contain: "contain",
  fill: "fill",
};

function maskSvg(mask: Exclude<PhotoMask, "none">, w: number, h: number): Buffer {
  if (mask === "circle") {
    return Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
        `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#fff"/></svg>`,
    );
  }
  const r = Math.min(w, h) * 0.08;
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
}

async function prepareLayer(layer: CompositeLayer): Promise<sharp.OverlayOptions> {
  const { rect, fit, mask } = layer;
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);

  let buf = await sharp(layer.input)
    .resize(w, h, { fit: FIT_MAP[fit] })
    .png()
    .toBuffer();

  if (mask && mask !== "none") {
    buf = await sharp(buf)
      .composite([{ input: maskSvg(mask, w, h), blend: "dest-in" }])
      .png()
      .toBuffer();
  }

  return { input: buf, left: Math.round(rect.x), top: Math.round(rect.y) };
}

// Draw layers in array order (first = bottom) onto a transparent canvas.
export async function composite(
  size: { w: number; h: number },
  layers: CompositeLayer[],
): Promise<Buffer> {
  const overlays = await Promise.all(layers.map(prepareLayer));
  return sharp({
    create: {
      width: size.w,
      height: size.h,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();
}
