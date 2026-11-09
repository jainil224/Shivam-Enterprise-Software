import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Columns3,
  Eye,
  Loader2,
  RefreshCcw,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getReportBillBaseOptions, runReportBillBase } from '../services/api';
import type {
  ReportDetailMode,
  ReportFormatDef,
  ReportMode,
  ReportOptionsResponse,
  ReportPageState,
  ReportRateColumn,
  ReportRunRequest,
  ReportSavedLayout,
  ReportSourceType,
} from '../types/reports';
import { ReportColumnSelector } from '../components/ReportColumnSelector';

const STATE_KEY = 'bms_report_bill_base_state';
const LAYOUT_KEY_PREFIX = 'bms_report_bill_base_layouts_';
const FORMAT_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

interface FormState {
  dateFrom: string;
  dateTo: string;
  mode: ReportMode;
  sources: ReportSourceType[];
  format: string;
  bookId: string;
  partyId: string;
  itemId: string;
  itemGroup: string;
  quality: string;
  partyCity: string;
  rateColumn: ReportRateColumn;
  rateFrom: string;
  rateTo: string;
  detailMode: ReportDetailMode;
  printItemDetails: boolean;
  includeCancelled: boolean;
}

const emptyForm = (): FormState => ({
  dateFrom: '',
  dateTo: '',
  mode: 'PURCHASE',
  sources: ['PURCHASE'],
  format: 'BILL_NO_WISE',
  bookId: '',
  partyId: '',
  itemId: '',
  itemGroup: '',
  quality: '',
  partyCity: '',
  rateColumn: 'BASIC',
  rateFrom: '',
  rateTo: '',
  detailMode: 'DETAIL',
  printItemDetails: false,
  includeCancelled: false,
});

const readStoredState = (): ReportPageState | null => {
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

const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true;
};

const labelClass = 'block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5';
const fieldClass =
  'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed';

export const ReportBillBaseConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<ReportOptionsResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [columns, setColumns] = useState<string[]>([]);
  const [layoutName, setLayoutName] = useState('Standard');
  const [layouts, setLayouts] = useState<ReportSavedLayout[]>([]);
  const [selector, setSelector] = useState<{ open: boolean; allowSave: boolean; title: string }>({
    open: false,
    allowSave: false,
    title: 'Column Selection',
  });
  const [showSources, setShowSources] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<ReportSourceType[]>(['PURCHASE']);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layoutKey = activeCompany ? LAYOUT_KEY_PREFIX + activeCompany.id : '';

  const patch = useCallback((changes: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getReportBillBaseOptions();
        if (cancelled) return;
        setOptions(data);

        let storedLayouts: ReportSavedLayout[] = [];
        if (layoutKey) {
          try {
            const raw = localStorage.getItem(layoutKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) storedLayouts = parsed as ReportSavedLayout[];
            }
          } catch {
            storedLayouts = [];
          }
        }
        setLayouts(storedLayouts);

        const stored = readStoredState();
        if (stored) {
          const request = stored.request;
          setForm({
            dateFrom: request.dateFrom,
            dateTo: request.dateTo,
            mode: request.mode,
            sources: request.sources && request.sources.length > 0 ? request.sources : ['PURCHASE'],
            format: request.format,
            bookId: request.bookId ?? '',
            partyId: request.partyId ?? '',
            itemId: request.itemId ?? '',
            itemGroup: request.itemGroup ?? '',
            quality: request.quality ?? '',
            partyCity: request.partyCity ?? '',
            rateColumn: request.rateColumn ?? 'BASIC',
            rateFrom: request.rateFrom === null || request.rateFrom === undefined ? '' : String(request.rateFrom),
            rateTo: request.rateTo === null || request.rateTo === undefined ? '' : String(request.rateTo),
            detailMode: request.detailMode ?? 'DETAIL',
            printItemDetails: request.printItemDetails === true,
            includeCancelled: request.includeCancelled === true,
          });
          setColumns(request.columns && request.columns.length > 0 ? request.columns : data.standardColumns);
          setLayoutName(stored.layoutName || 'Standard');
        } else {
          setForm({
            ...emptyForm(),
            dateFrom: data.defaultDateFrom,
            dateTo: data.defaultDateTo,
          });
          setColumns(data.standardColumns);
          setLayoutName('Standard');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load report options.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [layoutKey]);

  const selectedFormat: ReportFormatDef | null = useMemo(() => {
    if (!options) return null;
    return options.formats.find((entry) => entry.key === form.format) ?? null;
  }, [options, form.format]);

  const columnLabel = useCallback(
    (key: string): string => {
      const found = options?.columns.find((column) => column.key === key);
      if (found) return found.label;
      if (key === 'documentCount') return 'Bills';
      return key;
    },
    [options]
  );

  const persistLayouts = useCallback(
    (next: ReportSavedLayout[]) => {
      setLayouts(next);
      if (!layoutKey) return;
      try {
        localStorage.setItem(layoutKey, JSON.stringify(next));
      } catch {
        /* localStorage unavailable: layouts stay in memory only */
      }
    },
    [layoutKey]
  );

  const supportedSources = useMemo(
    () => (options ? options.sources.filter((source) => source.supported) : []),
    [options]
  );

  const selectFormat = (format: ReportFormatDef) => {
    if (format.support === 'UNAVAILABLE') return;
    patch({ format: format.key });
  };

  const handleColumnMode = (mode: 'STANDARD' | 'SELECTED' | 'NEW' | 'EDIT') => {
    if (!options) return;
    if (mode === 'STANDARD') {
      setColumns(options.standardColumns);
      setLayoutName('Standard');
      return;
    }
    if (mode === 'NEW') {
      setSelector({ open: true, allowSave: true, title: 'Column Selection - New Layout' });
      return;
    }
    if (mode === 'EDIT') {
      if (layouts.length === 0) {
        setError('No saved column layout exists yet. Choose New to create one, then Edit to change it.');
        return;
      }
      setSelector({ open: true, allowSave: true, title: 'Column Selection - Edit Layout' });
      return;
    }
    setSelector({ open: true, allowSave: false, title: 'Column Selection - Selected Columns' });
  };

  const applyColumns = (nextColumns: string[], nextName: string) => {
    const cleaned = nextColumns.filter((key) => key !== 'srNo');
    const finalColumns = ['srNo', ...cleaned];
    setColumns(finalColumns);
    if (selector.allowSave) {
      const name = nextName.trim() || 'Custom Layout';
      const existing = layouts.find((layout) => layout.name.toLowerCase() === name.toLowerCase());
      const nextLayouts = existing
        ? layouts.map((layout) => (layout.id === existing.id ? { ...layout, name, columns: finalColumns } : layout))
        : [...layouts, { id: 'layout-' + Date.now(), name, columns: finalColumns }];
      persistLayouts(nextLayouts);
      setLayoutName(name);
    } else {
      setLayoutName('Custom (unsaved)');
    }
    setSelector((prev) => ({ ...prev, open: false }));
    setError(null);
  };

  const applySavedLayout = (id: string) => {
    const found = layouts.find((layout) => layout.id === id);
    if (!found) return;
    setColumns(found.columns);
    setLayoutName(found.name);
  };

  const buildRequest = useCallback(
    (page: number): ReportRunRequest => ({
      dateFrom: form.dateFrom,
      dateTo: form.dateTo,
      mode: form.mode,
      sources: form.mode === 'SELECTED' ? form.sources : undefined,
      format: form.format,
      bookId: form.bookId || null,
      partyId: form.partyId || null,
      itemId: form.itemId || null,
      itemGroup: form.itemGroup || null,
      quality: form.quality || null,
      partyCity: form.partyCity || null,
      rateColumn: form.rateColumn,
      rateFrom: form.rateFrom.trim() === '' ? null : Number(form.rateFrom),
      rateTo: form.rateTo.trim() === '' ? null : Number(form.rateTo),
      detailMode: form.detailMode,
      printItemDetails: form.printItemDetails,
      includeCancelled: form.includeCancelled,
      columns,
      page,
      pageSize: 100,
      sortBy: null,
      sortDir: 'asc',
    }),
    [form, columns]
  );

  const validate = (): string | null => {
    if (!options) return 'Report options are still loading.';
    if (!selectedFormat) return 'Select a report name.';
    if (selectedFormat.support === 'UNAVAILABLE') {
      return selectedFormat.label + ' is not available: ' + (selectedFormat.reason ?? 'the required source fields do not exist.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(form.dateTo)) {
      return 'Select both a valid From and To bill date.';
    }
    if (form.dateFrom > form.dateTo) return 'From Bill date cannot be after the To Bill date.';
    if (form.dateFrom < options.financialYear.startDate || form.dateTo > options.financialYear.endDate) {
      return (
        'The date range must stay inside financial year ' +
        options.financialYear.yearName +
        ' (' +
        options.financialYear.startDate +
        ' to ' +
        options.financialYear.endDate +
        ').'
      );
    }
    if (form.mode === 'SELECTED' && form.sources.length === 0) {
      return 'Select at least one document source for the Selected mode.';
    }
    const from = form.rateFrom.trim() === '' ? null : Number(form.rateFrom);
    const to = form.rateTo.trim() === '' ? null : Number(form.rateTo);
    if (from !== null && !Number.isFinite(from)) return 'Rate From must be a number.';
    if (to !== null && !Number.isFinite(to)) return 'Rate To must be a number.';
    if (from !== null && to !== null && from > to) return 'Rate From cannot be greater than Rate To.';
    if (columns.length === 0) return 'Select at least one report column.';
    return null;
  };

  const preview = useCallback(async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const request = buildRequest(1);
      const response = await runReportBillBase(request);
      const state: ReportPageState = { request, response, layoutName, landscape: false };
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
      navigate('/reports/sales-purchase/bill-base/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate the report.');
    } finally {
      setRunning(false);
    }
  }, [buildRequest, layoutName, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'PageDown' && !isTypingTarget(event.target)) {
        event.preventDefault();
        void preview();
        return;
      }
      if (event.key === 'Escape') {
        if (showSources) {
          setShowSources(false);
          return;
        }
        if (selector.open) {
          setSelector((prev) => ({ ...prev, open: false }));
          return;
        }
        navigate('/');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview, showSources, selector.open, navigate]);

  const resetFilters = () => {
    if (!options) return;
    setForm({ ...emptyForm(), dateFrom: options.defaultDateFrom, dateTo: options.defaultDateTo });
    setColumns(options.standardColumns);
    setLayoutName('Standard');
    setError(null);
  };

  const toggleSource = (key: ReportSourceType) => {
    setSourceDraft((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const unavailableReason = (key: string): string => {
    const found = options?.unavailableFilters.find((entry) => entry.key === key);
    return found ? found.reason : 'Not available.';
  };

  return (
    <div className="min-h-screen bg-[#c2dcd5] text-slate-800 flex flex-col font-sans select-none text-xs">
      <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-300" />
          <span className="font-bold text-xs uppercase tracking-wide">Sale/Pur Bill Base - Report Configuration</span>
          <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded font-mono">
            {options?.financialYear.yearName ?? activeFinancialYear?.yearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-5 h-5 flex items-center justify-center text-white bg-[#eb5757] hover:bg-red-600 rounded font-bold cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading report configuration...</span>
        </div>
      ) : !options ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white border border-red-300 rounded p-4 max-w-lg text-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" />
            <p className="font-bold text-red-700">Report configuration could not be loaded.</p>
            <p className="mt-1 text-slate-600">{error ?? 'Unknown error.'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-3 px-3 py-1 bg-[#2c5f57] text-white rounded font-bold cursor-pointer">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="w-60 shrink-0 bg-[#eef5f2] border-r border-[#789d93] flex flex-col min-h-0">
            <div className="px-2 py-1.5 bg-[#d7e8e2] border-b border-[#789d93] font-bold uppercase tracking-wider text-[10px] text-slate-600 flex items-center justify-between">
              <span>Report Name</span>
              <span className="font-mono">{options.formats.length}</span>
            </div>
            <div className="flex-1 overflow-auto">
              {options.formats.map((format, index) => {
                const active = form.format === format.key;
                const disabled = format.support === 'UNAVAILABLE';
                return (
                  <button
                    key={format.key}
                    type="button"
                    disabled={disabled}
                    title={format.reason ?? format.label}
                    onClick={() => selectFormat(format)}
                    className={
                      'w-full text-left px-2 py-1 border-b border-[#d7e8e2] flex items-center gap-1.5 ' +
                      (active
                        ? 'bg-[#2c5f57] text-white font-bold'
                        : disabled
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-slate-700 hover:bg-white cursor-pointer')
                    }
                  >
                    <span className={'w-4 shrink-0 font-mono text-[10px] ' + (active ? 'text-emerald-200' : 'text-slate-400')}>
                      {FORMAT_NUMBERS[index] ?? index + 1}
                    </span>
                    <span className="flex-1 leading-tight">{format.label}</span>
                    <span
                      className={
                        'shrink-0 text-[9px] font-bold px-1 rounded uppercase ' +
                        (format.support === 'FULL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : format.support === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-500')
                      }
                    >
                      {format.support === 'FULL' ? 'Ready' : format.support === 'PARTIAL' ? 'Partial' : 'N/A'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="p-2 border-t border-[#789d93] text-[10px] text-slate-600 space-y-0.5">
              <p><span className="font-bold text-emerald-700">Ready</span> - full support</p>
              <p><span className="font-bold text-amber-700">Partial</span> - real data, some fields missing</p>
              <p><span className="font-bold text-slate-500">N/A</span> - source field does not exist</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-auto p-2.5 space-y-2.5">
              {selectedFormat && (
                <div className="bg-white border border-[#789d93] rounded px-2 py-1.5 flex items-start gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">
                      Report: {selectedFormat.label}
                      <span className="ml-2 font-mono text-[10px] text-slate-500">
                        {form.mode === 'SELECTED'
                          ? form.sources.map((key) => options.sources.find((entry) => entry.key === key)?.label ?? key).join(' + ') || 'No sources'
                          : options.modes.find((entry) => entry.value === form.mode)?.label ?? form.mode}
                      </span>
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Grouping: {selectedFormat.groupBy.length > 0 ? selectedFormat.groupBy.map(columnLabel).join(' > ') : 'one row per bill'}
                    </p>
                  </div>
                  {selectedFormat.support === 'PARTIAL' && (
                    <p className="max-w-md text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                      {selectedFormat.reason}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-white border border-[#789d93] rounded p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Select Bill Date</div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  <div>
                    <label className={labelClass}>From Bill</label>
                    <input
                      type="date"
                      value={form.dateFrom}
                      min={options.financialYear.startDate}
                      max={options.financialYear.endDate}
                      onChange={(event) => patch({ dateFrom: event.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>To</label>
                    <input
                      type="date"
                      value={form.dateTo}
                      min={options.financialYear.startDate}
                      max={options.financialYear.endDate}
                      onChange={(event) => patch({ dateTo: event.target.value })}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>1. Sales / Purchase</label>
                    <select
                      value={form.mode}
                      onChange={(event) => {
                        const mode = event.target.value as ReportMode;
                        patch({ mode, sources: mode === 'SELECTED' ? form.sources : ['PURCHASE'] });
                        if (mode === 'SELECTED') {
                          setSourceDraft(form.sources.length > 0 ? form.sources : ['PURCHASE']);
                          setShowSources(true);
                        }
                      }}
                      className={fieldClass}
                    >
                      {options.modes.map((mode) => (
                        <option key={mode.value} value={mode.value} disabled={!mode.available}>
                          {mode.label}
                          {mode.available ? '' : ' - not available'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>2. Company Selection</label>
                    <input type="text" readOnly value={'1. Current - ' + options.company.name} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>3. Book</label>
                    <select value={form.bookId} onChange={(event) => patch({ bookId: event.target.value })} className={fieldClass}>
                      <option value="">All Books</option>
                      {options.books.map((book) => (
                        <option key={book.value} value={book.value}>
                          {book.label}{book.meta ? ' (' + book.meta + ')' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>6. Party</label>
                    <select value={form.partyId} onChange={(event) => patch({ partyId: event.target.value })} className={fieldClass}>
                      <option value="">All Parties</option>
                      {options.parties.map((party) => (
                        <option key={party.value} value={party.value}>
                          {party.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                  <div>
                    <label className={labelClass}>8. Item</label>
                    <select
                      value={form.itemId}
                      onChange={(event) => patch({ itemId: event.target.value })}
                      disabled={options.items.length === 0}
                      title={options.items.length === 0 ? 'No Item Master records exist for this company.' : 'Item filter matches the item name stored on each document line.'}
                      className={fieldClass}
                    >
                      <option value="">All Items</option>
                      {options.items.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>8.1 Item Group</label>
                    <select
                      value={form.itemGroup}
                      onChange={(event) => patch({ itemGroup: event.target.value })}
                      disabled={options.itemGroups.length === 0}
                      className={fieldClass}
                    >
                      <option value="">All Item Groups</option>
                      {options.itemGroups.map((group) => (
                        <option key={group.value} value={group.value}>
                          {group.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <select
                      value={form.partyCity}
                      onChange={(event) => patch({ partyCity: event.target.value })}
                      disabled={options.cities.length === 0}
                      className={fieldClass}
                    >
                      <option value="">All Cities</option>
                      {options.cities.map((city) => (
                        <option key={city.value} value={city.value}>
                          {city.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Quality</label>
                    <select
                      value={form.quality}
                      onChange={(event) => patch({ quality: event.target.value })}
                      disabled={options.qualities.length === 0}
                      title={options.qualities.length === 0 ? 'No Yarn Quality master records exist for this company.' : 'Quality is recorded on Debit Note lines only.'}
                      className={fieldClass}
                    >
                      <option value="">All Qualities</option>
                      {options.qualities.map((quality) => (
                        <option key={quality.value} value={quality.value}>
                          {quality.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>10. Detail / Summary</label>
                    <select
                      value={form.detailMode}
                      onChange={(event) => patch({ detailMode: event.target.value as ReportDetailMode })}
                      className={fieldClass}
                    >
                      {options.detailModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>14. Rate Column</label>
                    <select
                      value={form.rateColumn}
                      onChange={(event) => patch({ rateColumn: event.target.value as ReportRateColumn })}
                      className={fieldClass}
                    >
                      {options.rateColumns.map((rate) => (
                        <option key={rate.value} value={rate.value}>
                          {rate.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-2">
                  <div>
                    <label className={labelClass}>14.1 Rate Filter From</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.rateFrom}
                      onChange={(event) => patch({ rateFrom: event.target.value })}
                      placeholder="Any"
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>14.1 Rate Filter To</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.rateTo}
                      onChange={(event) => patch({ rateTo: event.target.value })}
                      placeholder="Any"
                      className={fieldClass}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>17. Column Selection</label>
                    <div className="flex items-center gap-1">
                      <select
                        value={layoutName === 'Standard' ? 'STANDARD' : 'SELECTED'}
                        onChange={(event) => handleColumnMode(event.target.value as 'STANDARD' | 'SELECTED')}
                        className={fieldClass}
                      >
                        <option value="STANDARD">1. Standard</option>
                        <option value="SELECTED">2. Selected</option>
                      </select>
                      <button type="button" onClick={() => handleColumnMode('NEW')} className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap">
                        3. New
                      </button>
                      <button type="button" onClick={() => handleColumnMode('EDIT')} className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap">
                        4. Edit
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Saved Layout</label>
                    <select
                      value={layouts.find((layout) => layout.name === layoutName)?.id ?? ''}
                      onChange={(event) => applySavedLayout(event.target.value)}
                      disabled={layouts.length === 0}
                      className={fieldClass}
                    >
                      <option value="">{layouts.length === 0 ? 'No saved layouts' : 'Select a saved layout'}</option>
                      {layouts.map((layout) => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name} ({layout.columns.length} columns)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-3 col-span-2">
                    <label className="flex items-center gap-1.5 h-7 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.printItemDetails}
                        onChange={(event) => patch({ printItemDetails: event.target.checked })}
                        className="accent-[#2c5f57]"
                      />
                      <span className="font-semibold text-slate-700">13. Print Item details?</span>
                    </label>
                    <label className="flex items-center gap-1.5 h-7 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.includeCancelled}
                        onChange={(event) => patch({ includeCancelled: event.target.checked })}
                        className="accent-[#2c5f57]"
                      />
                      <span className="font-semibold text-slate-700">Include Cancelled</span>
                    </label>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  <Columns3 className="w-3.5 h-3.5 text-[#2c5f57] shrink-0" />
                  <span className="font-bold text-slate-700 whitespace-nowrap">{layoutName}</span>
                  <span>-</span>
                  <span className="whitespace-nowrap">{columns.length} columns</span>
                  <span className="truncate text-slate-500">{columns.map(columnLabel).join(', ')}</span>
                </div>
              </div>

              <div className="bg-white border border-[#789d93] rounded p-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Filters not available in this BMS (no source field)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {[
                    { key: 'schedule', label: '4. Schedule' },
                    { key: 'partyGroup', label: '5. Party Group' },
                    { key: 'deliveryParty', label: '7. Delivery Party' },
                    { key: 'broker', label: '9. Broker' },
                    { key: 'salesPerson', label: '11. Sales Person' },
                    { key: 'transporter', label: '18. Transporter' },
                    { key: 'wiseType', label: '15. Wise Type' },
                    { key: 'attributes', label: 'Attrib 1/2/3' },
                  ].map((entry) => (
                    <div key={entry.key}>
                      <label className={labelClass}>{entry.label}</label>
                      <select disabled title={unavailableReason(entry.key)} className={fieldClass}>
                        <option>Not available</option>
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className={labelClass}>16. Quantity Columns</label>
                    <select disabled title="Only the stored document quantity exists; no alternate quantity configuration is defined." className={fieldClass}>
                      <option>Stored quantity only</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#789d93] bg-[#eef5f2] px-2.5 py-2 space-y-1">
              {error && (
                <div className="flex items-start gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void preview()}
                  disabled={running}
                  className="h-8 px-4 rounded bg-[#107c41] hover:bg-[#0c6334] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{running ? 'Loading real records...' : 'Preview (Page Down)'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-8 px-3 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Reset
                </button>
                <span className="text-[10px] text-slate-600">
                  Page Down previews. Enter never submits this screen. Esc closes.
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="ml-auto h-8 px-3 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSources && options && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded border border-[#2c5f57] shadow-2xl text-xs">
            <div className="bg-[#2c5f57] text-white px-3 py-2 font-bold flex items-center justify-between">
              <span>Selected Document Sources</span>
              <button type="button" onClick={() => setShowSources(false)} className="hover:text-red-300 cursor-pointer" aria-label="Close sources">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-[55vh] overflow-auto">
              {options.sources.map((source) => {
                const checked = sourceDraft.includes(source.key);
                return (
                  <label
                    key={source.key}
                    className={
                      'flex items-start gap-2 px-2 py-1.5 border-b border-slate-100 ' +
                      (source.supported ? 'cursor-pointer hover:bg-emerald-50' : 'cursor-not-allowed text-slate-400')
                    }
                    title={source.reason ?? source.label}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!source.supported}
                      onChange={() => toggleSource(source.key)}
                      className="mt-0.5 accent-[#2c5f57]"
                    />
                    <span className="flex-1">
                      <span className="font-semibold">{source.label}</span>
                      {!source.supported && <span className="block text-[10px]">{source.reason}</span>}
                    </span>
                    {source.supported && source.direction && (
                      <span className="font-mono text-[9px] text-slate-500">{source.direction}</span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="px-2 py-1.5 border-t border-slate-200 flex items-center gap-2">
              <button type="button" onClick={() => setSourceDraft(supportedSources.map((source) => source.key))} className="px-2 py-1 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                Select All
              </button>
              <button type="button" onClick={() => setSourceDraft([])} className="px-2 py-1 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                Clear All
              </button>
              <span className="ml-auto font-mono text-[11px] font-bold text-slate-700">
                Total Selected: {sourceDraft.length}
              </span>
            </div>
            <div className="px-2 py-2 border-t border-slate-200 flex justify-end gap-2">
              <button type="button" onClick={() => setShowSources(false)} className="px-3 py-1 rounded border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  patch({ sources: sourceDraft });
                  setShowSources(false);
                  if (sourceDraft.length === 0) setError('Select at least one document source for the Selected mode.');
                  else setError(null);
                }}
                className="px-3 py-1 rounded bg-[#2c5f57] text-white font-bold hover:bg-[#204741] cursor-pointer"
              >
                Apply Sources
              </button>
            </div>
          </div>
        </div>
      )}

      {options && (
        <ReportColumnSelector
          open={selector.open}
          title={selector.title}
          allColumns={options.columns}
          selected={columns}
          layoutName={selector.allowSave ? '' : layoutName}
          allowSave={selector.allowSave}
          onCancel={() => setSelector((prev) => ({ ...prev, open: false }))}
          onApply={applyColumns}
        />
      )}
    </div>
  );
};
