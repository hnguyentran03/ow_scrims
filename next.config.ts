import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM binary and must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
