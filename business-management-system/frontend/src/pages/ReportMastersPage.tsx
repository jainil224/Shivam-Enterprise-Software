import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Database,
  Edit2,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  createArea,
  createBroker,
  createItemGroup,
  createPartyGroup,
  createPurchaseBook,
  createSalesperson,
  createTransporter,
  getAreas,
  getBrokers,
  getFinancialYears,
  getItemGroups,
  getPartyGroups,
  getPurchaseBooks,
  getSalespersons,
  getTransporters,
  setAreaStatus,
  setBrokerStatus,
  setItemGroupStatus,
  setPartyGroupStatus,
  setPurchaseBookStatus,
  setSalespersonStatus,
  setTransporterStatus,
  updateArea,
  updateBroker,
  updateItemGroup,
  updatePartyGroup,
  updatePurchaseBook,
  updateSalesperson,
  updateTransporter,
} from '../services/api';
import type { FinancialYear, MasterListParams } from '../types';

type MasterKey =
  | 'party-groups'
  | 'areas'
  | 'brokers'
  | 'transporters'
  | 'salespersons'
  | 'item-groups'
  | 'purchase-books';

type MasterRow = Record<string, unknown> & { id: string; isActive: boolean };

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  uppercase?: boolean;
  hint?: string;
}

interface MasterConfig {
  key: MasterKey;
  title: string;
  singular: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  nameKey: string;
  fields: FieldDef[];
  columns: Array<{ key: string; label: string; mono?: boolean }>;
  list: (params: MasterListParams) => Promise<MasterRow[]>;
  create: (payload: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, payload: Record<string, unknown>) => Promise<unknown>;
  setStatus: (id: string, isActive: boolean) => Promise<unknown>;
  needsFinancialYear?: boolean;
}

const asRows = (data: unknown): MasterRow[] => (Array.isArray(data) ? (data as MasterRow[]) : []);

const MASTERS: MasterConfig[] = [
  {
    key: 'party-groups',
    title: 'Party Groups',
    singular: 'Party Group',
    description: 'Groups used by the Group + Party Wise report format and the party master.',
    icon: Layers,
    nameKey: 'groupName',
    fields: [
      { key: 'groupName', label: 'Group name', required: true, placeholder: 'e.g. Yarn Suppliers', maxLength: 80 },
      { key: 'description', label: 'Description', placeholder: 'Optional note', maxLength: 255 },
    ],
    columns: [
      { key: 'groupName', label: 'Group Name' },
      { key: 'description', label: 'Description' },
    ],
    list: async (params) => asRows(await getPartyGroups(params)),
    create: (payload) => createPartyGroup(payload),
    update: (id, payload) => updatePartyGroup(id, payload),
    setStatus: (id, isActive) => setPartyGroupStatus(id, isActive),
  },
  {
    key: 'areas',
    title: 'Areas',
    singular: 'Area',
    description: 'Sales and delivery areas used by the Area Wise report format.',
    icon: MapPin,
    nameKey: 'areaName',
    fields: [
      { key: 'areaName', label: 'Area name', required: true, placeholder: 'e.g. Ring Road', maxLength: 80 },
      { key: 'description', label: 'Description', placeholder: 'Optional note', maxLength: 255 },
    ],
    columns: [
      { key: 'areaName', label: 'Area Name' },
      { key: 'description', label: 'Description' },
    ],
    list: async (params) => asRows(await getAreas(params)),
    create: (payload) => createArea(payload),
    update: (id, payload) => updateArea(id, payload),
    setStatus: (id, isActive) => setAreaStatus(id, isActive),
  },
  {
    key: 'brokers',
    title: 'Brokers',
    singular: 'Broker',
    description: 'Commission brokers recorded on purchase bills and debit notes.',
    icon: Users,
    nameKey: 'brokerName',
    fields: [
      { key: 'brokerCode', label: 'Broker code', required: true, placeholder: 'e.g. BR-01', maxLength: 20, uppercase: true },
      { key: 'brokerName', label: 'Broker name', required: true, placeholder: 'e.g. Mahesh Broker', maxLength: 120 },
      { key: 'phone', label: 'Phone', placeholder: '10-digit mobile number', maxLength: 10 },
    ],
    columns: [
      { key: 'brokerCode', label: 'Code', mono: true },
      { key: 'brokerName', label: 'Broker Name' },
      { key: 'phone', label: 'Phone', mono: true },
    ],
    list: async (params) => asRows(await getBrokers(params)),
    create: (payload) => createBroker(payload),
    update: (id, payload) => updateBroker(id, payload),
    setStatus: (id, isActive) => setBrokerStatus(id, isActive),
  },
  {
    key: 'transporters',
    title: 'Transporters',
    singular: 'Transporter',
    description: 'Transporters used by the Transporter Wise report format.',
    icon: Truck,
    nameKey: 'transporterName',
    fields: [
      { key: 'transporterCode', label: 'Transporter code', required: true, placeholder: 'e.g. TR-01', maxLength: 20, uppercase: true },
      { key: 'transporterName', label: 'Transporter name', required: true, placeholder: 'e.g. Shree Roadlines', maxLength: 120 },
      { key: 'phone', label: 'Phone', placeholder: '10-digit mobile number', maxLength: 10 },
    ],
    columns: [
      { key: 'transporterCode', label: 'Code', mono: true },
      { key: 'transporterName', label: 'Transporter Name' },
      { key: 'phone', label: 'Phone', mono: true },
    ],
    list: async (params) => asRows(await getTransporters(params)),
    create: (payload) => createTransporter(payload),
    update: (id, payload) => updateTransporter(id, payload),
    setStatus: (id, isActive) => setTransporterStatus(id, isActive),
  },
  {
    key: 'salespersons',
    title: 'Sales Persons',
    singular: 'Sales Person',
    description: 'Salespersons recorded on purchase bills and debit notes.',
    icon: Wallet,
    nameKey: 'salespersonName',
    fields: [
      { key: 'salespersonCode', label: 'Salesperson code', required: true, placeholder: 'e.g. SP-01', maxLength: 20, uppercase: true },
      { key: 'salespersonName', label: 'Salesperson name', required: true, placeholder: 'e.g. Nilesh Patel', maxLength: 120 },
      { key: 'phone', label: 'Phone', placeholder: '10-digit mobile number', maxLength: 10 },
    ],
    columns: [
      { key: 'salespersonCode', label: 'Code', mono: true },
      { key: 'salespersonName', label: 'Salesperson Name' },
      { key: 'phone', label: 'Phone', mono: true },
    ],
    list: async (params) => asRows(await getSalespersons(params)),
    create: (payload) => createSalesperson(payload),
    update: (id, payload) => updateSalesperson(id, payload),
    setStatus: (id, isActive) => setSalespersonStatus(id, isActive),
  },
  {
    key: 'item-groups',
    title: 'Item Groups',
    singular: 'Item Group',
    description: 'Item groups used by the item master and the item group report filter.',
    icon: Boxes,
    nameKey: 'groupName',
    fields: [
      { key: 'groupName', label: 'Group name', required: true, placeholder: 'e.g. Polyester Yarn', maxLength: 80 },
      { key: 'description', label: 'Description', placeholder: 'Optional note', maxLength: 255 },
    ],
    columns: [
      { key: 'groupName', label: 'Group Name' },
      { key: 'description', label: 'Description' },
    ],
    list: async (params) => asRows(await getItemGroups(params)),
    create: (payload) => createItemGroup(payload),
    update: (id, payload) => updateItemGroup(id, payload),
    setStatus: (id, isActive) => setItemGroupStatus(id, isActive),
  },
  {
    key: 'purchase-books',
    title: 'Purchase Books',
    singular: 'Purchase Book',
    description: 'Purchase book registers that number and group purchase bills per financial year.',
    icon: Tag,
    nameKey: 'bookName',
    needsFinancialYear: true,
    fields: [
      { key: 'bookName', label: 'Book name', required: true, placeholder: 'e.g. Yarn Purchase Book', maxLength: 60 },
      { key: 'prefix', label: 'Bill prefix', required: true, placeholder: 'e.g. PB-', maxLength: 12, uppercase: true },
    ],
    columns: [
      { key: 'bookName', label: 'Book Name' },
      { key: 'prefix', label: 'Prefix', mono: true },
    ],
    list: async (params) => asRows(await getPurchaseBooks(params)),
    create: (payload) => createPurchaseBook(payload),
    update: (id, payload) => updatePurchaseBook(id, payload),
    setStatus: (id, isActive) => setPurchaseBookStatus(id, isActive),
  },
];

export const ReportMastersPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [activeKey, setActiveKey] = useState<MasterKey>('party-groups');
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);

  const config = useMemo(
    () => MASTERS.find((entry) => entry.key === activeKey) ?? MASTERS[0],
    [activeKey]
  );

  const flash = useCallback((message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 3500);
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    let cancelled = false;
    getFinancialYears(activeCompany.id)
      .then((data) => {
        if (!cancelled) setFinancialYears(data);
      })
      .catch(() => {
        if (!cancelled) setFinancialYears([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompany]);

  const loadRows = useCallback(async () => {
    if (!activeCompany) return;
    if (config.needsFinancialYear && !activeFinancialYear) {
      setRows([]);
      setLoading(false);
      setError('Select a financial year to manage purchase books.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params: MasterListParams & { financialYearId?: string } = {
        includeInactive,
        search: search.trim() || undefined,
      };
      if (config.needsFinancialYear) params.financialYearId = activeFinancialYear?.id;
      setRows(await config.list(params));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ' + config.title.toLowerCase() + '.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany, activeFinancialYear, config, includeInactive, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRows();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  const openCreate = () => {
    setEditingId(null);
    setFieldErrors({});
    const blank: Record<string, string> = {};
    config.fields.forEach((field) => {
      blank[field.key] = '';
    });
    setForm(blank);
    setFormOpen(true);
  };

  const openEdit = (row: MasterRow) => {
    setEditingId(row.id);
    setFieldErrors({});
    const next: Record<string, string> = {};
    config.fields.forEach((field) => {
      const value = row[field.key];
      next[field.key] = value === null || value === undefined ? '' : String(value);
    });
    setForm(next);
    setFormOpen(true);
  };

  const submit = async () => {
    const errors: Record<string, string> = {};
    config.fields.forEach((field) => {
      if (field.required && (form[field.key] ?? '').trim().length === 0) {
        errors[field.key] = field.label + ' is required.';
      }
    });
    if (config.needsFinancialYear && !activeFinancialYear) {
      errors.financialYearId = 'A financial year must be selected.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: Record<string, unknown> = {};
    config.fields.forEach((field) => {
      const raw = (form[field.key] ?? '').trim();
      payload[field.key] = field.uppercase ? raw.toUpperCase() : raw === '' ? null : raw;
    });
    if (config.needsFinancialYear) payload.financialYearId = activeFinancialYear?.id;

    setSaving(true);
    setFieldErrors({});
    setError(null);
    try {
      if (editingId) {
        await config.update(editingId, payload);
        flash(config.singular + ' updated successfully.');
      } else {
        await config.create(payload);
        flash(config.singular + ' created successfully.');
      }
      setFormOpen(false);
      setEditingId(null);
      await loadRows();
    } catch (err) {
      const details = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      if (details && details.length > 0) {
        const mapped: Record<string, string> = {};
        details.forEach((detail) => {
          mapped[detail.field] = detail.message;
        });
        setFieldErrors(mapped);
      }
      setError(err instanceof Error ? err.message : 'Failed to save ' + config.singular.toLowerCase() + '.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: MasterRow) => {
    setError(null);
    try {
      await config.setStatus(row.id, !row.isActive);
      flash(config.singular + (row.isActive ? ' deactivated.' : ' activated.'));
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change status.');
    }
  };

  const cellValue = (row: MasterRow, key: string): string => {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  };

  const inputClass =
    'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#2c5f57] disabled:bg-slate-100';

  const renderForm = () => (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-3">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {(editingId ? 'Edit ' : 'New ') + config.singular}
            </h3>
            <p className="text-[10px] text-slate-500">Company scoped - saved in PostgreSQL.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="p-1 rounded text-slate-500 hover:bg-slate-100"
            aria-label="Close form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2.5">
          {config.needsFinancialYear && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                Financial Year
              </label>
              <input
                readOnly
                value={activeFinancialYear ? activeFinancialYear.yearName : 'No financial year selected'}
                className={inputClass + ' bg-slate-50'}
              />
              {financialYears.length > 1 && (
                <p className="mt-0.5 text-[9px] text-slate-500">
                  Switch the active financial year from the top bar to manage another year.
                </p>
              )}
            </div>
          )}

          {config.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5">
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              <input
                type="text"
                value={form[field.key] ?? ''}
                maxLength={field.maxLength}
                placeholder={field.placeholder}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((prev) => ({ ...prev, [field.key]: field.uppercase ? value.toUpperCase() : value }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submit();
                }}
                className={inputClass + (field.uppercase ? ' font-mono uppercase' : '')}
              />
              {fieldErrors[field.key] && (
                <p className="mt-0.5 text-[10px] font-semibold text-rose-600">{fieldErrors[field.key]}</p>
              )}
            </div>
          ))}

          {error && (
            <p className="text-[10px] font-semibold text-rose-600 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2c5f57] hover:bg-[#244d47] text-white flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editingId ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-slate-900 transition-colors">
          Dashboard
        </button>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-400">Master Management</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="font-semibold text-slate-800">Report Masters</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#2c5f57] text-white rounded-xl shadow-sm">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Report Masters</h1>
            <p className="text-xs text-slate-500">
              Party groups, areas, brokers, transporters, salespersons, item groups and purchase books used by the
              Sales &amp; Purchase Bill Base report.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadRows()}
            title="Refresh list"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          </button>
          <button
            onClick={openCreate}
            className="px-3.5 py-2 bg-[#2c5f57] hover:bg-[#244d47] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add {config.singular}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
        {MASTERS.map((entry) => {
          const Icon = entry.icon;
          const active = entry.key === config.key;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setActiveKey(entry.key);
                setSearch('');
                setFormOpen(false);
                setError(null);
              }}
              className={
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ' +
                (active
                  ? 'bg-[#2c5f57] border-[#2c5f57] text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-[#2c5f57] hover:text-[#2c5f57]')
              }
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{entry.title}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-500">{config.description}</p>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={'Search ' + config.title.toLowerCase() + '...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2c5f57] bg-white"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
            className="rounded border-slate-300 accent-[#2c5f57]"
          />
          <span>Show inactive</span>
        </label>
      </div>

      {loading ? (
        <div className="py-14 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57]" />
          <span>Loading {config.title.toLowerCase()}...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-14 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300 space-y-2">
          <Database className="w-9 h-9 text-slate-300 mx-auto" />
          <p className="font-semibold text-slate-700">No {config.title.toLowerCase()} found</p>
          <p className="text-slate-400">
            {search
              ? 'No record matches "' + search + '". Clear the search to see everything.'
              : 'Create the first ' + config.singular.toLowerCase() + ' to use it in the report.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key} className="px-3 py-2.5">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80">
                    {config.columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={
                          'px-3 py-2 ' +
                          (index === 0 ? 'font-bold text-slate-900 ' : 'text-slate-600 ') +
                          (column.mono ? 'font-mono' : '')
                        }
                      >
                        {cellValue(row, column.key)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ' +
                          (row.isActive
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200')
                        }
                      >
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(row)}
                          title="Edit record"
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#2c5f57] hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => void toggleStatus(row)}
                          className={
                            'px-2 py-1 rounded text-[11px] font-semibold border transition-colors ' +
                            (row.isActive
                              ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100')
                          }
                        >
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex flex-wrap justify-between gap-1">
            <span>
              Showing {rows.length} {config.title.toLowerCase()}
              {includeInactive ? ' (including inactive)' : ' (active only)'}
            </span>
            <span className="font-mono text-slate-400">{activeCompany?.companyCode}</span>
          </div>
        </div>
      )}

      {formOpen && renderForm()}
    </div>
  );
};

export default ReportMastersPage;