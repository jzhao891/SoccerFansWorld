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

  // Rough box, stage 1 — a handful of sample lines (5 parallel rows/columns
  // spanning the middle 60%). Deliberately sparse: reliable across every
  // frame processed so far specifically BECAUSE it doesn't chase a single
  // stray column/row very far — a lone column that happens to run "white"
  // in an unbroken line from the hole straight through a light-colored
  // decoration well above it (an obelisk, a cloud) would otherwise drag the
  // box out to wherever that line ends, even the canvas edge (confirmed
  // live on the Argentina frame's obelisk, and on Mexico's stadium banner).
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

  // Rough box, stage 2 — now that `left/top/right/bottom` is a trustworthy
  // approximation, densely scan EVERY row/column instead of just 5 to catch
  // genuinely jagged spikes (paint-splatter collision graphics, confetti)
  // that the sparse sample missed by passing through the gaps between them.
  // The walk is capped at a fixed distance beyond the stage-1 box, not a
  // fraction of the canvas — real spikes are a short reach past an already-
  // located hole (tens of px), whereas the false bridges stage 1 avoids are
  // hundreds of px away. Scaling the cap with the stage-1 box size keeps it
  // meaningful on both small and large source images.
  const SPIKE_MARGIN = Math.round(0.03 * Math.min(width, height));
  const spikeMinX = Math.max(0, left - SPIKE_MARGIN), spikeMaxX = Math.min(width - 1, right + SPIKE_MARGIN);
  const spikeMinY = Math.max(0, top - SPIKE_MARGIN), spikeMaxY = Math.min(height - 1, bottom + SPIKE_MARGIN);
  for (let y = spikeMinY; y <= spikeMaxY; y++) {
    if (!isWhite(data, at(cx, y))) continue;
    let l = cx; while (l > spikeMinX && isWhite(data, at(l - 1, y))) l--;
    let r = cx; while (r < spikeMaxX && isWhite(data, at(r + 1, y))) r++;
    left = Math.min(left, l);
    right = Math.max(right, r);
  }
  for (let x = spikeMinX; x <= spikeMaxX; x++) {
    if (!isWhite(data, at(x, cy))) continue;
    let t = cy; while (t > spikeMinY && isWhite(data, at(x, t - 1))) t--;
    let b = cy; while (b < spikeMaxY && isWhite(data, at(x, b + 1))) b++;
    top = Math.min(top, t);
    bottom = Math.max(bottom, b);
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

  // The cutout is the bounding box OF `mask` — not the multi-line rough box,
  // and not the largest rectangle INSCRIBED in `mask` (tried before: that's
  // guaranteed to never overhang, but shrinks the camera box on every frame,
  // not just the one with an asymmetric protrusion — confirmed live,
  // reverted).
  //
  // Some border art (paint-splatter collision graphics, confetti) has a
  // genuinely jagged hole boundary — thin transparent spikes reaching well
  // past what any handful of sampled scan lines will catch, since each spike
  // is only a few pixels wide and most sample lines pass through the gaps
  // between them. The rough box then undershoots the true opening, and the
  // photo rect (a plain filled rectangle) doesn't reach far enough to back
  // every spike the overlay's alpha reveals — the gap shows through as black.
  //
  // `mask` itself has none of that blind-spot problem (it's a real flood
  // fill, not a sparse sample), so its bounding box is guaranteed to envelop
  // every spike. It can extend into pixels that are still opaque art rather
  // than true hole — harmless, since the overlay draws on top and hides
  // whatever the photo shows there. And since mask ⊇ the rough box by
  // construction (the rough box's own pixels seeded the flood fill), this is
  // always ≥ the old rect, never smaller — no risk of the inscribed-rectangle
  // regression.
  let maskMinX = width, maskMaxX = -1, maskMinY = height, maskMaxY = -1;
  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      if (!mask[y * width + x]) continue;
      if (x < maskMinX) maskMinX = x;
      if (x > maskMaxX) maskMaxX = x;
      if (y < maskMinY) maskMinY = y;
      if (y > maskMaxY) maskMaxY = y;
    }
  }
  const cutout = { x: maskMinX, y: maskMinY, w: maskMaxX - maskMinX, h: maskMaxY - maskMinY };

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
