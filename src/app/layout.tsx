"use client"; // Perintah ini harus berada di baris paling atas

import { useState } from 'react';
import { Inter } from "next/font/google";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import './global.css'; // Perbaikan: Sesuaikan dengan nama file yang sebenarnya

const inter = Inter({ subsets: ["latin"] });

// Objek `metadata` tidak dapat diekspor dari Client Component.
// Untuk memperbaiki error build, ini harus dihapus atau dipindahkan ke layout Server Component.
// export const metadata: Metadata = {
//   title: "Agrosync Command Center",
//   description: "Sistem Pemantauan Mikroklimat & Visi Edge",
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="id">
      {/* Struktur yang benar untuk layout responsif */}
      <body className={`${inter.className} bg-slate-950`}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 lg:ml-64">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
