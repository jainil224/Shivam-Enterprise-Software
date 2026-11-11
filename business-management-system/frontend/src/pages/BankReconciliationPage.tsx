import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Lock,
  Printer,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  exportBankReconciliationPdf,
  getBankReconciliation,
  markBankReconciliationLine,
  removeBankReconciliationLine,
  saveBankReconciliationOpeningBalance,
  saveBankReconciliationStatementBalance,
} from '../services/api';
import type {
  ReconciliationContext,
  ReconciliationTransaction,
  ReconciliationViewType,
} from '../types/bankReconciliation';

const formatMoney = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Math.abs(numeric).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatSignedMoney = (value: string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  const text = Math.abs(numeric).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return numeric < 0 ? '-' + text : text;
};

const displayDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? match[3] + '-' + match[2] + '-' + match[1] : value;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const resolveError = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
  return response?.data?.error?.message ?? fallback;
};

interface ClearingDialogState {
  journalLineId: string;
  value: string;
  minimum: string;
  accountName: string;
  amountLabel: string;
}

interface ConfirmState {
  journalLineId: string;
  accountName: string;
  clearingDate: string;
}

interface OpeningDialogState {
  value: string;
  acknowledge: boolean;
}

const VIEW_LABELS: Array<{ key: ReconciliationViewType; label: string }> = [
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'RECEIPTS', label: 'Receipts' },
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
];

export const BankReconciliationPage: React.FC = () => {
  const { bankLedgerId } = useParams<{ bankLedgerId: string }>();
  const navigate = useNavigate();
  const { activeFinancialYear } = useCompany();

  const fyStart = activeFinancialYear ? activeFinancialYear.startDate.slice(0, 10) : todayIso();
  const fyEnd = activeFinancialYear ? activeFinancialYear.endDate.slice(0, 10) : todayIso();
  const defaultToDate = (() => {
    const today = todayIso();
    return today < fyStart ? fyStart : today > fyEnd ? fyEnd : today;
  })();

  const [fromDate, setFromDate] = useState(fyStart);
  const [toDate, setToDate] = useState(defaultToDate);
  const [context, setContext] = useState<ReconciliationContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statementInput, setStatementInput] = useState('');
  const [statementDirty, setStatementDirty] = useState(false);
  const [viewType, setViewType] = useState<ReconciliationViewType>('ALL');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [clearingDialog, setClearingDialog] = useState<ClearingDialogState | null>(null);
  const [confirmRemoval, setConfirmRemoval] = useState<ConfirmState | null>(null);
  const [openingDialog, setOpeningDialog] = useState<OpeningDialogState | null>(null);
  const [busyLineId, setBusyLineId] = useState<string | null>(null);
  const [savingStatement, setSavingStatement] = useState(false);
  const [savingOpening, setSavingOpening] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [openingWarning, setOpeningWarning] = useState<string | null>(null);

  const tableRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (nextFrom: string, nextTo: string, options?: { silent?: boolean }) => {
      if (!bankLedgerId) return;
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const data = await getBankReconciliation({
          bankLedgerAccountId: bankLedgerId,
          fromDate: nextFrom,
          toDate: nextTo,
        });
        setContext(data);
        setFromDate(data.fromDate);
        setToDate(data.toDate);
        setStatementInput(data.summary.statementBalance ?? '');
        setStatementDirty(false);
        setSelectedLineId((current) => {
          if (current && data.transactions.some((row) => row.journalLineId === current)) return current;
          return data.transactions[0]?.journalLineId ?? null;
        });
        setOpeningWarning(
          data.opening.requiresAcknowledgement
            ? 'Software Bank Book Opening Balance and Opening Reconciliation Entry Difference: ' +
                formatSignedMoney(data.opening.difference) +
                '. Please verify the opening balance entered as per the bank statement.'
            : null
        );
        if (data.opening.requiresSetup) {
          setOpeningDialog({
            value: data.opening.openingStatementBalance ?? '',
            acknowledge: false,
          });
        }
      } catch (err) {
        setError(resolveError(err, 'Unable to load the bank reconciliation data.'));
        setContext(null);
      } finally {
        setLoading(false);
      }
    },
    [bankLedgerId]
  );

  useEffect(() => {
    if (!bankLedgerId) return;
    void load(fyStart, defaultToDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankLedgerId]);

  const reload = useCallback(
    async (options?: { silent?: boolean }) => {
      await load(fromDate, toDate, options);
    },
    [load, fromDate, toDate]
  );

  const transactions = context?.transactions ?? [];
  const summary = context?.summary ?? null;

  const visibleTransactions = useMemo(() => {
    if (viewType === 'PAYMENTS') return transactions.filter((row) => row.paymentAmount !== '0.00');
    if (viewType === 'RECEIPTS') return transactions.filter((row) => row.receiptAmount !== '0.00');
    if (viewType === 'PENDING') return transactions.filter((row) => row.isPending);
    return transactions;
  }, [transactions, viewType]);

  const selectedTransaction = useMemo(
    () => transactions.find((row) => row.journalLineId === selectedLineId) ?? null,
    [transactions, selectedLineId]
  );
  const applyStatement = useCallback(async () => {
    if (!bankLedgerId || !context) return;
    const raw = statementInput.trim();
    if (raw === '') {
      setNotice({ tone: 'error', text: 'Enter the closing balance as per the bank statement.' });
      return;
    }
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) {
      setNotice({ tone: 'error', text: 'Balance as statement must be a valid signed number.' });
      return;
    }
    const normalized = numeric.toFixed(2);
    const current = context.summary.statementBalance;
    const unchanged =
      !statementDirty && current !== null && Number(current).toFixed(2) === normalized;

    if (unchanged) {
      await reload({ silent: true });
      setNotice({ tone: 'ok', text: 'Recalculated against the current clearing dates.' });
      return;
    }

    setSavingStatement(true);
    try {
      const result = await saveBankReconciliationStatementBalance({
        bankLedgerAccountId: bankLedgerId,
        fromDate,
        toDate,
        statementBalance: normalized,
      });
      await reload({ silent: true });
      setNotice(
        result.status === 'BALANCED'
          ? { tone: 'ok', text: 'Balances agree. Difference is 0.00.' }
          : {
              tone: 'warn',
              text:
                'Saved. Difference is ' +
                formatSignedMoney(result.summary.difference) +
                ' - the book balance and the bank statement do not agree yet.',
            }
      );
    } catch (err) {
      setNotice({ tone: 'error', text: resolveError(err, 'Unable to save the statement balance.') });
    } finally {
      setSavingStatement(false);
    }
  }, [bankLedgerId, context, statementInput, statementDirty, fromDate, toDate, reload]);

  const submitClearing = useCallback(async () => {
    if (!clearingDialog || !bankLedgerId) return;
    if (!clearingDialog.value) {
      setNotice({ tone: 'error', text: 'Enter the clearing date shown in the bank statement.' });
      return;
    }
    if (clearingDialog.value < clearingDialog.minimum) {
      setNotice({
        tone: 'error',
        text:
          'Clearing date cannot precede the transaction/cheque date (' +
          displayDate(clearingDialog.minimum) +
          ').',
      });
      return;
    }
    setBusyLineId(clearingDialog.journalLineId);
    try {
      await markBankReconciliationLine(clearingDialog.journalLineId, clearingDialog.value);
      setClearingDialog(null);
      await reload({ silent: true });
      setNotice({ tone: 'ok', text: 'Clearing date saved. Summary recalculated.' });
    } catch (err) {
      setNotice({ tone: 'error', text: resolveError(err, 'Unable to mark the transaction reconciled.') });
    } finally {
      setBusyLineId(null);
    }
  }, [clearingDialog, bankLedgerId, reload]);

  const submitRemoval = useCallback(async () => {
    if (!confirmRemoval || !bankLedgerId) return;
    setBusyLineId(confirmRemoval.journalLineId);
    try {
      await removeBankReconciliationLine(
        confirmRemoval.journalLineId,
        'Clearing date removed from the bank reconciliation screen.'
      );
      setConfirmRemoval(null);
      await reload({ silent: true });
      setNotice({ tone: 'ok', text: 'Clearing date removed. The transaction is pending again.' });
    } catch (err) {
      setNotice({ tone: 'error', text: resolveError(err, 'Unable to remove the clearing date.') });
    } finally {
      setBusyLineId(null);
    }
  }, [confirmRemoval, bankLedgerId, reload]);

  const submitOpening = useCallback(
    async (acknowledge: boolean) => {
      if (!openingDialog || !bankLedgerId) return;
      const raw = openingDialog.value.trim();
      const numeric = Number(raw);
      if (raw === '' || !Number.isFinite(numeric)) {
        setNotice({
          tone: 'error',
          text: 'Enter the opening balance as per the bank statement as a signed number.',
        });
        return;
      }
      setSavingOpening(true);
      try {
        const result = await saveBankReconciliationOpeningBalance({
          bankLedgerAccountId: bankLedgerId,
          openingDate: context?.opening.openingDate,
          openingStatementBalance: numeric.toFixed(2),
          acknowledgeDifference: acknowledge,
        });
        if (result.warning && result.warning.requiresAcknowledgement) {
          setOpeningWarning(result.warning.message);
          setOpeningDialog({ value: numeric.toFixed(2), acknowledge: false });
          setNotice({
            tone: 'warn',
            text: 'Opening difference must be acknowledged before the reconciliation is complete.',
          });
          return;
        }
        setOpeningDialog(null);
        setOpeningWarning(null);
        await reload({ silent: true });
        setNotice({ tone: 'ok', text: 'Opening statement balance saved.' });
      } catch (err) {
        setNotice({ tone: 'error', text: resolveError(err, 'Unable to save the opening balance.') });
      } finally {
        setSavingOpening(false);
      }
    },
    [openingDialog, bankLedgerId, context, reload]
  );

  const acknowledgeOpening = useCallback(async () => {
    if (!bankLedgerId || !context?.opening.openingStatementBalance) return;
    setSavingOpening(true);
    try {
      const result = await saveBankReconciliationOpeningBalance({
        bankLedgerAccountId: bankLedgerId,
        openingDate: context.opening.openingDate,
        openingStatementBalance: context.opening.openingStatementBalance,
        acknowledgeDifference: true,
      });
      setOpeningWarning(result.warning ? result.warning.message : null);
      await reload({ silent: true });
      setNotice({ tone: 'ok', text: 'Opening difference acknowledged and audited.' });
    } catch (err) {
      setNotice({ tone: 'error', text: resolveError(err, 'Unable to acknowledge the opening difference.') });
    } finally {
      setSavingOpening(false);
    }
  }, [bankLedgerId, context, reload]);

  const exportPdf = useCallback(async () => {
    if (!bankLedgerId) return;
    setExporting(true);
    try {
      const { blob, filename } = await exportBankReconciliationPdf({
        bankLedgerAccountId: bankLedgerId,
        fromDate,
        toDate,
        orientation: 'portrait',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setNotice({ tone: 'ok', text: 'Bank Reconciliation PDF generated: ' + filename });
    } catch (err) {
      setNotice({ tone: 'error', text: resolveError(err, 'Unable to generate the PDF.') });
    } finally {
      setExporting(false);
    }
  }, [bankLedgerId, fromDate, toDate]);

  const openClearingDialog = useCallback(
    (row: ReconciliationTransaction) => {
      const minimum = row.transactionDate;
      setClearingDialog({
        journalLineId: row.journalLineId,
        value: minimum > toDate ? minimum : toDate,
        minimum,
        accountName: row.accountName,
        amountLabel:
          row.paymentAmount !== '0.00'
            ? 'Payment ' + formatMoney(row.paymentAmount)
            : 'Receipt ' + formatMoney(row.receiptAmount),
      });
    },
    [toDate]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping) return;
      if (clearingDialog || confirmRemoval || openingDialog) return;

      if (event.key === '+' || (event.key === '=' && event.shiftKey)) {
        if (!selectedTransaction || selectedTransaction.isCleared) return;
        event.preventDefault();
        openClearingDialog(selectedTransaction);
        return;
      }
      if (event.key === '-' || event.key === '_') {
        if (!selectedTransaction || !selectedTransaction.isCleared) return;
        event.preventDefault();
        setConfirmRemoval({
          journalLineId: selectedTransaction.journalLineId,
          accountName: selectedTransaction.accountName,
          clearingDate: selectedTransaction.clearingDate ?? '',
        });
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (visibleTransactions.length === 0) return;
        event.preventDefault();
        const index = visibleTransactions.findIndex(
          (row) => row.journalLineId === selectedLineId
        );
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex =
          index < 0
            ? 0
            : (index + delta + visibleTransactions.length) % visibleTransactions.length;
        setSelectedLineId(visibleTransactions[nextIndex].journalLineId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    clearingDialog,
    confirmRemoval,
    openingDialog,
    selectedTransaction,
    selectedLineId,
    visibleTransactions,
    openClearingDialog,
  ]);
  if (!bankLedgerId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs font-semibold text-slate-600">
          No bank book selected. Return to the Bank Book selection screen.
        </p>
      </div>
    );
  }

  const bank = context?.bank;
  const isLocked = context?.financialYear.isLocked ?? false;
  const canWrite = !isLocked;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
        <button type="button" onClick={() => navigate('/')} className="hover:text-slate-900">
          Dashboard
        </button>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span>Report</span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span>Day Book Register</span>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <button
          type="button"
          onClick={() => navigate('/reports/bank-reconciliation')}
          className="hover:text-slate-900"
        >
          Bank Reconciliation
        </button>
        <ChevronRight className="h-3 w-3 text-slate-400" />
        <span className="font-semibold text-slate-800">{bank?.accountName ?? 'Loading...'}</span>
      </div>

      <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#789d93] bg-[#2c5f57] px-3 py-2 text-white">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/reports/bank-reconciliation')}
            className="rounded-lg border border-white/30 p-1.5 hover:bg-white/10"
            title="Back to bank book selection"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/60">Bank Book</p>
            <h1 className="text-[13px] font-bold leading-tight">
              {bank?.accountName ?? 'Loading bank book...'}
            </h1>
            <p className="text-[10px] text-white/70">
              {bank
                ? [bank.bankName, bank.branchName, bank.bankAccountNumber]
                    .filter((part): part is string => Boolean(part && part.trim()))
                    .join(' | ')
                : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-white/25 px-2 py-1 text-[10px] font-semibold text-white/85">
            FY {context?.financialYear.yearName ?? '-'}
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={'h-3.5 w-3.5' + (loading ? ' animate-spin' : '')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                '/reports/bank-reconciliation/' +
                  bankLedgerId +
                  '/print?from=' +
                  fromDate +
                  '&to=' +
                  toDate
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10"
          >
            <Printer className="h-3.5 w-3.5" />
            Statement
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#2c5f57] hover:bg-white/90 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Reports
          </button>
        </div>
      </header>

      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Financial year {context?.financialYear.yearName} is locked. Reconciliation changes are
          blocked; the screen stays read-only.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {openingWarning && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <div className="flex-1">
              <p className="font-bold uppercase tracking-wide">Warning</p>
              <p className="font-semibold">{openingWarning}</p>
              <p className="mt-0.5 text-[10px] text-amber-800">
                The bank-book opening balance itself is never changed by this module. The opening
                statement amount is reconciliation metadata only.
              </p>
            </div>
            {context?.opening.requiresAcknowledgement && canWrite && (
              <button
                type="button"
                onClick={() => void acknowledgeOpening()}
                disabled={savingOpening}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {savingOpening ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Acknowledge
              </button>
            )}
          </div>
        </div>
      )}

      {notice && (
        <div
          className={
            'flex items-start justify-between gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold ' +
            (notice.tone === 'ok'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : notice.tone === 'warn'
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-rose-300 bg-rose-50 text-rose-700')
          }
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            min={context?.financialYear.startDate}
            max={context?.financialYear.endDate}
            onChange={(event) => setFromDate(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void load(event.currentTarget.value || fromDate, toDate);
              }
            }}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800 focus:border-[#2c5f57] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            max={context?.financialYear.endDate}
            onChange={(event) => setToDate(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void load(fromDate, event.currentTarget.value || toDate);
              }
            }}
            className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-800 focus:border-[#2c5f57] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Balance as Statement ({displayDate(toDate)})
          </label>
          <div className="mt-0.5 flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={statementInput}
              disabled={!canWrite}
              placeholder="0.00"
              onChange={(event) => {
                setStatementInput(event.target.value);
                setStatementDirty(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void applyStatement();
                }
              }}
              className="w-full rounded-lg border border-slate-300 px-2 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-[#2c5f57] focus:outline-none disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => void applyStatement()}
              disabled={savingStatement || !canWrite}
              className="flex items-center gap-1 rounded-lg bg-[#2c5f57] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#244d47] disabled:opacity-60"
            >
              {savingStatement ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Enter
            </button>
          </div>
          <p className="mt-0.5 text-[9px] text-slate-500">
            Enter (-) values for credit. Positive = Dr, negative = Cr.
          </p>
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Balance as per Book
          </label>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900">
            {formatMoney(summary?.closingBookBalance)}
            <span className="ml-1 text-[10px] font-bold text-slate-500">
              {Number(summary?.closingBookBalance ?? 0) < 0 ? 'Cr' : 'Dr'}
            </span>
          </p>
          <p className="text-[9px] text-slate-500">
            Opening {formatMoney(summary?.openingBookBalance)} + receipts{' '}
            {formatMoney(summary?.totalReceipts)} - payments {formatMoney(summary?.totalPayments)}
          </p>
        </div>
        <div>
          <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Opening Statement Balance
          </label>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-slate-900">
              {context?.opening.openingStatementBalance === null
                ? 'Not set'
                : formatSignedMoney(context?.opening.openingStatementBalance)}
            </span>
            <button
              type="button"
              onClick={() =>
                setOpeningDialog({
                  value: context?.opening.openingStatementBalance ?? '',
                  acknowledge: false,
                })
              }
              disabled={!canWrite}
              className="rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Edit
            </button>
          </div>
          <p className="text-[9px] text-slate-500">
            As at {displayDate(context?.opening.openingDate)} | Book{' '}
            {formatMoney(context?.opening.openingBookBalance)}
          </p>
        </div>
      </section>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Bank Transactions
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {visibleTransactions.length} of {transactions.length}
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              {summary?.pendingCount ?? 0} pending
            </span>
          </div>
          <p className="text-[9px] text-slate-500">
            (+) key for reconciliation, (-) key to remove a clearing date, Up/Down to move.
          </p>
        </div>

        <div ref={tableRef} className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading real bank transactions...
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <CalendarCheck className="h-7 w-7 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No transactions for this view</p>
              <p className="text-[11px] text-slate-500">
                {transactions.length === 0
                  ? 'No posted bank transactions fall inside the selected period for this bank book.'
                  : 'Switch the filter to All to see every posted bank transaction in the period.'}
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-1.5 text-left">Cheque Date</th>
                  <th className="px-2 py-1.5 text-left">Clearing Date</th>
                  <th className="px-2 py-1.5 text-left">Cheque No</th>
                  <th className="px-2 py-1.5 text-left">Account Name</th>
                  <th className="px-2 py-1.5 text-right">Receipt</th>
                  <th className="px-2 py-1.5 text-right">Payment</th>
                  <th className="px-2 py-1.5 text-center">Status</th>
                  <th className="px-2 py-1.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((row) => {
                  const isSelected = row.journalLineId === selectedLineId;
                  const isBusy = busyLineId === row.journalLineId;
                  return (
                    <tr
                      key={row.journalLineId}
                      onClick={() => setSelectedLineId(row.journalLineId)}
                      onDoubleClick={() => {
                        if (!canWrite) return;
                        if (row.isCleared) {
                          setConfirmRemoval({
                            journalLineId: row.journalLineId,
                            accountName: row.accountName,
                            clearingDate: row.clearingDate ?? '',
                          });
                        } else {
                          openClearingDialog(row);
                        }
                      }}
                      className={
                        'cursor-pointer border-b border-slate-100 ' +
                        (isSelected ? 'bg-[#eef4f2]' : 'hover:bg-slate-50')
                      }
                      aria-selected={isSelected}
                    >
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-700">
                        {displayDate(row.chequeDate ?? row.transactionDate)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 font-mono">
                        {row.clearingDate ? (
                          <span className="font-semibold text-emerald-700">
                            {displayDate(row.clearingDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-700">
                        {row.chequeNumber ?? row.referenceNumber ?? '-'}
                      </td>
                      <td className="px-2 py-1">
                        <span className="font-semibold text-slate-900">{row.accountName}</span>
                        <span className="ml-1 text-[9px] uppercase text-slate-400">
                          {row.sourceType === 'DEBIT_NOTE' ? 'DN' : row.sourceType}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right font-mono font-semibold text-emerald-700">
                        {row.receiptAmount !== '0.00' ? formatMoney(row.receiptAmount) : ''}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right font-mono font-semibold text-rose-700">
                        {row.paymentAmount !== '0.00' ? formatMoney(row.paymentAmount) : ''}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <span
                          className={
                            'inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ' +
                            (row.isCleared
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-800')
                          }
                        >
                          {row.isCleared ? 'Cleared' : 'Pending'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-right">
                        {row.isCleared ? (
                          <button
                            type="button"
                            disabled={!canWrite || isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              setConfirmRemoval({
                                journalLineId: row.journalLineId,
                                accountName: row.accountName,
                                clearingDate: row.clearingDate ?? '',
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                            Remove Clearing Date
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canWrite || isBusy}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedLineId(row.journalLineId);
                              openClearingDialog(row);
                            }}
                            className="inline-flex items-center gap-1 rounded bg-[#2c5f57] px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-[#244d47] disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Mark Reconciled
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {VIEW_LABELS.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => setViewType(view.key)}
              className={
                'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ' +
                (viewType === view.key
                  ? 'border-[#2c5f57] bg-[#2c5f57] text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100')
              }
            >
              {view.label}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <FileText className="h-3.5 w-3.5" />
            Reports
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(
                '/reports/bank-reconciliation/' +
                  bankLedgerId +
                  '/print?from=' +
                  fromDate +
                  '&to=' +
                  toDate
              )
            }
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            <Printer className="h-3.5 w-3.5" />
            Statement
          </button>
          <p className="w-full text-[9px] text-slate-500">
            Filters change the visible rows only. Totals always cover the full period.
          </p>
        </div>

        <div className="min-w-[290px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="font-semibold text-slate-600">Closing Balance as Per Books</span>
            <span className="font-mono font-bold text-slate-900">
              {formatMoney(summary?.closingBookBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="font-semibold text-slate-600">Uncleared Payments</span>
            <span className="font-mono font-bold text-slate-900">
              {formatMoney(summary?.unclearedPayments)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="font-semibold text-slate-600">Uncleared Receipts</span>
            <span className="font-mono font-bold text-slate-900">
              {formatSignedMoney(summary?.unclearedReceipts)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-300 pt-1 text-[11px]">
            <span className="font-bold text-slate-700">Closing Balance as Per Bank</span>
            <span className="font-mono font-bold text-slate-900">
              {formatMoney(summary?.calculatedBankBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px]">
            <span className="font-bold text-slate-700">Difference</span>
            <span
              className={
                'font-mono text-[12px] font-bold ' +
                (!summary || summary.difference === null
                  ? 'text-slate-500'
                  : summary.differenceIsZero
                    ? 'text-emerald-700'
                    : 'text-rose-700')
              }
            >
              {summary && summary.difference !== null ? formatSignedMoney(summary.difference) : 'Not entered'}
            </span>
          </div>
          {summary && summary.difference !== null && !summary.differenceIsZero && (
            <p className="mt-1 text-[9px] font-semibold text-rose-700">
              Difference is genuine. A missing bank charge or direct credit must be entered through the
              existing voucher workflow; this module never creates an adjustment voucher.
            </p>
          )}
        </div>
      </section>
      {clearingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Clearing Date</h3>
                <p className="text-[10px] text-slate-500">
                  {clearingDialog.accountName} | {clearingDialog.amountLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClearingDialog(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 px-4 py-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Enter Clearing Date as per Bank Statement
              </label>
              <input
                type="date"
                autoFocus
                value={clearingDialog.value}
                min={clearingDialog.minimum}
                onChange={(event) =>
                  setClearingDialog({ ...clearingDialog, value: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submitClearing();
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-900 focus:border-[#2c5f57] focus:outline-none"
              />
              <p className="text-[9px] text-slate-500">
                Transaction date is {displayDate(clearingDialog.minimum)}. The clearing date cannot be
                earlier than that. A clearing date after the To Date still counts as uncleared for the
                selected historical period.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setClearingDialog(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitClearing()}
                disabled={busyLineId !== null}
                className="flex items-center gap-1.5 rounded-lg bg-[#2c5f57] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#244d47] disabled:opacity-60"
              >
                {busyLineId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save Clearing Date
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <h3 className="text-sm font-bold text-slate-900">Remove Clearing Date</h3>
              <button
                type="button"
                onClick={() => setConfirmRemoval(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-3 text-[11px] text-slate-700">
              <p className="font-semibold">
                Remove the clearing date {displayDate(confirmRemoval.clearingDate)} from{' '}
                {confirmRemoval.accountName}?
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                The transaction returns to Pending and the summary is recalculated. The previous
                clearing date is preserved in the reconciliation audit history.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setConfirmRemoval(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitRemoval()}
                disabled={busyLineId !== null}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {busyLineId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Remove Clearing Date
              </button>
            </div>
          </div>
        </div>
      )}

      {openingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Opening Balance</h3>
                <p className="text-[10px] text-slate-500">
                  {bank?.accountName ?? 'Bank book'} | as at{' '}
                  {displayDate(context?.opening.openingDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpeningDialog(null)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 px-4 py-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">
                Enter Opening Balance as Per Bank Statement
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={openingDialog.value}
                placeholder="0.00"
                onChange={(event) =>
                  setOpeningDialog({ ...openingDialog, value: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submitOpening(openingDialog.acknowledge);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-right font-mono text-sm font-bold text-slate-900 focus:border-[#2c5f57] focus:outline-none"
              />
              <p className="text-[9px] text-slate-500">
                Enter (-) values for a credit opening balance. This is reconciliation metadata only; the
                accounting bank-book opening balance is never overwritten.
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Book opening balance</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatMoney(context?.opening.openingBookBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Statement opening balance</span>
                  <span className="font-mono font-bold text-slate-900">
                    {openingDialog.value.trim() === ''
                      ? 'Not entered'
                      : formatSignedMoney(openingDialog.value)}
                  </span>
                </div>
              </div>
              {openingWarning && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{openingWarning}</span>
                </div>
              )}
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] text-slate-700">
                <input
                  type="checkbox"
                  checked={openingDialog.acknowledge}
                  onChange={(event) =>
                    setOpeningDialog({ ...openingDialog, acknowledge: event.target.checked })
                  }
                  className="mt-0.5"
                />
                <span>
                  Acknowledge the opening difference and retain an audit record. Leave unchecked to
                  correct the amount instead.
                </span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-4 py-2.5">
              <button
                type="button"
                onClick={() => setOpeningDialog(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitOpening(openingDialog.acknowledge)}
                disabled={savingOpening}
                className="flex items-center gap-1.5 rounded-lg bg-[#2c5f57] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#244d47] disabled:opacity-60"
              >
                {savingOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReconciliationPage;