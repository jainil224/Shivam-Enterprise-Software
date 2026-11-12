import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  XCircle,
} from 'lucide-react';
import { cancelBankVoucher, getBankVoucherLookups, listBankVouchers } from '../services/api';
import {
  BankVoucher,
  BankVoucherLookups,
  BankVoucherStatus,
  BankVoucherType,
  PAYMENT_MODE_LABELS,
  PaymentMode,
} from '../types';
import { bankVoucherPaths } from './BankVoucherEntryPage';

interface BankVoucherRegisterPageProps {
  voucherType: BankVoucherType;
}

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface ReceiptPartyCell {
  name: string;
  code: string;
}

/**
 * Phase 18 receipts hold one row per party, so the register must show every
 * party on the voucher instead of only the header counterparty.
 */
const receiptParties = (row: BankVoucher): ReceiptPartyCell[] => {
  const seen = new Map<string, ReceiptPartyCell>();
  // Register (list) responses carry receiptParties; detail responses carry
  // receiptLines. Prefer the list field and fall back for older payloads.
  for (const party of row.receiptParties ?? []) {
    const name = party.partyName?.trim();
    if (!name) continue;
    const key = party.id || name;
    if (!seen.has(key)) {
      seen.set(key, { name, code: party.partyCode ?? '' });
    }
  }
  if (seen.size === 0) {
    for (const line of row.receiptLines ?? []) {
      const name = line.party?.partyName?.trim();
      if (!name) continue;
      const key = line.party?.id ?? name;
      if (!seen.has(key)) {
        seen.set(key, { name, code: line.party?.partyCode ?? '' });
      }
    }
  }
  if (seen.size === 0) {
    return [{ name: row.counterparty.accountName, code: row.counterparty.accountCode }];
  }
  return Array.from(seen.values());
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';

export const BankVoucherRegisterPage: React.FC<BankVoucherRegisterPageProps> = ({ voucherType }) => {
  const navigate = useNavigate();
  const paths = bankVoucherPaths(voucherType);
  const isReceipt = voucherType === 'RECEIPT';
  const noun = isReceipt ? 'Bank Receipt' : 'Bank Payment';

  const [lookups, setLookups] = useState<BankVoucherLookups | null>(null);
  const [rows, setRows] = useState<BankVoucher[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [bankAccountLedgerId, setBankAccountLedgerId] = useState('');
  const [paymentMode, setPaymentMode] = useState<'' | PaymentMode>('');
  const [status, setStatus] = useState<'' | BankVoucherStatus>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'number'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(true);

  const [cancelTarget, setCancelTarget] = useState<BankVoucher | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadLookups = useCallback(async () => {
    try {
      const data = await getBankVoucherLookups(voucherType);
      setLookups(data);
    } catch {
      setLookups(null);
    }
  }, [voucherType]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listBankVouchers(voucherType, {
        search: search.trim() === '' ? undefined : search.trim(),
        bankAccountLedgerId: bankAccountLedgerId === '' ? undefined : bankAccountLedgerId,
        paymentMode: paymentMode === '' ? undefined : paymentMode,
        status: status === '' ? undefined : status,
        fromDate: fromDate === '' ? undefined : fromDate,
        toDate: toDate === '' ? undefined : toDate,
        sortBy,
        sortOrder,
        page,
        limit,
      });
      setRows(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setTotalAmount(result.totalAmount);
    } catch (err) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setTotalAmount('0.00');
      setError(err instanceof Error ? err.message : 'Failed to load the register.');
    } finally {
      setLoading(false);
    }
  }, [
    voucherType,
    search,
    bankAccountLedgerId,
    paymentMode,
    status,
    fromDate,
    toDate,
    sortBy,
    sortOrder,
    page,
    limit,
  ]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const resetFilters = useCallback(() => {
    setSearch('');
    setBankAccountLedgerId('');
    setPaymentMode('');
    setStatus('');
    setFromDate('');
    setToDate('');
    setSortBy('date');
    setSortOrder('desc');
    setPage(1);
  }, []);

  const isLocked = lookups?.financialYear.isLocked ?? false;

  const pageLabel = useMemo(() => {
    if (total === 0) return 'No vouchers';
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    return `Showing ${start}-${end} of ${total}`;
  }, [page, limit, total]);

  // Page-scoped shortcuts: F10 new entry, F2 clear filters, Esc dashboard
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
      } else if (event.key === 'Escape' && !cancelTarget) {
        event.preventDefault();
        navigate('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, paths.create, resetFilters, loadRows, isLocked, cancelTarget]);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('A cancellation reason of at least 3 characters is required.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelBankVoucher(voucherType, cancelTarget.id, cancelReason.trim());
      setCancelTarget(null);
      setCancelReason('');
      await loadRows();
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      setCancelError(
        apiErrors && apiErrors.length > 0
          ? apiErrors[0].message
          : err instanceof Error
            ? err.message
            : 'Failed to cancel the voucher.'
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto space-y-2.5 pb-8">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isReceipt ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">{noun} Register</h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              Posted and cancelled vouchers
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
            onClick={() => void loadRows()}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh (F5)
          </button>
          {isReceipt && (
            <button
              type="button"
              onClick={() => navigate('/transactions/bank-receipts/books')}
              disabled={isLocked}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Cheque Receipt Book
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(paths.create)}
            disabled={isLocked}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New {isReceipt ? 'Receipt' : 'Payment'} (F10)
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Financial year {lookups?.financialYear.yearName} is locked — new postings, edits and cancellations are
          blocked. Existing vouchers remain viewable and printable.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {showFilters && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-2.5">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            <div className="col-span-2">
              <label className={labelCls} htmlFor="search">
                Search
              </label>
              <input
                id="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Voucher no, party, reference, cheque…"
                className={inputCls}
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls} htmlFor="bankFilter">
                Bank Account
              </label>
              <select
                id="bankFilter"
                value={bankAccountLedgerId}
                onChange={(event) => {
                  setBankAccountLedgerId(event.target.value);
                  setPage(1);
                }}
                className={inputCls}
              >
                <option value="">All bank accounts</option>
                {(lookups?.bankAccounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountCode} · {account.bankName || account.accountName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="modeFilter">
                Mode
              </label>
              <select
                id="modeFilter"
                value={paymentMode}
                onChange={(event) => {
                  setPaymentMode(event.target.value as '' | PaymentMode);
                  setPage(1);
                }}
                className={inputCls}
              >
                <option value="">All modes</option>
                {(lookups?.paymentModes ?? []).map((mode) => (
                  <option key={mode} value={mode}>
                    {PAYMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="statusFilter">
                Status
              </label>
              <select
                id="statusFilter"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as '' | BankVoucherStatus);
                  setPage(1);
                }}
                className={inputCls}
              >
                <option value="">All status</option>
                <option value="POSTED">Posted</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="fromDate">
                From
              </label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value);
                  setPage(1);
                }}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="toDate">
                To
              </label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value);
                  setPage(1);
                }}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="sortBy">
                Sort
              </label>
              <div className="flex gap-1">
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'date' | 'number')}
                  className={inputCls}
                >
                  <option value="date">Date</option>
                  <option value="number">Voucher no</option>
                </select>
                <select
                  value={sortOrder}
                  onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                  className={inputCls}
                  aria-label="Sort order"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <div className="text-[11px] text-slate-600 font-semibold">
              {pageLabel} · Filtered total:
              <span className="ml-1 font-mono font-bold text-slate-900">₹ {money(totalAmount)}</span>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              Clear Filters (F2)
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Voucher No</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Date</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">
                  {isReceipt ? 'Received From' : 'Paid To'}
                </th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Bank</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Mode</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Reference</th>
                <th className="px-2 py-1.5 text-right border-b border-slate-300">Amount</th>
                <th className="px-2 py-1.5 text-center border-b border-slate-300">Status</th>
                <th className="px-2 py-1.5 text-center border-b border-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-2 py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto mb-2" />
                    Loading vouchers…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-10 text-center text-slate-500">
                    <p className="text-[12.5px] font-semibold text-slate-600">
                      No {noun.toLowerCase()} vouchers found
                    </p>
                    <p className="text-[11px] mt-1">
                      {total === 0 && search === '' && bankAccountLedgerId === '' && fromDate === '' && toDate === ''
                        ? 'Create the first voucher with the New button (F10).'
                        : 'Try clearing the filters or widening the date range.'}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isCancelled = row.status === 'CANCELLED';
                  const parties = receiptParties(row);
                  const rowCount = row.receiptRowCount ?? row.receiptLines?.length ?? 1;
                  const isBookReceipt = Boolean(row.receiptBook);
                  const isMultiRow = isBookReceipt || rowCount > 1;
                  const viewPath = isMultiRow
                    ? `/transactions/bank-receipts/cheque-entry/${row.id}`
                    : paths.view(row.id);
                  const printPath = isMultiRow
                    ? `/transactions/bank-receipts/cheque-entry/${row.id}/print`
                    : paths.print(row.id);
                  const editPath = isMultiRow
                    ? `/transactions/bank-receipts/cheque-entry/${row.id}`
                    : paths.edit(row.id);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${
                        isCancelled ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-800">{row.voucherNumber}</div>
                        {isBookReceipt && (
                          <div className="text-[10px] text-slate-400">
                            {row.receiptBook?.bookName ?? 'Receipt book'}
                            {rowCount > 1 ? ` · ${rowCount} rows` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDate(row.voucherDate)}</td>
                      <td className="px-2 py-1.5">
                        <div
                          className="font-semibold text-slate-800"
                          title={parties.map((party) => party.name).join(', ')}
                        >
                          {parties.length === 1 ? parties[0].name : `${parties.length} parties`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {parties.length === 1
                            ? `${parties[0].code}${row.party ? ' · party' : ' · ledger'}`
                            : `${parties
                                .slice(0, 2)
                                .map((party) => party.name)
                                .join(', ')}${parties.length > 2 ? ` +${parties.length - 2} more` : ''}`}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div>{row.bankAccountDisplayName}</div>
                        <div className="text-[10px] text-slate-400">{row.bankAccount.accountCode}</div>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{PAYMENT_MODE_LABELS[row.paymentMode]}</td>
                      <td className="px-2 py-1.5 font-mono text-[10.5px]">
                        {row.paymentMode === 'CHEQUE'
                          ? `Chq ${row.chequeNumber ?? '—'}${row.chequeDate ? ` · ${formatDate(row.chequeDate)}` : ''}`
                          : row.referenceNumber ?? '—'}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-mono font-bold whitespace-nowrap ${
                          isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'
                        }`}
                      >
                        ₹ {money(row.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border ${
                            isCancelled
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-300'
                          }`}
                          title={isCancelled ? row.cancellationReason ?? '' : undefined}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(viewPath)}
                            title="View"
                            className="p-1 rounded text-slate-500 hover:text-[#2c5f57] hover:bg-slate-100"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(printPath)}
                            title="Print"
                            className="p-1 rounded text-slate-500 hover:text-[#2c5f57] hover:bg-slate-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(editPath)}
                            disabled={isCancelled || isLocked}
                            title={isCancelled ? 'Cancelled vouchers cannot be edited' : 'Edit'}
                            className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCancelTarget(row);
                              setCancelReason('');
                              setCancelError(null);
                            }}
                            disabled={isCancelled || isLocked}
                            title={
                              isCancelled
                                ? 'Already cancelled'
                                : isLocked
                                  ? 'Financial year is locked'
                                  : 'Cancel voucher'
                            }
                            className="p-1 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-200 bg-slate-50 text-[11px]">
          <span className="text-slate-600 font-semibold">
            {pageLabel}
            <span className="ml-2 text-slate-400">· {totalPages} page(s)</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading}
              className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 flex items-center gap-0.5"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <span className="px-2 font-mono font-bold text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading}
              className="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 flex items-center gap-0.5"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[14px] font-bold text-slate-800">
                  Cancel {cancelTarget.voucherNumber}?
                </h2>
                <p className="text-[11.5px] text-slate-600 mt-1">
                  The voucher will not be deleted. Its accounting posting is reversed, the voucher number stays
                  consumed, and the cancellation is recorded permanently.
                </p>
              </div>
            </div>

            <div className="text-[11.5px] bg-slate-50 border border-slate-200 rounded p-2 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-mono font-bold">₹ {money(cancelTarget.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Counterparty</span>
                <span className="font-semibold">{cancelTarget.counterparty.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bank</span>
                <span className="font-semibold">{cancelTarget.bankAccountDisplayName}</span>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="cancelReason">
                Cancellation reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                maxLength={250}
                rows={3}
                placeholder="State why this voucher is being cancelled (minimum 3 characters)"
                className="w-full px-2 py-1.5 text-[12px] border border-slate-300 rounded focus:outline-none focus:border-[#2c5f57]"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Stored with the voucher audit trail.</span>
                <span>{cancelReason.length}/250</span>
              </div>
            </div>

            {cancelError && (
              <p className="text-[11px] text-red-700 font-semibold bg-red-50 border border-red-200 rounded px-2 py-1">
                {cancelError}
              </p>
            )}

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCancelTarget(null);
                  setCancelError(null);
                }}
                disabled={cancelling}
                className="px-3 py-1.5 text-[11.5px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                Keep Voucher
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="px-3 py-1.5 text-[11.5px] font-bold rounded bg-red-600 text-white hover:bg-red-500 disabled:bg-slate-400 flex items-center gap-1.5"
              >
                {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {cancelling ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};