import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Landmark,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { getBankReconciliationBanks } from '../services/api';
import type { BankBookOption } from '../types/bankReconciliation';

const formatMoney = (value: string): string => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const BankReconciliationBookSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<BankBookOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getBankReconciliationBanks();
      setBanks(rows);
      setSelectedIndex(rows.length > 0 ? 0 : -1);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Unable to load bank books for the active company.';
      setError(message);
      setBanks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openBank = useCallback(
    (bank: BankBookOption | undefined) => {
      if (!bank) return;
      navigate('/reports/bank-reconciliation/' + bank.id);
    },
    [navigate]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (banks.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % banks.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + banks.length) % banks.length);
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setSelectedIndex(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setSelectedIndex(banks.length - 1);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON')) return;
        event.preventDefault();
        openBank(banks[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [banks, selectedIndex, openBank]);

  useEffect(() => {
    rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="w-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="hover:text-slate-900 transition-colors"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-slate-500">Report</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="text-slate-500">Day Book Register</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
          <span className="font-semibold text-slate-800">Bank Reconciliation</span>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#789d93] bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#789d93] bg-[#2c5f57] px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              <div>
                <h1 className="text-sm font-bold leading-tight">Bank Book Selection</h1>
                <p className="text-[10px] text-white/70">
                  Select the bank account to reconcile. Enter or double-click opens the book.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCcw className={'h-3.5 w-3.5' + (loading ? ' animate-spin' : '')} />
              Refresh
            </button>
          </header>

          {error && (
            <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-semibold text-rose-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs font-semibold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading bank books...
            </div>
          ) : banks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Landmark className="h-8 w-8 text-slate-300" />
              <p className="text-xs font-bold text-slate-700">No active bank account found</p>
              <p className="max-w-md text-[11px] text-slate-500">
                Bank Reconciliation works on real bank ledgers. Create or activate a ledger account
                with the BANK group and the bank-account flag in Ledger Account Master, then return to
                this screen.
              </p>
              <button
                type="button"
                onClick={() => navigate('/masters/ledger-accounts')}
                className="mt-1 flex items-center gap-1.5 rounded-lg bg-[#2c5f57] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#244d47]"
              >
                Open Ledger Account Master
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="w-24 px-3 py-2 text-left">Prefix</th>
                    <th className="px-3 py-2 text-left">Book Name</th>
                    <th className="w-48 px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {banks.map((bank, index) => {
                    const isSelected = index === selectedIndex;
                    return (
                      <tr
                        key={bank.id}
                        ref={(node) => {
                          rowRefs.current[index] = node;
                        }}
                        onClick={() => setSelectedIndex(index)}
                        onDoubleClick={() => openBank(bank)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={
                          'cursor-pointer border-b border-slate-100 transition-colors ' +
                          (isSelected ? 'bg-[#eef4f2]' : 'hover:bg-slate-50')
                        }
                        aria-selected={isSelected}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-600">
                          {bank.accountCode || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{bank.accountName}</span>
                            <span className="text-[10px] text-slate-500">
                              {[bank.bankName, bank.branchName, bank.bankAccountNumber]
                                .filter((part): part is string => Boolean(part && part.trim()))
                                .join(' | ') || 'No bank details recorded'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-mono text-[12px] font-bold text-slate-900">
                            {formatMoney(bank.balanceAmount)}
                          </span>
                          <span className="ml-1 text-[10px] font-bold text-slate-500">
                            {bank.balanceNature}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
            <span className="text-[10px] text-slate-500">
              Use Up/Down to move, Enter to open, double-click with the mouse.
            </span>
            <button
              type="button"
              onClick={() => openBank(banks[selectedIndex])}
              disabled={banks.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[#2c5f57] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#244d47] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Open Reconciliation
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default BankReconciliationBookSelectionPage;