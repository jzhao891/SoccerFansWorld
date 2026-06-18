// Server-side watermark — the diagonal tiled "SoccerFansWorld" mark baked into
// free-tier renders. This is the backend equivalent of the DOM watermark the
// fan card draws client-side (apps/web/app/create/page.tsx), but here it's
// burned into the pixels so it can't be stripped from the download.

const TEXT = "SoccerFansWorld";

export function watermarkSvg(size: { w: number; h: number }): Buffer {
  const step = 200;
  const cells: string[] = [];
  for (let y = 0; y < size.h + step; y += step) {
    for (let x = -step; x < size.w + step; x += step) {
      cells.push(
        `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" ` +
          `font-size="24" font-weight="800" letter-spacing="3" fill="#ffffff" ` +
          `fill-opacity="0.16" transform="rotate(-30 ${x} ${y})">${TEXT}</text>`,
      );
    }
  }
  return Buffer.from(
    `<svg width="${size.w}" height="${size.h}" xmlns="http://www.w3.org/2000/svg">` +
      cells.join("") +
      `</svg>`,
  );
}
