import type { NextConfig } from "next";

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
  outputFileTracingExcludes: {
    "*": ["public/highlights/**"],
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
