import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Vercel serverless deployment
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Required for Prisma on Vercel serverless
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // Make sure Prisma client is bundled
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
};

export default nextConfig;
