import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  Ticket, 
  Search, 
  CheckCircle2, 
  LogOut, 
  LogIn, 
  QrCode, 
  ArrowLeft, 
  RefreshCw,
  Car,
  Calendar,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ManageBookings() {
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Gate Scanner / Quick Code Lookup
  const [scanCode, setScanCode] = useState('');
  const [scannedTicket, setScannedTicket] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (statusFilter) queryParams.append('status', statusFilter);

      const res = await api.get(`/admin/bookings?${queryParams.toString()}`);
      if (res.success && res.data) {
        setBookings(res.data);
      }
    } catch (err) {
      toast.error('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBookings();
  };

  const handleQuickLookup = (e) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    const code = scanCode.trim().toUpperCase();
    const match = bookings.find((b) => b.booking_code.toUpperCase() === code);

    if (match) {
      setScannedTicket(match);
      toast.success(`Ticket found: ${match.booking_code}`);
    } else {
      toast.error(`No reservation found matching code: ${code}`);
      setScannedTicket(null);
    }
  };

  const handleCheckIn = async (bookingId) => {
    try {
      const res = await api.patch(`/admin/bookings/${bookingId}/check-in`);
      if (res.success) {
        toast.success(res.message || 'Vehicle admitted.');
        fetchBookings();
        if (scannedTicket && scannedTicket.id === bookingId) {
          setScannedTicket({ ...scannedTicket, check_in_time: new Date().toISOString() });
        }
      }
    } catch (err) {
      toast.error(err.message || 'Check-in failed.');
    }
  };

  const handleCheckOut = async (bookingId) => {
    try {
      const res = await api.patch(`/admin/bookings/${bookingId}/check-out`);
      if (res.success) {
        toast.success(res.message || 'Vehicle checked out and booking completed.');
        fetchBookings();
        if (scannedTicket && scannedTicket.id === bookingId) {
          setScannedTicket({
            ...scannedTicket,
            check_out_time: new Date().toISOString(),
            booking_status: 'completed'
          });
        }
      }
    } catch (err) {
      toast.error(err.message || 'Check-out failed.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Ticket className="w-7 h-7 text-sky-400" />
            <span>Reservations & Gate Check-In</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Validate driver QR ticket passes and manage active vehicles on premise.
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Bookings</span>
        </button>
      </div>

      {/* Gate Operator Quick Lookup Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-sky-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/30 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-wider">
          <QrCode className="w-4 h-4" />
          <span>Gate Scanner & Ticket Code Lookup</span>
        </div>

        <form onSubmit={handleQuickLookup} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Scan or enter ticket code (e.g. SPF-202610-8A4B)..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 uppercase font-mono focus:outline-none focus:border-sky-400"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition flex items-center justify-center gap-2"
          >
            <span>Verify Ticket</span>
          </button>
        </form>

        {/* Scanned Result Banner */}
        {scannedTicket && (
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-base font-bold text-white font-mono">
                  {scannedTicket.booking_code}
                </span>
                <p className="text-xs text-slate-400">
                  Driver: <span className="text-white font-semibold">{scannedTicket.user_name}</span> ({scannedTicket.user_email})
                </p>
              </div>

              <StatusBadge status={scannedTicket.booking_status} type="booking" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Facility:</span>
                <span className="text-slate-200 font-medium">{scannedTicket.location_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Assigned Bay:</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">{scannedTicket.slot_number}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Vehicle Reg.:</span>
                <span className="text-slate-200 font-mono">{scannedTicket.vehicle_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fee:</span>
                <span className="text-white font-bold">${scannedTicket.total_amount}</span>
              </div>
            </div>

            {/* Gate Action Buttons */}
            <div className="pt-2 flex gap-3">
              {!scannedTicket.check_in_time && scannedTicket.booking_status === 'confirmed' && (
                <button
                  onClick={() => handleCheckIn(scannedTicket.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Check In (Admit Vehicle)</span>
                </button>
              )}

              {scannedTicket.check_in_time && !scannedTicket.check_out_time && (
                <button
                  onClick={() => handleCheckOut(scannedTicket.id)}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Check Out (Vehicle Exit)</span>
                </button>
              )}

              {scannedTicket.check_out_time && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Vehicle departed at {new Date(scannedTicket.check_out_time).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bookings Register */}
      <div className="space-y-4">
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by driver name, email, booking code, or plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </form>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-sky-500"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed (Active)</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Ticket Ref</th>
                  <th className="p-4">Driver</th>
                  <th className="p-4">Facility & Bay</th>
                  <th className="p-4">Time Window</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Gate Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      Loading bookings...
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-500">
                      No matching reservations found.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-4 font-mono font-bold text-white">
                        {b.booking_code}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-200 block">{b.user_name}</span>
                        <span className="text-[10px] text-slate-400">{b.user_email}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-300 block">{b.location_name}</span>
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">
                          Bay: {b.slot_number}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">
                        {new Date(b.start_time).toLocaleDateString()}{' '}
                        {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-bold text-white">
                        ${Number(b.total_amount).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <StatusBadge status={b.booking_status} type="booking" />
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {!b.check_in_time && b.booking_status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckIn(b.id)}
                            className="px-2.5 py-1 bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50 rounded-lg text-[10px] font-semibold transition"
                          >
                            Check In
                          </button>
                        )}
                        {b.check_in_time && !b.check_out_time && (
                          <button
                            onClick={() => handleCheckOut(b.id)}
                            className="px-2.5 py-1 bg-sky-600/30 border border-sky-500/40 text-sky-300 hover:bg-sky-600/50 rounded-lg text-[10px] font-semibold transition"
                          >
                            Check Out
                          </button>
                        )}
                        {b.check_out_time && (
                          <span className="text-[10px] text-slate-500">Departed</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
