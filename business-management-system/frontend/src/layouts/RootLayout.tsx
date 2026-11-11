import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TopNavigationBar } from '../components/TopNavigationBar';
import { useUIModals } from '../context/UIModalContext';
import { findShortcutByPath } from '../config/navigation';
import { recordModuleUsage } from '../hooks/useModulePreferences';

interface RootLayoutProps {
  children: React.ReactNode;
}

export const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    openComingSoon,
    openFySwitcher,
    openCompanyDetails,
    openAddCompany,
    openManageFys,
  } = useUIModals();

  // Navigation menu state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // A route change always closes the navigation flyouts.
  useEffect(() => {
    setActiveMenu(null);
  }, [location.pathname]);

  // Record real launches for the "Frequently Used" ranking. The guard stops
  // React StrictMode's double effect run (and same-route re-renders) from
  // inflating the counter.
  const lastTrackedPath = useRef<{ path: string; at: number }>({ path: '', at: 0 });
  useEffect(() => {
    const shortcut = findShortcutByPath(location.pathname);
    if (!shortcut) return;
    const now = Date.now();
    const previous = lastTrackedPath.current;
    if (previous.path === location.pathname && now - previous.at < 1000) return;
    lastTrackedPath.current = { path: location.pathname, at: now };
    recordModuleUsage(shortcut.id);
  }, [location.pathname]);

  // Report windows own the whole viewport so their sticky action bars and A4
  // sheets are never pushed below the fold by the app chrome.
  const fullHeightRoute =
    location.pathname === '/reports/sales-purchase/bill-base' ||
    location.pathname === '/reports/sales-purchase/bill-base/print' ||
    location.pathname.startsWith('/reports/bank-reconciliation/');

  // -------------------------------------------------------------
  // Keyboard Navigation: F1, Alt+C, Alt+M, Alt+T, Alt+R, Alt+F, Esc
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in form inputs
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // F1: Dashboard Home
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveMenu(null);
        navigate('/');
        return;
      }

      // Escape: Close any open menu
      if (e.key === 'Escape') {
        if (activeMenu) {
          setActiveMenu(null);
          return;
        }
      }

      // Alt shortcuts (only if not typing in text fields)
      if (e.altKey && !isInput) {
        const key = e.key.toLowerCase();
        if (key === 'c') {
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'company' ? null : 'company'));
        } else if (key === 'm') {
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'master' ? null : 'master'));
        } else if (key === 't') {
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'transaction' ? null : 'transaction'));
        } else if (key === 'r') {
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'report' ? null : 'report'));
        } else if (key === 'f') {
          e.preventDefault();
          setActiveMenu((prev) => (prev === 'favourites' ? null : 'favourites'));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, activeMenu]);

  return (
    <div
      className={
        (fullHeightRoute ? 'h-screen overflow-hidden' : 'min-h-screen overflow-x-hidden') +
        ' bg-[#dce8e1] flex flex-col text-slate-800 w-full'
      }
    >
      {/* Top ERP Navigation Bar */}
      <TopNavigationBar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        onOpenComingSoon={openComingSoon}
        onOpenFySwitcher={openFySwitcher}
        onOpenCompanyDetails={openCompanyDetails}
        onOpenAddCompany={openAddCompany}
        onOpenManageFys={openManageFys}
      />

      {/* Main Content Area */}
      <main
        className={
          fullHeightRoute
            ? 'flex-1 w-full min-w-0 min-h-0 overflow-hidden p-2 flex flex-col'
            : 'flex-1 w-full min-w-0 px-3 sm:px-4 lg:px-5 py-3'
        }
      >
        {children}
      </main>

      {/* System Footer */}
      {!fullHeightRoute && (
        <footer className="bg-[#eaf2ef] border-t border-[#789d93] py-2 text-xs text-slate-500">
          <div className="w-full px-3 sm:px-4 lg:px-5 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
              <span>BMS v1.0</span>
              <span className="text-slate-300">•</span>
              <span>PostgreSQL 18</span>
              <span className="text-slate-300">•</span>
              <span>Local Database Architecture</span>
            </div>
            <span aria-hidden="true" className="hidden sm:inline text-slate-300">|</span>
            <span className="text-[11px] font-semibold text-slate-600">Made by Jainil Patel V.</span>
          </div>
        </footer>
      )}
    </div>
  );
};
