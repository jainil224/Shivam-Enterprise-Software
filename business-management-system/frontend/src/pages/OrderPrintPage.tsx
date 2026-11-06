import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { getPurchaseOrder, getSalesOrder } from '../services/api';
import {
  TAX_TYPE_LABELS,
  UNIT_LABELS,
  type OrderDocumentType,
  type OrderRecord,
  type PurchaseOrder,
  type SalesOrder,
  type UnitOfMeasure,
} from '../types/orders';
import { amountInWords } from '../utils/amountInWords';
import { formatDate, money, orderLabels, orderPaths, qty } from './orderPageShared';

interface OrderPrintPageProps {
  documentType: OrderDocumentType;
}

interface PrintLine {
  id: string;
  lineNumber: number;
  itemCode: string;
  itemName: string;
  description: string | null;
  unit: UnitOfMeasure;
  quantity: string;
  rate: string;
  discountPercent: string;
  taxableAmount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  lineTotal: string;
}

export const OrderPrintPage: React.FC<OrderPrintPageProps> = ({ documentType }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isSales = documentType === 'SALES_ORDER';
  const labels = useMemo(() => orderLabels(documentType), [documentType]);
  const paths = useMemo(() => orderPaths(documentType), [documentType]);
  const { activeCompany } = useCompany();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record: OrderRecord = isSales ? await getSalesOrder(id) : await getPurchaseOrder(id);
      setOrder(record);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'Failed to load the order for printing.');
    } finally {
      setLoading(false);
    }
  }, [id, isSales]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!order) return;
    const originalTitle = document.title;
    const clean = order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    document.title = `${isSales ? 'SALES_ORDER' : 'PURCHASE_ORDER'}_${clean}`;
    return () => {
      document.title = originalTitle;
    };
  }, [order, isSales]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Preparing print preview…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to print this {labels.noun.toLowerCase()}</p>
        <p className="text-xs text-slate-600">{error ?? 'The order could not be found.'}</p>
        <button
          type="button"
          onClick={() => navigate(paths.base)}
          className="mt-2 px-3 py-1.5 text-xs font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
        >
          Back to Register
        </button>
      </div>
    );
  }

  const salesOrder = isSales ? (order as SalesOrder) : null;
  const purchaseOrder = isSales ? null : (order as PurchaseOrder);
  const lines: PrintLine[] = isSales
    ? (order as SalesOrder).lines
    : (order as PurchaseOrder).lines;

  const companyAddress = [
    activeCompany?.address,
    activeCompany?.city,
    activeCompany?.state,
    activeCompany?.pincode,
  ]
    .filter((part) => Boolean(part && String(part).trim() !== ''))
    .join(', ');

  const partyAddress = [
    order.party.address,
    order.party.city,
    order.party.state,
    order.party.pincode,
  ]
    .filter((part) => Boolean(part && String(part).trim() !== ''))
    .join(', ');

  const referenceLabel = isSales ? 'Customer Reference' : 'Supplier Quotation';
  const referenceValue = isSales
    ? salesOrder?.customerReferenceNumber ?? '—'
    : purchaseOrder?.supplierQuotationNumber ?? '—';
  const referenceDate = isSales ? salesOrder?.customerReferenceDate : purchaseOrder?.supplierQuotationDate;

  const terms = (order.termsAndConditions ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

  return (
    <div className="w-full max-w-[880px] mx-auto">
      <div className="print-toolbar flex items-center justify-between gap-2 mb-2 bg-white border border-slate-300 rounded-lg px-3 py-2 shadow-sm">
        <div className="text-[11.5px] text-slate-600 font-semibold">
          {labels.noun} · <span className="font-mono">{order.orderNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(paths.detail(order.id))}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-6 text-slate-900 print:border-0 print:shadow-none print:rounded-none">
        <div className="text-center border-b-2 border-slate-800 pb-2">
          <h1 className="text-[18px] font-extrabold uppercase tracking-wide leading-tight">
            {activeCompany?.companyName ?? 'Company'}
          </h1>
          {companyAddress && <p className="text-[11px] leading-snug mt-0.5">{companyAddress}</p>}
          <div className="text-[10.5px] mt-0.5 flex items-center justify-center gap-3 flex-wrap">
            {activeCompany?.gstin && <span>GSTIN: {activeCompany.gstin}</span>}
            {activeCompany?.panNumber && <span>PAN: {activeCompany.panNumber}</span>}
            {activeCompany?.phone && <span>Ph: {activeCompany.phone}</span>}
            {activeCompany?.email && <span>{activeCompany.email}</span>}
          </div>
        </div>

        <div className="text-center my-2">
          <h2 className="inline-block border border-slate-800 px-4 py-1 text-[12.5px] font-bold uppercase tracking-wider">
            {isSales ? 'Sales Order' : 'Purchase Order'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10.5px] mb-2">
          <p>
            <span className="font-bold">Order No.: </span>
            <span className="font-mono">{order.orderNumber}</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Order Date: </span>
            {formatDate(order.orderDate)}
          </p>
          <p>
            <span className="font-bold">{labels.partyLabel}: </span>
            {order.party.partyName}
            <span className="text-slate-500"> ({order.party.partyCode})</span>
          </p>
          <p className="text-right">
            <span className="font-bold">Expected Date: </span>
            {formatDate(order.expectedDeliveryDate)}
          </p>
          {partyAddress && (
            <p className="col-span-2 leading-snug">
              <span className="font-bold">Address: </span>
              {partyAddress}
            </p>
          )}
          <p>
            <span className="font-bold">GSTIN: </span>
            {order.party.gstin ?? '—'}
          </p>
          <p className="text-right">
            <span className="font-bold">{referenceLabel}: </span>
            {referenceValue}
            {referenceDate ? ` · ${formatDate(referenceDate)}` : ''}
          </p>
          <p>
            <span className="font-bold">Payment Terms: </span>
            {order.paymentTerms ?? '—'}
          </p>
          <p className="text-right">
            <span className="font-bold">Delivery Terms: </span>
            {order.deliveryTerms ?? '—'}
          </p>
          <p>
            <span className="font-bold">Freight Terms: </span>
            {order.freightTerms ?? '—'}
          </p>
          <p className="text-right">
            <span className="font-bold">GST Type: </span>
            {TAX_TYPE_LABELS[order.taxType]}
          </p>
          {!isSales && (
            <p className="col-span-2">
              <span className="font-bold">Delivery Location: </span>
              {purchaseOrder?.deliveryLocationName ?? purchaseOrder?.billingAddress ?? '—'}
            </p>
          )}
          {isSales && (
            <p className="col-span-2">
              <span className="font-bold">Delivery Address: </span>
              {salesOrder?.deliveryAddress ?? salesOrder?.billingAddress ?? '—'}
            </p>
          )}
          {order.narration && (
            <p className="col-span-2">
              <span className="font-bold">Narration: </span>
              {order.narration}
            </p>
          )}
        </div>

        <table className="w-full text-[9.5px] border border-slate-400 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="px-1.5 py-1 border border-slate-400 text-center w-6">#</th>
              <th className="px-1.5 py-1 border border-slate-400 text-left">Item Description</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-14">Qty</th>
              <th className="px-1.5 py-1 border border-slate-400 text-center w-10">Unit</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-16">Rate</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-10">Disc%</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-20">Taxable</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-10">GST%</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-16">CGST</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-16">SGST</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-16">IGST</th>
              <th className="px-1.5 py-1 border border-slate-400 text-right w-20">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-1.5 py-0.5 border border-slate-400 text-center">{line.lineNumber}</td>
                <td className="px-1.5 py-0.5 border border-slate-400">
                  <span className="font-semibold">{line.itemName}</span>
                  <span className="text-slate-500"> ({line.itemCode})</span>
                  {line.description && (
                    <span className="block text-[8.5px] text-slate-600 leading-tight">{line.description}</span>
                  )}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">{qty(line.quantity)}</td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-center">{UNIT_LABELS[line.unit]}</td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">{money(line.rate)}</td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {Number(line.discountPercent).toFixed(2)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {money(line.taxableAmount)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {Number(line.gstRate).toFixed(2)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {money(line.cgstAmount)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {money(line.sgstAmount)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono">
                  {money(line.igstAmount)}
                </td>
                <td className="px-1.5 py-0.5 border border-slate-400 text-right font-mono font-bold">
                  {money(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between gap-4 mt-2">
          <div className="flex-1 text-[10px] leading-snug">
            <p className="font-bold uppercase tracking-wide text-[9.5px]">Amount in Words</p>
            <p className="font-semibold">{amountInWords(order.totals.grandTotal)}</p>
            {order.remarks && (
              <>
                <p className="font-bold uppercase tracking-wide text-[9.5px] mt-2">Remarks</p>
                <p>{order.remarks}</p>
              </>
            )}
          </div>

          <table className="w-[280px] text-[10px] shrink-0">
            <tbody>
              <tr>
                <td className="py-0.5 pr-2 text-slate-600">Subtotal</td>
                <td className="py-0.5 text-right font-mono">{money(order.totals.subtotal)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-2 text-slate-600">Discount</td>
                <td className="py-0.5 text-right font-mono">-{money(order.totals.discountAmount)}</td>
              </tr>
              <tr className="border-t border-slate-300">
                <td className="py-0.5 pr-2 font-semibold">Taxable Amount</td>
                <td className="py-0.5 text-right font-mono font-semibold">{money(order.totals.taxableAmount)}</td>
              </tr>
              {order.taxType === 'INTRA_STATE' ? (
                <>
                  <tr>
                    <td className="py-0.5 pr-2 text-slate-600">CGST</td>
                    <td className="py-0.5 text-right font-mono">{money(order.totals.cgstAmount)}</td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-2 text-slate-600">SGST</td>
                    <td className="py-0.5 text-right font-mono">{money(order.totals.sgstAmount)}</td>
                  </tr>
                </>
              ) : (
                <tr>
                  <td className="py-0.5 pr-2 text-slate-600">IGST</td>
                  <td className="py-0.5 text-right font-mono">{money(order.totals.igstAmount)}</td>
                </tr>
              )}
              {Number(order.totals.freightAmount) !== 0 && (
                <tr>
                  <td className="py-0.5 pr-2 text-slate-600">Freight</td>
                  <td className="py-0.5 text-right font-mono">{money(order.totals.freightAmount)}</td>
                </tr>
              )}
              {Number(order.totals.packingAmount) !== 0 && (
                <tr>
                  <td className="py-0.5 pr-2 text-slate-600">Packing</td>
                  <td className="py-0.5 text-right font-mono">{money(order.totals.packingAmount)}</td>
                </tr>
              )}
              {Number(order.totals.otherCharges) !== 0 && (
                <tr>
                  <td className="py-0.5 pr-2 text-slate-600">Other Charges</td>
                  <td className="py-0.5 text-right font-mono">{money(order.totals.otherCharges)}</td>
                </tr>
              )}
              <tr>
                <td className="py-0.5 pr-2 text-slate-600">Round Off</td>
                <td className="py-0.5 text-right font-mono">{money(order.totals.roundOffAmount)}</td>
              </tr>
              <tr className="border-t-2 border-slate-800">
                <td className="py-1 pr-2 font-extrabold uppercase text-[11px]">Grand Total</td>
                <td className="py-1 text-right font-mono font-extrabold text-[11.5px]">
                  ₹ {money(order.totals.grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {terms.length > 0 && (
          <div className="mt-3 text-[9.5px] leading-snug">
            <p className="font-bold uppercase tracking-wide mb-0.5">Terms & Conditions</p>
            <ol className="list-decimal list-inside space-y-0.5">
              {terms.map((term, index) => (
                <li key={`${index}-${term.slice(0, 12)}`}>{term}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-10 grid grid-cols-3 gap-6 text-[10px]">
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 font-semibold">Prepared By</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 font-semibold">Checked By</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-800 pt-1 font-semibold">
              {isSales ? 'Customer Acceptance' : 'Supplier Acknowledgement'}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-300 pt-1.5 text-center text-[8.5px] text-slate-500">
          <p>
            {isSales
              ? 'This is a sales order, not a tax invoice. No GST liability arises until the invoice is raised.'
              : 'This is a purchase order, not a purchase bill. No input credit arises until the supplier invoice is booked.'}
          </p>
          <p className="font-mono mt-0.5">
            {order.orderNumber} · printed by SHIVAM ENTERPRISE BMS
          </p>
        </div>
      </div>
    </div>
  );
};