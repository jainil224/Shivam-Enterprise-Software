import React, { useCallback, useEffect, useState } from 'react';
import { WhatsAppShareButton } from '../components/WhatsAppShareModal';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Loader2,
  Printer,
  RefreshCcw,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { exportBankReconciliationPdf, getBankReconciliationStatement } from '../services/api';
import type { ReconciliationStatementResponse } from '../types/bankReconciliation';

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

const resolveError = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
  return response?.data?.error?.message ?? fallback;
};

// Column widths mirror the server-side PDF weights so the print preview and the
// downloaded document break the page at the same place.
const PAYMENT_COLUMNS = [
  { label: 'Date', width: 12.63 },
  { label: 'Chq. No.', width: 15.79 },
  { label: 'Favouring', width: 38.95 },
  { label: 'Amount (Rs.)', width: 18.95 },
  { label: 'Cl. Date', width: 13.68 },
];

const RECEIPT_COLUMNS = [
  { label: 'Date', width: 12.5 },
  { label: 'Chq. No.', width: 15.63 },
  { label: 'Received From', width: 46.87 },
  { label: 'Amount (Rs.)', width: 25 },
];

const cellClass = 'border-b border-black px-1.5 py-1 align-middle';
const headClass = 'border-b border-black px-1.5 py-1 text-left align-middle font-bold';

export const BankReconciliationPrintPage: React.FC = () => {
  const { bankLedgerId } = useParams<{ bankLedgerId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFinancialYear } = useCompany();

  const fyStart = activeFinancialYear ? activeFinancialYear.startDate.slice(0, 10) : '';
  const fyEnd = activeFinancialYear ? activeFinancialYear.endDate.slice(0, 10) : '';
  const today = new Date().toISOString().slice(0, 10);
  const fallbackTo = fyEnd && today > fyEnd ? fyEnd : today;

  const fromDate = searchParams.get('from') ?? fyStart;
  const toDate = searchParams.get('to') ?? fallbackTo;

  const [data, setData] = useState<ReconciliationStatementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!bankLedgerId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getBankReconciliationStatement({
        bankLedgerAccountId: bankLedgerId,
        fromDate,
        toDate,
      });
      setData(result);
    } catch (err) {
      setError(resolveError(err, 'Unable to load the bank reconciliation statement.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bankLedgerId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadPdf = useCallback(async () => {
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
    } catch (err) {
      setError(resolveError(err, 'Unable to generate the PDF.'));
    } finally {
      setExporting(false);
    }
  }, [bankLedgerId, fromDate, toDate]);

  if (!bankLedgerId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xs font-semibold text-slate-600">No bank book selected.</p>
      </div>
    );
  }

  const company = data?.company;
  const addressLine = company
    ? [company.address, company.city, company.state, company.pincode]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(', ')
    : '';
  const differenceIsZero =
    data?.summary.difference !== null && data?.summary.differenceIsZero === true;

  const renderTable = (
    columns: { label: string; width: number }[],
    rows: { key: string; cells: string[] }[],
    total: string
  ) => (
    <table className="w-full table-fixed border-collapse text-[9.5px]">
      <colgroup>
        {columns.map((column) => (
          <col key={column.label} style={{ width: column.width + '%' }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th
              key={column.label}
              className={
                headClass +
                (index < columns.length - 1 ? ' border-r border-black' : '') +
                (index === columns.length - 1 && column.label.startsWith('Amount') ? ' text-right' : '')
              }
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className={cellClass + ' text-center italic'}>
              All Clear
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td
                  key={columns[index]?.label ?? index}
                  className={
                    cellClass +
                    (index < row.cells.length - 1 ? ' border-r border-black' : '') +
                    (index === row.cells.length - 1 && columns[index]?.label.startsWith('Amount')
                      ? ' text-right font-mono'
                      : index === 0
                        ? ' font-mono'
                        : '')
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
        <tr>
          <td
            colSpan={columns.length - 2}
            className={cellClass + ' border-r border-black text-right font-bold'}
          >
            Total
          </td>
          <td className={cellClass + ' border-r border-black text-right font-mono font-bold'}>
            {total}
          </td>
          <td className={cellClass} />
        </tr>
      </tbody>
    </table>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 print:block print:h-auto print:min-h-0 print:gap-0">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#789d93] bg-[#2c5f57] px-3 py-2 text-white print:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                '/reports/bank-reconciliation/' + bankLedgerId + '?from=' + fromDate + '&to=' + toDate
              )
            }
            className="rounded-lg border border-white/30 p-1.5 hover:bg-white/10"
            title="Back to reconciliation"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/60">
              Bank Reconciliation Statement
            </p>
            <h1 className="text-[13px] font-bold leading-tight">
              {data?.bank.accountName ?? 'Loading...'}
            </h1>
            <p className="text-[10px] text-white/70">
              {displayDate(fromDate)} to {displayDate(toDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={'h-3.5 w-3.5' + (loading ? ' animate-spin' : '')} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF
          </button>
          <WhatsAppShareButton
            documentType="REPORT_BANK_RECONCILIATION"
            documentId={bankLedgerId ?? 'adhoc'}
            documentNumber={data?.bank.accountName ?? 'Bank Reconciliation'}
            reportRequest={{
              bankLedgerAccountId: bankLedgerId,
              fromDate,
              toDate,
              orientation: 'portrait',
            }}
            className="flex items-center gap-1.5 rounded-lg border border-white/30 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/10 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-[#2c5f57] hover:bg-white/90"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 print:hidden">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-200/60 p-2 print:h-auto print:min-h-0 print:flex-none print:overflow-visible print:bg-white print:p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Building statement...
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-600">
            Statement data is unavailable.
          </div>
        ) : (
          <>
            <div className="bank-reco-statement mx-auto w-full max-w-[820px] bg-white text-[10px] leading-tight text-black shadow-lg print:max-w-none print:shadow-none">
              <div className="border border-black">
                <div className="border-b border-black px-2 py-1.5 text-center">
                  <p className="text-[14px] font-bold uppercase italic leading-tight">
                    {data.company.companyName}
                  </p>
                  <p className="text-[9.5px]">{data.financialYear.yearName}</p>
                </div>

                {addressLine && (
                  <div className="border-b border-black px-2 py-1 text-center text-[9.5px]">
                    {addressLine}
                  </div>
                )}

                <div className="border-b border-black px-2 py-1 text-left text-[9.5px]">
                  GSTIN: {data.company.gstin || 'Not recorded'}
                </div>

                <div className="border-b border-black px-2 py-1 text-center text-[10.5px] font-bold uppercase">
                  BANK : {data.bank.accountName}
                </div>

                <div className="border-b border-black px-2 py-1 text-center">
                  <p className="text-[11px] font-bold uppercase italic">
                    Bank Reconciliation Report
                  </p>
                  <p className="text-[9.5px] uppercase">
                    From: {displayDate(data.fromDate)} To: {displayDate(data.toDate)}
                  </p>
                </div>

                <div className="flex border-b border-black">
                  <div className="flex-1 border-r border-black px-2 py-1 font-bold italic">
                    1. Balance as per our Bank Book :-
                  </div>
                  <div className="w-[170px] px-2 py-1 text-right font-mono font-bold">
                    Rs. {formatMoney(data.summary.closingBookBalance)}
                  </div>
                </div>

                <div className="border-b border-black px-2 py-1 font-bold italic">
                  2. Add : Cheques issued but not presented for payment :-
                </div>

                {renderTable(
                  PAYMENT_COLUMNS,
                  data.paymentRows.map((row) => ({
                    key: row.journalLineId,
                    cells: [
                      displayDate(row.date),
                      row.chequeNo || '',
                      row.favouring,
                      formatMoney(row.amount),
                      row.clearingDate ? displayDate(row.clearingDate) : '',
                    ],
                  })),
                  formatMoney(data.summary.unclearedPayments)
                )}

                <div className="border-b border-black px-2 py-1 font-bold italic">
                  3. Less : Cheque deposited but not credited :-
                </div>

                {renderTable(
                  RECEIPT_COLUMNS,
                  data.receiptRows.map((row) => ({
                    key: row.journalLineId,
                    cells: [
                      displayDate(row.date),
                      row.chequeNo || '',
                      row.receivedFrom,
                      formatMoney(row.amount),
                    ],
                  })),
                  formatMoney(data.summary.unclearedReceipts)
                )}

                <div className="flex border-b border-black">
                  <div className="flex-1 border-r border-black px-2 py-1 font-bold italic">
                    4. Balance as per Bank Statement :-
                  </div>
                  <div className="w-[170px] px-2 py-1 text-right font-mono font-bold">
                    {data.summary.statementBalance === null
                      ? 'Not entered'
                      : 'Rs. ' + formatSignedMoney(data.summary.statementBalance)}
                  </div>
                </div>

                <div className="flex">
                  <div className="flex-1 border-r border-black px-2 py-1 font-bold italic">
                    5. Cl. Bal :-
                  </div>
                  <div className="w-[170px] px-2 py-1 text-right font-mono font-bold">
                    Rs. {formatMoney(data.summary.calculatedBankBalance)}
                  </div>
                </div>
              </div>
            </div>

            {data.summary.difference !== null && !differenceIsZero && (
              <p className="bank-reco-statement mx-auto mt-1 w-full max-w-[820px] text-[9px] font-bold text-black print:max-w-none">
                Unreconciled Difference: Rs. {formatSignedMoney(data.summary.difference)}
              </p>
            )}

            {data.history.length > 0 && (
              <div className="mx-auto mt-4 w-full max-w-[820px] print:hidden">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Saved Reconciliation History
                </p>
                <table className="w-full border-collapse text-[9px]">
                  <thead>
                    <tr className="border-y border-slate-300 bg-slate-50 font-bold">
                      <th className="px-1 py-1 text-left">Period</th>
                      <th className="px-1 py-1 text-right">Statement</th>
                      <th className="px-1 py-1 text-right">Book</th>
                      <th className="px-1 py-1 text-right">Calculated Bank</th>
                      <th className="px-1 py-1 text-right">Difference</th>
                      <th className="px-1 py-1 text-center">Status</th>
                      <th className="px-1 py-1 text-left">Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-200">
                        <td className="px-1 py-1 font-mono">
                          {displayDate(entry.fromDate)} - {displayDate(entry.toDate)}
                        </td>
                        <td className="px-1 py-1 text-right font-mono">
                          {formatSignedMoney(entry.closingStatementBalance)}
                        </td>
                        <td className="px-1 py-1 text-right font-mono">
                          {formatMoney(entry.bookClosingBalance)}
                        </td>
                        <td className="px-1 py-1 text-right font-mono">
                          {formatMoney(entry.calculatedBankBalance)}
                        </td>
                        <td className="px-1 py-1 text-right font-mono">
                          {formatSignedMoney(entry.difference)}
                        </td>
                        <td className="px-1 py-1 text-center font-bold">{entry.status}</td>
                        <td className="px-1 py-1 font-mono">
                          {entry.createdAt.slice(0, 19).replace('T', ' ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BankReconciliationPrintPage;