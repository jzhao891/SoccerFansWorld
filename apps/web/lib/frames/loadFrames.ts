import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";
import type { FrameTemplate, PhotoMask, Rect } from "@sfw/shared";
import { FRAME_TEMPLATES } from "./catalog";

// SERVER-ONLY. Unlike catalog.ts (deliberately pure data, safe for client
// import), this touches the filesystem — never import it from a "use client"
// component. Scans apps/web/public/frames/assets/{general,daily/<date>}/ for
// finalized frame triples (<slug>.png, <slug>-alpha.png, <slug>.json — see
// tools/finalize-frame.mjs) and builds FrameTemplates from them dynamically,
// so adding a frame is "drop the finalized files in," not a catalog.ts edit.

const ASSETS_ROOT = join(process.cwd(), "public", "frames", "assets");

type FrameManifest = {
  name: string;
  cutout: Rect;
  size: { w: number; h: number };
  mask?: PhotoMask;
  price?: number;
};

async function loadFolder(dir: string, publicPrefix: string, idPrefix: string): Promise<FrameTemplate[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return []; // folder doesn't exist yet — no frames from this source, not an error
  }

  const templates: FrameTemplate[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const slug = file.replace(/\.json$/, "");
    const pngFile = `${slug}.png`;
    const alphaFile = `${slug}-alpha.png`;
    const previewFile = `${slug}-preview.webp`;
    if (!files.includes(alphaFile)) continue; // incomplete triple — skip
    const hasPreview = files.includes(previewFile); // older frames pre-date the preview step — fall back to the full alpha

    let manifest: FrameManifest;
    try {
      manifest = JSON.parse(await readFile(join(dir, file), "utf8"));
    } catch {
      continue; // malformed manifest — skip rather than crash the whole picker
    }

    // finalize-frame.mjs overwrites these same filenames in place whenever a
    // frame gets regenerated (e.g. fixing a bad cutout) — same URL, new
    // bytes. Browsers (mobile Safari especially) don't reliably revalidate
    // that against Cache-Control/ETag, so a regenerated frame can keep
    // showing the old image until the user manually clears cache. Stamping
    // the file's mtime onto the URL makes a content change a URL change,
    // which no cache can serve stale.
    //
    // Only alphaFile/previewFile are stat'd here — the plain thumbnail PNG
    // is excluded from the serverless function's traced filesystem (see
    // next.config.ts) since it's a client-only <img> asset never read via
    // fs at runtime; a stat() on it would throw once excluded. finalize-frame.mjs
    // always writes pngFile and alphaFile together, so alphaStat's mtime is
    // an equally valid cache-bust token for both URLs.
    const [alphaStat, previewStat] = await Promise.all([
      stat(join(dir, alphaFile)),
      hasPreview ? stat(join(dir, previewFile)) : Promise.resolve(null),
    ]);

    templates.push({
      id: `${idPrefix}-${slug}`,
      name: manifest.name,
      size: manifest.size,
      thumbnail: `${publicPrefix}/${pngFile}?v=${alphaStat.mtimeMs}`,
      price: manifest.price ?? 499,
      dimensions: [],
      inputs: [],
      layers: [
        // Sized close to the true hole (not the full canvas — tried that,
        // it made object-fit:cover zoom in far more than intended, since it
        // scales to the WHOLE canvas first and only the small hole shows
        // through). The overlay's alpha (a more generous flood fill than
        // this rect) still correctly reveals any small protrusion past this
        // box — that just won't have camera content behind it, a minor
        // localized gap rather than a global over-zoom.
        { type: "photo", rect: manifest.cutout, fit: "cover", mask: manifest.mask ?? "none" },
        {
          type: "overlay",
          src: `${publicPrefix}/${alphaFile}?v=${alphaStat.mtimeMs}`,
          // Live camera preview only ever renders this at a few hundred px —
          // point it at the small WebP instead of the multi-MB full-res PNG.
          // `src` (full res) is still what the server composites the final
          // photo from, so output quality is unaffected.
          previewSrc: previewStat ? `${publicPrefix}/${previewFile}?v=${previewStat.mtimeMs}` : undefined,
          rect: { x: 0, y: 0, w: manifest.size.w, h: manifest.size.h },
          fit: "fill",
        },
        { type: "watermark" },
      ],
    });
  }
  return templates;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Today's limited-edition (per-match) frames first, then evergreen ones.
export async function getDynamicFrameTemplates(): Promise<FrameTemplate[]> {
  const today = todayDate();
  const [daily, general] = await Promise.all([
    loadFolder(join(ASSETS_ROOT, "daily", today), `/frames/assets/daily/${today}`, "daily"),
    loadFolder(join(ASSETS_ROOT, "general"), "/frames/assets/general", "general"),
  ]);
  return [...daily, ...general];
}

// All templates a customer can pick from: today's limited-edition frames,
// evergreen illustrated frames, and the static parametric ones from catalog.ts.
export async function getAllFrameTemplates(): Promise<FrameTemplate[]> {
  return [...(await getDynamicFrameTemplates()), ...FRAME_TEMPLATES];
}

export async function getFrameTemplate(id: string): Promise<FrameTemplate | undefined> {
  return (await getAllFrameTemplates()).find((t) => t.id === id);
}
