import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';
import { 
  X, 
  Calendar, 
  Clock, 
  Car, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  QrCode,
  ArrowRight
} from 'lucide-react';

export default function BookingModal({ location, slot, onClose, onBookingSuccess }) {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Initialize arrival date/time to nearest next hour
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const [dateStr, setDateStr] = useState(now.toISOString().split('T')[0]);
  const [timeStr, setTimeStr] = useState(
    `${String(now.getHours()).padStart(2, '0')}:00`
  );
  const [durationHours, setDurationHours] = useState(2);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const hourlyRate = Number(location.hourly_rate || 0);
  const totalFee = (durationHours * hourlyRate).toFixed(2);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.warning('Please log in to complete your reservation.');
      navigate('/login');
      return;
    }

    try {
      setSubmitting(true);

      const [hours, minutes] = timeStr.split(':').map(Number);
      const startDateTime = new Date(`${dateStr}T${timeStr}:00`);
      const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000);

      const res = await api.post('/bookings', {
        location_id: location.id,
        slot_id: slot.id,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        vehicle_number: vehicleNumber
      });

      if (res.success && res.data) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        toast.success('Reservation confirmed successfully!');
        setConfirmedBooking(res.data);
        if (onBookingSuccess) onBookingSuccess();
      }
    } catch (err) {
      console.error('Booking submission failed:', err);
      if (err.status === 409) {
        toast.error('Slot was just booked by another user! Please choose a different slot.');
      } else {
        toast.error(err.message || 'Failed to complete booking.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/40">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              {confirmedBooking ? 'Booking Confirmed!' : 'Reserve Parking Slot'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {location.name} — Slot {slot.slot_number} ({slot.slot_type})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Confirmation State vs Booking Form */}
        {confirmedBooking ? (
          <div className="p-6 space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Ticket Code: {confirmedBooking.bookingCode}
              </span>
              <h4 className="text-xl font-extrabold text-white mt-3">Your Slot is Secured</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Present this QR code ticket at the entrance for operator check-in.
              </p>
            </div>

            {/* QR Code Preview */}
            {confirmedBooking.qrCodeDataUrl && (
              <div className="bg-white p-4 rounded-2xl inline-block shadow-xl border-4 border-slate-800 mx-auto">
                <img
                  src={confirmedBooking.qrCodeDataUrl}
                  alt={`QR Ticket ${confirmedBooking.bookingCode}`}
                  className="w-48 h-48 object-contain"
                />
              </div>
            )}

            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Facility:</span>
                <span className="text-slate-200 font-medium">{location.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Reserved Slot:</span>
                <span className="text-emerald-400 font-bold">{slot.slot_number}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Duration:</span>
                <span className="text-slate-200">{durationHours} Hours</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800 font-semibold">
                <span>Estimated Parking Fee:</span>
                <span className="text-white">${confirmedBooking.totalAmount}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => navigate('/my-bookings')}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <span>Go to My Bookings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBookingSubmit} className="p-6 space-y-5">
            {/* Slot & Rate Highlight */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
              <div>
                <span className="text-[11px] text-slate-400">Selected Slot</span>
                <p className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                  {slot.slot_number}{' '}
                  <span className="text-xs font-normal text-slate-400 capitalize">
                    ({slot.slot_type})
                  </span>
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400">Hourly Rate</span>
                <p className="text-base font-bold text-slate-200 mt-0.5">
                  ${hourlyRate.toFixed(2)} / hr
                </p>
              </div>
            </div>

            {/* Arrival Date and Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" /> Date
                </label>
                <input
                  type="date"
                  required
                  value={dateStr}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" /> Start Time
                </label>
                <input
                  type="time"
                  required
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Expected Duration (Hours)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 8].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDurationHours(h)}
                    className={`py-2 text-xs font-bold rounded-xl border transition ${
                      durationHours === h
                        ? 'bg-emerald-600 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {h} hr{h > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Number Input (Optional) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-slate-400" /> Vehicle Number Plate (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. NY-9842-AB"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 uppercase focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Summary & Price Note */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Parking Fee</span>
                <p className="text-xl font-extrabold text-white">${totalFee}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> No online payment required
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Pay upon facility exit</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Confirm & Generate QR Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
