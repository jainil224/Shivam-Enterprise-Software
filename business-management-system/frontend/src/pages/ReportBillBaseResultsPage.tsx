import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Loader2,
  Printer,
  X,
} from 'lucide-react';
import {
  exportReportBillBasePdf,
  exportReportBillBaseXlsx,
  getReportBillBaseItemDetails,
  runReportBillBase,
} from '../services/api';
import type {
  ReportColumnDef,
  ReportColumnFilter,
  ReportFilterOperator,
  ReportGroupSummary,
  ReportItemLine,
  ReportPageState,
  ReportRow,
  ReportRunRequest,
  ReportRunResponse,
} from '../types/reports';

const STATE_KEY = 'bms_report_bill_base_state';
const GROUPABLE = ['billNo', 'billDate', 'partyName', 'quality', 'bookName', 'partyCity', 'month', 'sourceType', 'purchaseSerial', 'itemGroup'];
const FIELD_LABELS: Record<string, string> = {
  billNo: 'Bill No',
  billDate: 'Bill Date',
  partyName: 'Party Name',
  quality: 'Quality',
  bookName: 'Book',
  partyCity: 'City',
  month: 'Month',
  sourceType: 'Source',
  purchaseSerial: 'Purchase Serial',
  itemGroup: 'Item Group',
};

// Mirrors the backend column catalogue minus srNo, which is assigned after
// filtering and therefore cannot be filtered on.
const FILTERABLE_COLUMN_KEYS = new Set([
  'billDate', 'billNo', 'partyName', 'partyGstin', 'partyCity', 'partyState', 'bookName',
  'sourceType', 'status', 'quality', 'itemGroup', 'itemDescription', 'itemCount', 'quantity',
  'unit', 'hsnCode', 'taxRate', 'basicRate', 'avgRate', 'netRate', 'discountAmount',
  'taxableAmount', 'sgstAmount', 'cgstAmount', 'igstAmount', 'roundOff', 'billAmount',
  'month', 'purchaseSerial',
]);

const OPERATOR_DEFS: Array<{
  value: ReportFilterOperator;
  label: string;
  types: Array<ReportColumnDef['type']>;
}> = [
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'equals', label: 'Equals', types: ['text', 'number', 'currency', 'date'] },
  { value: 'notEquals', label: 'Does not equal', types: ['text', 'number', 'currency'] },
  { value: 'gt', label: 'Greater than', types: ['number', 'currency'] },
  { value: 'gte', label: 'Greater than or equal', types: ['number', 'currency'] },
  { value: 'lt', label: 'Less than', types: ['number', 'currency'] },
  { value: 'lte', label: 'Less than or equal', types: ['number', 'currency'] },
  { value: 'between', label: 'Between', types: ['number', 'currency', 'date'] },
  { value: 'before', label: 'Before', types: ['date'] },
  { value: 'after', label: 'After', types: ['date'] },
  { value: 'empty', label: 'Is empty', types: ['text', 'number', 'currency', 'date'] },
  { value: 'notEmpty', label: 'Is not empty', types: ['text', 'number', 'currency', 'date'] },
];

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

const money = (value: number): string =>
  value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCell = (value: string | number | null | undefined, column: ReportColumnDef): string => {
  if (value === null || value === undefined || value === '') return '-';
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

const totalFor = (totals: ReportRunResponse['totals']['all'], key: string): number | null => {
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

const groupLabelOf = (row: ReportRow, field: string): string => {
  const value = (row.groupValues[field] ?? '').trim();
  return value.length > 0 ? value : 'Not recorded';
};

const describeFilter = (filter: ReportColumnFilter, columns: ReportColumnDef[]): string => {
  const column = columns.find((entry) => entry.key === filter.key);
  const def = OPERATOR_DEFS.find((entry) => entry.value === filter.operator);
  const label = column?.label ?? filter.key;
  const op = (def?.label ?? filter.operator).toLowerCase();
  if (filter.operator === 'empty' || filter.operator === 'notEmpty') return label + ' ' + op;
  if (filter.operator === 'between') {
    return label + ' ' + op + ' ' + String(filter.value ?? '') + ' and ' + String(filter.valueTo ?? '');
  }
  return label + ' ' + op + ' ' + String(filter.value ?? '');
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface GroupNodeProps {
  node: ReportGroupSummary;
  path: Array<{ field: string; label: string }>;
  rows: ReportRow[];
  openKeys: string[];
  onToggle: (key: string) => void;
}

const GroupNode: React.FC<GroupNodeProps> = ({ node, path, rows, openKeys, onToggle }) => {
  const nextPath = path.concat([{ field: node.field, label: node.label }]);
  const open = openKeys.includes(node.key);
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const members = hasChildren
    ? []
    : rows.filter((row) => nextPath.every((entry) => groupLabelOf(row, entry.field) === entry.label));

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 border-b border-slate-100 hover:bg-emerald-50/50"
        style={{ paddingLeft: 8 + node.level * 16 }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.key)}
          disabled={!hasChildren && members.length === 0}
          className="w-4 h-4 flex items-center justify-center text-slate-500 disabled:opacity-20 cursor-pointer"
          title={open ? 'Collapse this group' : 'Expand this group'}
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>
        <span className="font-semibold text-slate-800">{node.label}</span>
        <span className="text-[10px] text-slate-500">({node.count})</span>
        <span className="ml-auto font-mono text-[11px] font-bold text-slate-800">{money(node.totals.billAmount)}</span>
      </div>
      {open && hasChildren &&
        node.children?.map((child) => (
          <GroupNode key={child.key} node={child} path={nextPath} rows={rows} openKeys={openKeys} onToggle={onToggle} />
        ))}
      {open && !hasChildren && (
        <div className="pb-1" style={{ paddingLeft: 8 + (node.level + 1) * 16 }}>
          {members.length === 0 ? (
            <p className="py-1 text-[10px] text-slate-500">
              No document from this group is on the current page. Use the page controls to reach the rest of the dataset.
            </p>
          ) : (
            <>
              <table className="w-full text-[10px] border-collapse">
                <tbody>
                  {members.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100">
                      <td className="px-1 py-0.5 font-semibold text-[#1f4842]">{row.documentNo}</td>
                      <td className="px-1 py-0.5 text-slate-600">{row.documentDate}</td>
                      <td className="px-1 py-0.5 text-slate-700">{row.partyName}</td>
                      <td className="px-1 py-0.5 text-right font-mono text-slate-800">{money(row.billAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {members.length < node.count && (
                <p className="py-0.5 text-[10px] text-slate-500">
                  Showing {members.length} of {node.count} documents in this group from the current page.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const ReportBillBaseResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const stored = useMemo(readState, []);

  const [request, setRequest] = useState<ReportRunRequest | null>(stored ? stored.request : null);
  const [response, setResponse] = useState<ReportRunResponse | null>(stored ? stored.response : null);
  const [layoutName] = useState(stored ? stored.layoutName : 'Standard');
  const [landscape, setLandscape] = useState(stored ? stored.landscape : false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(stored?.request.sortBy ?? null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(stored?.request.sortDir ?? 'asc');
  const [groupBy, setGroupBy] = useState<string[]>(stored?.response.groupBy ?? []);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [itemCache, setItemCache] = useState<Record<string, ReportItemLine[]>>({});
  const [openGroupKeys, setOpenGroupKeys] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [dragField, setDragField] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState(false);

  const [filterKey, setFilterKey] = useState('');
  const [filterOperator, setFilterOperator] = useState<ReportFilterOperator>('contains');
  const [filterValue, setFilterValue] = useState('');
  const [filterValueTo, setFilterValueTo] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);

  useEffect(() => {
    if (!stored) navigate('/reports/sales-purchase/bill-base', { replace: true });
  }, [stored, navigate]);

  const persist = useCallback(
    (nextRequest: ReportRunRequest, nextResponse: ReportRunResponse) => {
      const state: ReportPageState = { request: nextRequest, response: nextResponse, layoutName, landscape };
      try {
        sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch {
        /* sessionStorage unavailable: state stays in memory */
      }
    },
    [layoutName, landscape]
  );

  const reload = useCallback(
    async (changes: Partial<ReportRunRequest>) => {
      if (!request) return;
      const nextRequest: ReportRunRequest = { ...request, ...changes };
      setLoading(true);
      setError(null);
      try {
        const nextResponse = await runReportBillBase(nextRequest);
        setRequest(nextRequest);
        setResponse(nextResponse);
        setGroupBy(nextResponse.groupBy);
        setSortBy(nextRequest.sortBy ?? null);
        setSortDir(nextRequest.sortDir ?? 'asc');
        setExpanded([]);
        setOpenGroupKeys([]);
        persist(nextRequest, nextResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reload the report.');
      } finally {
        setLoading(false);
      }
    },
    [request, persist]
  );

  const columnDefs = response ? response.columns : [];
  const rows = response ? response.rows : [];

  const filterableColumns = useMemo(
    () => columnDefs.filter((column) => FILTERABLE_COLUMN_KEYS.has(column.key)),
    [columnDefs]
  );

  const selectedFilterColumn = filterableColumns.find((column) => column.key === filterKey);
  const operatorOptions = selectedFilterColumn
    ? OPERATOR_DEFS.filter((entry) => entry.types.includes(selectedFilterColumn.type))
    : OPERATOR_DEFS;

  const activeFilters: ReportColumnFilter[] = response?.meta.columnFilters ?? [];

  const toggleExpand = useCallback(
    async (row: ReportRow) => {
      if (expanded.includes(row.key)) {
        setExpanded((prev) => prev.filter((entry) => entry !== row.key));
        return;
      }
      setExpanded((prev) => [...prev, row.key]);
      if (itemCache[row.key]) return;
      try {
        const details = await getReportBillBaseItemDetails(row.sourceType, row.sourceId);
        setItemCache((prev) => ({ ...prev, [row.key]: details.itemLines }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load item details for ' + row.documentNo + '.');
      }
    },
    [expanded, itemCache]
  );

  const applySort = (key: string) => {
    const nextDir: 'asc' | 'desc' = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortBy(key);
    setSortDir(nextDir);
    void reload({ sortBy: key, sortDir: nextDir, page: 1 });
  };

  const changeGrouping = (nextGroupBy: string[]) => {
    setGroupBy(nextGroupBy);
    void reload({ groupBy: nextGroupBy, page: 1 });
  };

  const addGroupField = (field: string) => {
    if (!field || groupBy.includes(field)) return;
    changeGrouping([...groupBy, field]);
  };

  const moveGroupField = (field: string, offset: number) => {
    const index = groupBy.indexOf(field);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= groupBy.length) return;
    const next = [...groupBy];
    next.splice(index, 1);
    next.splice(target, 0, field);
    changeGrouping(next);
  };

  const reorderGroupField = (field: string, targetIndex: number) => {
    const index = groupBy.indexOf(field);
    if (index < 0 || targetIndex < 0 || targetIndex >= groupBy.length || index === targetIndex) return;
    const next = [...groupBy];
    next.splice(index, 1);
    next.splice(targetIndex, 0, field);
    changeGrouping(next);
  };

  const handleGroupDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverZone(false);
    const payload = event.dataTransfer.getData('text/plain') || dragField || '';
    setDragField(null);
    if (payload.startsWith('chip:')) {
      reorderGroupField(payload.slice(5), groupBy.length - 1);
      return;
    }
    addGroupField(payload);
  };

  const applyColumnFilter = () => {
    if (!selectedFilterColumn) {
      setFilterError('Choose a column to filter.');
      return;
    }
    const def = OPERATOR_DEFS.find((entry) => entry.value === filterOperator);
    const needsValue = filterOperator !== 'empty' && filterOperator !== 'notEmpty';
    if (needsValue && filterValue.trim() === '') {
      setFilterError('Enter a value for "' + (def?.label ?? filterOperator) + '".');
      return;
    }
    if (filterOperator === 'between' && filterValueTo.trim() === '') {
      setFilterError('Enter the second value for "Between".');
      return;
    }
    const next: ReportColumnFilter[] = activeFilters
      .filter((entry) => entry.key !== selectedFilterColumn.key)
      .concat([
        {
          key: selectedFilterColumn.key,
          operator: filterOperator,
          value: needsValue ? filterValue.trim() : null,
          valueTo: filterOperator === 'between' ? filterValueTo.trim() : null,
        },
      ]);
    setFilterError(null);
    setFilterValue('');
    setFilterValueTo('');
    void reload({ columnFilters: next, page: 1 });
  };

  const removeColumnFilter = (key: string) => {
    void reload({ columnFilters: activeFilters.filter((entry) => entry.key !== key), page: 1 });
  };

  const clearColumnFilters = () => {
    if (activeFilters.length === 0) return;
    void reload({ columnFilters: [], page: 1 });
  };

  const goToPage = (page: number) => {
    if (!response) return;
    if (page < 1 || page > response.pagination.totalPages) return;
    void reload({ page });
  };

  const handleExport = useCallback(async () => {
    if (!request) return;
    setExporting(true);
    setError(null);
    try {
      const result = await exportReportBillBaseXlsx({ ...request, page: 1, pageSize: 0 });
      downloadBlob(result.blob, result.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export the report to Excel.');
    } finally {
      setExporting(false);
    }
  }, [request]);

  const handlePdfExport = useCallback(async () => {
    if (!request) return;
    setExportingPdf(true);
    setError(null);
    try {
      const result = await exportReportBillBasePdf({
        ...request,
        page: 1,
        pageSize: 0,
        pdfOrientation: landscape ? 'landscape' : 'portrait',
      });
      downloadBlob(result.blob, result.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the PDF.');
    } finally {
      setExportingPdf(false);
    }
  }, [request, landscape]);

  const openPrint = useCallback(() => {
    if (!request || !response) return;
    const state: ReportPageState = { request, response, layoutName, landscape };
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* sessionStorage unavailable: the print page re-reads the last saved state */
    }
    navigate('/reports/sales-purchase/bill-base/print');
  }, [request, response, layoutName, landscape, navigate]);

  const toggleLandscape = () => {
    const next = !landscape;
    setLandscape(next);
    if (request && response) {
      const state: ReportPageState = { request, response, layoutName, landscape: next };
      try {
        sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch {
        /* ignore */
      }
    }
  };

  const toggleGroupKey = (key: string) => {
    setOpenGroupKeys((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const expandAllGroups = () => {
    if (!response) return;
    const keys: string[] = [];
    const walk = (nodes: ReportGroupSummary[]) => {
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children && node.children.length > 0) walk(node.children);
      });
    };
    walk(response.groups);
    setOpenGroupKeys(keys);
  };

  const activeSourceCount = response ? response.totals.bySource.length : 0;

  if (!request || !response) {
    return (
      <div className="min-h-screen bg-[#c2dcd5] flex items-center justify-center text-xs text-slate-700">
        <div className="bg-white border border-[#789d93] rounded p-4 text-center">
          <p className="font-bold">No report result is loaded.</p>
          <p className="mt-1 text-slate-600">Open the report configuration screen and press Preview.</p>
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
    <div className="min-h-screen bg-[#c2dcd5] text-slate-800 flex flex-col font-sans select-none text-xs">
      <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/reports/sales-purchase/bill-base')}
            className="w-5 h-5 flex items-center justify-center bg-[#1f4842] hover:bg-[#173733] rounded cursor-pointer"
            title="Back to report configuration (Esc)"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="font-bold uppercase tracking-wide truncate">
            Sale/Pur Bill Base - {response.meta.formatLabel}
          </span>
          <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded font-mono shrink-0">
            {response.meta.dateFrom} to {response.meta.dateTo}
          </span>
          <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded shrink-0">
            {response.meta.modeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting || response.rowCount === 0}
            title={response.rowCount === 0 ? 'There are no rows to export.' : 'Download a real .xlsx workbook built from the complete filtered dataset.'}
            className="h-6 px-2 rounded bg-[#107c41] hover:bg-[#0c6334] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Excel
          </button>
          <button
            type="button"
            onClick={() => void handlePdfExport()}
            disabled={exportingPdf || response.rowCount === 0}
            title={response.rowCount === 0 ? 'There are no rows to export.' : 'Download a genuine multi-page .pdf generated on the server from the complete filtered dataset.'}
            className="h-6 px-2 rounded bg-[#b3261e] hover:bg-[#8f1d17] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
            Download PDF
          </button>
          <button
            type="button"
            onClick={openPrint}
            disabled={response.rowCount === 0}
            title={response.rowCount === 0 ? 'There are no rows to print.' : 'Open the A4 print preview (browser Print / Save as PDF).'}
            className="h-6 px-2 rounded bg-[#3b6ea5] hover:bg-[#2f5a87] text-white font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3 h-3" />
            Print / PDF
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

      <div className="flex-1 flex flex-col min-h-0">
        {response.warnings.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 space-y-0.5">
            {response.warnings.map((warning) => (
              <p key={warning} className="flex items-start gap-1.5 text-[11px] text-amber-900">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{warning}</span>
              </p>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-3 py-1 flex items-start gap-1.5 text-[11px] text-red-800">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        <div className="bg-[#eef5f2] border-b border-[#789d93] px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600">Group By</span>
          <div
            onDragOver={(event) => {
              if (!dragField) return;
              event.preventDefault();
              setDragOverZone(true);
            }}
            onDragLeave={() => setDragOverZone(false)}
            onDrop={handleGroupDrop}
            className={
              'flex items-center gap-1 flex-wrap min-h-7 px-1.5 py-0.5 rounded border border-dashed ' +
              (dragOverZone ? 'border-[#2c5f57] bg-emerald-100' : 'border-[#9dbdb5] bg-white/70')
            }
            title="Drop an eligible column header here to group the report"
          >
            {groupBy.length === 0 && (
              <span className="text-[10px] text-slate-500 italic">Drag a column here to group the report</span>
            )}
            {groupBy.map((field, index) => (
              <span
                key={field}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', 'chip:' + field);
                  setDragField('chip:' + field);
                }}
                onDragEnd={() => setDragField(null)}
                onDragOver={(event) => {
                  if (!dragField) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const payload = event.dataTransfer.getData('text/plain') || dragField || '';
                  setDragField(null);
                  setDragOverZone(false);
                  if (payload.startsWith('chip:')) reorderGroupField(payload.slice(5), index);
                  else addGroupField(payload);
                }}
                className="flex items-center gap-1 bg-white border border-[#789d93] rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700 cursor-grab"
              >
                <GripVertical className="w-2.5 h-2.5 text-slate-400" />
                {index + 1}. {columnDefs.find((entry) => entry.key === field)?.label ?? FIELD_LABELS[field] ?? field}
                <button type="button" onClick={() => moveGroupField(field, -1)} disabled={index === 0} className="text-slate-500 disabled:opacity-25 cursor-pointer" title="Move up">
                  <ChevronRight className="w-2.5 h-2.5 -rotate-90" />
                </button>
                <button type="button" onClick={() => moveGroupField(field, 1)} disabled={index === groupBy.length - 1} className="text-slate-500 disabled:opacity-25 cursor-pointer" title="Move down">
                  <ChevronRight className="w-2.5 h-2.5 rotate-90" />
                </button>
                <button type="button" onClick={() => changeGrouping(groupBy.filter((entry) => entry !== field))} className="text-red-600 cursor-pointer" title="Remove grouping">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {groupBy.length > 0 && (
              <button
                type="button"
                onClick={() => changeGrouping([])}
                className="ml-1 text-[10px] font-bold text-[#2c5f57] hover:underline cursor-pointer"
                title="Remove every grouping level"
              >
                Clear all
              </button>
            )}
          </div>
          <select
            value=""
            onChange={(event) => {
              addGroupField(event.target.value);
              event.target.value = '';
            }}
            className="h-6 px-1 bg-white border border-[#789d93] rounded text-[10px] text-slate-700 cursor-pointer"
            title="Add a grouping level - the report is re-run on the server so group totals stay dataset-wide."
          >
            <option value="">Add grouping...</option>
            {GROUPABLE.filter((field) => !groupBy.includes(field)).map((field) => (
              <option key={field} value={field}>
                {columnDefs.find((entry) => entry.key === field)?.label ?? FIELD_LABELS[field] ?? field}
              </option>
            ))}
          </select>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-slate-600">
            <span className="font-mono">{response.rowCount} documents match</span>
            <span className="text-slate-300">|</span>
            <span className="font-mono">{rows.length} on this page</span>
            <button type="button" onClick={toggleLandscape} className="px-1.5 py-0.5 border border-[#789d93] bg-white rounded font-bold text-slate-700 hover:bg-slate-100 cursor-pointer" title="Orientation is applied to the print preview and the direct PDF export.">
              {landscape ? 'Landscape' : 'Portrait'}
            </button>
          </span>
        </div>

        <div className="bg-[#f7fbf9] border-b border-[#789d93] px-2.5 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600">Column Filters</span>
          <select
            value={filterKey}
            onChange={(event) => {
              const key = event.target.value;
              setFilterKey(key);
              const column = filterableColumns.find((entry) => entry.key === key);
              const first = column ? OPERATOR_DEFS.find((entry) => entry.types.includes(column.type)) : undefined;
              setFilterOperator(first ? first.value : 'contains');
              setFilterValue('');
              setFilterValueTo('');
              setFilterError(null);
            }}
            className="h-6 px-1 bg-white border border-[#789d93] rounded text-[10px] text-slate-700 cursor-pointer"
            title="Column filters are applied by the server to the complete matching dataset, not just the visible page."
          >
            <option value="">Select column...</option>
            {filterableColumns.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
          <select
            value={filterOperator}
            onChange={(event) => setFilterOperator(event.target.value as ReportFilterOperator)}
            disabled={!selectedFilterColumn}
            className="h-6 px-1 bg-white border border-[#789d93] rounded text-[10px] text-slate-700 cursor-pointer disabled:opacity-50"
            title="Only operators valid for the selected column type are offered."
          >
            {operatorOptions.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
          {filterOperator !== 'empty' && filterOperator !== 'notEmpty' && (
            <input
              type={selectedFilterColumn?.type === 'date' ? 'date' : selectedFilterColumn?.type === 'text' ? 'text' : 'number'}
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder={filterOperator === 'between' ? 'From' : 'Filter all results'}
              className="h-6 px-1 w-44 bg-white border border-[#789d93] rounded text-[10px] text-slate-800"
            />
          )}
          {filterOperator === 'between' && (
            <input
              type={selectedFilterColumn?.type === 'date' ? 'date' : 'number'}
              value={filterValueTo}
              onChange={(event) => setFilterValueTo(event.target.value)}
              placeholder="To"
              className="h-6 px-1 w-32 bg-white border border-[#789d93] rounded text-[10px] text-slate-800"
            />
          )}
          <button
            type="button"
            onClick={applyColumnFilter}
            disabled={loading}
            className="h-6 px-2 rounded bg-[#2c5f57] hover:bg-[#204741] text-white font-bold cursor-pointer disabled:opacity-50"
          >
            Apply Filter
          </button>
          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={clearColumnFilters}
              disabled={loading}
              className="h-6 px-2 rounded border border-[#789d93] bg-white text-slate-700 font-bold hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              Clear Filters
            </button>
          )}
          {filterError && <span className="text-[10px] font-semibold text-red-700">{filterError}</span>}
          {activeFilters.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {activeFilters.map((filter) => (
                <span key={filter.key} className="flex items-center gap-1 bg-emerald-50 border border-[#789d93] rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {describeFilter(filter, columnDefs)}
                  <button type="button" onClick={() => removeColumnFilter(filter.key)} className="text-red-600 cursor-pointer" title="Remove this filter">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </span>
          )}
          <span className="ml-auto text-[10px] text-slate-500">
            Filters and totals cover every matching document, not only this page.
          </span>
        </div>

        {response.groups.length > 0 && (
          <div className="border-b border-[#789d93] bg-white max-h-52 overflow-auto">
            <div className="sticky top-0 bg-[#d7e8e2] px-2 py-1 flex items-center gap-2 border-b border-[#789d93]">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-600">Group Summary</span>
              <span className="text-[10px] text-slate-500">Levels: {response.groupBy.length}</span>
              <button type="button" onClick={expandAllGroups} className="ml-auto text-[10px] font-bold text-[#2c5f57] hover:underline cursor-pointer">
                Expand All
              </button>
              <button type="button" onClick={() => setOpenGroupKeys([])} className="text-[10px] font-bold text-[#2c5f57] hover:underline cursor-pointer">
                Collapse All
              </button>
            </div>
            {response.groups.map((node) => (
              <GroupNode key={node.key} node={node} path={[]} rows={rows} openKeys={openGroupKeys} onToggle={toggleGroupKey} />
            ))}
          </div>
        )}

        {!response.totals.grandTotalAllowed && activeSourceCount > 1 && (
          <div className="bg-white border-b border-[#789d93] px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Grand total not shown - sources have different accounting directions
            </p>
            <p className="text-[10px] text-slate-600">{response.totals.grandTotalReason}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {response.totals.bySource.map((subtotal) => (
                <span key={subtotal.sourceType} className="text-[10px] text-slate-700">
                  <span className="font-bold">{subtotal.sourceLabel}</span>
                  <span className="font-mono ml-1">{money(subtotal.billAmount)}</span>
                  <span className="text-slate-500 ml-1">({subtotal.direction})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-auto bg-white">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#2c5f57] text-white">
                {columnDefs.map((column) => {
                  const groupable = GROUPABLE.includes(column.key);
                  const grouped = groupBy.includes(column.key);
                  return (
                    <th
                      key={column.key}
                      draggable={groupable}
                      onDragStart={(event) => {
                        if (!groupable) return;
                        event.dataTransfer.setData('text/plain', column.key);
                        setDragField(column.key);
                      }}
                      onDragEnd={() => setDragField(null)}
                      title={
                        groupable
                          ? 'Click to sort on the server. Drag this header into the Group By bar to group the whole dataset.'
                          : 'Click to sort on the server so the totals stay dataset-wide.'
                      }
                      className={
                        'px-1.5 py-1 font-bold whitespace-nowrap border-r border-[#1f4842] hover:bg-[#204741] ' +
                        (groupable ? 'cursor-grab ' : '') +
                        (grouped ? 'bg-[#204741] ' : '') +
                        (column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left')
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {groupable && <GripVertical className="w-2.5 h-2.5 text-emerald-200/70" />}
                        <button type="button" onClick={() => applySort(column.key)} className="cursor-pointer">
                          {column.label}
                        </button>
                        {sortBy === column.key && <span className="text-emerald-300">{sortDir === 'asc' ? '^' : 'v'}</span>}
                        {grouped && <span className="text-[9px] text-emerald-200">grouped</span>}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={Math.max(1, columnDefs.length)} className="px-3 py-6 text-center text-slate-500">
                    No document matches the current date range and filters. The report only shows real stored documents.
                  </td>
                </tr>
              )}
              {rows.map((row, index) => {
                const isOpen = expanded.includes(row.key);
                const lines = itemCache[row.key];
                return (
                  <React.Fragment key={row.key}>
                    <tr className={'border-b border-slate-100 ' + (index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60')}>
                      {columnDefs.map((column) => {
                        const isSrNo = column.key === 'srNo';
                        const isBillNo = column.key === 'billNo';
                        return (
                          <td
                            key={column.key}
                            className={
                              'px-1.5 py-0.5 border-r border-slate-100 ' +
                              (column.align === 'right' ? 'text-right font-mono' : column.align === 'center' ? 'text-center' : 'text-left') +
                              (isBillNo ? ' font-semibold text-[#1f4842]' : '')
                            }
                          >
                            {isBillNo ? (
                              <button
                                type="button"
                                onClick={() => void toggleExpand(row)}
                                className="text-left hover:underline cursor-pointer"
                                title="Show the stored item lines for this document"
                              >
                                {isOpen ? 'v ' : '> '}
                                {formatCell(row.values[column.key], column)}
                              </button>
                            ) : isSrNo ? (
                              (response.pagination.page - 1) * response.pagination.pageSize + index + 1
                            ) : (
                              formatCell(row.values[column.key], column)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    {isOpen && (
                      <tr className="bg-[#f4faf7] border-b border-[#789d93]">
                        <td colSpan={Math.max(1, columnDefs.length)} className="px-3 py-1.5">
                          {!lines ? (
                            <p className="flex items-center gap-1.5 text-slate-600">
                              <Loader2 className="w-3 h-3 animate-spin" /> Loading stored item lines...
                            </p>
                          ) : lines.length === 0 ? (
                            <p className="text-slate-600">
                              This document has no stored item lines, so no item detail can be shown.
                            </p>
                          ) : (
                            <table className="w-full text-[10px] border-collapse">
                              <thead>
                                <tr className="bg-[#d7e8e2] text-slate-700">
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">#</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Item</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Code</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Quality</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Grade</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Lot</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">HSN</th>
                                  <th className="px-1 py-0.5 text-right border border-[#c2dcd5]">Qty</th>
                                  <th className="px-1 py-0.5 text-left border border-[#c2dcd5]">Unit</th>
                                  <th className="px-1 py-0.5 text-right border border-[#c2dcd5]">Rate</th>
                                  <th className="px-1 py-0.5 text-right border border-[#c2dcd5]">Taxable</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lines.map((line) => (
                                  <tr key={row.key + '-' + line.lineNumber} className="bg-white">
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.lineNumber}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.itemName || '-'}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.itemCode || '-'}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.quality || '-'}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.grade || '-'}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.lotNumber || '-'}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.hsnCode || '-'}</td>
                                    <td className="px-1 py-0.5 text-right font-mono border border-[#e2e8f0]">{line.quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                    <td className="px-1 py-0.5 border border-[#e2e8f0]">{line.unit || '-'}</td>
                                    <td className="px-1 py-0.5 text-right font-mono border border-[#e2e8f0]">{money(line.rate)}</td>
                                    <td className="px-1 py-0.5 text-right font-mono border border-[#e2e8f0]">{money(line.taxableAmount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0">
              <tr className="bg-[#1f4842] text-white font-bold">
                {columnDefs.map((column) => {
                  const total = totalFor(response.totals.all, column.key);
                  const isSrNo = column.key === 'srNo';
                  return (
                    <td
                      key={column.key}
                      className={
                        'px-1.5 py-1 border-r border-[#173733] ' +
                        (column.align === 'right' ? 'text-right font-mono' : column.align === 'center' ? 'text-center' : 'text-left')
                      }
                    >
                      {isSrNo
                        ? 'TOTAL'
                        : total === null
                        ? ''
                        : column.type === 'number'
                        ? total.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                        : money(total)}
                    </td>
                  );
                })}
              </tr>
              {response.totals.grandTotal !== null && (
                <tr className="bg-[#2c5f57] text-emerald-100">
                  <td colSpan={Math.max(1, columnDefs.length)} className="px-1.5 py-1 text-right font-bold">
                    Grand Total Bill Amount: <span className="font-mono text-white">{money(response.totals.grandTotal)}</span>
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <div className="bg-[#eef5f2] border-t border-[#789d93] px-2.5 py-1 flex items-center gap-2">
          <span className="text-[10px] text-slate-600">
            Layout: <span className="font-bold text-slate-800">{layoutName}</span> - {response.columns.length} columns
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[10px] text-slate-600">
            Rate column: <span className="font-bold text-slate-800">{response.meta.rateColumn}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[10px] text-slate-600">
            Item details: <span className="font-bold text-slate-800">{response.meta.printItemDetails ? 'on' : 'off'}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[10px] text-slate-600">
            Filtered rows:{' '}
            <span className="font-bold text-slate-800">{response.rowCount}</span>
            {activeFilters.length > 0 && (
              <span className="text-slate-500"> of {response.pagination.total} in range</span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(response.pagination.page - 1)}
              disabled={response.pagination.page <= 1 || loading}
              className="h-6 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
            >
              Prev
            </button>
            <span className="font-mono text-[10px] text-slate-700 px-1">
              Page {response.pagination.page} of {response.pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(response.pagination.page + 1)}
              disabled={response.pagination.page >= response.pagination.totalPages || loading}
              className="h-6 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
            >
              Next
            </button>
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2c5f57]" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportBillBaseResultsPage;
