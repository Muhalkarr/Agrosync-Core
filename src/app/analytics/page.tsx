"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Download, ChevronLeft, ChevronRight, BarChart2, Calendar, ShieldAlert, Thermometer, Droplets, Wind, Trash2 } from 'lucide-react';

// [PERBAIKAN] Gunakan variabel lingkungan untuk URL API. Di produksi, ini akan menjadi path relatif (misal: '/api').
const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Struktur Data TypeScript untuk Integritas Variabel
interface TelemetryRow {
  id: number;
  waktu_rekam: string;
  suhu: number;
  kelembaban: number;
  kecepatan_angin: number;
  status_alert: number;
  correlated_image_url?: string;
  correlated_label?: string;
}

export default function AnalyticsPage() {
  // --- STATE MANAGEMENT ---
  const [allData, setAllData] = useState<TelemetryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State Paginasi (Pagination Control)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25); // Standar industri: 25 baris per halaman
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [isSynergyDownloading, setIsSynergyDownloading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [synergyLabelFilter, setSynergyLabelFilter] = useState<string>('ALL');

  // State Agregasi Kuantitatif (Statistik Deskriptif)
  const [stats, setStats] = useState({
    maxSuhu: 0,
    avgKelembaban: 0,
    avgAngin: 0,
    totalAlerts: 0
  });

  // --- LOGIKA AKUISISI DATA GUDANG (FETCH ALL) ---
  const fetchData = async () => {
    try {
      setLoading(true);
      // Ambil data tabel dan data statistik secara paralel
      const [resAll, resStats] = await Promise.all([
        fetch(`${SERVER_URL}/telemetry/all?page=${currentPage}&limit=${rowsPerPage}`),
        fetch(`${SERVER_URL}/telemetry/stats`)
      ]);

      if (resAll.ok) {
        const { data, totalItems } = await resAll.json();
        setAllData(data);
        setTotalItems(totalItems);
      }
      if (resStats.ok) setStats(await resStats.json());

    } catch (error) {
      console.error("Gagal menarik data gudang dari server lokal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, rowsPerPage]);

  // --- KONTROL PAGINASI (SLICING ARRAY MEMORI) ---
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const indexOfFirstRow = (currentPage - 1) * rowsPerPage;

  // --- LOGIKA SELEKSI & PENGHAPUSAN ---
  const handleRowSelect = (id: number) => {
    setSelectedRows(prev => 
        prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allVisibleIds = allData.map(row => row.id);
      setSelectedRows(allVisibleIds);
    } else {
      setSelectedRows([]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) return;

    const confirmation = window.confirm(`Anda yakin ingin menghapus ${selectedRows.length} baris data secara permanen? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmation) return;

    try {
      const res = await fetch(`${SERVER_URL}/telemetry/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows })
      });

      if (res.ok) {
        setSelectedRows([]);
        // Fetch ulang data untuk halaman saat ini untuk menampilkan perubahan
        await fetchData();
        alert('Data yang dipilih berhasil dihapus.');
      } else {
        const errorData = await res.json();
        alert(`Gagal menghapus data: ${errorData.error}`);
      }
    } catch (error) {
      alert('Gagal terhubung ke server untuk menghapus data.');
      console.error("Gagal menghapus data telemetri:", error);
    }
  };

  const handleDeleteAllTelemetry = async () => {
    const confirmation = window.prompt(`TINDAKAN INI BERBAHAYA DAN TIDAK DAPAT DIBATALKAN.\n\nAnda akan menghapus SEMUA ${totalItems} baris data telemetri dari database.\n\nUntuk melanjutkan, ketik "HAPUS SEMUA" di bawah ini:`);
    if (confirmation !== 'HAPUS SEMUA') {
      alert('Penghapusan dibatalkan.');
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/telemetry/all-data`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Semua data telemetri berhasil dihapus.');
        await fetchData(); // Refresh the view
      } else {
        const errorData = await res.json();
        alert(`Gagal menghapus data: ${errorData.error}`);
      }
    } catch (error) {
      alert('Gagal terhubung ke server untuk menghapus data.');
      console.error("Gagal menghapus semua data telemetri:", error);
    }
  };

  const handlePruneOldData = async () => {
    const days = window.prompt("Masukkan jumlah hari untuk data yang ingin dipertahankan. Data yang LEBIH TUA dari jumlah hari ini akan dihapus.\n\nContoh: Masukkan '30' untuk menghapus data yang lebih tua dari 30 hari.", "30");
    if (days === null) {
      alert('Pembersihan dibatalkan.');
      return;
    }
    const numDays = parseInt(days);
    if (isNaN(numDays) || numDays <= 0) {
      alert('Input tidak valid. Harap masukkan angka positif.');
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/maintenance/prune-telemetry?days=${numDays}`, { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        alert(result.message);
        await fetchData(); // Refresh data
      } else {
        alert('Gagal melakukan pembersihan data.');
      }
    } catch (error) {
      console.error("Gagal melakukan pembersihan data:", error);
      alert('Gagal terhubung ke server untuk pembersihan data.');
    }
  };

  const handleSynergyDownload = async () => {
    const filterText = synergyLabelFilter === 'ALL' ? 'semua gambar' : `gambar berlabel "${synergyLabelFilter}"`;
    const confirmation = window.confirm(`Anda akan membuat dan mengunduh dataset gabungan (telemetri + ${filterText}). Proses ini SANGAT MEMBEBANI server dan mungkin memakan waktu beberapa saat. Lanjutkan?`);
    if (!confirmation) return;

    setIsSynergyDownloading(true);
    try {
        window.location.href = `${SERVER_URL}/export/synergized?label=${synergyLabelFilter}`;
        
        // Proses ini bisa lama, beri waktu lebih
        setTimeout(() => setIsSynergyDownloading(false), 20000);
    } catch (error) {
        console.error("Gagal memulai unduhan sinergi:", error);
        alert("Terjadi kesalahan saat mencoba memulai unduhan.");
        setIsSynergyDownloading(false);
    }
  };


  // --- MESIN EKSPOR CSV (SERVER-SIDE FULL DATA EXPORT) ---
  const exportToCSV = async () => {
    const confirmation = window.confirm(`Anda akan mengekspor SELURUH (${totalItems}) baris data telemetri dari database. Proses ini mungkin memakan waktu beberapa saat. Lanjutkan?`);
    if (!confirmation) return;

    if (totalItems === 0) {
      alert("Gudang data kosong. Tidak ada yang bisa diekspor.");
      return;
    }

    setIsExporting(true);
    try {
      // 1. Ambil semua data dari endpoint baru
      const res = await fetch(`${SERVER_URL}/telemetry/export-all`);
      if (!res.ok) throw new Error('Gagal mengambil data dari server.');
      
      const fullData: TelemetryRow[] = await res.json();

      // 2. Susun Header Kolom
      let csvContent = "No,Waktu Rekam (UTC),Suhu (C),Kelembaban (%),Kecepatan Angin (m/s),Status Inframerah,URL Gambar,Label Gambar\n";

      // 3. Iterasi data yang sudah lengkap
      fullData.forEach((row, index) => {
        const waktu = new Date(row.waktu_rekam).toISOString().replace('T', ' ').replace('.000Z', '');
        const statusInframerah = row.status_alert === 1 ? "TERHALANG" : "NORMAL";
        const labelGambar = row.correlated_label || 'N/A';
        const urlGambar = row.correlated_image_url ? `${window.location.origin}${row.correlated_image_url}` : 'N/A';
        csvContent += `${index + 1},"${waktu}",${row.suhu},${row.kelembaban},${row.kecepatan_angin},"${statusInframerah}","${urlGambar}","${labelGambar}"\n`;
      });

      // 4. Buat dan picu unduhan Blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Laporan_Lengkap_Agrosync_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Gagal mengekspor CSV:", error);
      alert("Terjadi kesalahan saat membuat laporan CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-8 md:p-8">
      
      {/* HEADER UTAMA */}
      <div className="flex flex-col items-start justify-between gap-4 pb-6 border-b md:flex-row md:items-center border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">ANALISIS EKSEKUTIF DATA</h1>
          <p className="mt-1 text-sm text-slate-400">Gudang Data Historis & Ekstraksi Laporan Komprehensif (Ledger Sistem)</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* TOMBOL HAPUS MASSAL */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedRows.length === 0}
            className="flex items-center px-5 py-3 font-bold text-white transition-all duration-200 bg-rose-600 rounded-lg shadow-lg hover:bg-rose-500 shadow-rose-600/20 hover:scale-102 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            HAPUS ({selectedRows.length})
          </button>
          {/* TOMBOL HAPUS SEMUA TELEMETRI */}
          <button
            onClick={handleDeleteAllTelemetry}
            disabled={loading || totalItems === 0}
            className="flex items-center px-5 py-3 font-bold text-white transition-all duration-200 bg-red-800 rounded-lg shadow-lg hover:bg-red-700 shadow-red-800/20 hover:scale-102 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Hapus Semua
          </button>
          
          {/* TOMBOL BERSIHKAN DATA LAMA */}
          <button
            onClick={handlePruneOldData}
            disabled={loading || totalItems === 0}
            className="flex items-center px-5 py-3 font-bold text-white transition-all duration-200 bg-slate-600 rounded-lg shadow-lg hover:bg-slate-500 shadow-slate-600/20 hover:scale-102 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Bersihkan Data Lama
          </button>

          {/* KONTROL UNDUH DATASET GABUNGAN */}
          <div className="flex items-stretch rounded-lg shadow-lg">
            <button
              onClick={handleSynergyDownload}
              disabled={loading || isSynergyDownloading}
              className="flex items-center px-5 py-3 font-bold text-white transition-all duration-200 bg-indigo-600 rounded-l-lg hover:bg-indigo-500 shadow-indigo-600/20 hover:scale-102 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 mr-2" />
              UNDUH GABUNGAN
            </button>
            <select 
              value={synergyLabelFilter}
              onChange={(e) => setSynergyLabelFilter(e.target.value)}
              disabled={loading || isSynergyDownloading}
              className="px-3 py-3 text-sm font-bold text-white bg-indigo-700 border-l border-indigo-500 rounded-r-lg focus:outline-none disabled:bg-slate-700 disabled:text-slate-500"
            >
              <option value="ALL">Semua Label</option>
              <option value="UNLABELED">Unlabeled</option>
              <option value="HAMA">Hama</option>
              <option value="BUKAN HAMA">Bukan Hama</option>
              <option value="BURAM">Buram</option>
            </select>
          </div>


          {/* TOMBOL UNDUH CSV UTAMA */}
          <button
            onClick={exportToCSV}
            disabled={loading || totalItems === 0 || isExporting}
            className="flex items-center px-5 py-3 font-bold text-white transition-all duration-200 bg-emerald-600 rounded-lg shadow-lg hover:bg-emerald-500 shadow-emerald-600/20 hover:scale-102 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5 mr-2" />
            UNDUH LAPORAN CSV
          </button>
        </div>
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
              <p className="text-xs text-slate-500 mt-0.5">Total entri tersimpan di database: {totalItems} baris data</p>
            </div>
          </div>
          
          {/* [PERBAIKAN UX] Kontrol Paginasi di Atas Tabel */}
          <div className="flex items-center gap-4">
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
            {totalPages > 1 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
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
                  <th className="px-4 py-4">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                      onChange={handleSelectAllOnPage}
                      checked={allData.length > 0 && selectedRows.length > 0 && allData.every(r => selectedRows.includes(r.id))}
                      ref={input => { if (input) input.indeterminate = selectedRows.length > 0 && selectedRows.length < allData.length; }}
                    />
                  </th>
                  <th className="px-6 py-4 font-bold"><span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> Stempel Waktu</span></th>
                  <th className="px-6 py-4 font-bold text-center">Suhu</th>
                  <th className="px-6 py-4 font-bold text-center">Kelembaban</th>
                  <th className="px-6 py-4 font-bold text-center">Kecepatan Angin</th>
                  <th className="px-6 py-4 font-bold text-center">Inframerah</th>
                  <th className="px-6 py-4 font-bold text-center">Gambar</th>
                  <th className="px-6 py-4 font-bold text-center">Label Gambar</th>
                </tr>
              </thead>
              <tbody className="font-mono text-sm divide-y divide-slate-800">
                {allData.map((row, index) => {
                  const absoluteIndex = indexOfFirstRow + index + 1;
                  return (
                    <tr key={row.id} className="transition-colors hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                          checked={selectedRows.includes(row.id)}
                          onChange={() => handleRowSelect(row.id)}
                        />
                      </td>
                      <td className="px-6 py-3 text-slate-300">
                        {absoluteIndex}. {new Date(row.waktu_rekam).toISOString().replace('T', ' ').replace('.000Z', '')}
                      </td>
                      <td className="px-6 py-3 font-bold text-center text-white">{row.suhu}°C</td>
                      <td className="px-6 py-3 text-center text-blue-400">{row.kelembaban}%</td>
                      <td className="px-6 py-3 text-center text-slate-400">{row.kecepatan_angin} m/s</td>
                      <td className="px-6 py-3 font-bold text-center">
                        {row.status_alert === 1 ? (
                          <span className="text-rose-400">TERHALANG</span>
                        ) : (
                          <span className="text-slate-500">NORMAL</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {row.correlated_image_url ? (
                          <a href={row.correlated_image_url} target="_blank" rel="noopener noreferrer" className="inline-block p-1 transition-all border rounded-md bg-slate-800 border-slate-700 hover:scale-150 hover:border-emerald-500">
                            <img src={row.correlated_image_url} alt="thumbnail" className="object-cover w-12 h-8 rounded-sm" />
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {row.correlated_label ? (
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full
                            ${row.correlated_label === 'HAMA' && 'bg-rose-950/50 border border-rose-500/30 text-rose-400'}
                            ${row.correlated_label === 'BUKAN HAMA' && 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400'}
                            ${row.correlated_label === 'BURAM' && 'bg-slate-800 border border-slate-700 text-slate-400'}
                            ${row.correlated_label === 'UNLABELED' && 'bg-amber-950/50 border border-amber-500/30 text-amber-400'}
                          `}>
                            {row.correlated_label}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-500 text-[11px] font-medium rounded-full">
                            N/A
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
        {totalItems > 0 && !loading && (
          <div className="flex flex-col items-center justify-between gap-4 p-4 text-sm border-t bg-slate-950/50 border-slate-800 sm:flex-row text-slate-400">
            <div>
              Menampilkan <span className="font-bold text-white">{indexOfFirstRow + 1}</span> sampai <span className="font-bold text-white">{Math.min(indexOfFirstRow + rowsPerPage, totalItems)}</span> dari <span className="font-bold text-emerald-400">{totalItems}</span> Entri Data.
            </div>
            
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

    </div>
  );
}

// [PERBAIKAN UX] Komponen Paginasi yang Dapat Digunakan Kembali
const PaginationControls = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number) => void }) => {
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    const half = Math.floor(maxPagesToShow / 2);

    if (totalPages <= maxPagesToShow + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > half + 2) pages.push('...');

      let start = Math.max(2, currentPage - half);
      let end = Math.min(totalPages - 1, currentPage + half);

      if (currentPage <= half + 1) end = maxPagesToShow -1;
      if (currentPage >= totalPages - half) start = totalPages - maxPagesToShow + 2;

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - half - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className="flex items-center space-x-1">
      <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">{'<<'}</button>
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" /></button>
      
      {pageNumbers.map((num, i) => (
        typeof num === 'number' ? (
          <button key={i} onClick={() => onPageChange(num)} className={`px-4 py-2 font-mono font-bold border rounded-lg transition-colors ${currentPage === num ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'}`}>
            {num}
          </button>
        ) : (
          <span key={i} className="px-4 py-2 font-mono font-bold text-slate-500">...</span>
        )
      ))}

      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" /></button>
      <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className="p-2 transition-colors border rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">{'>>'}</button>
    </div>
  );
};