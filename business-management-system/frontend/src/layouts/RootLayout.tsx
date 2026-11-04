import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopNavigationBar } from '../components/TopNavigationBar';
import { useUIModals } from '../context/UIModalContext';

interface RootLayoutProps {
  children: React.ReactNode;
}

export const RootLayout: React.FC<RootLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const {
    openComingSoon,
    openFySwitcher,
    openCompanyDetails,
    openAddCompany,
    openManageFys,
  } = useUIModals();

  // Navigation menu state
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#dce8e1] flex flex-col text-slate-800 overflow-x-hidden w-full">
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
      <main className="flex-1 w-full min-w-0 px-3 sm:px-4 lg:px-5 py-3">
        {children}
      </main>

      {/* System Footer */}
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
    </div>
  );
};
