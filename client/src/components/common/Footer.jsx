import React from 'react';
import { Car, ShieldCheck, QrCode, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-10 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <Car className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-100 text-base">Smart Parking Finder</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Software-managed smart parking solution with real-time slot booking, database concurrency locks, and instant QR verification tickets.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Key Features</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5 text-emerald-400" /> Genuine QR Code Passes</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> ACID Concurrency Locks</li>
              <li className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-purple-400" /> Software-Only Availability</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Quick Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="/explore" className="hover:text-emerald-400 transition">Find Parking Lots</a></li>
              <li><a href="/my-bookings" className="hover:text-emerald-400 transition">My Reserved Tickets</a></li>
              <li><a href="/login" className="hover:text-emerald-400 transition">Sign In</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Academic Note</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Diploma IT Minor Project. Zero dependency on IoT hardware sensors — slot state is managed natively via database records and administrator overrides.
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Smart Parking Finder. All rights reserved.</p>
          <p className="mt-2 sm:mt-0">Built with Node.js, Express, MySQL/SQLite & React Vite</p>
        </div>
      </div>
    </footer>
  );
}
