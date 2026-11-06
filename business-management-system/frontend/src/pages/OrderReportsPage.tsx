import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BarChart3, Loader2, Play, RefreshCcw } from 'lucide-react';
import { getOrderLookups, getOrderReports, runOrderReport } from '../services/api';
import {
  type OrderDocumentType,
  type OrderLookups,
  type OrderReportDefinition,
  type OrderReportResult,
} from '../types/orders';
import { formatDateTime, orderLabels, orderPaths } from './orderPageShared';

interface OrderReportsPageProps {
  documentType: OrderDocumentType;
}

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';

const displayValue = (value: string | number | null): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  return value === '' ? '—' : value;
};

export const OrderReportsPage: React.FC<OrderReportsPageProps> = ({ documentType }) => {
  const navigate = useNavigate();
  const labels = useMemo(() => orderLabels(documentType), [documentType]);
  const paths = useMemo(() => orderPaths(documentType), [documentType]);

  const [reports, setReports] = useState<OrderReportDefinition[]>([]);
  const [lookups, setLookups] = useState<OrderLookups | null>(null);
  const [selectedKey, setSelectedKey] = useState('');
  const [result, setResult] = useState<OrderReportResult | null>(null);
  const [loadingReports, setLoadingReports] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [partyId, setPartyId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [overdue, setOverdue] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingReports(true);
      setError(null);
      try {
        const [definitions, lookupData] = await Promise.all([
          getOrderReports(documentType),
          getOrderLookups(documentType),
        ]);
        if (cancelled) return;
        setReports(definitions);
        setLookups(lookupData);
        setSelectedKey((current) => (current !== '' ? current : definitions[0]?.key ?? ''));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load the report catalogue.');
      } finally {
        if (!cancelled) setLoadingReports(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentType]);

  const runReport = useCallback(
    async (reportKey: string) => {
      if (reportKey === '') return;
      setRunning(true);
      setError(null);
      try {
        const data = await runOrderReport(documentType, reportKey, {
          fromDate: fromDate === '' ? undefined : fromDate,
          toDate: toDate === '' ? undefined : toDate,
          partyId: partyId === '' ? undefined : partyId,
          status: status === '' ? undefined : status,
          search: search.trim() === '' ? undefined : search.trim(),
          overdue: overdue ? true : undefined,
        });
        setResult(data);
      } catch (err) {
        setResult(null);
        const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
        setError(
          apiErrors && apiErrors.length > 0
            ? apiErrors[0].message
            : err instanceof Error
              ? err.message
              : 'Failed to run the report.'
        );
      } finally {
        setRunning(false);
      }
    },
    [documentType, fromDate, toDate, partyId, status, search, overdue]
  );

  useEffect(() => {
    if (selectedKey !== '') void runReport(selectedKey);
  }, [selectedKey, runReport]);

  const selectedDefinition = reports.find((report) => report.key === selectedKey) ?? null;
  const columns = result?.columns ?? selectedDefinition?.columns ?? [];

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-2.5 pb-8">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">{labels.plural} Reports</h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              Read-only analytics over saved order documents
              {lookups ? ` · FY ${lookups.financialYear.yearName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(paths.base)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Register
          </button>
          <button
            type="button"
            onClick={() => void runReport(selectedKey)}
            disabled={running || selectedKey === ''}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
            {running ? 'Running…' : 'Run Report'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[290px_minmax(0,1fr)] gap-2.5 items-start">
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
              Available Reports ({reports.length})
            </span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {loadingReports ? (
              <div className="px-3 py-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto" />
              </div>
            ) : reports.length === 0 ? (
              <p className="px-3 py-6 text-[11px] text-slate-500">No reports are registered.</p>
            ) : (
              reports.map((report) => (
                <button
                  key={report.key}
                  type="button"
                  onClick={() => setSelectedKey(report.key)}
                  className={`w-full text-left px-3 py-1.5 border-b border-slate-100 last:border-b-0 ${
                    selectedKey === report.key ? 'bg-[#2c5f57]/10 border-l-2 border-l-[#2c5f57]' : 'hover:bg-slate-50'
                  }`}
                >
                  <p className="text-[11.5px] font-bold text-slate-800 leading-tight">{report.title}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{report.description}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2.5 min-w-0">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Report Filters</span>
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setPartyId('');
                  setStatus('');
                  setSearch('');
                  setOverdue(false);
                }}
                className="text-[10.5px] font-bold text-[#2c5f57] hover:underline"
              >
                Clear
              </button>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              <div>
                <label className={labelCls}>From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{labels.partyLabel}</label>
                <select value={partyId} onChange={(event) => setPartyId(event.target.value)} className={inputCls}>
                  <option value="">All</option>
                  {(lookups?.parties ?? []).map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.partyName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputCls}>
                  <option value="">All</option>
                  {(lookups?.statuses ?? []).map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Search</label>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void runReport(selectedKey);
                    }
                  }}
                  placeholder="Order no, item, party…"
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-2 pt-4 text-[11.5px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overdue}
                  onChange={(event) => setOverdue(event.target.checked)}
                  className="w-3.5 h-3.5 accent-[#2c5f57]"
                />
                Overdue only
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void runReport(selectedKey)}
                  disabled={running || selectedKey === ''}
                  className="h-8 px-3 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] disabled:bg-slate-400 flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3" />
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  {result?.title ?? selectedDefinition?.title ?? 'Report Result'}
                </span>
                {result && (
                  <span className="ml-2 text-[10px] text-slate-400">
                    {result.rows.length} row{result.rows.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {result && <span className="text-[10px] text-slate-400">Generated {formatDateTime(result.generatedAt)}</span>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-slate-100 text-[9.5px] uppercase tracking-wider text-slate-500">
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-2 py-1.5 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {running ? (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="px-3 py-10 text-center">
                        <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto" />
                      </td>
                    </tr>
                  ) : !result || result.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(columns.length, 1)} className="px-3 py-10 text-center">
                        <p className="text-[12px] font-semibold text-slate-600">No rows for this report</p>
                        <p className="text-[10.5px] text-slate-500 mt-0.5">
                          Widen the date range or clear the filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    result.rows.map((row, rowIndex) => (
                      <tr
                        key={`${rowIndex}-${String(row[columns[0]?.key ?? ''] ?? rowIndex)}`}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-[#2c5f57]/[0.03]"
                      >
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`px-2 py-1 ${
                              column.align === 'right'
                                ? 'text-right font-mono text-slate-700'
                                : 'text-slate-700'
                            }`}
                          >
                            {displayValue(row[column.key] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {result && result.rows.length > 0 && Object.keys(result.totals).length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      {columns.map((column) => {
                        const total = result.totals[column.key];
                        return (
                          <td
                            key={column.key}
                            className={`px-2 py-1.5 text-[11px] font-bold text-slate-800 ${
                              column.align === 'right' ? 'text-right font-mono' : 'text-left'
                            }`}
                          >
                            {total === undefined ? '' : total}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};