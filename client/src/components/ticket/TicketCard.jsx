import React, { useState } from 'react';
import StatusBadge from '../common/StatusBadge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { getNavigationLinks } from '../../utils/navigation';
import { 
  QrCode, 
  MapPin, 
  Calendar, 
  Clock, 
  Car, 
  DollarSign, 
  Printer, 
  Trash2, 
  AlertTriangle,
  Navigation,
  ExternalLink
} from 'lucide-react';

export default function TicketCard({ booking, onCancelSuccess }) {
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  // Authoritative booking status evaluation
  const getAuthoritativeStatus = () => {
    if (booking.booking_status === 'cancelled') return 'cancelled';
    if (booking.booking_status === 'completed') return 'completed';

    // If active / confirmed
    if (booking.check_in_time && !booking.check_out_time) {
      return 'checked in';
    }

    const now = Date.now();
    const start = new Date(booking.start_time).getTime();
    const end = new Date(booking.end_time).getTime();

    if (now < start) {
      return 'upcoming';
    }
    if (now >= start && now <= end) {
      return 'confirmed';
    }
    if (now > end) {
      return 'expired';
    }

    return booking.booking_status;
  };

  const authoritativeStatus = getAuthoritativeStatus();
  const isCancelled = authoritativeStatus === 'cancelled';
  const isCompleted = authoritativeStatus === 'completed' || authoritativeStatus === 'expired';
  const canCancel = (authoritativeStatus === 'upcoming' || authoritativeStatus === 'confirmed') && !booking.check_in_time;

  // Separate schedule / countdown indicator
  const getTimeRemainingText = () => {
    if (isCancelled || isCompleted) return null;
    const now = Date.now();
    const start = new Date(booking.start_time).getTime();
    const end = new Date(booking.end_time).getTime();

    if (now < start) {
      const diffMs = start - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (diffHrs >= 24) {
        const days = Math.floor(diffHrs / 24);
        return `Upcoming in ${days}d ${diffHrs % 24}h`;
      }
      if (diffHrs > 0) {
        return `Starts in ${diffHrs}h ${diffMins}m`;
      }
      return `Starts in ${diffMins}m`;
    } else if (now >= start && now <= end) {
      const diffMs = end - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `Active • ${diffHrs}h ${diffMins}m left`;
    } else {
      return null;
    }
  };

  const countdownText = getTimeRemainingText();

  // Navigation Links for Google Maps, Apple Maps, and Waze
  const navigationLinks = getNavigationLinks(booking);

  const handleCancelBooking = async () => {
    try {
      setCancelling(true);
      const res = await api.patch(`/bookings/${booking.id}/cancel`);
      if (res.success) {
        toast.success('Booking cancelled and slot released successfully.');
        setShowConfirmCancel(false);
        if (onCancelSuccess) onCancelSuccess(booking.id);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to cancel booking.');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`relative rounded-3xl border overflow-hidden transition-all duration-300 shadow-xl print:shadow-none print:border-slate-300 print:bg-white print:text-slate-900 ${
      isCancelled 
        ? 'bg-slate-900/40 border-slate-800 opacity-60' 
        : isCompleted
        ? 'bg-slate-900/60 border-slate-800'
        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
    }`}>
      {/* Top Banner Ribbon */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800 print:bg-slate-100 print:border-slate-300 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-widest text-emerald-400 print:text-emerald-700">
            {booking.booking_code}
          </span>
          <StatusBadge status={authoritativeStatus} type="booking" />
          {countdownText && (
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-800/80 text-sky-300 border border-slate-700/80 print:bg-slate-200 print:text-slate-800">
              {countdownText}
            </span>
          )}
        </div>

        <button
          onClick={handlePrint}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition print:hidden"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Pass</span>
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left Section: Information & Controls */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {booking.location_name}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{booking.location_address}, {booking.city}</span>
            </p>
          </div>

          {/* Slot & Vehicle Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Reserved Slot</span>
              <span className="text-base font-bold text-emerald-400 font-mono">
                {booking.slot_number}
              </span>
              <span className="text-[10px] text-slate-400 capitalize block">
                {booking.slot_type} bay
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block">Vehicle Reg.</span>
              <span className="text-sm font-semibold text-slate-200 uppercase font-mono">
                {booking.vehicle_number || 'Not Stated'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block">Estimated Fee</span>
              <span className="text-sm font-bold text-white">
                ${Number(booking.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Time Window */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>{new Date(booking.start_time).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>
                {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' — '}
                {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Map Turn-by-Turn Navigation Group */}
          {navigationLinks && (
            <div className="pt-1 flex flex-wrap items-center gap-2 print:hidden">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <Navigation className="w-3.5 h-3.5 text-sky-400" /> Navigate:
              </span>
              <a
                href={navigationLinks.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition shadow-sm"
                title={`Directions in Google Maps (${navigationLinks.hasCoordinates ? 'GPS Verified' : 'Address Search'})`}
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
              <a
                href={navigationLinks.appleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition shadow-sm"
                title={`Directions in Apple Maps (${navigationLinks.hasCoordinates ? 'GPS Verified' : 'Address Search'})`}
              >
                <span>Apple Maps</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
              <a
                href={navigationLinks.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition shadow-sm"
                title={`Directions in Waze (${navigationLinks.hasCoordinates ? 'GPS Verified' : 'Address Search'})`}
              >
                <span>Waze</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>
          )}

          {/* Check-In / Check-Out Log */}
          {(booking.check_in_time || booking.check_out_time) && (
            <div className="text-[11px] text-slate-400 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 flex gap-4">
              {booking.check_in_time && (
                <span>Checked In: {new Date(booking.check_in_time).toLocaleTimeString()}</span>
              )}
              {booking.check_out_time && (
                <span>Checked Out: {new Date(booking.check_out_time).toLocaleTimeString()}</span>
              )}
            </div>
          )}

          {/* Cancellation Safeguard Option */}
          {canCancel && (
            <div className="pt-1">
              {showConfirmCancel ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-950/30 border border-rose-900/60 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-200">Release this slot immediately?</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => setShowConfirmCancel(false)}
                      className="px-2.5 py-1 text-slate-400 hover:text-white rounded"
                    >
                      Keep
                    </button>
                    <button
                      disabled={cancelling}
                      onClick={handleCancelBooking}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded transition"
                    >
                      {cancelling ? 'Releasing...' : 'Yes, Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirmCancel(true)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancel Reservation</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Real QR Code */}
        <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-center">
          {booking.qr_code_data ? (
            <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-slate-700">
              <img
                src={booking.qr_code_data}
                alt={`QR code for ${booking.booking_code}`}
                className="w-36 h-36 object-contain"
              />
            </div>
          ) : (
            <div className="w-36 h-36 bg-slate-900 flex items-center justify-center text-slate-600 rounded-xl">
              <QrCode className="w-12 h-12" />
            </div>
          )}
          <span className="text-[10px] text-slate-400 font-mono mt-2 tracking-wider">
            SCAN AT GATE
          </span>
        </div>
      </div>
    </div>
  );
}
