import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Evidence FILES bypass this entirely — the browser uploads them straight to
    // Supabase Storage and the action receives only object paths. This limit only
    // covers pasted CSV text, and stays under Vercel's ~4.5MB request body cap so
    // the app never promises more than the platform will accept.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
