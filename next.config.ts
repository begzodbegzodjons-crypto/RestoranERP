import type { NextConfig } from "next";
import path from "node:path";

// Deployment target: 'vercel' (standalone) yoki 'cloudflare' (next-on-pages)
const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare" ||
  !!process.env.CF_PAGES

const fakeFsPath = path.join(process.cwd(), "src/lib/fs-polyfill-module.ts")

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
    ? ["@prisma/client"]
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
  // Cloudflare Workers uchun - fs moduli polyfill qilinadi
  // Prisma'ning binaryTarget detection logic'i fs.readdir chaqiradi,
  // CF Workers'da bu funksiya "not implemented" xatosi beradi.
  // Yechim: node:fs va fs modulini o'z fake modulimizga yo'naltiramiz
  turbopack: {
    resolveAlias: {
      "node:fs": fakeFsPath,
      "fs": fakeFsPath,
      "node:fs/promises": fakeFsPath,
      "fs/promises": fakeFsPath,
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer && isCloudflare) {
      config.resolve = config.resolve || {}
      config.resolve.alias = config.resolve.alias || {}
      config.resolve.alias["node:fs"] = fakeFsPath
      config.resolve.alias["fs"] = fakeFsPath
      config.resolve.alias["node:fs/promises"] = fakeFsPath
      config.resolve.alias["fs/promises"] = fakeFsPath
      config.resolve.fallback = config.resolve.fallback || {}
      config.resolve.fallback["fs"] = fakeFsPath
    }
    return config
  },
};

export default nextConfig;
