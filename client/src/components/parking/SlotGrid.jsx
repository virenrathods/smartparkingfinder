import React from 'react';
import { Car, Zap, Accessibility, Bike, Wrench, ShieldAlert, Check } from 'lucide-react';

export default function SlotGrid({ slots = [], selectedSlot, onSelectSlot }) {
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

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <span className="font-semibold text-slate-300">Status Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500"></span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500"></span>
          <span>Reserved (Window)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500/20 border border-rose-500"></span>
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-700/60 border border-slate-600"></span>
          <span>Maintenance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-sky-500/40 border-2 border-sky-400"></span>
          <span>Selected</span>
        </div>
      </div>

      {/* Grid of Slots */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 p-4 bg-slate-950/70 rounded-2xl border border-slate-800/80">
        {slots.map((slot) => {
          const isSelected = selectedSlot?.id === slot.id;
          const isAvailable = slot.isAvailable;
          const status = slot.effectiveStatus || slot.status;

          let cardStyle = 'bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed opacity-60';
          let ringStyle = '';

          if (isSelected) {
            cardStyle = 'bg-sky-950/60 border-sky-400 text-sky-200 shadow-lg shadow-sky-500/20';
            ringStyle = 'ring-2 ring-sky-400';
          } else if (isAvailable) {
            cardStyle = 'bg-slate-900/90 border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/20 cursor-pointer';
          } else if (status === 'reserved') {
            cardStyle = 'bg-amber-950/20 border-amber-500/30 text-amber-400/80 cursor-not-allowed';
          } else if (status === 'occupied') {
            cardStyle = 'bg-rose-950/20 border-rose-500/30 text-rose-400/80 cursor-not-allowed';
          } else if (status === 'maintenance') {
            cardStyle = 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed';
          }

          return (
            <button
              key={slot.id}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelectSlot(slot)}
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
                  <span>{status}</span>
                )}
              </div>

              {/* Disabled Tooltip / Reason */}
              {!isAvailable && (
                <div className="absolute inset-0 bg-transparent" title={slot.reason || 'Slot not available'}></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
