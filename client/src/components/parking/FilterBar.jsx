import React from 'react';
import { Search, Filter, DollarSign, SlidersHorizontal, X } from 'lucide-react';

export default function FilterBar({ filters, setFilters, onReset }) {
  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="glass-panel p-4 rounded-2xl shadow-lg border border-slate-800 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search Query */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by facility name, address, or area..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Max Hourly Price Slider / Input */}
        <div>
          <div className="flex justify-between items-center text-xs text-slate-400 mb-1 px-1">
            <span>Max Price / hr</span>
            <span className="font-semibold text-emerald-400">${filters.maxPrice}</span>
          </div>
          <input
            type="range"
            min="1"
            max="15"
            step="0.5"
            value={filters.maxPrice}
            onChange={(e) => handleChange('maxPrice', e.target.value)}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Available Only Switch */}
        <div className="flex items-center justify-between md:justify-center gap-3 px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800">
          <label htmlFor="availOnly" className="text-xs font-medium text-slate-300 cursor-pointer select-none">
            Available Only
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
    </div>
  );
}
