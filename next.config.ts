import type { NextConfig } from "next";

// Deployment target: 'vercel' (standalone) yoki 'cloudflare' (next-on-pages)
// Cf Pages buildida `output: standalone` KERAK EMAS - next-on-pages uni ignore qiladi,
// lekin ogohlantirishlarni kamaytirish uchun shartli qilamiz.
const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare" ||
  !!process.env.CF_PAGES

const nextConfig: NextConfig = {
  // Standalone output - faqat Vercel/Node.js serverless uchun
  // Cloudflare Pages da next-on-pages buni e'tiborsiz qoldiradi
  ...(isCloudflare ? {} : { output: "standalone" }),
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
  // sharp - CF Workers da ishlamaydi, faqat Vercel uchun kerak
  // @prisma/client - @cloudflare/next-on-pages externalize qiladi
  serverExternalPackages: isCloudflare
    ? ["@prisma/client"]
    : ["@prisma/client", "@node-rs/argon2", "sharp"],
  // Image optimization - Cloudflare Pages da sharp yo'qligi uchun o'chiriladi
  // CF da rasm optimizatsiyasi uchun Cloudflare Images yoki Image Resizing ishlatiladi
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
