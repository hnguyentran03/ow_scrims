import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary and must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["@electric-sql/pglite"],
  // deploy/deploy.sh sets BUILD_STANDALONE; `next start` (Playwright, local) refuses a standalone build, so it is opt-in.
  output: process.env.BUILD_STANDALONE ? "standalone" : undefined,
  // next/image is unused; this keeps sharp's platform binaries out of the picture on the box.
  images: { unoptimized: true },
};

export default nextConfig;
