import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BadgeCheck,
  XCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import { Company, FinancialYear } from '../types';
import { getCompanies, getFinancialYears } from '../services/api';
import { useCompany } from '../context/CompanyContext';
import { CompanyFormModal } from '../components/CompanyFormModal';
import { FinancialYearModal } from '../components/FinancialYearModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyRow extends Company {
  fyList: FinancialYear[];
  fyLoading: boolean;
  fyError: string | null;
  fyExpanded: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CompanySelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { setActiveContext } = useCompany();

  // ── State ─────────────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [fyModalCompany, setFyModalCompany] = useState<Company | null>(null);

  // Keyboard focus tracking
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Data Loading ──────────────────────────────────────────────────────────

  const loadCompanies = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getCompanies(searchQuery.trim() || undefined, includeInactive);
      // Preserve expanded state for existing rows
      setCompanies((prev) => {
        const prevMap = new Map(prev.map((r) => [r.id, r]));
        return data.map((c) => {
          const existing = prevMap.get(c.id);
          return {
            ...c,
            fyList: existing?.fyList ?? [],
            fyLoading: existing?.fyLoading ?? false,
            fyError: existing?.fyError ?? null,
            fyExpanded: existing?.fyExpanded ?? false,
          };
        });
      });
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load companies.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, includeInactive]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadCompanies();
    }, 300);
    return () => clearTimeout(debounce);
  }, [loadCompanies]);

  // ── FY Expand Toggle ──────────────────────────────────────────────────────

  const toggleFyExpand = async (companyId: string) => {
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.id !== companyId) return c;
        const willExpand = !c.fyExpanded;
        if (willExpand && c.fyList.length === 0 && !c.fyLoading) {
          // Trigger async load
          loadFyForCompany(companyId);
        }
        return { ...c, fyExpanded: willExpand };
      })
    );
  };

  const loadFyForCompany = async (companyId: string) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, fyLoading: true, fyError: null } : c))
    );
    try {
      const fys = await getFinancialYears(companyId);
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, fyList: fys, fyLoading: false } : c))
      );
    } catch (err: any) {
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? { ...c, fyLoading: false, fyError: err.message || 'Failed to load financial years.' }
            : c
        )
      );
    }
  };

  // ── Select Company + FY ───────────────────────────────────────────────────

  const handleSelectFY = (company: Company, fy: FinancialYear) => {
    setActiveContext(company, fy);
    navigate('/');
  };

  // ── Modal Callbacks ───────────────────────────────────────────────────────

  const handleCompanySaved = (_saved: Company) => {
    // Refresh list
    loadCompanies();
    setEditingCompany(null);
  };

  const handleFYsUpdated = () => {
    // Reload FY list for the modal company if it's open
    if (fyModalCompany) {
      loadFyForCompany(fyModalCompany.id);
    }
  };

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────

  useKeyboardShortcuts({
    onCtrlN: () => {
      setEditingCompany(null);
      setIsAddModalOpen(true);
    },
    onCtrlF: () => {
      searchRef.current?.focus();
    },
    onEscape: () => {
      setIsAddModalOpen(false);
      setEditingCompany(null);
      setFyModalCompany(null);
    },
    onF10: () => {
      // Open edit for focused row
      if (focusedRowIndex >= 0 && focusedRowIndex < companies.length) {
        setEditingCompany(companies[focusedRowIndex]);
      }
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <span>Company Selection</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Select a company and financial year to begin working. All transactions are company-isolated.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadCompanies}
            title="Refresh list"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditingCompany(null); setIsAddModalOpen(true); }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
            title="Add New Company (Ctrl+N)"
          >
            <Plus className="w-4 h-4" />
            <span>Add Company</span>
            <kbd className="ml-1 text-[10px] bg-blue-700 px-1 rounded font-mono opacity-80">Ctrl+N</kbd>
          </button>
        </div>
      </div>

      {/* ── Search & Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company code, name or GSTIN… (Ctrl+F)"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        <label className="flex items-center space-x-2 text-sm text-slate-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Include inactive companies</span>
        </label>
      </div>

      {/* ── Shortcut hints ───────────────────────────────────────────────── */}
      <div className="flex items-center space-x-4 text-[11px] text-slate-400">
        <span><kbd className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded font-mono">Ctrl+N</kbd> Add company</span>
        <span><kbd className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded font-mono">Ctrl+F</kbd> Search</span>
        <span><kbd className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded font-mono">F10</kbd> Edit focused row</span>
        <span><kbd className="bg-slate-100 border border-slate-300 px-1 py-0.5 rounded font-mono">Esc</kbd> Close modals</span>
      </div>

      {/* ── Company List ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-6 h-6 mr-2 animate-spin text-blue-500" />
          <span className="text-sm">Loading companies from database…</span>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400" />
          <p className="text-sm text-rose-600 font-medium">{loadError}</p>
          <button
            onClick={loadCompanies}
            className="px-4 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 border-2 border-dashed border-slate-200 rounded-xl">
          <Building2 className="w-12 h-12 text-slate-300" />
          <div>
            <p className="text-slate-600 font-medium">No companies found</p>
            <p className="text-slate-400 text-sm mt-1">
              {searchQuery
                ? 'No companies match your search. Try clearing the search.'
                : 'Get started by adding your first company.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              onClick={() => { setEditingCompany(null); setIsAddModalOpen(true); }}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Company</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company, index) => (
            <CompanyCard
              key={company.id}
              company={company}
              index={index}
              isFocused={focusedRowIndex === index}
              onFocus={() => setFocusedRowIndex(index)}
              onToggleFY={() => toggleFyExpand(company.id)}
              onEdit={() => setEditingCompany(company)}
              onManageFY={() => setFyModalCompany(company)}
              onSelectFY={(fy) => handleSelectFY(company, fy)}
            />
          ))}

          <p className="text-xs text-slate-400 text-right pt-1">
            {companies.length} {companies.length === 1 ? 'company' : 'companies'} found
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <CompanyFormModal
        isOpen={isAddModalOpen || Boolean(editingCompany)}
        onClose={() => { setIsAddModalOpen(false); setEditingCompany(null); }}
        onSuccess={handleCompanySaved}
        companyToEdit={editingCompany}
      />

      <FinancialYearModal
        isOpen={Boolean(fyModalCompany)}
        onClose={() => setFyModalCompany(null)}
        company={fyModalCompany}
        onFinancialYearsUpdated={handleFYsUpdated}
      />
    </div>
  );
};

// ─── Company Card ─────────────────────────────────────────────────────────────

interface CompanyCardProps {
  company: CompanyRow;
  index: number;
  isFocused: boolean;
  onFocus: () => void;
  onToggleFY: () => void;
  onEdit: () => void;
  onManageFY: () => void;
  onSelectFY: (fy: FinancialYear) => void;
}

const CompanyCard: React.FC<CompanyCardProps> = ({
  company,
  isFocused,
  onFocus,
  onToggleFY,
  onEdit,
  onManageFY,
  onSelectFY,
}) => {
  return (
    <div
      tabIndex={0}
      onFocus={onFocus}
      onClick={onFocus}
      className={`bg-white border rounded-xl shadow-sm transition-all outline-none ${
        isFocused ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
      } ${!company.isActive ? 'opacity-60' : ''}`}
    >
      {/* Card Header */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Logo or Initials */}
        <div className="shrink-0">
          {company.logoPath ? (
            <img
              src={company.logoPath}
              alt={company.companyName}
              className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-slate-50 p-1"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg select-none">
              {company.companyName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {company.companyCode}
            </span>
            <h2 className="text-base font-bold text-slate-900 truncate">{company.companyName}</h2>
            {company.isActive ? (
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <BadgeCheck className="w-3 h-3" />
                <span>Active</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                <XCircle className="w-3 h-3" />
                <span>Inactive</span>
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
            {company.gstin && (
              <span>
                <span className="font-semibold text-slate-600">GSTIN:</span>{' '}
                <span className="font-mono">{company.gstin}</span>
              </span>
            )}
            {company.panNumber && (
              <span>
                <span className="font-semibold text-slate-600">PAN:</span>{' '}
                <span className="font-mono">{company.panNumber}</span>
              </span>
            )}
            {(company.city || company.state) && (
              <span>
                {[company.city, company.state].filter(Boolean).join(', ')}
              </span>
            )}
            {company.phone && <span>📞 {company.phone}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit Company (F10)"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onManageFY(); }}
            title="Manage Financial Years"
            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
          >
            <Calendar className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFY(); }}
            disabled={!company.isActive}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              company.isActive
                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
            title={company.isActive ? 'Select Financial Year' : 'Company is inactive'}
          >
            <span>Select Year</span>
            {company.fyExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* FY Expansion Panel */}
      {company.fyExpanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          {company.fyLoading ? (
            <div className="flex items-center space-x-2 text-sm text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Loading financial years…</span>
            </div>
          ) : company.fyError ? (
            <div className="flex items-center space-x-2 text-sm text-rose-600 py-2">
              <AlertCircle className="w-4 h-4" />
              <span>{company.fyError}</span>
            </div>
          ) : company.fyList.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-slate-500">No financial years configured for this company.</p>
              <button
                onClick={(e) => { e.stopPropagation(); onManageFY(); }}
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:underline"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Add Financial Year</span>
              </button>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Select a Financial Year to Open
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {company.fyList.map((fy) => (
                  <FYCard
                    key={fy.id}
                    fy={fy}
                    onSelect={() => onSelectFY(fy)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── FY Card ──────────────────────────────────────────────────────────────────

interface FYCardProps {
  fy: FinancialYear;
  onSelect: () => void;
}

const FYCard: React.FC<FYCardProps> = ({ fy, onSelect }) => (
  <button
    onClick={onSelect}
    className={`w-full text-left p-3 rounded-lg border transition-all group ${
      fy.isActive
        ? 'bg-white border-slate-200 hover:border-emerald-400 hover:shadow-sm hover:bg-emerald-50'
        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
    }`}
    disabled={!fy.isActive}
    title={fy.isActive ? `Open ${fy.yearName}` : 'This financial year is inactive'}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="font-bold font-mono text-sm text-slate-900 group-hover:text-emerald-800 transition-colors">
        {fy.yearName}
      </span>
      <div className="flex items-center space-x-1">
        {fy.isLocked ? (
          <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
            <Lock className="w-2.5 h-2.5" />
            <span>Locked</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
            <Unlock className="w-2.5 h-2.5" />
            <span>Open</span>
          </span>
        )}
        {fy.isActive ? (
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Active</span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">Inactive</span>
        )}
      </div>
    </div>
    <p className="text-[11px] text-slate-500 font-mono">
      {formatDate(fy.startDate)} → {formatDate(fy.endDate)}
    </p>
    {fy.isActive && (
      <p className="text-[10px] text-emerald-600 mt-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <CheckCircle2 className="w-3 h-3" />
        <span>Click to open this year</span>
      </p>
    )}
  </button>
);

