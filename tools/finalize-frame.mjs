// Post-processes a freshly-generated frame PNG (the transparent-cutout style
// used by every prompt in frame-prompts.md) into the format the app's dynamic
// frame catalog actually reads:
//   <name>.png        — original art, used as the picker thumbnail
//   <name>-alpha.png  — same art with a REAL alpha-channel cutout punched in
//                       (generated PNGs come back with a solid near-white
//                       center, not real transparency — see daily-assets/
//                       discussion for why)
//   <name>.json        — sidecar manifest: display name, cutout rect, canvas size
//
// Written into apps/web/public/frames/assets/general/ or
// apps/web/public/frames/assets/daily/<date>/ — the app's frame picker scans
// those folders directly, so dropping a finalized triple in is all that's
// needed to make a frame selectable. No catalog.ts edits required.
//
// Usage:
//   node tools/finalize-frame.mjs --in raw-frame.png --name "Boston:France" \
//        --category general
//   node tools/finalize-frame.mjs --in raw-frame.png --name "Boston:France" \
//        --category daily --date 2026-07-09

import sharp from "sharp";
import { writeFileSync, mkdirSync, copyFileSync, existsSync, renameSync } from "fs";
import { join, basename, extname, resolve } from "path";
import { parseArgs } from "./_env.mjs";

const a = parseArgs(process.argv.slice(2));
if (!a.in || !a.name || !a.category) {
  console.error('Usage: node tools/finalize-frame.mjs --in <raw.png> --name "<Display Name>" --category general|daily [--date YYYY-MM-DD]');
  process.exit(1);
}
if (!["general", "daily"].includes(a.category)) {
  console.error('ERROR: --category must be "general" or "daily"');
  process.exit(1);
}
if (a.category === "daily" && !a.date) {
  console.error("ERROR: --category daily requires --date YYYY-MM-DD");
  process.exit(1);
}

const slug = a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const outDir = join(
  "apps/web/public/frames/assets",
  a.category === "daily" ? `daily/${a.date}` : "general",
);
mkdirSync(outDir, { recursive: true });

// Threshold loose enough to tolerate compression noise in the generated
// cutout (seen as low as ~242/255 on some outputs), while still well above
// any legitimate saturated border-art color.
//
// Some generated cutouts come back rendering the "this is transparent"
// checkerboard as literal pixels (alternating ~255 and ~204 neutral gray)
// instead of a solid white fill — the >230 rule alone chops that up into a
// grid of tiny disconnected "white" specks and the cutout never gets
// detected. The second clause catches that: a low-saturation (R≈G≈B) gray
// that's still reasonably light is either checkerboard square, never a
// legitimate border-art color (those are all clearly saturated blue/red/gold).
function isWhite(data, idx) {
  const r = data[idx], g = data[idx + 1], b = data[idx + 2];
  if (r > 230 && g > 230 && b > 230) return true;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return min >= 180 && max - min <= 12;
}

// The alpha mask (what's actually punched transparent) and the "cutout" rect
// (where the photo/camera gets positioned) are solved separately now:
//
// - Mask: bounded flood fill. A center-cross scan gives a rough rect (can't
//   leak, it only ever looks along two straight lines); flood fill from the
//   center then fills in the TRUE irregular shape (a trophy or sign poking
//   past that rough rect stays opaque instead of getting blanket-erased) but
//   is forbidden from stepping outside a small fixed-pixel pad around the
//   rough rect — enough slack for a protrusion, not enough to leak hundreds
//   of px away into unrelated white art (an eagle, a jersey) like unbounded
//   flood fill did.
// - Cutout rect: the FULL canvas, not a tight-fitting box. The photo/camera
//   only ever needs to fully cover whatever the overlay's real alpha reveals
//   — since the overlay is drawn on top and does the actual masking, a
//   generously large rect underneath is exactly as correct as a precise one.
//
//   CORRECTION: tried making that rect the full canvas — technically still
//   correct (overlay alpha still masks it right), but object-fit:cover scales
//   the photo/video to fill the FULL canvas first and only THEN shows the
//   small central hole's worth of that already-scaled image, compounding
//   into a much more zoomed-in crop than intended (confirmed live: went from
//   "fits a group" to "barely fits one person"). So the rect DOES need to be
//   close to the true hole's actual size after all — it's not just a masking
//   concern, it controls how much of the photo/camera is visible at all.
const LEAK_GUARD_PAD_PX = 30;

async function findCutout(inputPath) {
  const { data, info } = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const at = (x, y) => (y * width + x) * channels;
  if (!isWhite(data, at(cx, cy))) {
    throw new Error(
      `Center pixel at (${cx},${cy}) isn't near-white (got rgb ${data[at(cx, cy)]},${data[at(cx, cy) + 1]},${data[at(cx, cy) + 2]}) — ` +
        `can't auto-detect the cutout. Does this frame actually have a transparent-cutout center?`,
    );
  }

  // Rough box — used only to seed the flood-fill's bounds below. A single
  // center-row/center-column cross scan is only as good as whatever border
  // art happens to sit exactly on those two lines: a flag poking in at one
  // particular height, for instance, understates the real hole on that one
  // line even though every OTHER nearby line reaches much further. Take
  // several parallel lines spanning the middle 60% of the shape and use the
  // widest reach found on any of them — each line is still only as far as
  // real non-white pixels allow (same trust level as a single cross scan),
  // just no longer at the mercy of whichever one line happens to be sampled.
  let left = cx, right = cx, top = cy, bottom = cy;
  for (const f of [-0.3, -0.15, 0, 0.15, 0.3]) {
    const y = Math.max(0, Math.min(height - 1, Math.round(cy + f * height)));
    if (isWhite(data, at(cx, y))) {
      let l = cx; while (l > 0 && isWhite(data, at(l - 1, y))) l--;
      let r = cx; while (r < width - 1 && isWhite(data, at(r + 1, y))) r++;
      left = Math.min(left, l);
      right = Math.max(right, r);
    }
    const x = Math.max(0, Math.min(width - 1, Math.round(cx + f * width)));
    if (isWhite(data, at(x, cy))) {
      let t = cy; while (t > 0 && isWhite(data, at(x, t - 1))) t--;
      let b = cy; while (b < height - 1 && isWhite(data, at(x, b + 1))) b++;
      top = Math.min(top, t);
      bottom = Math.max(bottom, b);
    }
  }

  const bounds = {
    minX: Math.max(0, left - LEAK_GUARD_PAD_PX), maxX: Math.min(width - 1, right + LEAK_GUARD_PAD_PX),
    minY: Math.max(0, top - LEAK_GUARD_PAD_PX), maxY: Math.min(height - 1, bottom + LEAK_GUARD_PAD_PX),
  };

  // The mask (for alpha) is allowed to extend past the rough cross-scan rect
  // within the pad — that's deliberate, it's how a trophy tip etc. still
  // renders opaque instead of getting blanket-erased.
  const mask = new Uint8Array(width * height);
  const stack = [cy * width + cx];
  mask[cy * width + cx] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % width, y = (p / width) | 0;
    if (x > bounds.minX && !mask[p - 1] && isWhite(data, at(x - 1, y))) { mask[p - 1] = 1; stack.push(p - 1); }
    if (x < bounds.maxX && !mask[p + 1] && isWhite(data, at(x + 1, y))) { mask[p + 1] = 1; stack.push(p + 1); }
    if (y > bounds.minY && !mask[p - width] && isWhite(data, at(x, y - 1))) { mask[p - width] = 1; stack.push(p - width); }
    if (y < bounds.maxY && !mask[p + width] && isWhite(data, at(x, y + 1))) { mask[p + width] = 1; stack.push(p + width); }
  }

  // The cutout IS the (multi-line) rough box — not the largest rectangle
  // inscribed in `mask`. That was tried: it's guaranteed to never overhang
  // past the true hole, but "guaranteed" comes from being conservative, and
  // area-maximizing doesn't necessarily pick the tall/narrow shape a photo
  // wants — it visibly shrinks the camera box on every frame, not just the
  // one with the asymmetric protrusion (confirmed live, reverted). The
  // multi-line rough box already fixes the original problem (one bad
  // row/column no longer defines the whole rect) without that cost.
  const cutout = { x: left, y: top, w: right - left, h: bottom - top };

  return { width, height, channels, mask, cutout };
}

// macOS's default filesystem is case-insensitive but case-preserving: if
// `--in` is e.g. "USA.png" and the slug wants "usa.png", those resolve to
// the SAME dirent. A plain copyFileSync there silently no-ops the rename —
// the file stays on disk as "USA.png", and loadFrames.ts's exact-string
// `files.includes("usa.png")` check then skips the whole triple as
// "incomplete," so the frame never shows up in the picker with no error
// anywhere. Force the case through a temp-name rename in that situation;
// fall back to a normal copy everywhere else (different file, or a
// same-case idempotent re-run).
function copyToSlugPath(src, dest) {
  const srcResolved = resolve(src);
  const destResolved = resolve(dest);
  if (srcResolved === destResolved) return; // already the right file, right case
  if (srcResolved.toLowerCase() === destResolved.toLowerCase()) {
    const tmp = destResolved + ".case-fix-tmp";
    renameSync(srcResolved, tmp);
    renameSync(tmp, destResolved);
    return;
  }
  copyFileSync(src, dest);
}

// The live camera preview (FrameStudioClient) only ever shows this overlay at
// a few hundred px — no reason to make it download the same multi-MB,
// full-canvas-resolution PNG the server uses for the final composite. This
// caps the longest edge and re-encodes to WebP, which both shrinks pixel
// count and gets much better compression than PNG for this kind of art.
const PREVIEW_MAX_DIM = 900;

async function writeAlphaVersion(inputPath, outPath, { width, height, channels, mask }) {
  const buf = channels === 4
    ? await sharp(inputPath).raw().toBuffer()
    : await sharp(inputPath).ensureAlpha().raw().toBuffer();
  for (let i = 0; i < width * height; i++) {
    if (mask[i]) buf[i * 4 + 3] = 0;
  }
  await sharp(buf, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
  return buf;
}

async function writePreviewVersion(rawMaskedBuf, outPath, { width, height }) {
  await sharp(rawMaskedBuf, { raw: { width, height, channels: 4 } })
    .resize({ width: PREVIEW_MAX_DIM, height: PREVIEW_MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(outPath);
}

const { width, height, channels, mask, cutout } = await findCutout(a.in);

const pngOut = join(outDir, `${slug}.png`);
const alphaOut = join(outDir, `${slug}-alpha.png`);
const previewOut = join(outDir, `${slug}-preview.webp`);
const jsonOut = join(outDir, `${slug}.json`);

copyToSlugPath(a.in, pngOut);
const rawMaskedBuf = await writeAlphaVersion(a.in, alphaOut, { width, height, channels, mask });
await writePreviewVersion(rawMaskedBuf, previewOut, { width, height });
writeFileSync(
  jsonOut,
  JSON.stringify({ name: a.name, cutout, size: { w: width, h: height }, mask: "none", price: 499 }, null, 2) + "\n",
);

console.log(`✓ ${pngOut}`);
console.log(`✓ ${alphaOut}`);
console.log(`✓ ${previewOut}`);
console.log(`✓ ${jsonOut}`);
console.log(`  cutout: x=${cutout.x} y=${cutout.y} w=${cutout.w} h=${cutout.h} (canvas ${width}x${height})`);
