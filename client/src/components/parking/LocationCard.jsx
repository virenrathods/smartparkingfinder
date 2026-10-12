import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, DollarSign, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function LocationCard({ location, isSelected, onSelect }) {
  const availableSlots = Number(location.available_slots !== undefined ? location.available_slots : location.total_slots);
  const totalSlots = Number(location.total_slots || 0);
  const isSoldOut = availableSlots === 0;

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'bg-slate-900 border-sky-500 shadow-xl shadow-sky-500/10 ring-1 ring-sky-500'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      {/* Top Banner Image with Overlay */}
      <div className="relative h-40 w-full overflow-hidden bg-slate-950">
        <img
          src={location.image_url || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'}
          alt={location.name}
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>

        {/* Pricing Badge */}
        <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 backdrop-blur-md border border-slate-700 text-emerald-400 shadow-lg">
          ${Number(location.hourly_rate).toFixed(2)} / hr
        </div>

        {/* Availability Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md shadow-md bg-slate-950/80 border border-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              isSoldOut ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'
            }`}
          ></span>
          <span className={isSoldOut ? 'text-rose-400' : 'text-emerald-300'}>
            {availableSlots} / {totalSlots} slots available
          </span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-lg text-slate-100 tracking-tight group-hover:text-emerald-400 transition">
            {location.name}
          </h3>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{location.address}, {location.city}</span>
          </p>

          <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
            {location.description || 'Secure software-managed parking garage with 24/7 access.'}
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>{location.opening_time} - {location.closing_time}</span>
          </div>

          <Link
            to={`/locations/${location.id}`}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition"
          >
            <span>Select Slot</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
