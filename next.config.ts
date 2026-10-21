import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      // Raised from the default 1 MB to accommodate base64-encoded receipt
      // images uploaded by customers. Kept under Vercel's ~4.5 MB hard cap.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
