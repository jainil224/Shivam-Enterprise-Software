import React, { useState, useEffect } from 'react';
import { X, Calendar, Lock, Check, Loader2, AlertCircle } from 'lucide-react';
import { FinancialYear } from '../types';
import { getFinancialYears } from '../services/api';
import { useCompany } from '../context/CompanyContext';

interface FinancialYearSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onManageAll?: () => void;
}

export const FinancialYearSwitchModal: React.FC<FinancialYearSwitchModalProps> = ({
  isOpen,
  onClose,
  onManageAll,
}) => {
  const { activeCompany, activeFinancialYear, setActiveContext } = useCompany();
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeCompany) {
      const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const list = await getFinancialYears(activeCompany.id);
          setYears(list);
        } catch (err: any) {
          setError(err.message || 'Failed to load financial years.');
        } finally {
          setIsLoading(false);
        }
      };
      load();
    }
  }, [isOpen, activeCompany]);

  if (!isOpen || !activeCompany) return null;

  const handleSelectYear = (fy: FinancialYear) => {
    if (!fy.isActive) return;
    setActiveContext(activeCompany, fy);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Switch Financial Year</h2>
              <p className="text-xs text-slate-400 font-mono">
                {activeCompany.companyCode} • {activeCompany.companyName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Select an accounting period to view or record entries. Only active financial years can be opened.
          </p>

          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              <span>Fetching financial periods...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : years.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              No financial years found for this company.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {years.map((fy) => {
                const isSelected = activeFinancialYear?.id === fy.id;
                return (
                  <button
                    key={fy.id}
                    onClick={() => handleSelectYear(fy)}
                    disabled={!fy.isActive}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500'
                        : fy.isActive
                        ? 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        : 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{fy.yearName}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                            CURRENT ACTIVE
                          </span>
                        )}
                        {fy.isLocked && (
                          <span className="inline-flex items-center space-x-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5 mr-0.5" /> Locked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {new Date(fy.startDate).toISOString().slice(0, 10)} to {new Date(fy.endDate).toISOString().slice(0, 10)}
                      </p>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer with Manage All button */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {onManageAll ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageAll();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                + Add / Manage Financial Years
              </button>
            ) : <span />}

            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
