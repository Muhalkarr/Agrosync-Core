"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Camera, LineChart, ShieldAlert, Settings, Menu, ChevronLeft } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname(); 
  
  // STATE MUTLAK: Mengingat apakah sidebar sedang ditutup atau dibuka
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { name: 'Command Center', path: '/', icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0" /> },
    { name: 'Arsip Visi Edge', path: '/vision', icon: <Camera className="w-5 h-5 flex-shrink-0" /> },
    { name: 'Analisis Eksekutif', path: '/analytics', icon: <LineChart className="w-5 h-5 flex-shrink-0" /> },
    { name: 'Log Anomali', path: '/logs', icon: <ShieldAlert className="w-5 h-5 flex-shrink-0" /> },
  ];

  return (
    <aside 
      // MANIPULASI LEBAR DINAMIS: w-64 (Buka) vs w-20 (Tutup) + Animasi Transisi
      className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out relative z-50`}
    >
      {/* HEADER & TOMBOL TOGGLE */}
      <div className={`h-20 flex items-center border-b border-slate-800 ${isCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
        
        {/* IDENTITAS SISTEM (Sembunyikan saat ditutup) */}
        {!isCollapsed && (
          <div className="flex items-center overflow-hidden">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mr-3 shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <span className="text-slate-900 font-bold text-xl">A</span>
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="text-emerald-400 font-bold text-lg tracking-wider leading-tight">AGROSYNC</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Core v1.0</span>
            </div>
          </div>
        )}

        {/* TOMBOL KENDALI BUKA/TUTUP */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors flex-shrink-0"
          title={isCollapsed ? "Perluas Menu" : "Kecilkan Menu"}
        >
          {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* STRUKTUR NAVIGASI */}
      <nav className="flex-1 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
        
        {/* Label Grup Navigasi */}
        <div className={`text-xs font-bold text-slate-500 mb-4 uppercase tracking-wider transition-all duration-300 ${isCollapsed ? 'text-center text-[10px]' : 'ml-6'}`}>
          {isCollapsed ? 'MOD' : 'Modul Operasional'}
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              title={isCollapsed ? item.name : ""} // Memunculkan tooltip nama saat ditutup
              className={`flex items-center py-3 transition-all duration-200 group mx-3 rounded-lg
                ${isActive 
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20 shadow-inner' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}
                ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
            >
              <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'} ${!isCollapsed && 'mr-3'}`}>
                {item.icon}
              </div>
              
              {/* TEKS MENU (Sembunyikan saat ditutup) */}
              {!isCollapsed && (
                <span className="whitespace-nowrap">{item.name}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* AREA FOOTER (Pengaturan) */}
      <div className="p-3 border-t border-slate-800">
        <button 
          title={isCollapsed ? "Pengaturan" : ""}
          className={`flex items-center py-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors w-full
            ${isCollapsed ? 'justify-center px-0' : 'px-4'}`}
        >
          <Settings className={`w-5 h-5 flex-shrink-0 ${!isCollapsed && 'mr-3'}`} />
          {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Pengaturan</span>}
        </button>
      </div>
    </aside>
  );
}