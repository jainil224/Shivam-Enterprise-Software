import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Building,
  Package,
  Layers,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getPurchaseBillById } from '../services/api';

export const PurchaseBillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      getPurchaseBillById(id)
        .then((b) => setBill(b))
        .catch((e) => setError(e.message || 'Failed to load purchase bill.'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#dce8e1] flex flex-col items-center justify-center text-xs font-bold text-slate-700 space-y-2">
        <div className="w-6 h-6 border-2 border-[#2c5f57] border-t-transparent rounded-full animate-spin" />
        <span>Loading Purchase Bill #{id}...</span>
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-[#dce8e1] p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-6 rounded border border-red-300 shadow-md max-w-md w-full text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <h2 className="text-sm font-bold text-slate-800">Error Loading Purchase Bill</h2>
          <p className="text-xs text-red-600">{error || 'Purchase bill record not found.'}</p>
          <button
            onClick={() => navigate('/transactions/purchase')}
            className="px-4 py-1.5 bg-[#2c5f57] text-white rounded text-xs font-bold cursor-pointer"
          >
            Back to Bill Register
          </button>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#dce8e1] text-slate-800 flex flex-col font-sans select-none text-xs">
      {/* ── Title Bar ────────────────────────────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-4 py-2 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-4 h-4 text-emerald-300" />
          <span className="font-bold text-sm tracking-wide">
            Purchase Bill #{bill.billNumber}
          </span>
          <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
            {bill.status}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => window.print()}
            className="bg-white hover:bg-slate-100 text-slate-800 px-3 py-1 rounded font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Bill</span>
          </button>
          <button
            onClick={() => navigate('/transactions/purchase')}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white text-xs font-bold px-3 py-1 rounded flex items-center space-x-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Bill Register</span>
          </button>
        </div>
      </div>

      {/* ── Main Detail Content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto w-full">
        {/* Bill Summary Banner */}
        <div className="bg-white rounded border border-[#789d93] p-4 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-200 pb-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Bill Number :</span>
              <span className="font-mono font-bold text-sm text-[#2c5f57]">{bill.billNumber}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Bill Date :</span>
              <span className="font-mono font-bold text-slate-800">
                {new Date(bill.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Company :</span>
              <span className="font-bold text-slate-800">{activeCompany?.companyName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Financial Year :</span>
              <span className="font-bold text-slate-800">{bill.financialYear?.yearName || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Supplier Invoice No :</span>
              <span className="font-mono font-bold text-slate-800">{bill.supplierInvoiceNumber || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Supplier Invoice Date :</span>
              <span className="font-mono text-slate-800">
                {bill.supplierInvoiceDate
                  ? new Date(bill.supplierInvoiceDate).toLocaleDateString('en-IN')
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Place of Supply :</span>
              <span className="font-semibold text-slate-800">{bill.placeOfSupply || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Linked Source Challan :</span>
              {bill.sourceChallan ? (
                <Link
                  to={`/manufacturing/production-receive/records/${bill.sourceChallan.id}`}
                  className="font-bold text-blue-700 hover:underline flex items-center gap-1 font-mono"
                >
                  <Package className="w-3 h-3" />
                  Challan #{bill.sourceChallan.challanNumber}
                </Link>
              ) : (
                <span className="text-slate-400 font-mono">None (Direct Inward)</span>
              )}
            </div>
          </div>
        </div>

        {/* Supplier Snapshot Card */}
        <div className="bg-white rounded border border-[#789d93] p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-xs text-[#2c5f57] flex items-center gap-1.5 uppercase">
              <Building className="w-4 h-4" /> Supplier Information Snapshot
            </span>
            <div className="flex items-center gap-2">
              {bill.isVerifiedSupplier ? (
                <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Verified via {bill.verificationSource}
                </span>
              ) : (
                <span className="bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Unverified Supplier Information
                </span>
              )}
              {bill.partyId && (
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-semibold">
                  Saved in Party Master
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div>
              <span className="text-slate-500 block text-[11px]">Legal Name :</span>
              <span className="font-bold text-slate-900 text-sm">{bill.supplierLegalName}</span>
              {bill.supplierTradeName && (
                <span className="text-[11px] text-slate-500 block">Trade: {bill.supplierTradeName}</span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Supplier GSTIN :</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {bill.supplierGstin || 'Unregistered'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">State & State Code :</span>
              <span className="font-semibold text-slate-800">
                {bill.supplierState || '—'} (Code: {bill.supplierStateCode || '—'})
              </span>
            </div>
            <div className="sm:col-span-3">
              <span className="text-slate-500 block text-[11px]">Billing Address :</span>
              <span className="text-slate-800">
                {bill.supplierAddress || '—'} {bill.supplierCity ? `, ${bill.supplierCity}` : ''} {bill.supplierPincode ? ` - ${bill.supplierPincode}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded border border-[#789d93] overflow-hidden shadow-xs">
          <div className="bg-[#c2ded7] px-4 py-2 border-b border-[#789d93] flex items-center justify-between">
            <span className="font-bold text-xs text-[#1e403a] flex items-center gap-1.5 uppercase">
              <Layers className="w-4 h-4" /> Billed Items & Carton Details ({bill.items?.length || 0} entries)
            </span>
            <span className="font-mono font-bold text-slate-700">
              Total Quantity: {Number(bill.totalQuantity).toFixed(3)} KG
            </span>
          </div>

          <table className="w-full text-xs">
            <thead className="bg-[#e4eee8] text-slate-800 border-b border-[#789d93] font-bold">
              <tr>
                <th className="py-2 px-3 text-left">Item Particulars</th>
                <th className="py-2 px-2 text-center w-20">HSN</th>
                <th className="py-2 px-2 text-center w-24">Carton #</th>
                <th className="py-2 px-2 text-center w-24">Lot / Grade</th>
                <th className="py-2 px-3 text-right w-28">Quantity (KG)</th>
                <th className="py-2 px-3 text-right w-24">Rate (₹)</th>
                <th className="py-2 px-3 text-right w-28">Taxable Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(bill.items || []).map((it: any, idx: number) => (
                <tr key={it.id || idx} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-sans font-medium text-slate-900">{it.itemDescription}</td>
                  <td className="py-2 px-2 text-center text-slate-600">{it.hsnCode || '—'}</td>
                  <td className="py-2 px-2 text-center text-slate-700 font-bold">{it.cartonNumber || '—'}</td>
                  <td className="py-2 px-2 text-center text-slate-600 font-sans">
                    {it.lotNumber || '—'} {it.grade ? `/ ${it.grade}` : ''}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{Number(it.quantity).toFixed(3)}</td>
                  <td className="py-2 px-3 text-right text-slate-700">₹{Number(it.rate).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">₹{Number(it.taxableAmount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GST & Totals Summary */}
        <div className="bg-[#eaf3ef] rounded border border-[#789d93] p-4 shadow-xs">
          <div className="flex justify-end">
            <div className="w-full max-w-sm bg-white p-4 rounded border border-slate-200 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span>Taxable Amount :</span>
                <span className="font-bold text-sm">₹{Number(bill.taxableAmount).toFixed(2)}</span>
              </div>

              {Number(bill.cgstAmount) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>CGST ({Number(bill.cgstRate)}%) :</span>
                  <span>₹{Number(bill.cgstAmount).toFixed(2)}</span>
                </div>
              )}

              {Number(bill.sgstAmount) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>SGST ({Number(bill.sgstRate)}%) :</span>
                  <span>₹{Number(bill.sgstAmount).toFixed(2)}</span>
                </div>
              )}

              {Number(bill.igstAmount) > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>IGST ({Number(bill.igstRate)}%) :</span>
                  <span>₹{Number(bill.igstAmount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-500 text-[11px] border-t border-slate-100 pt-1">
                <span>Round Off :</span>
                <span>
                  {Number(bill.roundOff) >= 0
                    ? `+₹${Number(bill.roundOff).toFixed(2)}`
                    : `-₹${Math.abs(Number(bill.roundOff)).toFixed(2)}`}
                </span>
              </div>

              <div className="flex items-center justify-between border-t-2 border-[#2c5f57] pt-2 text-[#0d5f32]">
                <span className="font-sans font-bold text-sm">Final Bill Total :</span>
                <span className="font-bold text-lg bg-emerald-50 px-3 py-1 rounded border border-emerald-300">
                  ₹{Number(bill.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseBillDetailPage;
