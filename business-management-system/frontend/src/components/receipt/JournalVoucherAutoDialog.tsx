import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, Trash2, TriangleAlert, X } from 'lucide-react';
import { lookupReceiptAdjustmentAccounts } from '../../services/api';
import {
  BankReceiptCalculationType,
  BankReceiptDrCr,
  CALCULATION_TYPE_LABELS,
  ReceiptAdjustmentAccount,
  ReceiptAdjustmentPayload,
} from '../../types';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toAmount = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface JvRow {
  key: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  calculationType: BankReceiptCalculationType;
  interestPercent: string;
  dueValue: string;
  tdsPercent: string;
  amount: string;
  drCr: BankReceiptDrCr;
  note: string;
}

const newRow = (): JvRow => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  accountId: '',
  accountCode: '',
  accountName: '',
  calculationType: 'AMT',
  interestPercent: '',
  dueValue: '',
  tdsPercent: '',
  amount: '',
  drCr: 'DR',
  note: '',
});

interface JournalVoucherAutoDialogProps {
  open: boolean;
  partyName: string;
  billNumber: string;
  billDate: string;
  billAmount: string;
  billBalance: string;
  chequeBalance: string;
  curReceived: string;
  initialAdjustments: ReceiptAdjustmentPayload[];
  onClose: () => void;
  onSave: (adjustments: ReceiptAdjustmentPayload[]) => void;
}

export const JournalVoucherAutoDialog: React.FC<JournalVoucherAutoDialogProps> = ({
  open,
  partyName,
  billNumber,
  billDate,
  billAmount,
  billBalance,
  chequeBalance,
  curReceived,
  initialAdjustments,
  onClose,
  onSave,
}) => {
  const [rows, setRows] = useState<JvRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [lookupRowKey, setLookupRowKey] = useState<string | null>(null);
  const [lookupSearch, setLookupSearch] = useState('');
  const [lookupRows, setLookupRows] = useState<ReceiptAdjustmentAccount[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLookupRowKey(null);
    setRows(
      initialAdjustments.length > 0
        ? initialAdjustments.map((adjustment) => ({
            key: `${adjustment.adjustmentLedgerAccountId}-${Math.random().toString(36).slice(2, 8)}`,
            accountId: adjustment.adjustmentLedgerAccountId,
            accountCode: '',
            accountName: '',
            calculationType: adjustment.calculationType ?? 'AMT',
            interestPercent:
              adjustment.interestPercent === null || adjustment.interestPercent === undefined
                ? ''
                : String(adjustment.interestPercent),
            dueValue:
              adjustment.dueValue === null || adjustment.dueValue === undefined
                ? ''
                : String(adjustment.dueValue),
            tdsPercent:
              adjustment.tdsPercent === null || adjustment.tdsPercent === undefined
                ? ''
                : String(adjustment.tdsPercent),
            amount: String(adjustment.adjustmentAmount ?? ''),
            drCr: adjustment.drCr,
            note: adjustment.note ?? '',
          }))
        : [newRow()]
    );
  }, [open, initialAdjustments]);

  useEffect(() => {
    if (lookupRowKey === null) return;
    let cancelled = false;
    setLookupLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const data = await lookupReceiptAdjustmentAccounts(lookupSearch.trim(), 40);
        if (!cancelled) setLookupRows(data);
      } catch {
        if (!cancelled) setLookupRows([]);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [lookupRowKey, lookupSearch]);

  const preview = useMemo(() => {
    const lines: Array<{ accountName: string; drCr: BankReceiptDrCr; amount: number }> = [];
    for (const row of rows) {
      const amount = toAmount(row.amount);
      if (amount <= 0) continue;
      const label = row.accountName || row.accountCode || 'Adjustment Account';
      lines.push({ accountName: label, drCr: row.drCr, amount });
      lines.push({
        accountName: `${partyName || 'Party'} (party)`,
        drCr: row.drCr === 'DR' ? 'CR' : 'DR',
        amount,
      });
    }
    const totalDebit = lines.filter((line) => line.drCr === 'DR').reduce((sum, line) => sum + line.amount, 0);
    const totalCredit = lines.filter((line) => line.drCr === 'CR').reduce((sum, line) => sum + line.amount, 0);
    return { lines, totalDebit, totalCredit };
  }, [rows, partyName]);

  if (!open) return null;

  const updateRow = (key: string, patch: Partial<JvRow>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleConfirm = (accept: boolean) => {
    if (!accept) {
      onClose();
      return;
    }

    const complete = rows.filter((row) => row.accountId !== '' && toAmount(row.amount) > 0);
    if (complete.length === 0) {
      setError('Add at least one adjustment line with an account and an amount.');
      return;
    }
    if (Math.abs(preview.totalDebit - preview.totalCredit) > 0.004) {
      setError('The journal adjustment does not balance.');
      return;
    }

    onSave(
      complete.map((row) => ({
        adjustmentLedgerAccountId: row.accountId,
        calculationType: row.calculationType,
        interestPercent: row.interestPercent.trim() === '' ? null : row.interestPercent.trim(),
        dueValue: row.dueValue.trim() === '' ? null : row.dueValue.trim(),
        tdsPercent: row.tdsPercent.trim() === '' ? null : row.tdsPercent.trim(),
        adjustmentAmount: row.amount,
        drCr: row.drCr,
        note: row.note.trim() === '' ? null : row.note.trim(),
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#2c5f57] text-white">
          <span className="text-[12.5px] font-bold uppercase tracking-wide">Journal Voucher Auto</span>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-2 bg-[#eef5f2] border-b border-[#c2dcd5] grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
          <div>
            <span className="block text-[9.5px] font-bold uppercase text-slate-500">Bill Date</span>
            <span className="font-semibold">{billDate}</span>
          </div>
          <div>
            <span className="block text-[9.5px] font-bold uppercase text-slate-500">Bill Amount</span>
            <span className="font-mono font-semibold">{money(billAmount)}</span>
          </div>
          <div>
            <span className="block text-[9.5px] font-bold uppercase text-slate-500">Bill Balance</span>
            <span className="font-mono font-semibold">{money(billBalance)}</span>
          </div>
          <div>
            <span className="block text-[9.5px] font-bold uppercase text-slate-500">Cheque Balance</span>
            <span className="font-mono font-semibold">{money(chequeBalance)}</span>
          </div>
          <div>
            <span className="block text-[9.5px] font-bold uppercase text-slate-500">Cur Received</span>
            <span className="font-mono font-semibold">{money(curReceived)}</span>
          </div>
        </div>

        <div className="px-3 py-1 bg-white border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
          <span>
            Bill <span className="font-mono font-bold text-slate-800">{billNumber}</span> for{' '}
            <span className="font-semibold">{partyName || 'party'}</span>
          </span>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#107c41] text-white text-[10.5px] font-bold hover:bg-[#0c6334]"
          >
            <Plus className="w-3 h-3" />
            Add Row
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 bg-red-50 border-b border-red-200 text-red-700 text-[11.5px] px-3 py-1.5">
            <TriangleAlert className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead className="sticky top-0 bg-[#d5e7e1] z-10">
              <tr className="text-slate-700 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Account Name</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-20">Type</th>
                <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-16">Int %</th>
                <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-16">Due</th>
                <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-16">Tds %</th>
                <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-24">Add/Less</th>
                <th className="px-2 py-1.5 text-center border-b border-[#789d93] w-20">Dr/Cr</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Note</th>
                <th className="px-2 py-1.5 text-center border-b border-[#789d93] w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-100">
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1">
                      <input
                        value={row.accountName}
                        readOnly
                        onClick={() => {
                          setLookupRowKey(row.key);
                          setLookupSearch(row.accountName);
                        }}
                        onFocus={() => {
                          setLookupRowKey(row.key);
                          setLookupSearch(row.accountName);
                        }}
                        placeholder="Click to select adjustment account"
                        className="w-full h-6 px-1 text-[11px] border border-slate-300 rounded cursor-pointer focus:outline-none focus:border-[#2c5f57]"
                      />
                      <Search className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={row.calculationType}
                      onChange={(event) =>
                        updateRow(row.key, {
                          calculationType: event.target.value as BankReceiptCalculationType,
                        })
                      }
                      className="w-full h-6 px-1 text-[11px] border border-slate-300 rounded"
                    >
                      {(Object.keys(CALCULATION_TYPE_LABELS) as BankReceiptCalculationType[]).map(
                        (type) => (
                          <option key={type} value={type}>
                            {CALCULATION_TYPE_LABELS[type]}
                          </option>
                        )
                      )}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={row.interestPercent}
                      onChange={(event) => updateRow(row.key, { interestPercent: event.target.value })}
                      className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 rounded"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={row.dueValue}
                      onChange={(event) => updateRow(row.key, { dueValue: event.target.value })}
                      className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 rounded"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={row.tdsPercent}
                      onChange={(event) => updateRow(row.key, { tdsPercent: event.target.value })}
                      className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 rounded"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(event) => updateRow(row.key, { amount: event.target.value })}
                      className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 rounded"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <div className="flex items-center justify-center gap-1">
                      {(['DR', 'CR'] as BankReceiptDrCr[]).map((side) => (
                        <button
                          key={side}
                          type="button"
                          onClick={() => updateRow(row.key, { drCr: side })}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            row.drCr === side
                              ? 'bg-[#2c5f57] text-white border-[#2c5f57]'
                              : 'bg-white text-slate-500 border-slate-300'
                          }`}
                        >
                          {side}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      value={row.note}
                      onChange={(event) => updateRow(row.key, { note: event.target.value })}
                      className="w-full h-6 px-1 text-[11px] border border-slate-300 rounded"
                      placeholder="Narration"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
                      className="p-0.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-2 border-t border-slate-200 bg-slate-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Dr / Cr Preview
            </div>
            {preview.lines.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Enter an account and amount to preview the journal posting.
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[9.5px] uppercase text-slate-500">
                    <th className="text-left py-0.5">Account</th>
                    <th className="text-center py-0.5 w-16">Dr/Cr</th>
                    <th className="text-right py-0.5 w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, index) => (
                    <tr key={index} className="border-t border-slate-200">
                      <td className="py-0.5">{line.accountName}</td>
                      <td className="py-0.5 text-center font-bold">{line.drCr}</td>
                      <td className="py-0.5 text-right font-mono">{money(line.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 font-bold">
                    <td className="py-0.5">Total</td>
                    <td className="py-0.5 text-center">
                      {Math.abs(preview.totalDebit - preview.totalCredit) < 0.004 ? 'Balanced' : 'Unbalanced'}
                    </td>
                    <td className="py-0.5 text-right font-mono">
                      {money(preview.totalDebit)} / {money(preview.totalCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-[#dce8e1] border-t border-[#789d93] text-[11px]">
          <span className="text-slate-600">
            Adjustments post only when the receipt voucher is saved.
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleConfirm(false)}
              className="px-3 py-1 rounded border border-slate-400 bg-white font-bold text-slate-600"
            >
              No
            </button>
            <button
              type="button"
              onClick={() => handleConfirm(true)}
              className="px-3 py-1 rounded bg-[#2c5f57] text-white font-bold hover:bg-[#204741]"
            >
              Confirm New!!
            </button>
          </div>
        </div>
      </div>

      {lookupRowKey !== null && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#2c5f57] text-white">
              <span className="text-[11.5px] font-bold uppercase">Adjustment Ledger Lookup</span>
              <button
                type="button"
                onClick={() => setLookupRowKey(null)}
                className="p-1 rounded hover:bg-white/10"
                aria-label="Close lookup"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="px-2 py-1.5 bg-[#eef5f2] border-b border-[#c2dcd5] flex items-center gap-1.5">
              <Search className="w-3 h-3 text-[#2c5f57]" />
              <input
                value={lookupSearch}
                onChange={(event) => setLookupSearch(event.target.value)}
                autoFocus
                placeholder="Search eligible adjustment account..."
                className="flex-1 h-7 px-2 text-[11.5px] bg-white border border-[#789d93] rounded focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
              {lookupLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2c5f57]" />}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#d5e7e1]">
                  <tr className="text-[9.5px] uppercase text-slate-600">
                    <th className="px-2 py-1 text-left border-b border-[#789d93]">Party / Account</th>
                    <th className="px-2 py-1 text-left border-b border-[#789d93]">Address</th>
                    <th className="px-2 py-1 text-right border-b border-[#789d93] w-28">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupRows.length === 0 && !lookupLoading ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-6 text-center text-slate-500">
                        No eligible adjustment account found.
                      </td>
                    </tr>
                  ) : (
                    lookupRows.map((account) => (
                      <tr
                        key={account.id}
                        onClick={() => {
                          updateRow(lookupRowKey ?? '', {
                            accountId: account.id,
                            accountCode: account.accountCode,
                            accountName: `${account.accountCode} - ${account.accountName}`,
                          });
                          setLookupRowKey(null);
                        }}
                        className="cursor-pointer border-b border-slate-100 hover:bg-[#b8ddd4]"
                      >
                        <td className="px-2 py-1">
                          <div className="font-semibold">{account.accountName}</div>
                          <div className="text-[9.5px] text-slate-500">
                            {account.partyName ? `${account.partyName} - ` : ''}
                            {account.accountCode}
                          </div>
                        </td>
                        <td className="px-2 py-1 truncate max-w-[220px]">{account.address ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">
                          {money(account.balance.amount)} {account.balance.nature}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalVoucherAutoDialog;