import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, TriangleAlert, X } from 'lucide-react';
import { lookupReceiptParties } from '../../services/api';
import { ReceiptPartyLookup } from '../../types';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface ReceiptPartyLookupDialogProps {
  open: boolean;
  title?: string;
  initialSearch?: string;
  onClose: () => void;
  onSelect: (party: ReceiptPartyLookup) => void;
}

export const ReceiptPartyLookupDialog: React.FC<ReceiptPartyLookupDialogProps> = ({
  open,
  title = 'Party Lookup',
  initialSearch = '',
  onClose,
  onSelect,
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [rows, setRows] = useState<ReceiptPartyLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch(initialSearch);
    setSelectedIndex(0);
  }, [open, initialSearch]);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await lookupReceiptParties(term.trim(), 60);
      setRows(data);
      setSelectedIndex(0);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load parties.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void load(search);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [open, search, load]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < rows.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const party = rows[selectedIndex];
      if (party) onSelect(party);
    }
  };

  const selected = rows[selectedIndex];

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-2 sm:p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#2c5f57] text-white">
          <span className="text-[12.5px] font-bold uppercase tracking-wide">{title}</span>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10" aria-label="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-3 py-2 bg-[#eef5f2] border-b border-[#c2dcd5] flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-[#2c5f57]" />
          <input
            ref={inputRef}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search party by name, code, mobile, GST no..."
            className="flex-1 h-8 px-2 text-[12px] bg-white border border-[#789d93] rounded focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#2c5f57]" />}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 bg-red-50 border-b border-red-200 text-red-700 text-[11.5px] px-3 py-1.5">
            <TriangleAlert className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead className="sticky top-0 bg-[#d5e7e1] z-10">
              <tr className="text-slate-700 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Party</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Address</th>
                <th className="px-2 py-1.5 text-right border-b border-[#789d93]">Balance</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Mobile</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">GST No.</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Person</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Broker</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">City</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Head</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Collection</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Sales Man</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={11} className="px-2 py-8 text-center text-slate-500">
                    No party matches the search.
                  </td>
                </tr>
              ) : (
                rows.map((party, index) => (
                  <tr
                    key={party.id}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onSelect(party)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      index === selectedIndex
                        ? 'bg-[#b8ddd4] font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      <div className="font-semibold">{party.partyName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{party.partyCode}</div>
                    </td>
                    <td className="px-2 py-1.5 max-w-[220px] truncate" title={party.address ?? ''}>
                      {party.address ?? '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap">
                      <span className={party.balance.nature === 'Cr' ? 'text-red-600' : 'text-emerald-700'}>
                        {money(party.balance.amount)} {party.balance.nature}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{party.phone ?? '-'}</td>
                    <td className="px-2 py-1.5 font-mono text-[10.5px]">{party.gstin ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.personName ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.brokerName ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.city ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.partyGroupName ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.collectionName ?? '-'}</td>
                    <td className="px-2 py-1.5">{party.salespersonName ?? '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-[#dce8e1] border-t border-[#789d93] text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>Up/Down: Navigate</span>
            <span>Enter: Select</span>
            <span>Esc: Close</span>
          </div>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
            className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-[11.5px] font-bold disabled:bg-slate-400"
          >
            Select Party
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPartyLookupDialog;