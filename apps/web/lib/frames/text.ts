import type { Rect, TextStyle } from "@sfw/shared";

// Render a single line of styled text as an SVG buffer sized to its rect, ready
// to composite. sharp rasterizes the SVG via librsvg using fontconfig-resolved
// fonts, so stick to widely available families (Arial/Helvetica/sans-serif).

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function textSvg(text: string, rect: Rect, style: TextStyle): Buffer {
  const content = style.uppercase ? text.toUpperCase() : text;
  const anchor =
    style.align === "left" ? "start" : style.align === "right" ? "end" : "middle";
  const x = anchor === "start" ? 0 : anchor === "end" ? rect.w : rect.w / 2;
  const y = rect.h / 2;
  const spacing =
    style.letterSpacing != null ? ` letter-spacing="${style.letterSpacing}"` : "";

  return Buffer.from(
    `<svg width="${rect.w}" height="${rect.h}" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="${x}" y="${y}" dominant-baseline="central" text-anchor="${anchor}" ` +
      `font-family="${style.fontFamily}" font-size="${style.fontSize}" ` +
      `font-weight="${style.weight ?? 700}" fill="${style.color}"${spacing}>` +
      escapeXml(content) +
      `</text></svg>`,
  );
}
