import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import {
  listDebitNotes,
  getDebitNoteBooks,
  getParties,
  DebitNote,
  DebitNoteBook,
} from '../services/api';
import {
  Plus,
  Search,
  FileText,
  Printer,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';

export const DebitNoteRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  // Data & States
  const [notes, setNotes] = useState<DebitNote[]>([]);
  const [books, setBooks] = useState<DebitNoteBook[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedNoteType, setSelectedNoteType] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Load Masters
  useEffect(() => {
    if (!activeCompany) return;
    getDebitNoteBooks().then((b) => setBooks(b)).catch(() => {});
    getParties().then((p) => setParties(p)).catch(() => {});
  }, [activeCompany]);

  // Load Notes
  const loadNotes = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await listDebitNotes({
        page,
        limit,
        search: search.trim() || undefined,
        bookId: selectedBookId || undefined,
        partyId: selectedPartyId || undefined,
        noteType: selectedNoteType || undefined,
        reason: selectedReason || undefined,
        status: selectedStatus || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setNotes(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotalCount(res.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load Debit Notes.');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeCompany,
    activeFinancialYear,
    page,
    limit,
    search,
    selectedBookId,
    selectedPartyId,
    selectedNoteType,
    selectedReason,
    selectedStatus,
    startDate,
    endDate,
  ]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Reset page when filter changes
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>, val: any) => {
    setter(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedBookId('');
    setSelectedPartyId('');
    setSelectedNoteType('');
    setSelectedReason('');
    setSelectedStatus('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Grand total of visible notes
  const totalAmountVisible = notes.reduce(
    (sum, n) => sum + (parseFloat(String(n.totalAmount)) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-[#c2dcd5] text-slate-800 flex flex-col font-sans select-none text-xs">
      {/* ── Top Bar ───────────────────────────────────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-300" />
          <span className="font-bold text-xs uppercase tracking-wide">
            Debit Note Register (Voucher Register)
          </span>
          <span className="bg-[#1f4842] text-emerald-200 text-[11px] px-2 py-0.5 rounded font-mono">
            {activeFinancialYear?.yearName || 'FY'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/transactions/debit-notes/books')}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white px-3 py-1 rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Debit Note</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-5 h-5 flex items-center justify-center text-xs text-white bg-[#eb5757] hover:bg-red-600 rounded font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Filters Bar ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#789d93] p-2.5 shadow-xs space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
          {/* Search */}
          <div className="col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => handleFilterChange(setSearch, e.target.value)}
                placeholder="Note No, Party, Remark..."
                className="w-full bg-white border border-[#789d93] rounded pl-7 pr-2 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>
          </div>

          {/* Book */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Book
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => handleFilterChange(setSelectedBookId, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-semibold focus:ring-1 focus:ring-[#2c5f57]"
            >
              <option value="">All Books</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.prefix} {b.bookName}
                </option>
              ))}
            </select>
          </div>

          {/* Party */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Party
            </label>
            <select
              value={selectedPartyId}
              onChange={(e) => handleFilterChange(setSelectedPartyId, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
            >
              <option value="">All Parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.partyName}
                </option>
              ))}
            </select>
          </div>

          {/* Note Type */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Type
            </label>
            <select
              value={selectedNoteType}
              onChange={(e) => handleFilterChange(setSelectedNoteType, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
            >
              <option value="">All Types</option>
              <option value="SALES">SALES</option>
              <option value="PURCHASE">PURCHASE</option>
              <option value="BOTH">BOTH</option>
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Reason
            </label>
            <select
              value={selectedReason}
              onChange={(e) => handleFilterChange(setSelectedReason, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
            >
              <option value="">All Reasons</option>
              <option value="INTEREST">Interest</option>
              <option value="CASH_DISCOUNT">Cash Discount</option>
              <option value="QUANTITY_DISCOUNT">Quantity Discount</option>
              <option value="RATE_DIFFERENCE">Rate Difference</option>
              <option value="TCS">TCS</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => handleFilterChange(setSelectedStatus, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
            >
              <option value="">All Status</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-1.5 py-1 text-xs font-mono"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
              className="w-full bg-white border border-[#789d93] rounded px-1.5 py-1 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Total: <strong>{totalCount}</strong> vouchers found
            </span>
            <span>•</span>
            <span>
              Page Total: <strong className="font-mono text-emerald-800">₹ {totalAmountVisible.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div className="flex-1 p-2 overflow-y-auto">
        {error && (
          <div className="bg-red-100 text-red-800 border border-red-300 p-2 rounded mb-2 font-bold text-xs">
            ⚠️ {error}
          </div>
        )}
        <div className="bg-white border border-[#789d93] rounded shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex items-center justify-center gap-2 text-slate-600">
              <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57]" />
              <span className="font-bold">Loading Debit Notes...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <p className="font-bold text-sm text-slate-700">No Debit Notes Found</p>
              <p className="text-xs text-slate-500 mt-1">
                No vouchers match the selected filter criteria.
              </p>
              <button
                onClick={() => navigate('/transactions/debit-notes/books')}
                className="mt-3 bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded font-bold cursor-pointer inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Debit Note</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left whitespace-nowrap">
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Note No</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Date</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Book</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Type</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Party</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Credit Account</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93]">Reason</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93] text-right">Bills</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93] text-right">Total Amount</th>
                    <th className="py-1.5 px-3 border-r border-[#789d93] text-center">Status</th>
                    <th className="py-1.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notes.map((note, idx) => (
                    <tr
                      key={note.id}
                      className={`border-b border-slate-100 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                      } hover:bg-emerald-50/40`}
                    >
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono font-bold text-blue-900">
                        <button
                          onClick={() => navigate(`/transactions/debit-notes/${note.id}`)}
                          className="hover:underline cursor-pointer text-left"
                        >
                          {note.noteNumber}
                        </button>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                        {new Date(note.noteDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-semibold text-slate-700">
                        {note.book?.bookName || 'DEBIT NOTE'}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200">
                        <span className="bg-slate-100 border border-slate-300 text-slate-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {note.noteType}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-bold text-slate-800">
                        {note.party?.partyName || '—'}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700">
                        {note.creditAccount?.accountName || '—'}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-slate-600">
                        {note.reason}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono text-slate-700">
                        {(note as any)._count?.billLines ?? note.billLines?.length ?? 0}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                        ₹ {parseFloat(String(note.totalAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            note.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-red-100 text-red-800 border border-red-300'
                          }`}
                        >
                          {note.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => navigate(`/transactions/debit-notes/${note.id}`)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded cursor-pointer"
                            title="View / Edit Note"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => navigate(`/transactions/debit-notes/${note.id}/print`)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded cursor-pointer"
                            title="Print Preview"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Pagination ──────────────────────────────────────────────── */}
          <div className="bg-[#dce8e1] px-3 py-2 border-t border-[#789d93] flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold">
              Page {page} of {totalPages || 1}
            </span>

            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2 py-1 rounded font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2 py-1 rounded font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
