"use client";

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, Grid, Tag, Sliders, AlertCircle } from 'lucide-react';

const SERVER_URL = 'https://api.analyzer.web.id';

interface ImageMetadata {
  id: number;
  waktu_tangkap: string;
  file_path: string;
  file_size_kb: number;
  manual_label: 'UNLABELED' | 'HAMA' | 'NORMAL' | 'BURAM';
  image_url: string;
}

export default function VisionArchivePage() {
  // --- STATE DATA JARINGAN ---
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // --- STATE KONTROL ALIRAN PAGINASI & FILTER (DATABASE DRIVEN) ---
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(12); // Pilihan default kustomisasi: 12 Gambar
  const [labelFilter, setLabelFilter] = useState<string>('ALL');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // --- LOGIKA FETCH DATA DENGAN PARAMETER QUERY DATABASE ---
  const fetchArchive = async () => {
    try {
      setLoading(true);
      // Kirim batas limit dan offset halaman langsung ke MySQL peladen
      const res = await fetch(`${SERVER_URL}/api/vision/archive?page=${page}&limit=${limit}&label=${labelFilter}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images);
        setTotalPages(data.pagination.total_pages || 1);
        setTotalItems(data.pagination.total_items);
      }
    } catch (error) {
      console.error("Gagal terhubung ke gerbang arsip biner:", error);
    } finally {
      setLoading(false);
    }
  };

  // Terpanggil otomatis jika halaman, batas limit, atau kategori filter diubah pengguna
  useEffect(() => {
    fetchArchive();
  }, [page, limit, labelFilter]);

  // --- LOGIKA EKSEKUSI PELABELAN MANUAL (HUMAN ANNOTATION) ---
  const handleApplyLabel = async (id: number, targetLabel: 'HAMA' | 'NORMAL' | 'BURAM') => {
    try {
      const res = await fetch(`${SERVER_URL}/api/vision/label/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: targetLabel })
      });

      if (res.ok) {
        // Optimasi O(1) State Update: Ubah status warna di layar laptop seketika tanpa refresh data masif
        setImages(prev => prev.map(img => img.id === id ? { ...img, manual_label: targetLabel } : img));
      }
    } catch (error) {
      alert("Koneksi gagal saat menyuntikkan label.");
    }
  };

  return (
    <div className="p-8 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      
      {/* HEADER UTAMA */}
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-emerald-400 tracking-tight">ARSIP VISI EDGE</h1>
        <p className="text-slate-400 text-sm mt-1">Kurasi Kualitas Optik & Alat Pelabelan Dataset Mandiri untuk Pra-Pelatihan YOLOv8</p>
      </div>

      {/* BILAH KONTROL: FILTER & KUSTOMISASI PANJANG DATA (LIMIT) */}
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg">
        
        {/* KONTROL FILTER KATEGORI LABEL */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-400 hidden sm:inline">Filter Status:</span>
          <div className="flex flex-wrap gap-1.5">
            {['ALL', 'UNLABELED', 'HAMA', 'NORMAL', 'BURAM'].map((lbl) => (
              <button
                key={lbl}
                onClick={() => { setLabelFilter(lbl); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                  ${labelFilter === lbl 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* TUAS KUSTOMISASI JUMLAH TAMPILAN GAMBAR (ANTI-ENDLESS SCROLLING) */}
        <div className="flex items-center space-x-2 text-sm text-slate-400 w-full md:w-auto justify-end">
          <Sliders className="w-4 h-4 text-slate-500" />
          <span>Tampilkan Kapasitas:</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 font-bold focus:outline-none focus:border-emerald-500"
          >
            <option value={4}>4 Gambar / Lembar</option>
            <option value={8}>8 Gambar / Lembar</option>
            <option value={12}>12 Gambar / Lembar</option>
            <option value={24}>24 Gambar / Lembar</option>
            <option value={48}>48 Gambar / Lembar</option>
          </select>
        </div>
      </div>

      {/* RENDER GRID KISI GAMBER RESPONSIVE */}
      {loading ? (
        <div className="p-40 text-center font-mono text-sm text-emerald-400 animate-pulse tracking-widest">
          MEMUAT MATRIKS BINER GAMBAR DARI HARD DISK SERVER LOKAL...
        </div>
      ) : images.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-20 text-center text-slate-500 font-mono text-sm flex flex-col items-center justify-center">
          <AlertCircle className="w-10 h-10 text-slate-700 mb-3" />
          TIDAK ADA REKAMAN CITRA YANG MEMENUHI KRITERIA FILTER INI.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {images.map((img) => (
            <div key={img.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col group hover:border-slate-700 shadow-md transition-all">
              
              {/* AREA FOTO JPEG DARI SERVER */}
              <div className="bg-black aspect-video relative overflow-hidden border-b border-slate-800">
                <img 
                  src={img.image_url} 
                  alt="Citra Perangkap" 
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy" // Optimasi peramban agar tidak menguras kuota memori sebelum di-scroll
                />
                
                {/* LENCANA STATUS LABEL AKTIF */}
                <div className="absolute top-2 right-2">
                  <span className={`px-2 py-1 text-[10px] font-black uppercase rounded tracking-wider shadow-md
                    ${img.manual_label === 'UNLABELED' && 'bg-amber-500 text-slate-950'}
                    ${img.manual_label === 'HAMA' && 'bg-rose-500 text-white animate-pulse'}
                    ${img.manual_label === 'NORMAL' && 'bg-emerald-500 text-slate-950'}
                    ${img.manual_label === 'BURAM' && 'bg-slate-700 text-slate-200'}
                  `}>
                    {img.manual_label}
                  </span>
                </div>
              </div>

              {/* AREA METADATA FILE */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1 font-mono text-xs text-slate-400">
                  <p className="text-slate-500 font-bold">ID BERKAS: #{img.id}</p>
                  <p>Waktu: {new Date(img.waktu_tangkap).toLocaleString('id-ID')}</p>
                  <p>Ukuran: <span className="text-slate-300">{img.file_size_kb} KB</span></p>
                </div>

                {/* TIGA TOMBOL INJEKSI KELAS ANOTASI (HUMAN IN THE LOOP) */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                    <Tag className="w-3 h-3 mr-1" /> Klasifikasi Manual :
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => handleApplyLabel(img.id, 'HAMA')}
                      className={`py-1 rounded text-[10px] font-extrabold border transition-all
                        ${img.manual_label === 'HAMA' 
                          ? 'bg-rose-950/40 border-rose-500 text-rose-400 shadow-md shadow-rose-500/10' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-rose-500/40 hover:text-rose-400'}`}
                    >
                      HAMA
                    </button>
                    <button
                      onClick={() => handleApplyLabel(img.id, 'NORMAL')}
                      className={`py-1 rounded text-[10px] font-extrabold border transition-all
                        ${img.manual_label === 'NORMAL' 
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400'}`}
                    >
                      NORMAL
                    </button>
                    <button
                      onClick={() => handleApplyLabel(img.id, 'BURAM')}
                      className={`py-1 rounded text-[10px] font-extrabold border transition-all
                        ${img.manual_label === 'BURAM' 
                          ? 'bg-slate-800 border-slate-500 text-slate-200' 
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'}`}
                    >
                      BURAM
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* BILAH PAGINASI ASINKRON (LEVEL DATABASE) */}
      {images.length > 0 && !loading && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-400 shadow-inner">
          <div>
            Menampilkan Lembar <span className="text-white font-bold">{page}</span> dari total <span className="text-emerald-400 font-bold">{totalPages}</span> Halaman. (Arsip Global: <span className="text-white font-bold">{totalItems}</span> Citra).
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-black font-mono">
              HALAMAN {page}
            </div>

            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}