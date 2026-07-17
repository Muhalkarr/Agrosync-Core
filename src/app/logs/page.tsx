"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Power, PowerOff, Wifi, WifiOff } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  source: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>('CONNECTING');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Tentukan URL WebSocket berdasarkan lingkungan
    // [PERBAIKAN] Gunakan EventSource untuk koneksi yang lebih tangguh terhadap proxy
    const sseUrl = `/api/log-stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      setConnectionStatus('OPEN');
    };

    eventSource.onmessage = (event) => {
      try {
        const newLog: LogEntry = JSON.parse(event.data);
        setLogs(prevLogs => [...prevLogs, newLog].slice(-200)); // Batasi log hingga 200 baris
      } catch (error) {
        console.error("Gagal mem-parsing pesan log dari SSE:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource Error:", error);
      setConnectionStatus('CLOSED');
      // EventSource akan mencoba menyambung ulang secara otomatis.
      // Kita hanya perlu menutupnya jika komponen di-unmount.
    };

    // Bersihkan koneksi saat komponen di-unmount
    return () => {
      eventSource.close();
    };
  }, []);

  // Auto-scroll ke bawah setiap kali ada log baru
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Filter logs based on state
  const filteredLogs = logs.filter(log => {
    const levelMatch = levelFilter === 'all' || log.level === levelFilter;
    const sourceMatch = sourceFilter === 'all' || log.source === sourceFilter;
    return levelMatch && sourceMatch;
  });

  // Get unique sources for filter buttons
  const uniqueSources = [...new Set(logs.map(log => log.source))];

  const getStatusIndicator = () => {
    switch (connectionStatus) {
      case 'OPEN':
        return <><Wifi className="w-4 h-4 mr-2 text-emerald-400" /> TERHUBUNG KE LOG STREAM</>;
      case 'CONNECTING':
        return <><Power className="w-4 h-4 mr-2 text-amber-400 animate-pulse" /> MENYAMBUNGKAN...</>;
      case 'CLOSED':
        return <><WifiOff className="w-4 h-4 mr-2 text-rose-500" /> KONEKSI TERPUTUS</>;
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case 'error': return 'text-rose-400';
      case 'warn': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] p-4 md:p-8">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-700">
        <h1 className="flex items-center text-2xl font-bold text-emerald-400">
          <Terminal className="w-6 h-6 mr-3" />
          Log Server Real-time
        </h1>
        <div className="flex items-center px-3 py-1 text-xs font-bold tracking-wider uppercase border rounded-full border-slate-600 bg-slate-800/50 text-slate-400">
          {getStatusIndicator()}
        </div>
      </div>
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-4 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-400">Level:</span>
          {(['all', 'info', 'warn', 'error'] as const).map(level => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                levelFilter === level ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-400">Source:</span>
          {(['all', ...uniqueSources]).map(source => (
            <button
              key={source}
              onClick={() => setSourceFilter(source)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${
                sourceFilter === source ? 'bg-sky-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {source.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div ref={logContainerRef} className="flex-1 p-4 overflow-y-auto font-mono text-xs border rounded-lg bg-slate-950 border-slate-800">
        {filteredLogs.map((log, index) => (
          // [PERBAIKAN KUALITAS] Hindari penggunaan 'index' sebagai key. Kombinasi timestamp dan index lebih stabil.
          <div key={`${log.timestamp}-${index}`} className={`flex items-start ${getLogLevelClass(log.level)}`}>
            <span className="w-40 text-slate-600">{log.timestamp.substring(11, 19)}</span>
            <span className="w-24 font-bold text-slate-500">[{log.source}]</span>
            <p className="flex-1 break-words whitespace-pre-wrap">{log.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}