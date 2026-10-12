import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import TicketCard from '../components/ticket/TicketCard';
import { Ticket, AlertCircle, RefreshCw, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, confirmed, completed, cancelled

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/my');
      if (res.success && res.data) {
        setBookings(res.data);
      }
    } catch (err) {
      console.error('Failed to load user bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelSuccess = (cancelledId) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === cancelledId ? { ...b, booking_status: 'cancelled' } : b))
    );
  };

  const filteredBookings = bookings.filter((b) => {
    if (activeTab === 'all') return true;
    return b.booking_status === activeTab;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Ticket className="w-7 h-7 text-emerald-400" />
            <span>My Parking Reservations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your genuine digital QR passes, print tickets, or release slots.
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Tickets</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800/80 pb-3 text-xs">
        {['all', 'confirmed', 'completed', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl font-semibold capitalize transition ${
              activeTab === tab
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            {tab}
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
              {tab === 'all'
                ? bookings.length
                : bookings.filter((b) => b.booking_status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Booking List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="h-60 rounded-3xl bg-slate-900/40 animate-pulse border border-slate-800"></div>
          ))}
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No Reservations Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {activeTab === 'all'
              ? "You haven't reserved any parking slots yet. Explore available locations to book your spot!"
              : `You don't have any bookings in '${activeTab}' status.`}
          </p>
          {activeTab === 'all' && (
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-600/20"
            >
              <Compass className="w-4 h-4" />
              <span>Explore Parking Now</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => (
            <TicketCard
              key={booking.id}
              booking={booking}
              onCancelSuccess={handleCancelSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}
