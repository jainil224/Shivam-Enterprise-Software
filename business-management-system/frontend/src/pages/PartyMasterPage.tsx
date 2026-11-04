import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Phone,
} from 'lucide-react';
import { Party, PartyType } from '../types';
import { getParties, setPartyStatus } from '../services/api';
import { useCompany } from '../context/CompanyContext';
import { PartyModal } from '../components/PartyModal';

export const PartyMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);

  const loadParties = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    setError(null);
    try {
      const typeParam = selectedType !== 'ALL' ? (selectedType as PartyType) : undefined;
      const data = await getParties({
        search: searchQuery.trim() || undefined,
        partyType: typeParam,
        includeInactive,
      });
      setParties(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load parties.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, searchQuery, selectedType, includeInactive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadParties();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadParties]);

  const handleToggleStatus = async (party: Party) => {
    const newStatus = !party.isActive;
    try {
      await setPartyStatus(party.id, newStatus);
      setSuccessMsg(`Party '${party.partyName}' has been ${newStatus ? 'activated' : 'deactivated'}.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      loadParties();
    } catch (err: any) {
      setError(err.message || 'Failed to update party status.');
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
        <span className="font-semibold text-slate-800">Parties & Accounts</span>
      </div>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Party / Account Master</h1>
            <p className="text-xs text-slate-500">
              Manage yarn customers, raw material suppliers, job contractors, and ledger balances.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={loadParties}
            title="Refresh List"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setEditingParty(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Party</span>
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
            placeholder="Search by code, name, phone, GSTIN or city..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div className="flex items-center space-x-3 shrink-0 text-xs">
          {/* Party Type Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {['ALL', 'CUSTOMER', 'SUPPLIER', 'BOTH'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  selectedType === type ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Active Filter Checkbox */}
          <label className="flex items-center space-x-1.5 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show Inactive</span>
          </label>
        </div>
      </div>

      {/* ── Data Table ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Loading parties from PostgreSQL...</span>
        </div>
      ) : parties.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300 space-y-3">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="font-semibold text-slate-700">No party records found</p>
            <p className="text-slate-400 mt-0.5">
              {searchQuery ? 'Try clearing or modifying your search filter.' : 'Register your first customer or supplier above.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => {
                setEditingParty(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Add First Party
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Party Code</th>
                  <th className="px-4 py-3">Party Legal Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">GSTIN / PAN</th>
                  <th className="px-4 py-3">City / State</th>
                  <th className="px-4 py-3">Opening Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parties.map((party) => (
                  <tr key={party.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">
                      <span className="bg-blue-50 border border-blue-200/70 px-1.5 py-0.5 rounded">
                        {party.partyCode}
                      </span>
                    </td>

                    {/* Name & Contact */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{party.partyName}</div>
                      {party.phone && (
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-400 inline" />
                          <span>{party.phone}</span>
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          party.partyType === 'CUSTOMER'
                            ? 'bg-blue-100 text-blue-800'
                            : party.partyType === 'SUPPLIER'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {party.partyType}
                      </span>
                    </td>

                    {/* GSTIN / PAN */}
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <div>{party.gstin || <span className="text-slate-400 italic">No GSTIN</span>}</div>
                      {party.panNumber && <div className="text-slate-500 text-[10px]">{party.panNumber}</div>}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 text-slate-600">
                      {[party.city, party.state].filter(Boolean).join(', ') || (
                        <span className="text-slate-400 italic">Not set</span>
                      )}
                    </td>

                    {/* Opening Balance */}
                    <td className="px-4 py-3 font-mono">
                      <span className="font-semibold text-slate-800">
                        ₹{Number(party.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>{' '}
                      <span className="text-[10px] font-bold text-slate-500">{party.balanceType}</span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          party.isActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {party.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingParty(party);
                            setIsModalOpen(true);
                          }}
                          title="Edit Party Details"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(party)}
                          title={party.isActive ? 'Deactivate Party' : 'Activate Party'}
                          className={`px-2 py-1 rounded text-[11px] font-semibold border transition-colors ${
                            party.isActive
                              ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          {party.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between items-center">
            <span>Showing {parties.length} party ledger records</span>
            <span className="font-mono text-slate-400">Company ID: {activeCompany?.companyCode}</span>
          </div>
        </div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      <PartyModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingParty(null);
        }}
        onSuccess={() => {
          loadParties();
          setSuccessMsg(editingParty ? 'Party updated successfully.' : 'New party registered successfully.');
          setTimeout(() => setSuccessMsg(null), 3500);
        }}
        partyToEdit={editingParty}
      />
    </div>
  );
};
