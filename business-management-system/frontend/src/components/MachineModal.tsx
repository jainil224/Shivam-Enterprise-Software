import React, { useState, useEffect } from 'react';
import { X, Cog, AlertCircle, Save } from 'lucide-react';
import { Machine } from '../types';
import { createMachine, updateMachine } from '../services/api';

interface MachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  machineToEdit?: Machine | null;
}

export const MachineModal: React.FC<MachineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  machineToEdit,
}) => {
  const isEditing = Boolean(machineToEdit);

  const [machineCode, setMachineCode] = useState('');
  const [machineName, setMachineName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (machineToEdit) {
      setMachineCode(machineToEdit.machineCode || '');
      setMachineName(machineToEdit.machineName || '');
      setDescription(machineToEdit.description || '');
      setIsActive(machineToEdit.isActive !== false);
    } else {
      setMachineCode('');
      setMachineName('');
      setDescription('');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [machineToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!machineCode.trim()) errors.machineCode = 'Machine Code is required.';
    if (!machineName.trim()) errors.machineName = 'Machine Name is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      machineCode: machineCode.trim().toUpperCase(),
      machineName: machineName.trim(),
      description: description.trim() || null,
      isActive,
    };

    try {
      if (isEditing && machineToEdit) {
        await updateMachine(machineToEdit.id, payload);
      } else {
        await createMachine(payload);
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
      setGeneralError(err.message || 'Failed to save machine record.');
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
              <Cog className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Machine: ${machineToEdit?.machineCode}` : 'Add New Machine'}
              </h2>
              <p className="text-xs text-slate-400">TFO, texturising, and winding equipment</p>
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
              Machine Code <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={machineCode}
              onChange={(e) => setMachineCode(e.target.value.toUpperCase())}
              placeholder="e.g. TFO-01, TX-02"
              maxLength={30}
              className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                fieldErrors.machineCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {fieldErrors.machineCode && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.machineCode}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Machine Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={machineName}
              onChange={(e) => setMachineName(e.target.value)}
              placeholder="e.g. Two-For-One Twister Machine 1"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                fieldErrors.machineName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
            {fieldErrors.machineName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.machineName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Line / Spindles</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 256 Spindles, Line B, High speed double deck"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="machineActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="machineActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Machine (Selectable in production receive entries)
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
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Machine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

