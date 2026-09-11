import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@studigo/ai", "@studigo/documents"]
};

export default nextConfig;
