import sharp from "sharp";

// Remove a solid-colour background by flood-filling from the image edges.
// Samples the corner colour as the background reference, so it adapts to grey,
// white, green-screen, etc. Colour *inside* the subject is preserved because
// flood-fill only reaches background connected to the edges.
export async function removeBackground(input: Buffer, tolerance = 48): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, 0, x, height - 1);
  for (let y = 0; y < height; y++) stack.push(0, y, width - 1, y);

  const corner = (x: number, y: number) => (y * width + x) * 4;
  const cs = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
  const bgR = cs.reduce((s, i) => s + data[i], 0) / 4;
  const bgG = cs.reduce((s, i) => s + data[i + 1], 0) / 4;
  const bgB = cs.reduce((s, i) => s + data[i + 2], 0) / 4;
  const isBg = (i: number) =>
    Math.abs(data[i] - bgR) < tolerance &&
    Math.abs(data[i + 1] - bgG) < tolerance &&
    Math.abs(data[i + 2] - bgB) < tolerance;

  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// Apply the alpha (cut-out silhouette) of a template PNG onto another image.
// The face-swap model only changes the face and keeps the body/outline aligned,
// so reusing the template's perfect alpha gives clean edges — identical to the
// original transparent template — without re-cutting the model's output.
export async function applyAlphaFromTemplate(result: Buffer, templatePath: string): Promise<Buffer> {
  const { data: tpl, info } = await sharp(templatePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  // Resize the swap result to the template's exact dimensions, take its RGB
  const { data: res } = await sharp(result)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Composite: RGB from the swap result, alpha from the template
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    out[i] = res[i];
    out[i + 1] = res[i + 1];
    out[i + 2] = res[i + 2];
    out[i + 3] = tpl[i + 3]; // template's alpha silhouette
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
