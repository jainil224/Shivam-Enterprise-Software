import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, FinancialYear } from '../types';
import { validateSessionContext } from '../services/api';

interface CompanyContextType {
  activeCompany: Company | null;
  activeFinancialYear: FinancialYear | null;
  isLoadingContext: boolean;
  setActiveContext: (company: Company, fy: FinancialYear) => void;
  clearActiveContext: () => void;
  openSelectModal: () => void;
  closeSelectModal: () => void;
  isSelectModalOpen: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY_COMPANY_ID = 'bms_active_company_id';
const STORAGE_KEY_FY_ID = 'bms_active_fy_id';

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [activeFinancialYear, setActiveFinancialYear] = useState<FinancialYear | null>(null);
  const [isLoadingContext, setIsLoadingContext] = useState<boolean>(true);
  const [isSelectModalOpen, setIsSelectModalOpen] = useState<boolean>(false);

  // Restore session from localStorage on initial load
  useEffect(() => {
    const restoreContext = async () => {
      const storedCompanyId = localStorage.getItem(STORAGE_KEY_COMPANY_ID);
      const storedFyId = localStorage.getItem(STORAGE_KEY_FY_ID);

      if (storedCompanyId && storedFyId) {
        try {
          const validated = await validateSessionContext(storedCompanyId, storedFyId);
          setActiveCompany(validated.company);
          setActiveFinancialYear(validated.financialYear);
        } catch {
          // If stored context is invalid, clear stale IDs
          localStorage.removeItem(STORAGE_KEY_COMPANY_ID);
          localStorage.removeItem(STORAGE_KEY_FY_ID);
          setActiveCompany(null);
          setActiveFinancialYear(null);
        }
      }
      setIsLoadingContext(false);
    };

    restoreContext();
  }, []);

  const setActiveContext = (company: Company, fy: FinancialYear) => {
    setActiveCompany(company);
    setActiveFinancialYear(fy);
    localStorage.setItem(STORAGE_KEY_COMPANY_ID, company.id);
    localStorage.setItem(STORAGE_KEY_FY_ID, fy.id);
    setIsSelectModalOpen(false);
  };

  const clearActiveContext = () => {
    setActiveCompany(null);
    setActiveFinancialYear(null);
    localStorage.removeItem(STORAGE_KEY_COMPANY_ID);
    localStorage.removeItem(STORAGE_KEY_FY_ID);
  };

  const openSelectModal = () => setIsSelectModalOpen(true);
  const closeSelectModal = () => setIsSelectModalOpen(false);

  return (
    <CompanyContext.Provider
      value={{
        activeCompany,
        activeFinancialYear,
        isLoadingContext,
        setActiveContext,
        clearActiveContext,
        openSelectModal,
        closeSelectModal,
        isSelectModalOpen,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = (): CompanyContextType => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

