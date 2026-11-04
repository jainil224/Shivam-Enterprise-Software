import React, { useState, useEffect } from 'react';
import { X, Building2, Upload, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { Company } from '../types';
import { createCompany, updateCompany } from '../services/api';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedCompany: Company) => void;
  companyToEdit?: Company | null;
}

export const CompanyFormModal: React.FC<CompanyFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyToEdit,
}) => {
  const isEditing = Boolean(companyToEdit);

  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoPath, setLogoPath] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (companyToEdit) {
      setCompanyCode(companyToEdit.companyCode || '');
      setCompanyName(companyToEdit.companyName || '');
      setGstin(companyToEdit.gstin || '');
      setPanNumber(companyToEdit.panNumber || '');
      setAddress(companyToEdit.address || '');
      setCity(companyToEdit.city || '');
      setState(companyToEdit.state || '');
      setPincode(companyToEdit.pincode || '');
      setPhone(companyToEdit.phone || '');
      setEmail(companyToEdit.email || '');
      setLogoPath(companyToEdit.logoPath || null);
    } else {
      setCompanyCode('');
      setCompanyName('');
      setGstin('');
      setPanNumber('');
      setAddress('');
      setCity('');
      setState('');
      setPincode('');
      setPhone('');
      setEmail('');
      setLogoPath(null);
    }
    setFieldErrors({});
    setGeneralError(null);
    setShowConfirmModal(false);
  }, [companyToEdit, isOpen]);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, logoPath: 'Logo image must be smaller than 2 MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoPath(reader.result as string);
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated.logoPath;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const validateClientSide = (): boolean => {
    const errors: Record<string, string> = {};

    if (!companyCode.trim()) {
      errors.companyCode = 'Company Code is required.';
    }

    if (!companyName.trim()) {
      errors.companyName = 'Company Name is required.';
    }

    if (gstin.trim()) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        errors.gstin = 'Invalid GSTIN format (e.g. 24AAAAA0000A1Z5).';
      }
    }

    if (panNumber.trim()) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber.trim().toUpperCase())) {
        errors.panNumber = 'Invalid PAN format (e.g. AAAAA0000A).';
      }
    }

    if (phone.trim()) {
      const cleanPhone = phone.replace(/[\s-]/g, '');
      const phoneRegex = /^(?:(?:\+|0{0,2})91)?[6789]\d{9}$/;
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = 'Invalid 10-digit phone number.';
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.email = 'Invalid email address.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClientSide()) return;

    if (isEditing) {
      // Show confirmation dialog before updating
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setIsSubmitting(true);
    setGeneralError(null);
    setShowConfirmModal(false);

    const payload = {
      companyCode: companyCode.trim().toUpperCase(),
      companyName: companyName.trim(),
      gstin: gstin.trim().toUpperCase() || null,
      panNumber: panNumber.trim().toUpperCase() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: pincode.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      logoPath: logoPath || null,
    };

    try {
      let saved: Company;
      if (isEditing && companyToEdit) {
        saved = await updateCompany(companyToEdit.id, payload);
      } else {
        saved = await createCompany(payload);
      }
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      if (err.errors && Array.isArray(err.errors)) {
        const mappedErrors: Record<string, string> = {};
        err.errors.forEach((e: { field: string; message: string }) => {
          mappedErrors[e.field] = e.message;
        });
        setFieldErrors(mappedErrors);
      }
      setGeneralError(err.message || 'Failed to save company information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditing ? `Edit Company — ${companyToEdit?.companyName}` : 'Add New Company'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Update business profile, tax numbers & address' : 'Register a new enterprise in the system'}
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

        {/* General Error Banner */}
        {generalError && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
              1. Basic Identification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SHIVAM01"
                  maxLength={20}
                  className={`w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border ${
                    fieldErrors.companyCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.companyCode && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.companyCode}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. SHIVAM ENTERPRISE PVT. LTD."
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    fieldErrors.companyName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.companyName && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.companyName}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Taxation & Statutory Identifiers */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
              2. Taxation & Statutory Numbers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN (15 Digits)
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 24AAAAA0000A1Z5"
                  maxLength={15}
                  className={`w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border ${
                    fieldErrors.gstin ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.gstin && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.gstin}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PAN Number (10 Digits)
                </label>
                <input
                  type="text"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. AAAAA0000A"
                  maxLength={10}
                  className={`w-full px-3 py-2 text-sm font-mono uppercase rounded-lg border ${
                    fieldErrors.panNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.panNumber && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.panNumber}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Registered Address */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
              3. Address Details
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Premises / Street Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Plot No., Industrial Estate, Road Name"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Surat"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Gujarat"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 395006"
                  maxLength={6}
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Contact & Logo */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b pb-1">
              4. Contact Information & Brand Logo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9825123456"
                  className={`w-full px-3 py-2 text-sm font-mono rounded-lg border ${
                    fieldErrors.phone ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.phone && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${
                    fieldErrors.email ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-rose-600 mt-1">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Company Logo</label>
              <div className="flex items-center space-x-4">
                {logoPath ? (
                  <div className="relative w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center p-1">
                    <img src={logoPath} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setLogoPath(null)}
                      className="absolute top-0 right-0 bg-rose-600 text-white p-0.5 rounded-bl hover:bg-rose-700"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-36 h-16 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-[11px] text-slate-500 mt-1">Upload Logo</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
                <div className="text-xs text-slate-500">
                  <p>PNG, JPG, SVG or WebP (Max 2MB).</p>
                  <p>Displayed on challans, invoices & header.</p>
                </div>
              </div>
              {fieldErrors.logoPath && (
                <p className="text-xs text-rose-600 mt-1">{fieldErrors.logoPath}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog before updating */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full space-y-4">
            <div className="flex items-center space-x-3 text-slate-900">
              <CheckCircle2 className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-bold">Confirm Company Update</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to save the changes for <span className="font-semibold text-slate-900">{companyName}</span>?
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSubmitting}
                className="px-5 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Yes, Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

