// Remove the white background from player template images, producing
// transparent PNGs. Uses edge flood-fill so white *inside* the jersey is kept.
//
// Usage: node scripts/cutout-players.mjs public/players/nigeria

import sharp from "sharp";
import { readdirSync } from "fs";
import { join } from "path";

const TOL = 48; // colour distance from the sampled corner background that still counts as background
const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node scripts/cutout-players.mjs <dir>");
  process.exit(1);
}

async function cutout(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const visited = new Uint8Array(width * height);
  const stack = [];

  // Seed flood-fill from every edge pixel
  for (let x = 0; x < width; x++) {
    stack.push(x, 0, x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    stack.push(0, y, width - 1, y);
  }

  // Sample the background colour from the four corners
  const corner = (x, y) => (y * width + x) * 4;
  const cs = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
  const bgR = cs.reduce((s, i) => s + data[i], 0) / 4;
  const bgG = cs.reduce((s, i) => s + data[i + 1], 0) / 4;
  const bgB = cs.reduce((s, i) => s + data[i + 2], 0) / 4;
  const isBg = (i) =>
    Math.abs(data[i] - bgR) < TOL && Math.abs(data[i + 1] - bgG) < TOL && Math.abs(data[i + 2] - bgB) < TOL;

  while (stack.length) {
    const y = stack.pop();
    const x = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue; // boundary reached — stop spreading
    data[i + 3] = 0; // make transparent
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(file + ".tmp");

  // Overwrite original
  const { renameSync } = await import("fs");
  renameSync(file + ".tmp", file);
  console.log(`✓ cut ${file}`);
}

const files = readdirSync(dir).filter((f) => f.endsWith(".png"));
for (const f of files) {
  await cutout(join(dir, f));
}
console.log("Done.");
