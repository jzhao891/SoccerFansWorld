import { readFile } from "fs/promises";
import { join } from "path";
import type { FrameRenderRequest, FrameTemplate, TemplateLayer } from "@sfw/shared";
import { composite, type CompositeLayer } from "../compose/compositor";
import { watermarkSvg } from "../compose/watermark";
import { textSvg } from "../compose/text";
import { applyTierResolution, watermarkVisible } from "../compose/tier";
import { getTemplate, resolveAssetSrc } from "./catalog";

// Server-only orchestrator: turns a FrameRenderRequest into a finished PNG by
// resolving each template layer against the request (selected assets, uploaded
// photo, text inputs) and feeding the result to the generic compositor. The
// free/hd tier policy is the shared one in compose/tier.

const PUBLIC_DIR = join(process.cwd(), "public");

async function readPublic(src: string): Promise<Buffer> {
  return readFile(join(PUBLIC_DIR, src.replace(/^\/+/, "")));
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64, "base64");
}

async function toCompositeLayer(
  layer: TemplateLayer,
  template: FrameTemplate,
  req: FrameRenderRequest,
): Promise<CompositeLayer | null> {
  switch (layer.type) {
    case "asset": {
      const src = resolveAssetSrc(layer.source, req.selection[layer.source]);
      if (!src) return null; // unselected/optional dimension → skip
      return { input: await readPublic(src), rect: layer.rect, fit: layer.fit };
    }
    case "overlay":
      return { input: await readPublic(layer.src), rect: layer.rect, fit: layer.fit };
    case "photo":
      return {
        input: dataUrlToBuffer(req.photoDataUrl),
        rect: layer.rect,
        fit: layer.fit,
        mask: layer.mask,
      };
    case "text": {
      const value =
        layer.bind.kind === "static"
          ? layer.bind.value
          : (req.inputs[layer.bind.field] ?? "").trim();
      if (!value) return null;
      return { input: textSvg(value, layer.rect, layer.style), rect: layer.rect, fit: "fill" };
    }
    case "watermark": {
      if (!watermarkVisible(req.tier)) return null;
      return {
        input: watermarkSvg(template.size),
        rect: { x: 0, y: 0, w: template.size.w, h: template.size.h },
        fit: "fill",
      };
    }
  }
}

export async function renderFrame(req: FrameRenderRequest): Promise<Buffer> {
  const template = getTemplate(req.templateId);
  if (!template) throw new Error(`Unknown template: ${req.templateId}`);
  if (!req.photoDataUrl) throw new Error("Missing photo");

  const resolved = await Promise.all(
    template.layers.map((layer) => toCompositeLayer(layer, template, req)),
  );
  const layers = resolved.filter((l): l is CompositeLayer => l !== null);

  const out = await composite(template.size, layers);
  return applyTierResolution(out, req.tier, template.size.w);
}
