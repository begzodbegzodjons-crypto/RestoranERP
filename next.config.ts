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
      bodySizeLimit: "10mb",
    },
  },
  // Make sure native/node packages are bundled correctly
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "sharp"],
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
