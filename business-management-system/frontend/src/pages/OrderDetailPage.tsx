import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCheck,
  History,
  Loader2,
  Pencil,
  Printer,
  Send,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import {
  acknowledgePurchaseOrder,
  approvePurchaseOrder,
  cancelOrder,
  confirmSalesOrder,
  copyOrder,
  getOrderHistory,
  getPurchaseOrder,
  getSalesOrder,
  sendPurchaseOrder,
} from '../services/api';
import {
  ORDER_STATUS_LABELS,
  TAX_TYPE_LABELS,
  UNIT_LABELS,
  type OrderDocumentType,
  type OrderRecord,
  type OrderStatusHistoryEntry,
  type PurchaseOrder,
  type SalesOrder,
  type UnitOfMeasure,
} from '../types/orders';
import { amountInWords } from '../utils/amountInWords';
import { formatDate, formatDateTime, money, orderLabels, orderPaths, qty, statusTone } from './orderPageShared';

interface OrderDetailPageProps {
  documentType: OrderDocumentType;
}

interface DetailLineView {
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
  pendingQuantity: string;
}

type PendingAction = 'CONFIRM' | 'APPROVE' | 'SEND' | 'ACKNOWLEDGE' | 'CANCEL' | 'COPY';

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';

const actionCopy: Record<PendingAction, { title: string; body: string; confirm: string }> = {
  CONFIRM: {
    title: 'Confirm Sales Order',
    body: 'Confirming locks the order lines and moves it to Confirmed. The order remains editable only while it is a draft.',
    confirm: 'Confirm Order',
  },
  APPROVE: {
    title: 'Approve Purchase Order',
    body: 'Approving records the internal authorisation. The purchase order can then be sent to the supplier.',
    confirm: 'Approve Order',
  },
  SEND: {
    title: 'Mark as Sent',
    body: 'Record that this purchase order has been issued to the supplier. No email is sent by the system.',
    confirm: 'Mark Sent',
  },
  ACKNOWLEDGE: {
    title: 'Record Supplier Acknowledgement',
    body: 'Record that the supplier has acknowledged this purchase order.',
    confirm: 'Acknowledge',
  },
  CANCEL: {
    title: 'Cancel Order',
    body: 'Cancelling is permanent and is recorded in the order history with a reason.',
    confirm: 'Confirm Cancel',
  },
  COPY: {
    title: 'Copy Order',
    body: 'A new draft order is created with the same party, lines and terms. The source order is left untouched.',
    confirm: 'Create Copy',
  },
};

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ documentType }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isSales = documentType === 'SALES_ORDER';
  const labels = useMemo(() => orderLabels(documentType), [documentType]);
  const paths = useMemo(() => orderPaths(documentType), [documentType]);

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const record: OrderRecord = isSales ? await getSalesOrder(id) : await getPurchaseOrder(id);
      setOrder(record);
      setHistory(await getOrderHistory(documentType, id));
    } catch (err) {
      setOrder(null);
      setHistory([]);
      setError(err instanceof Error ? err.message : 'Failed to load the order.');
    } finally {
      setLoading(false);
    }
  }, [id, isSales, documentType]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async () => {
    if (!order || !pendingAction) return;

    if (pendingAction === 'CANCEL' && cancelReason.trim().length < 3) {
      setActionError('A cancellation reason of at least 3 characters is required.');
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      if (pendingAction === 'CONFIRM') {
        await confirmSalesOrder(order.id);
      } else if (pendingAction === 'APPROVE') {
        await approvePurchaseOrder(order.id);
      } else if (pendingAction === 'SEND') {
        await sendPurchaseOrder(order.id);
      } else if (pendingAction === 'ACKNOWLEDGE') {
        await acknowledgePurchaseOrder(order.id);
      } else if (pendingAction === 'CANCEL') {
        await cancelOrder(documentType, order.id, cancelReason.trim());
      } else {
        const copy = await copyOrder(documentType, order.id);
        setPendingAction(null);
        navigate(paths.edit(copy.id));
        return;
      }
      setPendingAction(null);
      setCancelReason('');
      await load();
    } catch (err) {
      const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
      setActionError(
        apiErrors && apiErrors.length > 0
          ? apiErrors[0].message
          : err instanceof Error
            ? err.message
            : 'The action could not be completed.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading {labels.noun.toLowerCase()}…</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to open the {labels.noun.toLowerCase()}</p>
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
  const detailLines: DetailLineView[] = isSales
    ? (order as SalesOrder).lines
    : (order as PurchaseOrder).lines;
  const schedules = salesOrder?.schedules ?? [];

  const status = order.status;
  const isDraft = status === 'DRAFT';
  const isCancelled = status === 'CANCELLED';
  const isClosed = status === 'CLOSED';
  const canCancel = !isCancelled && !isClosed;

  const availableActions: Array<{ key: PendingAction; label: string; icon: React.ReactNode }> = [];
  if (isSales && isDraft) {
    availableActions.push({ key: 'CONFIRM', label: 'Confirm', icon: <CheckCircle2 className="w-3.5 h-3.5" /> });
  }
  if (!isSales && isDraft) {
    availableActions.push({ key: 'APPROVE', label: 'Approve', icon: <ThumbsUp className="w-3.5 h-3.5" /> });
  }
  if (!isSales && status === 'APPROVED') {
    availableActions.push({ key: 'SEND', label: 'Mark Sent', icon: <Send className="w-3.5 h-3.5" /> });
  }
  if (!isSales && status === 'SENT') {
    availableActions.push({ key: 'ACKNOWLEDGE', label: 'Acknowledge', icon: <CheckCircle2 className="w-3.5 h-3.5" /> });
  }
  if (!isCancelled) {
    availableActions.push({ key: 'COPY', label: 'Copy', icon: <Copy className="w-3.5 h-3.5" /> });
  }
  if (canCancel) {
    availableActions.push({ key: 'CANCEL', label: 'Cancel', icon: <XCircle className="w-3.5 h-3.5" /> });
  }

  const billingAddress = order.billingAddress ?? '—';
  const deliveryAddress = salesOrder?.deliveryAddress ?? purchaseOrder?.deliveryLocationName ?? '—';

  return (
    <div className="w-full max-w-[1300px] mx-auto space-y-2.5 pb-10">
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isSales ? <ClipboardList className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight flex items-center gap-2">
              <span className="font-mono">{order.orderNumber}</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${statusTone(status)}`}>
                {ORDER_STATUS_LABELS[status] ?? status}
              </span>
              {order.priority === 'URGENT' && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-red-500 text-white">
                  Urgent
                </span>
              )}
            </h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              {labels.noun} · {formatDate(order.orderDate)} · {order.party.partyName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate(paths.base)}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Register
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={() => navigate(paths.edit(order.id))}
              className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(paths.print(order.id))}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          {availableActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                setPendingAction(action.key);
                setCancelReason('');
                setActionError(null);
              }}
              className={`px-2.5 py-1.5 text-[11px] font-bold rounded flex items-center gap-1.5 ${
                action.key === 'CANCEL'
                  ? 'bg-red-500/90 hover:bg-red-500 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isCancelled && order.cancellationReason && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-3 py-2 text-[11.5px]">
          <span className="font-bold uppercase tracking-wider text-[10px]">Cancelled</span>
          <span className="ml-2">{order.cancellationReason}</span>
          {order.cancelledAt && <span className="ml-2 text-red-600">({formatDateTime(order.cancelledAt)})</span>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_310px] gap-2.5 items-start">
        <div className="space-y-2.5 min-w-0">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Document Details</span>
            </div>
            <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[11.5px]">
              <div>
                <p className={labelCls}>{labels.partyLabel}</p>
                <p className="font-semibold text-slate-800">{order.party.partyName}</p>
                <p className="text-[10px] text-slate-500 font-mono">{order.party.partyCode}</p>
                {order.party.gstin && <p className="text-[10px] text-slate-500 font-mono">GSTIN {order.party.gstin}</p>}
              </div>
              <div>
                <p className={labelCls}>Order Date</p>
                <p className="font-semibold text-slate-800">{formatDate(order.orderDate)}</p>
                <p className="text-[10px] text-slate-500">
                  Expected {formatDate(order.expectedDeliveryDate)}
                </p>
              </div>
              <div>
                <p className={labelCls}>GST Treatment</p>
                <p className="font-semibold text-slate-800">{TAX_TYPE_LABELS[order.taxType]}</p>
                <p className="text-[10px] text-slate-500">Place of supply: {order.placeOfSupplyState ?? '—'}</p>
              </div>
              <div>
                <p className={labelCls}>{isSales ? 'Customer Reference' : 'Supplier Quotation'}</p>
                <p className="font-semibold text-slate-800">
                  {isSales
                    ? salesOrder?.customerReferenceNumber ?? '—'
                    : purchaseOrder?.supplierQuotationNumber ?? '—'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {isSales
                    ? formatDate(salesOrder?.customerReferenceDate)
                    : formatDate(purchaseOrder?.supplierQuotationDate)}
                </p>
              </div>

              <div>
                <p className={labelCls}>Payment Terms</p>
                <p className="text-slate-700">{order.paymentTerms ?? '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Delivery Terms</p>
                <p className="text-slate-700">{order.deliveryTerms ?? '—'}</p>
              </div>
              <div>
                <p className={labelCls}>Freight Terms</p>
                <p className="text-slate-700">{order.freightTerms ?? '—'}</p>
              </div>
              <div>
                <p className={labelCls}>{isSales ? 'Salesperson' : 'Buyer'}</p>
                <p className="text-slate-700">{(isSales ? salesOrder?.salesperson : purchaseOrder?.buyerName) ?? '—'}</p>
              </div>

              <div className="col-span-2">
                <p className={labelCls}>Billing Address</p>
                <p className="text-slate-700 leading-snug">{billingAddress}</p>
              </div>
              <div className="col-span-2">
                <p className={labelCls}>{isSales ? 'Delivery Address' : 'Delivery Location'}</p>
                <p className="text-slate-700 leading-snug">{deliveryAddress}</p>
              </div>

              {order.narration && (
                <div className="col-span-2 md:col-span-4">
                  <p className={labelCls}>Narration</p>
                  <p className="text-slate-700 leading-snug">{order.narration}</p>
                </div>
              )}
              {order.remarks && (
                <div className="col-span-2 md:col-span-4">
                  <p className={labelCls}>Internal Remarks</p>
                  <p className="text-slate-700 leading-snug">{order.remarks}</p>
                </div>
              )}
              {order.termsAndConditions && (
                <div className="col-span-2 md:col-span-4">
                  <p className={labelCls}>Terms & Conditions</p>
                  <p className="text-slate-700 leading-snug whitespace-pre-line">{order.termsAndConditions}</p>
                </div>
              )}
            </div>
          </div>
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Order Lines <span className="text-slate-400">({detailLines.length})</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Ordered {qty(order.totals.totalQuantity)} · Pending {qty(order.totalPendingQuantity)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[11.5px]">
                <thead>
                  <tr className="bg-slate-100 text-[9.5px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-1 text-left w-8">#</th>
                    <th className="px-2 py-1 text-left min-w-[200px]">Item</th>
                    <th className="px-2 py-1 text-left min-w-[130px]">Description</th>
                    <th className="px-2 py-1 text-center w-14">Unit</th>
                    <th className="px-2 py-1 text-right w-24">Qty</th>
                    <th className="px-2 py-1 text-right w-24">Rate</th>
                    <th className="px-2 py-1 text-right w-14">Disc%</th>
                    <th className="px-2 py-1 text-right w-24">Taxable</th>
                    <th className="px-2 py-1 text-right w-14">GST%</th>
                    <th className="px-2 py-1 text-right w-24">Tax</th>
                    <th className="px-2 py-1 text-right w-24">Total</th>
                    <th className="px-2 py-1 text-right w-24">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLines.map((line) => {
                    const tax = Number(line.cgstAmount) + Number(line.sgstAmount) + Number(line.igstAmount);
                    return (
                      <tr key={line.id} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-1 text-center font-mono text-[10px] text-slate-500">{line.lineNumber}</td>
                        <td className="px-2 py-1">
                          <p className="font-semibold text-slate-800 truncate max-w-[240px]">{line.itemName}</p>
                          <p className="text-[9.5px] text-slate-500 font-mono">{line.itemCode}</p>
                        </td>
                        <td className="px-2 py-1 text-slate-600 truncate max-w-[160px]">{line.description ?? '—'}</td>
                        <td className="px-2 py-1 text-center text-[10px] font-bold text-slate-600">
                          {UNIT_LABELS[line.unit]}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">{qty(line.quantity)}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">{money(line.rate)}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-600">
                          {Number(line.discountPercent).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">{money(line.taxableAmount)}</td>
                        <td className="px-2 py-1 text-right font-mono text-slate-600">
                          {Number(line.gstRate).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">{money(tax)}</td>
                        <td className="px-2 py-1 text-right font-mono font-bold text-slate-900">
                          {money(line.lineTotal)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-slate-700">
                          {qty(line.pendingQuantity)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-lg text-[10px] text-slate-500">
              Line quantities, rates and GST amounts are the values stored when the order was saved.
            </div>
          </div>

          {isSales && schedules.length > 0 && (
            <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
              <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Delivery Schedule <span className="text-slate-400">({schedules.length})</span>
                </span>
                {salesOrder?.scheduleIsPartial && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border border-amber-300 bg-amber-50 text-amber-800">
                    Partial
                  </span>
                )}
              </div>
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="bg-slate-100 text-[9.5px] uppercase tracking-wider text-slate-500">
                    <th className="px-2 py-1 text-left w-16">Line</th>
                    <th className="px-2 py-1 text-left w-32">Schedule Date</th>
                    <th className="px-2 py-1 text-right w-28">Quantity</th>
                    <th className="px-2 py-1 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-1 font-mono text-[10.5px] text-slate-600">{schedule.lineNumber}</td>
                      <td className="px-2 py-1 text-slate-700">{formatDate(schedule.scheduleDate)}</td>
                      <td className="px-2 py-1 text-right font-mono text-slate-800">{qty(schedule.quantity)}</td>
                      <td className="px-2 py-1 text-slate-600">{schedule.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Status History ({history.length})
              </span>
            </div>
            <div className="p-3">
              {history.length === 0 ? (
                <p className="text-[11px] text-slate-500">No status changes recorded yet.</p>
              ) : (
                <ol className="relative border-l border-slate-200 ml-1.5 space-y-2.5">
                  {history.map((entry) => (
                    <li key={entry.id} className="ml-3">
                      <span className="absolute -left-[5px] mt-1 w-2.5 h-2.5 rounded-full bg-[#2c5f57] border-2 border-white" />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-800">{entry.action}</span>
                        {entry.toStatus && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${statusTone(entry.toStatus)}`}>
                            {ORDER_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{formatDateTime(entry.createdAt)}</span>
                      </div>
                      {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus && (
                        <p className="text-[10px] text-slate-500">
                          {ORDER_STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus} →{' '}
                          {ORDER_STATUS_LABELS[entry.toStatus] ?? entry.toStatus}
                        </p>
                      )}
                      {entry.reason && <p className="text-[10.5px] text-red-700">Reason: {entry.reason}</p>}
                      {entry.note && <p className="text-[10.5px] text-slate-600">{entry.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-2.5 xl:sticky xl:top-2">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Order Summary</span>
            </div>
            <div className="p-3 space-y-1 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Subtotal</span>
                <span className="font-mono text-slate-800">{money(order.totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Discount</span>
                <span className="font-mono text-slate-800">-{money(order.totals.discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-600 font-bold">Taxable</span>
                <span className="font-mono font-bold text-slate-800">{money(order.totals.taxableAmount)}</span>
              </div>
              {order.taxType === 'INTRA_STATE' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">CGST</span>
                    <span className="font-mono text-slate-800">{money(order.totals.cgstAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">SGST</span>
                    <span className="font-mono text-slate-800">{money(order.totals.sgstAmount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">IGST</span>
                  <span className="font-mono text-slate-800">{money(order.totals.igstAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Freight</span>
                <span className="font-mono text-slate-800">{money(order.totals.freightAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Packing</span>
                <span className="font-mono text-slate-800">{money(order.totals.packingAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Other Charges</span>
                <span className="font-mono text-slate-800">{money(order.totals.otherCharges)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Round Off</span>
                <span className="font-mono text-slate-800">{money(order.totals.roundOffAmount)}</span>
              </div>
            </div>
            <div className="px-3 py-2 border-t-2 border-[#2c5f57] bg-[#2c5f57]/5 rounded-b-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#2c5f57]">Grand Total</span>
              <span className="font-mono text-[15px] font-bold text-[#2c5f57]">₹ {money(order.totals.grandTotal)}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-2 space-y-1">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Amount in Words</p>
            <p className="text-[11px] font-semibold text-slate-700 leading-snug">{amountInWords(order.totals.grandTotal)}</p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-2 text-[11px] space-y-1">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Fulfilment</p>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ordered</span>
              <span className="font-mono font-semibold text-slate-800">{qty(order.totals.totalQuantity)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{isSales ? 'Fulfilled' : 'Received'}</span>
              <span className="font-mono font-semibold text-emerald-700">
                {qty(
                  isSales
                    ? (order as SalesOrder).totalFulfilledQuantity
                    : (order as PurchaseOrder).totalReceivedQuantity
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Pending</span>
              <span className="font-mono font-semibold text-amber-700">{qty(order.totalPendingQuantity)}</span>
            </div>
            <p className="pt-1 text-[9.5px] text-slate-400 leading-snug">
              No sales invoice, delivery challan or goods receipt module exists yet, so fulfilment is recorded as
              zero rather than estimated.
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-2 text-[10px] text-slate-500 space-y-1">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Audit</p>
            <p>Created {formatDateTime(order.createdAt)}</p>
            <p>Updated {formatDateTime(order.updatedAt)}</p>
            {salesOrder?.confirmedAt && <p>Confirmed {formatDateTime(salesOrder.confirmedAt)}</p>}
            {purchaseOrder?.approvedAt && <p>Approved {formatDateTime(purchaseOrder.approvedAt)}</p>}
            {purchaseOrder?.sentAt && <p>Sent {formatDateTime(purchaseOrder.sentAt)}</p>}
            {purchaseOrder?.supplierConfirmationDate && (
              <p>Acknowledged {formatDate(purchaseOrder.supplierConfirmationDate)}</p>
            )}
          </div>
        </aside>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {actionCopy[pendingAction].title}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingAction(null);
                  setActionError(null);
                }}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <p className="text-[11.5px] text-slate-600 leading-snug">{actionCopy[pendingAction].body}</p>
              <p className="text-[11px] text-slate-500">
                Document: <span className="font-mono font-bold text-slate-800">{order.orderNumber}</span>
              </p>

              {pendingAction === 'CANCEL' && (
                <div>
                  <label className={labelCls}>Cancellation Reason *</label>
                  <textarea
                    value={cancelReason}
                    onChange={(event) => setCancelReason(event.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Why is this order being cancelled?"
                    className="w-full px-2 py-1 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40"
                  />
                </div>
              )}

              {actionError && <p className="text-[10.5px] text-red-600 font-semibold">{actionError}</p>}

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAction(null);
                    setActionError(null);
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void runAction()}
                  disabled={busy}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded text-white disabled:bg-slate-400 flex items-center gap-1.5 ${
                    pendingAction === 'CANCEL' ? 'bg-red-600 hover:bg-red-500' : 'bg-[#2c5f57] hover:bg-[#24504a]'
                  }`}
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {busy ? 'Working…' : actionCopy[pendingAction].confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};