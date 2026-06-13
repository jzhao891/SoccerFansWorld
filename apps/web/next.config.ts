import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sfw/shared ships as raw TypeScript from the workspace, so Next must
  // transpile it rather than expect a pre-built package.
  transpilePackages: ["@sfw/shared"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl',
    };
    return config;
  },
};

export default nextConfig;
