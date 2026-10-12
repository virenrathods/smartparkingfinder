import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { 
  ShieldAlert, 
  Users, 
  MapPin, 
  Grid, 
  Ticket, 
  DollarSign, 
  Wrench, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard-stats');
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Admin Control Center
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-400">System Healthy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Parking Operations & Analytics
          </h1>
        </div>

        <button
          onClick={fetchStats}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Registered Drivers</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {loading ? '—' : stats?.totalUsers}
          </p>
          <span className="text-[11px] text-slate-500">Active user accounts</span>
        </div>

        {/* Total Facilities */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Parking Locations</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {loading ? '—' : stats?.totalLocations}
          </p>
          <span className="text-[11px] text-slate-500">Managed decks & garages</span>
        </div>

        {/* Total Slots */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Parking Bays</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Grid className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            {loading ? '—' : stats?.slots?.total}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <span>{stats?.slots?.available || 0} Open</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{stats?.slots?.maintenance || 0} Maint.</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Estimated Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white">
            ${loading ? '—' : stats?.estimatedRevenue}
          </p>
          <span className="text-[11px] text-slate-500">
            From {stats?.bookings?.total || 0} reservations
          </span>
        </div>
      </div>

      {/* Admin Modules Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/admin/locations"
          className="glass-panel glass-panel-hover p-6 rounded-2xl border border-slate-800 space-y-3 block group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Manage Locations</h3>
            <p className="text-xs text-slate-400 mt-1">
              Add new facilities, edit hourly rates, addresses, and operating hours.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold pt-2">
            <span>Configure</span> <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/admin/slots"
          className="glass-panel glass-panel-hover p-6 rounded-2xl border border-slate-800 space-y-3 block group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Manage Slots & Overrides</h3>
            <p className="text-xs text-slate-400 mt-1">
              Manually set slot status (Maintenance, Occupied, Available) with audit logs.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-purple-400 font-semibold pt-2">
            <span>Slot Grid</span> <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/admin/bookings"
          className="glass-panel glass-panel-hover p-6 rounded-2xl border border-slate-800 space-y-3 block group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Bookings & Gate Check-In</h3>
            <p className="text-xs text-slate-400 mt-1">
              Search booking tickets, scan QR codes, and record driver check-in / check-out.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-sky-400 font-semibold pt-2">
            <span>Gate Operations</span> <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>

        <Link
          to="/admin/reports"
          className="glass-panel glass-panel-hover p-6 rounded-2xl border border-slate-800 space-y-3 block group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Reports & Analytics</h3>
            <p className="text-xs text-slate-400 mt-1">
              Occupancy percentage per location, historical audit logs, and revenue.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-semibold pt-2">
            <span>View Reports</span> <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
