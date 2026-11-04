import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle, Save } from 'lucide-react';
import { Operator } from '../types';
import { createOperator, updateOperator } from '../services/api';

interface OperatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  operatorToEdit?: Operator | null;
}

export const OperatorModal: React.FC<OperatorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  operatorToEdit,
}) => {
  const isEditing = Boolean(operatorToEdit);

  const [operatorCode, setOperatorCode] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (operatorToEdit) {
      setOperatorCode(operatorToEdit.operatorCode || '');
      setOperatorName(operatorToEdit.operatorName || '');
      setPhone(operatorToEdit.phone || '');
      setIsActive(operatorToEdit.isActive !== false);
    } else {
      setOperatorCode('');
      setOperatorName('');
      setPhone('');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [operatorToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!operatorCode.trim()) errors.operatorCode = 'Operator Code is required.';
    if (!operatorName.trim()) errors.operatorName = 'Operator Name is required.';
    if (phone.trim()) {
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const phoneRegex = /^(?:(?:\+|0{0,2})91)?[6789]\d{9}$/;
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = 'Invalid 10-digit phone number.';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      operatorCode: operatorCode.trim().toUpperCase(),
      operatorName: operatorName.trim(),
      phone: phone.trim() || null,
      isActive,
    };

    try {
      if (isEditing && operatorToEdit) {
        await updateOperator(operatorToEdit.id, payload);
      } else {
        await createOperator(payload);
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
      setGeneralError(err.message || 'Failed to save operator record.');
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
            <div className="p-2 bg-emerald-600 rounded-lg">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Operator: ${operatorToEdit?.operatorCode}` : 'Add New Operator'}
              </h2>
              <p className="text-xs text-slate-400">Twisting and texturising machine workers</p>
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
              Operator Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={operatorCode}
              onChange={(e) => setOperatorCode(e.target.value.toUpperCase())}
              placeholder="e.g. OP-01, WORKER-05"
              maxLength={30}
              className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                fieldErrors.operatorCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
            {fieldErrors.operatorCode && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.operatorCode}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operator Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="e.g. Suresh Patel"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                fieldErrors.operatorName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
            {fieldErrors.operatorName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.operatorName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9825123456"
              className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                fieldErrors.phone ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
            />
            {fieldErrors.phone && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p>}
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="operatorActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="operatorActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Operator (Selectable in production entries)
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
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Operator'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

