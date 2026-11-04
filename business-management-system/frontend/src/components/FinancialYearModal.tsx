import React, { useState, useEffect } from 'react';
import { X, Calendar, Lock, Unlock, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Company, FinancialYear } from '../types';
import { getFinancialYears, createFinancialYear, lockFinancialYear, unlockFinancialYear } from '../services/api';

interface FinancialYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  onFinancialYearsUpdated?: () => void;
}

export const FinancialYearModal: React.FC<FinancialYearModalProps> = ({
  isOpen,
  onClose,
  company,
  onFinancialYearsUpdated,
}) => {
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New FY form state
  const [yearName, setYearName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchYears = async () => {
    if (!company) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFinancialYears(company.id);
      setFinancialYears(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch financial years.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && company) {
      fetchYears();
      setYearName('');
      setStartDate('');
      setEndDate('');
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, company]);

  if (!isOpen || !company) return null;

  const handleCreateFY = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim() || !startDate || !endDate) {
      setError('Please fill in all financial year fields.');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setError('Start date must be strictly before end date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await createFinancialYear(company.id, {
        yearName: yearName.trim(),
        startDate,
        endDate,
        isActive: true,
      });

      setSuccessMessage(`Financial Year '${yearName.trim()}' added successfully.`);
      setYearName('');
      setStartDate('');
      setEndDate('');
      await fetchYears();
      onFinancialYearsUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create financial year.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLock = async (fy: FinancialYear) => {
    setError(null);
    setSuccessMessage(null);
    try {
      if (fy.isLocked) {
        await unlockFinancialYear(fy.id);
        setSuccessMessage(`Financial Year '${fy.yearName}' unlocked.`);
      } else {
        await lockFinancialYear(fy.id);
        setSuccessMessage(`Financial Year '${fy.yearName}' locked against historical modifications.`);
      }
      await fetchYears();
      onFinancialYearsUpdated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle lock status.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Financial Years — {company.companyName}</h2>
              <p className="text-xs text-slate-400">
                Company Code: <span className="font-mono text-indigo-300">{company.companyCode}</span> • Database-enforced overlap protection
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center space-x-2 text-emerald-700 text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Create New FY Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center space-x-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Add New Financial Year</span>
            </h3>

            <form onSubmit={handleCreateFY} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">FY Name</label>
                <input
                  type="text"
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                  placeholder="e.g. 2026-2027"
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-1.5 px-3 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Add Year'}
                </button>
              </div>
            </form>
          </div>

          {/* List of Existing Financial Years */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Configured Fiscal Periods ({financialYears.length})
            </h3>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading periods from database...</div>
            ) : financialYears.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                No financial years defined yet for this company. Add one above.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2">Year Name</th>
                      <th className="px-3 py-2">Period Range</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Lock Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financialYears.map((fy) => (
                      <tr key={fy.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{fy.yearName}</td>
                        <td className="px-3 py-2.5 text-slate-600 font-mono">
                          {new Date(fy.startDate).toISOString().slice(0, 10)} to {new Date(fy.endDate).toISOString().slice(0, 10)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              fy.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {fy.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              fy.isLocked
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {fy.isLocked ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" /> Locked
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 mr-1" /> Open
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleLock(fy)}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                              fy.isLocked
                                ? 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
                                : 'bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {fy.isLocked ? 'Unlock Year' : 'Lock Year'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

