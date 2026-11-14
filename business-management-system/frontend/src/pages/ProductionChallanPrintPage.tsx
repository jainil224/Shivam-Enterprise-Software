import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getProductionReceiveById } from '../services/api';
import { WhatsAppShareButton } from '../components/WhatsAppShareModal';

const fmt3 = (v: any) => (v !== undefined && v !== null ? Number(v).toFixed(3) : '—');
const fmtDate = (d: string | Date) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const ProductionChallanPrintPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [challan, setChallan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const loadChallan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProductionReceiveById(id);
      setChallan(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load challan for printing.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadChallan();
  }, [loadChallan]);

  // Set document title dynamically for clean browser "Save as PDF" naming
  useEffect(() => {
    if (challan?.challanNumber) {
      const originalTitle = document.title;
      const sanitizedNum = challan.challanNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
      document.title = `SHIVAM_ENTERPRISE_PR_${sanitizedNum}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [challan?.challanNumber]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading Challan for Print Preview…</p>
        </div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-md p-6 max-w-md w-full text-center space-y-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-full inline-block">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Unable to Print Challan</h2>
          <p className="text-xs text-red-600">{error || 'Challan record not found.'}</p>
          <button
            onClick={() => navigate('/manufacturing/production-receive/records')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
          >
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  const isCancelled = challan.status === 'CANCELLED';

  // Calculate summary totals
  const items = challan.items || [];
  let totalCartonWeight = 0;
  let totalCops = 0;
  let totalGrossWeight = 0;
  let totalTareWeight = 0;
  let totalNetWeight = 0;

  for (const item of items) {
    totalCartonWeight += Number(item.cartonWeight) || 0;
    totalCops += Number(item.cops) || 0;
    totalGrossWeight += Number(item.grossWeight) || 0;
    totalTareWeight += Number(item.tareWeight) || 0;
    totalNetWeight += Number(item.netWeight) || 0;
  }

  const overallAvgWeight = totalCops > 0 ? (totalNetWeight / totalCops).toFixed(3) : '0.000';

  return (
    <div className="min-h-screen bg-slate-200/70 pb-16">
      {/* ── Print Stylesheet ──────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 8mm 10mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          table {
            page-break-inside: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      {/* ── Top Floating Action / Preview Control Bar (Screen only) ───────── */}
      <div className="no-print sticky top-0 z-30 bg-slate-900 text-white px-4 py-2.5 shadow-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate(`/manufacturing/production-receive/records/${id}`)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center space-x-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="text-slate-600">|</span>
            <span className="font-bold text-white">Print Preview:</span>
            <span className="font-mono text-blue-400">Challan #{challan.challanNumber}</span>
            {isCancelled && (
              <span className="bg-red-900/80 text-red-200 border border-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Cancelled
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Orientation Toggle */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={() => setOrientation('portrait')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center space-x-1 ${
                  orientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>A4 Portrait</span>
              </button>
              <button
                onClick={() => setOrientation('landscape')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center space-x-1 ${
                  orientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>A4 Landscape</span>
              </button>
            </div>

            <WhatsAppShareButton
              documentType="PRODUCTION_CHALLAN"
              documentId={String(challan.id ?? '')}
              documentNumber={String(challan.challanNumber ?? '')}
              partyId={challan.partyId ?? challan.party?.id ?? null}
              partyName={challan.party?.partyName ?? null}
              className="px-3 py-1.5 bg-[#128c7e] hover:bg-[#0f7a6d] text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            />
            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Document Container ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 flex justify-center">
        <div
          className={`print-sheet bg-white text-slate-900 shadow-xl border border-slate-300 relative ${
            orientation === 'landscape' ? 'w-[1050px] p-8' : 'w-[820px] p-8'
          }`}
          style={{ minHeight: orientation === 'landscape' ? '700px' : '1050px' }}
        >
          {/* ── Cancelled Watermark Overlay ─────────────────────────────────── */}
          {isCancelled && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-10 select-none">
              <div className="text-red-600/15 font-black text-8xl md:text-9xl tracking-widest border-8 border-red-600/15 rounded-3xl px-12 py-6 transform -rotate-30 uppercase">
                CANCELLED
              </div>
            </div>
          )}

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="border-b-2 border-slate-900 pb-3">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Logo & Company Information */}
              <div className="flex items-start space-x-3.5">
                {activeCompany?.logoPath ? (
                  <img
                    src={activeCompany.logoPath}
                    alt={activeCompany.companyName}
                    className="w-14 h-14 object-contain rounded border border-slate-200 p-0.5 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-black text-2xl rounded shrink-0">
                    {activeCompany?.companyName?.charAt(0) || 'S'}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                    {activeCompany?.companyName || 'SHIVAM ENTERPRISE'}
                  </h1>
                  {activeCompany?.address && (
                    <p className="text-[11px] text-slate-600 leading-tight mt-0.5">
                      {[activeCompany.address, activeCompany.city, activeCompany.state, activeCompany.pincode]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-[11px] text-slate-700 mt-1 font-mono">
                    {activeCompany?.phone && <span>Phone: {activeCompany.phone}</span>}
                    {activeCompany?.gstin && <span>GSTIN: <strong>{activeCompany.gstin}</strong></span>}
                    {activeCompany?.panNumber && <span>PAN: <strong>{activeCompany.panNumber}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Right: Document Title & Identifiers */}
              <div className="text-right shrink-0">
                <div className="inline-block bg-slate-900 text-white font-extrabold text-xs px-3 py-1 rounded uppercase tracking-wider">
                  PRODUCTION RECEIVE CHALLAN
                </div>
                <div className="mt-1.5 text-xs font-mono space-y-0.5">
                  <p>
                    <span className="text-slate-500 font-sans">Challan No:</span>{' '}
                    <strong className="text-sm font-black text-slate-900">{challan.challanNumber}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-sans">Date:</span>{' '}
                    <strong>{fmtDate(challan.challanDate)}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-sans">Book:</span>{' '}
                    <strong>{challan.productionBook?.bookName || challan.productionBook?.prefix}</strong>
                  </p>
                  <p>
                    <span className="text-slate-500 font-sans">FY:</span>{' '}
                    <strong>{activeFinancialYear?.yearName || challan.financialYear?.yearName}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Cancelled Alert Banner */}
            {isCancelled && (
              <div className="mt-2.5 bg-red-50 border border-red-300 rounded p-2 text-xs text-red-800 flex items-center justify-between">
                <div>
                  <span className="font-bold">⚠️ DOCUMENT CANCELLED</span>
                  {challan.cancellationReason && (
                    <span className="ml-2 font-medium">— Reason: {challan.cancellationReason}</span>
                  )}
                </div>
                {challan.cancelledAt && (
                  <span className="text-[11px] font-mono text-red-600">
                    Cancelled on: {fmtDate(challan.cancelledAt)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Metadata Two-Column Grid ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-slate-300 text-xs">
            {/* Left: Party & Operator Info */}
            <div className="space-y-1">
              <p>
                <span className="text-slate-500 font-medium">Party / Account:</span>{' '}
                <strong className="text-slate-900">
                  {challan.party?.partyName
                    ? `${challan.party.partyName} (${challan.party.partyCode})`
                    : '—'}
                </strong>
              </p>
              {challan.party?.address && (
                <p className="text-slate-600 text-[11px] leading-tight">
                  Address: {[challan.party.address, challan.party.city, challan.party.state].filter(Boolean).join(', ')}
                </p>
              )}
              {challan.party?.gstin && (
                <p className="text-[11px] font-mono text-slate-700">
                  Party GSTIN: {challan.party.gstin}
                </p>
              )}
              <p>
                <span className="text-slate-500 font-medium">Operator:</span>{' '}
                <strong>{challan.operator?.operatorName || '—'}</strong>
              </p>
            </div>

            {/* Right: Technical Manufacturing Specifications */}
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <p>
                  <span className="text-slate-500">Machine:</span>{' '}
                  <strong className="font-mono">{challan.machine?.machineCode || '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Lot No:</span>{' '}
                  <strong className="font-mono">{challan.lotNumber || '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Quality:</span>{' '}
                  <strong>{challan.yarnQuality?.qualityName || '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Grade:</span>{' '}
                  <strong>{challan.yarnGrade?.gradeName || '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Twist:</span>{' '}
                  <strong className="font-mono">{challan.twist ? `${challan.twist} TPM` : '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Empty Cops:</span>{' '}
                  <strong className="font-mono">{fmt3(challan.emptyCopsWeight)} kg</strong>
                </p>
                <p className="col-span-2">
                  <span className="text-slate-500">Location:</span>{' '}
                  <strong>{challan.location?.locationName || '—'}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* ── Carton Packing Table ────────────────────────────────────────── */}
          <div className="py-2.5">
            <table className="challan-table w-full table-fixed text-xs border border-slate-400 border-collapse">
              <colgroup>
                <col style={{ width: '26px' }} />
                <col style={{ width: '62px' }} />
                <col style={{ width: '62px' }} />
                <col style={{ width: '40px' }} />
                <col style={{ width: '68px' }} />
                <col style={{ width: '62px' }} />
                <col style={{ width: '62px' }} />
                <col style={{ width: '72px' }} />
                <col style={{ width: '48px' }} />
                <col style={{ width: '116px' }} />
                <col style={{ width: '72px' }} />
                <col style={{ width: '66px' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-400">
                  <th className="border border-slate-300 px-2 py-1.5 text-center w-10">#</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center">Carton No</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Cartn Wgt</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center">Cops</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Gross (kg)</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Cops Wgt</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Tare Wgt</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Net Wgt (kg)</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-center">Twist</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Lot No</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Grade</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Avg Wgt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr
                    key={item.id || idx}
                    className={`border-b border-slate-300 ${idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                  >
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[11px] text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono font-bold">
                      {item.cartonNumber}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      {fmt3(item.cartonWeight)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                      {item.cops}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      {fmt3(item.grossWeight)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      {fmt3(item.copsWeight)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      {fmt3(item.tareWeight)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                      {fmt3(item.netWeight)}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[11px]">
                      {item.twist || challan.twist || '—'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-[11px]">
                      {item.lotNumber || challan.lotNumber || '—'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-[11px]">
                      {item.grade || challan.yarnGrade?.gradeName || '—'}
                    </td>
                    <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                      {fmt3(item.averageWeight)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-800">
                  <td colSpan={2} className="border border-slate-400 px-2 py-1.5 text-center uppercase tracking-wider text-[11px]">
                    TOTALS ({items.length} Cartons)
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                    {fmt3(totalCartonWeight)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-mono text-sm">
                    {totalCops}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono font-bold text-sm">
                    {fmt3(totalGrossWeight)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                    —
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                    {fmt3(totalTareWeight)}
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono font-extrabold text-sm text-slate-900">
                    {fmt3(totalNetWeight)} kg
                  </td>
                  <td colSpan={3} className="border border-slate-400 px-2 py-1.5 text-right font-mono">
                    Avg/Cop:
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-right font-mono font-bold">
                    {overallAvgWeight}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Remarks (if any) ────────────────────────────────────────────── */}
          {challan.remarks && (
            <div className="py-1.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-500">Remarks:</span> {challan.remarks}
            </div>
          )}

          {/* ── Signatures & Document Footer ─────────────────────────────────── */}
          <div className="avoid-break mt-8 pt-4 border-t border-slate-400 text-xs">
            <div className="grid grid-cols-3 gap-6 pt-10 text-center">
              <div>
                <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
                  Weighed & Prepared By
                </div>
                <div className="text-[10px] text-slate-500">Packing Supervisor</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
                  Received By
                </div>
                <div className="text-[10px] text-slate-500">Warehouse In-charge</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                  For, {activeCompany?.companyName || 'SHIVAM ENTERPRISE'}
                </div>
                <div className="text-[10px] text-slate-500">Authorized Signatory</div>
              </div>
            </div>

            <div className="mt-8 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>
                Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} | Computer-generated Production Challan
              </span>
              <span>
                Document ID: {challan.id}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionChallanPrintPage;
