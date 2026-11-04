import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Landmark,
  Loader2,
  Save,
  Search,
  X,
} from 'lucide-react';
import {
  BankVoucher,
  BankVoucherLookups,
  BankVoucherPayload,
  BankVoucherType,
  PAYMENT_MODE_LABELS,
  PaymentMode,
} from '../types';
import { createBankVoucher, getBankVoucherLookups, updateBankVoucher } from '../services/api';
import { amountInWords } from '../utils/amountInWords';

const ELECTRONIC_MODES: PaymentMode[] = ['NEFT', 'RTGS', 'IMPS', 'UPI'];

type CounterpartySelection = {
  kind: 'PARTY' | 'LEDGER';
  id: string;
  code: string;
  name: string;
};

interface BankVoucherFormProps {
  voucherType: BankVoucherType;
  voucher?: BankVoucher | null;
  onSaved: (voucher: BankVoucher) => void;
  onBack: () => void;
  onOpenRegister: () => void;
}

const todayKey = (): string => new Date().toISOString().slice(0, 10);

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const labelCls = 'block text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1';
const inputCls =
  'w-full h-9 px-2.5 text-[13px] bg-white border border-slate-300 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100 disabled:text-slate-500';

export const BankVoucherForm: React.FC<BankVoucherFormProps> = ({
  voucherType,
  voucher,
  onSaved,
  onBack,
  onOpenRegister,
}) => {
  const isReceipt = voucherType === 'RECEIPT';
  const isEdit = Boolean(voucher);
  const noun = isReceipt ? 'Receipt' : 'Payment';
  const counterpartyLabel = isReceipt ? 'Received From' : 'Paid To';

  const [lookups, setLookups] = useState<BankVoucherLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [voucherDate, setVoucherDate] = useState(todayKey());
  const [bankAccountLedgerId, setBankAccountLedgerId] = useState('');
  const [counterparty, setCounterparty] = useState<CounterpartySelection | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('NEFT');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeDate, setChequeDate] = useState('');
  const [branchName, setBranchName] = useState('');
  const [narration, setNarration] = useState('');
  const [remarks, setRemarks] = useState('');

  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerInputRef = useRef<HTMLInputElement | null>(null);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getBankVoucherLookups(voucherType);
        if (cancelled) return;
        setLookups(data);

        if (voucher) {
          setVoucherDate(voucher.voucherDate);
          setBankAccountLedgerId(voucher.bankAccount.id);
          setPaymentMode(voucher.paymentMode);
          setAmount(voucher.amount);
          setReferenceNumber(voucher.referenceNumber ?? '');
          setChequeNumber(voucher.chequeNumber ?? '');
          setChequeDate(voucher.chequeDate ?? '');
          setBranchName(voucher.branchName ?? '');
          setNarration(voucher.narration ?? '');
          setRemarks(voucher.remarks ?? '');
          setCounterparty(
            voucher.party
              ? {
                  kind: 'PARTY',
                  id: voucher.party.id,
                  code: voucher.party.partyCode,
                  name: voucher.party.partyName,
                }
              : {
                  kind: 'LEDGER',
                  id: voucher.counterparty.id,
                  code: voucher.counterparty.accountCode,
                  name: voucher.counterparty.accountName,
                }
          );
        } else {
          const defaultBank = data.bankAccounts[0];
          if (defaultBank) {
            setBankAccountLedgerId(defaultBank.id);
            setBranchName(defaultBank.branchName ?? '');
          }
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load voucher setup data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [voucherType, voucher]);

  const selectedBank = useMemo(
    () => lookups?.bankAccounts.find((account) => account.id === bankAccountLedgerId) ?? null,
    [lookups, bankAccountLedgerId]
  );

  const isLocked = lookups?.financialYear.isLocked ?? false;

  const pickerOptions = useMemo(() => {
    if (!lookups) return [];

    const needle = pickerSearch.trim().toLowerCase();
    const matches = (code: string, name: string) =>
      needle === '' || code.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);

    const partyOptions = lookups.parties
      .filter((party) => matches(party.partyCode, party.partyName))
      .slice(0, 12)
      .map((party) => ({
        key: `party-${party.id}`,
        kind: 'PARTY' as const,
        id: party.id,
        code: party.partyCode,
        name: party.partyName,
        hint: party.ledgerAccountName
          ? `Party · ledger ${party.ledgerAccountName}`
          : 'Party · ledger linked on save',
      }));

    const ledgerOptions = lookups.ledgers
      .filter((ledger) => matches(ledger.accountCode, ledger.accountName))
      .slice(0, 12)
      .map((ledger) => ({
        key: `ledger-${ledger.id}`,
        kind: 'LEDGER' as const,
        id: ledger.id,
        code: ledger.accountCode,
        name: ledger.accountName,
        hint: `Ledger · ${ledger.accountGroup.replace(/_/g, ' ')}`,
      }));

    return [...partyOptions, ...ledgerOptions];
  }, [lookups, pickerSearch]);

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (event: MouseEvent) => {
      if (pickerWrapRef.current && !pickerWrapRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const resetForm = useCallback(() => {
    setVoucherDate(todayKey());
    setCounterparty(null);
    setPaymentMode('NEFT');
    setAmount('');
    setReferenceNumber('');
    setChequeNumber('');
    setChequeDate('');
    setNarration('');
    setRemarks('');
    setFieldErrors({});
    setSaveError(null);
    setSavedMessage(null);
    const defaultBank = lookups?.bankAccounts[0];
    setBankAccountLedgerId(defaultBank?.id ?? '');
    setBranchName(defaultBank?.branchName ?? '');
    pickerInputRef.current?.focus();
  }, [lookups]);
  const validate = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!voucherDate) errors.voucherDate = 'Voucher date is required.';
    if (!bankAccountLedgerId) errors.bankAccountLedgerId = 'Bank account is required.';
    if (!counterparty) errors.counterparty = `${counterpartyLabel} is required.`;

    const trimmed = amount.trim();
    const numericAmount = Number(trimmed);
    if (!trimmed) {
      errors.amount = 'Amount is required.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      errors.amount = 'Amount must be a number with at most 2 decimal places.';
    } else if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      errors.amount = 'Amount must be greater than zero.';
    }

    if (paymentMode === 'CHEQUE') {
      if (!chequeNumber.trim()) errors.chequeNumber = 'Cheque number is required for cheque mode.';
      if (!chequeDate) errors.chequeDate = 'Cheque date is required for cheque mode.';
    } else if (ELECTRONIC_MODES.includes(paymentMode) && !referenceNumber.trim()) {
      errors.referenceNumber = `UTR / reference number is required for ${PAYMENT_MODE_LABELS[paymentMode]}.`;
    }

    return errors;
  }, [
    voucherDate,
    bankAccountLedgerId,
    counterparty,
    amount,
    paymentMode,
    chequeNumber,
    chequeDate,
    referenceNumber,
    counterpartyLabel,
  ]);

  const buildPayload = useCallback((): BankVoucherPayload => {
    const isCheque = paymentMode === 'CHEQUE';
    return {
      voucherDate,
      bankAccountLedgerId,
      partyId: counterparty?.kind === 'PARTY' ? counterparty.id : null,
      counterpartyLedgerId: counterparty?.kind === 'LEDGER' ? counterparty.id : null,
      paymentMode,
      amount: amount.trim(),
      referenceNumber: referenceNumber.trim() === '' ? null : referenceNumber.trim(),
      chequeNumber: isCheque ? chequeNumber.trim() : null,
      chequeDate: isCheque ? chequeDate : null,
      bankName: selectedBank?.bankName ?? null,
      branchName: branchName.trim() === '' ? null : branchName.trim(),
      narration: narration.trim() === '' ? null : narration.trim(),
      remarks: remarks.trim() === '' ? null : remarks.trim(),
    };
  }, [
    voucherDate,
    bankAccountLedgerId,
    counterparty,
    paymentMode,
    amount,
    referenceNumber,
    chequeNumber,
    chequeDate,
    selectedBank,
    branchName,
    narration,
    remarks,
  ]);

  const handleSave = useCallback(async () => {
    if (saving || isLocked || loading) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveError('Please correct the highlighted fields before saving.');
      setSavedMessage(null);
      return;
    }

    setFieldErrors({});
    setSaveError(null);
    setSavedMessage(null);
    setSaving(true);

    try {
      const payload = buildPayload();
      const saved =
        isEdit && voucher
          ? await updateBankVoucher(voucherType, voucher.id, payload)
          : await createBankVoucher(voucherType, payload);

      setSavedMessage(`${saved.voucherNumber} saved successfully.`);
      onSaved(saved);
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      if (apiErrors && apiErrors.length > 0) {
        const mapped: Record<string, string> = {};
        for (const item of apiErrors) {
          mapped[item.field] = item.message;
        }
        setFieldErrors(mapped);
      }
      setSaveError(err instanceof Error ? err.message : `Failed to save bank ${noun.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  }, [saving, isLocked, loading, validate, buildPayload, isEdit, voucher, voucherType, onSaved, noun]);

  // Page-scoped shortcuts: F10 save, F5 register, F2 clear, F3 counterparty, Esc back
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        void handleSave();
      } else if (event.key === 'F5') {
        event.preventDefault();
        onOpenRegister();
      } else if (event.key === 'F2') {
        event.preventDefault();
        resetForm();
      } else if (event.key === 'F3') {
        event.preventDefault();
        setShowPicker(true);
        pickerInputRef.current?.focus();
        pickerInputRef.current?.select();
      } else if (event.key === 'Escape') {
        if (showPicker) {
          event.preventDefault();
          setShowPicker(false);
        } else {
          event.preventDefault();
          onBack();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, onOpenRegister, resetForm, onBack, showPicker]);

  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 0;
  const bankRef = selectedBank
    ? `${selectedBank.accountCode} · ${selectedBank.accountName}`
    : 'Bank account not selected';
  const counterpartyRef = counterparty
    ? `${counterparty.code} · ${counterparty.name}`
    : `${counterpartyLabel} not selected`;

  const debitRef = isReceipt ? bankRef : counterpartyRef;
  const creditRef = isReceipt ? counterpartyRef : bankRef;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">
            Loading bank {noun.toLowerCase()} entry screen…
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to load bank {noun.toLowerCase()} data</p>
        <p className="text-xs text-slate-600">{loadError}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const noBankAccounts = (lookups?.bankAccounts.length ?? 0) === 0;
  return (
    <div
      className="w-full max-w-[1180px] mx-auto space-y-2.5 pb-8"
      onKeyDown={(event) => {
        // Enter must never submit a voucher; saving is F10 or the explicit Save button only.
        if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
          event.preventDefault();
        }
      }}
    >
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isReceipt ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">
              Bank {noun} Voucher {isEdit ? '— Edit' : '— New Entry'}
            </h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              {isReceipt
                ? 'Debit bank account · Credit receiving ledger'
                : 'Debit paying ledger · Credit bank account'}
              {lookups ? ` · FY ${lookups.financialYear.yearName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isEdit && voucher && (
            <span className="text-[10px] font-mono font-bold bg-white/15 px-2 py-1 rounded">
              {voucher.voucherNumber} · Rev {voucher.revision}
            </span>
          )}
          {!isEdit && lookups && (
            <span className="text-[10px] font-mono font-bold bg-white/15 px-2 py-1 rounded">
              Next No: {lookups.nextVoucherNumber}
            </span>
          )}
          <button
            type="button"
            onClick={onBack}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25"
          >
            Back (Esc)
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isLocked || noBankAccounts}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save (F10)'}
          </button>
        </div>
      </div>

      {isLocked && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Financial year {lookups?.financialYear.yearName} is locked. Posting, editing and cancellation are
          blocked.
        </div>
      )}

      {noBankAccounts && (
        <div className="bg-red-50 border border-red-300 text-red-900 rounded-md px-3 py-2.5 text-[11.5px] space-y-1">
          <p className="font-bold flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            No bank account ledger exists yet
          </p>
          <p>
            Bank {noun.toLowerCase()} vouchers can only be posted against a ledger account classified as a bank
            account (group Bank). Create the bank account in the Ledger &amp; Bank Account master first.
          </p>
          <a href="/masters/ledger-accounts" className="inline-block mt-1 font-bold text-red-800 underline">
            Open Ledger &amp; Bank Account Master
          </a>
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {savedMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-2.5 items-start">
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            Voucher Details
          </div>

          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="lg:col-span-2">
              <label className={labelCls} htmlFor="voucherNumber">
                Voucher No.
              </label>
              <input
                id="voucherNumber"
                value={isEdit && voucher ? voucher.voucherNumber : lookups?.nextVoucherNumber ?? ''}
                readOnly
                className={`${inputCls} font-mono font-bold`}
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls} htmlFor="voucherDate">
                Voucher Date <span className="text-red-500">*</span>
              </label>
              <input
                id="voucherDate"
                type="date"
                value={voucherDate}
                min={lookups?.financialYear.startDate}
                max={lookups?.financialYear.endDate}
                onChange={(event) => setVoucherDate(event.target.value)}
                className={inputCls}
              />
              {fieldErrors.voucherDate && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.voucherDate}</p>
              )}
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls} htmlFor="paymentMode">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <select
                id="paymentMode"
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}
                className={inputCls}
              >
                {(lookups?.paymentModes ?? []).map((mode) => (
                  <option key={mode} value={mode}>
                    {PAYMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls} htmlFor="bankAccount">
                Bank Account <span className="text-red-500">*</span>
              </label>
              <select
                id="bankAccount"
                value={bankAccountLedgerId}
                onChange={(event) => {
                  setBankAccountLedgerId(event.target.value);
                  const next = lookups?.bankAccounts.find((account) => account.id === event.target.value);
                  setBranchName(next?.branchName ?? '');
                }}
                className={inputCls}
              >
                <option value="">— Select bank account ledger —</option>
                {(lookups?.bankAccounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountCode} · {account.bankName || account.accountName}
                    {account.branchName ? ` (${account.branchName})` : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.bankAccountLedgerId && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">
                  {fieldErrors.bankAccountLedgerId}
                </p>
              )}
              {selectedBank?.bankName && (
                <p className="mt-1 text-[10.5px] text-slate-500 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {selectedBank.bankName}
                </p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls} htmlFor="bankBranch">
                Bank Branch
              </label>
              <input
                id="bankBranch"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                placeholder="Branch name (optional)"
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4" ref={pickerWrapRef}>
              <label className={labelCls}>
                {counterpartyLabel} <span className="text-red-500">*</span>
                <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">(F3)</span>
              </label>

              {counterparty ? (
                <div className="flex items-center justify-between gap-2 h-9 px-2.5 bg-emerald-50 border border-emerald-300 rounded-md">
                  <div className="min-w-0">
                    <span className="font-mono text-[10.5px] text-emerald-700 font-bold mr-1.5">
                      {counterparty.code}
                    </span>
                    <span className="text-[13px] font-semibold text-slate-800">{counterparty.name}</span>
                    <span className="ml-1.5 text-[10px] font-bold text-emerald-700 uppercase">
                      {counterparty.kind === 'PARTY' ? 'party' : 'ledger'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCounterparty(null);
                      setShowPicker(true);
                      pickerInputRef.current?.focus();
                    }}
                    className="text-slate-500 hover:text-red-600 shrink-0"
                    aria-label="Clear counterparty"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowPicker(true);
                    pickerInputRef.current?.focus();
                  }}
                  className="w-full h-9 px-2.5 text-left text-[13px] bg-white border border-slate-300 rounded-md text-slate-400 hover:border-[#2c5f57] flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  Search party or ledger account…
                </button>
              )}

              {showPicker && (
                <div className="mt-1 border border-slate-300 rounded-md bg-white shadow-lg overflow-hidden">
                  <div className="p-1.5 border-b border-slate-200 bg-slate-50">
                    <input
                      ref={pickerInputRef}
                      value={pickerSearch}
                      onChange={(event) => setPickerSearch(event.target.value)}
                      placeholder="Type party / ledger name or code…"
                      className="w-full h-8 px-2 text-[12.5px] border border-slate-300 rounded bg-white focus:outline-none focus:border-[#2c5f57]"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {pickerOptions.length === 0 ? (
                      <p className="px-3 py-3 text-[11.5px] text-slate-500">
                        No party or ledger matched. Create the party in Party Master or the account in the Ledger
                        master.
                      </p>
                    ) : (
                      pickerOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => {
                            setCounterparty({
                              kind: option.kind,
                              id: option.id,
                              code: option.code,
                              name: option.name,
                            });
                            setShowPicker(false);
                            setPickerSearch('');
                          }}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 border-b border-slate-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-slate-500">{option.code}</span>
                            <span className="text-[12.5px] font-semibold text-slate-800">{option.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{option.hint}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {fieldErrors.counterparty && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.counterparty}</p>
              )}
              {fieldErrors.partyId && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.partyId}</p>
              )}
              {fieldErrors.counterpartyLedgerId && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">
                  {fieldErrors.counterpartyLedgerId}
                </p>
              )}
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className={labelCls} htmlFor="amount">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                onBlur={() => {
                  const numeric = Number(amount);
                  if (amount.trim() !== '' && Number.isFinite(numeric)) {
                    setAmount(numeric.toFixed(2));
                  }
                }}
                placeholder="0.00"
                className={`${inputCls} text-right font-mono font-bold`}
              />
              {fieldErrors.amount && (
                <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.amount}</p>
              )}
            </div>

            {paymentMode === 'CHEQUE' ? (
              <>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className={labelCls} htmlFor="chequeNumber">
                    Cheque No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="chequeNumber"
                    value={chequeNumber}
                    onChange={(event) => setChequeNumber(event.target.value)}
                    maxLength={20}
                    placeholder="e.g. 456123"
                    className={`${inputCls} font-mono`}
                  />
                  {fieldErrors.chequeNumber && (
                    <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.chequeNumber}</p>
                  )}
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className={labelCls} htmlFor="chequeDate">
                    Cheque Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="chequeDate"
                    type="date"
                    value={chequeDate}
                    onChange={(event) => setChequeDate(event.target.value)}
                    className={inputCls}
                  />
                  {fieldErrors.chequeDate && (
                    <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.chequeDate}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={labelCls} htmlFor="referenceNumber">
                  UTR / Reference No.
                  {ELECTRONIC_MODES.includes(paymentMode) && <span className="text-red-500"> *</span>}
                </label>
                <input
                  id="referenceNumber"
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  maxLength={40}
                  placeholder={
                    ELECTRONIC_MODES.includes(paymentMode)
                      ? `Required for ${PAYMENT_MODE_LABELS[paymentMode]}`
                      : 'Optional transaction reference'
                  }
                  className={`${inputCls} font-mono`}
                />
                {fieldErrors.referenceNumber && (
                  <p className="mt-1 text-[10.5px] text-red-600 font-semibold">{fieldErrors.referenceNumber}</p>
                )}
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls} htmlFor="narration">
                Narration
              </label>
              <input
                id="narration"
                value={narration}
                onChange={(event) => setNarration(event.target.value)}
                maxLength={500}
                placeholder="Posting narration shown in the journal"
                className={inputCls}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls} htmlFor="remarks">
                Remarks
              </label>
              <input
                id="remarks"
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                maxLength={500}
                placeholder="Internal remarks (optional)"
                className={inputCls}
              />
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            Posting Preview
          </div>
          <div className="p-3 space-y-2.5">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Debit</p>
              <p className="text-[12px] font-semibold text-slate-800 leading-tight break-words">{debitRef}</p>
              <p className="text-[13px] font-mono font-bold text-emerald-800 text-right">₹ {money(safeAmount)}</p>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50/60 p-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Credit</p>
              <p className="text-[12px] font-semibold text-slate-800 leading-tight break-words">{creditRef}</p>
              <p className="text-[13px] font-mono font-bold text-blue-800 text-right">₹ {money(safeAmount)}</p>
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-1">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 font-semibold">Total Debit</span>
                <span className="font-mono font-bold text-slate-800">₹ {money(safeAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="text-slate-500 font-semibold">Total Credit</span>
                <span className="font-mono font-bold text-slate-800">₹ {money(safeAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1 text-[11px]">
                <span className="font-bold text-slate-600">Balanced</span>
                <span className="font-bold text-emerald-700">
                  {safeAmount > 0 ? 'Yes · Debit = Credit' : 'Awaiting amount'}
                </span>
              </div>
            </div>

            <div className="text-[10.5px] text-slate-600 leading-snug">
              <p className="font-bold text-slate-700 mb-0.5">Impact</p>
              {isReceipt ? (
                <p>
                  Bank balance increases by ₹ {money(safeAmount)}; the receiving ledger is credited by the same
                  amount.
                </p>
              ) : (
                <p>
                  Bank balance decreases by ₹ {money(safeAmount)}; the paying ledger is debited by the same
                  amount.
                </p>
              )}
            </div>

            {safeAmount > 0 && (
              <div className="text-[10.5px] text-slate-600 border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-700">Amount in words: </span>
                {amountInWords(amount)}
              </div>
            )}

            {isEdit && (
              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 leading-snug">
                Editing reverses the previous posting and writes the corrected posting in the same transaction.
              </div>
            )}

            <div className="border-t border-slate-200 pt-2 text-[10px] text-slate-400 leading-relaxed">
              F10 Save · F5 Register · F2 Clear · F3 Counterparty · Esc Back
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};