import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid Next.js guessing the repo root when other lockfiles exist elsewhere on disk.
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
