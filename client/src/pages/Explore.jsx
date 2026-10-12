import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import LocationCard from '../components/parking/LocationCard';
import FilterBar from '../components/parking/FilterBar';
import ParkingMap from '../components/map/ParkingMap';
import { Compass, AlertCircle, RefreshCw } from 'lucide-react';

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [filters, setFilters] = useState({
    search: initialSearch,
    maxPrice: 15,
    availableOnly: false
  });

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.maxPrice) queryParams.append('maxPrice', filters.maxPrice);
      if (filters.availableOnly) queryParams.append('availableOnly', 'true');

      const res = await api.get(`/locations?${queryParams.toString()}`);
      if (res.success && res.data) {
        setLocations(res.data);
        if (res.data.length > 0 && !selectedLocation) {
          setSelectedLocation(res.data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Compass className="w-7 h-7 text-emerald-400" />
            <span>Find & Reserve Parking</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Explore verified parking garages, compare rates, and select open bays.
          </p>
        </div>

        <button
          onClick={fetchLocations}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Availability</span>
        </button>
      </div>

      {/* Filter Controls */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onReset={() => setFilters({ search: '', maxPrice: 15, availableOnly: false })}
      />

      {/* Main Split Layout: Left Locations List, Right Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Showing {locations.length} verified facilities</span>
            {filters.availableOnly && (
              <span className="text-emerald-400">Filtering: Available slots only</span>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-44 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800"></div>
              ))}
            </div>
          ) : locations.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <AlertCircle className="w-10 h-10 text-slate-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-300">No Facilities Match Your Filters</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try widening your search keywords or increasing the maximum hourly price slider.
              </p>
              <button
                onClick={() => setFilters({ search: '', maxPrice: 15, availableOnly: false })}
                className="mt-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <LocationCard
                  key={loc.id}
                  location={loc}
                  isSelected={selectedLocation?.id === loc.id}
                  onSelect={() => setSelectedLocation(loc)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Map */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="space-y-2">
            <ParkingMap
              locations={locations}
              selectedLocation={selectedLocation}
              onSelectLocation={(loc) => setSelectedLocation(loc)}
            />
            <p className="text-[11px] text-slate-500 text-center">
              Click pins to inspect facility details or click directions to open in Google Maps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
