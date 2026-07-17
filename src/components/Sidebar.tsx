"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Eye, BarChart3, ShieldAlert, X } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navLinks = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Arsip Visi', href: '/vision', icon: Eye },
  { name: 'Analisis Data', href: '/analytics', icon: BarChart3 },
  { name: 'Log Anomali', href: '/logs', icon: ShieldAlert },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay untuk mobile */}
      <div
        className={clsx(
          'fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity lg:hidden',
          { 'opacity-100 pointer-events-auto': isOpen, 'opacity-0 pointer-events-none': !isOpen }
        )}
        onClick={onClose}
      />

      {/* Konten Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-30 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          { 'translate-x-0': isOpen, '-translate-x-full': !isOpen }
        )}
      >
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-emerald-400">🌾 AGROSYNC</h1>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white lg:hidden">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="p-4">
          <ul>
            {navLinks.map((link) => (
              <li key={link.name}>
                <Link href={link.href} onClick={onClose} className={clsx('flex items-center px-4 py-3 my-1 text-sm font-medium rounded-lg transition-colors', { 'bg-slate-800 text-white': pathname === link.href, 'text-slate-400 hover:bg-slate-800 hover:text-white': pathname !== link.href, })}>
                  <link.icon className="w-5 h-5 mr-3" />
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
}