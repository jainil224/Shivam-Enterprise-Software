import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface SearchSelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface SearchSelectProps {
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
  /** Label shown for the empty value, e.g. "All Parties". */
  allLabel: string;
  /** Shown when the option list is empty. */
  emptyLabel?: string;
  disabled?: boolean;
  title?: string;
  className?: string;
  /** Extra classes for the popup panel. */
  panelClassName?: string;
}

/**
 * Phase 15.2 - searchable single-select.
 * Native selects cannot be searched, so the report filters use this control:
 * it keeps the compact 28px height of the rest of the configuration screen but
 * opens a filterable list and supports keyboard navigation.
 */
export const SearchSelect: React.FC<SearchSelectProps> = ({
  value,
  options,
  onChange,
  allLabel,
  emptyLabel,
  disabled = false,
  title,
  className,
  panelClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length === 0) return options;
    return options.filter((option) => {
      const haystack = (option.label + ' ' + (option.meta ?? '')).toLowerCase();
      return haystack.includes(term);
    });
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlight(0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((prev) => Math.min(filtered.length - 1, prev + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((prev) => Math.max(0, prev - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) pick(option.value);
      return;
    }
  };

  const baseClass =
    'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 flex items-center gap-1 text-left focus:outline-none focus:ring-1 focus:ring-[#2c5f57] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed';

  return (
    <div ref={rootRef} className={'relative ' + (className ?? '')} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => setOpen((prev) => !prev)}
        className={baseClass + ' cursor-pointer disabled:cursor-not-allowed'}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={'flex-1 truncate ' + (selected || value === '' ? 'font-semibold' : '')}>
          {options.length === 0 ? emptyLabel ?? allLabel : selected ? selected.label : value === '' ? allLabel : value}
        </span>
        {value !== '' && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear selection"
            className="shrink-0 text-slate-400 hover:text-red-600"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
              close();
            }}
          >
            <X className="w-3 h-3" />
          </span>
        )}
        <ChevronDown className="w-3 h-3 shrink-0 text-slate-500" />
      </button>

      {open && !disabled && (
        <div
          className={
            'absolute left-0 top-[29px] z-[80] w-full min-w-[170px] rounded border border-[#2c5f57] bg-white shadow-xl ' +
            (panelClassName ?? '')
          }
        >
          <div className="flex items-center gap-1 border-b border-slate-200 px-1.5 py-1">
            <Search className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlight(0);
              }}
              placeholder="Search..."
              className="w-full bg-transparent text-[11px] text-slate-800 focus:outline-none"
            />
          </div>
          <div role="listbox" className="max-h-52 overflow-y-auto py-0.5">
            <button
              type="button"
              onClick={() => pick('')}
              className={
                'w-full px-1.5 py-1 text-left text-[11px] flex items-center gap-1 hover:bg-emerald-50 ' +
                (value === '' ? 'font-bold text-[#2c5f57]' : 'text-slate-700')
              }
            >
              <Check className={'w-3 h-3 ' + (value === '' ? 'text-[#2c5f57]' : 'text-transparent')} />
              <span className="truncate">{allLabel}</span>
            </button>
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-slate-500">
                {options.length === 0 ? emptyLabel ?? 'No records found' : 'No match for "' + query + '"'}
              </p>
            )}
            {filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pick(option.value)}
                className={
                  'w-full px-1.5 py-1 text-left text-[11px] flex items-center gap-1 ' +
                  (index === highlight ? 'bg-emerald-50 ' : '') +
                  (option.value === value ? 'font-bold text-[#2c5f57]' : 'text-slate-700')
                }
              >
                <Check className={'w-3 h-3 shrink-0 ' + (option.value === value ? 'text-[#2c5f57]' : 'text-transparent')} />
                <span className="flex-1 truncate">{option.label}</span>
                {option.meta && <span className="shrink-0 font-mono text-[9px] text-slate-400">{option.meta}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSelect;