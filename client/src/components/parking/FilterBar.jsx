import React from 'react';
import { Search, Filter, DollarSign, Zap, Accessibility, Bike, Car, RotateCcw } from 'lucide-react';

export default function FilterBar({ filters, setFilters, onReset }) {
  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const vehicleTypes = [
    { id: '', label: 'All Bays', icon: null },
    { id: 'car', label: 'Car', icon: Car },
    { id: 'ev', label: 'EV Charger', icon: Zap },
    { id: 'accessible', label: 'Accessible', icon: Accessibility },
    { id: 'bike', label: 'Bike', icon: Bike },
  ];

  const hasActiveFilters = filters.search || filters.maxPrice < 15 || filters.availableOnly || filters.slotType;

  return (
    <div className="glass-panel p-5 rounded-2xl shadow-xl border border-slate-800 space-y-4">
      {/* Search Input Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="relative md:col-span-6">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by facility name, address, or city..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Max Hourly Price Slider */}
        <div className="md:col-span-4 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-center">
          <div className="flex justify-between items-center text-xs text-slate-300 mb-1 px-1">
            <span className="font-medium">Max Hourly Rate</span>
            <span className="font-bold text-emerald-400">${Number(filters.maxPrice).toFixed(2)}/hr</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={filters.maxPrice}
            onChange={(e) => handleChange('maxPrice', Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Available Only Switch */}
        <div className="md:col-span-2 flex items-center justify-between md:justify-center gap-2.5 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
          <label htmlFor="availOnly" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
            Open Only
          </label>
          <input
            id="availOnly"
            type="checkbox"
            checked={filters.availableOnly}
            onChange={(e) => handleChange('availableOnly', e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 bg-slate-800 border-slate-700 focus:ring-emerald-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Vehicle Type Filter Pills & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 font-medium mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Bay Type:
          </span>
          {vehicleTypes.map((t) => {
            const Icon = t.icon;
            const isSelected = (filters.slotType || '') === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleChange('slotType', t.id)}
                className={`px-3 py-1.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-slate-900"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
}
