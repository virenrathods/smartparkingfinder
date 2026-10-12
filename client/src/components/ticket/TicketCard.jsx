import React, { useState } from 'react';
import StatusBadge from '../common/StatusBadge';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { 
  QrCode, 
  MapPin, 
  Calendar, 
  Clock, 
  Car, 
  DollarSign, 
  Printer, 
  Trash2, 
  AlertTriangle 
} from 'lucide-react';

export default function TicketCard({ booking, onCancelSuccess }) {
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const isConfirmed = booking.booking_status === 'confirmed';
  const isCancelled = booking.booking_status === 'cancelled';
  const isCompleted = booking.booking_status === 'completed';

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
    <div className={`relative rounded-3xl border overflow-hidden transition-all duration-300 shadow-xl ${
      isCancelled 
        ? 'bg-slate-900/40 border-slate-800 opacity-60' 
        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
    }`}>
      {/* Top Banner Ribbon */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-widest text-emerald-400">
            {booking.booking_code}
          </span>
          <StatusBadge status={booking.booking_status} type="booking" />
        </div>

        <button
          onClick={handlePrint}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Pass</span>
        </button>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left Section: Information */}
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

          {/* Cancellation Option */}
          {isConfirmed && (
            <div className="pt-2">
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
