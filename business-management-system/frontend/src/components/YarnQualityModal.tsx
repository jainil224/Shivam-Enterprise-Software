import React, { useState, useEffect } from 'react';
import { X, Layers, AlertCircle, Save } from 'lucide-react';
import { YarnQuality } from '../types';
import { createYarnQuality, updateYarnQuality } from '../services/api';

interface YarnQualityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  qualityToEdit?: YarnQuality | null;
}

export const YarnQualityModal: React.FC<YarnQualityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  qualityToEdit,
}) => {
  const isEditing = Boolean(qualityToEdit);

  const [qualityName, setQualityName] = useState('');
  const [denier, setDenier] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (qualityToEdit) {
      setQualityName(qualityToEdit.qualityName || '');
      setDenier(qualityToEdit.denier || '');
      setDescription(qualityToEdit.description || '');
      setIsActive(qualityToEdit.isActive !== false);
    } else {
      setQualityName('');
      setDenier('');
      setDescription('');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [qualityToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!qualityName.trim()) errors.qualityName = 'Quality Name is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      qualityName: qualityName.trim(),
      denier: denier.trim() || null,
      description: description.trim() || null,
      isActive,
    };

    try {
      if (isEditing && qualityToEdit) {
        await updateYarnQuality(qualityToEdit.id, payload);
      } else {
        await createYarnQuality(payload);
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
      setGeneralError(err.message || 'Failed to save yarn quality.');
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
            <div className="p-2 bg-blue-600 rounded-lg">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Quality: ${qualityToEdit?.qualityName}` : 'Add New Yarn Quality'}
              </h2>
              <p className="text-xs text-slate-400">Denier, filament, luster, and twist specifications</p>
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
              Quality Name / Description <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={qualityName}
              onChange={(e) => setQualityName(e.target.value)}
              placeholder="e.g. 80/72 Polyester DTY Texturised"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                fieldErrors.qualityName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {fieldErrors.qualityName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.qualityName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Numeric Denier / Filaments</label>
            <input
              type="text"
              value={denier}
              onChange={(e) => setDenier(e.target.value)}
              placeholder="e.g. 80, 150/48, 50/36"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Technical Notes / Luster / TPM</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Semi Dull, 80 TPM, High tenacity"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="qualityActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="qualityActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Quality (Selectable in production and sales entries)
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
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Quality'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

