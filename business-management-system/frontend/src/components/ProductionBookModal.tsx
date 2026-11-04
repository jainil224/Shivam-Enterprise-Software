import React, { useState, useEffect } from 'react';
import { X, BookOpen, AlertCircle, Save } from 'lucide-react';
import { ProductionBook } from '../types';
import { createProductionBook, updateProductionBook } from '../services/api';
import { useCompany } from '../context/CompanyContext';

interface ProductionBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bookToEdit?: ProductionBook | null;
}

export const ProductionBookModal: React.FC<ProductionBookModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bookToEdit,
}) => {
  const { activeFinancialYear } = useCompany();
  const isEditing = Boolean(bookToEdit);

  const [prefix, setPrefix] = useState('');
  const [bookName, setBookName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.000');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bookToEdit) {
      setPrefix(bookToEdit.prefix || '');
      setBookName(bookToEdit.bookName || '');
      setOpeningBalance(String(bookToEdit.openingBalance || '0.000'));
      setIsActive(bookToEdit.isActive !== false);
    } else {
      setPrefix('');
      setBookName('');
      setOpeningBalance('0.000');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [bookToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!prefix.trim()) errors.prefix = 'Book Prefix is required (e.g. PR-25, REC-A).';
    if (!bookName.trim()) errors.bookName = 'Book Name is required.';
    const obNum = Number(openingBalance);
    if (isNaN(obNum) || obNum < 0) {
      errors.openingBalance = 'Opening balance must be a non-negative number.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!activeFinancialYear) {
      setGeneralError('No active financial year context selected.');
      return;
    }

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      financialYearId: activeFinancialYear.id,
      prefix: prefix.trim().toUpperCase(),
      bookName: bookName.trim(),
      openingBalance: Number(openingBalance) || 0,
      isActive,
    };

    try {
      if (isEditing && bookToEdit) {
        await updateProductionBook(bookToEdit.id, payload);
      } else {
        await createProductionBook(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors)) {
        const mappedErrors: Record<string, string> = {};
        err.errors.forEach((e: { field: string; message: string }) => {
          mappedErrors[e.field] = e.message;
        });
        setFieldErrors(mappedErrors);
      }
      setGeneralError(err.message || 'Failed to save production book.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Book: ${bookToEdit?.prefix}` : 'Add New Production Book'}
              </h2>
              <p className="text-xs text-slate-400">
                FY: <span className="font-mono text-emerald-400 font-bold">{activeFinancialYear?.yearName}</span> • Serial numbering register
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

        {generalError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Book Prefix <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. PR-25, REC-A"
              maxLength={20}
              className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                fieldErrors.prefix ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {fieldErrors.prefix && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.prefix}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Production Book Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              placeholder="e.g. Main Production Receive Book"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                fieldErrors.bookName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {fieldErrors.bookName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.bookName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (Weight in KG)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                fieldErrors.openingBalance ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {fieldErrors.openingBalance && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.openingBalance}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="bookActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="bookActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Production Book (Selectable for new challan creation)
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Book'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

