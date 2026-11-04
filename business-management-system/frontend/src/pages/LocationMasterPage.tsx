import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { Location } from '../types';
import { getLocations, setLocationStatus } from '../services/api';
import { useCompany } from '../context/CompanyContext';
import { LocationModal } from '../components/LocationModal';

export const LocationMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const loadLocations = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLocations({
        search: searchQuery.trim() || undefined,
        includeInactive,
      });
      setLocations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, searchQuery, includeInactive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLocations();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadLocations]);

  const handleToggleStatus = async (location: Location) => {
    const newStatus = !location.isActive;
    try {
      await setLocationStatus(location.id, newStatus);
      setSuccessMsg(`Location '${location.locationName}' has been ${newStatus ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      loadLocations();
    } catch (err: any) {
      setError(err.message || 'Failed to update location status.');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-slate-900 transition-colors">
          Dashboard
        </button>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-400">Master Management</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="font-semibold text-slate-800">Locations & Godowns</span>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Location / Godown Master</h1>
            <p className="text-xs text-slate-500">
              Manage warehouse godowns, packing zones, spool bins, and finished carton storage.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadLocations}
            title="Refresh List"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setEditingLocation(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      {/* ── Alert Banners ────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Search & Filter Controls ─────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by location name or description..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
          />
        </div>

        <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-600 text-xs shrink-0">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          />
          <span>Show Inactive Locations</span>
        </label>
      </div>

      {/* ── Data Table ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span>Loading locations from database...</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300 space-y-3">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="font-semibold text-slate-700">No warehouse location records found</p>
            <p className="text-slate-400 mt-0.5">
              {searchQuery ? 'Try clearing or modifying your search filter.' : 'Register your first warehouse godown above.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => {
                setEditingLocation(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
            >
              Add First Location
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Location / Godown Name</th>
                  <th className="px-4 py-3">Storage Details / Description</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center space-x-2">
                      <span className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        <MapPin className="w-3.5 h-3.5" />
                      </span>
                      <span>{loc.locationName}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {loc.description || <span className="text-slate-400 italic">No notes</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          loc.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {loc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingLocation(loc);
                            setIsModalOpen(true);
                          }}
                          title="Edit Location Details"
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(loc)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            loc.isActive
                              ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {loc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Showing {locations.length} warehouse locations</span>
            <span className="font-mono text-slate-400">Company ID: {activeCompany?.companyCode}</span>
          </div>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      <LocationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLocation(null);
        }}
        onSuccess={() => {
          loadLocations();
          setSuccessMsg(editingLocation ? 'Location updated successfully.' : 'New location registered successfully.');
          setTimeout(() => setSuccessMsg(null), 3500);
        }}
        locationToEdit={editingLocation}
      />
    </div>
  );
};

