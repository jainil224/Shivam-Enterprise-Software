import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { getProductionBooks } from '../services/api';
import { ProductionBook } from '../types';

export const ProductionBookSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [books, setBooks] = useState<ProductionBook[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<ProductionBook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load books from PostgreSQL
  const loadBooks = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getProductionBooks({ includeInactive: false });
      const fyBooks = data.filter(
        (b) => b.companyId === activeCompany.id && b.financialYearId === activeFinancialYear.id && b.isActive
      );

      // If user has no production books yet, provide a fallback view
      setBooks(fyBooks);
      setFilteredBooks(fyBooks);
    } catch (err: any) {
      setError(err.message || 'Failed to load production books.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, activeFinancialYear]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Filter books on search change
  useEffect(() => {
    const q = search.trim().toLowerCase();
    const res = books.filter((b) => {
      return !q || b.bookName.toLowerCase().includes(q) || b.prefix.toLowerCase().includes(q);
    });
    setFilteredBooks(res);
    setSelectedIndex(0);
  }, [search, books]);

  // Select a book and navigate to Production Receive Entry (Screenshot 2)
  const handleSelectBook = (book: ProductionBook) => {
    sessionStorage.setItem('bms_selected_production_book_id', book.id);
    sessionStorage.setItem('bms_selected_production_book_prefix', book.prefix);
    sessionStorage.setItem('bms_selected_production_book_name', book.bookName);

    navigate(`/manufacturing/production-receive/entry?bookId=${book.id}`);
  };

  // Keyboard navigation: Up/Down arrow keys, Enter to open, F1 to create/edit, Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredBooks.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredBooks.length > 0 && filteredBooks[selectedIndex]) {
          handleSelectBook(filteredBooks[selectedIndex]);
        }
      } else if (e.key === 'F1') {
        e.preventDefault();
        navigate('/masters/production-books');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredBooks, selectedIndex, navigate]);

  // Balance formatting with Cr / Dr
  const formatBalance = (val: string | number) => {
    const n = Number(val);
    if (isNaN(n) || n === 0) return '0.00 Cr';
    const absVal = Math.abs(n).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n >= 0 ? `${absVal} Cr` : `${absVal} Dr`;
  };

  return (
    <div className="min-h-screen bg-[#d8e6df] text-slate-800 flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── Desktop Window Header Bar (Matching Screenshot 1) ────────────────── */}
      <div className="bg-[#3d7a72] text-white px-3 py-1 flex items-center justify-between shadow-xs border-b border-[#2d5c56]">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold tracking-wide">
            Select Select Production Receive Book
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {/* Minimize */}
          <button
            onClick={() => navigate('/')}
            title="Minimize"
            className="w-5 h-4 flex items-center justify-center text-xs text-slate-200 hover:bg-[#2d5c56] rounded-xs"
          >
            _
          </button>
          {/* Maximize */}
          <button
            title="Maximize"
            className="w-5 h-4 flex items-center justify-center text-xs text-slate-200 hover:bg-[#2d5c56] rounded-xs"
          >
            □
          </button>
          {/* Close */}
          <button
            onClick={() => navigate('/')}
            title="Close"
            className="w-5 h-4 flex items-center justify-center text-xs text-white bg-[#eb5757] hover:bg-red-600 rounded-xs font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Central Modal Container (Matching Screenshot 1) ──────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-start pt-6 px-4">
        <div className="w-full max-w-2xl bg-[#d8e6df]">
          {/* Search Box Prominently Displayed */}
          <div className="flex flex-col items-center mb-2">
            <span className="text-sm font-semibold text-slate-700 mb-1">
              Type to search books...
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by book name or prefix..."
              className="w-72 px-3 py-1 text-xs border border-[#789d93] bg-white rounded-xs focus:outline-none focus:ring-1 focus:ring-[#3d7a72] text-center font-medium shadow-2xs"
            />
          </div>

          {/* Table Container */}
          <div className="border border-[#789d93] bg-white shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-[#c9ded6] text-[#1e3f38] text-xs font-bold border-b border-[#789d93]">
              <div className="col-span-2 px-3 py-1.5 border-r border-[#789d93]">
                PREFIX
              </div>
              <div className="col-span-7 px-3 py-1.5 border-r border-[#789d93]">
                Book Name
              </div>
              <div className="col-span-3 px-3 py-1.5 text-right">
                Balance
              </div>
            </div>

            {/* Table Rows Body */}
            <div className="min-h-[280px] max-h-[380px] overflow-y-auto divide-y divide-[#e2ede8]">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Loading production books...
                </div>
              ) : error ? (
                <div className="py-12 text-center text-xs text-red-600 px-4">
                  {error}
                </div>
              ) : filteredBooks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <p>No production books found matching criteria.</p>
                  <button
                    onClick={() => navigate('/masters/production-books')}
                    className="px-3 py-1 bg-[#3d7a72] text-white rounded-xs hover:bg-[#2d5c56] font-semibold text-xs"
                  >
                    + Create New Production Book
                  </button>
                </div>
              ) : (
                filteredBooks.map((b, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        setSelectedIndex(idx);
                        handleSelectBook(b);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`grid grid-cols-12 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#f3e4e7] text-[#88192a] font-bold'
                          : 'bg-white hover:bg-[#faf4f5] text-slate-800'
                      }`}
                    >
                      <div className="col-span-2 px-3 py-1.5 border-r border-[#e2ede8] font-mono">
                        {b.prefix || ''}
                      </div>
                      <div className="col-span-7 px-3 py-1.5 border-r border-[#e2ede8] uppercase tracking-wide">
                        {b.bookName}
                      </div>
                      <div className="col-span-3 px-3 py-1.5 text-right font-mono">
                        {formatBalance(b.openingBalance)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Hint Strip */}
          <div className="mt-2 flex justify-between items-center text-[11px] text-slate-600 px-1">
            <span>Press <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold">↑</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold">↓</kbd> to move, <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono font-bold">Enter</kbd> to select</span>
            <button
              onClick={() => navigate('/masters/production-books')}
              className="text-xs font-bold text-slate-800 hover:text-blue-700 transition-colors cursor-pointer"
            >
              F1 - Create/Edit Book
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Right Shortcut (Matching Screenshot 1) ────────────────────── */}
      <div className="p-4 flex justify-end">
        <button
          onClick={() => navigate('/masters/production-books')}
          className="text-xs font-bold text-slate-800 hover:text-blue-800 tracking-wide cursor-pointer"
        >
          F1 - Create/Edit Book
        </button>
      </div>
    </div>
  );
};
