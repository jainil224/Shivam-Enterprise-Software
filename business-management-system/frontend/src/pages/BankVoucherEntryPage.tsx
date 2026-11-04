import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { BankVoucherForm } from '../components/BankVoucherForm';
import { getBankVoucherById } from '../services/api';
import { BankVoucher, BankVoucherType } from '../types';

interface BankVoucherEntryPageProps {
  voucherType: BankVoucherType;
}

export const bankVoucherPaths = (voucherType: BankVoucherType) => {
  const base = voucherType === 'RECEIPT' ? '/transactions/bank-receipts' : '/transactions/bank-payments';
  return {
    register: base,
    create: `${base}/new`,
    view: (id: string) => `${base}/${id}`,
    edit: (id: string) => `${base}/${id}/edit`,
    print: (id: string) => `${base}/${id}/print`,
  };
};

export const BankVoucherEntryPage: React.FC<BankVoucherEntryPageProps> = ({ voucherType }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const paths = bankVoucherPaths(voucherType);

  const [voucher, setVoucher] = useState<BankVoucher | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setVoucher(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getBankVoucherById(voucherType, id)
      .then((data) => {
        if (cancelled) return;
        if (data.status === 'CANCELLED') {
          setError('This voucher is cancelled and can no longer be edited.');
          setVoucher(null);
          return;
        }
        setVoucher(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load the bank voucher.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, voucherType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading voucher…</p>
        </div>
      </div>
    );
  }

  if (id && error) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Voucher cannot be edited</p>
        <p className="text-xs text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate(paths.register)}
          className="mt-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          Back to Register
        </button>
      </div>
    );
  }

  return (
    <BankVoucherForm
      voucherType={voucherType}
      voucher={voucher}
      onSaved={(saved) => navigate(paths.view(saved.id))}
      onBack={() => navigate(paths.register)}
      onOpenRegister={() => navigate(paths.register)}
    />
  );
};