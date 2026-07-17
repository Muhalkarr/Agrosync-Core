"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush } from 'recharts';
import { Thermometer, Droplets, Wind, Camera, AlertTriangle, CheckCircle, Activity, XCircle } from 'lucide-react';

// [PERBAIKAN] Gunakan variabel lingkungan untuk URL API. Di produksi, ini akan menjadi path relatif (misal: '/api').
const SERVER_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AgrosyncDashboard() {
  // --- MANAJEMEN STATUS (STATE) ---
  const [latestData, setLatestData] = useState({ suhu: 0, kelembaban: 0, kecepatan_angin: 0, status_alert: 0 });
  const [visionData, setVisionData] = useState({ image_url: '', waktu_tangkap: '' });
  const [systemHealth, setSystemHealth] = useState('ONLINE');
  const [isCommanding, setIsCommanding] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [ledBrightness, setLedBrightness] = useState(20); // <--- JADI DEFAULT 20, BUKAN 0, UNTUK MENCEGAH KAMERA GELAP TOTAL

  // --- LOGIKA AKUISISI DATA TERINTEGRASI & VALIDASI HEARTBEAT ---
  const fetchLatestData = async () => {
    try {
      const [resLatest, resVision] = await Promise.all([
        fetch(`${SERVER_URL}/telemetry/latest`),
        fetch(`${SERVER_URL}/vision/latest`)
      ]);

      // 1. Proses Data Telemetri Terbaru (LATEST) & Validasi Heartbeat
      if (resLatest.ok) {
        const dataLatest = await resLatest.json();
        if (dataLatest) {
          setLatestData({
            suhu: parseFloat(dataLatest.suhu),
            kelembaban: parseFloat(dataLatest.kelembaban),
            kecepatan_angin: parseFloat(dataLatest.kecepatan_angin),
            status_alert: parseInt(dataLatest.status_alert)
          });

          // [PERBAIKAN] Injeksi data terbaru ke dalam riwayat grafik secara real-time
          setFullHistory(prevHistory => {
            // Cek apakah data terbaru ini benar-benar baru dibandingkan data terakhir di grafik
            const lastHistoryItem = prevHistory[prevHistory.length - 1];
            if (lastHistoryItem && new Date(dataLatest.waktu_rekam).getTime() <= new Date(lastHistoryItem.waktu_rekam).getTime()) {
              return prevHistory; // Data tidak baru, jangan lakukan apa-apa
            }
            // Jika baru, tambahkan ke akhir array state
            return [...prevHistory, dataLatest];
          });

          const waktuTerakhirAlat = new Date(dataLatest.waktu_rekam).getTime();
          const waktuSaatIniKlien = Date.now();
          const selisihWaktums = waktuSaatIniKlien - waktuTerakhirAlat;
          
          // Batas Toleransi: 60.000 ms (1 Menit) + 5 detik buffer
          const ambangBatasToleransi = 65000; 

          if (selisihWaktums <= ambangBatasToleransi) {
            setSystemHealth('ONLINE'); // Alat hidup & ngirim data
          } else {
            setSystemHealth('HARDWARE_OFFLINE'); // Server hidup, alat di kebun MATI
          }
        }
      } else if (resLatest.status === 404) {
        // Server merespons, tetapi tidak ada data. Ini berarti alat belum mengirim data.
        setSystemHealth('HARDWARE_OFFLINE');
      } else {
        // Kesalahan lain (500, dll.) menunjukkan masalah pada server.
        setSystemHealth('SERVER_OFFLINE');
      }

      // 2. Proses Data Gambar Terbaru
      if (resVision.ok) {
        const dataVision = await resVision.json();
        setVisionData(dataVision);
      } else if (resVision.status === 404) {
        // Jika tidak ada gambar, pastikan state-nya kosong.
        setVisionData({ image_url: '', waktu_tangkap: '' });
      }

    } catch (error) {
      console.error("[FRONT-END ERROR] Gagal terhubung ke peladen lokal:", error);
      setSystemHealth('SERVER_OFFLINE'); // Jika fetch gagal total (kabel LAN putus/Server mati)
    }
  };

  const [fullHistory, setFullHistory] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  // 3. MESIN FORMATTING DATA GRAFIK
  useEffect(() => {
    if (fullHistory.length === 0) return;

    const formatted = fullHistory.map((item: any) => {
        const timestamp = new Date(item.waktu_rekam);
        // Format menjadi "DD/MM HH:mm" untuk konsistensi
        const year = timestamp.getUTCFullYear();
        const day = String(timestamp.getUTCDate()).padStart(2, '0');
        const month = String(timestamp.getUTCMonth() + 1).padStart(2, '0');
        const hours = String(timestamp.getUTCHours()).padStart(2, '0');
        const minutes = String(timestamp.getUTCMinutes()).padStart(2, '0');

        return {
            ...item,
            waktu: `${day}/${month}/${year} ${hours}:${minutes}`
        };
    });
    
    setChartData(formatted);
  }, [fullHistory]);

// STATE VISIBILITAS GRAFIK SENSOR
  const [showSuhu, setShowSuhu] = useState(true);
  const [showKelembaban, setShowKelembaban] = useState(true);
  const [showAngin, setShowAngin] = useState(true);

  // ====================================================================
  // STATE BARU: Memori Posisi Minimap Brush (Mencegah Reset saat Polling)
  // ====================================================================
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  

  // --- SIKLUS HIDUP KOMPONEN (POLLING) ---
  useEffect(() => {
    // Ambil data terbaru saat pertama kali dimuat
    fetchLatestData(); 
    // Atur interval untuk hanya mengambil data terbaru
    const interval = setInterval(fetchLatestData, 5000); 
    return () => clearInterval(interval); // Bersihkan memori saat tab ditutup
  }, []);

  // --- SIKLUS HIDUP KOMPONEN (HANYA SEKALI UNTUK DATA HISTORIS) ---
  useEffect(() => {
    const fetchHistoryData = async () => {
      setIsFetchingHistory(true);
      const url = `${SERVER_URL}/telemetry/graph-history`;

      try {
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setFullHistory(data);
          // [PERBAIKAN UX] Set brush untuk menampilkan 100 data terakhir secara default
          if (data.length > 100) {
            setBrushStartIndex(data.length - 100);
            setBrushEndIndex(data.length - 1);
          }
        }
      } catch (error) {
        console.error("Gagal mengambil data historis untuk grafik:", error);
        setFullHistory([]); // Kosongkan data jika gagal
      } finally {
        setIsFetchingHistory(false);
      }
    };
    fetchHistoryData();
  }, []); // <-- Dependensi kosong, hanya berjalan sekali saat komponen dimuat

  // --- LOGIKA EKSEKUSI INSPEKSI MANUAL ---
  const triggerManualInspection = async () => {
    setIsCommanding(true);
    try {
      const res = await fetch(`${SERVER_URL}/command/trigger-camera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // <-- WAJIB ADA
        body: JSON.stringify({ kecerahan: ledBrightness }) // <-- BUNGKUS PAYLOAD
      });
      if (res.ok) {
        alert(`Instruksi dikirim! Kamera akan memotret dengan tingkat kecerahan ${ledBrightness}/255.`);
      }
    } catch (error) {
      alert("Gagal mengirim instruksi ke peladen.");
    }
    setTimeout(() => setIsCommanding(false), 5000);
  };

  const syncBrightnessToServer = async (newVal: number) => {
    try {
      await fetch(`${SERVER_URL}/command/brightness`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kecerahan: newVal })
      });
    } catch (error) {
      console.error("Gagal sinkronisasi kecerahan LED.");
    }
  };

  return (
    <div className="p-4 font-sans md:p-8">
      
      {/* HEADER & SYSTEM HEALTH */}
      <div className="flex flex-col items-start justify-between gap-4 pb-4 mb-8 border-b md:flex-row md:items-center border-slate-700">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">AGROSYNC COMMAND CENTER</h1>
          <p className="mt-1 text-sm text-slate-400">Sistem Pemantauan Mikroklimat & Visi Edge Terdistribusi</p>
        </div>
        
        {/* LENCANA INDIKATOR KONEKTIVITAS (3 STATUS DISKRET) */}
        <div className={`flex items-center px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-all border rounded-full shadow-md
          ${systemHealth === 'ONLINE' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : ''}
          ${systemHealth === 'HARDWARE_OFFLINE' ? 'bg-amber-950/40 border-amber-500 text-amber-400 animate-pulse' : ''}
          ${systemHealth === 'SERVER_OFFLINE' ? 'bg-rose-950/40 border-rose-500 text-rose-400' : ''}
        `}>
          {systemHealth === 'ONLINE' && <CheckCircle className="w-4 h-4 mr-1.5" />}
          {systemHealth === 'HARDWARE_OFFLINE' && <AlertTriangle className="w-4 h-4 mr-1.5" />}
          {systemHealth === 'SERVER_OFFLINE' && <XCircle className="w-4 h-4 mr-1.5" />}
          
          <span>
            {systemHealth === 'ONLINE' && 'SISTEM STABIL (ONLINE)'}
            {systemHealth === 'HARDWARE_OFFLINE' && 'ALAT LAPANGAN MATI (RECONNECTING)'}
            {systemHealth === 'SERVER_OFFLINE' && 'PELADEN MATI (OFFLINE)'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* KOLOM KIRI: WIDGET TELEMETRI & GRAFIK (2 Kolom di Layar Besar) */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* PANEL KARTU METRIK UTAMA */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-400">Suhu Udara</p>
                <p className="mt-1 text-4xl font-bold text-white">{latestData.suhu}<span className="ml-1 text-xl text-slate-500">°C</span></p>
              </div>
              <Thermometer className="w-12 h-12 text-rose-500 opacity-80" />
            </div>
            
            <div className="flex items-center justify-between p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-400">Kelembaban (RH)</p>
                <p className="mt-1 text-4xl font-bold text-white">{latestData.kelembaban}<span className="ml-1 text-xl text-slate-500">%</span></p>
              </div>
              <Droplets className="w-12 h-12 text-blue-500 opacity-80" />
            </div>

            <div className="flex items-center justify-between p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-400">Kecepatan Angin</p>
                <p className="mt-1 text-4xl font-bold text-white">{latestData.kecepatan_angin}<span className="ml-1 text-xl text-slate-500">m/s</span></p>
              </div>
              <Wind className="w-12 h-12 text-slate-400 opacity-80" />
            </div>
          </div>

          {/* PANEL GRAFIK HISTORIS (DATA SCIENCE VIEW)
          <div className="p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
            <div className="flex items-center mb-6">
              <Activity className="w-5 h-5 mr-2 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Fluktuasi Mikroklimat</h2>
            </div>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="waktu" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke="#f43f5e" fontSize={12} domain={['dataMin - 2', 'dataMax + 2']} />
                  <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                  <Line yAxisId="left" type="monotone" dataKey="suhu" name="Suhu (°C)" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="kelembaban" name="Kelembaban (%)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div> */}

          {/* PANEL GRAFIK HISTORIS DINAMIS & SKALABEL */}
          <div className="p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
            
            {/* SUB-HEADER: Sakelar Sensor & Filter Waktu */}
            <div className="flex flex-col items-start justify-between gap-4 pb-4 mb-6 border-b md:flex-row md:items-center border-slate-700">
              <div className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Fluktuasi Mikroklimat</h2>
              </div>
              
              <div className="flex flex-wrap items-center justify-end w-full gap-3 md:w-auto">
                {/* SAKELAR VISIBILITAS SENSOR */}
                <div className="flex p-1 text-xs font-bold border rounded-lg bg-slate-900 border-slate-700">
                  <button 
                    onClick={() => setShowSuhu(!showSuhu)}
                    className={`px-3 py-1.5 rounded transition-all ${showSuhu ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    SUHU
                  </button>
                  <button 
                    onClick={() => setShowKelembaban(!showKelembaban)}
                    className={`px-3 py-1.5 rounded transition-all ${showKelembaban ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    RH (%)
                  </button>
                  <button 
                    onClick={() => setShowAngin(!showAngin)}
                    className={`px-3 py-1.5 rounded transition-all ${showAngin ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    ANGIN
                  </button>
                </div>
              </div>
            </div>
            
            {/* KANVAS RECHARTS DENGAN MINIMAP (BRUSH) */}
            <div className="w-full min-h-[380px] relative" style={{ height: '380px' }}>
              {isFetchingHistory && (
                <div className="absolute inset-0 z-10 flex items-center justify-center font-mono text-sm text-center rounded-lg bg-slate-800/80 text-emerald-400 animate-pulse">
                  MEMUAT DATA HISTORIS DARI SERVER...
                </div>
              )}
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  
                  {/* Sumbu X sekarang menggunakan resolusi adaptif */}
                  <XAxis dataKey="waktu" stroke="#64748b" fontSize={11} tickMargin={10} minTickGap={30} />
                  
                  {/* Sumbu Y Terkondisional */}
                  {(showSuhu || showKelembaban) && (
                    // [PERBAIKAN] Domain dinamis dengan bantalan untuk mencegah pemotongan grafik.
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} domain={['dataMin - 2', 'dataMax + 5']} tickMargin={5} />
                  )}
                  {showAngin && (
                    // [PERBAIKAN] Domain khusus untuk angin, memastikan rentang minimal terlihat.
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} domain={[0, 'dataMax + 1']} tickMargin={5} />
                  )}
                  
                  <Tooltip 
                    // [PERBAIKAN] Atur warna latar & border tooltip.
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} 
                    // [PERBAIKAN] Atur warna teks label waktu (sumbu-X) menjadi putih agar mudah dibaca.
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  
                  {/* RENDER GARIS BERDASARKAN SAKELAR */}
                  {showSuhu && <Line yAxisId="left" type="monotone" dataKey="suhu" name="Suhu (°C)" stroke="#f43f5e" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />}
                  {showKelembaban && <Line yAxisId="left" type="monotone" dataKey="kelembaban" name="RH (%)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />}
                  {showAngin && <Line yAxisId="right" type="stepAfter" dataKey="kecepatan_angin" name="Angin (m/s)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} opacity={0.7} />}
                  
                  {/* MINIMAP SCROLLBAR (BRUSH) - DENGAN STATE DECOUPLING ANTI-RESET */}
                    <Brush 
                      dataKey="waktu" 
                      height={30} 
                      stroke="#475569" 
                      fill="#0f172a" 
                      travellerWidth={10}
                      startIndex={brushStartIndex}
                      endIndex={brushEndIndex}
                      onChange={(newIndex) => {
                        // Tangkap posisi baru saat pengguna selesai menggeser Brush
                        if (newIndex.startIndex !== undefined && newIndex.endIndex !== undefined) {
                          setBrushStartIndex(newIndex.startIndex);
                          setBrushEndIndex(newIndex.endIndex);
                        }
                      }}
                    />
                  
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* KOLOM KANAN: EDGE VISION & KONTROL MANUAL */}
        <div className="space-y-6">
          <div className="flex flex-col h-full p-6 border shadow-lg bg-slate-800 rounded-xl border-slate-700">
            
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="flex items-center text-xl font-bold text-white">
                  <Camera className="w-5 h-5 mr-2 text-emerald-400" />
                  Visualisasi Perangkap
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Pembaruan Terakhir: {visionData.waktu_tangkap ? new Date(visionData.waktu_tangkap).toISOString().replace('T', ' ').substring(0, 16) : 'Belum ada data'}
                </p>
              </div>
              {latestData.status_alert === 1 && (
                <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-rose-500 animate-pulse">
                  HAMA MASUK
                </span>
              )}
            </div>

            {/* RENDER GAMBAR JPEG DARI NODE.JS */}
            <div className="relative w-full mb-6 overflow-hidden bg-black border rounded-lg aspect-video border-slate-700">
              {visionData.image_url ? (
                <Image 
                  src={visionData.image_url} 
                  alt="Tangkapan ESP32-CAM"
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full font-mono text-sm text-slate-600">
                  TIDAK ADA SINYAL VIDEO
                </div>
              )}
            </div>

          {/* KENDALI OPTIK (SLIDER KECERAHAN) */}
            <div className="p-4 my-4 border rounded-lg bg-slate-900 border-slate-700">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold tracking-wider uppercase text-slate-400">
                  Intensitas LED Flash
                </label>
                <span className="font-mono font-bold text-emerald-400">{ledBrightness}/255</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="255" 
                value={ledBrightness} 
                onChange={(e) => setLedBrightness(parseInt(e.target.value))}
                onMouseUp={(e) => syncBrightnessToServer(parseInt((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => syncBrightnessToServer(parseInt((e.target as HTMLInputElement).value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-emerald-500"
              />
              <p className="mt-2 text-xs text-slate-500">
                Geser untuk menyesuaikan pencahayaan saat tombol inspeksi ditekan.
              </p>
            </div>

            {/* TOMBOL INSPEKSI PIGGYBACK POLLING */}
            <button
              onClick={triggerManualInspection}
              disabled={isCommanding || systemHealth !== 'ONLINE'}
              className={`w-full py-1 rounded-lg font-bold transition-all shadow-lg flex items-center justify-center ${
                isCommanding || systemHealth !== 'ONLINE'
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/25 active:scale-[0.98]'
              }`}
            >
              {isCommanding ? 'MENGIRIM INSTRUKSI...' : 'INSPEKSI MANUAL (Potret Sekarang)'}
            </button>


            {/* ZONA PLACEHOLDER KECERDASAN BUATAN (YOLOv8) */}
            <div className="p-4 mt-6 border rounded-lg bg-slate-900 border-slate-700">
              <h3 className="mb-2 text-xs font-bold tracking-wider uppercase text-slate-500">Diagnosis Edge AI (YOLOv8)</h3>
              <p className="font-mono text-sm text-emerald-400">STATUS: MENUNGGU MODEL PYTHON...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}