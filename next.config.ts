import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep an isolated checkout self-contained when its parent has another lockfile.
  outputFileTracingRoot: process.cwd(),
  // Document parsers ship their own workers and data files; leave them out of the bundle.
  serverExternalPackages: ["pdf-parse", "mammoth", "postal-mime"],
  async redirects() {
    return [
      { source: "/portal/leads", destination: "/portal/pursuits", permanent: false },
    ];
  },
};

export default nextConfig;
