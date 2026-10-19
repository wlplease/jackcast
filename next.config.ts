import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: { unoptimized: true },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ],
    }];
  },
};

export default nextConfig;
