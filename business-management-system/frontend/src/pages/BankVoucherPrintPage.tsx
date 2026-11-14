import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getBankVoucherById } from '../services/api';
import { BankVoucher, BankVoucherType, PAYMENT_MODE_LABELS } from '../types';
import { amountInWords } from '../utils/amountInWords';
import { bankVoucherPaths } from './BankVoucherEntryPage';
import { WhatsAppShareButton } from '../components/WhatsAppShareModal';

interface BankVoucherPrintPageProps {
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

export const BankVoucherPrintPage: React.FC<BankVoucherPrintPageProps> = ({ voucherType }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const paths = bankVoucherPaths(voucherType);
  const isReceipt = voucherType === 'RECEIPT';
  const { activeCompany } = useCompany();

  const [voucher, setVoucher] = useState<BankVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBankVoucherById(voucherType, id);
      setVoucher(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the voucher for printing.');
    } finally {
      setLoading(false);
    }
  }, [id, voucherType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!voucher) return;
    const originalTitle = document.title;
    const clean = voucher.voucherNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `${isReceipt ? 'BANK_RECEIPT' : 'BANK_PAYMENT'}_${clean}`;
    return () => {
      document.title = originalTitle;
    };
  }, [voucher, isReceipt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Preparing print preview…</p>
        </div>
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to print this voucher</p>
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

  const addressLine = [
    activeCompany?.address,
    activeCompany?.city,
    activeCompany?.state,
    activeCompany?.pincode,
  ]
    .filter((part) => Boolean(part && String(part).trim() !== ''))
    .join(', ');
  const referenceText =
    voucher.paymentMode === 'CHEQUE'
      ? `Cheque No. ${voucher.chequeNumber ?? '—'}${voucher.chequeDate ? ` dated ${formatDate(voucher.chequeDate)}` : ''}`
      : voucher.referenceNumber ?? '—';

  return (
    <div className="w-full max-w-[860px] mx-auto">
      <div className="print-toolbar flex items-center justify-between gap-2 mb-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
        <div className="text-[11.5px] text-slate-600 font-semibold">
          {isReceipt ? 'Bank Receipt' : 'Bank Payment'} · {voucher.voucherNumber}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(paths.view(voucher.id))}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <WhatsAppShareButton
            documentType={isReceipt ? 'BANK_RECEIPT' : 'BANK_PAYMENT'}
            documentId={voucher.id}
            documentNumber={voucher.voucherNumber}
            partyId={voucher.party?.id ?? null}
            partyName={voucher.party?.partyName ?? null}
          />
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
            {isReceipt ? 'Bank Receipt Voucher' : 'Bank Payment Voucher'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] mb-3">
          <p>
            <span className="font-bold">Voucher No.: </span>
            <span className="font-mono">{voucher.voucherNumber}</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Date: </span>
            {formatDate(voucher.voucherDate)}
          </p>
          <p>
            <span className="font-bold">{isReceipt ? 'Received From: ' : 'Paid To: '}</span>
            {voucher.counterparty.accountName}
            {' '}
            <span className="text-slate-500">({voucher.counterparty.accountCode})</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Payment Mode: </span>
            {PAYMENT_MODE_LABELS[voucher.paymentMode]}
          </p>
          <p>
            <span className="font-bold">Bank: </span>
            {voucher.bankAccountDisplayName}
            {voucher.branchName ? ` · ${voucher.branchName}` : ''}
          </p>
          <p className="text-right">
            <span className="font-bold">
              {voucher.paymentMode === 'CHEQUE' ? 'Cheque: ' : 'Reference: '}
            </span>
            <span className="font-mono">{referenceText}</span>
          </p>
          {voucher.party && (
            <p className="col-span-2">
              <span className="font-bold">Party Code: </span>
              <span className="font-mono">{voucher.party.partyCode}</span>
            </p>
          )}
        </div>

        <table className="w-full text-[11px] border border-slate-800 border-collapse">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-100">
              <th className="border border-slate-800 px-2 py-1 text-left w-[52%]">Account / Particulars</th>
              <th className="border border-slate-800 px-2 py-1 text-left">Account Code</th>
              <th className="border border-slate-800 px-2 py-1 text-right w-[20%]">Debit (₹)</th>
              <th className="border border-slate-800 px-2 py-1 text-right w-[20%]">Credit (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-800 px-2 py-1 font-semibold">
                {voucher.debitAccount.accountName}
              </td>
              <td className="border border-slate-800 px-2 py-1 font-mono">
                {voucher.debitAccount.accountCode}
              </td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">{money(voucher.amount)}</td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">—</td>
            </tr>
            <tr>
              <td className="border border-slate-800 px-2 py-1 pl-6">
                <span className="text-slate-500 mr-1">To</span>
                {voucher.creditAccount.accountName}
              </td>
              <td className="border border-slate-800 px-2 py-1 font-mono">
                {voucher.creditAccount.accountCode}
              </td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">—</td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">{money(voucher.amount)}</td>
            </tr>
            <tr className="font-bold bg-slate-50 print:bg-slate-50">
              <td className="border border-slate-800 px-2 py-1" colSpan={2}>
                Total
              </td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">{money(voucher.amount)}</td>
              <td className="border border-slate-800 px-2 py-1 text-right font-mono">{money(voucher.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2 text-[11px]">
          <p>
            <span className="font-bold">Amount in words: </span>
            {amountInWords(voucher.amount)}
          </p>
          <p className="mt-1">
            <span className="font-bold">Narration: </span>
            {voucher.narration ?? '—'}
          </p>
          {voucher.remarks && (
            <p className="mt-0.5">
              <span className="font-bold">Remarks: </span>
              {voucher.remarks}
            </p>
          )}
          {voucher.status === 'CANCELLED' && (
            <p className="mt-1 font-bold text-red-700">
              CANCELLED — {voucher.cancellationReason ?? 'cancelled voucher'} (posting reversed)
            </p>
          )}
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-[10.5px]">
          <div className="border-t border-slate-700 pt-1 text-center">Prepared By</div>
          <div className="border-t border-slate-700 pt-1 text-center">Checked By</div>
          <div className="border-t border-slate-700 pt-1 text-center">Authorised Signatory</div>
        </div>

        <p className="mt-4 text-center text-[9px] text-slate-400">
          This is a computer-generated {isReceipt ? 'bank receipt' : 'bank payment'} voucher. Journal reference
          revision {voucher.revision}.
        </p>
      </div>
    </div>
  );
};