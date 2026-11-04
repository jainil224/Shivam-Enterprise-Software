import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Landmark,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  Power,
} from 'lucide-react';
import { getLedgerAccounts, setLedgerAccountStatus } from '../services/api';
import {
  LEDGER_ACCOUNT_GROUP_LABELS,
  LedgerAccount,
  LedgerAccountGroup,
} from '../types';
import { LedgerAccountModal } from '../components/LedgerAccountModal';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';

const GROUPS: LedgerAccountGroup[] = [
  'BANK',
  'SUNDRY_DEBTORS',
  'SUNDRY_CREDITORS',
  'DIRECT_EXPENSES',
  'INDIRECT_EXPENSES',
  'DIRECT_INCOME',
  'INDIRECT_INCOME',
  'ASSETS',
  'LIABILITIES',
  'CAPITAL',
  'OTHERS',
];

export const LedgerAccountsPage: React.FC = () => {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<'' | LedgerAccountGroup>('');
  const [bankOnly, setBankOnly] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<LedgerAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLedgerAccounts({
        search: search.trim() === '' ? undefined : search.trim(),
        accountGroup: groupFilter === '' ? undefined : groupFilter,
        isBankAccount: bankOnly ? true : undefined,
        includeInactive,
      });
      setAccounts(data);
    } catch (err) {
      setAccounts([]);
      setError(err instanceof Error ? err.message : 'Failed to load ledger accounts.');
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, bankOnly, includeInactive]);

  useEffect(() => {
    void load();
  }, [load]);

  const bankAccounts = useMemo(() => accounts.filter((account) => account.isBankAccount), [accounts]);
  const bankCount = bankOnly ? accounts.length : bankAccounts.length;

  const toggleStatus = async (account: LedgerAccount) => {
    setBusyId(account.id);
    setError(null);
    try {
      const updated = await setLedgerAccountStatus(account.id, !account.isActive);
      setAccounts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      setError(
        apiErrors && apiErrors.length > 0
          ? apiErrors[0].message
          : err instanceof Error
            ? err.message
            : 'Failed to update the account status.'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="w-full max-w-[1320px] mx-auto space-y-2.5 pb-8">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">Ledger &amp; Bank Account Master</h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              Chart of accounts · {accounts.length} account(s) · {bankCount} bank account(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void load()}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Account
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="col-span-2">
            <label className={labelCls} htmlFor="ledgerSearch">
              Search
            </label>
            <input
              id="ledgerSearch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Account code or name…"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="groupFilter">
              Group
            </label>
            <select
              id="groupFilter"
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value as '' | LedgerAccountGroup)}
              className={inputCls}
            >
              <option value="">All groups</option>
              {GROUPS.map((group) => (
                <option key={group} value={group}>
                  {LEDGER_ACCOUNT_GROUP_LABELS[group]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 h-8">
              <input
                type="checkbox"
                checked={bankOnly}
                onChange={(event) => setBankOnly(event.target.checked)}
                className="accent-[#2c5f57]"
              />
              Bank only
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 h-8">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                className="accent-[#2c5f57]"
              />
              Include inactive
            </label>
          </div>
        </div>

        <p className="mt-1.5 text-[10.5px] text-slate-500">
          A bank receipt or bank payment can only post against an account in group Bank. Auto-created party
          ledgers are managed by Party Master and cannot be duplicated here.
        </p>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Code</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Account Name</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Group</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Type</th>
                <th className="px-2 py-1.5 text-right border-b border-slate-300">Opening</th>
                <th className="px-2 py-1.5 text-right border-b border-slate-300">Debit</th>
                <th className="px-2 py-1.5 text-right border-b border-slate-300">Credit</th>
                <th className="px-2 py-1.5 text-right border-b border-slate-300">Balance</th>
                <th className="px-2 py-1.5 text-left border-b border-slate-300">Bank Details</th>
                <th className="px-2 py-1.5 text-center border-b border-slate-300">Status</th>
                <th className="px-2 py-1.5 text-center border-b border-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-2 py-10 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto mb-2" />
                    Loading ledger accounts…
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-2 py-10 text-center text-slate-500">
                    <Landmark className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-[12.5px] font-semibold text-slate-600">No ledger accounts found</p>
                    <p className="text-[11px] mt-1">
                      Create a bank account first — bank receipt and bank payment vouchers cannot post without
                      one.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(null);
                        setModalOpen(true);
                      }}
                      className="mt-2 px-3 py-1.5 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a]"
                    >
                      Create Bank Account
                    </button>
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr
                    key={account.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 ${
                      account.isActive ? '' : 'bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <td className="px-2 py-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {account.accountCode}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-semibold text-slate-800">{account.accountName}</div>
                      <div className="text-[10px] text-slate-400">
                        {account.partyName ? `Party: ${account.partyName}` : account.isAutoCreated ? 'Auto-created ledger' : ''}
                        {account.description ? ` · ${account.description}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border ${
                          account.isBankAccount
                            ? 'bg-blue-100 text-blue-700 border-blue-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {LEDGER_ACCOUNT_GROUP_LABELS[account.accountGroup]}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10.5px] text-slate-600">
                      {account.accountType}
                      <span className="ml-1 text-slate-400">({account.balanceType})</span>
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(account.openingBalance)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-emerald-700">
                      {money(account.debitTotal)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-blue-700">
                      {money(account.creditTotal)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-slate-900">
                      {money(account.currentBalance)}
                    </td>
                    <td className="px-2 py-1.5 text-[10.5px] text-slate-600">
                      {account.isBankAccount ? (
                        <>
                          <div>{account.bankName ?? '—'}</div>
                          <div className="text-[10px] text-slate-400">
                            {account.branchName ?? '—'}
                            {account.ifscCode ? ` · ${account.ifscCode}` : ''}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border ${
                          account.isActive
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAccount(account);
                            setModalOpen(true);
                          }}
                          title="Edit account"
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(account)}
                          disabled={busyId === account.id}
                          title={account.isActive ? 'Deactivate account' : 'Activate account'}
                          className={`p-1 rounded disabled:opacity-40 ${
                            account.isActive
                              ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {busyId === account.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-slate-200 bg-slate-50 text-[11px]">
          <span className="text-slate-600 font-semibold">
            {accounts.length} account(s) shown
            {bankCount > 0 && <span className="ml-2 text-slate-400">· {bankCount} bank account(s)</span>}
          </span>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {modalOpen && (
        <LedgerAccountModal
          account={editingAccount}
          onClose={() => {
            setModalOpen(false);
            setEditingAccount(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditingAccount(null);
            void load();
          }}
        />
      )}
    </div>
  );
};