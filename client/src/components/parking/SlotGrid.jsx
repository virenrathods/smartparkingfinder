import React, { useState } from 'react';
import {
  Car,
  Zap,
  Accessibility,
  Bike,
  Check
} from 'lucide-react';

export default function SlotGrid({ slots = [], selectedSlot, onSelectSlot }) {
  const [typeFilter, setTypeFilter] = useState('all');

  const getSlotTypeIcon = (type) => {
    switch (type) {
      case 'ev':
        return <Zap className="w-3.5 h-3.5 text-amber-400" title="Electric Vehicle Charging" />;
      case 'accessible':
        return <Accessibility className="w-3.5 h-3.5 text-sky-400" title="Accessible Parking" />;
      case 'bike':
        return <Bike className="w-3.5 h-3.5 text-emerald-400" title="Two Wheeler / Bike" />;
      default:
        return <Car className="w-3.5 h-3.5 text-slate-400" title="Standard Automobile" />;
    }
  };

  const getStatusLabel = (slot) => {
    if (slot.isAvailable) return 'Available';
    const status = slot.effectiveStatus || slot.status;
    switch (status) {
      case 'reserved':
        return 'Reserved';
      case 'occupied':
        return 'Occupied';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Unavailable';
    }
  };

  const getStatusReason = (slot) => {
    if (slot.reason) return slot.reason;
    const status = slot.effectiveStatus || slot.status;
    if (status === 'reserved') return 'Reserved in your chosen time window';
    if (status === 'occupied') return 'Currently occupied by a checked-in vehicle';
    if (status === 'maintenance') return 'Temporarily out of service for maintenance';
    return 'Slot unavailable for reservation';
  };

  // Filter slots
  const filteredSlots = slots.filter((slot) => {
    if (typeFilter === 'all') return true;
    return slot.slot_type === typeFilter;
  });

  const countsByType = {
    all: slots.length,
    car: slots.filter((s) => s.slot_type === 'car').length,
    ev: slots.filter((s) => s.slot_type === 'ev').length,
    accessible: slots.filter((s) => s.slot_type === 'accessible').length,
    bike: slots.filter((s) => s.slot_type === 'bike').length,
  };

  const availableCountsByType = {
    all: slots.filter((s) => s.isAvailable).length,
    car: slots.filter((s) => s.slot_type === 'car' && s.isAvailable).length,
    ev: slots.filter((s) => s.slot_type === 'ev' && s.isAvailable).length,
    accessible: slots.filter((s) => s.slot_type === 'accessible' && s.isAvailable).length,
    bike: slots.filter((s) => s.slot_type === 'bike' && s.isAvailable).length,
  };

  return (
    <div className="space-y-4">
      {/* Category Filter Chips & Status Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: 'All Bays', icon: null },
            { id: 'car', label: 'Cars', icon: Car },
            { id: 'ev', label: 'EV Bays', icon: Zap },
            { id: 'accessible', label: 'Accessible', icon: Accessibility },
            { id: 'bike', label: 'Bikes', icon: Bike },
          ].map((item) => {
            if (countsByType[item.id] === 0 && item.id !== 'all') return null;
            const Icon = item.icon;
            const isActive = typeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTypeFilter(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{item.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isActive ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-900 text-slate-400'
                }`}>
                  {availableCountsByType[item.id]}/{countsByType[item.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      {/* Grid of Slots */}
      {filteredSlots.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/70 rounded-2xl border border-slate-800 text-slate-500 text-xs">
          No parking bays match the selected filter type.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80">
          {filteredSlots.map((slot) => {
            const isSelected = selectedSlot?.id === slot.id;
            const isAvailable = slot.isAvailable;
            const status = slot.effectiveStatus || slot.status;
            const reason = getStatusReason(slot);

            let cardStyle = 'bg-slate-900/50 border-slate-800/80 text-slate-400 cursor-not-allowed opacity-60';
            let ringStyle = '';

            if (isSelected) {
              cardStyle = 'bg-sky-950/80 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/20';
              ringStyle = 'ring-2 ring-sky-400 scale-[1.02]';
            } else if (isAvailable) {
              cardStyle = 'bg-slate-900/90 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/20 cursor-pointer hover:scale-[1.02]';
            } else if (status === 'reserved') {
              cardStyle = 'bg-amber-950/20 border-amber-500/30 text-amber-400/80 cursor-not-allowed';
            } else if (status === 'occupied') {
              cardStyle = 'bg-rose-950/20 border-rose-500/30 text-rose-400/80 cursor-not-allowed';
            } else if (status === 'maintenance') {
              cardStyle = 'bg-slate-900/40 border-slate-800 text-slate-500 cursor-not-allowed';
            }

            return (
              <button
                key={slot.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => onSelectSlot(slot)}
                title={isAvailable ? `Slot ${slot.slot_number} is open for booking` : reason}
                aria-label={`Slot ${slot.slot_number}, ${slot.slot_type}, status: ${getStatusLabel(slot)}`}
                className={`relative flex flex-col items-center justify-between p-3 rounded-xl border transition-all duration-200 text-center select-none group min-h-[96px] ${cardStyle} ${ringStyle}`}
              >
                {/* Top Icons */}
                <div className="w-full flex items-center justify-between text-[10px]">
                  <span className="capitalize text-[10px] font-mono opacity-70">
                    {slot.slot_type}
                  </span>
                  {getSlotTypeIcon(slot.slot_type)}
                </div>

                {/* Slot Number */}
                <div className="my-1.5 font-bold text-sm tracking-wider font-mono">
                  {slot.slot_number}
                </div>

                {/* Status Indicator */}
                <div className="w-full text-[10px] uppercase font-semibold tracking-tighter truncate">
                  {isSelected ? (
                    <span className="flex items-center justify-center gap-1 text-sky-300">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  ) : (
                    <span>{getStatusLabel(slot)}</span>
                  )}
                </div>

                {/* Disabled State Tooltip Hint */}
                {!isAvailable && (
                  <div className="absolute inset-0 bg-transparent" title={reason}></div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
