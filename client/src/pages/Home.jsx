import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  Car, 
  Search, 
  MapPin, 
  QrCode, 
  ShieldCheck, 
  Cpu, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  Zap,
  Clock
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await api.get('/locations');
        if (res.success && res.data) {
          setLocations(res.data.slice(0, 3));
        }
      } catch (err) {
        console.error('Failed to load locations:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    navigate(`/explore?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 overflow-hidden">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] -z-10 rounded-full pointer-events-none"></div>
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[300px] bg-sky-500/10 blur-[120px] -z-10 rounded-full pointer-events-none"></div>

        <div className="max-w-5xl mx-auto px-4 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Diploma IT Minor Project — Software-Managed Architecture</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Smart, Guaranteed Parking{' '}
            <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              With Genuine QR Passes
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            Eliminate parking uncertainty. Check database-backed slot availability in real time, reserve your bay with concurrency locks, and receive an authentic digital ticket.
          </p>

          {/* Quick Search Bar */}
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
            <div className="glass-panel p-2 rounded-2xl flex items-center shadow-2xl border border-slate-700/80">
              <div className="pl-3 text-slate-400">
                <MapPin className="w-5 h-5 text-emerald-400" />
              </div>
              <input
                type="text"
                placeholder="Search by facility name, area, or destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-3 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">Find Slots</span>
              </button>
            </div>
          </form>

          {/* Metric highlights */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero Double Bookings</span>
            </div>
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-sky-400" />
              <span>Instant Base64 QR Passes</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span>Software-Only (No Sensors)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Locations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Featured Parking Locations
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Popular software-managed garages with real-time slot tracking.
            </p>
          </div>
          <Link
            to="/explore"
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <span>View All Facilities</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="glass-panel glass-panel-hover rounded-3xl overflow-hidden border border-slate-800 flex flex-col justify-between"
            >
              <div className="relative h-44 w-full">
                <img
                  src={loc.image_url}
                  alt={loc.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-slate-950/80 backdrop-blur-md text-emerald-400 border border-slate-700">
                  ${Number(loc.hourly_rate).toFixed(2)}/hr
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-bold text-base text-white">{loc.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{loc.address}, {loc.city}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
                  <span className="text-emerald-400 font-medium">
                    {loc.available_slots || loc.total_slots} Slots Available
                  </span>
                  <Link
                    to={`/locations/${loc.id}`}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
                  >
                    Select Slot
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works / Core Architectural Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/40 border border-slate-800/90 relative overflow-hidden">
          <div className="max-w-2xl mb-10">
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Software-Only Architecture Explained
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Designed specifically for our diploma IT project without relying on IoT hardware or unreliable sensors.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Transactional Row Locks</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Uses database transactions with pessimistic row locks to guarantee that two drivers never book the same parking slot at the same time.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Genuine QR Verification</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tickets are embedded with signed QR codes generated server-side. Operators scan passes at the gate to verify entry.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Instant Slot Release</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cancellations immediately recalculate slot availability, making spots accessible to other drivers without lag or manual intervention.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
