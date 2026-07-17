"use client";

import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center h-20 px-6 border-b bg-slate-900 border-slate-800 lg:hidden">
      <button onClick={onMenuClick} className="p-2 text-slate-400 hover:text-white">
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}