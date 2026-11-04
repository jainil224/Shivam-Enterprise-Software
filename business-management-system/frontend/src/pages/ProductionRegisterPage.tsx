import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory, Search, RefreshCw, Eye, Pencil, Plus,
  ArrowLeft, ChevronLeft, ChevronRight, ArrowUpDown,
  Calendar, Filter, Loader2, AlertTriangle, FileText,
  CheckCircle2, XCircle, Clock, Printer, ShoppingBag
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { listProductionReceivesPaginated, ListProductionReceivesParams } from '../services/api';

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  CONFIRMED: { label: 'Confirmed', cls: 'bg-green-100 text-green-800 border border-green-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-800 border border-red-200', icon: <XCircle className="w-3 h-3" /> },
  DRAFT: { label: 'Draft', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200', icon: <Clock className="w-3 h-3" /> },
};

const fmt3 = (v: any) => (v !== undefined && v !== null ? Number(v).toFixed(3) : '—');
const fmtDate = (d: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const ProductionRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const bookId = sessionStorage.getItem('bms_selected_production_book_id') || '';

  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const limit = 15;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchRecords = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;
    setLoading(true);
    setError('');
    try {
      const params: ListProductionReceivesParams = {
        productionBookId: bookId || undefined,
        page,
        limit,
        sortOrder,
      };
      if (search.trim()) params.search = search.trim();
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (statusFilter) params.status = statusFilter;

      const result = await listProductionReceivesPaginated(params);
      setRecords(result.data || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    } catch (e: any) {
      setError(e.message || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, activeFinancialYear, bookId, page, limit, search, fromDate, toDate, statusFilter, sortOrder]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setStatusFilter('');
    setSortOrder('desc');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/manufacturing/production-receive/books')}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Factory className="w-5 h-5 text-blue-600" />
        <div>
          <h1 className="text-base font-bold text-gray-900">Production Register</h1>
          <p className="text-xs text-gray-500">
            {activeCompany?.companyName} · {activeFinancialYear?.yearName}
            {bookId && <span className="ml-1 text-blue-600">· Selected Book</span>}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate('/manufacturing/production-receive/books')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
            <Plus className="w-3.5 h-3.5" /> New Entry
          </button>
          <button onClick={() => { setPage(1); fetchRecords(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search challan, party, lot..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
            <span className="text-gray-400 text-xs">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400">
            <option value="">All Status</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="DRAFT">Draft</option>
          </select>
          <button type="submit"
            className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800">
            <Filter className="w-3.5 h-3.5 inline mr-1" />Search
          </button>
          <button type="button" onClick={clearFilters}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50">
            Clear
          </button>
          <button type="button" onClick={() => { setSortOrder(s => s === 'desc' ? 'asc' : 'desc'); setPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Date {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </form>
      </div>

      {/* Stats bar */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-1.5 flex items-center gap-4 text-xs text-blue-700">
        <span><strong>{total}</strong> records found</span>
        {total > 0 && <span>Page {page} of {totalPages}</span>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded p-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="ml-3 text-gray-500">Loading records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mb-3" />
            <p className="text-base font-medium">No production records found</p>
            <p className="text-sm mt-1">Create a new entry to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Challan No', 'Date', 'Party Name', 'Machine', 'Quality', 'Lot No', 'Cartons', 'Cops', 'Gross (kg)', 'Net (kg)', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => {
                  const isCancelled = rec.status === 'CANCELLED';
                  const badge = STATUS_BADGE[rec.status] || STATUS_BADGE.DRAFT;
                  const totalCartons = rec._count?.items ?? rec.totalCartons ?? '—';
                  const totalCops = rec.totalCops ?? '—';
                  const totalGross = rec.totalGrossWeight != null ? fmt3(rec.totalGrossWeight) : '—';
                  const totalNet = rec.totalNetWeight != null ? fmt3(rec.totalNetWeight) : '—';
                  return (
                    <tr key={rec.id}
                      className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${isCancelled ? 'opacity-50' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-3 py-2 font-mono font-medium text-blue-700">{rec.challanNumber}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(rec.challanDate)}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate" title={rec.party?.partyName}>{rec.party?.partyName || '—'}</td>
                      <td className="px-3 py-2">{rec.machine?.machineCode || '—'}</td>
                      <td className="px-3 py-2 max-w-[100px] truncate" title={rec.yarnQuality?.qualityName}>{rec.yarnQuality?.qualityName || '—'}</td>
                      <td className="px-3 py-2 font-mono">{rec.lotNumber || '—'}</td>
                      <td className="px-3 py-2 text-center">{totalCartons}</td>
                      <td className="px-3 py-2 text-center">{totalCops}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalGross}</td>
                      <td className="px-3 py-2 text-right font-mono">{totalNet}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.icon}{badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/manufacturing/production-receive/records/${rec.id}`)}
                            className="p-1.5 rounded hover:bg-blue-100 text-blue-600" title="View Details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!isCancelled && (
                            <button onClick={() => navigate(`/manufacturing/production-receive/entry?edit=${rec.id}&bookId=${rec.productionBookId}`)}
                              className="p-1.5 rounded hover:bg-amber-100 text-amber-600" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isCancelled && rec.status === 'CONFIRMED' && (
                            <button onClick={() => navigate(`/transactions/purchase/create-from-challan/${rec.id}`)}
                              className="p-1.5 rounded hover:bg-emerald-100 text-emerald-600" title="Create Purchase Bill from this Challan">
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => navigate(`/manufacturing/production-receive/records/${rec.id}/print`)}
                            className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600" title="Print Challan">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-6 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-2.5 py-1 rounded border text-xs ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:bg-gray-50'}`}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionRegisterPage;
