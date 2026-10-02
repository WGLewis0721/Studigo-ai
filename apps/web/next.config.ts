import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@studigo/ai", "@studigo/documents", "@studigo/learning"]
};

export default nextConfig;
