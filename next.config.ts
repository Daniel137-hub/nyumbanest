import type { NextConfig } from "next";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseImageUrl = configuredSupabaseUrl ? new URL(configuredSupabaseUrl) : null;

const nextConfig: NextConfig = {
  distDir: process.env.NYUMBANEST_PLAYWRIGHT === "1" ? ".next-playwright" : ".next",
  allowedDevOrigins: ["192.168.0.184"],
  images: {
    remotePatterns: supabaseImageUrl
      ? [{
          protocol: supabaseImageUrl.protocol.slice(0, -1) as "http" | "https",
          hostname: supabaseImageUrl.hostname,
          port: supabaseImageUrl.port,
          pathname: "/storage/v1/object/public/property-images/**",
        }]
      : [],
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    agentUpgrade: "security",
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
