"use client";

import React, { useState, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight, BarChart2, Calendar, ShieldAlert, Thermometer, Droplets, Wind } from 'lucide-react';

// [PERBAIKAN] Gunakan variabel lingkungan untuk URL API. Di produksi, ini akan menjadi path relatif (misal: '/api').
const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Struktur Data TypeScript untuk Integritas Variabel
interface TelemetryRow {
  waktu_rekam: string;
  suhu: number;
  kelembaban: number;
  kecepatan_angin: number;
  status_alert: number;
}

export default function AnalyticsPage() {
  // --- STATE MANAGEMENT ---
  const [allData, setAllData] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State Paginasi (Pagination Control)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25); // Standar industri: 25 baris per halaman

  // State Agregasi Kuantitatif (Statistik Deskriptif)
  const [stats, setStats] = useState({
    maxSuhu: 0,
    avgKelembaban: 0,
    avgAngin: 0,
    totalAlerts: 0
  });

  // --- LOGIKA AKUISISI DATA GUDANG (FETCH ALL) ---
  const fetchAllData = async () => {
    try {
      setLoading(true);
      // Ambil data tabel dan data statistik secara paralel
      const [resAll, resStats] = await Promise.all([
        fetch(`${SERVER_URL}/telemetry/all`),
        fetch(`${SERVER_URL}/telemetry/stats`)
      ]);

      if (resAll.ok) setAllData(await resAll.json());
      if (resStats.ok) setStats(await resStats.json());

    } catch (error) {
      console.error("Gagal menarik data gudang dari server lokal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // --- KONTROL PAGINASI (SLICING ARRAY MEMORI) ---
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  // Memotong data dari memori RAM browser sesuai halaman aktif (O(1) Slicing)
  const currentRows = allData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(allData.length / rowsPerPage);

  // --- MESIN EKSPOR CSV (CLIENT-SIDE BINARY BLOB GENERATION) ---
  const exportToCSV = () => {
    if (allData.length === 0) {
      alert("Gudang data kosong. Tidak ada yang bisa diekspor.");
      return;
    }

    // 1. Susun Header Kolom Sesuai Aturan Format Excel/CSV Indonesia
    let csvContent = "No,Waktu Rekam,Suhu (C),Kelembaban (%),Kecepatan Angin (m/s),Status Perangkap Hama\n";

    // 2. Iterasi Baris demi Baris Berbasis Kompleksitas Waktu O(n)
    allData.forEach((row, index) => {
      const waktu = new Date(row.waktu_rekam).toLocaleString('id-ID');
      const statusHama = row.status_alert === 1 ? "HAMA TERDETEKSI (ALERT)" : "NORMAL";
      
      // Susun baris string terdelimitasi koma
      csvContent += `${index + 1},"${waktu}",${row.suhu},${row.kelembaban},${row.kecepatan_angin},"${statusHama}"\n`;
    });

    // 3. Konversi String Teks ke Objek Data Biner Murni (Blob)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // 4. Injeksi Elemen Manipulatif untuk Memicu Unduhan Otomatis di Windows
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Laporan_Agrosync_Historis_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click(); // Simulasikan klik klik paksa oleh sistem
    document.body.removeChild(link); // Bersihkan sisa elemen DOM
    URL.revokeObjectURL(url); // Bebaskan RAM browser dari alokasi biner URL
  };

  return (
    <div className="min-h-screen p-8 space-y-8 bg-slate-950 text-slate-100">
      
      {/* HEADER UTAMA */}
      <div className="flex flex-col items-start justify-between gap-4 pb-6 border-b md:flex-row md:items-center border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">ANALISIS EKSEKUTIF DATA</h1>
          <p className="mt-1 text-sm text-slate-400">Gudang Data Historis & Ekstraksi Laporan Komprehensif (Ledger Sistem)</p>
        </div>
        
        {/* TOMBOL UNDUH CSV UTAMA */}
        <button
          onClick={exportToCSV}
          disabled={loading || allData.length === 0}
          className="flex items-center px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5 mr-2" />
          UNDUH LAPORAN CSV (EXCEL)
        </button>
      </div>

      {/* TIGA KARTU AGREGASI AGRO-STATISTIK */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="flex items-center justify-between p-5 border bg-slate-900 rounded-xl border-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Suhu Tertinggi</p>
            <p className="mt-1 text-3xl font-extrabold text-white">{loading ? '...' : stats.maxSuhu}<span className="ml-1 text-sm text-slate-500">°C</span></p>
          </div>
          <Thermometer className="w-10 h-10 text-rose-500 opacity-60" />
        </div>

        <div className="flex items-center justify-between p-5 border bg-slate-900 rounded-xl border-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Rerata Kelembaban</p>
            <p className="mt-1 text-3xl font-extrabold text-white">{loading ? '...' : stats.avgKelembaban}<span className="ml-1 text-sm text-slate-500">% RH</span></p>
          </div>
          <Droplets className="w-10 h-10 text-blue-500 opacity-60" />
        </div>

        <div className="flex items-center justify-between p-5 border bg-slate-900 rounded-xl border-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Rerata Kec. Angin</p>
            <p className="mt-1 text-3xl font-extrabold text-white">{loading ? '...' : stats.avgAngin}<span className="ml-1 text-sm text-slate-500">m/s</span></p>
          </div>
          <Wind className="w-10 h-10 text-slate-400 opacity-60" />
        </div>

        <div className="flex items-center justify-between p-5 border bg-slate-900 rounded-xl border-slate-800">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-slate-500">Populasi Kasus Hama</p>
            <p className="mt-1 text-3xl font-extrabold text-rose-400">{loading ? '...' : stats.totalAlerts}<span className="ml-1 text-sm text-slate-500">Deteksi</span></p>
          </div>
          <ShieldAlert className="w-10 h-10 text-rose-500 opacity-60" />
        </div>
      </div>

      {/* TABEL LEDGER BESAR */}
      <div className="overflow-hidden border shadow-2xl bg-slate-900 rounded-xl border-slate-800">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-y-1">
            <div>
              <h2 className="flex items-center text-lg font-bold text-white">
                <BarChart2 className="w-5 h-5 mr-2 text-emerald-400" />
                Ledger Riwayat Transaksi Data Lapangan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Total entri tersimpan di database: {allData.length} baris data</p>
            </div>
          </div>
          
          {/* PEMILIH JML BARIS */}
          <div className="flex items-center text-sm text-slate-400">
            <span className="mr-2">Tampilkan:</span>
            <select 
              value={rowsPerPage} 
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 text-white border rounded bg-slate-800 border-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 font-mono text-sm text-center text-emerald-400 animate-pulse">
              MENGEKSTRAKSI SELURUH TRANSAKSI MEMORI DARI DATABASE...
            </div>
          ) : allData.length === 0 ? (
            <div className="p-20 font-mono text-sm text-center text-slate-600">
              PANGKALAN DATA REKAMAN KOSONG.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs tracking-wider uppercase border-b bg-slate-950 text-slate-400 border-slate-800">
                  <th className="px-6 py-4 font-bold">No</th>
                  <th className="px-6 py-4 font-bold"><span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> Stempel Waktu</span></th>
                  <th className="px-6 py-4 font-bold text-center">Suhu</th>
                  <th className="px-6 py-4 font-bold text-center">Kelembaban</th>
                  <th className="px-6 py-4 font-bold text-center">Kecepatan Angin</th>
                  <th className="px-6 py-4 font-bold text-center">Status Perangkap</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm divide-y divide-slate-800">
                {currentRows.map((row, index) => {
                  const absoluteIndex = indexOfFirstRow + index + 1;
                  return (
                    <tr key={index} className="transition-colors hover:bg-slate-800/40">
                      <td className="px-6 py-3 font-medium text-slate-500">{absoluteIndex}</td>
                      <td className="px-6 py-3 text-slate-300">
                        {new Date(row.waktu_rekam).toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-3 font-bold text-center text-white">{row.suhu}°C</td>
                      <td className="px-6 py-3 text-center text-blue-400">{row.kelembaban}%</td>
                      <td className="px-6 py-3 text-center text-slate-400">{row.kecepatan_angin} m/s</td>
                      <td className="px-6 py-3 text-center">
                        {row.status_alert === 1 ? (
                          <span className="px-2.5 py-1 bg-rose-950/50 border border-rose-500/30 text-rose-400 text-[11px] font-bold rounded-full">
                            ALERT DETEKSI
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-500 text-[11px] font-medium rounded-full">
                            NORMAL
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* INTEGRASI BILAH NAVIGASI PAGINASI */}
        {allData.length > 0 && !loading && (
          <div className="flex flex-col items-center justify-between gap-4 p-4 text-sm border-t bg-slate-950 border-slate-800 sm:flex-row text-slate-400">
            <div>
              Menampilkan <span className="font-bold text-white">{indexOfFirstRow + 1}</span> sampai <span className="font-bold text-white">{Math.min(indexOfLastRow, allData.length)}</span> dari <span className="font-bold text-emerald-400">{allData.length}</span> Entri Data.
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="px-4 py-2 font-mono font-bold text-white border rounded-lg bg-slate-900 border-slate-800">
                Halaman {currentPage} / {totalPages}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}