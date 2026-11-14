import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static site (no server, no database): `npm run build` writes plain
  // HTML/JS/CSS to out/, which nginx serves from a bind-mounted html/ directory
  // (see deploy/ and deploy-web.sh).
  output: "export",
};

export default nextConfig;
