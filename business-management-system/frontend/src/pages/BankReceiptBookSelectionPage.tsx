import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Loader2, Plus, Settings, TriangleAlert } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getBankReceiptBooks } from '../services/api';
import { BankReceiptBook } from '../types';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const BankReceiptBookSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [books, setBooks] = useState<BankReceiptBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadBooks = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBankReceiptBooks();
      setBooks(data.filter((book) => book.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Bank Receipt Books.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, activeFinancialYear]);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  const filteredBooks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === '') return books;
    return books.filter(
      (book) =>
        book.prefix.toLowerCase().includes(term) ||
        book.bookName.toLowerCase().includes(term) ||
        book.bankAccount.accountName.toLowerCase().includes(term)
    );
  }, [books, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const openBook = useCallback(
    (book: BankReceiptBook) => {
      navigate(`/transactions/bank-receipts/cheque-entry?bookId=${book.id}`);
    },
    [navigate]
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (filteredBooks.length === 0) {
      if (event.key === 'Escape') navigate('/transactions/bank-receipts');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev < filteredBooks.length - 1 ? prev + 1 : prev));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const book = filteredBooks[selectedIndex];
      if (book) openBook(book);
    } else if (event.key === 'Escape') {
      navigate('/transactions/bank-receipts');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#c2dcd5] flex flex-col items-center justify-center p-4 font-sans select-none"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="w-full max-w-2xl flex items-center justify-between mb-3 text-xs">
        <button
          type="button"
          onClick={() => navigate('/transactions/bank-receipts')}
          className="flex items-center gap-1 bg-[#2c5f57] hover:bg-[#204741] text-white px-2.5 py-1 rounded shadow-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Bank Receipt Register</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/transactions/bank-receipts/books/manage')}
            className="flex items-center gap-1 bg-white border border-[#2c5f57] text-[#2c5f57] hover:bg-[#eef5f2] px-2.5 py-1 rounded shadow-xs font-semibold"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Manage Books</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/transactions/bank-receipts/books/manage?new=1')}
            className="flex items-center gap-1 bg-[#107c41] hover:bg-[#0c6334] text-white px-2.5 py-1 rounded shadow-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Book</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white border-2 border-[#1f4842] shadow-2xl rounded-xs overflow-hidden flex flex-col">
        <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842]">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-300" />
            <span className="font-bold text-xs uppercase tracking-wide">Bank Receipt Books</span>
          </div>
          <span className="text-[11px] text-emerald-200 font-mono">
            {activeFinancialYear?.yearName || 'FY'}
          </span>
        </div>

        <div className="p-2.5 bg-[#eef5f2] border-b border-[#c2dcd5] flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700" htmlFor="bookFilter">
            Filter:
          </label>
          <input
            id="bookFilter"
            ref={searchRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Type to search books (Press Enter to select)..."
            className="flex-1 bg-white border border-[#789d93] rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
            autoFocus
          />
        </div>

        {error && (
          <div className="bg-red-100 text-red-800 text-xs px-3 py-1.5 border-b border-red-300 font-medium flex items-center gap-1.5">
            <TriangleAlert className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-slate-600 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#2c5f57]" />
              <span>Loading Bank Receipt Books...</span>
            </div>
          ) : filteredBooks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <p className="font-bold text-slate-700">No Bank Receipt Books Found</p>
              <p className="text-[11px] mt-1">
                {books.length === 0
                  ? 'Create a Bank Receipt Book to start entering cheque receipts.'
                  : 'No book matches the current filter.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/transactions/bank-receipts/books/manage?new=1')}
                className="mt-3 inline-flex items-center gap-1 bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-[11px] font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Bank Receipt Book
              </button>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left">
                  <th className="py-1.5 px-3 border-r border-[#789d93] w-28 uppercase">Prefix</th>
                  <th className="py-1.5 px-3 border-r border-[#789d93] uppercase">Book Name</th>
                  <th className="py-1.5 px-3 border-r border-[#789d93] uppercase">Bank A/C</th>
                  <th className="py-1.5 px-3 text-right uppercase w-36">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <tr
                      key={book.id}
                      onClick={() => openBook(book)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`cursor-pointer transition-colors border-b border-slate-100 ${
                        isSelected
                          ? 'bg-[#b8ddd4] text-slate-900 font-bold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <td className="py-2 px-3 border-r border-[#c2dcd5] font-mono text-blue-900">
                        {book.prefix || '(blank)'}
                      </td>
                      <td className="py-2 px-3 border-r border-[#c2dcd5]">{book.bookName}</td>
                      <td className="py-2 px-3 border-r border-[#c2dcd5]">
                        <div>{book.bankAccount.bankName || book.bankAccount.accountName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {book.bankAccount.bankAccountNumber ?? book.bankAccount.accountCode}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        <span
                          className={
                            book.balance.nature === 'Cr' ? 'text-red-600' : 'text-emerald-700'
                          }
                        >
                          {money(book.balance.amount)} {book.balance.nature}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-[#dce8e1] px-3 py-2 border-t border-[#789d93] flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-3">
            <span>Up/Down: Navigate</span>
            <span>Enter: Select &amp; Open</span>
            <span>Esc: Exit</span>
          </div>
          {filteredBooks[selectedIndex] && (
            <button
              type="button"
              onClick={() => openBook(filteredBooks[selectedIndex])}
              className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-xs font-bold flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Select {filteredBooks[selectedIndex].prefix || filteredBooks[selectedIndex].bookName}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BankReceiptBookSelectionPage;