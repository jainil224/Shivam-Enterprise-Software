import React from 'react';
import { X, Building2, Mail, Phone, MapPin, Calendar, Edit2 } from 'lucide-react';
import { Company, FinancialYear } from '../types';

interface CompanyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  activeFinancialYear: FinancialYear | null;
  onEditCompany?: () => void;
}

export const CompanyDetailsModal: React.FC<CompanyDetailsModalProps> = ({
  isOpen,
  onClose,
  company,
  activeFinancialYear,
  onEditCompany,
}) => {
  if (!isOpen || !company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Company Profile & Statutory Details</h2>
              <p className="text-xs text-slate-400 font-mono">CODE: {company.companyCode}</p>
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
        <div className="p-6 space-y-6">
          {/* Top Brand Banner */}
          <div className="flex items-center space-x-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            {company.logoPath ? (
              <img
                src={company.logoPath}
                alt={company.companyName}
                className="w-16 h-16 rounded-lg object-contain border border-slate-200 bg-white p-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-2xl select-none">
                {company.companyName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                  {company.companyCode}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Active Legal Entity
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1 truncate">{company.companyName}</h3>
              {activeFinancialYear && (
                <p className="text-xs text-slate-500 flex items-center space-x-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Current Fiscal: <strong className="font-mono text-slate-700">{activeFinancialYear.yearName}</strong></span>
                </p>
              )}
            </div>
          </div>

          {/* Statutory Tax Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GSTIN</span>
              <span className="text-sm font-mono font-bold text-slate-800 block mt-0.5">
                {company.gstin || <span className="text-slate-400 font-normal italic">Not Specified</span>}
              </span>
            </div>

            <div className="p-3.5 rounded-lg border border-slate-200 bg-white">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PAN Number</span>
              <span className="text-sm font-mono font-bold text-slate-800 block mt-0.5">
                {company.panNumber || <span className="text-slate-400 font-normal italic">Not Specified</span>}
              </span>
            </div>
          </div>

          {/* Address & Contact */}
          <div className="space-y-3 text-xs text-slate-600 border-t pt-4">
            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-700 block">Registered Address</span>
                <span>
                  {[company.address, company.city, company.state, company.pincode].filter(Boolean).join(', ') || 'No address configured'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 block">Phone</span>
                  <span>{company.phone || 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-700 block">Email</span>
                  <span className="truncate block max-w-[180px]">{company.email || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            {onEditCompany ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditCompany();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Company Profile</span>
              </button>
            ) : <span />}

            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
