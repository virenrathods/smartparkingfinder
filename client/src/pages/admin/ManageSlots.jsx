import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/common/StatusBadge';
import { 
  Grid, 
  MapPin, 
  Plus, 
  Wrench, 
  Trash2, 
  ArrowLeft, 
  RefreshCw, 
  Car, 
  Zap, 
  Accessibility, 
  Bike,
  CheckCircle2,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ManageSlots() {
  const toast = useToast();
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');

  // New Slot State
  const [newSlotNumber, setNewSlotNumber] = useState('');
  const [newSlotType, setNewSlotType] = useState('car');
  const [addingSlot, setAddingSlot] = useState(false);

  // Manual Status Override Modal
  const [statusModalSlot, setStatusModalSlot] = useState(null);
  const [overrideReason, setOverrideReason] = useState('Operator inspection');

  // Load locations on mount
  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await api.get('/locations');
        if (res.success && res.data.length > 0) {
          setLocations(res.data);
          setSelectedLocationId(String(res.data[0].id));
        }
      } catch (err) {
        toast.error('Failed to load locations.');
      } finally {
        setLoading(false);
      }
    }
    loadLocations();
  }, []);

  // Fetch slots whenever selectedLocationId changes
  const fetchSlots = async () => {
    if (!selectedLocationId) return;
    try {
      setLoading(true);
      const res = await api.get(`/locations/${selectedLocationId}/slots`);
      if (res.success && res.data) {
        setSlots(res.data);
      }
    } catch (err) {
      toast.error('Failed to load slots.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [selectedLocationId]);

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!newSlotNumber.trim()) return;

    try {
      setAddingSlot(true);
      await api.post(`/locations/${selectedLocationId}/slots`, {
        slot_number: newSlotNumber.trim().toUpperCase(),
        slot_type: newSlotType
      });
      toast.success(`Slot ${newSlotNumber.toUpperCase()} added successfully.`);
      setNewSlotNumber('');
      fetchSlots();
    } catch (err) {
      toast.error(err.message || 'Failed to add slot.');
    } finally {
      setAddingSlot(false);
    }
  };

  const handleStatusOverride = async (newStatus) => {
    if (!statusModalSlot) return;

    try {
      await api.patch(`/slots/${statusModalSlot.id}/status`, {
        status: newStatus,
        reason: overrideReason
      });
      toast.success(`Slot ${statusModalSlot.slot_number} marked as ${newStatus}.`);
      setStatusModalSlot(null);
      fetchSlots();
    } catch (err) {
      toast.error(err.message || 'Failed to update slot status.');
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (window.confirm('Delete this parking slot permanently?')) {
      try {
        await api.delete(`/slots/${slotId}`);
        toast.success('Slot removed.');
        fetchSlots();
      } catch (err) {
        toast.error(err.message || 'Failed to delete slot.');
      }
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
            <Grid className="w-7 h-7 text-purple-400" />
            <span>Slot Management & Status Overrides</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manually mark physical bay occupancy or toggle maintenance closures.
          </p>
        </div>

        {/* Location Dropdown Switcher */}
        <div className="flex items-center gap-3">
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="px-4 py-2.5 bg-slate-900 border border-slate-800 text-xs text-white rounded-xl focus:outline-none focus:border-purple-500 font-semibold"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.city})
              </option>
            ))}
          </select>

          <button
            onClick={fetchSlots}
            className="p-2.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Add Slot Quick Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <form onSubmit={handleAddSlot} className="flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-slate-300">Quick Add Bay:</span>

          <input
            type="text"
            required
            placeholder="Slot Code (e.g. A-15)"
            value={newSlotNumber}
            onChange={(e) => setNewSlotNumber(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-purple-500"
          />

          <select
            value={newSlotType}
            onChange={(e) => setNewSlotType(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-purple-500 capitalize"
          >
            <option value="car">Car (Standard)</option>
            <option value="ev">EV Charger</option>
            <option value="accessible">Accessible Bay</option>
            <option value="bike">Bike / Two Wheeler</option>
          </select>

          <button
            type="submit"
            disabled={addingSlot}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addingSlot ? 'Adding...' : 'Add Slot'}</span>
          </button>
        </form>
      </div>

      {/* Slots Grid for Admin */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'all', label: 'All Bays' },
              { id: 'car', label: 'Cars' },
              { id: 'ev', label: 'EV Bays' },
              { id: 'accessible', label: 'Accessible' },
              { id: 'bike', label: 'Bikes' },
            ].map((item) => {
              const count = item.id === 'all'
                ? slots.length
                : slots.filter((s) => s.slot_type === item.id).length;
              if (count === 0 && item.id !== 'all') return null;
              const isActive = typeFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTypeFilter(item.id)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                      : 'bg-slate-950/70 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-md ${
                    isActive ? 'bg-purple-700 text-purple-100' : 'bg-slate-900 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400">
            <span>Click any bay to manually override status</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {slots
            .filter((s) => typeFilter === 'all' || s.slot_type === typeFilter)
            .map((slot) => {
            const isAvail = slot.status === 'available';
            const isMaint = slot.status === 'maintenance';
            const isOcc = slot.status === 'occupied';

            return (
              <div
                key={slot.id}
                onClick={() => setStatusModalSlot(slot)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between select-none relative group min-h-[110px] ${
                  isAvail
                    ? 'bg-slate-900 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                    : isMaint
                    ? 'bg-slate-900 border-slate-700 text-slate-400'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="capitalize font-mono opacity-60">{slot.slot_type}</span>
                  <span className="text-[10px] text-slate-500">#{slot.id}</span>
                </div>

                <div className="my-1 text-center font-extrabold text-base font-mono tracking-wider">
                  {slot.slot_number}
                </div>

                <div className="text-center">
                  <StatusBadge status={slot.status} type="slot" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Override Modal */}
      {statusModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Override Bay Status</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Slot: <span className="font-mono text-emerald-400 font-bold">{statusModalSlot.slot_number}</span> ({statusModalSlot.slot_type})
                </p>
              </div>
              <button
                onClick={() => setStatusModalSlot(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Reason for status change</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Maintenance inspection, Walk-in parking"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-medium block">Choose new status:</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleStatusOverride('available')}
                  className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/40 text-emerald-300 text-center transition"
                >
                  Set Available
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusOverride('occupied')}
                  className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 hover:bg-rose-900/40 text-rose-300 text-center transition"
                >
                  Set Occupied
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusOverride('maintenance')}
                  className="p-3 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-center transition"
                >
                  Set Maintenance
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusOverride('reserved')}
                  className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 hover:bg-amber-900/40 text-amber-300 text-center transition"
                >
                  Set Reserved
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => {
                  handleDeleteSlot(statusModalSlot.id);
                  setStatusModalSlot(null);
                }}
                className="text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Slot</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusModalSlot(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
