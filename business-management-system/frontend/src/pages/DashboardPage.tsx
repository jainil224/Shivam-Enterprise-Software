import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Star,
  ArrowRightLeft,
  Factory,
  Search,
  ChevronRight,
  Info,
  ArrowUpRight,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useFavourites } from '../hooks/useFavourites';
import { useUIModals } from '../context/UIModalContext';
import { DASHBOARD_SHORTCUTS, ShortcutItem } from '../config/navigation';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();
  const { favourites, isFavourite, toggleFavourite } = useFavourites();
  const { openComingSoon, openFySwitcher, openCompanyDetails } = useUIModals();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Categories
  const categories = ['All', 'Sales', 'Purchase', 'Vouchers', 'Reports', 'Orders'];

  // Filter shortcuts
  const filteredShortcuts = DASHBOARD_SHORTCUTS.filter((s) => {
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Favourites items
  const favouriteItems = DASHBOARD_SHORTCUTS.filter((s) => favourites.includes(s.id));

  const handleShortcutClick = (item: ShortcutItem) => {
    if (item.implemented && item.route) {
      navigate(item.route);
    } else {
      openComingSoon(item.title, item.plannedPhase, item.description);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ── 1. Company Context Header Card ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#789d93]/60 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-[#1f4842] via-[#2c5f57] to-[#1f4842] text-white">
          <div className="flex items-start sm:items-center space-x-4">
            {/* Logo or Monogram */}
            <div className="shrink-0">
              {activeCompany?.logoPath ? (
                <img
                  src={activeCompany.logoPath}
                  alt={activeCompany.companyName}
                  className="w-14 h-14 rounded-xl object-contain border border-slate-700 bg-white p-1 shadow-sm"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-2xl shadow-sm select-none border border-blue-400/30">
                  {activeCompany?.companyName?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
            </div>

            {/* Entity Identification */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="font-mono text-xs font-bold text-blue-300 bg-blue-900/60 border border-blue-700/80 px-2 py-0.5 rounded">
                  {activeCompany?.companyCode}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                  Active Legal Entity
                </span>
                {activeFinancialYear && (
                  <span className="text-[11px] font-mono text-emerald-300 bg-emerald-900/40 border border-emerald-700/60 px-2 py-0.5 rounded flex items-center space-x-1">
                    <Calendar className="w-3 h-3 text-emerald-400 inline mr-1" />
                    <span>FY: {activeFinancialYear.yearName}</span>
                    {activeFinancialYear.isLocked && (
                      <span className="ml-1 text-[9px] bg-amber-900/80 text-amber-300 px-1 rounded font-sans">
                        Locked
                      </span>
                    )}
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1.5 truncate">
                {activeCompany?.companyName}
              </h1>

              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                {activeCompany?.gstin && (
                  <span>
                    GSTIN: <strong className="font-mono text-white">{activeCompany.gstin}</strong>
                  </span>
                )}
                {activeCompany?.panNumber && (
                  <span>
                    PAN: <strong className="font-mono text-white">{activeCompany.panNumber}</strong>
                  </span>
                )}
                {(activeCompany?.city || activeCompany?.state) && (
                  <span>
                    Location: {[activeCompany.city, activeCompany.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Switch Company & Switch Financial Year */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-700">
            <button
              onClick={openCompanyDetails}
              className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
              title="View full company statutory details"
            >
              Company Profile
            </button>
            <button
              onClick={openFySwitcher}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-700/80 rounded-lg hover:bg-emerald-900/60 hover:text-emerald-200 transition-colors flex items-center space-x-1.5"
              title="Switch Financial Year"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Change FY</span>
            </button>
            <button
              onClick={() => navigate('/companies')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
              title="Switch Company (Open Selector)"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Switch Company</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Favourites Bar (If any favourited items exist) ─────────────── */}
      {favouriteItems.length > 0 && (
        <div className="bg-amber-50/50 rounded-xl border border-amber-200/70 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Pinned Favourites ({favouriteItems.length})
              </h2>
            </div>
            <span className="text-[11px] text-amber-700 font-medium">Quick 1-Click Launch</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {favouriteItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleShortcutClick(item)}
                  className="p-2.5 rounded-lg bg-white border border-amber-200/80 hover:border-amber-400 hover:shadow-xs transition-all flex items-center space-x-2 text-left group"
                >
                  <div className="p-1.5 rounded-md bg-amber-100 text-amber-800 group-hover:bg-amber-500 group-hover:text-white transition-colors shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-900 truncate">
                    {item.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Manufacturing Spotlight Banner ────────────────────────────── */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#2c5f57] to-[#183330] text-white border border-[#112422] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-[#107c41] rounded-lg shadow-inner shrink-0">
            <Factory className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9ed0c3] bg-[#112422] border border-[#2c5f57] px-2 py-0.2 rounded">
                Textile Manufacturing
              </span>
              <span className="text-xs text-slate-300 font-medium">DTY & Twisting Mill Modules</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white mt-0.5">
              Production Receive, Carton Weights & Challan Printing
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => navigate('/manufacturing/production-receive/records')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <span>Challan Register</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigate('/manufacturing/production-receive/books')}
            className="px-3.5 py-1.5 bg-[#107c41] hover:bg-[#0c6334] text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <span>New Entry</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              openComingSoon(
                'Finished Carton Stock Report',
                'Phase 6 (Production Receive & Challan Printing)',
                'Inventory of finished yarn cartons categorized by denier, quality, grade and warehouse location.'
              )
            }
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <span>Carton Stock</span>
          </button>
        </div>
      </div>

      {/* ── 4. Main Shortcut Grid Header & Filters ───────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Business Operations Workspace
            </h2>
            <p className="text-xs text-slate-500">
              Select any operational module below or press keyboard shortcut to navigate.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full font-semibold transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── The 17 Shortcuts Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredShortcuts.map((item) => {
            const Icon = item.icon;
            const isFav = isFavourite(item.id);

            return (
              <div
                key={item.id}
                onClick={() => handleShortcutClick(item)}
                className="bg-white border border-[#b6d3ca] rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    {/* Icon */}
                    <div className="p-2.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Star Favourite Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavourite(item.id);
                      }}
                      className={`p-1.5 rounded-md transition-colors ${
                        isFav
                          ? 'text-amber-500 hover:bg-amber-50'
                          : 'text-slate-300 hover:text-amber-500 hover:bg-slate-100'
                      }`}
                      title={isFav ? 'Remove from favourites' : 'Mark as favourite'}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-amber-500' : ''}`} />
                    </button>
                  </div>

                  {/* Title & Category */}
                  <div className="mt-3">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Footer status / planned phase */}
                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-slate-400 uppercase tracking-wider">
                    {item.category}
                  </span>
                  <span className="font-mono text-blue-600 font-medium group-hover:underline flex items-center space-x-0.5">
                    <span>{item.plannedPhase.split(' ')[0]}</span>
                    <ArrowUpRight className="w-3 h-3 inline" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredShortcuts.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
            No shortcuts match your search & category filters.
          </div>
        )}
      </div>

      {/* ── 5. Keyboard Shortcut Guide Bar ───────────────────────────────── */}
      <div className="bg-slate-100/90 rounded-xl p-3.5 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-800">Keyboard Shortcuts:</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">F1</kbd> Dashboard</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Alt+C</kbd> Company</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Alt+M</kbd> Master</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Alt+T</kbd> Transaction</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Alt+R</kbd> Reports</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Alt+F</kbd> Favourites</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700">Esc</kbd> Close Dialogs</span>
        </div>
      </div>
    </div>
  );
};
