import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Turbopack from inferring the wrong root when multiple lockfiles exist.
    root: projectRoot,
  },
};

export default nextConfig;
