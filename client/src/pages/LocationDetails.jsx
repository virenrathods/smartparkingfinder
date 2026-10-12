import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import SlotGrid from '../components/parking/SlotGrid';
import BookingModal from '../components/parking/BookingModal';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  ShieldCheck, 
  Calendar, 
  ArrowLeft, 
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';

export default function LocationDetails() {
  const { id } = useParams();

  const [location, setLocation] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingSlots, setRefreshingSlots] = useState(false);

  // Time Window State for Dynamic Availability Checking
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const [dateStr, setDateStr] = useState(now.toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState(
    `${String(now.getHours()).padStart(2, '0')}:00`
  );
  const [durationHours, setDurationHours] = useState(2);

  // Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // 1. Fetch Location Meta
  useEffect(() => {
    async function fetchLocation() {
      try {
        setLoading(true);
        const res = await api.get(`/locations/${id}`);
        if (res.success && res.data) {
          setLocation(res.data);
        }
      } catch (err) {
        console.error('Failed to load location details:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchLocation();
  }, [id]);

  // 2. Fetch Slots with Dynamic Time Window Conflict Evaluation
  const fetchSlots = async () => {
    try {
      setRefreshingSlots(true);
      const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      const query = `startTime=${encodeURIComponent(startDateTime.toISOString())}&endTime=${encodeURIComponent(endDateTime.toISOString())}`;
      const res = await api.get(`/locations/${id}/slots?${query}`);

      if (res.success && res.data) {
        setSlots(res.data);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setRefreshingSlots(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchSlots();
    }
  }, [id, dateStr, timeStr, durationHours]);

  const handleSlotClick = (slot) => {
    if (slot.isAvailable) {
      setSelectedSlot(slot);
      setShowBookingModal(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto"></div>
        <p className="text-xs text-slate-500 mt-4">Loading parking facility details...</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Parking Location Not Found</h2>
        <Link to="/explore" className="text-xs text-emerald-400 hover:underline">
          Return to All Parking Locations
        </Link>
      </div>
    );
  }

  const availableCount = slots.filter((s) => s.isAvailable).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Back Button */}
      <div>
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Locations</span>
        </Link>
      </div>

      {/* Facility Header Banner */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl">
        <div className="h-64 sm:h-80 w-full relative">
          <img
            src={location.image_url}
            alt={location.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>

          <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Verified Facility
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
                {location.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5 mt-1">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{location.address}, {location.city}, {location.state} {location.postal_code}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition backdrop-blur-md"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="px-4 py-2 rounded-xl bg-emerald-600/90 backdrop-blur-md text-white font-bold text-sm shadow-lg">
                ${Number(location.hourly_rate).toFixed(2)} / hr
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Window Availability Selector */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>Select Your Parking Window</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Slot availability recalculates dynamically based on conflicting reservations in your selected window.
            </p>
          </div>

          <button
            onClick={fetchSlots}
            className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingSlots ? 'animate-spin' : ''}`} />
            <span>Recheck Window</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Arrival Date</label>
            <input
              type="date"
              value={dateStr}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Duration</label>
            <select
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={3}>3 Hours</option>
              <option value={4}>4 Hours</option>
              <option value={6}>6 Hours</option>
              <option value={8}>8 Hours</option>
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Slot Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Interactive Parking Floorplan
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any available slot to initiate reservation.
            </p>
          </div>

          <div className="text-xs px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
            <span className="font-bold text-emerald-400">{availableCount}</span> of {slots.length} bays open
          </div>
        </div>

        <SlotGrid
          slots={slots}
          selectedSlot={selectedSlot}
          onSelectSlot={handleSlotClick}
        />
      </div>

      {/* Facility Description & Operating Hours */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-800/80">
        <div className="md:col-span-2 space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Facility Overview</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            {location.description || 'Modern software-managed parking garage equipped with real-time database locks and QR validation.'}
          </p>
        </div>

        <div className="space-y-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-sky-400" /> Operating Hours</span>
            <span className="text-white font-medium">{location.opening_time} - {location.closing_time}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Security</span>
            <span className="text-white font-medium">Software Verified</span>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && selectedSlot && (
        <BookingModal
          location={location}
          slot={selectedSlot}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedSlot(null);
          }}
          onBookingSuccess={() => {
            fetchSlots();
          }}
        />
      )}
    </div>
  );
}
