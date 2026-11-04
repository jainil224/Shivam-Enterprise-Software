import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, X } from 'lucide-react';
import {
  BalanceType,
  LEDGER_ACCOUNT_GROUP_LABELS,
  LedgerAccount,
  LedgerAccountGroup,
  LedgerAccountPayload,
  LedgerAccountType,
  Party,
} from '../types';
import { createLedgerAccount, getParties, updateLedgerAccount } from '../services/api';

interface LedgerAccountModalProps {
  account?: LedgerAccount | null;
  onClose: () => void;
  onSaved: (account: LedgerAccount) => void;
}

const GROUP_ORDER: LedgerAccountGroup[] = [
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

const GROUP_DEFAULTS: Record<LedgerAccountGroup, { type: LedgerAccountType; nature: BalanceType }> = {
  BANK: { type: 'ASSET', nature: 'DEBIT' },
  SUNDRY_DEBTORS: { type: 'ASSET', nature: 'DEBIT' },
  SUNDRY_CREDITORS: { type: 'LIABILITY', nature: 'CREDIT' },
  DIRECT_EXPENSES: { type: 'EXPENSE', nature: 'DEBIT' },
  INDIRECT_EXPENSES: { type: 'EXPENSE', nature: 'DEBIT' },
  DIRECT_INCOME: { type: 'INCOME', nature: 'CREDIT' },
  INDIRECT_INCOME: { type: 'INCOME', nature: 'CREDIT' },
  ASSETS: { type: 'ASSET', nature: 'DEBIT' },
  LIABILITIES: { type: 'LIABILITY', nature: 'CREDIT' },
  CAPITAL: { type: 'EQUITY', nature: 'CREDIT' },
  OTHERS: { type: 'ASSET', nature: 'DEBIT' },
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12.5px] bg-white border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100';

export const LedgerAccountModal: React.FC<LedgerAccountModalProps> = ({ account, onClose, onSaved }) => {
  const isEdit = Boolean(account);

  const [accountCode, setAccountCode] = useState(account?.accountCode ?? '');
  const [accountName, setAccountName] = useState(account?.accountName ?? '');
  const [accountGroup, setAccountGroup] = useState<LedgerAccountGroup>(account?.accountGroup ?? 'BANK');
  const [accountType, setAccountType] = useState<LedgerAccountType>(
    account?.accountType ?? GROUP_DEFAULTS.BANK.type
  );
  const [balanceType, setBalanceType] = useState<BalanceType>(
    account?.balanceType ?? GROUP_DEFAULTS.BANK.nature
  );
  const [openingBalance, setOpeningBalance] = useState(account?.openingBalance ?? '0.00');
  const [bankName, setBankName] = useState(account?.bankName ?? '');
  const [branchName, setBranchName] = useState(account?.branchName ?? '');
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? '');
  const [ifscCode, setIfscCode] = useState(account?.ifscCode ?? '');
  const [bankAccountNumber, setBankAccountNumber] = useState(account?.bankAccountNumber ?? '');
  const [partyId, setPartyId] = useState(account?.partyId ?? '');
  const [description, setDescription] = useState(account?.description ?? '');

  const [parties, setParties] = useState<Party[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isBank = accountGroup === 'BANK';

  useEffect(() => {
    let cancelled = false;
    getParties({ includeInactive: false })
      .then((list) => {
        if (!cancelled) setParties(list);
      })
      .catch(() => {
        if (!cancelled) setParties([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableParties = useMemo(
    () => parties.filter((party) => party.isActive || party.id === account?.partyId),
    [parties, account]
  );

  const applyGroup = (group: LedgerAccountGroup) => {
    setAccountGroup(group);
    setAccountType(GROUP_DEFAULTS[group].type);
    setBalanceType(GROUP_DEFAULTS[group].nature);
    if (group === 'BANK') {
      setPartyId('');
    }
  };

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const code = accountCode.trim().toUpperCase();
    if (!code) errors.accountCode = 'Account code is required.';
    else if (!/^[A-Z0-9][A-Z0-9\-_/]{1,19}$/.test(code)) {
      errors.accountCode = 'Use 2-20 characters: letters, numbers, hyphen, underscore or slash.';
    }

    if (!accountName.trim()) errors.accountName = 'Account name is required.';
    else if (accountName.trim().length > 120) errors.accountName = 'Maximum 120 characters.';

    if (isBank && !bankName.trim()) errors.bankName = 'Bank name is required for a bank account.';

    if (ifscCode.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
      errors.ifscCode = 'IFSC must be 11 characters, e.g. HDFC0001234.';
    }

    const opening = Number(openingBalance);
    if (openingBalance.trim() !== '' && (!Number.isFinite(opening) || opening < 0)) {
      errors.openingBalance = 'Opening balance must be zero or a positive number.';
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setError('Please correct the highlighted fields.');
      return;
    }

    setFieldErrors({});
    setError(null);
    setSaving(true);

    const payload: LedgerAccountPayload = {
      accountCode: accountCode.trim().toUpperCase(),
      accountName: accountName.trim(),
      accountGroup,
      accountType,
      balanceType,
      openingBalance: openingBalance.trim() === '' ? '0.00' : openingBalance.trim(),
      bankName: bankName.trim() === '' ? null : bankName.trim(),
      branchName: branchName.trim() === '' ? null : branchName.trim(),
      accountHolderName: accountHolderName.trim() === '' ? null : accountHolderName.trim(),
      ifscCode: ifscCode.trim() === '' ? null : ifscCode.trim().toUpperCase(),
      bankAccountNumber: bankAccountNumber.trim() === '' ? null : bankAccountNumber.trim(),
      partyId: isBank || partyId === '' ? null : partyId,
      description: description.trim() === '' ? null : description.trim(),
    };

    try {
      const saved = account
        ? await updateLedgerAccount(account.id, payload)
        : await createLedgerAccount(payload);
      onSaved(saved);
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      if (apiErrors && apiErrors.length > 0) {
        const mapped: Record<string, string> = {};
        for (const item of apiErrors) mapped[item.field] = item.message;
        setFieldErrors(mapped);
      }
      setError(err instanceof Error ? err.message : 'Failed to save the ledger account.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-6">
        <div className="px-3.5 py-2 border-b border-slate-200 bg-[#2c5f57] text-white rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-[13.5px] font-bold leading-tight">
              {isEdit ? `Edit Ledger Account — ${account?.accountCode}` : 'New Ledger / Bank Account'}
            </h2>
            <p className="text-[10px] text-white/70 leading-tight">
              Account codes must be unique within the company. Bank accounts are ledger group Bank.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 rounded px-2.5 py-1.5 text-[11px] font-semibold flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className={labelCls} htmlFor="accountCode">
                Account Code <span className="text-red-500">*</span>
              </label>
              <input
                id="accountCode"
                value={accountCode}
                onChange={(event) => setAccountCode(event.target.value.toUpperCase())}
                maxLength={20}
                placeholder="1001"
                className={`${inputCls} font-mono uppercase`}
              />
              {fieldErrors.accountCode && (
                <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.accountCode}</p>
              )}
            </div>

            <div className="col-span-2">
              <label className={labelCls} htmlFor="accountName">
                Account Name <span className="text-red-500">*</span>
              </label>
              <input
                id="accountName"
                value={accountName}
                onChange={(event) => setAccountName(event.target.value)}
                maxLength={120}
                placeholder="HDFC Bank Current A/c"
                className={inputCls}
              />
              {fieldErrors.accountName && (
                <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.accountName}</p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="accountGroup">
                Group <span className="text-red-500">*</span>
              </label>
              <select
                id="accountGroup"
                value={accountGroup}
                onChange={(event) => applyGroup(event.target.value as LedgerAccountGroup)}
                className={inputCls}
              >
                {GROUP_ORDER.map((group) => (
                  <option key={group} value={group}>
                    {LEDGER_ACCOUNT_GROUP_LABELS[group]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="accountType">
                Account Type
              </label>
              <select
                id="accountType"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value as LedgerAccountType)}
                className={inputCls}
              >
                {(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as LedgerAccountType[]).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="balanceType">
                Opening Nature
              </label>
              <select
                id="balanceType"
                value={balanceType}
                onChange={(event) => setBalanceType(event.target.value as BalanceType)}
                className={inputCls}
              >
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>

            <div>
              <label className={labelCls} htmlFor="openingBalance">
                Opening Balance (₹)
              </label>
              <input
                id="openingBalance"
                inputMode="decimal"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
                placeholder="0.00"
                className={`${inputCls} text-right font-mono`}
              />
              {fieldErrors.openingBalance && (
                <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.openingBalance}</p>
              )}
            </div>

            <div className="col-span-2">
              <label className={labelCls} htmlFor="partyLink">
                Linked Party (optional)
              </label>
              <select
                id="partyLink"
                value={partyId}
                onChange={(event) => setPartyId(event.target.value)}
                disabled={isBank}
                className={inputCls}
              >
                <option value="">— Not linked to a party —</option>
                {availableParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.partyCode} · {party.partyName}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Party Master remains the single source of truth for party balances. Bank accounts cannot be linked.
              </p>
            </div>
          </div>

          {isBank && (
            <div className="border border-slate-200 rounded-md p-2 space-y-2 bg-slate-50/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bank Details</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="bankName">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bankName"
                    value={bankName}
                    onChange={(event) => setBankName(event.target.value)}
                    maxLength={120}
                    placeholder="HDFC Bank"
                    className={inputCls}
                  />
                  {fieldErrors.bankName && (
                    <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.bankName}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="branchName">
                    Branch
                  </label>
                  <input
                    id="branchName"
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    maxLength={120}
                    placeholder="Ring Road, Surat"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="accountHolderName">
                    Account Holder
                  </label>
                  <input
                    id="accountHolderName"
                    value={accountHolderName}
                    onChange={(event) => setAccountHolderName(event.target.value)}
                    maxLength={120}
                    placeholder="SHIVAM ENTERPRISE"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="bankAccountNumber">
                    Bank Account Number
                  </label>
                  <input
                    id="bankAccountNumber"
                    value={bankAccountNumber}
                    onChange={(event) => setBankAccountNumber(event.target.value)}
                    maxLength={40}
                    placeholder="50200012345678"
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="ifscCode">
                    IFSC Code
                  </label>
                  <input
                    id="ifscCode"
                    value={ifscCode}
                    onChange={(event) => setIfscCode(event.target.value.toUpperCase())}
                    maxLength={11}
                    placeholder="HDFC0001234"
                    className={`${inputCls} font-mono uppercase`}
                  />
                  {fieldErrors.ifscCode && (
                    <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.ifscCode}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls} htmlFor="description">
              Description
            </label>
            <input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={250}
              placeholder="Optional note shown in the ledger master"
              className={inputCls}
            />
          </div>
        </div>

        <div className="px-3.5 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-[11.5px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-[11.5px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] disabled:bg-slate-400 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : isEdit ? 'Update Account' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};