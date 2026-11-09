import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Download, Loader2, Printer, X } from 'lucide-react';
import { exportReportBillBaseXlsx, getReportBillBaseOptions, runReportBillBase } from '../services/api';
import type {
  ReportColumnDef,
  ReportItemLine,
  ReportOptionsResponse,
  ReportPageState,
  ReportRow,
  ReportRunRequest,
  ReportRunResponse,
} from '../types/reports';

const STATE_KEY = 'bms_report_bill_base_state';
const MAX_PRINT_ROWS = 500;

const money = (value: number): string =>
  value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCell = (value: string | number | null | undefined, column: ReportColumnDef): string => {
  if (value === null || value === undefined || value === '') return '';
  if (column.type === 'currency') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? money(numeric) : String(value);
  }
  if (column.type === 'number') {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(value);
  }
  if (column.type === 'date') {
    const text = String(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : text;
  }
  return String(value);
};

const readState = (): ReportPageState | null => {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportPageState;
    if (!parsed || !parsed.request || !parsed.response) return null;
    return parsed;
  } catch {
    return null;
  }
};

interface PrintBlock {
  row: ReportRow;
  lines: ReportItemLine[];
}

interface PrintSheet {
  index: number;
  blocks: PrintBlock[];
}

// Deterministic pagination: a fixed number of content lines per A4 sheet, where
// every document row costs one line and every item line costs one more when the
// item detail option is enabled.
const paginate = (rows: ReportRow[], capacity: number, withItems: boolean): PrintSheet[] => {
  const sheets: PrintSheet[] = [];
  let current: PrintBlock[] = [];
  let used = 0;
  rows.forEach((row) => {
    const lines = withItems ? row.itemLines : [];
    const cost = 1 + lines.length;
    if (current.length > 0 && used + cost > capacity) {
      sheets.push({ index: sheets.length, blocks: current });
      current = [];
      used = 0;
    }
    current.push({ row, lines });
    used += cost;
  });
  if (current.length > 0 || sheets.length === 0) sheets.push({ index: sheets.length, blocks: current });
  return sheets;
};

export const ReportBillBasePrintPage: React.FC = () => {
  const navigate = useNavigate();
  const stored = useMemo(readState, []);

  const [options, setOptions] = useState<ReportOptionsResponse | null>(null);
  const [response, setResponse] = useState<ReportRunResponse | null>(stored ? stored.response : null);
  const [request] = useState<ReportRunRequest | null>(stored ? stored.request : null);
  const [landscape, setLandscape] = useState(stored ? stored.landscape : false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stored) navigate('/reports/sales-purchase/bill-base', { replace: true });
  }, [stored, navigate]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getReportBillBaseOptions();
        if (!cancelled) setOptions(data);
      } catch {
        if (!cancelled) setOptions(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!stored) return;
    let cancelled = false;
    const widen = async () => {
      const total = stored.response.pagination.total;
      if (total <= stored.response.rows.length) return;
      setLoading(true);
      try {
        const wider = await runReportBillBase({
          ...stored.request,
          page: 1,
          pageSize: Math.min(MAX_PRINT_ROWS, Math.max(total, 100)),
        });
        if (cancelled) return;
        setResponse(wider);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load every row for printing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void widen();
    return () => {
      cancelled = true;
    };
  }, [stored]);

  const columns = response ? response.columns : [];
  const withItems = response ? response.meta.printItemDetails : false;
  const rows = response ? response.rows : [];
  const capacity = withItems ? (landscape ? 16 : 22) : landscape ? 24 : 36;
  const sheets = useMemo(() => paginate(rows, capacity, withItems), [rows, capacity, withItems]);
  const truncated = response ? response.pagination.total > rows.length : false;

  const handleExport = useCallback(async () => {
    if (!request) return;
    setExporting(true);
    setError(null);
    try {
      const result = await exportReportBillBaseXlsx({ ...request, page: 1 });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the report to Excel.');
    } finally {
      setExporting(false);
    }
  }, [request]);

  const printNow = () => window.print();

  const pageCss =
    '@page { size: A4 ' +
    (landscape ? 'landscape' : 'portrait') +
    '; margin: 8mm; }\n' +
    '@media print { .no-print { display: none !important; } .print-sheet { box-shadow: none !important; margin: 0 !important; border: none !important; page-break-after: always; break-after: page; } .print-sheet:last-of-type { page-break-after: auto; break-after: auto; } body { background: #ffffff !important; } }\n';

  if (!request || !response) {
    return (
      <div className="min-h-screen bg-[#c2dcd5] flex items-center justify-center text-xs text-slate-700">
        <div className="bg-white border border-[#789d93] rounded p-4 text-center">
          <p className="font-bold">No report result is loaded.</p>
          <button
            type="button"
            onClick={() => navigate('/reports/sales-purchase/bill-base')}
            className="mt-3 px-3 py-1 bg-[#2c5f57] text-white rounded font-bold cursor-pointer"
          >
            Open Report Configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#8fada6] text-slate-900 text-xs">
      <style>{pageCss}</style>

      <div className="no-print sticky top-0 z-20 bg-[#2c5f57] text-white px-3 py-1.5 flex items-center gap-2 shadow">
        <button
          type="button"
          onClick={() => navigate('/reports/sales-purchase/bill-base/results')}
          className="w-5 h-5 flex items-center justify-center bg-[#1f4842] hover:bg-[#173733] rounded cursor-pointer"
          title="Back to results"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <Printer className="w-4 h-4 text-emerald-300" />
        <span className="font-bold uppercase tracking-wide">A4 Print Preview - {response.meta.reportName}</span>
        <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded font-mono">
          {sheets.length} sheet{sheets.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLandscape((prev) => !prev)}
            className="h-6 px-2 rounded border border-emerald-300/60 bg-[#1f4842] text-emerald-100 font-bold cursor-pointer hover:bg-[#173733]"
            title="Switch the A4 page orientation"
          >
            {landscape ? 'Landscape' : 'Portrait'}
          </button>
          <button
            type="button"
            onClick={printNow}
            className="h-6 px-2 rounded bg-[#3b6ea5] hover:bg-[#2f5a87] text-white font-bold flex items-center gap-1 cursor-pointer"
            title="Open the browser print dialog. Choose 'Save as PDF' as the destination to produce the PDF."
          >
            <Printer className="w-3 h-3" /> Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="h-6 px-2 rounded bg-[#107c41] hover:bg-[#0c6334] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
            title="Download a real .xlsx workbook containing every row of this report."
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Excel
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-6 h-6 flex items-center justify-center bg-[#eb5757] hover:bg-red-600 rounded cursor-pointer"
            title="Close report"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="no-print bg-[#eef5f2] border-b border-[#789d93] px-3 py-1 space-y-0.5">
        <p className="text-[10px] text-slate-700">
          The PDF action uses the browser print dialog with the destination set to <span className="font-bold">Save as PDF</span>.
          The preview below is the exact sheet layout that will be printed, including page numbers.
        </p>
        {truncated && (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
            <AlertTriangle className="w-3 h-3" />
            This preview prints {rows.length} of {response.pagination.total} documents. Excel export always contains every document.
          </p>
        )}
        {loading && (
          <p className="flex items-center gap-1.5 text-[10px] text-slate-700">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading the remaining documents for printing...
          </p>
        )}
        {error && (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-red-700">
            <AlertTriangle className="w-3 h-3" /> {error}
          </p>
        )}
      </div>

      <div className="p-4 flex flex-col items-center gap-4">
        {sheets.map((sheet) => (
          <div
            key={sheet.index}
            className="print-sheet bg-white shadow-lg border border-slate-300"
            style={{
              width: landscape ? '277mm' : '194mm',
              minHeight: landscape ? '190mm' : '277mm',
              padding: '6mm',
            }}
          >
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-1 mb-1">
              <div>
                <p className="text-[13px] font-bold leading-tight">{options ? options.company.name : response.meta.companyName}</p>
                {options && (
                  <>
                    <p className="text-[8px] leading-tight text-slate-700">
                      {[options.company.address, options.company.city, options.company.state].filter((part) => part && part.trim() !== '').join(', ')}
                    </p>
                    <p className="text-[8px] leading-tight text-slate-700">
                      {options.company.gstin ? 'GSTIN: ' + options.company.gstin : 'GSTIN not recorded'}
                      {options.company.phone ? '  |  Phone: ' + options.company.phone : ''}
                    </p>
                  </>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold leading-tight">{response.meta.reportTitle}</p>
                <p className="text-[8px] leading-tight text-slate-700">{response.meta.formatLabel} - {response.meta.modeLabel}</p>
                <p className="text-[8px] leading-tight text-slate-700">
                  {response.meta.dateFrom} to {response.meta.dateTo}  |  FY {response.meta.financialYear}
                </p>
                <p className="text-[8px] leading-tight font-semibold">
                  Page {sheet.index + 1} of {sheets.length}
                </p>
              </div>
            </div>

            <table className="w-full border-collapse" style={{ fontSize: landscape ? '7px' : '7.5px' }}>
              <thead>
                <tr className="bg-slate-200">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={
                        'border border-slate-500 px-0.5 py-[1px] font-bold leading-tight ' +
                        (column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left')
                      }
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheet.blocks.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, columns.length)} className="border border-slate-400 px-2 py-3 text-center text-slate-600">
                      No document matches the selected filters.
                    </td>
                  </tr>
                )}
                {sheet.blocks.map((block, blockIndex) => (
                  <React.Fragment key={block.row.key + '-' + blockIndex}>
                    <tr className={blockIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={
                            'border border-slate-400 px-0.5 py-[1px] leading-tight ' +
                            (column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left')
                          }
                        >
                          {formatCell(block.row.values[column.key], column)}
                        </td>
                      ))}
                    </tr>
                    {block.lines.length > 0 &&
                      block.lines.map((line) => (
                        <tr key={block.row.key + '-line-' + line.lineNumber} className="bg-[#f7fbf9] text-slate-700">
                          <td className="border border-slate-300 px-0.5 py-[1px] text-center">{line.lineNumber}</td>
                          <td className="border border-slate-300 px-0.5 py-[1px]" colSpan={3}>
                            {line.itemName || 'Item name not recorded'}
                            {line.grade ? ' / ' + line.grade : ''}
                            {line.lotNumber ? ' / Lot ' + line.lotNumber : ''}
                          </td>
                          <td className="border border-slate-300 px-0.5 py-[1px] text-right">
                            {line.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {line.unit}
                          </td>
                          <td className="border border-slate-300 px-0.5 py-[1px] text-right">{money(line.rate)}</td>
                          <td className="border border-slate-300 px-0.5 py-[1px] text-right">{money(line.taxableAmount)}</td>
                          <td className="border border-slate-300 px-0.5 py-[1px]" colSpan={Math.max(1, columns.length - 7)}></td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
              </tbody>
              {sheet.index === sheets.length - 1 && (
                <tfoot>
                  <tr className="bg-slate-300 font-bold">
                    {columns.map((column, columnIndex) => (
                      <td
                        key={column.key}
                        className={
                          'border border-slate-600 px-0.5 py-[1px] leading-tight ' +
                          (column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left')
                        }
                      >
                        {columnIndex === 0
                          ? 'TOTAL'
                          : column.key === 'documentCount'
                          ? response.totals.all.documentCount
                          : column.key === 'itemCount'
                          ? response.totals.all.itemCount
                          : column.key === 'quantity'
                          ? response.totals.all.quantity === null
                            ? ''
                            : response.totals.all.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                          : column.type === 'currency'
                          ? (() => {
                              const value =
                                response.totals.all[
                                  column.key as 'taxableAmount' | 'sgstAmount' | 'cgstAmount' | 'igstAmount' | 'roundOff' | 'billAmount'
                                ];
                              return typeof value === 'number' ? money(value) : '';
                            })()
                          : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>

            <div className="mt-1 flex items-end justify-between text-[7px] text-slate-600">
              <span>
                {response.meta.sourceLabels.join(' + ')}
                {response.meta.rateColumn ? '  |  Rate: ' + response.meta.rateColumn : ''}
              </span>
              <span>
                {response.totals.grandTotalAllowed && response.totals.grandTotal !== null
                  ? 'Grand Total: ' + money(response.totals.grandTotal)
                  : 'Grand total not printed - ' + response.totals.grandTotalReason}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportBillBasePrintPage;
