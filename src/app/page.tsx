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
  const [ledBrightness, setLedBrightness] = useState(20); // <--- TAMBAHKAN INI

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

  // TAMBAHKAN STATE FILTER WAKTU DI BAGIAN ATAS KOMPONEN
  const [timeFilter, setTimeFilter] = useState<number>(1 * 60 * 60 * 1000); // Default 1 Jam dalam milidetik
  const [fullHistory, setFullHistory] = useState<any[]>([]);
  const [filteredChartData, setFilteredChartData] = useState<any[]>([]);

  // 3. MESIN KOMPUTASI FILTER TEMPORAL & SUMBU X ADAPTIF
useEffect(() => {
    if (fullHistory.length === 0) return;
    
    const now = Date.now();
    let threshold = now - timeFilter;
    
    // Filter data mentah berdasarkan epoch timestamp
    const filtered = fullHistory.filter((item: any) => {
        const itemTime = new Date(item.waktu_rekam).getTime();
        return itemTime >= threshold;
    });

    // MESIN FORMAT WAKTU (Resolusi Adaptif)
    const formatted = filtered.map((item: any) => {
        const dateObj = new Date(item.waktu_rekam);
        let timeString = '';

        if (timeFilter <= 24 * 60 * 60 * 1000) {
            // JIKA FILTER 1 - 24 JAM: Tampilkan Jam & Menit saja (Contoh: 14:30)
            timeString = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' });
        } else if (timeFilter <= 7 * 24 * 60 * 60 * 1000) {
            // JIKA FILTER 1 MINGGU: Tampilkan Nama Hari + Jam (Contoh: Sen 14:00)
            timeString = `${dateObj.toLocaleDateString('id-ID', { weekday: 'short' })} ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}`;
        } else {
            // JIKA FILTER > 1 MINGGU / MAX: Tampilkan Tanggal, Bulan, Jam (Contoh: 15/08/2023 14:00)
            timeString = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()} ${dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute:'2-digit' })}`;
        }

        return {
            ...item,
            waktu: timeString // Format waktu yang sudah cerdas masuk ke sini
        };
    });
    
    setFilteredChartData(formatted);
}, [fullHistory, timeFilter]);

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
      try {
        const res = await fetch(`${SERVER_URL}/telemetry/all`);
        if (res.ok) setFullHistory((await res.json()).reverse());
      } catch (error) {
        console.error("Gagal mengambil data historis untuk grafik:", error);
      }
    };
    fetchHistoryData();
  }, []);

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
    <div className="min-h-screen p-8 font-sans bg-slate-900 text-slate-100">
      
      {/* HEADER & SYSTEM HEALTH */}
      <header className="flex items-center justify-between pb-4 mb-8 border-b border-slate-700">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-400">AGROSYNC COMMAND CENTER</h1>
          <p className="mt-1 text-sm text-slate-400">Sistem Pemantauan Mikroklimat & Visi Edge Terdistribusi</p>
        </div>
        
        {/* LENCANA INDIKATOR KONEKTIVITAS (3 STATUS DISKRET) */}
        <div className={`flex items-center px-4 py-2 rounded-full border shadow-md font-semibold tracking-wide text-xs uppercase transition-all
          ${systemHealth === 'ONLINE' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : ''}
          ${systemHealth === 'HARDWARE_OFFLINE' ? 'bg-amber-950/40 border-amber-500 text-amber-400 animate-pulse' : ''}
          ${systemHealth === 'SERVER_OFFLINE' ? 'bg-rose-950/40 border-rose-500 text-rose-400' : ''}
        `}>
          {systemHealth === 'ONLINE' && <CheckCircle className="w-4 h-4 mr-2" />}
          {systemHealth === 'HARDWARE_OFFLINE' && <AlertTriangle className="w-4 h-4 mr-2" />}
          {systemHealth === 'SERVER_OFFLINE' && <XCircle className="w-4 h-4 mr-2" />}
          
          <span>
            {systemHealth === 'ONLINE' && 'SISTEM STABIL (ONLINE)'}
            {systemHealth === 'HARDWARE_OFFLINE' && 'ALAT LAPANGAN MATI (RECONNECTING)'}
            {systemHealth === 'SERVER_OFFLINE' && 'PELADEN MATI (OFFLINE)'}
          </span>
        </div>
      </header>

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

                <select 
                    value={timeFilter}
                    onChange={(e) => {
                      setTimeFilter(Number(e.target.value));
                      // Reset memori Brush setiap kali rentang waktu makro diubah
                      setBrushStartIndex(undefined);
                      setBrushEndIndex(undefined);
                    }}
                    className="px-3 py-2 text-xs font-bold border rounded-lg bg-slate-900 border-slate-700 text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                    <option value={1 * 60 * 60 * 1000}>1 Jam Terakhir</option>
                    <option value={4 * 60 * 60 * 1000}>4 Jam Terakhir</option>
                    <option value={12 * 60 * 60 * 1000}>12 Jam Terakhir</option>
                    <option value={24 * 60 * 60 * 1000}>24 Jam Terakhir</option>
                    <option value={7 * 24 * 60 * 60 * 1000}>1 Minggu Terakhir</option>
                    <option value={30 * 24 * 60 * 60 * 1000}>1 Bulan Terakhir</option>
                    <option value={999999999999999}>Sepanjang Waktu (Max)</option>
                </select>
              </div>
            </div>
            
            {/* KANVAS RECHARTS DENGAN MINIMAP (BRUSH) */}
            <div className="w-full min-h-[380px]" style={{ height: '380px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <LineChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  
                  {/* Sumbu X sekarang menggunakan resolusi adaptif */}
                  <XAxis dataKey="waktu" stroke="#64748b" fontSize={11} tickMargin={10} minTickGap={30} />
                  
                  {/* Sumbu Y Terkondisional */}
                  {(showSuhu || showKelembaban) && (
                    <YAxis yAxisId="left" stroke="#94a3b8" fontSize={11} domain={['auto', 'auto']} tickMargin={5} />
                  )}
                  {showAngin && (
                    <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickMargin={5} />
                  )}
                  
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  
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
                  Pembaruan Terakhir: {visionData.waktu_tangkap ? new Date(visionData.waktu_tangkap).toLocaleString('id-ID') : 'Belum ada data'}
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