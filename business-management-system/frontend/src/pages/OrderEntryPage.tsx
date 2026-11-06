import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ClipboardList,
  FileCheck,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createOrder,
  getOrderLookups,
  getPurchaseOrder,
  getSalesOrder,
  updateOrder,
} from '../services/api';
import {
  ITEM_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  TAX_TYPE_LABELS,
  UNIT_LABELS,
  type ItemType,
  type OrderDocumentType,
  type OrderItemLookup,
  type OrderLookups,
  type OrderPartyLookup,
  type OrderPayload,
  type OrderPriority,
  type OrderTaxType,
  type PurchaseOrder,
  type SalesOrder,
  type UnitOfMeasure,
} from '../types/orders';
import { amountInWords } from '../utils/amountInWords';
import {
  computeLineDraft,
  formatDate,
  money,
  orderLabels,
  orderPaths,
  qty,
  round2,
  statusTone,
  todayKey,
} from './orderPageShared';

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed';
const numCls = `${inputCls} text-right font-mono`;
const cellInputCls =
  'w-full h-7 px-1.5 text-[11.5px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100';
const cellNumCls = `${cellInputCls} text-right font-mono`;
const btnGhost =
  'px-2.5 py-1.5 text-[11px] font-bold rounded bg-white/10 hover:bg-white/20 border border-white/25 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed';
const btnPrimary =
  'px-3 py-1.5 text-[11px] font-bold rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center gap-1.5';

const trimDecimal = (value: string): string => {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' ? '0' : trimmed;
};

let draftKeySeed = 0;
const nextKey = (prefix: string): string => {
  draftKeySeed += 1;
  return `${prefix}-${draftKeySeed}`;
};

interface LineDraft {
  key: string;
  itemId: string;
  description: string;
  unit: UnitOfMeasure | '';
  quantity: string;
  rate: string;
  discountPercent: string;
  gstRate: string;
  expectedDate: string;
  revisedDate: string;
  deliveryLocationId: string;
}

interface ScheduleDraft {
  key: string;
  lineKey: string;
  scheduleDate: string;
  quantity: string;
  note: string;
}

type PartyView = Pick<
  OrderPartyLookup,
  'id' | 'partyName' | 'partyCode' | 'gstin' | 'state' | 'city' | 'address' | 'pincode' | 'phone' | 'email'
>;

const emptyLine = (): LineDraft => ({
  key: nextKey('line'),
  itemId: '',
  description: '',
  unit: '',
  quantity: '',
  rate: '',
  discountPercent: '0',
  gstRate: '',
  expectedDate: '',
  revisedDate: '',
  deliveryLocationId: '',
});

interface PickerOption {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
}

interface PickerModalProps {
  title: string;
  placeholder: string;
  options: PickerOption[];
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const PickerModal: React.FC<PickerModalProps> = ({
  title,
  placeholder,
  options,
  emptyMessage,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === '') return options;
    return options.filter((option) =>
      [option.primary, option.secondary, option.meta]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle))
    );
  }, [options, search]);

  useEffect(() => {
    setCursor(0);
  }, [search]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[cursor];
      if (option) onSelect(option.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center pt-24 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Close picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={`${inputCls} pl-7`}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {filtered.length} result{filtered.length === 1 ? '' : 's'} · ↑ ↓ to move · Enter to select · Esc to close
          </p>
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-slate-500">{emptyMessage}</p>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => onSelect(option.id)}
                className={`w-full text-left px-3 py-1.5 border-b border-slate-100 last:border-b-0 ${
                  index === cursor ? 'bg-[#2c5f57]/10' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold text-slate-800 truncate">{option.primary}</span>
                  {option.secondary && (
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">{option.secondary}</span>
                  )}
                </div>
                {option.meta && <p className="text-[10px] text-slate-500 truncate">{option.meta}</p>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
const addressSnapshot = (party: {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}): string =>
  [party.address, party.city, party.state, party.pincode]
    .filter((part): part is string => Boolean(part && part.trim() !== ''))
    .join(', ');

interface OrderEntryPageProps {
  documentType: OrderDocumentType;
}

export const OrderEntryPage: React.FC<OrderEntryPageProps> = ({ documentType }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const isSales = documentType === 'SALES_ORDER';
  const labels = useMemo(() => orderLabels(documentType), [documentType]);
  const paths = useMemo(() => orderPaths(documentType), [documentType]);

  const [lookups, setLookups] = useState<OrderLookups | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const savingRef = useRef(false);

  const [orderNumber, setOrderNumber] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [orderDate, setOrderDate] = useState(todayKey());
  const [party, setParty] = useState<PartyView | null>(null);
  const [priority, setPriority] = useState<OrderPriority>('NORMAL');

  const [customerReferenceNumber, setCustomerReferenceNumber] = useState('');
  const [customerReferenceDate, setCustomerReferenceDate] = useState('');
  const [supplierQuotationNumber, setSupplierQuotationNumber] = useState('');
  const [supplierQuotationDate, setSupplierQuotationDate] = useState('');
  const [supplierReference, setSupplierReference] = useState('');
  const [supplierGstin, setSupplierGstin] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [orderValidUntil, setOrderValidUntil] = useState('');
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [transportDetails, setTransportDetails] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [freightTerms, setFreightTerms] = useState('');

  const [freightAmount, setFreightAmount] = useState('0');
  const [packingAmount, setPackingAmount] = useState('0');
  const [otherCharges, setOtherCharges] = useState('0');
  const [narration, setNarration] = useState('');
  const [remarks, setRemarks] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [scheduleIsPartial, setScheduleIsPartial] = useState(false);

  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [itemPickerIndex, setItemPickerIndex] = useState<number | null>(null);
  const [activeLineIndex, setActiveLineIndex] = useState(0);

  const focusZoneRef = useRef<'header' | 'lines'>('header');
  const activeLineRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const lookupData = await getOrderLookups(documentType);
        if (cancelled) return;
        setLookups(lookupData);

        if (!id) {
          setOrderNumber(lookupData.nextOrderNumber);
          setLoading(false);
          return;
        }

        const record: SalesOrder | PurchaseOrder = isSales
          ? await getSalesOrder(id)
          : await getPurchaseOrder(id);
        if (cancelled) return;

        setOrderNumber(record.orderNumber);
        setStatus(record.status);
        setOrderDate(record.orderDate);
        setParty({
          id: record.party.id,
          partyName: record.party.partyName,
          partyCode: record.party.partyCode,
          gstin: record.party.gstin,
          state: record.party.state,
          city: record.party.city,
          address: record.party.address,
          pincode: record.party.pincode,
          phone: record.party.phone,
          email: record.party.email,
        });
        setPriority(record.priority);
        setBillingAddress(record.billingAddress ?? '');
        setExpectedDeliveryDate(record.expectedDeliveryDate ?? '');
        setPaymentTerms(record.paymentTerms ?? '');
        setDeliveryTerms(record.deliveryTerms ?? '');
        setFreightTerms(record.freightTerms ?? '');
        setFreightAmount(trimDecimal(record.totals.freightAmount));
        setPackingAmount(trimDecimal(record.totals.packingAmount));
        setOtherCharges(trimDecimal(record.totals.otherCharges));
        setNarration(record.narration ?? '');
        setRemarks(record.remarks ?? '');
        setTermsAndConditions(record.termsAndConditions ?? '');

        if (isSales) {
          const salesOrder = record as SalesOrder;
          setCustomerReferenceNumber(salesOrder.customerReferenceNumber ?? '');
          setCustomerReferenceDate(salesOrder.customerReferenceDate ?? '');
          setDeliveryAddress(salesOrder.deliveryAddress ?? '');
          setSalesperson(salesOrder.salesperson ?? '');
          setOrderValidUntil(salesOrder.orderValidUntil ?? '');
          setScheduleIsPartial(salesOrder.scheduleIsPartial);
        } else {
          const purchaseOrder = record as PurchaseOrder;
          setSupplierQuotationNumber(purchaseOrder.supplierQuotationNumber ?? '');
          setSupplierQuotationDate(purchaseOrder.supplierQuotationDate ?? '');
          setSupplierReference(purchaseOrder.supplierReference ?? '');
          setSupplierGstin(purchaseOrder.supplierGstin ?? '');
          setBuyerName(purchaseOrder.buyerName ?? '');
          setTransportDetails(purchaseOrder.transportDetails ?? '');
          setDeliveryLocationId(purchaseOrder.deliveryLocationId ?? '');
        }

        const baseLine = (line: {
          itemId: string | null;
          description: string | null;
          unit: UnitOfMeasure;
          quantity: string;
          rate: string;
          discountPercent: string;
          gstRate: string;
        }) => ({
          itemId: line.itemId ?? '',
          description: line.description ?? '',
          unit: line.unit,
          quantity: trimDecimal(line.quantity),
          rate: trimDecimal(line.rate),
          discountPercent: trimDecimal(line.discountPercent),
          gstRate: trimDecimal(line.gstRate),
        });

        let draftLines: LineDraft[];
        if (isSales) {
          draftLines = (record as SalesOrder).lines.map((line) => ({
            key: nextKey('line'),
            ...baseLine(line),
            expectedDate: line.expectedDeliveryDate ?? '',
            revisedDate: '',
            deliveryLocationId: '',
          }));
        } else {
          draftLines = (record as PurchaseOrder).lines.map((line) => ({
            key: nextKey('line'),
            ...baseLine(line),
            expectedDate: line.expectedReceiptDate ?? '',
            revisedDate: line.revisedDeliveryDate ?? '',
            deliveryLocationId: line.deliveryLocationId ?? '',
          }));
        }
        setLines(draftLines.length > 0 ? draftLines : [emptyLine()]);

        if (isSales) {
          const salesOrder = record as SalesOrder;
          const keyByLineNumber = new Map<number, string>();
          draftLines.forEach((line, index) => keyByLineNumber.set(index + 1, line.key));
          setSchedules(
            salesOrder.schedules.map((schedule) => ({
              key: nextKey('schedule'),
              lineKey: keyByLineNumber.get(schedule.lineNumber) ?? draftLines[0]?.key ?? '',
              scheduleDate: schedule.scheduleDate,
              quantity: trimDecimal(schedule.quantity),
              note: schedule.note ?? '',
            }))
          );
        }
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load the order form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [documentType, id, isSales]);

  const locked = lookups?.financialYear.isLocked ?? false;
  const readOnly = isEdit && status !== 'DRAFT';

  const taxType: OrderTaxType = useMemo(() => {
    const companyState = (lookups?.company.state ?? '').trim().toLowerCase();
    const partyState = (party?.state ?? '').trim().toLowerCase();
    if (companyState === '' || partyState === '') return 'INTRA_STATE';
    return companyState === partyState ? 'INTRA_STATE' : 'INTER_STATE';
  }, [lookups, party]);

  const lineTotals = useMemo(() => lines.map((line) => computeLineDraft(line, taxType)), [lines, taxType]);

  const totals = useMemo(() => {
    let totalQuantity = 0;
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    lineTotals.forEach((line) => {
      totalQuantity += line.quantity;
      subtotal = round2(subtotal + round2(line.quantity * line.rate));
      discountAmount = round2(discountAmount + line.discountAmount);
      taxableAmount = round2(taxableAmount + line.taxableAmount);
      cgstAmount = round2(cgstAmount + line.cgstAmount);
      sgstAmount = round2(sgstAmount + line.sgstAmount);
      igstAmount = round2(igstAmount + line.igstAmount);
    });

    const freight = Number(freightAmount || 0) || 0;
    const packing = Number(packingAmount || 0) || 0;
    const other = Number(otherCharges || 0) || 0;
    const chargesTotal = round2(freight + packing + other);
    const beforeRounding = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount + chargesTotal);
    // Matches the backend: the grand total is rounded to the nearest rupee.
    const grandTotal = Math.round(beforeRounding);

    return {
      totalQuantity,
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      freight,
      packing,
      other,
      chargesTotal,
      grandTotal,
      roundOffAmount: round2(grandTotal - beforeRounding),
    };
  }, [lineTotals, freightAmount, packingAmount, otherCharges]);

  const partyOptions: PickerOption[] = useMemo(
    () =>
      (lookups?.parties ?? []).map((option) => ({
        id: option.id,
        primary: option.partyName,
        secondary: option.partyCode,
        meta: [option.gstin, option.city, option.state]
          .filter((value): value is string => Boolean(value))
          .join(' · '),
      })),
    [lookups]
  );

  const itemOptions: PickerOption[] = useMemo(
    () =>
      (lookups?.items ?? []).map((option) => ({
        id: option.id,
        primary: option.itemName,
        secondary: option.itemCode,
        meta: `${ITEM_TYPE_LABELS[option.itemType as ItemType] ?? option.itemType} · ${
          UNIT_LABELS[option.unit]
        } · GST ${trimDecimal(option.gstRate)}%`,
      })),
    [lookups]
  );

  const clearLineErrors = (index: number) => {
    setFieldErrors((prev) => {
      const next: Record<string, string> = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith(`lines[${index}].`)) next[key] = prev[key];
      });
      return next;
    });
  };

  const updateLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((line, position) => (position === index ? { ...line, ...patch } : line)));
    clearLineErrors(index);
  };

  const selectParty = (partyId: string) => {
    const option = lookups?.parties.find((entry) => entry.id === partyId) ?? null;
    if (option) {
      setParty({ ...option });
      setBillingAddress((current) => (current.trim() === '' ? addressSnapshot(option) : current));
      if (isSales) {
        setDeliveryAddress((current) => (current.trim() === '' ? addressSnapshot(option) : current));
      } else {
        setSupplierGstin((current) => (current.trim() === '' ? (option.gstin ?? '') : current));
      }
    }
    setPartyPickerOpen(false);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.partyId;
      return next;
    });
  };

  const applyItemToLine = (index: number, item: OrderItemLookup) => {
    const duplicateIndex = lines.findIndex((line, position) => position !== index && line.itemId === item.id);
    if (duplicateIndex >= 0) {
      setFieldErrors((prev) => ({
        ...prev,
        [`lines[${index}].itemId`]: `This item is already used on line ${duplicateIndex + 1}. Combine the quantities into one line.`,
      }));
      setItemPickerIndex(null);
      return;
    }

    updateLine(index, {
      itemId: item.id,
      description: item.description ?? '',
      unit: item.unit,
      rate: trimDecimal(isSales ? item.defaultSalesRate : item.defaultPurchaseRate),
      gstRate: trimDecimal(item.gstRate),
    });
    setItemPickerIndex(null);
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((_, position) => position !== index)));
    setFieldErrors({});
  };

  const addScheduleRow = () => {
    setSchedules((prev) => [
      ...prev,
      {
        key: nextKey('schedule'),
        lineKey: lines[0]?.key ?? '',
        scheduleDate: '',
        quantity: '',
        note: '',
      },
    ]);
  };

  const updateScheduleRow = (key: string, patch: Partial<ScheduleDraft>) => {
    setSchedules((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeScheduleRow = (key: string) => {
    setSchedules((prev) => prev.filter((row) => row.key !== key));
  };

  const resetForm = () => {
    setOrderDate(todayKey());
    setParty(null);
    setPriority('NORMAL');
    setCustomerReferenceNumber('');
    setCustomerReferenceDate('');
    setSupplierQuotationNumber('');
    setSupplierQuotationDate('');
    setSupplierReference('');
    setSupplierGstin('');
    setBillingAddress('');
    setDeliveryAddress('');
    setExpectedDeliveryDate('');
    setSalesperson('');
    setBuyerName('');
    setOrderValidUntil('');
    setDeliveryLocationId('');
    setTransportDetails('');
    setPaymentTerms('');
    setDeliveryTerms('');
    setFreightTerms('');
    setFreightAmount('0');
    setPackingAmount('0');
    setOtherCharges('0');
    setNarration('');
    setRemarks('');
    setTermsAndConditions('');
    setLines([emptyLine()]);
    setSchedules([]);
    setScheduleIsPartial(false);
    setFieldErrors({});
    setSaveError(null);
    if (lookups) setOrderNumber(lookups.nextOrderNumber);
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (orderDate === '') errors.orderDate = 'Order date is required.';
    if (!party) errors.partyId = `${labels.partyLabel} selection is required.`;
    if (lines.length === 0) errors.lines = 'Add at least one order line.';

    const seen = new Map<string, number>();
    lines.forEach((line, index) => {
      if (line.itemId === '') {
        errors[`lines[${index}].itemId`] = `Line ${index + 1}: select an item.`;
      } else if (seen.has(line.itemId)) {
        errors[`lines[${index}].itemId`] = `Line ${index + 1}: item already used on line ${
          (seen.get(line.itemId) ?? 0) + 1
        }.`;
      } else {
        seen.set(line.itemId, index);
      }

      const quantity = Number(line.quantity);
      if (line.quantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0) {
        errors[`lines[${index}].quantity`] = `Line ${index + 1}: quantity must be greater than zero.`;
      }

      const rate = Number(line.rate);
      if (line.rate.trim() !== '' && (!Number.isFinite(rate) || rate < 0)) {
        errors[`lines[${index}].rate`] = `Line ${index + 1}: rate cannot be negative.`;
      }
    });

    if (isSales && scheduleIsPartial) {
      schedules.forEach((row, index) => {
        if (row.lineKey === '' || lines.findIndex((line) => line.key === row.lineKey) < 0) {
          errors[`schedules[${index}].lineNumber`] = `Schedule ${index + 1}: select an order line.`;
        }
        if (row.scheduleDate === '') {
          errors[`schedules[${index}].scheduleDate`] = `Schedule ${index + 1}: date is required.`;
        }
        const scheduledQuantity = Number(row.quantity);
        if (row.quantity.trim() === '' || !Number.isFinite(scheduledQuantity) || scheduledQuantity <= 0) {
          errors[`schedules[${index}].quantity`] = `Schedule ${index + 1}: quantity must be greater than zero.`;
        }
      });
    }

    return errors;
  };

  const buildPayload = (): OrderPayload => {
    const payload: OrderPayload = {
      orderDate,
      partyId: party?.id ?? '',
      priority,
      taxType,
      freightAmount: freightAmount.trim() === '' ? '0' : freightAmount.trim(),
      packingAmount: packingAmount.trim() === '' ? '0' : packingAmount.trim(),
      otherCharges: otherCharges.trim() === '' ? '0' : otherCharges.trim(),
      narration: narration.trim() === '' ? null : narration.trim(),
      remarks: remarks.trim() === '' ? null : remarks.trim(),
      termsAndConditions: termsAndConditions.trim() === '' ? null : termsAndConditions.trim(),
      lines: lines.map((line, index) => ({
        lineNumber: index + 1,
        itemId: line.itemId,
        description: line.description.trim() === '' ? null : line.description.trim(),
        unit: line.unit === '' ? undefined : line.unit,
        quantity: line.quantity.trim(),
        rate: line.rate.trim() === '' ? null : line.rate.trim(),
        discountPercent: line.discountPercent.trim() === '' ? '0' : line.discountPercent.trim(),
        gstRate: line.gstRate.trim() === '' ? undefined : line.gstRate.trim(),
        ...(isSales
          ? { expectedDeliveryDate: line.expectedDate === '' ? null : line.expectedDate }
          : {
              expectedReceiptDate: line.expectedDate === '' ? null : line.expectedDate,
              revisedDeliveryDate: line.revisedDate === '' ? null : line.revisedDate,
              deliveryLocationId: line.deliveryLocationId === '' ? null : line.deliveryLocationId,
            }),
      })),
    };

    if (isSales) {
      payload.customerReferenceNumber =
        customerReferenceNumber.trim() === '' ? null : customerReferenceNumber.trim();
      payload.customerReferenceDate = customerReferenceDate === '' ? null : customerReferenceDate;
      payload.billingAddress = billingAddress.trim() === '' ? null : billingAddress.trim();
      payload.deliveryAddress = deliveryAddress.trim() === '' ? null : deliveryAddress.trim();
      payload.expectedDeliveryDate = expectedDeliveryDate === '' ? null : expectedDeliveryDate;
      payload.salesperson = salesperson.trim() === '' ? null : salesperson.trim();
      payload.paymentTerms = paymentTerms.trim() === '' ? null : paymentTerms.trim();
      payload.deliveryTerms = deliveryTerms.trim() === '' ? null : deliveryTerms.trim();
      payload.freightTerms = freightTerms.trim() === '' ? null : freightTerms.trim();
      payload.orderValidUntil = orderValidUntil === '' ? null : orderValidUntil;
      payload.scheduleIsPartial = scheduleIsPartial;
      payload.schedules = scheduleIsPartial
        ? schedules.map((row) => ({
            lineNumber: lines.findIndex((line) => line.key === row.lineKey) + 1,
            scheduleDate: row.scheduleDate,
            quantity: row.quantity.trim(),
            note: row.note.trim() === '' ? null : row.note.trim(),
          }))
        : [];
    } else {
      payload.supplierQuotationNumber =
        supplierQuotationNumber.trim() === '' ? null : supplierQuotationNumber.trim();
      payload.supplierQuotationDate = supplierQuotationDate === '' ? null : supplierQuotationDate;
      payload.supplierReference = supplierReference.trim() === '' ? null : supplierReference.trim();
      payload.supplierGstin = supplierGstin.trim() === '' ? null : supplierGstin.trim();
      payload.billingAddress = billingAddress.trim() === '' ? null : billingAddress.trim();
      payload.expectedDeliveryDate = expectedDeliveryDate === '' ? null : expectedDeliveryDate;
      payload.buyerName = buyerName.trim() === '' ? null : buyerName.trim();
      payload.paymentTerms = paymentTerms.trim() === '' ? null : paymentTerms.trim();
      payload.deliveryTerms = deliveryTerms.trim() === '' ? null : deliveryTerms.trim();
      payload.freightTerms = freightTerms.trim() === '' ? null : freightTerms.trim();
      payload.deliveryLocationId = deliveryLocationId === '' ? null : deliveryLocationId;
      payload.transportDetails = transportDetails.trim() === '' ? null : transportDetails.trim();
    }

    return payload;
  };

  const handleSave = async () => {
    if (savingRef.current) return;

    if (locked) {
      setSaveError(
        `Financial year ${lookups?.financialYear.yearName ?? ''} is locked. Orders cannot be created or edited.`
      );
      return;
    }
    if (readOnly) {
      setSaveError(
        `Only draft orders can be edited. This ${labels.noun.toLowerCase()} is ${
          ORDER_STATUS_LABELS[status] ?? status
        }.`
      );
      return;
    }

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveError('Please correct the highlighted fields before saving.');
      return;
    }

    setFieldErrors({});
    setSaveError(null);
    savingRef.current = true;
    setSaving(true);

    try {
      const payload = buildPayload();
      const saved =
        isEdit && id ? await updateOrder(documentType, id, payload) : await createOrder(documentType, payload);
      navigate(paths.detail(saved.id));
    } catch (error) {
      const apiErrors = (error as { errors?: Array<{ field: string; message: string }> }).errors;
      if (apiErrors && apiErrors.length > 0) {
        const mapped: Record<string, string> = {};
        apiErrors.forEach((entry) => {
          mapped[entry.field] = entry.message;
        });
        setFieldErrors(mapped);
      }
      setSaveError(error instanceof Error ? error.message : `Failed to save the ${labels.noun.toLowerCase()}.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveRef = useRef<() => void>(() => undefined);
  saveRef.current = () => {
    void handleSave();
  };
  const resetRef = useRef<() => void>(() => undefined);
  resetRef.current = resetForm;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'F10') {
        event.preventDefault();
        saveRef.current();
      } else if (event.key === 'F5') {
        event.preventDefault();
        navigate(paths.base);
      } else if (event.key === 'F2') {
        event.preventDefault();
        if (!isEdit) resetRef.current();
      } else if (event.key === 'F3') {
        event.preventDefault();
        if (focusZoneRef.current === 'lines') {
          setItemPickerIndex(activeLineRef.current);
        } else {
          setPartyPickerOpen(true);
        }
      } else if (event.key === 'Escape') {
        if (partyPickerOpen) {
          event.preventDefault();
          setPartyPickerOpen(false);
        } else if (itemPickerIndex !== null) {
          event.preventDefault();
          setItemPickerIndex(null);
        } else {
          event.preventDefault();
          navigate(paths.base);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, paths.base, isEdit, partyPickerOpen, itemPickerIndex]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading {labels.noun.toLowerCase()} form…</p>
        </div>
      </div>
    );
  }

  if (loadError || !lookups) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-lg shadow-sm p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <p className="text-sm font-bold text-red-700">Unable to open the {labels.noun.toLowerCase()} form</p>
        <p className="text-xs text-slate-600">{loadError ?? 'Lookup data is unavailable.'}</p>
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

  if (readOnly) {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-white border border-amber-300 rounded-lg shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h2 className="text-sm font-bold text-slate-800">This {labels.noun.toLowerCase()} is not editable</h2>
        </div>
        <p className="text-[12px] text-slate-600">
          {orderNumber} is currently <span className="font-bold">{ORDER_STATUS_LABELS[status] ?? status}</span>. Only
          draft documents can be edited. Use the order detail page for status actions.
        </p>
        <div className="rounded border border-slate-200 bg-slate-50 p-3 text-[11.5px] text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span>Order date</span>
            <span className="font-semibold text-slate-800">{formatDate(orderDate)}</span>
          </div>
          <div className="flex justify-between">
            <span>{labels.partyLabel}</span>
            <span className="font-semibold text-slate-800">{party ? party.partyName : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span>Order value</span>
            <span className="font-mono font-semibold text-slate-800">₹ {money(totals.grandTotal)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => navigate(paths.detail(id as string))}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a]"
          >
            Open Detail
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.print(id as string))}
            className="px-3 py-1.5 text-[11px] font-bold rounded bg-slate-800 text-white hover:bg-slate-700"
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => navigate(paths.base)}
            className="px-3 py-1.5 text-[11px] font-bold rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Back to Register
          </button>
        </div>
      </div>
    );
  }

  const activeItemPicker = itemPickerIndex === null ? null : lines[itemPickerIndex];

  return (
    <div
      className="w-full max-w-[1400px] mx-auto space-y-2 pb-10"
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
          event.preventDefault();
        }
      }}
    >
      <div className="bg-[#2c5f57] text-white rounded-lg shadow-sm px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-white/15 flex items-center justify-center">
            {isSales ? <ClipboardList className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight flex items-center gap-2">
              {isEdit ? `Edit ${labels.noun}` : `New ${labels.noun}`}
              <span className="font-mono text-[12px] text-white/70">{orderNumber || '—'}</span>
            </h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              {lookups.company.companyName} · FY {lookups.financialYear.yearName}
              {locked ? ' · FY LOCKED' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${statusTone(status)}`}>
            {ORDER_STATUS_LABELS[status] ?? status}
          </span>
          <button type="button" onClick={() => navigate(paths.base)} className={btnGhost}>
            Register (F5)
          </button>
          {isEdit && (
            <button type="button" onClick={() => navigate(paths.detail(id as string))} className={btnGhost}>
              View
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || locked}
            className={btnPrimary}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save (F10)'}
          </button>
        </div>
      </div>

      {locked && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Financial year {lookups.financialYear.yearName} is locked — orders cannot be created, edited or cancelled.
        </div>
      )}

      {saveError && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-md px-3 py-2 text-[11.5px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_308px] gap-2.5 items-start">
        <div className="space-y-2.5 min-w-0">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                {labels.noun} Details
              </span>
              <span className="text-[10px] text-slate-400">* required field</span>
            </div>

            <div className="p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2.5">
              <div>
                <label className={labelCls}>Order No</label>
                <input value={orderNumber} readOnly disabled className={`${inputCls} font-mono`} />
              </div>

              <div>
                <label className={labelCls}>Order Date *</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
                  onFocus={() => {
                    focusZoneRef.current = 'header';
                  }}
                  disabled={locked}
                  className={inputCls}
                />
                {fieldErrors.orderDate && (
                  <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.orderDate}</p>
                )}
              </div>

              <div className="col-span-2">
                <label className={labelCls}>{labels.partyLabel} *</label>
                <button
                  type="button"
                  onClick={() => setPartyPickerOpen(true)}
                  onFocus={() => {
                    focusZoneRef.current = 'header';
                  }}
                  disabled={locked}
                  className={`${inputCls} flex items-center justify-between gap-2 text-left`}
                >
                  <span className={`truncate ${party ? '' : 'text-slate-400'}`}>
                    {party ? `${party.partyCode} — ${party.partyName}` : labels.partyPlaceholder}
                  </span>
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
                {fieldErrors.partyId && (
                  <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.partyId}</p>
                )}
              </div>

              <div>
                <label className={labelCls}>Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as OrderPriority)}
                  disabled={locked}
                  className={inputCls}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>GST Treatment</label>
                <input
                  value={TAX_TYPE_LABELS[taxType]}
                  readOnly
                  disabled
                  className={inputCls}
                  title={`Place of supply: ${party?.state ?? 'not specified'}`}
                />
              </div>

              <div>
                <label className={labelCls}>{isSales ? 'Customer Ref No' : 'Supplier Quotation No'}</label>
                <input
                  value={isSales ? customerReferenceNumber : supplierQuotationNumber}
                  onChange={(event) =>
                    isSales
                      ? setCustomerReferenceNumber(event.target.value)
                      : setSupplierQuotationNumber(event.target.value)
                  }
                  maxLength={100}
                  disabled={locked}
                  placeholder="Reference document"
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div>
                <label className={labelCls}>{isSales ? 'Customer Ref Date' : 'Quotation Date'}</label>
                <input
                  type="date"
                  value={isSales ? customerReferenceDate : supplierQuotationDate}
                  onChange={(event) =>
                    isSales
                      ? setCustomerReferenceDate(event.target.value)
                      : setSupplierQuotationDate(event.target.value)
                  }
                  disabled={locked}
                  className={inputCls}
                />
              </div>

              {isSales ? (
                <>
                  <div>
                    <label className={labelCls}>Salesperson</label>
                    <input
                      value={salesperson}
                      onChange={(event) => setSalesperson(event.target.value)}
                      maxLength={120}
                      disabled={locked}
                      placeholder="Owner of the order"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Valid Until</label>
                    <input
                      type="date"
                      value={orderValidUntil}
                      onChange={(event) => setOrderValidUntil(event.target.value)}
                      disabled={locked}
                      className={inputCls}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={labelCls}>Supplier Reference</label>
                    <input
                      value={supplierReference}
                      onChange={(event) => setSupplierReference(event.target.value)}
                      maxLength={100}
                      disabled={locked}
                      placeholder="Supplier order reference"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Supplier GSTIN</label>
                    <input
                      value={supplierGstin}
                      onChange={(event) => setSupplierGstin(event.target.value.toUpperCase())}
                      maxLength={20}
                      disabled={locked}
                      placeholder="Derived from party if blank"
                      className={`${inputCls} font-mono uppercase`}
                    />
                  </div>
                </>
              )}

              <div>
                <label className={labelCls}>{labels.expectedDateLabel}</label>
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(event) => setExpectedDeliveryDate(event.target.value)}
                  disabled={locked}
                  className={inputCls}
                />
              </div>

              {isSales ? (
                <div>
                  <label className={labelCls}>Place of Supply</label>
                  <input value={party?.state ?? '—'} readOnly disabled className={inputCls} />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Delivery Location</label>
                  <select
                    value={deliveryLocationId}
                    onChange={(event) => setDeliveryLocationId(event.target.value)}
                    disabled={locked}
                    className={inputCls}
                  >
                    <option value="">Not specified</option>
                    {(lookups.locations ?? []).map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.locationName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={labelCls}>Payment Terms</label>
                <input
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  list="order-payment-terms"
                  maxLength={120}
                  disabled={locked}
                  placeholder="e.g. 30 Days Credit"
                  className={inputCls}
                />
                <datalist id="order-payment-terms">
                  {lookups.terms.paymentTerms.map((term) => (
                    <option key={term} value={term} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className={labelCls}>Delivery Terms</label>
                <input
                  value={deliveryTerms}
                  onChange={(event) => setDeliveryTerms(event.target.value)}
                  list="order-delivery-terms"
                  maxLength={120}
                  disabled={locked}
                  placeholder="e.g. Ex-Godown"
                  className={inputCls}
                />
                <datalist id="order-delivery-terms">
                  {lookups.terms.deliveryTerms.map((term) => (
                    <option key={term} value={term} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className={labelCls}>Freight Terms</label>
                <input
                  value={freightTerms}
                  onChange={(event) => setFreightTerms(event.target.value)}
                  list="order-freight-terms"
                  maxLength={120}
                  disabled={locked}
                  placeholder="e.g. To Pay"
                  className={inputCls}
                />
                <datalist id="order-freight-terms">
                  {lookups.terms.freightTerms.map((term) => (
                    <option key={term} value={term} />
                  ))}
                </datalist>
              </div>

              {!isSales && (
                <div className="col-span-2 xl:col-span-3">
                  <label className={labelCls}>Buyer / Prepared By</label>
                  <input
                    value={buyerName}
                    onChange={(event) => setBuyerName(event.target.value)}
                    maxLength={120}
                    disabled={locked}
                    placeholder="Internal buyer responsible for this purchase"
                    className={inputCls}
                  />
                </div>
              )}

              {!isSales && (
                <div className="col-span-2 xl:col-span-3">
                  <label className={labelCls}>Transport Details</label>
                  <input
                    value={transportDetails}
                    onChange={(event) => setTransportDetails(event.target.value)}
                    maxLength={200}
                    disabled={locked}
                    placeholder="Transporter, vehicle, LR number (optional)"
                    className={inputCls}
                  />
                </div>
              )}

              <div className={isSales ? 'col-span-2 xl:col-span-3' : 'col-span-2 xl:col-span-6'}>
                <label className={labelCls}>Billing Address</label>
                <textarea
                  value={billingAddress}
                  onChange={(event) => setBillingAddress(event.target.value)}
                  maxLength={500}
                  rows={2}
                  disabled={locked}
                  placeholder="Defaults to the party address snapshot"
                  className={`${inputCls} h-auto py-1 resize-y`}
                />
              </div>

              {isSales && (
                <div className="col-span-2 xl:col-span-3">
                  <label className={labelCls}>Delivery Address</label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(event) => setDeliveryAddress(event.target.value)}
                    maxLength={500}
                    rows={2}
                    disabled={locked}
                    placeholder="Defaults to the billing address"
                    className={`${inputCls} h-auto py-1 resize-y`}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                Order Lines <span className="text-slate-400">({lines.length})</span>
              </span>
              <button
                type="button"
                onClick={addLine}
                disabled={locked || lines.length >= 200}
                className="px-2 py-1 text-[10.5px] font-bold rounded border border-[#2c5f57] text-[#2c5f57] hover:bg-[#2c5f57]/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Line
              </button>
            </div>

            {fieldErrors.lines && (
              <p className="px-3 pt-1.5 text-[10.5px] text-red-600 font-semibold">{fieldErrors.lines}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-[11.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-[9.5px] uppercase tracking-wider text-slate-500">
                    <th className="px-1.5 py-1 text-left w-8">#</th>
                    <th className="px-1.5 py-1 text-left min-w-[215px]">Item</th>
                    <th className="px-1.5 py-1 text-left min-w-[145px]">Description</th>
                    <th className="px-1.5 py-1 text-right w-24">Qty</th>
                    <th className="px-1.5 py-1 text-center w-14">Unit</th>
                    <th className="px-1.5 py-1 text-right w-28">Rate</th>
                    <th className="px-1.5 py-1 text-right w-16">Disc %</th>
                    <th className="px-1.5 py-1 text-right w-16">GST %</th>
                    <th className="px-1.5 py-1 text-right w-24">Taxable</th>
                    <th className="px-1.5 py-1 text-right w-24">Line Total</th>
                    <th className="px-1.5 py-1 text-left w-32">
                      {isSales ? 'Exp. Delivery' : 'Exp. Receipt'}
                    </th>
                    {!isSales && <th className="px-1.5 py-1 text-left w-36">Location</th>}
                    <th className="px-1.5 py-1 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const computed = lineTotals[index];
                    const item = lookups.items.find((entry) => entry.id === line.itemId) ?? null;
                    const itemError = fieldErrors[`lines[${index}].itemId`];
                    const quantityError = fieldErrors[`lines[${index}].quantity`];
                    const rateError = fieldErrors[`lines[${index}].rate`];

                    const focusLine = () => {
                      focusZoneRef.current = 'lines';
                      activeLineRef.current = index;
                      setActiveLineIndex(index);
                    };

                    return (
                      <tr
                        key={line.key}
                        className={`border-b border-slate-100 align-top ${
                          activeLineIndex === index ? 'bg-[#2c5f57]/[0.04]' : ''
                        }`}
                      >
                        <td className="px-1.5 py-1 text-center font-mono text-[10px] text-slate-500">{index + 1}</td>

                        <td className="px-1.5 py-1">
                          <button
                            type="button"
                            onClick={() => setItemPickerIndex(index)}
                            onFocus={focusLine}
                            disabled={locked}
                            className={`w-full h-7 px-1.5 text-[11.5px] rounded border text-left flex items-center justify-between gap-1 hover:border-[#2c5f57] ${
                              itemError ? 'border-red-400 bg-red-50' : 'border-slate-300 bg-white'
                            }`}
                          >
                            <span className="truncate">
                              {item ? (
                                <>
                                  <span className="font-mono text-[10px] text-slate-500">{item.itemCode}</span>
                                  <span className="ml-1">{item.itemName}</span>
                                </>
                              ) : (
                                <span className="text-slate-400">Select item…</span>
                              )}
                            </span>
                            <Search className="w-3 h-3 text-slate-400 shrink-0" />
                          </button>
                          {itemError && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold leading-tight">{itemError}</p>
                          )}
                          {item && (item.colour || item.yarnCount || item.denier) && (
                            <p className="mt-0.5 text-[9.5px] text-slate-500 leading-tight truncate">
                              {[
                                item.yarnQualityName,
                                item.yarnCount ? `${item.yarnCount} count` : null,
                                item.denier ? `${item.denier} denier` : null,
                                item.colour,
                              ]
                                .filter((value): value is string => Boolean(value))
                                .join(' · ')}
                            </p>
                          )}
                        </td>

                        <td className="px-1.5 py-1">
                          <input
                            value={line.description}
                            onChange={(event) => updateLine(index, { description: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            maxLength={200}
                            placeholder="Optional line note"
                            className={cellInputCls}
                          />
                        </td>

                        <td className="px-1.5 py-1">
                          <input
                            value={line.quantity}
                            onChange={(event) => updateLine(index, { quantity: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="0.000"
                            className={`${cellNumCls} ${quantityError ? 'border-red-400 bg-red-50' : ''}`}
                          />
                          {quantityError && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold leading-tight">{quantityError}</p>
                          )}
                        </td>

                        <td className="px-1.5 py-1">
                          <div className="h-7 flex items-center justify-center text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded">
                            {line.unit === '' ? '—' : UNIT_LABELS[line.unit]}
                          </div>
                        </td>

                        <td className="px-1.5 py-1">
                          <input
                            value={line.rate}
                            onChange={(event) => updateLine(index, { rate: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="0.0000"
                            className={`${cellNumCls} ${rateError ? 'border-red-400 bg-red-50' : ''}`}
                          />
                          {rateError && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold leading-tight">{rateError}</p>
                          )}
                        </td>

                        <td className="px-1.5 py-1">
                          <input
                            value={line.discountPercent}
                            onChange={(event) => updateLine(index, { discountPercent: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="0"
                            className={cellNumCls}
                          />
                        </td>

                        <td className="px-1.5 py-1">
                          <input
                            value={line.gstRate}
                            onChange={(event) => updateLine(index, { gstRate: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="0"
                            className={cellNumCls}
                          />
                        </td>

                        <td className="px-1.5 py-1">
                          <div className="h-7 flex items-center justify-end pr-1 font-mono text-[11px] text-slate-700">
                            {money(computed.taxableAmount)}
                          </div>
                        </td>

                        <td className="px-1.5 py-1">
                          <div className="h-7 flex items-center justify-end pr-1 font-mono text-[11px] font-bold text-slate-900">
                            {money(computed.lineTotal)}
                          </div>
                        </td>

                        <td className="px-1.5 py-1 space-y-1">
                          <input
                            type="date"
                            value={line.expectedDate}
                            onChange={(event) => updateLine(index, { expectedDate: event.target.value })}
                            onFocus={focusLine}
                            disabled={locked}
                            className={cellInputCls}
                          />
                          {!isSales && (
                            <input
                              type="date"
                              value={line.revisedDate}
                              onChange={(event) => updateLine(index, { revisedDate: event.target.value })}
                              onFocus={focusLine}
                              disabled={locked}
                              title="Revised delivery date confirmed with the supplier"
                              className={`${cellInputCls} text-[10px]`}
                            />
                          )}
                        </td>

                        {!isSales && (
                          <td className="px-1.5 py-1">
                            <select
                              value={line.deliveryLocationId}
                              onChange={(event) => updateLine(index, { deliveryLocationId: event.target.value })}
                              onFocus={focusLine}
                              disabled={locked}
                              className={cellInputCls}
                            >
                              <option value="">Header default</option>
                              {(lookups.locations ?? []).map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.locationName}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        <td className="px-1.5 py-1">
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            disabled={locked || lines.length === 1}
                            title="Remove line"
                            className="w-6 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50 rounded-b-lg flex items-center justify-between text-[10.5px] text-slate-500">
              <span>
                {lines.length} line{lines.length === 1 ? '' : 's'} · F3 searches the item master for the focused line
              </span>
              <span className="font-mono font-bold text-slate-700">Total Qty {qty(totals.totalQuantity)}</span>
            </div>
          </div>
          {isSales && (
            <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
              <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleIsPartial}
                    onChange={(event) => {
                      setScheduleIsPartial(event.target.checked);
                      if (!event.target.checked) setSchedules([]);
                    }}
                    disabled={locked}
                    className="w-3.5 h-3.5 accent-[#2c5f57]"
                  />
                  Partial Delivery Schedule
                </label>
                {scheduleIsPartial && (
                  <button
                    type="button"
                    onClick={addScheduleRow}
                    disabled={locked}
                    className="px-2 py-1 text-[10.5px] font-bold rounded border border-[#2c5f57] text-[#2c5f57] hover:bg-[#2c5f57]/10 disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Schedule
                  </button>
                )}
              </div>

              {scheduleIsPartial && (
                <div className="p-3 space-y-2">
                  {schedules.length === 0 ? (
                    <p className="text-[11px] text-slate-500 leading-snug">
                      No schedule rows yet. Add one row per dispatch commitment. The scheduled quantity for a line may
                      be lower than the ordered quantity only because a partial schedule is explicitly enabled here.
                    </p>
                  ) : (
                    schedules.map((row, index) => (
                      <div key={row.key} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-4">
                          <select
                            value={row.lineKey}
                            onChange={(event) => updateScheduleRow(row.key, { lineKey: event.target.value })}
                            onFocus={() => {
                              focusZoneRef.current = 'lines';
                            }}
                            disabled={locked}
                            className={cellInputCls}
                          >
                            <option value="">Select line…</option>
                            {lines.map((line, lineIndex) => (
                              <option key={line.key} value={line.key}>
                                {`Line ${lineIndex + 1} — ${
                                  lookups.items.find((entry) => entry.id === line.itemId)?.itemName ?? 'unselected item'
                                }`}
                              </option>
                            ))}
                          </select>
                          {fieldErrors[`schedules[${index}].lineNumber`] && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold">
                              {fieldErrors[`schedules[${index}].lineNumber`]}
                            </p>
                          )}
                        </div>
                        <div className="col-span-3">
                          <input
                            type="date"
                            value={row.scheduleDate}
                            onChange={(event) => updateScheduleRow(row.key, { scheduleDate: event.target.value })}
                            disabled={locked}
                            className={cellInputCls}
                          />
                          {fieldErrors[`schedules[${index}].scheduleDate`] && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold">
                              {fieldErrors[`schedules[${index}].scheduleDate`]}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <input
                            value={row.quantity}
                            onChange={(event) => updateScheduleRow(row.key, { quantity: event.target.value })}
                            disabled={locked}
                            inputMode="decimal"
                            placeholder="Qty"
                            className={cellNumCls}
                          />
                          {fieldErrors[`schedules[${index}].quantity`] && (
                            <p className="mt-0.5 text-[9.5px] text-red-600 font-semibold">
                              {fieldErrors[`schedules[${index}].quantity`]}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <input
                            value={row.note}
                            onChange={(event) => updateScheduleRow(row.key, { note: event.target.value })}
                            disabled={locked}
                            maxLength={200}
                            placeholder="Note"
                            className={cellInputCls}
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          <button
                            type="button"
                            onClick={() => removeScheduleRow(row.key)}
                            disabled={locked}
                            title="Remove schedule row"
                            className="w-6 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Charges & Notes</span>
            </div>
            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className={labelCls}>Freight Amount</label>
                  <input
                    value={freightAmount}
                    onChange={(event) => setFreightAmount(event.target.value)}
                    disabled={locked}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={numCls}
                  />
                  {fieldErrors.freightAmount && (
                    <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.freightAmount}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Packing Amount</label>
                  <input
                    value={packingAmount}
                    onChange={(event) => setPackingAmount(event.target.value)}
                    disabled={locked}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={numCls}
                  />
                  {fieldErrors.packingAmount && (
                    <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.packingAmount}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Other Charges</label>
                  <input
                    value={otherCharges}
                    onChange={(event) => setOtherCharges(event.target.value)}
                    disabled={locked}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={numCls}
                  />
                  {fieldErrors.otherCharges && (
                    <p className="mt-0.5 text-[10px] text-red-600 font-semibold">{fieldErrors.otherCharges}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Narration</label>
                  <input
                    value={narration}
                    onChange={(event) => setNarration(event.target.value)}
                    disabled={locked}
                    maxLength={500}
                    placeholder="Printed above the item table"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Internal Remarks</label>
                  <input
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    disabled={locked}
                    maxLength={500}
                    placeholder="Not printed"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Terms & Conditions</label>
                <textarea
                  value={termsAndConditions}
                  onChange={(event) => setTermsAndConditions(event.target.value)}
                  disabled={locked}
                  maxLength={2000}
                  rows={3}
                  placeholder="One condition per line — printed on the order document"
                  className={`${inputCls} h-auto py-1 resize-y`}
                />
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-2.5 xl:sticky xl:top-2">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Order Summary</span>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${statusTone(status)}`}>
                {ORDER_STATUS_LABELS[status] ?? status}
              </span>
            </div>

            <div className="p-3 space-y-1 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Total Quantity</span>
                <span className="font-mono font-bold text-slate-800">{qty(totals.totalQuantity)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Subtotal</span>
                <span className="font-mono text-slate-800">{money(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Discount</span>
                <span className="font-mono text-slate-800">-{money(totals.discountAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-1">
                <span className="text-slate-600 font-bold">Taxable Amount</span>
                <span className="font-mono font-bold text-slate-800">{money(totals.taxableAmount)}</span>
              </div>

              {taxType === 'INTRA_STATE' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">CGST</span>
                    <span className="font-mono text-slate-800">{money(totals.cgstAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">SGST</span>
                    <span className="font-mono text-slate-800">{money(totals.sgstAmount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">IGST</span>
                  <span className="font-mono text-slate-800">{money(totals.igstAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Freight</span>
                <span className="font-mono text-slate-800">{money(totals.freight)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Packing</span>
                <span className="font-mono text-slate-800">{money(totals.packing)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Other Charges</span>
                <span className="font-mono text-slate-800">{money(totals.other)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Round Off</span>
                <span className="font-mono text-slate-800">{money(totals.roundOffAmount)}</span>
              </div>
            </div>

            <div className="px-3 py-2 border-t-2 border-[#2c5f57] bg-[#2c5f57]/5 rounded-b-lg flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#2c5f57]">Grand Total</span>
              <span className="font-mono text-[15px] font-bold text-[#2c5f57]">₹ {money(totals.grandTotal)}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-2 space-y-1">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Amount in Words</p>
            <p className="text-[11px] font-semibold text-slate-700 leading-snug">
              {amountInWords(totals.grandTotal)}
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-2 text-[10px] text-slate-500 leading-relaxed space-y-1">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Shortcuts</p>
            <p>F10 Save · F5 Register · F2 Clear · F3 Party / Item · Esc Back</p>
            <p className="text-[9.5px] text-slate-400">
              This document posts no accounting entry and moves no stock. Totals are recomputed on the server with
              fixed-point decimals.
            </p>
          </div>
        </aside>
      </div>

      {partyPickerOpen && (
        <PickerModal
          title={`Select ${labels.partyLabel}`}
          placeholder={labels.partyPlaceholder}
          options={partyOptions}
          emptyMessage={`No ${labels.partyLabel.toLowerCase()} matches this search. Create it in the Party Master first.`}
          onSelect={selectParty}
          onClose={() => setPartyPickerOpen(false)}
        />
      )}

      {itemPickerIndex !== null && activeItemPicker !== null && (
        <PickerModal
          title={`Select Item — Line ${itemPickerIndex + 1}`}
          placeholder="Search item by name, code, HSN or description…"
          options={itemOptions}
          emptyMessage="No item matches this search. Create it in the Item Master first."
          onSelect={(itemId) => {
            const item = lookups.items.find((entry) => entry.id === itemId);
            if (item) applyItemToLine(itemPickerIndex, item);
          }}
          onClose={() => setItemPickerIndex(null)}
        />
      )}
    </div>
  );
};