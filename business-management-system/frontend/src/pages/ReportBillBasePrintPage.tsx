import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WhatsAppShareButton } from '../components/WhatsAppShareModal';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Maximize2,
  MessageCircle,
  Minus,
  Plus,
  Printer,
  X,
} from 'lucide-react';
import {
  exportReportBillBasePdf,
  exportReportBillBaseXlsx,
  getReportBillBaseOptions,
  runReportBillBase,
} from '../services/api';
import type {
  ReportColumnDef,
  ReportFilterOption,
  ReportGroupSummary,
  ReportItemLine,
  ReportOptionsResponse,
  ReportPageState,
  ReportRow,
  ReportRunRequest,
  ReportRunResponse,
  ReportTotals,
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

const groupLabelOf = (row: ReportRow, field: string): string => {
  const value = (row.groupValues[field] ?? '').trim();
  return value.length > 0 ? value : 'Not recorded';
};

type PrintLine =
  | { kind: 'data'; row: ReportRow }
  | { kind: 'detail'; row: ReportRow; line: ReportItemLine }
  | { kind: 'group'; label: string; count: number; level: number }
  | { kind: 'subtotal'; label: string; totals: ReportTotals; level: number };

interface PrintSheet {
  index: number;
  lines: PrintLine[];
}

// Mirrors the backend PDF row order: bill rows, optional item lines, group
// headings and group subtotals, then one overall total row. Item lines are
// never added into any total - every subtotal comes from the server.
const buildLines = (response: ReportRunResponse): PrintLine[] => {
  const lines: PrintLine[] = [];
  const withItems = response.meta.printItemDetails === true;
  const pushRow = (row: ReportRow) => {
    lines.push({ kind: 'data', row });
    if (withItems) row.itemLines.forEach((line) => lines.push({ kind: 'detail', row, line }));
  };

  if (response.groupBy.length === 0) {
    response.rows.forEach(pushRow);
    return lines;
  }

  const walk = (nodes: ReportGroupSummary[], path: Array<{ field: string; label: string }>, level: number) => {
    nodes.forEach((node) => {
      const nextPath = path.concat([{ field: node.field, label: node.label }]);
      lines.push({ kind: 'group', label: node.label, count: node.count, level });
      if (node.children && node.children.length > 0) {
        walk(node.children, nextPath, level + 1);
      } else {
        response.rows.forEach((row) => {
          if (nextPath.every((entry) => groupLabelOf(row, entry.field) === entry.label)) pushRow(row);
        });
      }
      lines.push({ kind: 'subtotal', label: 'Subtotal - ' + node.label, totals: node.totals, level });
    });
  };

  walk(response.groups, [], 0);
  return lines;
};

const paginate = (lines: PrintLine[], capacity: number): PrintSheet[] => {
  const sheets: PrintSheet[] = [];
  let current: PrintLine[] = [];
  const flush = () => {
    sheets.push({ index: sheets.length, lines: current });
    current = [];
  };
  lines.forEach((line) => {
    if (current.length >= capacity) flush();
    // Never leave a group heading alone at the foot of a sheet.
    if (line.kind === 'group' && current.length > 0 && current.length >= capacity - 2) flush();
    current.push(line);
  });
  if (current.length > 0 || sheets.length === 0) flush();
  return sheets;
};

const totalFor = (totals: ReportTotals, key: string): number | null => {
  switch (key) {
    case 'quantity':
      return totals.quantity;
    case 'taxableAmount':
      return totals.taxableAmount;
    case 'sgstAmount':
      return totals.sgstAmount;
    case 'cgstAmount':
      return totals.cgstAmount;
    case 'igstAmount':
      return totals.igstAmount;
    case 'roundOff':
      return totals.roundOff;
    case 'billAmount':
      return totals.billAmount;
    case 'itemCount':
      return totals.itemCount;
    case 'documentCount':
      return totals.documentCount;
    default:
      return null;
  }
};

const totalText = (totals: ReportTotals, column: ReportColumnDef): string => {
  const value = totalFor(totals, column.key);
  if (value === null) return '';
  if (column.type === 'number') return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return money(value);
};

const subtotalSummary = (totals: ReportTotals): string => {
  const parts: string[] = [];
  if (totals.quantity !== null) parts.push('Qty ' + totals.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
  parts.push('Amount ' + money(totals.billAmount));
  return parts.join('   |   ');
};

export const ReportBillBasePrintPage: React.FC = () => {
  const navigate = useNavigate();
  const stored = useMemo(readState, []);

  const [options, setOptions] = useState<ReportOptionsResponse | null>(null);
  const [response, setResponse] = useState<ReportRunResponse | null>(stored ? stored.response : null);
  const [request] = useState<ReportRunRequest | null>(stored ? stored.request : null);
  const [landscape, setLandscape] = useState(stored ? stored.landscape : false);
  const [pageIndex, setPageIndex] = useState(0);
  // Phase 15.2 - on-screen zoom / fit-to-page for the A4 preview. Printing always
  // uses the real A4 page, so the zoom only affects the grey workspace.
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
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
  const rows = response ? response.rows : [];
  const withItems = response ? response.meta.printItemDetails : false;
  const capacity = withItems ? (landscape ? 16 : 22) : landscape ? 24 : 36;
  const lines = useMemo(() => (response ? buildLines(response) : []), [response]);
  const sheets = useMemo(() => paginate(lines, capacity), [lines, capacity]);
  const truncated = response ? response.pagination.total > rows.length : false;
  const safeIndex = Math.min(pageIndex, Math.max(0, sheets.length - 1));
  const currentSheet = sheets[safeIndex];

  useEffect(() => {
    setPageIndex(0);
  }, [landscape]);

  const handleExportXlsx = useCallback(async () => {
    if (!request || exportingXlsx) return;
    setExportingXlsx(true);
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
      setExportingXlsx(false);
    }
  }, [request, exportingXlsx]);

  const handleExportPdf = useCallback(async () => {
    if (!request || exportingPdf) return;
    setExportingPdf(true);
    setError(null);
    try {
      const result = await exportReportBillBasePdf({
        ...request,
        page: 1,
        pageSize: 0,
        pdfOrientation: landscape ? 'landscape' : 'portrait',
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the PDF.');
    } finally {
      setExportingPdf(false);
    }
  }, [request, landscape, exportingPdf]);

  const shareWhatsApp = useCallback(() => {
    if (!response) return;
    const grand =
      response.totals.grandTotalAllowed && response.totals.grandTotal !== null
        ? money(response.totals.grandTotal)
        : 'not printed';
    const text = [
      response.meta.reportTitle,
      response.meta.companyName,
      'Period: ' + response.meta.dateFrom + ' to ' + response.meta.dateTo,
      'Documents: ' + response.pagination.total,
      'Grand total: ' + grand,
      'Open SHIVAM ENTERPRISE BMS to download the PDF or Excel file, then attach it manually in WhatsApp.',
    ].join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  }, [response]);

  const pageCss = [
    '@page { size: A4 ' + (landscape ? 'landscape' : 'portrait') + '; margin: 8mm; }',
    '@media print {',
    '  .no-print { display: none !important; }',
    '  .print-workspace, .print-scroll { height: auto !important; max-height: none !important; overflow: visible !important; background: #ffffff !important; padding: 0 !important; }',
    '  .print-sheet { box-shadow: none !important; margin: 0 !important; border: none !important; width: auto !important; min-height: 0 !important; padding: 0 !important; page-break-after: always; break-after: page; }',
    '  .print-sheet:last-child { page-break-after: auto; break-after: auto; }',
    '  body { background: #ffffff !important; }',
    '}',
  ].join('\n');

  if (!request || !response) {
    return (
      <div className="min-h-screen bg-[#8b918d] flex items-center justify-center text-xs text-slate-700">
        <div className="bg-white border border-[#c9a227] rounded p-4 text-center">
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
  const sheetWidthPx = landscape ? 1122 : 794; // A4 at 96 dpi
  const fitZoom =
    viewportWidth > 0 ? Math.min(1, Math.max(0.4, (viewportWidth - 32) / sheetWidthPx)) : 1;
  const effectiveZoom = fitMode ? fitZoom : zoom;
  const zoomPercent = Math.round(effectiveZoom * 100);
  // Phase 15.2 - stepping always starts from the zoom the user currently sees,
  // so Zoom out right after Fit shrinks the fitted page instead of jumping to a
  // stale manual level.
  const stepZoom = (delta: number) => {
    setFitMode(false);
    setZoom(Math.min(2, Math.max(0.4, Math.round((effectiveZoom + delta) * 100) / 100)));
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => setViewportWidth(element.clientWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const alignClass = (column: ReportColumnDef): string =>
    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left';

  const widthTotal = columns.reduce((sum, column) => sum + column.width, 0) || 1;
  const nameColumnKey = columns.some((column) => column.key === 'itemDescription')
    ? null
    : columns.find((column) => column.key === 'billNo')?.key ??
      columns.find((column) => column.key === 'partyName')?.key ??
      null;

  const detailCells = (line: ReportItemLine): string[] =>
    columns.map((column) => {
      switch (column.key) {
        case 'itemDescription':
          return '  - ' + (line.itemName || 'Item line ' + line.lineNumber);
        case 'quantity':
          return line.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 });
        case 'unit':
          return line.unit;
        case 'hsnCode':
          return line.hsnCode;
        case 'basicRate':
          return money(line.rate);
        case 'taxableAmount':
          return money(line.taxableAmount);
        case 'quality':
          return line.quality;
        default:
          if (column.key === nameColumnKey) return '  - ' + (line.itemName || 'Item line ' + line.lineNumber);
          return '';
      }
    });

  // Phase 15.2 - the printed sheet must state which master filters produced it,
  // otherwise a narrow report looks like a missing dataset.
  const optionLabel = (list: ReportFilterOption[] | undefined, id: string | null | undefined): string | null => {
    if (!id) return null;
    return list?.find((entry) => entry.value === id)?.label ?? null;
  };
  const filterSummary: string[] = [];
  if (request) {
    const add = (label: string, value: string | null) => {
      if (value) filterSummary.push(label + ': ' + value);
    };
    add('Book', optionLabel(options?.books, request.bookId));
    add('Party Group', optionLabel(options?.partyGroups, request.partyGroupId));
    add('Area', optionLabel(options?.areas, request.areaId));
    add('Party', optionLabel(options?.parties, request.partyId));
    add('Delivery Party', optionLabel(options?.parties, request.deliveryPartyId));
    add('Item', optionLabel(options?.items, request.itemId));
    add('Item Group', optionLabel(options?.itemGroups, request.itemGroup));
    add('Broker', optionLabel(options?.brokers, request.brokerId));
    add('Transporter', optionLabel(options?.transporters, request.transporterId));
    add('Sales Person', optionLabel(options?.salespersons, request.salespersonId));
    add('Vehicle', request.vehicle ?? null);
    add('City', request.partyCity ?? null);
    add('Quality', request.quality ?? null);
  }
  filterSummary.push('Cancelled documents: ' + (request?.includeCancelled ? 'included' : 'excluded'));

  const renderSheet = (printSheet: PrintSheet, printMode: boolean) => (
    <div
      key={printSheet.index}
      className="print-sheet bg-white border border-[#c9a227] shadow-[0_3px_14px_rgba(0,0,0,0.35)]"
      style={
        printMode
          ? undefined
          : {
              width: landscape ? '297mm' : '210mm',
              minHeight: landscape ? '210mm' : '297mm',
              padding: '10mm',
            }
      }
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-700 pb-1 mb-1">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">{options ? options.company.name : response.meta.companyName}</p>
          {options && (
            <>
              <p className="text-[8px] leading-tight text-slate-700">
                {[options.company.address, options.company.city, options.company.state].filter((part) => part && part.trim() !== '').join(', ')}
              </p>
              <p className="text-[8px] leading-tight text-slate-700">
                {options.company.phone ? 'Phone: ' + options.company.phone : 'Phone not recorded'}
                {'  |  '}
                {options.company.gstin ? 'GSTIN: ' + options.company.gstin : 'GSTIN not recorded'}
              </p>
            </>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] font-bold leading-tight">FY {response.meta.financialYear}</p>
          <p className="text-[8px] leading-tight text-slate-700">From: {response.meta.dateFrom}</p>
          <p className="text-[8px] leading-tight text-slate-700">To: {response.meta.dateTo}</p>
          <p className="text-[8px] leading-tight font-semibold">Page {printSheet.index + 1} of {sheets.length}</p>
        </div>
      </div>

      <div className="text-center mb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide leading-tight">{response.meta.reportTitle}</p>
        <p className="text-[8px] leading-tight text-slate-700">
          {response.meta.modeLabel} - {response.meta.detailMode === 'DETAIL' ? 'Detail' : 'Summary'}
        </p>
      </div>

      <p className="text-[7.5px] leading-tight text-slate-700 border-b border-slate-300 pb-[2px] mb-1 break-words">
        {filterSummary.join('  |  ')}
      </p>

      <table className="w-full border-collapse table-fixed" style={{ fontSize: landscape ? '7px' : '7.5px' }}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: (column.width / widthTotal) * 100 + '%' }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-slate-200">
            {columns.map((column) => (
              <th key={column.key} className={'border border-slate-500 px-0.5 py-[1px] font-bold leading-tight break-words ' + alignClass(column)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {printSheet.lines.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, columns.length)} className="border border-slate-400 px-2 py-3 text-center text-slate-600">
                No document matches the selected filters.
              </td>
            </tr>
          )}
          {printSheet.lines.map((line, lineIndex) => {
            if (line.kind === 'group') {
              return (
                <tr key={'g-' + printSheet.index + '-' + lineIndex} className="bg-[#e8efec] font-bold">
                  <td
                    colSpan={Math.max(1, columns.length)}
                    className="border border-slate-500 px-1 py-[1px] leading-tight"
                    style={{ paddingLeft: 4 + line.level * 10 }}
                  >
                    {line.label} ({line.count})
                  </td>
                </tr>
              );
            }
            if (line.kind === 'subtotal') {
              return (
                <tr key={'s-' + printSheet.index + '-' + lineIndex} className="bg-[#f4f8f6] font-semibold text-slate-700">
                  <td colSpan={Math.max(1, columns.length)} className="border border-slate-400 px-1 py-[1px] leading-tight text-right">
                    <span className="float-left" style={{ paddingLeft: line.level * 10 }}>{line.label}</span>
                    {subtotalSummary(line.totals)}
                  </td>
                </tr>
              );
            }
            if (line.kind === 'detail') {
              return (
                <tr key={'d-' + line.row.key + '-' + line.line.lineNumber} className="bg-[#f7fbf9] text-slate-700">
                  {detailCells(line.line).map((value, columnIndex) => (
                    <td
                      key={columns[columnIndex].key}
                      className={'border border-slate-300 px-0.5 py-[1px] leading-tight break-words ' + alignClass(columns[columnIndex])}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            }
            return (
              <tr key={'r-' + line.row.key} className={lineIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {columns.map((column) => (
                  <td key={column.key} className={'border border-slate-400 px-0.5 py-[1px] leading-tight break-words ' + alignClass(column)}>
                    {formatCell(line.row.values[column.key], column)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        {printSheet.index === sheets.length - 1 && (
          <tfoot>
            <tr className="bg-slate-200 font-bold">
              {columns.map((column, columnIndex) => (
                <td key={column.key} className={'border border-slate-500 px-0.5 py-[1px] leading-tight ' + alignClass(column)}>
                  {columnIndex === 0 ? 'TOTAL' : totalText(response.totals.all, column)}
                </td>
              ))}
            </tr>
            <tr className="bg-slate-300 font-bold">
              <td colSpan={Math.max(1, columns.length)} className="border border-slate-600 px-1 py-[1px] leading-tight text-right">
                {response.totals.grandTotalAllowed && response.totals.grandTotal !== null
                  ? 'Grand Total Bill Amount: ' + money(response.totals.grandTotal)
                  : 'Grand total not printed - ' + response.totals.grandTotalReason}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      <div className="mt-1 flex items-end justify-between gap-2 text-[7px] text-slate-600">
        <span className="truncate">
          {response.meta.sourceLabels.join(' + ')}
          {response.meta.rateColumn ? '  |  Rate: ' + response.meta.rateColumn : ''}
        </span>
        <span className="whitespace-nowrap">
          Page {printSheet.index + 1} of {sheets.length}
        </span>
      </div>
    </div>
  );
  return (
    <div className="print-workspace h-full max-h-full min-h-0 overflow-hidden bg-[#8b918d] text-slate-900 text-xs flex flex-col">
      <style>{pageCss}</style>

      <div className="no-print shrink-0 bg-[#1f4842] text-white px-2 py-1 flex flex-wrap items-center gap-1 shadow z-30">
        <Printer className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="font-bold uppercase tracking-wide text-[11px] truncate">A4 Print Preview - {response.meta.reportName}</span>
        <span className="bg-[#173733] text-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-mono shrink-0">
          {sheets.length} sheet{sheets.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <WhatsAppShareButton
            documentType="REPORT_BILL_BASE"
            documentId="bill-base-report"
            documentNumber={response.meta.reportName}
            reportRequest={request ? ({ ...request } as unknown as Record<string, unknown>) : undefined}
            className="h-6 px-2 rounded bg-[#128c7e] hover:bg-[#0f7a6d] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => window.print()}
            className="h-6 px-2 rounded bg-[#3b6ea5] hover:bg-[#2f5a87] text-white font-bold flex items-center gap-1 cursor-pointer"
            title="Open the browser print dialog"
          >
            <Printer className="w-3 h-3" /> Print
          </button>
          <button
            type="button"
            onClick={() => void handleExportPdf()}
            disabled={exportingPdf}
            className="h-6 px-2 rounded bg-[#b3261e] hover:bg-[#8f1d17] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
            title="Download the genuine server-generated PDF"
          >
            {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Save / Download
          </button>
          <span className="w-px h-5 bg-white/25 mx-0.5" />
          <button
            type="button"
            onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeIndex <= 0}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#173733] hover:bg-[#0f2a27] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[10px] px-1 whitespace-nowrap">
            {safeIndex + 1} of {sheets.length}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex((prev) => Math.min(sheets.length - 1, prev + 1))}
            disabled={safeIndex >= sheets.length - 1}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#173733] hover:bg-[#0f2a27] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <span className="w-px h-5 bg-white/25 mx-0.5" />
          <button
            type="button"
            onClick={() => stepZoom(-0.1)}
            disabled={effectiveZoom <= 0.4}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#173733] hover:bg-[#0f2a27] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[10px] px-0.5 w-9 text-center whitespace-nowrap">{zoomPercent}%</span>
          <button
            type="button"
            onClick={() => stepZoom(0.1)}
            disabled={effectiveZoom >= 2}
            className="w-6 h-6 flex items-center justify-center rounded bg-[#173733] hover:bg-[#0f2a27] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFitMode(true)}
            className={
              'h-6 px-1.5 rounded border font-bold flex items-center gap-1 cursor-pointer ' +
              (fitMode
                ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100'
                : 'border-emerald-300/60 bg-[#173733] text-emerald-100 hover:bg-[#0f2a27]')
            }
            title="Fit the whole A4 width into the workspace"
          >
            <Maximize2 className="w-3 h-3" /> Fit
          </button>
          <span className="w-px h-5 bg-white/25 mx-0.5" />
          <button
            type="button"
            onClick={() => setLandscape((prev) => !prev)}
            className="h-6 px-2 rounded border border-emerald-300/60 bg-[#173733] text-emerald-100 font-bold cursor-pointer hover:bg-[#0f2a27]"
            title="Switch the A4 page orientation"
          >
            {landscape ? 'Landscape' : 'Portrait'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-6 h-6 flex items-center justify-center bg-[#eb5757] hover:bg-red-600 rounded cursor-pointer"
            title="Close report"
            aria-label="Close report"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="no-print shrink-0 bg-[#eef5f2] border-b border-[#789d93] px-2 py-0.5 text-[9px] text-slate-700">
        Print opens the browser dialog - choose <span className="font-bold">Save as PDF</span> there. The PDF button downloads the genuine server-generated PDF.
      </div>

      {(truncated || loading || error) && (
        <div className="no-print shrink-0 bg-[#eef5f2] border-b border-[#789d93] px-2 py-1 space-y-0.5">
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
      )}

      <div className="no-print sm:hidden shrink-0 bg-[#dfe9e5] border-b border-[#789d93] px-2 py-1 flex items-center gap-1">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
          title="Share the report title and date range on WhatsApp. No file is attached automatically."
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-700" /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          disabled={exportingPdf}
          className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-red-700" />} PDF
        </button>
        <button
          type="button"
          onClick={() => void handleExportXlsx()}
          disabled={exportingXlsx}
          className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          {exportingXlsx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-[#107c41]" />} Excel
        </button>
      </div>

      <div ref={scrollRef} className="print-scroll flex-1 min-h-0 overflow-auto p-3 sm:p-5">
        <div className="print:hidden flex justify-center">
          <div style={{ zoom: effectiveZoom } as React.CSSProperties}>
            {currentSheet && renderSheet(currentSheet, false)}
          </div>
        </div>
        <div className="hidden print:block">
          {sheets.map((printSheet) => renderSheet(printSheet, true))}
        </div>
      </div>

      <div className="no-print hidden sm:flex fixed left-2 top-1/2 -translate-y-1/2 z-20 flex-col gap-1">
        <button
          type="button"
          onClick={shareWhatsApp}
          className="w-14 py-1.5 rounded border border-white/30 bg-[#2b4a45] hover:bg-[#204741] text-white flex flex-col items-center gap-0.5 cursor-pointer shadow"
          title="Share the report title and date range on WhatsApp. No file is attached automatically."
        >
          <MessageCircle className="w-4 h-4 text-emerald-300" />
          <span className="text-[8px] font-bold uppercase tracking-wide">WhatsApp</span>
        </button>
        <button
          type="button"
          onClick={() => void handleExportPdf()}
          disabled={exportingPdf}
          className="w-14 py-1.5 rounded border border-white/30 bg-[#2b4a45] hover:bg-[#204741] text-white flex flex-col items-center gap-0.5 cursor-pointer shadow disabled:opacity-50"
          title="Download the genuine server-generated PDF"
        >
          {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin text-red-300" /> : <FileText className="w-4 h-4 text-red-300" />}
          <span className="text-[8px] font-bold uppercase tracking-wide">PDF</span>
        </button>
        <button
          type="button"
          onClick={() => void handleExportXlsx()}
          disabled={exportingXlsx}
          className="w-14 py-1.5 rounded border border-white/30 bg-[#2b4a45] hover:bg-[#204741] text-white flex flex-col items-center gap-0.5 cursor-pointer shadow disabled:opacity-50"
          title="Download the genuine .xlsx workbook"
        >
          {exportingXlsx ? <Loader2 className="w-4 h-4 animate-spin text-lime-300" /> : <FileSpreadsheet className="w-4 h-4 text-lime-300" />}
          <span className="text-[8px] font-bold uppercase tracking-wide">Excel</span>
        </button>
      </div>
    </div>
  );
};

export default ReportBillBasePrintPage;