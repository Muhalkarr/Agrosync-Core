import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./global.css";
import Sidebar from "./components/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agrosync Command Center",
  description: "Sistem Pemantauan Mikroklimat & Visi Edge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      {/* HAPUS OVERFLOW-HIDDEN DI BODY AGAR FLEXBOX BEKERJA NATURAL */}
      <body className={`${inter.className} bg-slate-950 text-slate-100 flex min-h-screen`}>
        
        {/* SIDEBAR SEKARANG MENJADI BAGIAN DARI ALIRAN FLEXBOX */}
        <Sidebar />
        
        {/* HAPUS "ml-64". FLEX-1 AKAN OTOMATIS MENGAMBIL SISA RUANG LAYAR! */}
        <main className="flex-1 h-screen overflow-y-auto bg-slate-950">
          {children}
        </main>
        
      </body>
    </html>
  );
}