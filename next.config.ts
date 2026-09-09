import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // The lead-era portal pages were replaced by the pursuit desk.
      { source: "/portal/leads", destination: "/portal", permanent: false },
    ];
  },
};

export default nextConfig;
