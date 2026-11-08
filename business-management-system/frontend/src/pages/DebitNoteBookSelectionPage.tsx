import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { getDebitNoteBooks, createDebitNoteBook, DebitNoteBook } from '../services/api';
import { BookOpen, Plus, Loader2, ArrowLeft, Check } from 'lucide-react';

export const DebitNoteBookSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [books, setBooks] = useState<DebitNoteBook[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<DebitNoteBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // New Book Dialog
  const [isCreating, setIsCreating] = useState(false);
  const [newPrefix, setNewPrefix] = useState('DN-');
  const [newBookName, setNewBookName] = useState('');
  const [isSavingBook, setIsSavingBook] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadBooks = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getDebitNoteBooks({ includeInactive: false });
      setBooks(data);
      setFilteredBooks(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Debit Note Books.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, activeFinancialYear]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Filter books on search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredBooks(books);
    } else {
      const term = search.toLowerCase();
      setFilteredBooks(
        books.filter(
          (b) =>
            b.prefix.toLowerCase().includes(term) ||
            b.bookName.toLowerCase().includes(term)
        )
      );
    }
    setSelectedIndex(0);
  }, [search, books]);

  // Handle Book Selection
  const handleSelectBook = (book: DebitNoteBook) => {
    navigate(`/transactions/debit-notes/new?bookId=${book.id}`);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredBooks.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredBooks.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredBooks[selectedIndex]) {
        handleSelectBook(filteredBooks[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      navigate('/transactions/debit-notes');
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix.trim() || !newBookName.trim()) return;

    setIsSavingBook(true);
    try {
      const created = await createDebitNoteBook({
        prefix: newPrefix.trim().toUpperCase(),
        bookName: newBookName.trim().toUpperCase(),
      });
      setIsCreating(false);
      setNewBookName('');
      await loadBooks();
      handleSelectBook(created);
    } catch (err: any) {
      setError(err.message || 'Failed to create Debit Note Book.');
    } finally {
      setIsSavingBook(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#c2dcd5] flex flex-col items-center justify-center p-4 font-sans select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ── Top Bar / Header ────────────────────────────────────────────── */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/transactions/debit-notes')}
            className="flex items-center gap-1 bg-[#2c5f57] hover:bg-[#204741] text-white px-2.5 py-1 rounded shadow-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Debit Note Register</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 bg-[#107c41] hover:bg-[#0c6334] text-white px-2.5 py-1 rounded shadow-xs font-semibold cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Book</span>
          </button>
        </div>
      </div>

      {/* ── Modal / Window matching Screenshot 2 ────────────────────────── */}
      <div className="w-full max-w-2xl bg-white border-2 border-[#1f4842] shadow-2xl rounded-xs overflow-hidden flex flex-col">
        {/* Title Bar */}
        <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-300" />
            <span className="font-bold text-xs uppercase tracking-wide">
              Debit Note Books
            </span>
          </div>
          <span className="text-[11px] text-emerald-200 font-mono">
            {activeFinancialYear?.yearName || 'FY'}
          </span>
        </div>

        {/* Search Input Filter */}
        <div className="p-2.5 bg-[#eef5f2] border-b border-[#c2dcd5] flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700">Filter:</label>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search books (Press Enter to select)..."
            className="flex-1 bg-white border border-[#789d93] rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
            autoFocus
          />
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-red-100 text-red-800 text-xs px-3 py-1.5 border-b border-red-300 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Books Table matching Screenshot 2 */}
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-slate-600 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#2c5f57]" />
              <span>Loading Debit Note Books...</span>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <p className="font-bold text-slate-700">No Debit Note Books Found</p>
              <p className="text-[11px] mt-1 text-slate-500">
                Click &quot;New Book&quot; above to create a Debit Note Book.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left">
                  <th className="py-1.5 px-3 border-r border-[#789d93] w-28 uppercase">
                    PREFIX
                  </th>
                  <th className="py-1.5 px-3 border-r border-[#789d93] uppercase">
                    Book Name
                  </th>
                  <th className="py-1.5 px-3 text-right uppercase w-36">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`cursor-pointer transition-colors border-b border-slate-100 ${
                        isSelected
                          ? 'bg-[#b8ddd4] text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <td className="py-2 px-3 border-r border-[#c2dcd5] font-mono text-blue-900">
                        {book.prefix}
                      </td>
                      <td className="py-2 px-3 border-r border-[#c2dcd5]">
                        {book.bookName}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600 font-semibold">
                        {parseFloat(book.balance).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {book.balanceType}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info & keyboard hint */}
        <div className="bg-[#dce8e1] px-3 py-2 border-t border-[#789d93] flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>↑/↓: Navigate</span>
            <span>Enter: Select & Open</span>
            <span>Esc: Exit</span>
          </div>
          {filteredBooks[selectedIndex] && (
            <button
              onClick={() => handleSelectBook(filteredBooks[selectedIndex])}
              className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select {filteredBooks[selectedIndex].prefix}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Dialog to Create New Book ──────────────────────────────────── */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-[#2c5f57] shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="bg-[#2c5f57] text-white px-3 py-2 font-bold flex items-center justify-between">
              <span>Create New Debit Note Book</span>
              <button
                onClick={() => setIsCreating(false)}
                className="hover:text-red-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBook} className="p-4 space-y-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Prefix (e.g. DN-) :
                </label>
                <input
                  type="text"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                  placeholder="DN-"
                  className="w-full bg-white border border-[#789d93] rounded px-2.5 py-1 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Book Name :
                </label>
                <input
                  type="text"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  placeholder="DEBIT NOTE / PURCHASE DEBIT NOTE"
                  className="w-full bg-white border border-[#789d93] rounded px-2.5 py-1 text-xs uppercase focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBook}
                  className="bg-[#2c5f57] hover:bg-[#204741] text-white px-4 py-1 rounded font-bold cursor-pointer flex items-center gap-1"
                >
                  {isSavingBook && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Book</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
