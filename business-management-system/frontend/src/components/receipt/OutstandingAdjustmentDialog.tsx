import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { getReceiptOutstandingBills, validateReceiptAllocation } from '../../services/api';
import {
  OutstandingBillRow,
  ReceiptAdjustmentPayload,
  ReceiptAllocationPayload,
} from '../../types';
import { JournalVoucherAutoDialog } from './JournalVoucherAutoDialog';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toAmount = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface OutstandingApplyResult {
  allocations: ReceiptAllocationPayload[];
  adjustments: ReceiptAdjustmentPayload[];
  allocatedTotal: string;
  chequeBalance: string;
}

interface OutstandingAdjustmentDialogProps {
  open: boolean;
  partyId: string | null;
  partyName: string;
  partyAddress: string;
  receiptAmount: number;
  excludeVoucherId?: string;
  initialAllocations: ReceiptAllocationPayload[];
  initialAdjustments: ReceiptAdjustmentPayload[];
  onClose: () => void;
  onApply: (result: OutstandingApplyResult) => void;
}

export const OutstandingAdjustmentDialog: React.FC<OutstandingAdjustmentDialogProps> = ({
  open,
  partyId,
  partyName,
  partyAddress,
  receiptAmount,
  excludeVoucherId,
  initialAllocations,
  initialAdjustments,
  onClose,
  onApply,
}) => {
  const [bills, setBills] = useState<OutstandingBillRow[]>([]);
  const [totals, setTotals] = useState({
    billAmount: '0.00',
    billTds: '0.00',
    previousReceived: '0.00',
    currentReceived: '0.00',
    balance: '0.00',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curRec, setCurRec] = useState<Record<string, string>>({});
  const [jvBills, setJvBills] = useState<Record<string, ReceiptAdjustmentPayload[]>>({});
  const [jvTarget, setJvTarget] = useState<OutstandingBillRow | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getReceiptOutstandingBills({
        partyId,
        excludeVoucherId,
      });
      setBills(data.bills);
      setTotals(data.totals);
    } catch (err) {
      setBills([]);
      setError(err instanceof Error ? err.message : 'Failed to load outstanding bills.');
    } finally {
      setLoading(false);
    }
  }, [partyId, excludeVoucherId]);

  useEffect(() => {
    if (!open) return;
    const seeded: Record<string, string> = {};
    for (const allocation of initialAllocations) {
      seeded[allocation.purchaseBillId] = String(allocation.allocatedAmount ?? '');
    }
    setCurRec(seeded);

    const seededJv: Record<string, ReceiptAdjustmentPayload[]> = {};
    for (const adjustment of initialAdjustments) {
      if (!adjustment.purchaseBillId) continue;
      seededJv[adjustment.purchaseBillId] = [
        ...(seededJv[adjustment.purchaseBillId] ?? []),
        adjustment,
      ];
    }
    setJvBills(seededJv);
    void load();
  }, [open, initialAllocations, initialAdjustments, load]);

  const allocatedTotal = useMemo(
    () =>
      bills.reduce((sum, bill) => {
        const value = toAmount(curRec[bill.id] ?? '0');
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0),
    [bills, curRec]
  );

  const chequeBalance = Math.max(0, receiptAmount - allocatedTotal);

  const handleAutoAllocate = () => {
    let remaining = receiptAmount;
    const next: Record<string, string> = { ...curRec };
    for (const bill of bills) {
      if (remaining <= 0) {
        next[bill.id] = '';
        continue;
      }
      const balance = toAmount(bill.balance);
      const take = Math.min(balance, remaining);
      next[bill.id] = take > 0 ? take.toFixed(2) : '';
      remaining -= take;
    }
    setCurRec(next);
  };

  const handleApply = async () => {
    if (!partyId) return;
    const allocations: ReceiptAllocationPayload[] = bills
      .map((bill) => ({
        purchaseBillId: bill.id,
        allocatedAmount: (curRec[bill.id] ?? '').trim(),
      }))
      .filter((row) => row.allocatedAmount !== '' && toAmount(row.allocatedAmount) > 0);

    if (allocations.length === 0) {
      setError('Enter the amount to allocate against at least one bill.');
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const validated = await validateReceiptAllocation({
        partyId,
        receiptAmount,
        excludeVoucherId,
        allocations,
      });

      const adjustments: ReceiptAdjustmentPayload[] = [];
      for (const allocation of validated.allocations) {
        const rows = jvBills[allocation.purchaseBillId] ?? [];
        adjustments.push(...rows);
      }

      onApply({
        allocations: validated.allocations.map((row) => ({
          purchaseBillId: row.purchaseBillId,
          allocatedAmount: row.allocatedAmount,
        })),
        adjustments,
        allocatedTotal: validated.allocatedTotal,
        chequeBalance: validated.chequeBalance,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Allocation validation failed.');
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const jvBillCurRec = jvTarget ? toAmount(curRec[jvTarget.id] ?? '') : 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#2c5f57] text-white">
            <span className="text-[12.5px] font-bold uppercase tracking-wide">Outstanding Adjustment</span>
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-2 bg-[#eef5f2] border-b border-[#c2dcd5] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px]">
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Party Name</span>
              <div className="font-semibold text-slate-800">{partyName || '-'}</div>
            </div>
            <div>
              <span className="font-bold text-slate-500 uppercase text-[10px]">Address</span>
              <div className="text-slate-700 truncate" title={partyAddress}>
                {partyAddress || '-'}
              </div>
            </div>
            <div className="sm:text-right">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Cheque Balance</span>
              <div className="font-mono font-bold text-[13px] text-emerald-700">
                {money(chequeBalance)}
              </div>
            </div>
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
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-14">Type</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Book</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Bill No</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-24">Date</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-14">Due</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-24">Bill Amt</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-20">Bill Tds</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-24">PreRec</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-28">CurRec</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-24">Balance</th>
                  <th className="px-2 py-1.5 text-center border-b border-[#789d93] w-24">J.V Req?</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-10 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto mb-2" />
                      Loading outstanding bills...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-10 text-center text-slate-500">
                      <p className="text-[12.5px] font-semibold text-slate-600">
                        No outstanding confirmed bills for this party
                      </p>
                      <p className="text-[11px] mt-1">
                        Only confirmed purchase bills with a remaining balance are listed.
                      </p>
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => {
                    const entered = toAmount(curRec[bill.id] ?? '');
                    const balance = toAmount(bill.balance);
                    const remaining = balance - (Number.isFinite(entered) ? entered : 0);
                    const jvRows = jvBills[bill.id] ?? [];
                    return (
                      <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-1 font-mono text-[10.5px] text-slate-500">
                          {bill.typeCode}
                        </td>
                        <td className="px-2 py-1 truncate max-w-[140px]" title={bill.bookName ?? ''}>
                          {bill.bookName ?? '-'}
                        </td>
                        <td className="px-2 py-1 font-mono font-semibold">{bill.billNumber}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{bill.billDate}</td>
                        <td className="px-2 py-1 text-right">{bill.dueValue ?? '-'}</td>
                        <td className="px-2 py-1 text-right font-mono">{money(bill.billAmount)}</td>
                        <td className="px-2 py-1 text-right font-mono">{money(bill.billTds)}</td>
                        <td className="px-2 py-1 text-right font-mono">{money(bill.previousReceived)}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={curRec[bill.id] ?? ''}
                            onChange={(event) =>
                              setCurRec((prev) => ({ ...prev, [bill.id]: event.target.value }))
                            }
                            className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 rounded focus:outline-none focus:border-[#2c5f57]"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1 text-right font-mono font-semibold text-slate-800">
                          {money(remaining)}
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (jvRows.length > 0) {
                                setJvBills((prev) => {
                                  const next = { ...prev };
                                  delete next[bill.id];
                                  return next;
                                });
                              } else {
                                setJvTarget(bill);
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                              jvRows.length > 0
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {jvRows.length > 0 ? `Yes (${jvRows.length})` : 'No'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {bills.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold text-slate-800">
                    <td colSpan={5} className="px-2 py-1.5 text-right uppercase text-[10px]">
                      Totals
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(totals.billAmount)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(totals.billTds)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(totals.previousReceived)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(allocatedTotal)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{money(chequeBalance)}</td>
                    <td className="px-2 py-1.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-[#dce8e1] border-t border-[#789d93] text-[11px] text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load()}
                className="flex items-center gap-1 px-2 py-1 rounded border border-[#789d93] bg-white font-semibold"
              >
                <RefreshCcw className="w-3 h-3" />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleAutoAllocate}
                className="px-2 py-1 rounded border border-[#789d93] bg-white font-semibold"
              >
                Auto Allocate
              </button>
              <span>
                Allocated <span className="font-mono font-bold">{money(allocatedTotal)}</span> of{' '}
                <span className="font-mono font-bold">{money(receiptAmount)}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 rounded border border-slate-400 bg-white font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || bills.length === 0}
                className="px-3 py-1 rounded bg-[#2c5f57] text-white font-bold disabled:bg-slate-400 flex items-center gap-1"
              >
                {applying && <Loader2 className="w-3 h-3 animate-spin" />}
                Apply Allocation
              </button>
            </div>
          </div>
        </div>
      </div>

      {jvTarget && (
        <JournalVoucherAutoDialog
          open={Boolean(jvTarget)}
          partyName={partyName}
          billNumber={jvTarget.billNumber}
          billDate={jvTarget.billDate}
          billAmount={jvTarget.billAmount}
          billBalance={jvTarget.balance}
          chequeBalance={chequeBalance.toFixed(2)}
          curReceived={jvBillCurRec.toFixed(2)}
          initialAdjustments={jvBills[jvTarget.id] ?? []}
          onClose={() => setJvTarget(null)}
          onSave={(adjustments) => {
            setJvBills((prev) => ({ ...prev, [jvTarget.id]: adjustments }));
            setJvTarget(null);
          }}
        />
      )}
    </>
  );
};

export default OutstandingAdjustmentDialog;