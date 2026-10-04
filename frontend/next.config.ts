import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Instructor photo uploads (PhotoStorage caps them at 4 MB; Vercel's request limit is 4.5 MB).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
};

export default nextConfig;
