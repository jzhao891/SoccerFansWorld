import type { NextConfig } from "next";
import { readdirSync } from "fs";
import { join } from "path";

// Matches lib/frames/loadFrames.ts's todayDate() — the app only ever reads
// today's daily/<date> folder at runtime, so every OTHER date folder is
// dead weight in the deployed function bundle. Computed once at build time;
// a stale build serving a wrong "today" just means yesterday's excluded
// folder stays excluded, not a functional bug (that folder was already
// inactive in the picker).
const today = new Date().toISOString().slice(0, 10);
const dailyDir = join(__dirname, "public", "frames", "assets", "daily");
let expiredDailyGlobs: string[] = [];
try {
  expiredDailyGlobs = readdirSync(dailyDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== today)
    .map((e) => `public/frames/assets/daily/${e.name}/**`);
} catch {
  // No daily/ folder yet (fresh checkout before any frame's been added) — nothing to exclude.
}

const nextConfig: NextConfig = {
  // @sfw/shared ships as raw TypeScript from the workspace, so Next must
  // transpile it rather than expect a pre-built package.
  transpilePackages: ["@sfw/shared"],
  // Testing on a phone via the ngrok tunnel hits the dev server from a
  // different origin than localhost. Next 15's dev server blocks /_next/*
  // asset requests (CSS, JS chunks) from origins it doesn't recognize,
  // which silently drops all styling — the page still renders, just as
  // unstyled HTML. Allow the ngrok tunnel host explicitly.
  allowedDevOrigins: ["abide-registry-sharply.ngrok-free.dev"],
  // Routes like api/frames/render and api/card/render read from public/ via
  // a `join(process.cwd(), "public", ...)` path the build tracer can't
  // resolve statically — it falls back to bundling the ENTIRE public/
  // directory into the serverless function (hit Vercel's 250MB uncompressed
  // function limit). public/highlights/ (223MB, standalone video-compositing
  // output, not read by any API route) is the bulk of that; excluding it
  // keeps every function's traced public/ well under the limit.
  //
  // That alone stopped being enough once the daily/ frame archive itself
  // grew past ~225MB (api/frames/render hit 251.84MB — every OTHER function
  // was already fine). expiredDailyGlobs excludes every daily/<date> folder
  // except today's, since none of the others are ever read again.
  outputFileTracingExcludes: {
    "*": ["public/highlights/**", ...expiredDailyGlobs],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl',
    };
    return config;
  },
};

export default nextConfig;
