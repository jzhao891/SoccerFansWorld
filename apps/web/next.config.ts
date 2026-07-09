import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sfw/shared ships as raw TypeScript from the workspace, so Next must
  // transpile it rather than expect a pre-built package.
  transpilePackages: ["@sfw/shared"],
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
