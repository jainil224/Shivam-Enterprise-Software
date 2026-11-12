import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getBankVoucherById } from '../services/api';
import { BankVoucher } from '../types';
import { amountInWords } from '../utils/amountInWords';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface PartyGroup {
  partyId: string;
  partyName: string;
  partyCode: string;
  amount: number;
  lines: NonNullable<BankVoucher['receiptLines']>;
}

export const ChequeReceiptAdvicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [voucher, setVoucher] = useState<BankVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBankVoucherById('RECEIPT', id);
      setVoucher(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the receipt advice.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!voucher) return;
    const originalTitle = document.title;
    document.title = `RECEIPT_ADVICE_${voucher.voucherNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    return () => {
      document.title = originalTitle;
    };
  }, [voucher]);

  const groups = useMemo<PartyGroup[]>(() => {
    if (!voucher || !voucher.receiptLines) return [];
    const map = new Map<string, PartyGroup>();
    for (const line of voucher.receiptLines) {
      const partyId = line.party?.id ?? 'unknown';
      const existing = map.get(partyId);
      const amount = Number(line.amount) || 0;
      if (existing) {
        existing.amount += amount;
        existing.lines.push(line);
      } else {
        map.set(partyId, {
          partyId,
          partyName: line.party?.partyName ?? 'Unknown party',
          partyCode: line.party?.partyCode ?? '-',
          amount,
          lines: [line],
        });
      }
    }
    return Array.from(map.values());
  }, [voucher]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Preparing receipt advice...</p>
        </div>
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to build this advice</p>
        <p className="text-xs text-slate-600">{error ?? 'The receipt could not be found.'}</p>
        <button
          type="button"
          onClick={() => navigate('/transactions/bank-receipts/cheque-entry')}
          className="mt-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          Back to Cheque Receipt
        </button>
      </div>
    );
  }

  const addressLine = [
    activeCompany?.address,
    activeCompany?.city,
    activeCompany?.state,
    activeCompany?.pincode,
  ]
    .filter((part) => Boolean(part && String(part).trim() !== ''))
    .join(', ');

  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div className="print-toolbar flex items-center justify-between gap-2 mb-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
        <div className="text-[11.5px] text-slate-600 font-semibold">
          Receipt Advice - {voucher.voucherNumber}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(`/transactions/bank-receipts/cheque-entry/${voucher.id}`)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-6 text-slate-900 print:border-0 print:shadow-none print:rounded-none">
        <div className="text-center border-b-2 border-slate-800 pb-2">
          <h1 className="text-[18px] font-extrabold uppercase tracking-wide leading-tight">
            {activeCompany?.companyName ?? 'Company'}
          </h1>
          {addressLine && <p className="text-[11px] leading-snug mt-0.5">{addressLine}</p>}
          <div className="text-[10.5px] mt-0.5 flex items-center justify-center gap-3 flex-wrap">
            {activeCompany?.gstin && <span>GSTIN: {activeCompany.gstin}</span>}
            {activeCompany?.phone && <span>Ph: {activeCompany.phone}</span>}
            {activeCompany?.email && <span>{activeCompany.email}</span>}
          </div>
        </div>

        <div className="text-center my-2">
          <h2 className="inline-block border border-slate-800 px-4 py-1 text-[12.5px] font-bold uppercase tracking-wider">
            Receipt Allocation Advice
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-3">
          <p>
            <span className="font-bold">Receipt No.: </span>
            <span className="font-mono">{voucher.voucherNumber}</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Date: </span>
            {formatDate(voucher.voucherDate)}
          </p>
          <p>
            <span className="font-bold">Bank: </span>
            {voucher.bankAccountDisplayName}
          </p>
          <p className="text-right">
            <span className="font-bold">Receipt Book: </span>
            {voucher.receiptBook
              ? `${voucher.receiptBook.prefix ? `${voucher.receiptBook.prefix} - ` : ''}${voucher.receiptBook.bookName}`
              : '-'}
          </p>
          <p>
            <span className="font-bold">Total Received: </span>
            <span className="font-mono">Rs. {money(voucher.amount)}</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Parties: </span>
            {groups.length}
          </p>
        </div>

        {groups.length === 0 ? (
          <p className="text-[11.5px] text-slate-600 border border-slate-300 rounded px-3 py-4 text-center">
            This receipt has no multi-row party detail, so no allocation advice can be produced.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.partyId} className="border border-slate-800">
                <div className="flex items-center justify-between bg-slate-100 print:bg-slate-100 px-2 py-1 text-[11.5px]">
                  <div>
                    <span className="font-bold">{group.partyName}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      {group.partyCode}
                    </span>
                  </div>
                  <div className="font-mono font-bold">Rs. {money(group.amount)}</div>
                </div>

                <table className="w-full text-[10.5px] border-collapse">
                  <thead>
                    <tr className="text-slate-600">
                      <th className="border-t border-slate-300 px-2 py-1 text-left w-24">Cheque / UTR</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-left w-20">Bank</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-left">Bill No</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-left w-24">Bill Date</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-right w-24">Bill Amount</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-right w-24">Allocated</th>
                      <th className="border-t border-slate-300 px-2 py-1 text-right w-24">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((line) => {
                      const activeAllocations = line.allocations.filter(
                        (allocation) => allocation.status === 'ACTIVE'
                      );
                      if (activeAllocations.length === 0) {
                        return (
                          <tr key={line.id} className="border-t border-slate-200">
                            <td className="px-2 py-1 font-mono">{line.chequeNumber ?? '-'}</td>
                            <td className="px-2 py-1 font-mono">
                              {line.bankNameCode ?? line.bankInstrument?.code ?? '-'}
                            </td>
                            <td className="px-2 py-1 text-slate-500" colSpan={3}>
                              No bill allocation ({line.description ?? 'on account'})
                            </td>
                            <td className="px-2 py-1 text-right font-mono">{money(line.amount)}</td>
                            <td className="px-2 py-1 text-right text-slate-500">-</td>
                          </tr>
                        );
                      }
                      return activeAllocations.map((allocation, index) => (
                        <tr key={allocation.id} className="border-t border-slate-200">
                          <td className="px-2 py-1 font-mono">
                            {index === 0 ? line.chequeNumber ?? '-' : ''}
                          </td>
                          <td className="px-2 py-1 font-mono">
                            {index === 0
                              ? line.bankNameCode ?? line.bankInstrument?.code ?? '-'
                              : ''}
                          </td>
                          <td className="px-2 py-1 font-mono">{allocation.sourceDocumentNumber}</td>
                          <td className="px-2 py-1">{formatDate(allocation.billDate)}</td>
                          <td className="px-2 py-1 text-right font-mono">
                            {money(allocation.billAmount)}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">
                            {money(allocation.allocatedAmount)}
                          </td>
                          <td className="px-2 py-1 text-right font-mono">
                            {money(allocation.balanceAfter)}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-[11px] space-y-0.5">
          <p>
            <span className="font-bold">Amount in words: </span>
            {amountInWords(voucher.amount)}
          </p>
          <p>
            <span className="font-bold">Narration: </span>
            {voucher.narration ?? '-'}
          </p>
          <p className="text-[10px] text-slate-500">
            This advice is generated from the saved receipt and its active bill allocations. It is a
            printable document only; no message or email is sent from this system.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-[10.5px]">
          <div className="border-t border-slate-700 pt-1 text-center">Prepared By</div>
          <div className="border-t border-slate-700 pt-1 text-center">Checked By</div>
          <div className="border-t border-slate-700 pt-1 text-center">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
};

export default ChequeReceiptAdvicePage;