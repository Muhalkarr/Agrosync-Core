"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // <-- Impor komponen Image
import { ChevronLeft, ChevronRight, Filter, Grid, Tag, Sliders, AlertCircle } from 'lucide-react';

// [PERBAIKAN] Gunakan variabel lingkungan untuk URL API. Di produksi, ini akan menjadi path relatif (misal: '/api').
const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
      const res = await fetch(`${SERVER_URL}/vision/archive?page=${page}&limit=${limit}&label=${labelFilter}`);
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
      const res = await fetch(`${SERVER_URL}/vision/label/${id}`, {
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
    <div className="min-h-screen p-8 space-y-6 bg-slate-950 text-slate-100">
      
      {/* HEADER UTAMA */}
      <div className="pb-4 border-b border-slate-800">
        <h1 className="text-3xl font-bold tracking-tight text-emerald-400">ARSIP VISI EDGE</h1>
        <p className="mt-1 text-sm text-slate-400">Kurasi Kualitas Optik & Alat Pelabelan Dataset Mandiri untuk Pra-Pelatihan YOLOv8</p>
      </div>

      {/* BILAH KONTROL: FILTER & KUSTOMISASI PANJANG DATA (LIMIT) */}
      <div className="flex flex-col items-center justify-between gap-4 p-4 border shadow-lg bg-slate-900 rounded-xl border-slate-800 md:flex-row">
        
        {/* KONTROL FILTER KATEGORI LABEL */}
        <div className="flex items-center w-full space-x-3 md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="hidden text-sm text-slate-400 sm:inline">Filter Status:</span>
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
        <div className="flex items-center justify-end w-full space-x-2 text-sm text-slate-400 md:w-auto">
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
        <div className="p-40 font-mono text-sm tracking-widest text-center text-emerald-400 animate-pulse">
          MEMUAT MATRIKS BINER GAMBAR DARI HARD DISK SERVER LOKAL...
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 font-mono text-sm text-center border bg-slate-900 border-slate-800 rounded-xl text-slate-500">
          <AlertCircle className="w-10 h-10 mb-3 text-slate-700" />
          TIDAK ADA REKAMAN CITRA YANG MEMENUHI KRITERIA FILTER INI.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => (
            <div key={img.id} className="flex flex-col overflow-hidden transition-all border shadow-md bg-slate-900 rounded-xl border-slate-800 group hover:border-slate-700">
              
              {/* AREA FOTO JPEG DARI SERVER */}
              <div className="relative overflow-hidden bg-black border-b aspect-video border-slate-800">
                <Image 
                  src={img.image_url} 
                  alt="Citra Perangkap" 
                  fill // <-- Gunakan 'fill' untuk mengisi div parent
                  className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={index < 4} // Prioritaskan pemuatan 4 gambar pertama
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
              <div className="flex flex-col justify-between flex-1 p-4 space-y-4">
                <div className="space-y-1 font-mono text-xs text-slate-400">
                  <p className="font-bold text-slate-500">ID BERKAS: #{img.id}</p>
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
        <div className="flex flex-col items-center justify-between gap-4 p-4 text-sm border shadow-inner bg-slate-900 border-slate-800 rounded-xl sm:flex-row text-slate-400">
          <div>
            Menampilkan Lembar <span className="font-bold text-white">{page}</span> dari total <span className="font-bold text-emerald-400">{totalPages}</span> Halaman. (Arsip Global: <span className="font-bold text-white">{totalItems}</span> Citra).
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="p-2 transition-colors border rounded-lg bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="px-4 py-2 font-mono font-black border rounded-lg bg-slate-950 border-slate-800 text-emerald-400">
              HALAMAN {page}
            </div>

            <button
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              disabled={page === totalPages}
              className="p-2 transition-colors border rounded-lg bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}