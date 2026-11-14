import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { WhatsAppShareButton } from '../components/WhatsAppShareModal';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  X,
} from 'lucide-react';
import { exportBankBookPdf, exportBankBookXlsx, runBankBook } from '../services/api';
import type {
  BankBookPageState,
  BankBookReportResult,
  BankBookRow,
  BankBookSummaryRow,
  LedgerReportColumnDef,
} from '../types/ledgerReports';
import { BANK_BOOK_STATE_KEY } from '../types/ledgerReports';
import {
  balanceText,
  chunkRows,
  displayDate,
  downloadBlob,
  formatMoney,
  formatSignedMoney,
  readError,
  readPageState,
  writePageState,
} from './ledgerReportShared';

const ROWS_PER_SHEET_PORTRAIT = 30;
const ROWS_PER_SHEET_LANDSCAPE = 20;

const alignClass = (column: LedgerReportColumnDef): string => {
  if (column.align === 'right') return 'text-right';
  if (column.align === 'center') return 'text-center';
  return 'text-left';
};

const printCellValue = (
  column: LedgerReportColumnDef,
  row: BankBookRow | BankBookSummaryRow,
  isSummary: boolean
): string => {
  if (isSummary) {
    const summary = row as BankBookSummaryRow;
    switch (column.key) {
      case 'date':
        return displayDate(summary.date);
      case 'totalWithdraw':
        return formatMoney(summary.totalWithdraw);
      case 'totalDeposit':
        return formatMoney(summary.totalDeposit);
      case 'netMovement':
        return formatSignedMoney(summary.netMovement);
      case 'closingBalance':
        return balanceText(summary.closingBalance, summary.closingNature);
      default:
        return '';
    }
  }
  const detail = row as BankBookRow;
  switch (column.key) {
    case 'voucherDate':
      return displayDate(detail.voucherDate);
    case 'voucherNo':
      return detail.voucherNo;
    case 'accountName':
      return detail.accountName;
    case 'particulars':
      return detail.particulars;
    case 'chequeRefNo':
      return detail.chequeRefNo;
    case 'withdraw':
      return formatMoney(detail.withdraw);
    case 'deposit':
      return formatMoney(detail.deposit);
    case 'balance':
      return balanceText(detail.balance, detail.balanceNature);
    default:
      return '';
  }
};

const printTotalValue = (column: LedgerReportColumnDef, result: BankBookReportResult): string => {
  switch (column.key) {
    case 'voucherNo':
    case 'particulars':
      return 'Total';
    case 'withdraw':
    case 'totalWithdraw':
      return formatMoney(result.totals.totalWithdraw);
    case 'deposit':
    case 'totalDeposit':
      return formatMoney(result.totals.totalDeposit);
    case 'netMovement':
      return formatSignedMoney(
        Number(result.totals.totalDeposit) - Number(result.totals.totalWithdraw)
      );
    case 'balance':
    case 'closingBalance':
      return balanceText(result.totals.closingBalance, result.totals.closingNature);
    default:
      return '';
  }
};

interface SheetHeaderProps {
  result: BankBookReportResult;
  isSummary: boolean;
}

const SheetHeader: React.FC<SheetHeaderProps> = ({ result, isSummary }) => {
  const filterParts: string[] = [];
  if (result.meta.filterField && result.meta.filterText) {
    filterParts.push(result.meta.filterField + ': ' + result.meta.filterText);
  }
  if (result.meta.partyGroupName) filterParts.push('Party Group: ' + result.meta.partyGroupName);

  return (
    <div className="border border-black">
      <div className="border-b border-black px-2 py-1 text-center">
        <p className="text-[13px] font-bold uppercase leading-tight text-black">
          {result.meta.companyName}
        </p>
        <p className="text-[9px] leading-tight text-black">{result.meta.financialYear}</p>
        {result.meta.companyAddress && (
          <p className="text-[8.5px] leading-tight text-black">{result.meta.companyAddress}</p>
        )}
        {result.meta.companyGstin && (
          <p className="text-[8.5px] leading-tight text-black">GSTIN: {result.meta.companyGstin}</p>
        )}
      </div>
      <div className="border-b border-black px-2 py-0.5 text-center">
        <p className="text-[10px] font-bold uppercase leading-tight text-black">
          BANK : {result.meta.accountName}
        </p>
        <p className="text-[9.5px] font-bold uppercase leading-tight text-black">BANK BOOK</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-black px-2 py-0.5 text-[8.5px] leading-tight text-black">
        <span>
          From {displayDate(result.meta.fromDate)} To {displayDate(result.meta.toDate)}
        </span>
        <span className="uppercase">{isSummary ? 'Summary' : 'Detail'} - Daily</span>
        <span>
          {result.totals.transactionCount} transaction(s)
        </span>
      </div>
      {filterParts.length > 0 && (
        <div className="border-b border-black px-2 py-0.5 text-[8.5px] leading-tight text-black">
          Filter - {filterParts.join(' | ')}
        </div>
      )}
    </div>
  );
};

interface ReportTableProps {
  result: BankBookReportResult;
  rows: Array<BankBookRow | BankBookSummaryRow>;
  isSummary: boolean;
  showOpening: boolean;
  showTotals: boolean;
}

const ReportTable: React.FC<ReportTableProps> = ({
  result,
  rows,
  isSummary,
  showOpening,
  showTotals,
}) => {
  const columns = result.columns;

  return (
    <table className="w-full table-fixed border-collapse text-[8.5px] leading-tight text-black">
      <colgroup>
        {columns.map((column) => (
          <col key={column.key} style={{ width: column.weight + '%' }} />
        ))}
      </colgroup>
      <thead>
        <tr className="bg-[#e8e8e8]">
          {columns.map((column) => (
            <th
              key={column.key}
              className={
                'border border-black px-1 py-[3px] text-[8px] font-bold uppercase ' +
                alignClass(column)
              }
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {showOpening && (
          <tr className="bg-[#f4f4f4] font-bold">
            {columns.map((column, index) => (
              <td key={column.key} className={'border border-black px-1 py-[2px] ' + alignClass(column)}>
                {index === 0
                  ? 'Opening Balance'
                  : column.key === 'balance' || column.key === 'closingBalance'
                    ? balanceText(result.opening.amount, result.opening.nature)
                    : ''}
              </td>
            ))}
          </tr>
        )}

        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={Math.max(1, columns.length)}
              className="border border-black px-1 py-2 text-center"
            >
              No posted transaction matches this report period and filter.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => {
            const key = isSummary
              ? 'sheet-summary-' + (row as BankBookSummaryRow).date + '-' + index
              : (row as BankBookRow).journalLineId;
            return (
              <tr key={key}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={
                      'border border-black px-1 py-[2px] align-top ' +
                      alignClass(column) +
                      (column.type === 'currency' ? ' whitespace-nowrap' : ' break-words')
                    }
                  >
                    {printCellValue(column, row, isSummary)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
      {showTotals && (
        <tfoot>
          <tr className="bg-[#e8e8e8] font-bold">
            {columns.map((column) => (
              <td
                key={column.key}
                className={
                  'border border-black px-1 py-[2px] ' +
                  alignClass(column) +
                  (column.type === 'currency' ? ' whitespace-nowrap' : '')
                }
              >
                {printTotalValue(column, result)}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
};

export const BankBookPrintPage: React.FC = () => {
  const navigate = useNavigate();
  const { ledgerId } = useParams<{ ledgerId: string }>();

  const [state, setState] = useState<BankBookPageState | null>(() =>
    readPageState<BankBookPageState>(BANK_BOOK_STATE_KEY)
  );
  const [result, setResult] = useState<BankBookReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [landscape, setLandscape] = useState<boolean>(state?.landscape ?? false);
  const [sheetIndex, setSheetIndex] = useState(0);

  useEffect(() => {
    if (!state) navigate('/reports/bank-book', { replace: true });
  }, [state, navigate]);

  const request = state?.request ?? null;

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await runBankBook({ ...request, page: 1, pageSize: 500 });
        if (cancelled) return;
        setResult(data);
        setSheetIndex(0);
      } catch (err) {
        if (cancelled) return;
        setResult(null);
        setError(readError(err, 'Failed to build the Bank Book print preview.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [request]);

  const isSummary = result?.meta.detailMode === 'SUMMARY';
  const allRows = useMemo<Array<BankBookRow | BankBookSummaryRow>>(
    () => (isSummary ? result?.summaryRows ?? [] : result?.rows ?? []),
    [isSummary, result]
  );

  const rowsPerSheet = landscape ? ROWS_PER_SHEET_LANDSCAPE : ROWS_PER_SHEET_PORTRAIT;
  const sheets = useMemo(() => chunkRows(allRows, rowsPerSheet), [allRows, rowsPerSheet]);
  const sheetCount = sheets.length;
  const safeIndex = Math.min(sheetIndex, sheetCount - 1);

  const toggleLandscape = useCallback(() => {
    const next = !landscape;
    setLandscape(next);
    setState((prev) => {
      if (!prev) return prev;
      const updated: BankBookPageState = { ...prev, landscape: next };
      writePageState(BANK_BOOK_STATE_KEY, updated);
      return updated;
    });
    setSheetIndex(0);
  }, [landscape]);

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy('pdf');
    setError(null);
    try {
      const file = await exportBankBookPdf({
        ...request,
        pdfOrientation: landscape ? 'landscape' : 'portrait',
      });
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Bank Book PDF.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy, landscape]);

  const downloadXlsx = useCallback(async () => {
    if (!request || busy) return;
    setBusy('xlsx');
    setError(null);
    try {
      const file = await exportBankBookXlsx(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Bank Book Excel file.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate('/reports/bank-book/results');
        return;
      }
      if (event.ctrlKey && (event.key === 'p' || event.key === 'P')) {
        event.preventDefault();
        window.print();
        return;
      }
      if (event.key === 'PageDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setSheetIndex((prev) => Math.min(sheetCount - 1, prev + 1));
        return;
      }
      if (event.key === 'PageUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setSheetIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, sheetCount]);

  if (!state) return null;

  return (
    <div className="ledger-print-root flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800 print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white">
      <header className="print-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Printer className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            Bank Book - Print Preview
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            A4 {landscape ? 'Landscape' : 'Portrait'}
          </span>
          {ledgerId && (
            <span className="hidden truncate font-mono text-[10px] text-emerald-200 sm:inline">
              {ledgerId.slice(0, 8)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={toggleLandscape}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65]"
          >
            <ArrowLeftRight className="h-3 w-3" /> Orientation
          </button>
          <button
            type="button"
            onClick={() => void downloadXlsx()}
            disabled={busy !== null || !result}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65] disabled:opacity-40"
          >
            {busy === 'xlsx' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3 w-3" />
            )}
            Excel
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy !== null || !result}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65] disabled:opacity-40"
          >
            {busy === 'pdf' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Save as PDF
          </button>
          <WhatsAppShareButton
            documentType="REPORT_BANK_BOOK"
            documentId={ledgerId ?? 'adhoc'}
            documentNumber="Bank Book"
            reportRequest={request ? ({ ...request } as unknown as Record<string, unknown>) : undefined}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65] disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!result}
            className="flex h-6 items-center gap-1 rounded bg-white px-1.5 text-[10px] font-bold text-[#2c5f57] hover:bg-emerald-50 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book/results')}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="print:hidden flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-300/60 p-2 print:h-auto print:min-h-0 print:flex-none print:overflow-visible print:bg-white print:p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Building print preview...
          </div>
        ) : !result ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-600">
            Print data is unavailable.
          </div>
        ) : (
          <>
            <div className="mx-auto w-fit print:hidden">
              <div
                className={
                  'ledger-sheet bg-white text-black shadow-lg ' +
                  (landscape ? 'ledger-sheet-landscape' : 'ledger-sheet-portrait')
                }
              >
                <SheetHeader result={result} isSummary={isSummary === true} />
                <ReportTable
                  result={result}
                  rows={sheets[safeIndex] ?? []}
                  isSummary={isSummary === true}
                  showOpening={safeIndex === 0}
                  showTotals={safeIndex === sheetCount - 1}
                />

              </div>
            </div>

            <div
              className={
                'ledger-print-flow hidden print:block ' +
                (landscape ? 'ledger-sheet-landscape' : 'ledger-sheet-portrait')
              }
            >
              <SheetHeader result={result} isSummary={isSummary === true} />
              <ReportTable
                result={result}
                rows={allRows}
                isSummary={isSummary === true}
                showOpening
                showTotals
              />
            </div>
          </>
        )}
      </div>

      <footer className="print-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5 text-[10px] text-slate-600 print:hidden">
        <span>
          PageUp/PageDown = previous/next sheet | Ctrl+P = browser print | Esc = results
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSheetIndex(Math.max(0, safeIndex - 1))}
            disabled={safeIndex <= 0 || loading}
            className="flex h-7 items-center gap-0.5 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" /> Previous
          </button>
          <span className="font-mono">
            {safeIndex + 1} / {sheetCount}
          </span>
          <button
            type="button"
            onClick={() => setSheetIndex(Math.min(sheetCount - 1, safeIndex + 1))}
            disabled={safeIndex >= sheetCount - 1 || loading}
            className="flex h-7 items-center gap-0.5 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Next <ChevronRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports/bank-book/results')}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  );
};

export default BankBookPrintPage;