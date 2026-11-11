import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Columns3,
  Eye,
  Loader2,
  List,
  RefreshCcw,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  createReportColumnLayout,
  deleteReportColumnLayout,
  getReportBillBaseOptions,
  getReportColumnLayouts,
  runReportBillBase,
  setDefaultReportColumnLayout,
  updateReportColumnLayout,
} from '../services/api';
import type {
  ReportDetailMode,
  ReportFilterOption,
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
import { SearchSelect } from '../components/SearchSelect';

const STATE_KEY = 'bms_report_bill_base_state';
const FORMAT_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

interface FormState {
  dateFrom: string;
  dateTo: string;
  mode: ReportMode;
  sources: ReportSourceType[];
  format: string;
  bookId: string;
  partyId: string;
  partyGroupId: string;
  areaId: string;
  deliveryPartyId: string;
  brokerId: string;
  transporterId: string;
  salespersonId: string;
  vehicle: string;
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
  partyGroupId: '',
  areaId: '',
  deliveryPartyId: '',
  brokerId: '',
  transporterId: '',
  salespersonId: '',
  vehicle: '',
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

const Field: React.FC<{ label: string; hint?: string; className?: string; children: React.ReactNode }> = ({
  label,
  hint,
  className,
  children,
}) => (
  <div className={className}>
    <label className={labelClass}>{label}</label>
    {children}
    {hint && (
      <p className="mt-0.5 text-[9px] leading-tight text-slate-500" title={hint}>
        {hint}
      </p>
    )}
  </div>
);

export const ReportBillBaseConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [options, setOptions] = useState<ReportOptionsResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [columns, setColumns] = useState<string[]>([]);
  const [layoutName, setLayoutName] = useState('Standard');
  const [layouts, setLayouts] = useState<ReportSavedLayout[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState<string | null>(null);
  const [selector, setSelector] = useState<{
    open: boolean;
    allowSave: boolean;
    mode: 'selected' | 'new' | 'edit';
    title: string;
  }>({
    open: false,
    allowSave: false,
    mode: 'selected',
    title: 'Column Selection',
  });
  const [showSources, setShowSources] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<ReportSourceType[]>(['PURCHASE']);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layoutKey = activeCompany ? activeCompany.id : '';

  const patch = useCallback((changes: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...changes }));
  }, []);

  const hasUnsavedConfig = layoutName === 'Custom (unsaved)';
  const requestClose = useCallback(() => {
    if (hasUnsavedConfig && !window.confirm('The custom column selection is not saved. Close this screen anyway?')) return;
    navigate('/');
  }, [hasUnsavedConfig, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const data = await getReportBillBaseOptions();
        if (cancelled) return;
        setOptions(data);

        // Layouts live in PostgreSQL and are scoped to the active company.
        let storedLayouts: ReportSavedLayout[] = [];
        try {
          storedLayouts = await getReportColumnLayouts('BILL_BASE');
        } catch (layoutErr) {
          if (cancelled) return;
          storedLayouts = [];
          setLayoutNotice(
            layoutErr instanceof Error
              ? 'Saved column layouts could not be loaded: ' + layoutErr.message
              : 'Saved column layouts could not be loaded.'
          );
        }
        if (cancelled) return;
        setLayouts(storedLayouts);
        const defaultLayout = storedLayouts.find((entry) => entry.isDefault) ?? null;

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
            partyGroupId: request.partyGroupId ?? '',
            areaId: request.areaId ?? '',
            deliveryPartyId: request.deliveryPartyId ?? '',
            brokerId: request.brokerId ?? '',
            transporterId: request.transporterId ?? '',
            salespersonId: request.salespersonId ?? '',
            vehicle: request.vehicle ?? '',
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
          const matched = storedLayouts.find((entry) => entry.name === (stored.layoutName || ''));
          setActiveLayoutId(matched ? matched.id : null);
          setLayoutNotice(
            matched && matched.unavailableColumns && matched.unavailableColumns.length > 0
              ? 'Layout "' +
                  matched.name +
                  '" references ' +
                  matched.unavailableColumns.length +
                  ' column(s) that no longer exist: ' +
                  matched.unavailableColumns.join(', ') +
                  '.'
              : null
          );
        } else {
          setForm({
            ...emptyForm(),
            dateFrom: data.defaultDateFrom,
            dateTo: data.defaultDateTo,
          });
          if (defaultLayout) {
            setColumns(defaultLayout.columns);
            setLayoutName(defaultLayout.name);
            setActiveLayoutId(defaultLayout.id);
            setLayoutNotice(
              defaultLayout.unavailableColumns && defaultLayout.unavailableColumns.length > 0
                ? 'Default layout "' +
                    defaultLayout.name +
                    '" references ' +
                    defaultLayout.unavailableColumns.length +
                    ' column(s) that no longer exist: ' +
                    defaultLayout.unavailableColumns.join(', ') +
                    '.'
                : 'Default layout "' + defaultLayout.name + '" loaded from PostgreSQL.'
            );
          } else {
            setColumns(data.standardColumns);
            setLayoutName('Standard');
            setActiveLayoutId(null);
            setLayoutNotice(null);
          }
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

  const mergeLayout = useCallback((saved: ReportSavedLayout) => {
    setLayouts((prev) => {
      const exists = prev.some((entry) => entry.id === saved.id);
      const next = exists ? prev.map((entry) => (entry.id === saved.id ? saved : entry)) : [...prev, saved];
      if (saved.isDefault) {
        return next.map((entry) => (entry.id === saved.id ? entry : { ...entry, isDefault: false }));
      }
      return next;
    });
  }, []);

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
      setActiveLayoutId(null);
      setLayoutNotice(null);
      return;
    }
    if (mode === 'NEW') {
      setSelector({ open: true, allowSave: true, mode: 'new', title: 'Column Selection - New Layout' });
      return;
    }
    if (mode === 'EDIT') {
      if (!activeLayoutId) {
        setError('Load a saved layout first, then choose Edit to change its columns.');
        return;
      }
      setSelector({ open: true, allowSave: true, mode: 'edit', title: 'Column Selection - Edit Layout' });
      return;
    }
    setSelector({ open: true, allowSave: false, mode: 'selected', title: 'Column Selection - Selected Columns' });
  };

  const applyColumns = async (nextColumns: string[], nextName: string) => {
    const required = options?.requiredColumns ?? ['srNo'];
    const cleaned = nextColumns.filter((key) => !required.includes(key));
    const finalColumns = [...required, ...cleaned.filter((key) => !required.includes(key))];
    setColumns(finalColumns);
    if (!selector.allowSave) {
      setLayoutName('Custom (unsaved)');
      setActiveLayoutId(null);
      setSelector((prev) => ({ ...prev, open: false }));
      setError(null);
      setLayoutNotice(null);
      return;
    }
    const name = nextName.trim() || 'Custom Layout';
    setLayoutBusy(true);
    try {
      const saved =
        selector.mode === 'edit' && activeLayoutId
          ? await updateReportColumnLayout(activeLayoutId, {
              name,
              columns: finalColumns,
              reportType: 'BILL_BASE',
            })
          : await createReportColumnLayout({ name, columns: finalColumns, reportType: 'BILL_BASE' });
      mergeLayout(saved);
      setLayoutName(saved.name);
      setActiveLayoutId(saved.id);
      setLayoutNotice(
        (selector.mode === 'edit' ? 'Layout "' : 'Layout "') + saved.name + '" saved in PostgreSQL.'
      );
      setSelector((prev) => ({ ...prev, open: false }));
      setError(null);
    } catch (err) {
      setSelector((prev) => ({ ...prev, open: false }));
      setError(err instanceof Error ? err.message : 'Failed to save the column layout.');
    } finally {
      setLayoutBusy(false);
    }
  };

  const applySavedLayout = (id: string) => {
    const found = layouts.find((layout) => layout.id === id);
    if (!found) {
      setActiveLayoutId(null);
      return;
    }
    setColumns(found.columns);
    setLayoutName(found.name);
    setActiveLayoutId(found.id);
    setLayoutNotice(
      found.unavailableColumns && found.unavailableColumns.length > 0
        ? 'Layout "' +
            found.name +
            '" references ' +
            found.unavailableColumns.length +
            ' column(s) that no longer exist and were skipped: ' +
            found.unavailableColumns.join(', ') +
            '.'
        : 'Layout "' + found.name + '" loaded from PostgreSQL.'
    );
  };

  const saveActiveLayout = async () => {
    const current = layouts.find((layout) => layout.id === activeLayoutId);
    if (!current) {
      setError('Load a saved layout before saving changes to it.');
      return;
    }
    setLayoutBusy(true);
    try {
      const saved = await updateReportColumnLayout(current.id, { columns, reportType: 'BILL_BASE' });
      mergeLayout(saved);
      setLayoutName(saved.name);
      setLayoutNotice('Layout "' + saved.name + '" columns saved in PostgreSQL.');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the layout columns.');
    } finally {
      setLayoutBusy(false);
    }
  };

  const renameActiveLayout = async () => {
    const current = layouts.find((layout) => layout.id === activeLayoutId);
    if (!current) {
      setError('Load a saved layout before renaming it.');
      return;
    }
    const entered = window.prompt('Rename layout "' + current.name + '"', current.name);
    if (entered === null) return;
    const name = entered.trim();
    if (name.length === 0) {
      setError('A layout name is required.');
      return;
    }
    if (name === current.name) return;
    setLayoutBusy(true);
    try {
      const saved = await updateReportColumnLayout(current.id, { name, reportType: 'BILL_BASE' });
      mergeLayout(saved);
      if (layoutName === current.name) setLayoutName(saved.name);
      setLayoutNotice('Layout renamed to "' + saved.name + '" in PostgreSQL.');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename the layout.');
    } finally {
      setLayoutBusy(false);
    }
  };

  const setDefaultActiveLayout = async () => {
    const current = layouts.find((layout) => layout.id === activeLayoutId);
    if (!current) {
      setError('Load a saved layout before marking it as the default.');
      return;
    }
    setLayoutBusy(true);
    try {
      const saved = await setDefaultReportColumnLayout(current.id, 'BILL_BASE');
      mergeLayout(saved);
      setLayoutNotice('Layout "' + saved.name + '" is now the default for this company.');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the default layout.');
    } finally {
      setLayoutBusy(false);
    }
  };

  const deleteActiveLayout = async () => {
    const current = layouts.find((layout) => layout.id === activeLayoutId);
    if (!current) {
      setError('Load a saved layout before deleting it.');
      return;
    }
    if (!window.confirm('Delete the saved layout "' + current.name + '" for this company?')) return;
    setLayoutBusy(true);
    try {
      await deleteReportColumnLayout(current.id, 'BILL_BASE');
      setLayouts((prev) => prev.filter((layout) => layout.id !== current.id));
      setActiveLayoutId(null);
      if (layoutName === current.name) {
        setLayoutName('Standard');
        if (options) setColumns(options.standardColumns);
      }
      setLayoutNotice('Layout "' + current.name + '" deleted.');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the layout.');
    } finally {
      setLayoutBusy(false);
    }
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
      partyGroupId: form.partyGroupId || null,
      areaId: form.areaId || null,
      deliveryPartyId: form.deliveryPartyId || null,
      brokerId: form.brokerId || null,
      transporterId: form.transporterId || null,
      salespersonId: form.salespersonId || null,
      vehicle: form.vehicle || null,
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
    if (running) return;
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
        requestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [preview, showSources, selector.open, requestClose]);

  const resetFilters = () => {
    if (!options) return;
    setForm({ ...emptyForm(), dateFrom: options.defaultDateFrom, dateTo: options.defaultDateTo });
    setColumns(options.standardColumns);
    setLayoutName('Standard');
    setActiveLayoutId(null);
    setLayoutNotice(null);
    setError(null);
  };

  const toggleSource = (key: ReportSourceType) => {
    setSourceDraft((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  // Phase 15.2 - dependent refresh: choosing a party group or area narrows the
  // party list, and a party that no longer belongs is cleared instead of being
  // submitted with a filter that cannot match.
  const partyOptions = useMemo(() => {
    if (!options) return [] as ReportFilterOption[];
    const groupId = form.partyGroupId;
    const areaId = form.areaId;
    if (!groupId && !areaId) return options.parties;
    return options.parties.filter(
      (party) => (!groupId || party.partyGroupId === groupId) && (!areaId || party.areaId === areaId)
    );
  }, [options, form.partyGroupId, form.areaId]);

  const narrowParties = (nextGroupId: string, nextAreaId: string) => {
    const list = options?.parties ?? [];
    const keep =
      !form.partyId ||
      list.some(
        (party) =>
          party.value === form.partyId &&
          (!nextGroupId || party.partyGroupId === nextGroupId) &&
          (!nextAreaId || party.areaId === nextAreaId)
      );
    patch({ partyGroupId: nextGroupId, areaId: nextAreaId, partyId: keep ? form.partyId : '' });
  };

  const filterChips = useMemo(() => {
    if (!options) return [] as Array<{ key: keyof FormState; label: string }>;
    const name = (list: ReportFilterOption[], value: string): string =>
      list.find((entry) => entry.value === value)?.label ?? value;
    const chips: Array<{ key: keyof FormState; label: string }> = [];
    if (form.bookId) chips.push({ key: 'bookId', label: 'Book: ' + name(options.books, form.bookId) });
    if (form.partyGroupId) chips.push({ key: 'partyGroupId', label: 'Group: ' + name(options.partyGroups, form.partyGroupId) });
    if (form.areaId) chips.push({ key: 'areaId', label: 'Area: ' + name(options.areas, form.areaId) });
    if (form.partyId) chips.push({ key: 'partyId', label: 'Party: ' + name(options.parties, form.partyId) });
    if (form.deliveryPartyId) chips.push({ key: 'deliveryPartyId', label: 'Delivery: ' + name(options.parties, form.deliveryPartyId) });
    if (form.itemId) chips.push({ key: 'itemId', label: 'Item: ' + name(options.items, form.itemId) });
    if (form.itemGroup) chips.push({ key: 'itemGroup', label: 'Item Group: ' + name(options.itemGroups, form.itemGroup) });
    if (form.brokerId) chips.push({ key: 'brokerId', label: 'Broker: ' + name(options.brokers, form.brokerId) });
    if (form.transporterId) chips.push({ key: 'transporterId', label: 'Transporter: ' + name(options.transporters, form.transporterId) });
    if (form.salespersonId) chips.push({ key: 'salespersonId', label: 'Sales Person: ' + name(options.salespersons, form.salespersonId) });
    if (form.vehicle) chips.push({ key: 'vehicle', label: 'Vehicle: ' + name(options.vehicles, form.vehicle) });
    if (form.partyCity) chips.push({ key: 'partyCity', label: 'City: ' + name(options.cities, form.partyCity) });
    if (form.quality) chips.push({ key: 'quality', label: 'Quality: ' + name(options.qualities, form.quality) });
    return chips;
  }, [form, options]);

  const clearAllFilters = () => {
    patch({
      bookId: '',
      partyGroupId: '',
      areaId: '',
      partyId: '',
      deliveryPartyId: '',
      itemId: '',
      itemGroup: '',
      brokerId: '',
      transporterId: '',
      salespersonId: '',
      vehicle: '',
      partyCity: '',
      quality: '',
    });
  };

  const unavailableReason = (key: string): string => {
    const found = options?.unavailableFilters.find((entry) => entry.key === key);
    return found ? found.reason : 'Not available.';
  };

  const formatRow = (format: ReportFormatDef, index: number, onPick: () => void) => {
    const active = form.format === format.key;
    const disabled = format.support === 'UNAVAILABLE';
    return (
      <button
        key={format.key}
        type="button"
        disabled={disabled}
        title={format.reason ?? format.label}
        onClick={onPick}
        className={
          'w-full text-left px-1.5 py-[3px] border-b border-[#dbeae4] flex items-center gap-1 ' +
          (active
            ? 'bg-[#2c5f57] text-white font-bold'
            : disabled
            ? 'text-slate-400 cursor-not-allowed'
            : 'text-slate-700 hover:bg-white cursor-pointer')
        }
      >
        <span className={'w-3.5 shrink-0 font-mono text-[9px] ' + (active ? 'text-emerald-200' : 'text-slate-400')}>
          {FORMAT_NUMBERS[index] ?? index + 1}
        </span>
        <span className="flex-1 leading-tight text-[10px]">{format.label}</span>
        <span
          className={
            'shrink-0 text-[8px] font-bold px-1 rounded uppercase ' +
            (format.support === 'FULL'
              ? 'bg-emerald-100 text-emerald-800'
              : format.support === 'PARTIAL'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-200 text-slate-500')
          }
        >
          {format.support === 'FULL' ? 'READY' : format.support === 'PARTIAL' ? 'PARTIAL' : 'N/A'}
        </span>
      </button>
    );
  };

  const modeText =
    form.mode === 'SELECTED'
      ? form.sources.map((key) => options?.sources.find((entry) => entry.key === key)?.label ?? key).join(' + ') || 'No sources'
      : options?.modes.find((entry) => entry.value === form.mode)?.label ?? form.mode;

  return (
    <div className="h-full max-h-full min-h-0 overflow-hidden bg-[#c2dcd5] text-slate-800 flex flex-col font-sans select-none text-xs">
      <div className="shrink-0 bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span className="font-bold text-xs uppercase tracking-wide truncate">Sale/Pur Bill Base - Report Configuration</span>
          <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded font-mono shrink-0">
            {options?.financialYear.yearName ?? activeFinancialYear?.yearName ?? 'FY'}
          </span>
        </div>
        <button
          type="button"
          onClick={requestClose}
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
          <aside className="hidden min-[1100px]:flex w-[190px] shrink-0 flex-col min-h-0 bg-[#f4faf7] border-r border-[#789d93]">
            <div className="shrink-0 px-2 py-1.5 bg-[#d7e8e2] border-b border-[#789d93] font-bold uppercase tracking-wider text-[10px] text-slate-600 flex items-center justify-between">
              <span>Report Name</span>
              <span className="font-mono">{options.formats.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {options.formats.map((format, index) => formatRow(format, index, () => selectFormat(format)))}
            </div>
            <div className="shrink-0 px-1.5 py-1 border-t border-[#789d93] text-[9px] leading-tight text-slate-600 space-y-0.5">
              <p><span className="font-bold text-emerald-700">READY</span> - full support</p>
              <p><span className="font-bold text-amber-700">PARTIAL</span> - real data, some fields missing</p>
              <p><span className="font-bold text-slate-500">N/A</span> - source field does not exist</p>
            </div>
          </aside>

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
              <div className="bg-white border border-[#789d93] rounded px-2 py-1.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">
                      Report: {selectedFormat ? selectedFormat.label : 'Select a report name'}
                      <span className="mx-1 text-slate-400">|</span>
                      <span className="font-mono text-[10px] text-slate-500">{modeText}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      Grouping: {selectedFormat && selectedFormat.groupBy.length > 0 ? selectedFormat.groupBy.map(columnLabel).join(' > ') : 'one row per bill'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="min-[1100px]:hidden h-7 px-2 shrink-0 rounded border border-[#789d93] bg-[#eef5f2] font-bold text-slate-700 hover:bg-white cursor-pointer flex items-center gap-1"
                    title="Open the report name list"
                  >
                    <List className="w-3.5 h-3.5" /> Reports ({options.formats.length})
                  </button>
                  {selectedFormat && selectedFormat.support === 'PARTIAL' && (
                    <p className="hidden md:block max-w-md text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                      {selectedFormat.reason}
                    </p>
                  )}
                </div>
                {selectedFormat && selectedFormat.support === 'PARTIAL' && (
                  <p className="md:hidden mt-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                    {selectedFormat.reason}
                  </p>
                )}
              </div>

              <div className="bg-white border border-[#789d93] rounded p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Bill Date</div>
                  <span className="text-[9px] text-slate-500 truncate">
                    FY {options.financialYear.yearName}: {options.financialYear.startDate} to {options.financialYear.endDate}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 max-w-md">
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
                </div>
              </div>
              <div className="bg-white border border-[#789d93] rounded p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filters</div>
                  <span className="hidden sm:inline text-[9px] text-slate-500">Unavailable controls are disabled; hover for the reason.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1400px]:grid-cols-4 gap-x-2 gap-y-1.5">
                  <Field label="1. Sales / Purchase">
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
                  </Field>

                  <Field label="2. Company Selection">
                    <input type="text" readOnly value={'1. Current - ' + options.company.name} title={options.company.name} className={fieldClass} />
                  </Field>

                  <Field label="3. Book">
                    <SearchSelect
                      value={form.bookId}
                      options={options.books}
                      onChange={(next) => patch({ bookId: next })}
                      allLabel="All Books"
                      emptyLabel="No books found"
                    />
                  </Field>

                  <Field label="4. Schedule">
                    <select disabled title={unavailableReason('schedule')} className={fieldClass}>
                      <option>Not available</option>
                    </select>
                  </Field>

                  <Field label="5. Party Group">
                    <SearchSelect
                      value={form.partyGroupId}
                      options={options.partyGroups}
                      onChange={(next) => narrowParties(next, form.areaId)}
                      allLabel="All Party Groups"
                      emptyLabel="No party groups yet"
                      title="Party groups are maintained in Master Data."
                    />
                  </Field>

                  <Field label="5.1 Area">
                    <SearchSelect
                      value={form.areaId}
                      options={options.areas}
                      onChange={(next) => narrowParties(form.partyGroupId, next)}
                      allLabel="All Areas"
                      emptyLabel="No areas yet"
                      title="Areas are maintained in Master Data."
                    />
                  </Field>

                  <Field label="6. Party">
                    <SearchSelect
                      value={form.partyId}
                      options={partyOptions}
                      onChange={(next) => patch({ partyId: next })}
                      allLabel="All Parties"
                      emptyLabel={
                        form.partyGroupId || form.areaId ? 'No parties in this group / area' : 'No parties found'
                      }
                      title="The list narrows to the selected party group and area."
                    />
                  </Field>

                  <Field label="7. Delivery Party">
                    <SearchSelect
                      value={form.deliveryPartyId}
                      options={options.parties}
                      onChange={(next) => patch({ deliveryPartyId: next })}
                      allLabel="All Delivery Parties"
                      emptyLabel="No parties found"
                      title="Matches the delivery party recorded on the purchase bill."
                    />
                  </Field>

                  <Field label="8. Item" hint={options.itemFilter.note}>
                    <SearchSelect
                      value={form.itemId}
                      options={options.items}
                      onChange={(next) => patch({ itemId: next })}
                      allLabel="All Items"
                      emptyLabel="No items found"
                      disabled={options.items.length === 0}
                      title={options.itemFilter.note}
                    />
                  </Field>

                  <Field label="8.1 Item Group">
                    <SearchSelect
                      value={form.itemGroup}
                      options={options.itemGroups}
                      onChange={(next) => patch({ itemGroup: next })}
                      allLabel="All Item Groups"
                      emptyLabel="No item groups yet"
                      disabled={options.itemGroups.length === 0}
                    />
                  </Field>

                  <Field label="9. Broker">
                    <SearchSelect
                      value={form.brokerId}
                      options={options.brokers}
                      onChange={(next) => patch({ brokerId: next })}
                      allLabel="All Brokers"
                      emptyLabel="No brokers yet"
                    />
                  </Field>

                  <Field label="10. Detail / Summary">
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
                  </Field>

                  <Field label="11. Sales Person">
                    <SearchSelect
                      value={form.salespersonId}
                      options={options.salespersons}
                      onChange={(next) => patch({ salespersonId: next })}
                      allLabel="All Sales Persons"
                      emptyLabel="No salespersons yet"
                    />
                  </Field>

                  <Field label="16. Quantity Columns">
                    <select disabled title="Only the stored document quantity exists; no alternate quantity configuration is defined." className={fieldClass}>
                      <option>Stored quantity only</option>
                    </select>
                  </Field>

                  <Field label="17. Column Selection" className="sm:col-span-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        value={layoutName === 'Standard' ? 'STANDARD' : 'SELECTED'}
                        onChange={(event) => handleColumnMode(event.target.value as 'STANDARD' | 'SELECTED')}
                        className={fieldClass + ' flex-1 min-w-[110px]'}
                      >
                        <option value="STANDARD">1. Standard</option>
                        <option value="SELECTED">2. Selected</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleColumnMode('NEW')}
                        className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        3. New
                      </button>
                      <button
                        type="button"
                        onClick={() => handleColumnMode('EDIT')}
                        className="h-7 px-2 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                      >
                        4. Edit
                      </button>
                    </div>
                  </Field>

                  <Field label="18. Transporter">
                    <SearchSelect
                      value={form.transporterId}
                      options={options.transporters}
                      onChange={(next) => patch({ transporterId: next })}
                      allLabel="All Transporters"
                      emptyLabel="No transporters yet"
                    />
                  </Field>

                  <Field label="18.1 Vehicle">
                    <SearchSelect
                      value={form.vehicle}
                      options={options.vehicles}
                      onChange={(next) => patch({ vehicle: next })}
                      allLabel="All Vehicles"
                      emptyLabel="No vehicles recorded"
                      title="Vehicle numbers recorded on purchase bills and debit notes."
                    />
                  </Field>

                  <Field label="City">
                    <SearchSelect
                      value={form.partyCity}
                      options={options.cities}
                      onChange={(next) => patch({ partyCity: next })}
                      allLabel="All Cities"
                      emptyLabel="No cities found"
                      disabled={options.cities.length === 0}
                    />
                  </Field>

                  <Field label="Quality">
                    <SearchSelect
                      value={form.quality}
                      options={options.qualities}
                      onChange={(next) => patch({ quality: next })}
                      allLabel="All Qualities"
                      emptyLabel="No qualities found"
                      disabled={options.qualities.length === 0}
                      title={
                        options.qualities.length === 0
                          ? 'No Yarn Quality master records exist for this company.'
                          : 'Quality is read from the yarn quality recorded on the document lines.'
                      }
                    />
                  </Field>

                  <Field label="13. Print Item Details?">
                    <label className="flex h-7 items-center gap-1.5 rounded border border-[#789d93] bg-white px-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.printItemDetails}
                        onChange={(event) => patch({ printItemDetails: event.target.checked })}
                        className="accent-[#2c5f57]"
                      />
                      <span className="font-semibold text-slate-700 truncate">{form.printItemDetails ? 'Yes - stored item lines' : 'No - bill rows only'}</span>
                    </label>
                  </Field>

                  <Field label="14. Rate Column">
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
                  </Field>

                  <Field label="14.1 Rate Filter From">
                    <input
                      type="number"
                      step="0.01"
                      value={form.rateFrom}
                      onChange={(event) => patch({ rateFrom: event.target.value })}
                      placeholder="Any"
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="14.1 Rate Filter To">
                    <input
                      type="number"
                      step="0.01"
                      value={form.rateTo}
                      onChange={(event) => patch({ rateTo: event.target.value })}
                      placeholder="Any"
                      className={fieldClass}
                    />
                  </Field>

                  <Field label="15. Wise Type">
                    <select disabled title={unavailableReason('wiseType')} className={fieldClass}>
                      <option>Not available</option>
                    </select>
                  </Field>

                  <Field label="Attrib 1">
                    <select disabled title={unavailableReason('attributes')} className={fieldClass}>
                      <option>Not available</option>
                    </select>
                  </Field>

                  <Field label="Attrib 2">
                    <select disabled title={unavailableReason('attributes')} className={fieldClass}>
                      <option>Not available</option>
                    </select>
                  </Field>

                  <Field label="Attrib 3">
                    <select disabled title={unavailableReason('attributes')} className={fieldClass}>
                      <option>Not available</option>
                    </select>
                  </Field>

                  <Field label="Saved Layout (PostgreSQL)" className="sm:col-span-2">
                    <select
                      value={activeLayoutId ?? ''}
                      onChange={(event) => applySavedLayout(event.target.value)}
                      disabled={layouts.length === 0 || layoutBusy}
                      title="Saved layouts belong to the active company and are stored in PostgreSQL."
                      className={fieldClass}
                    >
                      <option value="">{layouts.length === 0 ? 'No saved layouts yet' : 'Select a saved layout'}</option>
                      {layouts.map((layout) => (
                        <option key={layout.id} value={layout.id}>
                          {layout.name} ({layout.columns.length} columns){layout.isDefault ? ' - default' : ''}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void saveActiveLayout()}
                        disabled={!activeLayoutId || layoutBusy}
                        title="Save the current columns into the loaded layout"
                        className="h-6 px-1.5 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => void renameActiveLayout()}
                        disabled={!activeLayoutId || layoutBusy}
                        title="Rename the loaded layout"
                        className="h-6 px-1.5 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => void setDefaultActiveLayout()}
                        disabled={!activeLayoutId || layoutBusy}
                        title="Mark the loaded layout as the default for this company"
                        className="h-6 px-1.5 rounded border border-[#789d93] bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                      >
                        Set Default
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteActiveLayout()}
                        disabled={!activeLayoutId || layoutBusy}
                        title="Delete the loaded layout for this company"
                        className="h-6 px-1.5 rounded border border-red-300 bg-red-50 font-bold text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-40"
                      >
                        Delete
                      </button>
                      {layoutBusy && <Loader2 className="w-3 h-3 animate-spin text-[#2c5f57]" />}
                    </div>
                  </Field>

                  <Field label="Include Cancelled">
                    <label className="flex h-7 items-center gap-1.5 rounded border border-[#789d93] bg-white px-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.includeCancelled}
                        onChange={(event) => patch({ includeCancelled: event.target.checked })}
                        className="accent-[#2c5f57]"
                      />
                      <span className="font-semibold text-slate-700 truncate">{form.includeCancelled ? 'Cancelled included' : 'Cancelled excluded'}</span>
                    </label>
                  </Field>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-dashed border-slate-300 pt-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Active filters ({filterChips.length})
                  </span>
                  {filterChips.length === 0 && (
                    <span className="text-[10px] text-slate-500">None - the whole financial year is included.</span>
                  )}
                  {filterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      title="Remove this filter"
                      onClick={() => patch({ [chip.key]: '' } as Partial<FormState>)}
                      className="h-5 px-1.5 rounded-full bg-[#2c5f57] text-white text-[10px] font-semibold flex items-center gap-1 hover:bg-[#1f4842] cursor-pointer"
                    >
                      <span className="max-w-[170px] truncate">{chip.label}</span>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ))}
                  {filterChips.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="h-5 px-1.5 rounded-full border border-red-300 bg-red-50 text-red-700 text-[10px] font-bold hover:bg-red-100 cursor-pointer"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                  <Columns3 className="w-3.5 h-3.5 text-[#2c5f57] shrink-0" />
                  <span className="font-bold text-slate-700 whitespace-nowrap">{layoutName}</span>
                  <span>-</span>
                  <span className="whitespace-nowrap">{columns.length} columns</span>
                  <span className="truncate text-slate-500">{columns.map(columnLabel).join(', ')}</span>
                </div>

                {layoutNotice && (
                  <div className="mt-1 text-[10px] text-slate-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
                    {layoutNotice}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5 space-y-1">
              {error && (
                <div className="flex items-start gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
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
                <span className="hidden md:inline text-[10px] text-slate-600">
                  Page Down previews. Enter never submits this screen. Esc closes.
                </span>
                <button
                  type="button"
                  onClick={requestClose}
                  className="ml-auto h-8 px-3 rounded border border-slate-300 bg-white font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && options && (
        <div className="fixed inset-0 z-[70] bg-black/50 min-[1100px]:hidden" onClick={() => setSidebarOpen(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-[#f4faf7] flex flex-col border-r border-[#789d93] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 px-2 py-1.5 bg-[#2c5f57] text-white font-bold flex items-center justify-between">
              <span className="uppercase tracking-wider text-[10px]">Report Name ({options.formats.length})</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="hover:text-red-300 cursor-pointer" aria-label="Close report list">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {options.formats.map((format, index) =>
                formatRow(format, index, () => {
                  selectFormat(format);
                  setSidebarOpen(false);
                })
              )}
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
          layoutName={selector.allowSave ? (selector.mode === 'edit' ? layoutName : '') : layoutName}
          allowSave={selector.allowSave}
          requiredColumns={options.requiredColumns}
          onCancel={() => setSelector((prev) => ({ ...prev, open: false }))}
          onApply={(nextColumns, nextName) => {
            void applyColumns(nextColumns, nextName);
          }}
        />
      )}
    </div>
  );
};
