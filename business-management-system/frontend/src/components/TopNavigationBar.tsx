import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  ChevronDown,
  Building2,
  Calendar,
  Pin,
  PinOff,
  ShieldCheck,
  ArrowRightLeft,
  Settings,
  Lock,
  ChevronRight,
  Database,
  BarChart3,
  Factory,
  Wrench,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { useModulePreferences } from '../hooks/useModulePreferences';
import { DASHBOARD_SHORTCUTS, MANUFACTURING_MENU_ITEMS, ShortcutItem } from '../config/navigation';
import { BANK_SLIP_MENU_ITEMS, REPORT_MENU_ITEMS } from '../config/navigation';
import { ReportMenuPanel } from './ReportMenuPanel';

interface TopNavigationBarProps {
  onOpenComingSoon: (title: string, plannedPhase: string, description: string) => void;
  onOpenFySwitcher: () => void;
  onOpenCompanyDetails: () => void;
  onOpenAddCompany?: () => void;
  onOpenManageFys?: () => void;
  activeMenu: string | null;
  setActiveMenu: (menu: string | null) => void;
}

export const TopNavigationBar: React.FC<TopNavigationBarProps> = ({
  onOpenComingSoon,
  onOpenFySwitcher,
  onOpenCompanyDetails,
  onOpenAddCompany,
  onOpenManageFys,
  activeMenu,
  setActiveMenu,
}) => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();
  const { pins, unpin, getUsageCount, usage } = useModulePreferences();

  // Pinned modules keep the order the user pinned them in.
  const pinnedItems = pins
    .map((id) => DASHBOARD_SHORTCUTS.find((shortcut) => shortcut.id === id))
    .filter((item): item is ShortcutItem => Boolean(item));

  // Most launched modules, pinned ones excluded so nothing is listed twice.
  const frequentlyUsedItems = DASHBOARD_SHORTCUTS.filter(
    (item) => item.implemented && item.route && !pins.includes(item.id) && getUsageCount(item.id) > 0
  )
    .sort((a, b) => {
      const countDelta = getUsageCount(b.id) - getUsageCount(a.id);
      if (countDelta !== 0) return countDelta;
      return (usage[b.id]?.lastUsedAt ?? 0) - (usage[a.id]?.lastUsedAt ?? 0);
    })
    .slice(0, 4);

  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        setActiveSubMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setActiveMenu]);

  const toggleMenu = (menuName: string) => {
    if (activeMenu === menuName) {
      setActiveMenu(null);
      setActiveSubMenu(null);
    } else {
      setActiveMenu(menuName);
      setActiveSubMenu(null);
    }
  };

  const handleShortcutClick = (item: ShortcutItem) => {
    setActiveMenu(null);
    setActiveSubMenu(null);
    if (item.implemented && item.route) {
      navigate(item.route);
    } else {
      onOpenComingSoon(item.title, item.plannedPhase, item.description);
    }
  };

  return (
    <header className="bg-[#1f4842] text-slate-100 border-b border-[#112422] sticky top-0 z-40 shadow-md select-none" ref={navRef}>
      {/* ── Top Bar Container ────────────────────────────────────────────── */}
      <div className="w-full px-3 sm:px-4 lg:px-5 min-h-14 py-1 flex flex-wrap items-start gap-3">
        
        {/* Left: Brand + Navigation Menus */}
        <div className="flex flex-1 min-w-0 items-center justify-start gap-1 flex-wrap">
          {/* Brand Logo & Name */}
          <div
            onClick={() => {
              setActiveMenu(null);
              navigate('/');
            }}
            className="flex shrink-0 items-center space-x-2.5 cursor-pointer pr-3 py-1 group mr-1"
            title="Dashboard Home (F1)"
          >
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm group-hover:bg-blue-500 transition-colors">
              <Layers className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <span className="text-sm font-extrabold tracking-tight text-white">SHIVAM</span>
              <span className="text-[10px] font-bold text-blue-400 block -mt-0.5 tracking-wider">ENTERPRISE</span>
            </div>
          </div>

          {/* ── 1. Company Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('company')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'company'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 opacity-80" />
              <span>Company</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'company' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'company' && (
              <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Company Administration
                </div>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    navigate('/companies');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-blue-600"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                  <div>
                    <div className="font-semibold">Switch Company</div>
                    <div className="text-[10px] text-slate-400">Open enterprise selection screen</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenFySwitcher();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-emerald-600"
                >
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <div>
                    <div className="font-semibold">Switch Financial Year</div>
                    <div className="text-[10px] text-slate-400">Change active fiscal period</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenCompanyDetails();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-slate-900 border-t border-slate-100"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Company Profile & Statutory Info</span>
                </button>
                {onOpenAddCompany && (
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      onOpenAddCompany();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-slate-900"
                  >
                    <span className="w-3.5 text-center font-bold text-blue-600">+</span>
                    <span>Add New Company (Ctrl+N)</span>
                  </button>
                )}
                {onOpenManageFys && (
                  <button
                    onClick={() => {
                      setActiveMenu(null);
                      onOpenManageFys();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-slate-900"
                  >
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Manage Financial Years / Locks</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── 2. Master Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('master')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'master'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Database className="w-3.5 h-3.5 opacity-80" />
              <span>Master</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'master' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'master' && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Business Masters
                </div>
                {[
                  { name: 'Parties & Accounts Master', route: '/masters/parties', desc: 'Customers, suppliers, GSTIN, opening balances' },
                  { name: 'Ledger & Bank Account Master', route: '/masters/ledger-accounts', desc: 'Chart of accounts, bank ledgers, live balances' },
                  { name: 'Machine Master (TFO / Texturising)', route: '/masters/machines', desc: 'Equipment codes, names, spindle counts' },
                  { name: 'Operator Master', route: '/masters/operators', desc: 'Machine operators, workers, phone numbers' },
                  { name: 'Location / Warehouse Master', route: '/masters/locations', desc: 'Godowns, storage bays, packing sections' },
                  { name: 'Yarn Quality Master (Denier/Filament)', route: '/masters/yarn-qualities', desc: 'Polyester DTY denier, luster, quality' },
                  { name: 'Yarn Grade Master (Lots / Shades)', route: '/masters/yarn-grades', desc: 'Quality grades (A, B, Fresh, Commercial)' },
                  { name: 'Production Book Master', route: '/masters/production-books', desc: 'Challan prefix registers, FY opening balances' },
                  { name: 'Report Masters (Group/Area/Broker)', route: '/masters/report-masters', desc: 'Party groups, areas, brokers, transporters, salespersons, item groups, purchase books' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveMenu(null);
                      navigate(item.route);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700 hover:text-blue-600 transition-colors"
                  >
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{item.desc}</div>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                      Active
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 3. Transaction Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('transaction')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'transaction'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 opacity-80" />
              <span>Transaction</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'transaction' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'transaction' && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Business Transactions
                </div>
                {[
                  { name: 'Sales Invoice', phase: 'Phase 7' },
                  { name: 'Delivery Challan', phase: 'Phase 7' },
                  { name: 'Sales Order', phase: 'Phase 7' },
                  { name: 'Credit Note', phase: 'Phase 7' },
                  { name: 'Yarn Purchase Bill', phase: 'Active', route: '/transactions/purchase', active: true },
                  { name: 'General Purchase Bill', phase: 'Phase 8' },
                  { name: 'Purchase Order', phase: 'Phase 8' },
                  { name: 'Debit Note', phase: 'Active', route: '/transactions/debit-notes/books', active: true },
                  { name: 'Bank Receipt Voucher', phase: 'Active', route: '/transactions/bank-receipts', active: true },
                  { name: 'Bank Payment Voucher', phase: 'Active', route: '/transactions/bank-payments', active: true },
                  { name: 'Cash Receipt Voucher', phase: 'Phase 9' },
                  { name: 'Cash Payment Voucher', phase: 'Phase 9' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveMenu(null);
                      if (item.route) {
                        navigate(item.route);
                      } else {
                        onOpenComingSoon(item.name, `${item.phase} (Planned)`, `Transaction entry screen for ${item.name}.`);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 hover:text-blue-600"
                  >
                    <span className={item.active ? 'font-bold text-[#2c5f57]' : ''}>{item.name}</span>
                    <span className={`text-[10px] font-mono ${item.active ? 'text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200' : 'text-slate-400'}`}>
                      {item.phase}
                    </span>
                  </button>
                ))}
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <div
                    className="relative"
                    onMouseEnter={() => setActiveSubMenu('bank_slip')}
                    onMouseLeave={() => setActiveSubMenu(null)}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSubMenu(activeSubMenu === 'bank_slip' ? null : 'bank_slip')
                      }
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between text-slate-700 hover:text-blue-600"
                    >
                      <span className="font-bold text-[#2c5f57]">4. Bank Slip / Receipt</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    {activeSubMenu === 'bank_slip' && (
                      <div className="absolute left-full top-0 ml-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                        {BANK_SLIP_MENU_ITEMS.map((item) => (
                          <button
                            key={item.title}
                            type="button"
                            onClick={() => {
                              if (!item.route) return;
                              setActiveMenu(null);
                              setActiveSubMenu(null);
                              navigate(item.route);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                          >
                            {item.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 4. Report Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('report')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'report'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 opacity-80" />
              <span>Report</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'report' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'report' && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Reports
                </div>
                <ReportMenuPanel
                  items={REPORT_MENU_ITEMS}
                  onSelect={(item) => {
                    setActiveMenu(null);
                    setActiveSubMenu(null);
                    if (item.implemented && item.route) {
                      navigate(item.route);
                    } else {
                      onOpenComingSoon(
                        item.title,
                        item.plannedPhase ? item.plannedPhase + ' (Planned)' : 'Planned',
                        item.description ?? 'Report screen for ' + item.title + '.'
                      );
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* ── 5. Manufacturing Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('manufacturing')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'manufacturing'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Factory className="w-3.5 h-3.5 opacity-80" />
              <span>Manufacturing</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'manufacturing' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'manufacturing' && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Mill Manufacturing Operations
                </div>

                {/* 1. Production Receive with Submenu */}
                <div
                  className="relative group"
                  onMouseEnter={() => setActiveSubMenu('prod_receive')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubMenu(activeSubMenu === 'prod_receive' ? null : 'prod_receive');
                  }}
                >
                  <div className="px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-slate-700 font-semibold cursor-pointer">
                    <span>1. Production Receive</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>

                  {activeSubMenu === 'prod_receive' && (
                    <div className="absolute left-full top-0 -mt-1 ml-0.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-slate-800 z-50 text-xs animate-in fade-in duration-75">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        Production Receive Flow
                      </div>
                      {MANUFACTURING_MENU_ITEMS[0].children?.map((sub, sidx) => (
                        <button
                          key={sidx}
                          onClick={() => {
                            setActiveMenu(null);
                            setActiveSubMenu(null);
                            if (sub.implemented && sub.route) {
                              navigate(sub.route);
                            } else if (sub.title === 'Machine Master') {
                              navigate('/masters/machines');
                            } else {
                              onOpenComingSoon(
                                `Production Receive: ${sub.title}`,
                                sub.plannedPhase || 'Phase 6',
                                sub.description || ''
                              );
                            }
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 hover:text-blue-600 block truncate flex items-center justify-between"
                        >
                          <span>• {sub.title}</span>
                          {(sub.implemented || sub.title === 'Machine Master') && (
                            <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2 to 7 Manufacturing Items */}
                {MANUFACTURING_MENU_ITEMS.slice(1).map((mItem, midx) => (
                  <button
                    key={midx}
                    onClick={() => {
                      setActiveMenu(null);
                      setActiveSubMenu(null);
                      onOpenComingSoon(
                        mItem.title,
                        mItem.plannedPhase || 'Phase 10',
                        mItem.description || ''
                      );
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600 flex items-center justify-between"
                  >
                    <span>{mItem.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── 6. Config Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('config')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'config'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Settings className="w-3.5 h-3.5 opacity-80" />
              <span>Config</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'config' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'config' && (
              <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  System Settings
                </div>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    navigate('/system-status');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-blue-600"
                >
                  <Settings className="w-3.5 h-3.5 text-blue-600" />
                  <div>
                    <div className="font-semibold">System Health & Status</div>
                    <div className="text-[10px] text-slate-400">PostgreSQL latency & server runtime</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenComingSoon('Production Book Prefix Config', 'Phase 5', 'Define custom numbering formats and invoice prefixes.');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                >
                  Production Book Prefix Config
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenComingSoon('User Accounts & Passwords', 'Phase 6', 'Operator and supervisor access permissions.');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                >
                  User Permissions & Passwords
                </button>
              </div>
            )}
          </div>

          {/* ── 7. Utility Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('utility')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'utility'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-950/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 opacity-80" />
              <span>Utility</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'utility' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'utility' && (
              <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100">
                  Tools & Maintenance
                </div>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenComingSoon('Laser & Dot-Matrix Printer Setup', 'Phase 6', 'Configure paper size, ESC/P2 dot-matrix mode, and challan printing.');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                >
                  Printer & PDF Export Setup
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenComingSoon('Database Backup Guide', 'Phase 12', 'Local automated pg_dump scripts for on-premises hard drive backup.');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                >
                  Database Backup Guide
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    onOpenComingSoon('Financial Year-End Roll-Forward', 'Phase 9', 'Automatic transfer of closing stock and party balances to next fiscal year.');
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 hover:text-blue-600"
                >
                  Year-End Balance Transfer
                </button>
              </div>
            )}
          </div>

          {/* ── 8. Pinned / Frequently Used Menu ── */}
          <div className="relative">
            <button
              onClick={() => toggleMenu('favourites')}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-[12.5px] font-semibold tracking-tight transition-colors ${
                activeMenu === 'favourites'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950/40'
                  : 'text-amber-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Pinned</span>
              <ChevronDown className={`w-3 h-3 opacity-70 transition-transform ${activeMenu === 'favourites' ? 'rotate-180' : ''}`} />
            </button>

            {activeMenu === 'favourites' && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-slate-800 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>Pinned Modules ({pinnedItems.length})</span>
                  <span className="text-[9px] text-slate-400">Click to Launch</span>
                </div>

                {pinnedItems.length === 0 ? (
                  <div className="px-4 py-3 text-center text-slate-400 text-xs">
                    No modules pinned yet. Click the pin icon on any dashboard card to pin it here.
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    {pinnedItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="flex items-center group">
                          <button
                            type="button"
                            onClick={() => handleShortcutClick(item)}
                            className="flex-1 min-w-0 text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-blue-600"
                          >
                            <Icon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                            <span className="flex-1 truncate">
                              <span className="block font-semibold truncate">{item.title}</span>
                              <span className="block text-[10px] text-slate-400 truncate">{item.category}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => unpin(item.id)}
                            aria-label={'Unpin ' + item.title}
                            title={'Unpin ' + item.title}
                            className="mr-2 p-1 rounded text-slate-300 hover:text-amber-600 hover:bg-amber-50"
                          >
                            <PinOff className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {frequentlyUsedItems.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 mt-1 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-y border-slate-100 flex items-center justify-between">
                      <span>Frequently Used</span>
                      <span className="text-[9px] text-slate-400">Top {frequentlyUsedItems.length}</span>
                    </div>
                    {frequentlyUsedItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleShortcutClick(item)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 hover:text-[#2c5f57]"
                        >
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="flex-1 truncate font-medium">{item.title}</span>
                          <span className="text-[10px] font-mono font-bold text-[#2c5f57] bg-emerald-50 border border-emerald-200 rounded px-1">
                            {getUsageCount(item.id)}
                          </span>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Company & Fiscal Year Badges */}
        <div className="flex shrink-0 items-center space-x-2.5 border-l border-[#2c5f57] pl-3">
          {activeCompany && activeFinancialYear ? (
            <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700/80 rounded-lg px-3 py-1">
              {/* Company Info */}
              <button
                onClick={onOpenCompanyDetails}
                className="flex items-center space-x-1.5 text-xs text-white hover:text-blue-300 transition-colors pr-2 border-r border-slate-700"
                title="View Company Profile & Tax Details"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-mono font-bold text-blue-400 bg-blue-950/60 border border-blue-800/80 px-1 rounded text-[11px]">
                  {activeCompany.companyCode}
                </span>
                <span className="max-w-[72px] sm:max-w-[120px] lg:max-w-[180px] truncate font-bold text-slate-100">
                  {activeCompany.companyName}
                </span>
              </button>

              {/* Fiscal Year Info */}
              <button
                onClick={onOpenFySwitcher}
                className="flex items-center space-x-1 text-xs text-emerald-400 font-mono font-bold hover:text-emerald-300 transition-colors"
                title="Click to Switch Financial Year"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{activeFinancialYear.yearName}</span>
                {activeFinancialYear.isLocked ? (
                  <span className="ml-0.5 inline-flex items-center text-[9px] bg-amber-900/60 text-amber-300 border border-amber-700 px-1 rounded">
                    <Lock className="w-2.5 h-2.5 mr-0.5" /> Locked
                  </span>
                ) : (
                  <span className="ml-0.5 text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-800 px-1 rounded">
                    Open
                  </span>
                )}
              </button>

              {/* Switcher Button */}
              <button
                onClick={() => navigate('/companies')}
                title="Switch Company (Open Selector)"
                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/companies')}
              className="flex items-center space-x-1.5 px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition-colors"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Select Company</span>
            </button>
          )}

          <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-400 font-medium pl-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">Local ERP</span>
          </div>
        </div>

      </div>
    </header>
  );
};
