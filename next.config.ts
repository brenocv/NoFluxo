import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typescript.ignoreBuildErrors removed — let the build fail on type errors
  // so they get caught early instead of silently shipping broken code.
  reactStrictMode: false,
};

export default nextConfig;
