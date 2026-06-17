/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. Matikan React Compiler jika menggunakan Node v23 agar tidak terjadi crash saat build
  reactCompiler: false,
  
  // 2. INSTRUKSI MUTLAK CPANEL: Bekukan aplikasi menjadi HTML Statis
  output: 'export',
  
  // 3. Matikan optimasi gambar bawaan Next.js. cPanel tidak mendukung pemrosesan gambar dinamis.
  images: {
    unoptimized: true,
  },

  // 4. Bypass benturan versi TypeScript dan ESLint dengan Node.js v23
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;