import React from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';

interface RequireCompanyContextProps {
  children: React.ReactElement;
}

export const RequireCompanyContext: React.FC<RequireCompanyContextProps> = ({ children }) => {
  const { activeCompany, activeFinancialYear, isLoadingContext } = useCompany();

  // 1. While loading / validating context from PostgreSQL via validateSessionContext
  if (isLoadingContext) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-sm font-bold text-slate-800">Verifying Business Context</h3>
          <p className="text-xs text-slate-500">
            Validating active company & financial year with local database...
          </p>
        </div>
      </div>
    );
  }

  // 2. If no valid company or financial year is present, redirect to Company Selection
  if (!activeCompany || !activeFinancialYear) {
    return <Navigate to="/companies" replace />;
  }

  // 3. Context is verified and active
  return children;
};
