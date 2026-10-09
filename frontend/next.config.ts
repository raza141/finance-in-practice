import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Instructor photo uploads (PhotoStorage caps them at 4 MB; Vercel's request limit is 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // Baseline hardening. HSTS comes from Vercel. No full CSP yet: inline scripts and the 3D scenes would need nonces.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Only our own pages may frame us (the article editor previews in an iframe): no clickjacking.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Invoice links carry their secret token in the path: other sites only ever see our origin.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
