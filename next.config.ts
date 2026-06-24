import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker image (Dokploy deploy).
  output: "standalone",
}

export default nextConfig
