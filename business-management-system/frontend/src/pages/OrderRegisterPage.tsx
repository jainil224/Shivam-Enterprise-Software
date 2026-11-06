import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileCheck,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import {
  cancelOrder,
  getOrderLookups,
  getOrderSummary,
  listPurchaseOrders,
  listSalesOrders,
} from '../services/api';
import {
  ORDER_STATUS_LABELS,
  type OrderDocumentType,
  type OrderLookups,
  type OrderRecord,
  type OrderSummary,
} from '../types/orders';
import { formatDate, money, orderLabels, orderPaths, qty, statusTone } from './orderPageShared';

interface OrderRegisterPageProps {
  documentType: OrderDocumentType;
}

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';

const isCancellable = (record: OrderRecord): boolean =>
  record.status !== 'CANCELLED' && record.status !== 'CLOSED';

export const OrderRegisterPage: React.FC<OrderRegisterPageProps> = ({ documentType }) => {
  const navigate = useNavigate();
  const isSales = documentType === 'SALES_ORDER';
  const labels = useMemo(() => orderLabels(documentType), [documentType]);
  const paths = useMemo(() => orderPaths(documentType), [documentType]);

  const [lookups, setLookups] = useState<OrderLookups | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [rows, setRows] = useState<OrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [totalQuantity, setTotalQuantity] = useState('0.000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [partyId, setPartyId] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'amount' | 'party'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(true);

  const [cancelTarget, setCancelTarget] = useState<OrderRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    try {
      const data = await getOrderLookups(documentType);
      setLookups(data);
    } catch {
      setLookups(null);
    }
  }, [documentType]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getOrderSummary(documentType);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [documentType]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: search.trim() === '' ? undefined : search.trim(),
        partyId: partyId === '' ? undefined : partyId,
        status: status === '' ? undefined : status,
        fromDate: fromDate === '' ? undefined : fromDate,
        toDate: toDate === '' ? undefined : toDate,
        overdue: overdue ? true : undefined,
        sortBy,
        sortOrder,
        page,
        limit,
      };
      const result = isSales ? await listSalesOrders(params) : await listPurchaseOrders(params);
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setTotalAmount(result.totalAmount);
      setTotalQuantity(result.totalQuantity);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setTotalAmount('0.00');
      setTotalQuantity('0.000');
      setError(err instanceof Error ? err.message : 'Failed to load the register.');
    } finally {
      setLoading(false);
    }
  }, [
    documentType,
    isSales,
    search,
    partyId,
    status,
    fromDate,
    toDate,
    overdue,
    sortBy,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    void loadLookups();
    void loadSummary();
  }, [loadLookups, loadSummary]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setPartyId('');
    setStatus('');
    setFromDate('');
    setToDate('');
    setOverdue(false);
    setSortBy('date');
    setSortOrder('desc');
    setPage(1);
  }, []);

  const isLocked = lookups?.financialYear.isLocked ?? false;

  const pageLabel = useMemo(() => {
    if (total === 0) return `No ${labels.plural.toLowerCase()}`;
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, limit, total, labels.plural]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        if (!isLocked) navigate(paths.create);
      } else if (event.key === 'F2') {
        event.preventDefault();
        resetFilters();
      } else if (event.key === 'F5') {
        event.preventDefault();
        void loadRows();
        void loadSummary();
      } else if (event.key === 'Escape' && !cancelTarget) {
        event.preventDefault();
        navigate('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, paths.create, resetFilters, loadRows, loadSummary, isLocked, cancelTarget]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('A cancellation reason of at least 3 characters is required.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelOrder(documentType, cancelTarget.id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason('');
      await loadRows();
      await loadSummary();
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      setCancelError(
        apiErrors && apiErrors.length > 0
          ? apiErrors[0].message
          : err instanceof Error
            ? err.message
            : 'Failed to cancel the order.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const statusEntries = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.statuses).filter(([, value]) => value.count > 0);
  }, [summary]);

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-2.5 pb-8">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isSales ? <ClipboardList className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">{labels.plural} Register</h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              Order documents, fulfilment position and status
              {lookups ? ` · FY ${lookups.financialYear.yearName}` : ''}
              {isLocked ? ' · FY LOCKED' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
          <button
            type="button"
            onClick={() => {
              void loadRows();
              void loadSummary();
            }}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh (F5)
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.reports)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25"
          >
            Reports
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.create)}
            disabled={isLocked}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New {labels.shortCode} (F10)
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Financial year {lookups?.financialYear.yearName} is locked — orders cannot be created, edited or cancelled.
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          <div className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Documents</p>
            <p className="text-[14px] font-bold text-slate-800 font-mono">{total}</p>
          </div>
          <div className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Pending Qty</p>
            <p className="text-[14px] font-bold text-slate-800 font-mono">{qty(summary.pending.quantity)}</p>
            <p className="text-[9.5px] text-slate-500">{summary.pending.count} open document(s)</p>
          </div>
          <div className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Pending Value</p>
            <p className="text-[14px] font-bold text-slate-800 font-mono">₹ {money(summary.pending.amount)}</p>
          </div>
          <div className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Overdue</p>
            <p className="text-[14px] font-bold text-red-700 font-mono">{summary.overdue.count}</p>
            <p className="text-[9.5px] text-slate-500">₹ {money(summary.overdue.amount)}</p>
          </div>
          <div className="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 col-span-2">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Status Mix</p>
            <div className="flex flex-wrap gap-1">
              {statusEntries.length === 0 ? (
                <span className="text-[10.5px] text-slate-400">No documents yet</span>
              ) : (
                statusEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${statusTone(key)}`}
                    title={`Value ₹ ${money(value.amount)}`}
                  >
                    {ORDER_STATUS_LABELS[key] ?? key} · {value.count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showFilters && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Filters</span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10.5px] font-bold text-[#2c5f57] hover:underline"
            >
              Clear (F2)
            </button>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
            <div className="col-span-2">
              <label className={labelCls}>Search</label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    setPage(1);
                    void loadRows();
                  }
                }}
                placeholder="Order number, reference, party or item…"
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{labels.partyLabel}</label>
              <select
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
                className={inputCls}
              >
                <option value="">All</option>
                {(lookups?.parties ?? []).map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.partyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputCls}>
                <option value="">All statuses</option>
                {(lookups?.statuses ?? []).map((value) => (
                  <option key={value} value={value}>
                    {ORDER_STATUS_LABELS[value] ?? value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Sort</label>
              <div className="flex gap-1">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'date' | 'number' | 'amount' | 'party')}
                  className={inputCls}
                >
                  <option value="date">Date</option>
                  <option value="number">Number</option>
                  <option value="amount">Amount</option>
                  <option value="party">Party</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                  className={`${inputCls} w-20`}
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 pt-4 text-[11.5px] font-semibold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(event) => setOverdue(event.target.checked)}
                className="w-3.5 h-3.5 accent-[#2c5f57]"
              />
              Overdue only
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            {labels.plural} <span className="text-slate-400">({total})</span>
          </span>
          <span className="text-[10.5px] text-slate-500 font-mono">
            {qty(totalQuantity)} qty · ₹ {money(totalAmount)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-[11.5px]">
            <thead>
              <tr className="bg-slate-100 text-[9.5px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-1.5 text-left">Order No</th>
                <th className="px-2 py-1.5 text-left w-24">Date</th>
                <th className="px-2 py-1.5 text-left">{labels.partyLabel}</th>
                <th className="px-2 py-1.5 text-left w-36">Status</th>
                <th className="px-2 py-1.5 text-center w-20">Priority</th>
                <th className="px-2 py-1.5 text-left w-24">Expected</th>
                <th className="px-2 py-1.5 text-right w-24">Pending Qty</th>
                <th className="px-2 py-1.5 text-right w-28">Value</th>
                <th className="px-2 py-1.5 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto" />
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">Loading {labels.plural.toLowerCase()}…</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center">
                    <p className="text-[12px] font-semibold text-slate-600">No {labels.plural.toLowerCase()} found</p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">
                      Adjust the filters or press F10 to create a new {labels.noun.toLowerCase()}.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0 hover:bg-[#2c5f57]/[0.03]">
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(paths.detail(row.id))}
                        className="font-mono text-[11px] font-bold text-[#2c5f57] hover:underline"
                      >
                        {row.orderNumber}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(row.orderDate)}</td>
                    <td className="px-2 py-1.5">
                      <p className="font-semibold text-slate-800 truncate max-w-[240px]">{row.party.partyName}</p>
                      <p className="text-[9.5px] text-slate-500 font-mono">{row.party.partyCode}</p>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={`px-1.5 py-0.5 text-[9.5px] font-bold uppercase rounded border ${statusTone(row.status)}`}>
                        {ORDER_STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`text-[9.5px] font-bold uppercase ${
                          row.priority === 'URGENT' ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        {row.priority === 'URGENT' ? 'Urgent' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">
                      {formatDate(row.expectedDeliveryDate)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-slate-700">{qty(row.totalPendingQuantity)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                      {money(row.totals.grandTotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate(paths.detail(row.id))}
                          title="View"
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-[#2c5f57] hover:bg-[#2c5f57]/10"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(paths.edit(row.id))}
                          disabled={row.status !== 'DRAFT' || isLocked}
                          title={row.status === 'DRAFT' ? 'Edit' : 'Only draft orders can be edited'}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(paths.print(row.id))}
                          title="Print"
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCancelTarget(row);
                            setCancelReason('');
                            setCancelError(null);
                          }}
                          disabled={!isCancellable(row) || isLocked}
                          title={isCancellable(row) ? 'Cancel order' : 'This order can no longer be cancelled'}
                          className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10.5px] text-slate-500">{pageLabel}</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page <= 1 || loading}
              className="px-2 py-1 text-[10.5px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </button>
            <span className="text-[10.5px] font-semibold text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 text-[10.5px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        F10 New · F5 Refresh · F2 Clear filters · Esc Dashboard
      </p>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Cancel Order</span>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11.5px] text-slate-600">
                Cancel <span className="font-mono font-bold">{cancelTarget.orderNumber}</span> for{' '}
                <span className="font-semibold">{cancelTarget.party.partyName}</span>? Cancelling is recorded in the
                order history and cannot be undone.
              </p>
              <div>
                <label className={labelCls}>Cancellation Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Why is this order being cancelled?"
                  className={`${inputCls} h-auto py-1 resize-y`}
                />
                {cancelError && <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{cancelError}</p>}
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={cancelling}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-red-600 text-white hover:bg-red-500 disabled:bg-slate-400 flex items-center gap-1.5"
                >
                  {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};