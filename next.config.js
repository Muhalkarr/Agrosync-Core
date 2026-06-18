/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Matikan optimasi gambar bawaan Next.js. cPanel tidak mendukung pemrosesan gambar dinamis.
  images: {
    unoptimized: true,
  },

  // 2. Bypass benturan versi TypeScript dan ESLint dengan Node.js v23
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;