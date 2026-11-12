import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Loader2,
  Printer,
  X,
} from 'lucide-react';
import { exportAccountLedgerPdf, exportAccountLedgerXlsx, runAccountLedger } from '../services/api';
import type {
  AccountLedgerPageState,
  AccountLedgerReportResult,
} from '../types/ledgerReports';
import { ACCOUNT_LEDGER_STATE_KEY } from '../types/ledgerReports';
import { displayDate, downloadBlob, formatMoney, readError, readPageState } from './ledgerReportShared';
import {
  BODY_PT,
  LINE_PT,
  PRINT_COLUMNS,
  PT_TO_PX,
  SMALL_PT,
  buildLedgerDocument,
  type LedgerChrome,
  type LedgerDocument,
  type LedgerSheet,
} from './ledgerPrintLayout';

/** Points to CSS pixels so the sheet geometry matches the PDF exactly. */
const px = (points: number): string => (points * PT_TO_PX).toFixed(2) + 'px';

/** Blank stays blank so a debit cell never prints a fabricated 0.00. */
const money = (value: string): string => (value ? formatMoney(value) : '');

const alignClass = (align: 'left' | 'right' | 'center'): string => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const COURIER = "'Courier New', Courier, monospace";

const LedgerHeader: React.FC<{
  result: AccountLedgerReportResult;
  chrome: LedgerChrome;
  pageIndex: number;
  pageCount: number;
}> = ({ result, chrome, pageIndex, pageCount }) => (
  <div className="border-b border-black">
    <div
      className="flex items-start justify-between gap-2 border-b border-black"
      style={{ minHeight: px(chrome.row1Pt) }}
    >
      <div style={{ maxWidth: '62%' }}>
        {chrome.companyNameLines.map((line, index) => (
          <p
            key={index}
            className="font-bold uppercase text-black"
            style={{ fontSize: px(15), lineHeight: px(17) }}
          >
            {line}
          </p>
        ))}
      </div>
      <p
        className="shrink-0 font-bold text-black"
        style={{ fontSize: px(13), lineHeight: px(17) }}
      >
        {result.meta.financialYear}
      </p>
    </div>

    <div
      className="border-b border-black"
      style={{ minHeight: px(chrome.row2Pt), paddingTop: px(3) }}
    >
      {chrome.addressLines.map((line, index) => (
        <p key={index} className="text-black" style={{ fontSize: px(SMALL_PT), lineHeight: px(LINE_PT) }}>
          {line}
        </p>
      ))}
    </div>

    <div
      className="flex items-start justify-between gap-2 border-b border-black"
      style={{ minHeight: px(chrome.row3Pt), paddingTop: px(2) }}
    >
      <p className="text-black" style={{ fontSize: px(BODY_PT), lineHeight: px(LINE_PT) }}>
        {result.meta.companyPhone ? 'Phone : ' + result.meta.companyPhone : ''}
      </p>
      <div className="shrink-0 text-right text-black" style={{ fontSize: px(BODY_PT), lineHeight: px(LINE_PT) }}>
        <p className="font-bold" style={{ fontSize: px(9.5) }}>
          Page {pageIndex + 1} of {pageCount}
        </p>
        <p>From : {displayDate(result.meta.fromDate)}</p>
        <p>To : {displayDate(result.meta.toDate)}</p>
      </div>
    </div>

    <div
      className="flex items-center justify-between gap-2"
      style={{ minHeight: px(chrome.row4Pt) }}
    >
      <p
        className="text-black"
        style={{ fontSize: px(BODY_PT), lineHeight: px(LINE_PT), width: '34%' }}
      >
        GSTIN : {result.meta.companyGstin ?? ''}
      </p>
      <p
        className="flex-1 text-center font-bold uppercase"
        style={{ fontSize: px(12), color: '#0d1f59', letterSpacing: '0.02em' }}
      >
        Account Ledger
      </p>
      <span style={{ width: '34%' }} />
    </div>
  </div>
);

const SelectedLedgerRow: React.FC<{ result: AccountLedgerReportResult; chrome: LedgerChrome }> = ({
  result,
  chrome,
}) => (
  <div
    className="flex items-center justify-between gap-2 border-b border-black"
    style={{ minHeight: px(chrome.ledgerRowPt), paddingLeft: px(3), paddingRight: px(3) }}
  >
    <div style={{ maxWidth: '72%' }}>
      {chrome.ledgerNameLines.map((line, index) => (
        <p key={index} className="font-bold text-black" style={{ fontSize: px(11), lineHeight: px(13) }}>
          {line}
        </p>
      ))}
    </div>
    {result.meta.accountCode && (
      <p
        className="shrink-0 text-right text-black"
        style={{ fontSize: px(SMALL_PT), lineHeight: px(LINE_PT) }}
      >
        {result.meta.accountCode}
      </p>
    )}
  </div>
);

const LedgerMetaRow: React.FC<{ result: AccountLedgerReportResult; chrome: LedgerChrome }> = ({
  result,
  chrome,
}) => (
  <div
    className="grid grid-cols-3 items-center border-b border-black text-black"
    style={{ minHeight: px(chrome.metaRowPt), fontSize: px(BODY_PT), lineHeight: px(LINE_PT) }}
  >
    <p className="border-r border-black" style={{ paddingLeft: px(3) }}>
      GST No. : {result.meta.ledgerGstin ?? ''}
    </p>
    <p className="border-r border-black text-center">PAN No. : {result.meta.ledgerPan ?? ''}</p>
    <p className="text-right" style={{ paddingRight: px(3) }}>
      Schedule : {result.meta.schedule ?? ''}
    </p>
  </div>
);

const ReportTable: React.FC<{
  result: AccountLedgerReportResult;
  document: LedgerDocument;
  sheet: LedgerSheet;
}> = ({ result, document, sheet }) => (
  <table
    className="w-full table-fixed border-collapse text-black"
    style={{ fontFamily: COURIER }}
  >
    <colgroup>
      {document.widthsPt.map((width, index) => (
        <col key={index} style={{ width: px(width) }} />
      ))}
    </colgroup>
    <thead>
      <tr style={{ height: px(document.chrome.headPt) }}>
        {document.chrome.headLines.map((lines, index) => (
          <th
            key={index}
            className={
              'border-b border-black align-middle font-bold uppercase ' +
              (index < document.chrome.headLines.length - 1 ? 'border-r ' : '') +
              alignClass(PRINT_COLUMNS[index].align)
            }
            style={{ fontSize: px(SMALL_PT), lineHeight: px(10), paddingLeft: px(3), paddingRight: px(3) }}
          >
            {lines.map((line, lineIndex) => (
              <p key={lineIndex}>{line}</p>
            ))}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {sheet.rows.map((row) => (
        <tr key={row.key} style={{ height: px(row.heightPt) }}>
          {row.lines.map((lines, index) => (
            <td
              key={index}
              className={
                'border-b border-black align-top ' +
                (index < row.lines.length - 1 ? 'border-r ' : '') +
                alignClass(PRINT_COLUMNS[index].align) +
                (PRINT_COLUMNS[index].align === 'left' ? ' break-words' : ' whitespace-nowrap')
              }
              style={{
                fontSize: px(BODY_PT),
                lineHeight: px(LINE_PT),
                padding: px(4) + ' ' + px(3),
                fontWeight: row.bold ? 700 : 400,
              }}
            >
              {lines.length === 0 ? (
                '\u00a0'
              ) : (
                lines.map((line, lineIndex) => <p key={lineIndex}>{line}</p>)
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
    {sheet.showTotals && (
      <tfoot>
        <tr style={{ height: px(17) }}>
          {document.chrome.headLines.map((_, index) => {
            const column = PRINT_COLUMNS[index].key;
            const value =
              column === 'bookName'
                ? 'Total'
                : column === 'debit'
                  ? formatMoney(result.totals.debitTotal)
                  : column === 'credit'
                    ? formatMoney(result.totals.creditTotal)
                    : column === 'balance'
                      ? formatMoney(result.totals.closingBalance)
                      : column === 'sign'
                        ? result.totals.closingNature
                        : '';
            return (
              <td
                key={index}
                className={
                  'border-b border-black align-middle font-bold ' +
                  (index < PRINT_COLUMNS.length - 1 ? 'border-r ' : '') +
                  alignClass(PRINT_COLUMNS[index].align) +
                  (PRINT_COLUMNS[index].align === 'left' ? '' : ' whitespace-nowrap')
                }
                style={{
                  fontSize: px(BODY_PT),
                  lineHeight: px(LINE_PT),
                  padding: px(3),
                }}
              >
                {value}
              </td>
            );
          })}
        </tr>
      </tfoot>
    )}
  </table>
);


const LedgerSheetView: React.FC<{
  result: AccountLedgerReportResult;
  document: LedgerDocument;
  sheet: LedgerSheet;
  pageIndex: number;
  pageCount: number;
  printBreak?: boolean;
}> = ({ result, document, sheet, pageIndex, pageCount, printBreak }) => (
  <div
    className={
      'ledger-sheet account-ledger-sheet mx-auto bg-white text-black ' +
      (printBreak ? 'ledger-sheet-print' : 'shadow-lg')
    }
    style={{ width: '210mm', minHeight: '297mm', padding: px(12) }}
  >
    <div
      className="flex flex-col border border-black"
      style={{ minHeight: px(PAGE_BODY_PT), padding: px(7) }}
    >
      <LedgerHeader result={result} chrome={document.chrome} pageIndex={pageIndex} pageCount={pageCount} />
      <SelectedLedgerRow result={result} chrome={document.chrome} />
      <LedgerMetaRow result={result} chrome={document.chrome} />
      <ReportTable result={result} document={document} sheet={sheet} />
    </div>
  </div>
);

/** Full A4 page height minus the 12pt outer inset. */
const PAGE_BODY_PT = 841.89 - 24;

export const AccountLedgerPrintPage: React.FC = () => {
  const navigate = useNavigate();

  const [state] = useState<AccountLedgerPageState | null>(() =>
    readPageState<AccountLedgerPageState>(ACCOUNT_LEDGER_STATE_KEY)
  );
  const [result, setResult] = useState<AccountLedgerReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  useEffect(() => {
    if (!state) navigate('/reports/account-ledger', { replace: true });
  }, [state, navigate]);

  const request = state?.request ?? null;

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await runAccountLedger({ ...request, page: 1, pageSize: 500 });
        if (cancelled) return;
        setResult(data);
        setSheetIndex(0);
      } catch (err) {
        if (cancelled) return;
        setResult(null);
        setError(readError(err, 'Failed to build the Account Ledger print preview.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [request]);

  // Amounts are formatted exactly like the PDF before the layout is measured.
  const printable = useMemo<AccountLedgerReportResult | null>(() => {
    if (!result) return null;
    return {
      ...result,
      opening: { ...result.opening, amount: money(result.opening.amount) },
      rows: result.rows.map((row) => ({
        ...row,
        date: displayDate(row.date),
        debit: money(row.debit),
        credit: money(row.credit),
        balance: money(row.balance),
      })),
    };
  }, [result]);

  const ledgerDocument = useMemo<LedgerDocument | null>(
    () => (printable ? buildLedgerDocument(printable) : null),
    [printable]
  );

  const sheets = ledgerDocument?.sheets ?? [];
  const sheetCount = sheets.length;
  const safeIndex = Math.min(sheetIndex, Math.max(0, sheetCount - 1));

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy('pdf');
    setError(null);
    try {
      const file = await exportAccountLedgerPdf(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Ledger PDF.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  const downloadXlsx = useCallback(async () => {
    if (!request || busy) return;
    setBusy('xlsx');
    setError(null);
    try {
      const file = await exportAccountLedgerXlsx(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Ledger Excel file.'));
    } finally {
      setBusy(null);
    }
  }, [request, busy]);

  const closePreview = useCallback(() => {
    if (request) navigate('/reports/account-ledger/' + request.ledgerAccountId);
    else navigate('/reports/account-ledger');
  }, [request, navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePreview();
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
  }, [closePreview, sheetCount]);

  if (!state) return null;

  return (
    <div className="ledger-print-root flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800 print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white">
      <header className="print-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Printer className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            Account Ledger - Print Preview
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            A4 Portrait
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
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
            onClick={closePreview}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 print:hidden">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-300/60 p-2 print:h-auto print:min-h-0 print:flex-none print:overflow-visible print:bg-white print:p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Building print preview...
          </div>
        ) : !result || !ledgerDocument ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-600">
            Print data is unavailable.
          </div>
        ) : (
          <>
            <div className="mx-auto w-fit print:hidden">
              <LedgerSheetView
                result={printable ?? result}
                document={ledgerDocument}
                sheet={sheets[safeIndex]}
                pageIndex={safeIndex}
                pageCount={sheetCount}
              />
            </div>

            <div className="hidden print:block">
              {sheets.map((sheet, index) => (
                <LedgerSheetView
                  key={'sheet-' + index}
                  result={printable ?? result}
                  document={ledgerDocument}
                  sheet={sheet}
                  pageIndex={index}
                  pageCount={sheetCount}
                  printBreak={index < sheetCount - 1}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <footer className="print-toolbar flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5 text-[10px] text-slate-600 print:hidden">
        <span>PageUp/PageDown = previous/next sheet | Ctrl+P = browser print | Esc = ledger</span>
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
            {safeIndex + 1} / {Math.max(1, sheetCount)}
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
            onClick={closePreview}
            className="h-7 rounded border border-[#789d93] bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </footer>
    </div>
  );
};

export default AccountLedgerPrintPage;