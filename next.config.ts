import type { NextConfig } from "next";

// Deployment target: 'vercel' (standalone) yoki 'cloudflare' (next-on-pages)
const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare" ||
  !!process.env.CF_PAGES

const nextConfig: NextConfig = {
  ...(isCloudflare ? {} : { output: "standalone" }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: isCloudflare
    ? ["@tidbcloud/serverless"]
    : ["@prisma/client", "@node-rs/argon2", "sharp"],
  images: {
    unoptimized: isCloudflare,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.tidbcloud.com",
      },
    ],
  },
};

export default nextConfig;
