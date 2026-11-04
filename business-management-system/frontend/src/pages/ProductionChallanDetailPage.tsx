import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Factory, ArrowLeft, Pencil, XCircle, ChevronLeft, ChevronRight,
  Printer, CheckCircle2, AlertTriangle, Loader2,
  BookOpen, Package
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  getProductionReceiveById,
  getProductionReceiveNavigation,
  cancelProductionReceive,
  getPurchaseBillByChallanId,
} from '../services/api';
import { ShoppingBag } from 'lucide-react';

const fmt3 = (v: any) => (v !== undefined && v !== null ? Number(v).toFixed(3) : '—');
const fmtDate = (d: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    CONFIRMED: { label: 'Confirmed', cls: 'bg-green-100 text-green-800 border border-green-300' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-800 border border-red-300' },
    DRAFT: { label: 'Draft', cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
  };
  const b = map[status] || map.DRAFT;
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${b.cls}`}>{b.label}</span>;
};

// Cancel dialog
const CancelDialog: React.FC<{
  challanNumber: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}> = ({ challanNumber, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const r = reason.trim();
    if (!r) { setError('Cancellation reason is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConfirm(r);
    } catch (e: any) {
      setError(e.message || 'Cancellation failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-bold text-gray-900">Cancel Challan {challanNumber}</h2>
        </div>
        <div className="px-6 py-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            This action cannot be undone. The challan will be marked as CANCELLED and cannot be edited.
            All carton records will be preserved for audit purposes.
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cancellation Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="Enter reason for cancellation..."
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading || !reason.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductionChallanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const bookId = sessionStorage.getItem('bms_selected_production_book_id') || '';

  const [challan, setChallan] = useState<any>(null);
  const [nav, setNav] = useState<{ prevId: string | null; nextId: string | null }>({ prevId: null, nextId: null });
  const [existingBill, setExistingBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setCancelSuccess('');
    try {
      const [challanData, navData, billData] = await Promise.all([
        getProductionReceiveById(id),
        bookId ? getProductionReceiveNavigation(id, bookId) : Promise.resolve({ prevId: null, nextId: null }),
        getPurchaseBillByChallanId(id).catch(() => null),
      ]);
      setChallan(challanData);
      setNav(navData);
      setExistingBill(billData);
    } catch (e: any) {
      setError(e.message || 'Failed to load challan.');
    } finally {
      setLoading(false);
    }
  }, [id, bookId]);

  useEffect(() => { load(); }, [load]);

  const handleCancel = async (reason: string) => {
    await cancelProductionReceive(id!, reason);
    setShowCancelDialog(false);
    setCancelSuccess('Challan cancelled successfully.');
    await load();
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      <span className="ml-3 text-gray-500">Loading challan...</span>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700 text-center max-w-md">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p className="font-medium">{error}</p>
        <button onClick={() => navigate('/manufacturing/production-receive/records')}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm">Back to Register</button>
      </div>
    </div>
  );

  if (!challan) return null;

  const isCancelled = challan.status === 'CANCELLED';
  const totals = challan.items?.reduce((acc: any, item: any) => ({
    cartons: acc.cartons + 1,
    cops: acc.cops + item.cops,
    gross: acc.gross + Number(item.grossWeight),
    tare: acc.tare + Number(item.tareWeight),
    net: acc.net + Number(item.netWeight),
  }), { cartons: 0, cops: 0, gross: 0, tare: 0, net: 0 }) || { cartons: 0, cops: 0, gross: 0, tare: 0, net: 0 };
  const avgTotal = totals.cops > 0 ? (totals.net / totals.cops).toFixed(3) : '—';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {showCancelDialog && (
        <CancelDialog
          challanNumber={challan.challanNumber}
          onConfirm={handleCancel}
          onClose={() => setShowCancelDialog(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/manufacturing/production-receive/records')}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Factory className="w-5 h-5 text-blue-600" />
        <div>
          <h1 className="text-base font-bold text-gray-900">
            Production Challan #{challan.challanNumber}
          </h1>
          <p className="text-xs text-gray-500">{activeCompany?.companyName} · {activeFinancialYear?.yearName}</p>
        </div>
        <div className="ml-2">
          <StatusBadge status={challan.status} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Prev/Next */}
          <button
            onClick={() => nav.prevId && navigate(`/manufacturing/production-receive/records/${nav.prevId}`)}
            disabled={!nav.prevId}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            title="Previous Record">
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <button
            onClick={() => nav.nextId && navigate(`/manufacturing/production-receive/records/${nav.nextId}`)}
            disabled={!nav.nextId}
            className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            title="Next Record">
            Next <ChevronRight className="w-4 h-4" />
          </button>
          <span className="w-px h-5 bg-gray-300" />
          {existingBill ? (
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded text-xs font-bold">
                Bill Already Created (#{existingBill.billNumber})
              </span>
              <button
                onClick={() => navigate(`/transactions/purchase/${existingBill.id}`)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white rounded text-sm font-medium hover:bg-emerald-800"
                title="View Linked Purchase Bill"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> View Purchase Bill
              </button>
            </div>
          ) : !isCancelled && challan?.status === 'CONFIRMED' ? (
            <button
              onClick={() => navigate(`/transactions/purchase/create-from-challan/${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 shadow-xs"
              title="Generate Inward Purchase Bill from this Challan"
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Create Purchase Bill
            </button>
          ) : null}
          <span className="w-px h-5 bg-gray-300" />
          {!isCancelled && (
            <button
              onClick={() => navigate(`/manufacturing/production-receive/entry?edit=${id}&bookId=${challan.productionBookId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          {!isCancelled && (
            <button onClick={() => setShowCancelDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">
              <XCircle className="w-3.5 h-3.5" /> Cancel Challan
            </button>
          )}
          <button
            onClick={() => navigate(`/manufacturing/production-receive/records/${id}/print`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 shadow-xs transition-colors"
            title="Print Challan / Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" /> Print Challan
          </button>
        </div>
      </div>

      {cancelSuccess && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded p-3 flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{cancelSuccess}
        </div>
      )}

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Header Info Grid */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Challan Details
            </h2>
          </div>
          <div className="p-4 grid grid-cols-4 gap-4 text-xs">
            {[
              { label: 'Challan Number', value: challan.challanNumber },
              { label: 'Date', value: fmtDate(challan.challanDate) },
              { label: 'Status', value: <StatusBadge status={challan.status} /> },
              { label: 'Production Book', value: challan.productionBook?.bookName || '—' },
              { label: 'Company', value: activeCompany?.companyName || '—' },
              { label: 'Financial Year', value: activeFinancialYear?.yearName || '—' },
              { label: 'Party', value: challan.party?.partyName || '—' },
              { label: 'Machine', value: challan.machine?.machineCode || '—' },
              { label: 'Quality / Denier', value: challan.yarnQuality?.qualityName || '—' },
              { label: 'Lot Number', value: challan.lotNumber || '—' },
              { label: 'Operator', value: challan.operator?.operatorName || '—' },
              { label: 'Grade', value: challan.yarnGrade?.gradeName || '—' },
              { label: 'Twist', value: challan.twist || '—' },
              { label: 'Empty Cops Weight', value: challan.emptyCopsWeight ? `${Number(challan.emptyCopsWeight).toFixed(3)} kg` : '—' },
              { label: 'Location', value: challan.location?.locationName || '—' },
              { label: 'Remarks', value: challan.remarks || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-gray-500 font-medium mb-0.5">{label}</p>
                <p className="text-gray-900 font-medium">{value}</p>
              </div>
            ))}
            {isCancelled && challan.cancellationReason && (
              <div className="col-span-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-red-700 font-medium text-xs">Cancellation Reason: {challan.cancellationReason}</p>
                {challan.cancelledAt && (
                  <p className="text-red-500 text-xs mt-0.5">Cancelled on: {fmtDate(challan.cancelledAt)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Carton Grid */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Package className="w-4 h-4" /> Carton Details ({challan.items?.length || 0} cartons)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-blue-50 border-b border-blue-100">
                <tr>
                  {['Carton', 'Carton Wgt', 'Cops', 'Gross Wgt', 'Cops Wgt', 'Tare Wgt', 'Net Wgt', 'Twist', 'Lot No', 'Grade', 'Avg Wgt'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-right first:text-left font-semibold text-blue-700 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(challan.items || []).map((item: any, idx: number) => (
                  <tr key={item.id} className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-3 py-2 font-mono font-medium text-gray-700">{item.cartonNumber}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt3(item.cartonWeight)}</td>
                    <td className="px-3 py-2 text-right">{item.cops}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt3(item.grossWeight)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt3(item.copsWeight)}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-700">{fmt3(item.tareWeight)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700 font-semibold">{fmt3(item.netWeight)}</td>
                    <td className="px-3 py-2 text-right">{item.twist || '—'}</td>
                    <td className="px-3 py-2 font-mono">{item.lotNumber || '—'}</td>
                    <td className="px-3 py-2">{item.grade || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt3(item.averageWeight)}</td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-blue-900 text-white">
                <tr>
                  <td className="px-3 py-2 font-bold">TOTALS ({totals.cartons})</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">—</td>
                  <td className="px-3 py-2 text-right font-bold">{totals.cops}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{totals.gross.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">—</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{totals.tare.toFixed(3)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{totals.net.toFixed(3)}</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2 text-right font-mono font-bold">{avgTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/manufacturing/production-receive/records')}
          className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">
          <ArrowLeft className="w-4 h-4" /> Back to Register
        </button>
        <button
          onClick={() => nav.prevId && navigate(`/manufacturing/production-receive/records/${nav.prevId}`)}
          disabled={!nav.prevId}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={() => nav.nextId && navigate(`/manufacturing/production-receive/records/${nav.nextId}`)}
          disabled={!nav.nextId}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
          Next <ChevronRight className="w-4 h-4" />
        </button>
        <div className="ml-auto flex gap-2">
          {!isCancelled && (
            <button
              onClick={() => navigate(`/manufacturing/production-receive/entry?edit=${id}&bookId=${challan.productionBookId}`)}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600">
              <Pencil className="w-4 h-4" /> Edit Challan
            </button>
          )}
          {!isCancelled && (
            <button onClick={() => setShowCancelDialog(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700">
              <XCircle className="w-4 h-4" /> Cancel Challan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductionChallanDetailPage;
