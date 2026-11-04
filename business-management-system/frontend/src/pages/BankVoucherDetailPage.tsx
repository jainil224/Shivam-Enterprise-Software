import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Landmark,
  Loader2,
  Pencil,
  Printer,
  XCircle,
} from 'lucide-react';
import { cancelBankVoucher, getBankVoucherById } from '../services/api';
import { BankVoucher, BankVoucherJournalLine, BankVoucherType, PAYMENT_MODE_LABELS } from '../types';
import { amountInWords } from '../utils/amountInWords';
import { bankVoucherPaths } from './BankVoucherEntryPage';

interface BankVoucherDetailPageProps {
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

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5';

export const BankVoucherDetailPage: React.FC<BankVoucherDetailPageProps> = ({ voucherType }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paths = bankVoucherPaths(voucherType);
  const isReceipt = voucherType === 'RECEIPT';
  const noun = isReceipt ? 'Bank Receipt' : 'Bank Payment';

  const [voucher, setVoucher] = useState<BankVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBankVoucherById(voucherType, id);
      setVoucher(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the voucher.');
    } finally {
      setLoading(false);
    }
  }, [id, voucherType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !cancelOpen) {
        event.preventDefault();
        navigate(paths.register);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, paths.register, cancelOpen]);

  const handleCancel = async () => {
    if (!voucher) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('A cancellation reason of at least 3 characters is required.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelBankVoucher(voucherType, voucher.id, cancelReason.trim());
      setVoucher(updated);
      setCancelOpen(false);
      setCancelReason('');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57]" />
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Voucher not available</p>
        <p className="text-xs text-slate-600">{error ?? 'The voucher could not be found.'}</p>
        <button
          type="button"
          onClick={() => navigate(paths.register)}
          className="mt-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          Back to Register
        </button>
      </div>
    );
  }

  const isCancelled = voucher.status === 'CANCELLED';
  const groups = new Map<number, BankVoucherJournalLine[]>();
  for (const line of voucher.journalLines ?? []) {
    const bucket: BankVoucherJournalLine[] = groups.get(line.revision) ?? [];
    bucket.push(line);
    groups.set(line.revision, bucket);
  }
  const revisions = Array.from(groups.keys()).sort((a, b) => b - a);

  return (
    <div className="w-full max-w-[1080px] mx-auto space-y-2.5 pb-8">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isReceipt ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight flex items-center gap-2">
              {noun} Voucher
              <span className="font-mono text-[12px] bg-white/15 px-2 py-0.5 rounded">
                {voucher.voucherNumber}
              </span>
              <span
                className={`text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                  isCancelled
                    ? 'bg-red-500/25 border-red-200/60 text-red-50'
                    : 'bg-emerald-500/25 border-emerald-200/60 text-emerald-50'
                }`}
              >
                {voucher.status}
              </span>
            </h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              Dated {formatDate(voucher.voucherDate)} · Revision {voucher.revision} ·{' '}
              {isReceipt ? 'Bank debit / ledger credit' : 'Ledger debit / bank credit'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(paths.register)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Register
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.print(voucher.id))}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.edit(voucher.id))}
            disabled={isCancelled}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-blue-500 hover:bg-blue-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              setCancelOpen(true);
              setCancelError(null);
              setCancelReason('');
            }}
            disabled={isCancelled}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-red-600 hover:bg-red-500 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </div>

      {isCancelled && (
        <div className="bg-red-50 border border-red-300 text-red-900 rounded-md px-3 py-2 text-[11.5px] space-y-0.5">
          <p className="font-bold flex items-center gap-1.5">
            <XCircle className="w-4 h-4" />
            Voucher cancelled — posting reversed
          </p>
          <p>Reason: {voucher.cancellationReason ?? '—'}</p>
          <p className="text-[10.5px] text-red-700">Cancelled at {formatDateTime(voucher.cancelledAt)}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2.5 items-start">
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            Voucher Information
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 text-[12px]">
            <div>
              <span className={labelCls}>Voucher Number</span>
              <p className="font-mono font-bold text-slate-800">{voucher.voucherNumber}</p>
            </div>
            <div>
              <span className={labelCls}>Voucher Date</span>
              <p className="font-semibold text-slate-800">{formatDate(voucher.voucherDate)}</p>
            </div>
            <div>
              <span className={labelCls}>Payment Mode</span>
              <p className="font-semibold text-slate-800">{PAYMENT_MODE_LABELS[voucher.paymentMode]}</p>
            </div>
            <div>
              <span className={labelCls}>{isReceipt ? 'Received From' : 'Paid To'}</span>
              <p className="font-semibold text-slate-800">{voucher.counterparty.accountName}</p>
              <p className="text-[10px] text-slate-400">
                {voucher.counterparty.accountCode}
                {voucher.party ? ` · Party ${voucher.party.partyCode}` : ' · Ledger'}
              </p>
            </div>
            <div>
              <span className={labelCls}>Bank Account</span>
              <p className="font-semibold text-slate-800">{voucher.bankAccountDisplayName}</p>
              <p className="text-[10px] text-slate-400">
                {voucher.bankAccount.accountCode}
                {voucher.branchName ? ` · ${voucher.branchName}` : ''}
              </p>
            </div>
            <div>
              <span className={labelCls}>Amount</span>
              <p
                className={`font-mono font-bold ${
                  isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'
                }`}
              >
                ₹ {money(voucher.amount)}
              </p>
            </div>
            <div>
              <span className={labelCls}>
                {voucher.paymentMode === 'CHEQUE' ? 'Cheque Number' : 'UTR / Reference'}
              </span>
              <p className="font-mono text-slate-800">
                {voucher.paymentMode === 'CHEQUE'
                  ? voucher.chequeNumber ?? '—'
                  : voucher.referenceNumber ?? '—'}
              </p>
            </div>
            {voucher.paymentMode === 'CHEQUE' && (
              <div>
                <span className={labelCls}>Cheque Date</span>
                <p className="font-semibold text-slate-800">{formatDate(voucher.chequeDate)}</p>
              </div>
            )}
            <div>
              <span className={labelCls}>Amount in Words</span>
              <p className="text-slate-700 text-[11px] leading-snug">{amountInWords(voucher.amount)}</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <span className={labelCls}>Narration</span>
              <p className="text-slate-700">{voucher.narration ?? '—'}</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <span className={labelCls}>Remarks</span>
              <p className="text-slate-700">{voucher.remarks ?? '—'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            Accounting Impact
          </div>
          <div className="p-3 space-y-2">
            <div className="rounded border border-emerald-200 bg-emerald-50/60 p-2">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">Debit Account</p>
              <p className="text-[11.5px] font-semibold text-slate-800">{voucher.debitAccount.accountName}</p>
              <p className="text-[10px] text-slate-500">{voucher.debitAccount.accountCode}</p>
              <p className="text-right font-mono font-bold text-emerald-800">₹ {money(voucher.amount)}</p>
            </div>
            <div className="rounded border border-blue-200 bg-blue-50/60 p-2">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-blue-700">Credit Account</p>
              <p className="text-[11.5px] font-semibold text-slate-800">{voucher.creditAccount.accountName}</p>
              <p className="text-[10px] text-slate-500">{voucher.creditAccount.accountCode}</p>
              <p className="text-right font-mono font-bold text-blue-800">₹ {money(voucher.amount)}</p>
            </div>
            <div className="flex items-center justify-between text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
              <span className="font-bold text-slate-600">Debit = Credit</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Balanced
              </span>
            </div>
            <div className="text-[10px] text-slate-500 border-t border-slate-200 pt-2 space-y-0.5">
              <p className="flex items-center gap-1">
                <Landmark className="w-3 h-3" />
                {isReceipt ? 'Bank balance increased' : 'Bank balance decreased'} by ₹ {money(voucher.amount)}
              </p>
              <p>Created {formatDateTime(voucher.createdAt)}</p>
              <p>Updated {formatDateTime(voucher.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
        <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          Journal Postings (Audit Trail)
        </div>
        <div className="p-3 space-y-2.5">
          {revisions.length === 0 ? (
            <p className="text-[11.5px] text-slate-500">No journal lines recorded for this voucher.</p>
          ) : (
            revisions.map((revision) => {
              const lines: BankVoucherJournalLine[] = groups.get(revision) ?? [];
              const debitTotal = lines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
              const creditTotal = lines.reduce((sum, line) => sum + Number(line.creditAmount), 0);
              return (
                <div key={revision} className="border border-slate-200 rounded overflow-hidden">
                  <div className="bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Revision {revision}</span>
                    <span className="font-mono text-slate-400">
                      Dr {money(debitTotal)} · Cr {money(creditTotal)}
                    </span>
                  </div>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-[9.5px] uppercase tracking-wider text-slate-400">
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">Ledger Account</th>
                        <th className="px-2 py-1 text-left">Posting Date</th>
                        <th className="px-2 py-1 text-left">Narration</th>
                        <th className="px-2 py-1 text-right">Debit</th>
                        <th className="px-2 py-1 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines
                        .slice()
                        .sort((a, b) => a.lineNumber - b.lineNumber)
                        .map((line) => (
                          <tr
                            key={line.id}
                            className={`border-t border-slate-100 ${line.isReversal ? 'bg-amber-50/50' : ''}`}
                          >
                            <td className="px-2 py-1 font-mono text-slate-400">{line.lineNumber}</td>
                            <td className="px-2 py-1">
                              <span className="font-mono text-[10px] text-slate-500">
                                {line.ledgerAccount.accountCode}
                              </span>
                              <span className="ml-1 font-semibold text-slate-800">
                                {line.ledgerAccount.accountName}
                              </span>
                              {line.isReversal && (
                                <span className="ml-1 text-[9px] font-bold text-amber-700 uppercase">
                                  reversal
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap">{formatDate(line.postingDate)}</td>
                            <td className="px-2 py-1 text-slate-500 text-[10.5px]">{line.narration ?? '—'}</td>
                            <td className="px-2 py-1 text-right font-mono text-slate-800">
                              {Number(line.debitAmount) === 0 ? '—' : money(line.debitAmount)}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-slate-800">
                              {Number(line.creditAmount) === 0 ? '—' : money(line.creditAmount)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
          <p className="text-[10px] text-slate-400 leading-snug">
            Posted lines are never deleted or overwritten. An edit appends a mirror reversal plus the corrected
            posting; a cancellation appends a mirror reversal only. Ledger balances are the sum of all debit
            lines minus all credit lines.
          </p>
        </div>
      </div>

      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-[14px] font-bold text-slate-800">Cancel {voucher.voucherNumber}?</h2>
                <p className="text-[11.5px] text-slate-600 mt-1">
                  The accounting posting will be reversed. The voucher is retained with its number, status and
                  cancellation audit details — it is never deleted.
                </p>
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="detailCancelReason">
                Cancellation reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="detailCancelReason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={3}
                maxLength={250}
                placeholder="State why this voucher is being cancelled (minimum 3 characters)"
                className="w-full px-2 py-1.5 text-[12px] border border-slate-300 rounded focus:outline-none focus:border-[#2c5f57]"
              />
            </div>
            {cancelError && (
              <p className="text-[11px] text-red-700 font-semibold bg-red-50 border border-red-200 rounded px-2 py-1">
                {cancelError}
              </p>
            )}
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
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