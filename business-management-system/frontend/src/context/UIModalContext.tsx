import React, { createContext, useContext, useState } from 'react';
import { ComingSoonModal } from '../components/ComingSoonModal';
import { FinancialYearSwitchModal } from '../components/FinancialYearSwitchModal';
import { CompanyDetailsModal } from '../components/CompanyDetailsModal';
import { CompanyFormModal } from '../components/CompanyFormModal';
import { FinancialYearModal } from '../components/FinancialYearModal';
import { useCompany } from './CompanyContext';
import { useNavigate } from 'react-router-dom';

interface UIModalContextType {
  openComingSoon: (title: string, plannedPhase: string, description: string) => void;
  openFySwitcher: () => void;
  openCompanyDetails: () => void;
  openAddCompany: () => void;
  openManageFys: () => void;
}

const UIModalContext = createContext<UIModalContextType | undefined>(undefined);

export const UIModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [comingSoonData, setComingSoonData] = useState<{
    isOpen: boolean;
    title: string;
    plannedPhase: string;
    description: string;
  }>({
    isOpen: false,
    title: '',
    plannedPhase: '',
    description: '',
  });

  const [isFySwitchOpen, setIsFySwitchOpen] = useState(false);
  const [isCompanyDetailsOpen, setIsCompanyDetailsOpen] = useState(false);
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [isManageFysOpen, setIsManageFysOpen] = useState(false);

  const openComingSoon = (title: string, plannedPhase: string, description: string) => {
    setComingSoonData({
      isOpen: true,
      title,
      plannedPhase,
      description,
    });
  };

  const openFySwitcher = () => setIsFySwitchOpen(true);
  const openCompanyDetails = () => setIsCompanyDetailsOpen(true);
  const openAddCompany = () => setIsAddCompanyOpen(true);
  const openManageFys = () => setIsManageFysOpen(true);

  return (
    <UIModalContext.Provider
      value={{
        openComingSoon,
        openFySwitcher,
        openCompanyDetails,
        openAddCompany,
        openManageFys,
      }}
    >
      {children}

      {/* Global Modals Mounted Once */}
      <ComingSoonModal
        isOpen={comingSoonData.isOpen}
        onClose={() => setComingSoonData((prev) => ({ ...prev, isOpen: false }))}
        title={comingSoonData.title}
        plannedPhase={comingSoonData.plannedPhase}
        description={comingSoonData.description}
      />

      <FinancialYearSwitchModal
        isOpen={isFySwitchOpen}
        onClose={() => setIsFySwitchOpen(false)}
        onManageAll={() => setIsManageFysOpen(true)}
      />

      <CompanyDetailsModal
        isOpen={isCompanyDetailsOpen}
        onClose={() => setIsCompanyDetailsOpen(false)}
        company={activeCompany}
        activeFinancialYear={activeFinancialYear}
        onEditCompany={() => {
          setIsCompanyDetailsOpen(false);
          navigate('/companies');
        }}
      />

      <CompanyFormModal
        isOpen={isAddCompanyOpen}
        onClose={() => setIsAddCompanyOpen(false)}
        onSuccess={() => {
          setIsAddCompanyOpen(false);
          navigate('/companies');
        }}
      />

      <FinancialYearModal
        isOpen={isManageFysOpen}
        onClose={() => setIsManageFysOpen(false)}
        company={activeCompany}
        onFinancialYearsUpdated={() => {}}
      />
    </UIModalContext.Provider>
  );
};

export const useUIModals = (): UIModalContextType => {
  const context = useContext(UIModalContext);
  if (!context) {
    throw new Error('useUIModals must be used within a UIModalProvider');
  }
  return context;
};

