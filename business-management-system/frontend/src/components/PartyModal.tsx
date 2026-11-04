import React, { useState, useEffect } from 'react';
import { X, Users, AlertCircle, Save } from 'lucide-react';
import { Party, PartyType, BalanceType } from '../types';
import { createParty, updateParty } from '../services/api';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  partyToEdit?: Party | null;
}

export const PartyModal: React.FC<PartyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  partyToEdit,
}) => {
  const isEditing = Boolean(partyToEdit);

  const [partyCode, setPartyCode] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('CUSTOMER');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [balanceType, setBalanceType] = useState<BalanceType>('DEBIT');
  const [isActive, setIsActive] = useState(true);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (partyToEdit) {
      setPartyCode(partyToEdit.partyCode || '');
      setPartyName(partyToEdit.partyName || '');
      setPartyType(partyToEdit.partyType || 'CUSTOMER');
      setGstin(partyToEdit.gstin || '');
      setPanNumber(partyToEdit.panNumber || '');
      setAddress(partyToEdit.address || '');
      setCity(partyToEdit.city || '');
      setState(partyToEdit.state || '');
      setPincode(partyToEdit.pincode || '');
      setPhone(partyToEdit.phone || '');
      setEmail(partyToEdit.email || '');
      setOpeningBalance(String(partyToEdit.openingBalance || '0.00'));
      setBalanceType(partyToEdit.balanceType || 'DEBIT');
      setIsActive(partyToEdit.isActive !== false);
    } else {
      setPartyCode('');
      setPartyName('');
      setPartyType('CUSTOMER');
      setGstin('');
      setPanNumber('');
      setAddress('');
      setCity('');
      setState('');
      setPincode('');
      setPhone('');
      setEmail('');
      setOpeningBalance('0.00');
      setBalanceType('DEBIT');
      setIsActive(true);
    }
    setFieldErrors({});
    setGeneralError(null);
  }, [partyToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!partyCode.trim()) {
      errors.partyCode = 'Party Code is required.';
    }
    if (!partyName.trim()) {
      errors.partyName = 'Party Name is required.';
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

    setIsSubmitting(true);
    setGeneralError(null);

    const payload = {
      partyCode: partyCode.trim().toUpperCase(),
      partyName: partyName.trim(),
      partyType,
      gstin: gstin.trim().toUpperCase() || null,
      panNumber: panNumber.trim().toUpperCase() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      pincode: pincode.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      openingBalance: Number(openingBalance) || 0,
      balanceType,
      isActive,
    };

    try {
      if (isEditing && partyToEdit) {
        await updateParty(partyToEdit.id, payload);
      } else {
        await createParty(payload);
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
      setGeneralError(err.message || 'Failed to save party record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {isEditing ? `Edit Party: ${partyToEdit?.partyName}` : 'Add New Party / Account'}
              </h2>
              <p className="text-xs text-slate-400">Customer, supplier & broker ledger configuration</p>
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
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partyCode}
                onChange={(e) => setPartyCode(e.target.value.toUpperCase())}
                placeholder="e.g. CUST-001"
                maxLength={30}
                className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                  fieldErrors.partyCode ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.partyCode && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.partyCode}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party Legal Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="e.g. Rajesh Fabrics Pvt. Ltd."
                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                  fieldErrors.partyName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.partyName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.partyName}</p>}
            </div>
          </div>

          {/* Section 2: Type & Tax Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Party Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={partyType}
                onChange={(e) => setPartyType(e.target.value as PartyType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="CUSTOMER">Customer (Debtor)</option>
                <option value="SUPPLIER">Supplier (Creditor)</option>
                <option value="BOTH">Both (Customer & Supplier)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (15 Digits)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="24AAAAA0000A1Z5"
                maxLength={15}
                className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                  fieldErrors.gstin ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.gstin && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.gstin}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number (10 Digits)</label>
              <input
                type="text"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                placeholder="AAAAA0000A"
                maxLength={10}
                className={`w-full px-3 py-2 text-xs font-mono uppercase rounded-lg border ${
                  fieldErrors.panNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.panNumber && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.panNumber}</p>}
            </div>
          </div>

          {/* Section 3: Address & Location */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Premises / Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Plot/Shop No., Market / Area, Road"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Gujarat"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="395002"
                  maxLength={6}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Contact & Opening Balance */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9825123456"
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  fieldErrors.phone ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.phone && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@party.com"
                className={`w-full px-3 py-2 text-xs rounded-lg border ${
                  fieldErrors.email ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className={`w-full px-3 py-2 text-xs font-mono rounded-lg border ${
                  fieldErrors.openingBalance ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {fieldErrors.openingBalance && (
                <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.openingBalance}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Balance Type</label>
              <select
                value={balanceType}
                onChange={(e) => setBalanceType(e.target.value as BalanceType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="DEBIT">Debit (Dr) - Receivable</option>
                <option value="CREDIT">Credit (Cr) - Payable</option>
              </select>
            </div>
          </div>

          {/* Active Status Checkbox */}
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="partyActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="partyActive" className="text-xs font-semibold text-slate-700 select-none cursor-pointer">
              Active Party (Selectable in production and accounting entries)
            </label>
          </div>

          {/* Action Buttons */}
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
              <span>{isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Party'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
