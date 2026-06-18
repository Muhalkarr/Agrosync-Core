/** @type {import('next').NextConfig} */
const nextConfig = {
  // INSTRUKSI MUTLAK CPANEL: Bekukan aplikasi menjadi HTML Statis
  output: 'export',

  // Matikan optimasi gambar bawaan Next.js. cPanel tidak mendukung pemrosesan gambar dinamis.
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;