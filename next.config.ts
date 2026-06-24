import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server bundle for the Docker image (Dokploy deploy).
  output: "standalone",
  experimental: {
    // App runs behind a reverse proxy (Traefik) on a custom domain, so the
    // forwarded host differs from the bound host. Allow these origins or
    // Next.js rejects Server Actions (login/add/edit) with a 403.
    serverActions: {
      allowedOrigins: ["todo.bijbrin.cloud", "100.78.187.64:8085"],
    },
  },
}

export default nextConfig
