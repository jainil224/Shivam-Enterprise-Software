import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { getReceiptOutstandingBills, validateReceiptAllocation } from '../../services/api';
import {
  OutstandingBillRow,
  ReceiptAdjustmentPayload,
  ReceiptAllocationPayload,
} from '../../types';
import { JournalVoucherAutoDialog } from './JournalVoucherAutoDialog';

const DASH = '\u2014';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toAmount = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const netAdjustmentOf = (rows: ReceiptAdjustmentPayload[] | undefined): number =>
  (rows ?? []).reduce(
    (sum, row) =>
      sum +
      (row.drCr === 'DR'
        ? toAmount(String(row.adjustmentAmount))
        : -toAmount(String(row.adjustmentAmount))),
    0
  );

export interface OutstandingAppliedAllocation extends ReceiptAllocationPayload {
  billNumber: string;
}

export interface OutstandingApplyResult {
  allocations: OutstandingAppliedAllocation[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [curRec, setCurRec] = useState<Record<string, string>>({});
  const [jvBills, setJvBills] = useState<Record<string, ReceiptAdjustmentPayload[]>>({});
  const [jvTarget, setJvTarget] = useState<OutstandingBillRow | null>(null);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getReceiptOutstandingBills({ partyId, excludeVoucherId });
      setBills(data.bills);
      setSelectedBillId((current) => current ?? data.bills[0]?.id ?? null);
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
      const value = toAmount(String(allocation.allocatedAmount));
      if (value > 0) seeded[allocation.purchaseBillId] = String(allocation.allocatedAmount);
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
    setSelectedBillId(null);
    setError(null);
    void load();
  }, [open, initialAllocations, initialAdjustments, load]);

  const netAdj = useCallback((billId: string) => netAdjustmentOf(jvBills[billId]), [jvBills]);

  const maxCash = useCallback(
    (bill: OutstandingBillRow) => Math.max(0, round2(toAmount(bill.balance) - netAdj(bill.id))),
    [netAdj]
  );

  const allocatedTotal = useMemo(
    () =>
      round2(
        bills.reduce((sum, bill) => {
          const value = toAmount(curRec[bill.id]);
          return sum + (Number.isFinite(value) ? value : 0);
        }, 0)
      ),
    [bills, curRec]
  );

  // Cheque Balance is strictly this receipt row cash minus what this row has
  // allocated. Journal adjustments are never treated as cash.
  const chequeBalance = Math.max(0, round2(receiptAmount - allocatedTotal));

  const totalBalance = useMemo(
    () =>
      round2(
        bills.reduce((sum, bill) => {
          const remaining = toAmount(bill.balance) - toAmount(curRec[bill.id]) - netAdj(bill.id);
          return sum + remaining;
        }, 0)
      ),
    [bills, curRec, netAdj]
  );

  const handleAutoAllocate = () => {
    let remaining = receiptAmount;
    const next: Record<string, string> = { ...curRec };
    for (const bill of bills) {
      const available = maxCash(bill);
      if (remaining <= 0 || available <= 0) {
        next[bill.id] = '';
        continue;
      }
      const take = Math.min(available, remaining);
      next[bill.id] = take > 0 ? take.toFixed(2) : '';
      remaining = round2(remaining - take);
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

    for (const allocation of allocations) {
      const bill = bills.find((candidate) => candidate.id === allocation.purchaseBillId);
      if (!bill) continue;
      if (toAmount(allocation.allocatedAmount) > maxCash(bill) + 0.004) {
        setError(`Bill ${bill.billNumber}: current receipt cannot exceed ${money(maxCash(bill))}.`);
        return;
      }
    }

    const allocatedIds = new Set(allocations.map((row) => row.purchaseBillId));
    for (const [billId, rows] of Object.entries(jvBills)) {
      if (rows.length > 0 && !allocatedIds.has(billId)) {
        const bill = bills.find((candidate) => candidate.id === billId);
        setError(
          `Journal Voucher Auto on bill ${bill?.billNumber ?? billId} needs a cash allocation in this row.`
        );
        return;
      }
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
        adjustments.push(...(jvBills[allocation.purchaseBillId] ?? []));
      }

      onApply({
        allocations: validated.allocations.map((row) => ({
          purchaseBillId: row.purchaseBillId,
          allocatedAmount: row.allocatedAmount,
          billNumber: row.billNumber,
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

  const selectedBill = selectedBillId
    ? bills.find((bill) => bill.id === selectedBillId) ?? null
    : null;
  const selectedItems = selectedBill?.items ?? [];
  const selectedQty = selectedItems.reduce((sum, item) => sum + toAmount(item.quantity), 0);
  const selectedUnits = Array.from(new Set(selectedItems.map((item) => item.unit))).join(', ');
  const jvBillCurRec = jvTarget ? toAmount(curRec[jvTarget.id]) : 0;
  const jvBillBalance = jvTarget ? round2(toAmount(jvTarget.balance) - jvBillCurRec) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-2 sm:p-3">
        <div className="bg-white shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-[#789d93]">
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#2c5f57] text-white">
            <span className="text-[12px] font-bold uppercase tracking-wide">
              Outstanding Adjustment
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-white/10"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-2.5 py-1.5 bg-[#eef5f2] border-b border-[#c2dcd5] flex items-start justify-between gap-3 text-[11px]">
            <div className="min-w-0 space-y-0.5">
              <div className="truncate">
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Party Name :{' '}
                </span>
                <span className="font-semibold text-slate-800">{partyName || '-'}</span>
              </div>
              <div className="truncate" title={partyAddress}>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Address :{' '}
                </span>
                <span className="text-slate-700">{partyAddress || '-'}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                Cheque Balance
              </span>
              <span className="font-mono font-bold text-[14px] text-emerald-700">
                {money(chequeBalance)}
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 bg-red-50 border-b border-red-200 text-red-700 text-[11px] px-2.5 py-1">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[#d5e7e1] z-10">
                <tr className="text-slate-700 text-[9.5px] uppercase tracking-wider">
                  <th className="px-1.5 py-1 text-left border-b border-[#789d93] w-12">Type</th>
                  <th className="px-1.5 py-1 text-left border-b border-[#789d93]">Book</th>
                  <th className="px-1.5 py-1 text-left border-b border-[#789d93]">Bill No</th>
                  <th className="px-1.5 py-1 text-left border-b border-[#789d93] w-[86px]">Date</th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-10">Due</th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-[84px]">
                    Bill Amt
                  </th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-[70px]">
                    Bill Tds
                  </th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-[80px]">
                    PreRec
                  </th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-[86px]">
                    CurRec
                  </th>
                  <th className="px-1.5 py-1 text-right border-b border-[#789d93] w-[84px]">
                    Balance
                  </th>
                  <th className="px-1.5 py-1 text-center border-b border-[#789d93] w-[64px]">
                    J.V Req?
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto mb-2" />
                      Loading outstanding bills...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 py-8 text-center text-slate-500">
                      <p className="text-[12px] font-semibold text-slate-600">
                        No outstanding confirmed bills for this party
                      </p>
                      <p className="text-[10.5px] mt-1">
                        Use No Adjustment or Skip in O/S if this receipt should stay on account.
                      </p>
                    </td>
                  </tr>
                ) : (
                  bills.map((bill, index) => {
                    const entered = toAmount(curRec[bill.id]);
                    const net = netAdj(bill.id);
                    const balance = toAmount(bill.balance);
                    const remaining = round2(balance - entered - net);
                    const jvRows = jvBills[bill.id] ?? [];
                    const isSelected = bill.id === selectedBillId;
                    const available = maxCash(bill);
                    return (
                      <tr
                        key={bill.id}
                        onClick={() => setSelectedBillId(bill.id)}
                        className={`border-b border-slate-200 cursor-pointer ${
                          isSelected
                            ? 'bg-[#d5e7e1]'
                            : index % 2 === 0
                              ? 'bg-white'
                              : 'bg-[#f6faf8]'
                        }`}
                      >
                        <td className="px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {bill.typeCode}
                        </td>
                        <td
                          className="px-1.5 py-0.5 truncate max-w-[150px]"
                          title={bill.bookName ?? ''}
                        >
                          {bill.bookName ?? '-'}
                        </td>
                        <td className="px-1.5 py-0.5 font-mono font-semibold">{bill.billNumber}</td>
                        <td className="px-1.5 py-0.5 whitespace-nowrap">{bill.billDate}</td>
                        <td className="px-1.5 py-0.5 text-right font-mono text-slate-500">
                          {bill.dueValue ?? DASH}
                        </td>
                        <td className="px-1.5 py-0.5 text-right font-mono">
                          {money(bill.billAmount)}
                        </td>
                        <td className="px-1.5 py-0.5 text-right font-mono">{money(bill.billTds)}</td>
                        <td className="px-1.5 py-0.5 text-right font-mono">
                          {money(bill.previousReceived)}
                        </td>
                        <td className="px-1 py-0.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={curRec[bill.id] ?? ''}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const cleaned = event.target.value.replace(/[^0-9.]/g, '');
                              setCurRec((prev) => ({ ...prev, [bill.id]: cleaned }));
                              setSelectedBillId(bill.id);
                            }}
                            className="w-full h-6 px-1 text-right font-mono text-[11px] border border-slate-300 bg-white focus:outline-none focus:border-[#2c5f57]"
                            placeholder="0.00"
                            title={`Available cash for this bill: ${money(available)}`}
                          />
                        </td>
                        <td
                          className={`px-1.5 py-0.5 text-right font-mono font-semibold ${
                            remaining < 0 ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {money(remaining)}
                        </td>
                        <td className="px-1.5 py-0.5 text-center">
                          <input
                            type="checkbox"
                            checked={jvRows.length > 0}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              setSelectedBillId(bill.id);
                              if (event.target.checked) {
                                setJvTarget(bill);
                              } else {
                                setJvBills((prev) => {
                                  const next = { ...prev };
                                  delete next[bill.id];
                                  return next;
                                });
                              }
                            }}
                            aria-label={`Journal voucher required for ${bill.billNumber}`}
                            className="h-3.5 w-3.5 accent-[#2c5f57] cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {bills.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-[#dce8e1] font-bold text-slate-800 border-t-2 border-[#789d93]">
                    <td colSpan={5} className="px-1.5 py-1 text-right uppercase text-[9.5px]">
                      Totals
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono">
                      {money(bills.reduce((sum, bill) => sum + toAmount(bill.billAmount), 0))}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono">
                      {money(bills.reduce((sum, bill) => sum + toAmount(bill.billTds), 0))}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono">
                      {money(bills.reduce((sum, bill) => sum + toAmount(bill.previousReceived), 0))}
                    </td>
                    <td className="px-1.5 py-1 text-right font-mono">{money(allocatedTotal)}</td>
                    <td
                      className={`px-1.5 py-1 text-right font-mono ${
                        totalBalance < 0 ? 'text-red-600' : ''
                      }`}
                    >
                      {money(totalBalance)}
                    </td>
                    <td className="px-1.5 py-1" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {selectedItems.length > 0 && (
            <div className="px-2.5 py-1 border-t border-[#c2dcd5] bg-[#f6faf8] text-[10.5px] text-slate-700 flex flex-wrap items-center gap-x-4 gap-y-0.5">
              <span className="truncate">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[9.5px]">
                  Item Name :{' '}
                </span>
                {selectedItems.map((item) => item.itemName).join(', ')}
              </span>
              <span className="whitespace-nowrap">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[9.5px]">
                  Nos ={' '}
                </span>
                {selectedItems.length}
              </span>
              <span className="whitespace-nowrap">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[9.5px]">
                  Qty ={' '}
                </span>
                {money(selectedQty)}
                {selectedUnits ? ` ${selectedUnits}` : ''}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#dce8e1] border-t border-[#789d93] text-[11px] text-slate-600 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => void load()}
                className="flex items-center gap-1 px-2 py-0.5 border border-[#789d93] bg-white font-semibold hover:bg-slate-50"
              >
                <RefreshCcw className="w-3 h-3" />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleAutoAllocate}
                className="px-2 py-0.5 border border-[#789d93] bg-white font-semibold hover:bg-slate-50"
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
                className="px-3 py-0.5 border border-slate-400 bg-white font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || bills.length === 0}
                className="px-3 py-0.5 bg-[#2c5f57] text-white font-bold disabled:bg-slate-400 hover:bg-[#204741] flex items-center gap-1"
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
          billBalance={jvBillBalance.toFixed(2)}
          chequeBalance={chequeBalance.toFixed(2)}
          curReceived={jvBillCurRec.toFixed(2)}
          initialAdjustments={jvBills[jvTarget.id] ?? []}
          onClose={() => setJvTarget(null)}
          onSave={(adjustments) => {
            // The dialog only knows the accounts and amounts; the bill linkage
            // belongs to this popup. Without purchaseBillId the backend would
            // store the adjustment as a row-level entry, leaving the bill
            // unsettled and the discount unattached to its allocation.
            setJvBills((prev) => ({
              ...prev,
              [jvTarget.id]: adjustments.map((adjustment) => ({
                ...adjustment,
                purchaseBillId: jvTarget.id,
              })),
            }));
            setJvTarget(null);
          }}
        />
      )}
    </>
  );
};

export default OutstandingAdjustmentDialog;