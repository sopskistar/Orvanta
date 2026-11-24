import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages serves this static export; future Neon integration is separate.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
