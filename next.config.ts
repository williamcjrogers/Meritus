import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Document parsers ship their own workers and data files; leave them out of the bundle.
  serverExternalPackages: ["pdf-parse", "mammoth", "postal-mime", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  async redirects() {
    return [
      // The lead-era portal pages were replaced by the pursuit desk.
      { source: "/portal/leads", destination: "/portal", permanent: false },
    ];
  },
};

export default nextConfig;
