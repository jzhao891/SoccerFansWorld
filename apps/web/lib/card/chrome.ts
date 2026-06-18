import type { AiCardResponse, FanStats } from "./types";
import { STAT_LABELS } from "./types";

// Server-side fan-card chrome, mirroring the FanCard DOM layout from the old
// client render. Two SVGs because the player image sits between them: the
// backdrop darkening goes under the player, the banner/stats go over it.

export const CARD_SIZE = { w: 1080, h: 1512 };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Top + bottom darkening so banner and stat text stay legible over any stadium.
export function backdropSvg(): Buffer {
  const { w, h } = CARD_SIZE;
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#000000" stop-opacity="0.55"/>` +
      `<stop offset="0.35" stop-color="#000000" stop-opacity="0"/>` +
      `<stop offset="0.55" stop-color="#000000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000000" stop-opacity="0.72"/>` +
      `</linearGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#d)"/></svg>`,
  );
}

export function chromeSvg(data: AiCardResponse, name: string, team: string, city: string, overall: number): Buffer {
  const { w, h } = CARD_SIZE;
  const emerald = "#6ee7b7";

  // ── Top banner ──────────────────────────────────────────────
  const banner =
    `<text x="48" y="70" font-family="Arial, sans-serif" font-size="26" font-weight="900" letter-spacing="6" fill="${emerald}">FAN XI</text>` +
    `<text x="48" y="112" font-family="Arial, sans-serif" font-size="30" font-weight="900" letter-spacing="3" fill="#ffffff" fill-opacity="0.85">${escapeXml(data.archetype.toUpperCase())}</text>`;

  // OVR badge (top-right)
  const badgeW = 150;
  const badgeX = w - 48 - badgeW;
  const ovr =
    `<rect x="${badgeX}" y="40" width="${badgeW}" height="120" rx="18" fill="#000000" fill-opacity="0.5" stroke="#ffffff" stroke-opacity="0.12"/>` +
    `<text x="${badgeX + badgeW / 2}" y="112" text-anchor="middle" font-family="Arial, sans-serif" font-size="70" font-weight="900" fill="${emerald}">${overall}</text>` +
    `<text x="${badgeX + badgeW / 2}" y="146" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" letter-spacing="4" fill="#cbd5e1">OVR</text>`;

  // ── Bottom: team•city, name ─────────────────────────────────
  const cx = w / 2;
  const identity =
    `<text x="${cx}" y="1252" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" letter-spacing="6" fill="${emerald}">${escapeXml(`${team} • ${city}`.toUpperCase())}</text>` +
    `<text x="${cx}" y="1326" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" font-weight="900" letter-spacing="3" fill="#ffffff">${escapeXml(name.toUpperCase())}</text>`;

  // ── Stat strip (6 cells) ────────────────────────────────────
  const pad = 36;
  const gap = 12;
  const cellW = (w - pad * 2 - gap * 5) / 6;
  const cellH = 104;
  const cellY = h - pad - cellH;
  const stats = STAT_LABELS.map(([key, label], i) => {
    const x = pad + i * (cellW + gap);
    const value = data.stats[key as keyof FanStats];
    const tx = x + cellW / 2;
    return (
      `<rect x="${x}" y="${cellY}" width="${cellW}" height="${cellH}" rx="14" fill="#000000" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.1"/>` +
      `<text x="${tx}" y="${cellY + 56}" text-anchor="middle" font-family="Arial, sans-serif" font-size="40" font-weight="900" fill="#ffffff">${value}</text>` +
      `<text x="${tx}" y="${cellY + 86}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="1" fill="#cbd5e1">${label}</text>`
    );
  }).join("");

  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${banner}${ovr}${identity}${stats}</svg>`,
  );
}
