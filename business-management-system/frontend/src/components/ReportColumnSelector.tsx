import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Search, Trash2, X } from 'lucide-react';
import type { ReportColumnDef } from '../types/reports';

interface ReportColumnSelectorProps {
  open: boolean;
  title: string;
  allColumns: ReportColumnDef[];
  selected: string[];
  layoutName: string;
  allowSave: boolean;
  requiredColumns?: string[];
  onCancel: () => void;
  onApply: (columns: string[], layoutName: string) => void;
}

export const ReportColumnSelector: React.FC<ReportColumnSelectorProps> = ({
  open,
  title,
  allColumns,
  selected,
  layoutName,
  allowSave,
  requiredColumns = [],
  onCancel,
  onApply,
}) => {
  const [rightList, setRightList] = useState<string[]>([]);
  const [leftChecked, setLeftChecked] = useState<string[]>([]);
  const [rightChecked, setRightChecked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState(layoutName);
  const [error, setError] = useState<string | null>(null);

  const labelOf = useMemo(() => {
    const map = new Map<string, string>();
    allColumns.forEach((column) => map.set(column.key, column.label));
    return map;
  }, [allColumns]);

  useEffect(() => {
    if (!open) return;
    const allowed = new Set(allColumns.map((column) => column.key));
    const initial = selected.filter((key) => allowed.has(key));
    setRightList(initial.length > 0 ? initial : allColumns.map((column) => column.key));
    setLeftChecked([]);
    setRightChecked([]);
    setSearch('');
    setName(layoutName);
    setError(null);
  }, [open, selected, allColumns, layoutName]);

  if (!open) return null;

  const leftColumns = allColumns.filter((column) => {
    if (rightList.includes(column.key)) return false;
    const query = search.trim().toLowerCase();
    if (query.length === 0) return true;
    return column.label.toLowerCase().includes(query) || column.key.toLowerCase().includes(query);
  });

  const toggleLeft = (key: string) => {
    setLeftChecked((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const toggleRight = (key: string) => {
    setRightChecked((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  };

  const addChecked = () => {
    if (leftChecked.length === 0) return;
    const ordered = allColumns.map((column) => column.key).filter((key) => leftChecked.includes(key));
    setRightList((prev) => [...prev, ...ordered.filter((key) => !prev.includes(key))]);
    setLeftChecked([]);
    setError(null);
  };

  const addAllFiltered = () => {
    const ordered = leftColumns.map((column) => column.key);
    if (ordered.length === 0) return;
    setRightList((prev) => [...prev, ...ordered.filter((key) => !prev.includes(key))]);
    setLeftChecked([]);
    setError(null);
  };

  const removableChecked = rightChecked.filter((key) => !requiredColumns.includes(key));

  const removeChecked = () => {
    if (removableChecked.length === 0) return;
    setRightList((prev) => prev.filter((key) => !removableChecked.includes(key)));
    setRightChecked([]);
    setError(null);
  };

  const removeAll = () => {
    setRightList((prev) => prev.filter((key) => requiredColumns.includes(key)));
    setRightChecked([]);
    setError(null);
  };

  const move = (direction: -1 | 1) => {
    if (rightChecked.length === 0) return;
    setRightList((prev) => {
      const next = prev.slice();
      const indexes = next
        .map((key, index) => (rightChecked.includes(key) ? index : -1))
        .filter((index) => index >= 0);
      if (indexes.length === 0) return next;
      const ordered = direction === -1 ? indexes : indexes.slice().reverse();
      for (const index of ordered) {
        const target = index + direction;
        if (target < 0 || target >= next.length) continue;
        if (rightChecked.includes(next[target])) continue;
        const temp = next[target];
        next[target] = next[index];
        next[index] = temp;
      }
      return next;
    });
  };

  const apply = () => {
    if (rightList.length === 0) {
      setError('Select at least one column before applying.');
      return;
    }
    const missing = requiredColumns.filter((key) => !rightList.includes(key));
    if (missing.length > 0) {
      setError(
        'Required column(s) cannot be removed: ' +
          missing.map((key) => labelOf.get(key) ?? key).join(', ') +
          '.'
      );
      return;
    }
    if (allowSave && name.trim().length === 0) {
      setError('Enter a layout name before saving.');
      return;
    }
    onApply(rightList, name.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded border border-[#2c5f57] shadow-2xl flex flex-col max-h-[88vh] text-xs">
        <div className="bg-[#2c5f57] text-white px-3 py-2 font-bold flex items-center justify-between">
          <span>{title}</span>
          <button type="button" onClick={onCancel} className="hover:text-red-300 cursor-pointer" aria-label="Close column selection">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden">
          {/* All Columns */}
          <div className="border border-slate-300 rounded flex flex-col min-h-0">
            <div className="px-2 py-1.5 bg-slate-100 border-b border-slate-300 font-bold text-slate-700 flex items-center justify-between">
              <span>All Columns</span>
              <span className="font-mono text-[10px] text-slate-500">{leftColumns.length} available</span>
            </div>
            <div className="p-2 border-b border-slate-200">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search columns..."
                  className="w-full h-7 pl-7 pr-2 border border-slate-300 rounded text-[11px] focus:outline-none focus:border-[#2c5f57]"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1.5" />
              </div>
            </div>
            <div className="overflow-auto flex-1 min-h-[180px] max-h-[42vh]">
              {leftColumns.length === 0 ? (
                <p className="p-4 text-center text-slate-500 italic">Every available column is already selected.</p>
              ) : (
                leftColumns.map((column) => (
                  <label
                    key={column.key}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-emerald-50 cursor-pointer border-b border-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={leftChecked.includes(column.key)}
                      onChange={() => toggleLeft(column.key)}
                      className="accent-[#2c5f57]"
                    />
                    <span className="text-slate-800">{column.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-400">{column.type}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Selected Columns */}
          <div className="border border-slate-300 rounded flex flex-col min-h-0">
            <div className="px-2 py-1.5 bg-slate-100 border-b border-slate-300 font-bold text-slate-700 flex items-center justify-between">
              <span>Selected Columns</span>
              <span className="font-mono text-[10px] text-slate-500">{rightList.length} selected</span>
            </div>
            <div className="p-2 border-b border-slate-200 flex flex-wrap gap-1">
              <button type="button" onClick={addChecked} disabled={leftChecked.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                <Plus className="w-3 h-3" /> Add
              </button>
              <button type="button" onClick={addAllFiltered} disabled={leftColumns.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                Add All
              </button>
              <button type="button" onClick={removeChecked} disabled={removableChecked.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-red-300 bg-red-50 text-red-700 hover:bg-red-100">
                <Trash2 className="w-3 h-3" /> Remove
              </button>
              <button type="button" onClick={removeAll} disabled={rightList.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-red-300 bg-red-50 text-red-700 hover:bg-red-100">
                Remove All
              </button>
              <button type="button" onClick={() => move(-1)} disabled={rightChecked.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                <ArrowUp className="w-3 h-3" /> Up
              </button>
              <button type="button" onClick={() => move(1)} disabled={rightChecked.length === 0} className="px-2 py-1 rounded border font-bold cursor-pointer flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border-slate-300 bg-white text-slate-700 hover:bg-slate-100">
                <ArrowDown className="w-3 h-3" /> Down
              </button>
            </div>
            <div className="overflow-auto flex-1 min-h-[180px] max-h-[42vh]">
              {rightList.length === 0 ? (
                <p className="p-4 text-center text-slate-500 italic">No columns selected yet.</p>
              ) : (
                rightList.map((key, index) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-emerald-50 cursor-pointer border-b border-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={rightChecked.includes(key)}
                      onChange={() => toggleRight(key)}
                      disabled={requiredColumns.includes(key)}
                      title={requiredColumns.includes(key) ? 'This column is required and cannot be removed.' : undefined}
                      className="accent-[#2c5f57]"
                    />
                    <span className="w-5 text-right font-mono text-[10px] text-slate-400">{index + 1}</span>
                    <span className="text-slate-800">{labelOf.get(key) ?? key}</span>
                    {requiredColumns.includes(key) && (
                      <span className="ml-auto text-[9px] font-bold uppercase text-amber-700">required</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-3 pb-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
            Layout Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Standard"
            className="w-full h-7 px-2 border border-slate-300 rounded text-[11px] focus:outline-none focus:border-[#2c5f57]"
          />
          {error && <p className="mt-1 text-[11px] font-bold text-red-600">{error}</p>}
        </div>

        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1 rounded border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer">
            Cancel
          </button>
          <button type="button" onClick={apply} className="px-3 py-1 rounded bg-[#2c5f57] text-white font-bold hover:bg-[#204741] cursor-pointer flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {allowSave ? 'Save & Apply' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
};
