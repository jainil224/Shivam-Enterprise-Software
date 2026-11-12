import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, TriangleAlert, X } from 'lucide-react';
import { createBankInstrument, getBankInstruments } from '../../services/api';
import { BankInstrument } from '../../types';

interface BankNameLookupDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (instrument: BankInstrument) => void;
}

export const BankNameLookupDialog: React.FC<BankNameLookupDialogProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<BankInstrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBankInstruments({ search: term.trim(), includeInactive: false });
      setRows(data);
      setSelectedIndex(0);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load bank name codes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setShowCreate(false);
    setNewCode('');
    setNewDescription('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void load(search);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, search, load]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (showCreate) {
        setShowCreate(false);
      } else {
        onClose();
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < rows.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (event.key === 'Enter' && !showCreate) {
      event.preventDefault();
      const instrument = rows[selectedIndex];
      if (instrument) onSelect(instrument);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createBankInstrument({
        code: newCode.trim(),
        description: newDescription.trim(),
      });
      setShowCreate(false);
      setNewCode('');
      setNewDescription('');
      await load(created.code);
      onSelect(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the bank name code.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-2 sm:p-4"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-[#2c5f57] text-white">
          <span className="text-[12.5px] font-bold uppercase tracking-wide">Bank Name Lookup</span>
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
            placeholder="Search bank code or description..."
            className="flex-1 h-8 px-2 text-[12px] bg-white border border-[#789d93] rounded focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-[#2c5f57]" />}
          <button
            type="button"
            onClick={() => setShowCreate((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#107c41] text-white text-[11px] font-bold hover:bg-[#0c6334]"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 bg-red-50 border-b border-red-200 text-red-700 text-[11.5px] px-3 py-1.5">
            <TriangleAlert className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        {showCreate && (
          <form onSubmit={handleCreate} className="px-3 py-2 border-b border-slate-200 bg-slate-50 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5" htmlFor="newBankCode">
                  Code
                </label>
                <input
                  id="newBankCode"
                  value={newCode}
                  onChange={(event) => setNewCode(event.target.value)}
                  maxLength={20}
                  className="w-full h-7 px-2 text-[12px] bg-white border border-slate-300 rounded uppercase"
                  placeholder="HDFC"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5" htmlFor="newBankDesc">
                  Description
                </label>
                <input
                  id="newBankDesc"
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  maxLength={100}
                  className="w-full h-7 px-2 text-[12px] bg-white border border-slate-300 rounded"
                  placeholder="HDFC BANK LTD"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-2.5 py-1 rounded bg-[#2c5f57] text-white text-[11px] font-bold disabled:bg-slate-400 flex items-center gap-1"
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save Code
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11.5px] border-collapse">
            <thead className="sticky top-0 bg-[#d5e7e1] z-10">
              <tr className="text-slate-700 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-28">Code</th>
                <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={2} className="px-2 py-8 text-center text-slate-500">
                    No bank name codes yet. Use New to add one.
                  </td>
                </tr>
              ) : (
                rows.map((instrument, index) => (
                  <tr
                    key={instrument.id}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => onSelect(instrument)}
                    className={`cursor-pointer border-b border-slate-100 ${
                      index === selectedIndex
                        ? 'bg-[#b8ddd4] font-semibold text-slate-900'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <td className="px-2 py-1.5 font-mono font-bold">{instrument.code}</td>
                    <td className="px-2 py-1.5">{instrument.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-3 py-2 bg-[#dce8e1] border-t border-[#789d93] text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>Up/Down: Navigate</span>
            <span>Enter / Insert: Select</span>
            <span>Esc: Close</span>
          </div>
          <button
            type="button"
            disabled={!rows[selectedIndex]}
            onClick={() => rows[selectedIndex] && onSelect(rows[selectedIndex])}
            className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-[11.5px] font-bold disabled:bg-slate-400"
          >
            Select Code
          </button>
        </div>
      </div>
    </div>
  );
};

export default BankNameLookupDialog;