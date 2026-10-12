import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  TrendingUp, 
  MapPin, 
  Clock, 
  DollarSign, 
  ArrowLeft, 
  RefreshCw, 
  ShieldCheck, 
  FileText 
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Reports() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reports');
      if (res.success && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

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
            <TrendingUp className="w-7 h-7 text-amber-400" />
            <span>Facility Utilization & Audit Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Software-managed occupancy rates, revenue estimates, and audit trail of operator overrides.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Reports</span>
        </button>
      </div>

      {/* Facility Utilization Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>Facility Utilization Breakdown</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 p-8 text-center text-slate-500">Loading metrics...</div>
          ) : (
            reportData?.locations?.map((loc) => {
              const total = Number(loc.total_slots || 0);
              const avail = Number(loc.available_slots || 0);
              const occupiedOrReserved = total - avail;
              const ratePct = total > 0 ? Math.round((occupiedOrReserved / total) * 100) : 0;

              return (
                <div
                  key={loc.id}
                  className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-white">{loc.name}</h3>
                      <p className="text-xs text-slate-400">{loc.city} — ${Number(loc.hourly_rate).toFixed(2)}/hr</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-emerald-400">
                      ${Number(loc.total_revenue || 0).toFixed(2)} Revenue
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Occupancy Utilization</span>
                      <span className="font-bold text-white">{ratePct}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-500 transition-all duration-500"
                        style={{ width: `${ratePct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Slot Details */}
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] pt-2 border-t border-slate-800/80">
                    <div className="p-2 bg-slate-950/60 rounded-xl">
                      <span className="text-slate-500 block">Total</span>
                      <span className="font-bold text-white">{total}</span>
                    </div>
                    <div className="p-2 bg-slate-950/60 rounded-xl">
                      <span className="text-slate-500 block">Open</span>
                      <span className="font-bold text-emerald-400">{avail}</span>
                    </div>
                    <div className="p-2 bg-slate-950/60 rounded-xl">
                      <span className="text-slate-500 block">Occ/Res</span>
                      <span className="font-bold text-amber-400">{occupiedOrReserved}</span>
                    </div>
                    <div className="p-2 bg-slate-950/60 rounded-xl">
                      <span className="text-slate-500 block">Maint.</span>
                      <span className="font-bold text-slate-400">{loc.maintenance_slots || 0}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Slot Overrides Audit Trail */}
      <div className="space-y-4 pt-4">
        <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400" />
          <span>Operator Status Overrides (Audit Log)</span>
        </h2>

        <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Operator</th>
                  <th className="p-4">Facility & Slot</th>
                  <th className="p-4">Status Transition</th>
                  <th className="p-4">Reason Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      Loading audit logs...
                    </td>
                  </tr>
                ) : !reportData?.auditLogs || reportData.auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-500">
                      No manual slot overrides recorded yet.
                    </td>
                  </tr>
                ) : (
                  reportData.auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/50 transition">
                      <td className="p-4 text-slate-400">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 font-semibold text-white">
                        {log.changed_by_name}
                      </td>
                      <td className="p-4">
                        <span className="text-slate-200 block">{log.location_name}</span>
                        <span className="font-mono text-emerald-400 font-bold">Bay {log.slot_number}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-400 capitalize">{log.old_status}</span>
                        {' → '}
                        <span className="text-white font-bold capitalize">{log.new_status}</span>
                      </td>
                      <td className="p-4 text-slate-400 italic">
                        {log.reason || 'None specified'}
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
