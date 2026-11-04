import React, { useState, useEffect } from 'react';
import { X, Award, AlertCircle, Save } from 'lucide-react';
import { YarnGrade } from '../types';
import { createYarnGrade, updateYarnGrade } from '../services/api';

interface YarnGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gradeToEdit?: YarnGrade | null;
}

export const YarnGradeModal: React.FC<YarnGradeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  gradeToEdit,
}) => {
  const isEditing = Boolean(gradeToEdit);

  const [gradeName, setGradeName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (gradeToEdit) {
      setGradeName(gradeToEdit.gradeName || '');
      setDescription(gradeToEdit.description || '');
      setIsActive(gradeToEdit.isActive !== false);
    } else {
      setGradeName('');
      setDescription('');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [gradeToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!gradeName.trim()) errors.gradeName = 'Grade Name is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      gradeName: gradeName.trim(),
      description: description.trim() || null,
      isActive,
    };

    try {
      if (isEditing && gradeToEdit) {
        await updateYarnGrade(gradeToEdit.id, payload);
      } else {
        await createYarnGrade(payload);
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
      setGeneralError(err.message || 'Failed to save yarn grade.');
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
            <div className="p-2 bg-purple-600 rounded-lg">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Grade: ${gradeToEdit?.gradeName}` : 'Add New Yarn Grade'}
              </h2>
              <p className="text-xs text-slate-400">Quality classification, lot grading, and finish categories</p>
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
              Grade Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={gradeName}
              onChange={(e) => setGradeName(e.target.value)}
              placeholder="e.g. A-Grade, Fresh, Second, Commercial"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                fieldErrors.gradeName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
            {fieldErrors.gradeName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.gradeName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Sorting Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Standard prime export grade, zero broken filaments"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="gradeActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="gradeActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Grade (Selectable in carton packing and sales sorting)
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
              className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Grade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

