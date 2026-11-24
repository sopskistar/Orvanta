import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel serves the launch as static pages; future Neon integration is separate.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
