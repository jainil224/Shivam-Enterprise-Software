// Phase 15 - Sales & Purchase Report (Bill Base) engine.
// Read-only: this service never writes a transaction record.
// Capability-driven: a format is only offered when its source fields genuinely exist.

import {
  reportRepository,
  PurchaseBillReportRecord,
  DebitNoteReportRecord,
} from '../repositories/reportRepository.js';
import { buildXlsx, XlsxColumn } from '../utils/xlsxWriter.js';
import { buildPdf, PdfColumn, PdfRow } from '../utils/pdfWriter.js';
import type {
  ReportColumnDef,
  ReportColumnFilter,
  ReportDetailMode,
  ReportFilterOperator,
  ReportFilterOperatorDef,
  ReportFilterOption,
  ReportFormatDef,
  ReportGroupSummary,
  ReportItemDetailsResponse,
  ReportItemLine,
  ReportMode,
  ReportOptionsResponse,
  ReportRateColumn,
  ReportRow,
  ReportRunRequest,
  ReportRunResponse,
  ReportSourceDef,
  ReportSourceSubtotal,
  ReportSourceType,
  ReportTotals,
  ReportUnitTotal,
} from '../types/reportTypes.js';

const STANDARD_COLUMNS = [
  'srNo', 'billDate', 'billNo', 'partyName', 'partyGstin', 'quantity', 'unit',
  'basicRate', 'taxableAmount', 'sgstAmount', 'cgstAmount', 'igstAmount', 'billAmount',
];

const COLUMNS: ReportColumnDef[] = [
  { key: 'srNo', label: 'Sr No', type: 'number', align: 'center', width: 6 },
  { key: 'billDate', label: 'Bill Date', type: 'date', align: 'center', width: 12 },
  { key: 'billNo', label: 'Bill No', type: 'text', align: 'left', width: 18 },
  { key: 'partyName', label: 'Party Name', type: 'text', align: 'left', width: 26 },
  { key: 'partyGstin', label: 'GST No', type: 'text', align: 'left', width: 18 },
  { key: 'partyCity', label: 'City', type: 'text', align: 'left', width: 14 },
  { key: 'partyState', label: 'State', type: 'text', align: 'left', width: 14 },
  { key: 'partyGroup', label: 'Party Group', type: 'text', align: 'left', width: 16 },
  { key: 'partyArea', label: 'Area', type: 'text', align: 'left', width: 14 },
  { key: 'deliveryParty', label: 'Delivery Party', type: 'text', align: 'left', width: 22 },
  { key: 'broker', label: 'Broker', type: 'text', align: 'left', width: 16 },
  { key: 'transporter', label: 'Transporter', type: 'text', align: 'left', width: 18 },
  { key: 'salesperson', label: 'Salesperson', type: 'text', align: 'left', width: 16 },
  { key: 'vehicle', label: 'Vehicle', type: 'text', align: 'left', width: 14 },
  { key: 'bookName', label: 'Book', type: 'text', align: 'left', width: 14 },
  { key: 'sourceType', label: 'Doc Type', type: 'text', align: 'left', width: 18 },
  { key: 'status', label: 'Status', type: 'text', align: 'center', width: 10 },
  { key: 'quality', label: 'Quality', type: 'text', align: 'left', width: 16 },
  { key: 'grade', label: 'Grade', type: 'text', align: 'left', width: 12 },
  { key: 'lotNumber', label: 'Lot', type: 'text', align: 'left', width: 14 },
  { key: 'itemGroup', label: 'Item Group', type: 'text', align: 'left', width: 16 },
  { key: 'itemDescription', label: 'Item Description', type: 'text', align: 'left', width: 32 },
  { key: 'itemCount', label: 'Items', type: 'number', align: 'right', width: 7 },
  { key: 'quantity', label: 'Quantity', type: 'number', align: 'right', width: 12 },
  { key: 'unit', label: 'Unit', type: 'text', align: 'center', width: 7 },
  { key: 'hsnCode', label: 'HSN/SAC', type: 'text', align: 'left', width: 10 },
  { key: 'taxRate', label: 'Tax %', type: 'number', align: 'right', width: 8 },
  { key: 'basicRate', label: 'Basic Rate', type: 'number', align: 'right', width: 12 },
  { key: 'avgRate', label: 'Average Rate', type: 'number', align: 'right', width: 12 },
  { key: 'netRate', label: 'Net Rate', type: 'number', align: 'right', width: 12 },
  { key: 'basicAmount', label: 'Basic Amount', type: 'currency', align: 'right', width: 14 },
  { key: 'discountAmount', label: 'Discount Amount', type: 'currency', align: 'right', width: 14 },
  { key: 'dueDays', label: 'Due Days', type: 'number', align: 'right', width: 8 },
  { key: 'taxableAmount', label: 'Taxable Amount', type: 'currency', align: 'right', width: 15 },
  { key: 'sgstAmount', label: 'SGST Amount', type: 'currency', align: 'right', width: 13 },
  { key: 'cgstAmount', label: 'CGST Amount', type: 'currency', align: 'right', width: 13 },
  { key: 'igstAmount', label: 'IGST Amount', type: 'currency', align: 'right', width: 13 },
  { key: 'roundOff', label: 'Round Off', type: 'currency', align: 'right', width: 11 },
  { key: 'billAmount', label: 'Bill Amount', type: 'currency', align: 'right', width: 15 },
  { key: 'month', label: 'Month', type: 'text', align: 'center', width: 10 },
  { key: 'purchaseSerial', label: 'Purchase Serial', type: 'text', align: 'left', width: 18 },
];

const SOURCES: ReportSourceDef[] = [
  { key: 'SALES', label: 'Sales', supported: false, reason: 'No Sales Invoice / Sales Bill model exists in this BMS.' },
  { key: 'PURCHASE', label: 'Purchase', supported: true, direction: 'PAYABLE' },
  { key: 'GENERAL_PURCHASE', label: 'General Purchase', supported: false, reason: 'General Purchase was removed in Phase 14. No model or table remains.' },
  { key: 'SALES_RETURN', label: 'Sales Return', supported: false, reason: 'No Sales Return model exists.' },
  { key: 'PURCHASE_RETURN', label: 'Purchase Return', supported: false, reason: 'No Purchase Return model exists.' },
  { key: 'SALES_DEBIT_NOTE', label: 'Sales Debit Note', supported: true, direction: 'RECEIVABLE_INCREASE' },
  { key: 'PURCHASE_DEBIT_NOTE', label: 'Purchase Debit Note', supported: true, direction: 'PAYABLE_REDUCTION' },
  { key: 'SALES_CREDIT_NOTE', label: 'Sales Credit Note', supported: false, reason: 'No Sales Credit Note model exists.' },
  { key: 'PURCHASE_CREDIT_NOTE', label: 'Purchase Credit Note', supported: false, reason: 'No Purchase Credit Note model exists.' },
];

const FORMATS: ReportFormatDef[] = [
  { key: 'BILL_NO_WISE', label: 'Bill No Wise', groupBy: [], support: 'FULL' },
  { key: 'DATE_WISE', label: 'Date Wise', groupBy: ['billDate'], support: 'FULL' },
  { key: 'PARTY_WISE', label: 'Party Wise', groupBy: ['partyName'], support: 'FULL' },
  { key: 'GROUP_PARTY_WISE', label: 'Group + Party Wise', groupBy: ['partyGroup', 'partyName'], support: 'FULL' },
  { key: 'QUALITY_WISE', label: 'Quality Wise', groupBy: ['quality'], support: 'FULL' },
  { key: 'PARTY_QUALITY_WISE', label: 'Party + Quality Wise', groupBy: ['partyName', 'quality'], support: 'FULL' },
  { key: 'BOOK_WISE', label: 'Book Wise', groupBy: ['bookName'], support: 'FULL' },
  { key: 'CITY_WISE', label: 'City Wise', groupBy: ['partyCity'], support: 'FULL' },
  { key: 'AREA_WISE', label: 'Area Wise', groupBy: ['partyArea'], support: 'FULL' },
  { key: 'BROKER_PARTY_WISE', label: 'Broker + Party Wise', groupBy: ['broker', 'partyName'], support: 'FULL' },
  { key: 'TRANSPORTER_WISE', label: 'Transporter Wise', groupBy: ['transporter'], support: 'FULL' },
  { key: 'MONTH_WISE', label: 'Month Wise', groupBy: ['month'], support: 'FULL' },
  { key: 'MONTH_WISE_ALL', label: 'Month Wise All Report', groupBy: ['month', 'sourceType'], support: 'FULL' },
  { key: 'MONTH_QUALITY_WISE', label: 'Month + Quality Wise', groupBy: ['month', 'quality'], support: 'FULL' },
  { key: 'QUALITY_MONTH_WISE', label: 'Quality + Month Wise', groupBy: ['quality', 'month'], support: 'FULL' },
  { key: 'SALESMAN_PARTY_WISE', label: 'Salesman + Party Wise', groupBy: ['salesperson', 'partyName'], support: 'FULL', note: 'Reference entry Q. Grouped by the Salesperson master assigned on the document header.' },
  { key: 'SALESMAN_PARTY_WISE_ALT', label: 'Salesman + Party Wise', groupBy: ['salesperson', 'partyName'], support: 'FULL', note: 'Reference entry R, preserved separately as required. The current data model stores one salesperson per document, so this entry uses the same Salesperson + Party grouping until a distinct business meaning is confirmed.' },
  { key: 'EXPENSE_WISE', label: 'Expense Wise', groupBy: ['expenseHead'], support: 'UNAVAILABLE', reason: 'No expense / General Purchase source exists after Phase 14.' },
  { key: 'VEHICLE_WISE', label: 'Vehicle Wise', groupBy: ['vehicle'], support: 'FULL' },
  { key: 'PURCHASE_SERIAL_WISE', label: 'Purchase Serial Wise', groupBy: ['purchaseSerial'], support: 'FULL', note: 'Grouped by the stored document number, which is the purchase serial of the bill.' },
];

const GROUPABLE_FIELDS = new Set([
  'billNo', 'billDate', 'partyName', 'quality', 'bookName', 'partyCity',
  'month', 'sourceType', 'purchaseSerial', 'itemGroup', 'partyGroup', 'partyArea',
  'broker', 'transporter', 'salesperson', 'vehicle', 'deliveryParty',
]);

// Phase 15.1 - operators exposed per column data type. A filter that uses an
// operator outside its column type is rejected, never silently ignored.
export const FILTER_OPERATORS: ReportFilterOperatorDef[] = [
  { value: 'contains', label: 'Contains', types: ['text'] },
  { value: 'equals', label: 'Equals', types: ['text', 'number', 'currency', 'date'] },
  { value: 'notEquals', label: 'Does not equal', types: ['text', 'number', 'currency'] },
  { value: 'gt', label: 'Greater than', types: ['number', 'currency'] },
  { value: 'gte', label: 'Greater than or equal', types: ['number', 'currency'] },
  { value: 'lt', label: 'Less than', types: ['number', 'currency'] },
  { value: 'lte', label: 'Less than or equal', types: ['number', 'currency'] },
  { value: 'between', label: 'Between', types: ['number', 'currency', 'date'] },
  { value: 'before', label: 'Before', types: ['date'] },
  { value: 'after', label: 'After', types: ['date'] },
  { value: 'empty', label: 'Is empty', types: ['text', 'number', 'currency', 'date'] },
  { value: 'notEmpty', label: 'Is not empty', types: ['text', 'number', 'currency', 'date'] },
];

// Columns a saved layout must never drop: the serial number anchors every
// printed and exported row.
export const REQUIRED_COLUMNS = ['srNo'];

// Sr No is assigned after filtering, so filtering on it would always be wrong.
const NON_FILTERABLE_COLUMNS = new Set(['srNo']);

const RATE_COLUMNS: Array<{ value: ReportRateColumn; label: string }> = [
  { value: 'BASIC', label: '1. Basic Rate' },
  { value: 'AVG', label: '2. Avg Rate' },
  { value: 'NET', label: '3. Net Rate' },
  { value: 'ALL', label: '4. All' },
];

const MODES: Array<{ value: ReportMode; label: string; available: boolean; reason?: string }> = [
  { value: 'SALES', label: '1. Sales', available: false, reason: 'No Sales Invoice module exists in this BMS.' },
  { value: 'PURCHASE', label: '2. Purchase', available: true },
  { value: 'EXPENSE', label: '3. Expense', available: false, reason: 'General Purchase / Expense module was removed in Phase 14.' },
  { value: 'SELECTED', label: '4. Selected', available: true },
];

const UNAVAILABLE_FILTERS = [
  { key: 'schedule', label: 'Schedule', reason: 'No schedule configuration model exists for purchase bills or debit notes, so a schedule filter has nothing to read.' },
  { key: 'wiseType', label: 'Wise Type', reason: 'No Wise Type configuration model exists in the schema.' },
  { key: 'attributes', label: 'Attrib 1/2/3', reason: 'Item Master has no custom attribute fields, so there is no stored value to filter.' },
  { key: 'quantityColumns', label: 'Quantity Columns', reason: 'Purchase bills store a single quantity and unit per line; no alternate quantity column set exists to choose from.' },
];

type ReportError = Error & { statusCode: number };

function badRequest(message: string): ReportError {
  const error = new Error(message) as ReportError;
  error.statusCode = 400;
  return error;
}

function num(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(label + ' must be a valid date in YYYY-MM-DD format.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime())) throw badRequest(label + ' is not a valid date.');
  return parsed;
}

function distinct(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

function aggregateUnits(entries: Array<{ unit: string; quantity: number }>): ReportUnitTotal[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const unit = (entry.unit || 'UNIT').toUpperCase();
    if (!Number.isFinite(entry.quantity)) continue;
    map.set(unit, round2((map.get(unit) ?? 0) + entry.quantity));
  }
  return Array.from(map.entries()).map(([unit, quantity]) => ({ unit, quantity }));
}

function singleQuantity(units: ReportUnitTotal[]): { quantity: number | null; unit: string } {
  if (units.length === 1) return { quantity: units[0].quantity, unit: units[0].unit };
  if (units.length > 1) return { quantity: null, unit: 'MIXED' };
  return { quantity: null, unit: '' };
}

function weightedRate(items: Array<{ rate: number; quantity: number }>, quantity: number | null): number | null {
  if (quantity === null || quantity <= 0) return null;
  const total = items.reduce((sum, item) => sum + item.rate * item.quantity, 0);
  return round2(total / quantity);
}

function emptyTotals(): ReportTotals {
  return {
    quantity: null, unitTotals: [], taxableAmount: 0, sgstAmount: 0, cgstAmount: 0,
    igstAmount: 0, roundOff: 0, billAmount: 0, documentCount: 0, itemCount: 0,
  };
}

function sumRows(rows: ReportRow[]): ReportTotals {
  const totals = emptyTotals();
  const unitMap = new Map<string, number>();
  let allQuantified = rows.length > 0;
  const unitsSeen = new Set<string>();

  for (const row of rows) {
    for (const unitTotal of row.unitTotals) {
      unitMap.set(unitTotal.unit, round2((unitMap.get(unitTotal.unit) ?? 0) + unitTotal.quantity));
    }
    if (row.quantity === null) allQuantified = false;
    else unitsSeen.add(row.unit);

    totals.taxableAmount = round2(totals.taxableAmount + row.taxableAmount);
    totals.sgstAmount = round2(totals.sgstAmount + row.sgstAmount);
    totals.cgstAmount = round2(totals.cgstAmount + row.cgstAmount);
    totals.igstAmount = round2(totals.igstAmount + row.igstAmount);
    totals.roundOff = round2(totals.roundOff + row.roundOff);
    totals.billAmount = round2(totals.billAmount + row.billAmount);
    totals.itemCount += row.itemCount;
  }

  totals.documentCount = rows.length;
  totals.unitTotals = Array.from(unitMap.entries()).map(([unit, quantity]) => ({ unit, quantity }));
  totals.quantity =
    allQuantified && unitsSeen.size === 1 && totals.unitTotals.length === 1 ? totals.unitTotals[0].quantity : null;
  return totals;
}

function groupLabel(row: ReportRow, field: string): string {
  const value = row.groupValues[field];
  return value && value.trim().length > 0 ? value : 'Not recorded';
}

function buildGroups(rows: ReportRow[], fields: string[], level = 0): ReportGroupSummary[] {
  if (level >= fields.length) return [];
  const field = fields[level];
  const buckets = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const label = groupLabel(row, field);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(row);
    else buckets.set(label, [row]);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, bucketRows]) => ({
      key: fields.slice(0, level + 1).join('|') + '|' + label,
      label,
      field,
      level,
      count: bucketRows.length,
      totals: sumRows(bucketRows),
      children: level + 1 < fields.length ? buildGroups(bucketRows, fields, level + 1) : undefined,
    }));
}

function buildValues(row: ReportRow): Record<string, string | number | null> {
  return {
    srNo: 0,
    billDate: row.documentDate,
    billNo: row.documentNo,
    partyName: row.partyName,
    partyGstin: row.partyGstin,
    partyCity: row.partyCity,
    partyState: row.partyState,
    partyGroup: row.partyGroup,
    partyArea: row.partyArea,
    deliveryParty: row.deliveryParty,
    broker: row.broker,
    transporter: row.transporter,
    salesperson: row.salesperson,
    vehicle: row.vehicle,
    dueDays: row.dueDays,
    bookName: row.bookName,
    sourceType: row.sourceLabel,
    status: row.status,
    quality: row.quality,
    grade: row.grade,
    lotNumber: row.lotNumber,
    itemGroup: row.itemGroup,
    itemDescription: row.itemDescription,
    itemCount: row.itemCount,
    quantity: row.quantity,
    unit: row.unit,
    hsnCode: row.hsnCode,
    taxRate: row.taxRate,
    basicRate: row.basicRate,
    avgRate: row.avgRate,
    netRate: row.netRate,
    basicAmount: row.basicAmount,
    discountAmount: row.discountAmount,
    taxableAmount: row.taxableAmount,
    sgstAmount: row.sgstAmount,
    cgstAmount: row.cgstAmount,
    igstAmount: row.igstAmount,
    roundOff: row.roundOff,
    billAmount: row.billAmount,
    month: row.monthKey,
    purchaseSerial: row.documentNo,
  };
}

function groupValuesFor(row: ReportRow): Record<string, string> {
  return {
    billNo: row.documentNo,
    billDate: row.documentDate,
    partyName: row.partyName,
    quality: row.quality,
    bookName: row.bookName,
    partyCity: row.partyCity,
    month: row.monthKey,
    sourceType: row.sourceLabel,
    purchaseSerial: row.documentNo,
    itemGroup: row.itemGroup,
    partyGroup: row.partyGroup,
    partyArea: row.partyArea,
    broker: row.broker,
    transporter: row.transporter,
    salesperson: row.salesperson,
    vehicle: row.vehicle,
    deliveryParty: row.deliveryParty,
  };
}

function mapPurchaseItemLines(bill: PurchaseBillReportRecord): ReportItemLine[] {
  return bill.items.map((item, index) => ({
    lineNumber: index + 1,
    itemName: item.item?.itemName ?? item.itemDescription,
    itemCode: item.item?.itemCode ?? '',
    quality: item.yarnQuality?.qualityName ?? '',
    grade: item.yarnGrade?.gradeName ?? item.grade ?? '',
    lotNumber: item.lotNumber ?? '',
    hsnCode: item.hsnCode ?? '',
    quantity: num(item.quantity),
    unit: item.unit ?? '',
    rate: num(item.rate),
    taxableAmount: num(item.taxableAmount),
  }));
}

function mapDebitNoteItemLines(note: DebitNoteReportRecord): ReportItemLine[] {
  return note.itemLines.map((line) => ({
    lineNumber: line.lineNumber,
    itemName: line.itemName,
    itemCode: line.itemCode ?? line.item?.itemCode ?? '',
    quality: line.yarnQuality ?? '',
    grade: line.yarnGrade ?? '',
    lotNumber: line.lotNumber ?? '',
    hsnCode: '',
    quantity: num(line.currentQuantity) > 0 ? num(line.currentQuantity) : num(line.originalQuantity),
    unit: line.unit ?? '',
    rate: num(line.originalRate),
    taxableAmount: num(line.taxableAmount),
  }));
}

function notFound(message: string): ReportError {
  const error = new Error(message) as ReportError;
  error.statusCode = 404;
  return error;
}

function rateOf(total: number, quantity: number | null): number | null {
  if (quantity === null || quantity <= 0) return null;
  return round2(total / quantity);
}

function debitNoteQuantity(line: DebitNoteReportRecord['itemLines'][number]): number {
  const current = num(line.currentQuantity);
  return current > 0 ? current : num(line.originalQuantity);
}

function buildPurchaseRow(bill: PurchaseBillReportRecord): ReportRow {
  const items = bill.items;
  const units = aggregateUnits(items.map((item) => ({ unit: item.unit, quantity: num(item.quantity) })));
  const quantity = singleQuantity(units);
  const grossValue = items.reduce((sum, item) => sum + num(item.quantity) * num(item.rate), 0);
  const taxableAmount = num(bill.taxableAmount);
  const billAmount = num(bill.totalAmount);
  const taxRate = num(bill.cgstRate) + num(bill.sgstRate) + num(bill.igstRate);
  const party = bill.party;

  const row: ReportRow = {
    key: 'PURCHASE:' + bill.id,
    sourceType: 'PURCHASE',
    sourceLabel: 'Purchase',
    sourceId: bill.id,
    documentNo: bill.billNumber,
    documentDate: toIsoDate(bill.billDate),
    partyId: bill.partyId ?? null,
    partyName: party?.partyName ?? bill.supplierLegalName,
    partyGstin: party?.gstin ?? bill.supplierGstin ?? '',
    partyCity: party?.city ?? bill.supplierCity ?? '',
    partyState: party?.state ?? bill.supplierState ?? '',
    partyGroupId: party?.partyGroupId ?? null,
    partyGroup: party?.partyGroup?.groupName ?? '',
    areaId: party?.areaId ?? null,
    partyArea: party?.area?.areaName ?? '',
    deliveryPartyId: bill.deliveryPartyId ?? null,
    deliveryParty: bill.deliveryParty?.partyName ?? '',
    brokerId: bill.brokerId ?? null,
    broker: bill.broker?.brokerName ?? '',
    transporterId: bill.transporterId ?? null,
    transporter: bill.transporter?.transporterName ?? '',
    salespersonId: bill.salespersonId ?? null,
    salesperson: bill.salesperson?.salespersonName ?? '',
    vehicle: bill.vehicleNumber ?? '',
    dueDays: null,
    bookId: bill.bookId ?? null,
    bookName: bill.book?.bookName ?? '',
    quality: distinct(items.map((item) => item.yarnQuality?.qualityName)).join(', '),
    grade: distinct(items.map((item) => item.yarnGrade?.gradeName ?? item.grade)).join(', '),
    lotNumber: distinct(items.map((item) => item.lotNumber)).join(', '),
    hsnCode: distinct(items.map((item) => item.hsnCode)).join(', '),
    itemGroup: distinct(items.map((item) => item.item?.itemGroup?.groupName ?? item.item?.itemCategory)).join(', '),
    itemDescription: distinct(items.map((item) => item.item?.itemName ?? item.itemDescription)).join('; '),
    quantity: quantity.quantity,
    unit: quantity.unit,
    unitTotals: units,
    taxRate: taxRate > 0 ? round2(taxRate) : null,
    basicRate: rateOf(grossValue, quantity.quantity),
    avgRate: rateOf(taxableAmount, quantity.quantity),
    netRate: rateOf(billAmount, quantity.quantity),
    basicAmount: round2(grossValue),
    discountAmount: round2(items.reduce((sum, item) => sum + num(item.discount), 0)),
    taxableAmount,
    sgstAmount: num(bill.sgstAmount),
    cgstAmount: num(bill.cgstAmount),
    igstAmount: num(bill.igstAmount),
    roundOff: num(bill.roundOff),
    billAmount,
    status: bill.status,
    itemCount: items.length,
    monthKey: toIsoDate(bill.billDate).slice(0, 7),
    itemLines: mapPurchaseItemLines(bill),
    groupValues: {},
    values: {},
  };

  row.groupValues = groupValuesFor(row);
  row.values = buildValues(row);
  return row;
}

function buildDebitNoteRow(note: DebitNoteReportRecord): ReportRow {
  const lines = note.itemLines;
  const units = aggregateUnits(lines.map((line) => ({ unit: line.unit, quantity: debitNoteQuantity(line) })));
  const quantity = singleQuantity(units);
  const grossValue = lines.reduce((sum, line) => sum + debitNoteQuantity(line) * num(line.originalRate), 0);
  const taxableAmount = num(note.taxableValue);
  const billAmount = num(note.totalAmount);
  const taxRate = num(note.cgstRate) + num(note.sgstRate) + num(note.igstRate);
  const isSales = note.noteType === 'SALES';

  const row: ReportRow = {
    key: (isSales ? 'SALES_DEBIT_NOTE:' : 'PURCHASE_DEBIT_NOTE:') + note.id,
    sourceType: isSales ? 'SALES_DEBIT_NOTE' : 'PURCHASE_DEBIT_NOTE',
    sourceLabel: isSales ? 'Sales Debit Note' : 'Purchase Debit Note',
    sourceId: note.id,
    documentNo: note.noteNumber,
    documentDate: toIsoDate(note.noteDate),
    partyId: note.partyId,
    partyName: note.party?.partyName ?? note.supplierName ?? '',
    partyGstin: note.party?.gstin ?? note.supplierGstin ?? '',
    partyCity: note.party?.city ?? '',
    partyState: note.party?.state ?? note.supplierState ?? '',
    partyGroupId: note.party?.partyGroupId ?? null,
    partyGroup: note.party?.partyGroup?.groupName ?? '',
    areaId: note.party?.areaId ?? null,
    partyArea: note.party?.area?.areaName ?? '',
    deliveryPartyId: null,
    deliveryParty: '',
    brokerId: note.brokerId ?? null,
    broker: note.broker?.brokerName ?? '',
    transporterId: note.transporterId ?? null,
    transporter: note.transporter?.transporterName ?? '',
    salespersonId: note.salespersonId ?? null,
    salesperson: note.salesperson?.salespersonName ?? '',
    vehicle: note.vehicleNumber ?? '',
    dueDays: note.dueDays ?? null,
    bookId: note.bookId,
    bookName: note.book?.bookName ?? '',
    quality: distinct(lines.map((line) => line.yarnQuality)).join(', '),
    grade: distinct(lines.map((line) => line.yarnGrade)).join(', '),
    lotNumber: distinct(lines.map((line) => line.lotNumber)).join(', '),
    hsnCode: '',
    itemGroup: distinct(lines.map((line) => line.item?.itemGroup?.groupName ?? line.item?.itemCategory)).join(', '),
    itemDescription: distinct(lines.map((line) => line.item?.itemName ?? line.itemName)).join('; '),
    quantity: quantity.quantity,
    unit: quantity.unit,
    unitTotals: units,
    taxRate: taxRate > 0 ? round2(taxRate) : null,
    basicRate: rateOf(grossValue, quantity.quantity),
    avgRate: rateOf(taxableAmount, quantity.quantity),
    netRate: rateOf(billAmount, quantity.quantity),
    basicAmount: round2(grossValue),
    discountAmount: 0,
    taxableAmount,
    sgstAmount: num(note.sgstAmount),
    cgstAmount: num(note.cgstAmount),
    igstAmount: num(note.igstAmount),
    roundOff: num(note.roundOff),
    billAmount,
    status: note.status,
    itemCount: lines.length,
    monthKey: toIsoDate(note.noteDate).slice(0, 7),
    itemLines: mapDebitNoteItemLines(note),
    groupValues: {},
    values: {},
  };

  row.groupValues = groupValuesFor(row);
  row.values = buildValues(row);
  return row;
}

const EXTRA_COLUMNS: Record<string, ReportColumnDef> = {
  documentCount: { key: 'documentCount', label: 'Bills', type: 'number', align: 'right', width: 8 },
};

function columnDef(key: string): ReportColumnDef {
  const found = COLUMNS.find((column) => column.key === key);
  if (found) return found;
  const extra = EXTRA_COLUMNS[key];
  if (extra) return extra;
  return { key, label: key, type: 'text', align: 'left', width: 14 };
}

function rowSortValue(row: ReportRow, key: string): string | number | null {
  if (Object.prototype.hasOwnProperty.call(row.groupValues, key)) {
    const grouped = row.groupValues[key];
    return grouped && grouped.length > 0 ? grouped : null;
  }
  const value = row.values[key];
  return value === undefined ? null : value;
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// Phase 15.1 - PDF cell formatting. Amounts are formatted the same way in the
// screen grid, XLSX and PDF so exported totals never disagree.
function formatAmount(value: number): string {
  return round2(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pdfCellValue(value: string | number | null | undefined, type: ReportColumnDef['type']): string {
  if (value === null || value === undefined) return '';
  if (type === 'currency') return formatAmount(num(value));
  return String(value);
}

function pdfTotalValue(key: string, totals: ReportTotals): string | null {
  switch (key) {
    case 'quantity':
      return totals.quantity === null ? null : String(totals.quantity);
    case 'itemCount':
      return String(totals.itemCount);
    case 'documentCount':
      return String(totals.documentCount);
    case 'taxableAmount':
      return formatAmount(totals.taxableAmount);
    case 'sgstAmount':
      return formatAmount(totals.sgstAmount);
    case 'cgstAmount':
      return formatAmount(totals.cgstAmount);
    case 'igstAmount':
      return formatAmount(totals.igstAmount);
    case 'roundOff':
      return formatAmount(totals.roundOff);
    case 'billAmount':
      return formatAmount(totals.billAmount);
    default:
      return null;
  }
}

export class ReportService {
  async getOptions(companyId: string, financialYearId: string): Promise<ReportOptionsResponse> {
    const [company, financialYear] = await Promise.all([
      reportRepository.getCompany(companyId),
      reportRepository.getFinancialYear(companyId, financialYearId),
    ]);

    if (!company) throw notFound('Company not found.');
    if (!financialYear) throw notFound('Financial year not found for this company.');

    const [
      books,
      parties,
      items,
      qualities,
      billItemDescriptions,
      partyGroups,
      areas,
      brokers,
      transporters,
      salespersons,
      vehicles,
      itemGroupOptions,
    ] = await Promise.all([
      reportRepository.getBooks(companyId, financialYearId),
      reportRepository.getParties(companyId),
      reportRepository.getItems(companyId),
      reportRepository.getYarnQualities(companyId),
      reportRepository.getPurchaseBillItemDescriptions(
        companyId,
        financialYearId,
        financialYear.startDate,
        financialYear.endDate
      ),
      reportRepository.getPartyGroups(companyId),
      reportRepository.getAreas(companyId),
      reportRepository.getBrokers(companyId),
      reportRepository.getTransporters(companyId),
      reportRepository.getSalespersons(companyId),
      reportRepository.getVehicleOptions(companyId, financialYearId),
      reportRepository.getItemGroupOptions(companyId),
    ]);

    const fyStart = toIsoDate(financialYear.startDate);
    const fyEnd = toIsoDate(financialYear.endDate);
    const todayIso = toIsoDate(new Date());
    const defaultDateTo = todayIso >= fyStart && todayIso <= fyEnd ? todayIso : fyEnd;

    // Phase 15.1 - the Item filter is built from real stored data: Item Master
    // names plus distinct descriptions actually saved on purchase bill lines.
    const masterNames = new Set(items.map((item) => item.itemName.trim().toLowerCase()));
    const itemOptions = [
      ...items.map((item) => ({
        value: item.itemName,
        label: item.itemName,
        meta: [item.itemCode, item.unit].filter((part) => Boolean(part)).join(' | '),
      })),
      ...billItemDescriptions
        .filter((description) => !masterNames.has(description.toLowerCase()))
        .map((description) => ({ value: description, label: description, meta: 'Purchase bill line' })),
    ].sort((a, b) => a.label.localeCompare(b.label));

    const itemFilterNote =
      itemOptions.length === 0
        ? 'No Item Master record and no purchase bill item description exists for this company yet, so the Item filter has nothing to match.'
        : items.length === 0
          ? 'Item values come from ' + billItemDescriptions.length + ' distinct description(s) actually stored on purchase bill lines. The Item Master is empty.'
          : billItemDescriptions.length === 0
            ? 'Item values come from the Item Master only: no purchase bill line has stored an item description yet.'
            : 'Item values come from ' + items.length + ' Item Master record(s) plus ' + billItemDescriptions.length + ' distinct description(s) stored on purchase bill lines.';

    return {
      company: {
        id: company.id,
        name: company.companyName,
        gstin: company.gstin ?? '',
        address: company.address ?? '',
        city: company.city ?? '',
        state: company.state ?? '',
        phone: company.phone ?? '',
      },
      financialYear: {
        id: financialYear.id,
        yearName: financialYear.yearName,
        startDate: fyStart,
        endDate: fyEnd,
      },
      defaultDateFrom: fyStart,
      defaultDateTo,
      formats: FORMATS,
      sources: SOURCES,
      books: books.map((book) => ({
        value: book.id,
        label: book.bookName,
        meta: [book.prefix, book.bookType].filter((part) => Boolean(part)).join(' | '),
      })),
      parties: parties.map((party) => ({
        value: party.id,
        label: party.partyName,
        meta: [party.partyCode, party.partyType, party.city].filter((part) => Boolean(part)).join(' | '),
        partyGroupId: party.partyGroupId,
        areaId: party.areaId,
      })),
      partyGroups: partyGroups.map((group) => ({ value: group.id, label: group.groupName })),
      areas: areas.map((area) => ({ value: area.id, label: area.areaName })),
      brokers: brokers.map((broker) => ({
        value: broker.id,
        label: broker.brokerName,
        meta: broker.brokerCode,
      })),
      transporters: transporters.map((transporter) => ({
        value: transporter.id,
        label: transporter.transporterName,
        meta: transporter.transporterCode,
      })),
      salespersons: salespersons.map((salesperson) => ({
        value: salesperson.id,
        label: salesperson.salespersonName,
        meta: salesperson.salespersonCode,
      })),
      vehicles: vehicles.map((vehicle) => ({ value: vehicle, label: vehicle })),
      items: itemOptions,
      itemFilter: {
        masterItemCount: items.length,
        billItemCount: billItemDescriptions.length,
        note: itemFilterNote,
      },
      itemGroups: itemGroupOptions,
      cities: distinct(parties.map((party) => party.city)).map((value) => ({ value, label: value })),
      qualities: qualities.map((quality) => ({ value: quality.qualityName, label: quality.qualityName })),
      unavailableFilters: UNAVAILABLE_FILTERS,
      filterOperators: FILTER_OPERATORS,
      requiredColumns: REQUIRED_COLUMNS,
      columns: COLUMNS,
      standardColumns: STANDARD_COLUMNS,
      rateColumns: RATE_COLUMNS,
      detailModes: [
        { value: 'DETAIL', label: '1. Detail' },
        { value: 'SUMMARY', label: '2. Summary' },
      ],
      modes: MODES,
    };
  }

  resolveSources(mode: ReportMode, sources?: ReportSourceType[]): ReportSourceType[] {
    if (mode === 'PURCHASE') return ['PURCHASE'];
    if (mode === 'SALES') {
      const def = SOURCES.find((source) => source.key === 'SALES');
      throw badRequest('Sales is not available: ' + (def?.reason ?? 'no sales invoice model exists.'));
    }
    if (mode === 'EXPENSE') {
      const def = SOURCES.find((source) => source.key === 'GENERAL_PURCHASE');
      throw badRequest('Expense is not available: ' + (def?.reason ?? 'no expense module exists.'));
    }
    if (mode !== 'SELECTED') throw badRequest('Unknown sales/purchase mode: ' + String(mode) + '.');

    const requested = Array.isArray(sources) ? sources : [];
    if (requested.length === 0) throw badRequest('Select at least one document source.');

    const result: ReportSourceType[] = [];
    const seen = new Set<ReportSourceType>();
    for (const key of requested) {
      const def = SOURCES.find((source) => source.key === key);
      if (!def) throw badRequest('Unknown document source: ' + String(key) + '.');
      if (!def.supported) throw badRequest(def.label + ' is not available: ' + (def.reason ?? 'not implemented.'));
      if (seen.has(def.key)) continue;
      seen.add(def.key);
      result.push(def.key);
    }
    return result;
  }

  noteTypesFor(sources: ReportSourceType[]): Array<'SALES' | 'PURCHASE' | 'BOTH'> {
    const noteTypes: Array<'SALES' | 'PURCHASE' | 'BOTH'> = [];
    if (sources.includes('SALES_DEBIT_NOTE')) noteTypes.push('SALES');
    if (sources.includes('PURCHASE_DEBIT_NOTE')) {
      noteTypes.push('PURCHASE');
      noteTypes.push('BOTH');
    }
    return noteTypes;
  }

  resolveFormat(format: string): ReportFormatDef {
    const def = FORMATS.find((entry) => entry.key === format);
    if (!def) throw badRequest('Unknown report format: ' + String(format) + '.');
    if (def.support === 'UNAVAILABLE') {
      throw badRequest(def.label + ' is not available: ' + (def.reason ?? 'the required source fields do not exist.'));
    }
    return def;
  }

  resolveGroupBy(format: ReportFormatDef, groupBy?: string[]): string[] {
    if (!Array.isArray(groupBy) || groupBy.length === 0) return format.groupBy;
    const result: string[] = [];
    for (const field of groupBy) {
      if (!GROUPABLE_FIELDS.has(field)) throw badRequest('Field "' + String(field) + '" cannot be used to group this report.');
      if (!result.includes(field)) result.push(field);
    }
    return result;
  }

  validateRateFilter(request: ReportRunRequest): void {
    const from = request.rateFrom === undefined ? null : request.rateFrom;
    const to = request.rateTo === undefined ? null : request.rateTo;
    if (from !== null && !Number.isFinite(from)) throw badRequest('Rate From must be a number.');
    if (to !== null && !Number.isFinite(to)) throw badRequest('Rate To must be a number.');
    if (from !== null && to !== null && from > to) throw badRequest('Rate From cannot be greater than Rate To.');
  }

  resolveColumns(columns: string[] | undefined, rateColumn: ReportRateColumn): ReportColumnDef[] {
    const byKey = new Map(COLUMNS.map((column) => [column.key, column] as const));
    const requested =
      Array.isArray(columns) && columns.length > 0
        ? columns.filter((key) => byKey.has(key))
        : STANDARD_COLUMNS.slice();

    const rateKeys =
      rateColumn === 'ALL'
        ? ['basicRate', 'avgRate', 'netRate']
        : rateColumn === 'AVG'
          ? ['avgRate']
          : rateColumn === 'NET'
            ? ['netRate']
            : ['basicRate'];
    const rateKeySet = new Set(['basicRate', 'avgRate', 'netRate']);

    // Phase 15.2 - the column selector lets the user move columns up and down
    // and a saved layout stores that order, so the caller order is preserved
    // here instead of being re-sorted into catalogue order.
    const ordered: string[] = [];
    let rateInserted = false;
    for (const key of requested) {
      if (rateKeySet.has(key)) {
        if (!rateInserted) {
          for (const rateKey of rateKeys) ordered.push(rateKey);
          rateInserted = true;
        }
        continue;
      }
      if (!ordered.includes(key)) ordered.push(key);
    }
    if (!rateInserted) {
      for (const rateKey of rateKeys) ordered.push(rateKey);
    }
    if (!ordered.includes('srNo')) ordered.unshift('srNo');

    return ordered
      .map((key) => byKey.get(key))
      .filter((column): column is ReportColumnDef => Boolean(column));
  }

  applyFilters(rows: ReportRow[], request: ReportRunRequest, rateColumn: ReportRateColumn): ReportRow[] {
    let result = rows;

    if (request.partyId) {
      const partyId = request.partyId;
      result = result.filter((row) => row.partyId === partyId);
    }
    if (request.bookId) {
      const bookId = request.bookId;
      result = result.filter((row) => row.bookId === bookId);
    }
    if (request.partyGroupId) {
      const partyGroupId = request.partyGroupId;
      result = result.filter((row) => row.partyGroupId === partyGroupId);
    }
    if (request.areaId) {
      const areaId = request.areaId;
      result = result.filter((row) => row.areaId === areaId);
    }
    if (request.deliveryPartyId) {
      const deliveryPartyId = request.deliveryPartyId;
      result = result.filter((row) => row.deliveryPartyId === deliveryPartyId);
    }
    if (request.brokerId) {
      const brokerId = request.brokerId;
      result = result.filter((row) => row.brokerId === brokerId);
    }
    if (request.transporterId) {
      const transporterId = request.transporterId;
      result = result.filter((row) => row.transporterId === transporterId);
    }
    if (request.salespersonId) {
      const salespersonId = request.salespersonId;
      result = result.filter((row) => row.salespersonId === salespersonId);
    }
    if (request.vehicle) {
      const vehicle = request.vehicle.trim().toUpperCase();
      result = result.filter((row) => (row.vehicle || '').trim().toUpperCase() === vehicle);
    }
    if (request.partyCity) {
      const city = request.partyCity.trim().toLowerCase();
      result = result.filter((row) => (row.partyCity || '').trim().toLowerCase() === city);
    }
    if (request.quality) {
      const quality = request.quality.trim().toLowerCase();
      result = result.filter((row) =>
        (row.quality || '')
          .split(',')
          .map((part) => part.trim().toLowerCase())
          .includes(quality)
      );
    }
    if (request.itemGroup) {
      const group = request.itemGroup.trim().toLowerCase();
      result = result.filter((row) =>
        (row.itemGroup || '')
          .split(',')
          .map((part) => part.trim().toLowerCase())
          .includes(group)
      );
    }
    if (request.itemId) {
      const itemName = request.itemId.trim().toLowerCase();
      result = result.filter((row) =>
        row.itemLines.some((line) => (line.itemName || '').trim().toLowerCase() === itemName)
      );
    }

    const rateKey = rateColumn === 'AVG' ? 'avgRate' : rateColumn === 'NET' ? 'netRate' : 'basicRate';
    const rateFrom = request.rateFrom === undefined ? null : request.rateFrom;
    const rateTo = request.rateTo === undefined ? null : request.rateTo;
    if (rateFrom !== null || rateTo !== null) {
      result = result.filter((row) => {
        const value = row[rateKey];
        if (value === null) return false;
        if (rateFrom !== null && value < rateFrom) return false;
        if (rateTo !== null && value > rateTo) return false;
        return true;
      });
    }

    return result;
  }

  sortRows(
    rows: ReportRow[],
    sortBy: string | null,
    sortDir: 'asc' | 'desc',
    format: ReportFormatDef
  ): ReportRow[] {
    const direction = sortDir === 'desc' ? -1 : 1;
    const requested = sortBy && sortBy.trim().length > 0 ? sortBy.trim() : null;
    const primary = requested ? [requested] : format.groupBy.length > 0 ? format.groupBy : [];

    return rows.slice().sort((a, b) => {
      for (const key of primary) {
        const comparison = compareSortValues(rowSortValue(a, key), rowSortValue(b, key));
        if (comparison !== 0) return comparison * direction;
      }
      const byDate = a.documentDate.localeCompare(b.documentDate);
      if (byDate !== 0) return byDate * direction;
      return a.documentNo.localeCompare(b.documentNo) * direction;
    });
  }

  buildTotals(rows: ReportRow[], sources: ReportSourceType[]): ReportRunResponse['totals'] {
    const bySource: ReportSourceSubtotal[] = [];
    for (const sourceType of sources) {
      const def = SOURCES.find((source) => source.key === sourceType);
      const sourceRows = rows.filter((row) => row.sourceType === sourceType);
      if (sourceRows.length === 0 && sources.length > 1) continue;
      bySource.push({
        ...sumRows(sourceRows),
        sourceType,
        sourceLabel: def?.label ?? sourceType,
        direction: def?.direction ?? 'UNKNOWN',
      });
    }

    const directions = new Set(bySource.map((entry) => entry.direction));
    const grandTotalAllowed = bySource.length > 0 && directions.size === 1 && !directions.has('UNKNOWN');
    const grandTotal = grandTotalAllowed ? round2(bySource.reduce((sum, entry) => sum + entry.billAmount, 0)) : null;

    let grandTotalReason: string;
    if (bySource.length === 0) {
      grandTotalReason = 'No rows matched the selected filters, so there is no total to show.';
    } else if (grandTotalAllowed) {
      grandTotalReason =
        'Every selected source has the same accounting direction (' +
        Array.from(directions)[0] +
        '), so the amounts can be added safely.';
    } else {
      grandTotalReason =
        'Selected sources have different accounting directions (' +
        Array.from(directions).join(', ') +
        '). Adding them would misstate the ledger effect, so only per-source subtotals are shown.';
    }

    return {
      bySource,
      grandTotal,
      grandTotalAllowed,
      grandTotalReason,
      all: sumRows(rows),
    };
  }

  buildSummary(rows: ReportRow[], groupBy: string[]): { rows: ReportRow[]; columns: ReportColumnDef[] } {
    if (groupBy.length === 0) {
      const keys = [
        'srNo', 'billDate', 'billNo', 'partyName', 'partyGstin', 'sourceType', 'status',
        'itemCount', 'quantity', 'unit', 'taxableAmount', 'sgstAmount', 'cgstAmount',
        'igstAmount', 'roundOff', 'billAmount',
      ];
      return {
        rows: rows.map((row) => ({ ...row, itemLines: [] })),
        columns: keys.map((key) => columnDef(key)),
      };
    }

    const buckets = new Map<string, { labels: string[]; rows: ReportRow[] }>();
    for (const row of rows) {
      const labels = groupBy.map((field) => groupLabel(row, field));
      const key = labels.join('\u0001');
      const bucket = buckets.get(key);
      if (bucket) bucket.rows.push(row);
      else buckets.set(key, { labels, rows: [row] });
    }

    const ordered = Array.from(buckets.values()).sort((a, b) =>
      a.labels.join('\u0001').localeCompare(b.labels.join('\u0001'))
    );
    const summaryRows = ordered.map((bucket, index) => this.buildSummaryRow(bucket.labels, groupBy, bucket.rows, index));

    const columns: ReportColumnDef[] = [
      columnDef('srNo'),
      ...groupBy.map((field) => columnDef(field)),
      columnDef('documentCount'),
      columnDef('itemCount'),
      columnDef('quantity'),
      columnDef('unit'),
      columnDef('taxableAmount'),
      columnDef('sgstAmount'),
      columnDef('cgstAmount'),
      columnDef('igstAmount'),
      columnDef('roundOff'),
      columnDef('billAmount'),
    ];

    return { rows: summaryRows, columns };
  }

  buildSummaryRow(labels: string[], fields: string[], groupRows: ReportRow[], index: number): ReportRow {
    const totals = sumRows(groupRows);
    const first = groupRows[0];
    const pick = (field: string): string => {
      const at = fields.indexOf(field);
      return at >= 0 ? labels[at] : '';
    };
    const unit =
      totals.unitTotals.length === 1 ? totals.unitTotals[0].unit : totals.unitTotals.length > 1 ? 'MIXED' : '';

    const groupValues: Record<string, string> = {};
    fields.forEach((field, position) => {
      groupValues[field] = labels[position];
    });

    const row: ReportRow = {
      key: 'SUMMARY|' + fields.join('|') + '|' + labels.join('|'),
      sourceType: first.sourceType,
      sourceLabel: pick('sourceType') || first.sourceLabel,
      sourceId: '',
      documentNo: pick('billNo') || pick('purchaseSerial'),
      documentDate: pick('billDate'),
      partyId: null,
      partyName: pick('partyName'),
      partyGstin: '',
      partyCity: pick('partyCity'),
      partyState: '',
      partyGroupId: null,
      partyGroup: pick('partyGroup'),
      areaId: null,
      partyArea: pick('partyArea'),
      deliveryPartyId: null,
      deliveryParty: pick('deliveryParty'),
      brokerId: null,
      broker: pick('broker'),
      transporterId: null,
      transporter: pick('transporter'),
      salespersonId: null,
      salesperson: pick('salesperson'),
      vehicle: pick('vehicle'),
      dueDays: null,
      bookId: null,
      bookName: pick('bookName'),
      quality: pick('quality'),
      grade: pick('grade'),
      lotNumber: pick('lotNumber'),
      hsnCode: '',
      itemGroup: pick('itemGroup'),
      itemDescription: '',
      quantity: totals.quantity,
      unit,
      unitTotals: totals.unitTotals,
      taxRate: null,
      basicRate: null,
      avgRate: null,
      netRate: null,
      basicAmount: totals.taxableAmount,
      discountAmount: 0,
      taxableAmount: totals.taxableAmount,
      sgstAmount: totals.sgstAmount,
      cgstAmount: totals.cgstAmount,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      billAmount: totals.billAmount,
      status: '',
      itemCount: totals.itemCount,
      monthKey: pick('month'),
      itemLines: [],
      groupValues,
      values: {},
    };

    row.values = {
      srNo: index + 1,
      billDate: pick('billDate'),
      billNo: pick('billNo') || pick('purchaseSerial'),
      partyName: pick('partyName'),
      partyGstin: '',
      partyCity: pick('partyCity'),
      partyState: '',
      partyGroup: pick('partyGroup'),
      partyArea: pick('partyArea'),
      deliveryParty: pick('deliveryParty'),
      broker: pick('broker'),
      transporter: pick('transporter'),
      salesperson: pick('salesperson'),
      vehicle: pick('vehicle'),
      dueDays: null,
      bookName: pick('bookName'),
      sourceType: pick('sourceType') || first.sourceLabel,
      status: '',
      quality: pick('quality'),
      grade: pick('grade'),
      lotNumber: pick('lotNumber'),
      itemGroup: pick('itemGroup'),
      itemDescription: '',
      itemCount: totals.itemCount,
      documentCount: totals.documentCount,
      quantity: totals.quantity,
      unit,
      hsnCode: '',
      taxRate: null,
      basicRate: null,
      avgRate: null,
      netRate: null,
      basicAmount: totals.taxableAmount,
      discountAmount: 0,
      taxableAmount: totals.taxableAmount,
      sgstAmount: totals.sgstAmount,
      cgstAmount: totals.cgstAmount,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      billAmount: totals.billAmount,
      month: pick('month'),
      purchaseSerial: pick('purchaseSerial'),
    };

    return row;
  }

  async execute(
    companyId: string,
    financialYearId: string,
    request: ReportRunRequest,
    includeAllRows = false
  ): Promise<ReportRunResponse> {
    const financialYear = await reportRepository.getFinancialYear(companyId, financialYearId);
    if (!financialYear) throw notFound('Financial year not found for this company.');

    const dateFrom = parseIsoDate(request.dateFrom, 'Date From');
    const dateTo = parseIsoDate(request.dateTo, 'Date To');
    if (dateFrom.getTime() > dateTo.getTime()) throw badRequest('Date From cannot be after Date To.');

    const fyStart = toIsoDate(financialYear.startDate);
    const fyEnd = toIsoDate(financialYear.endDate);
    if (toIsoDate(dateFrom) < fyStart || toIsoDate(dateTo) > fyEnd) {
      throw badRequest(
        'Date range must stay inside financial year ' +
          financialYear.yearName +
          ' (' +
          fyStart +
          ' to ' +
          fyEnd +
          ').'
      );
    }

    const sources = this.resolveSources(request.mode, request.sources);
    const format = this.resolveFormat(request.format);
    const groupBy = this.resolveGroupBy(format, request.groupBy);
    const rateColumn: ReportRateColumn = request.rateColumn ?? 'BASIC';
    const detailMode: ReportDetailMode = request.detailMode === 'SUMMARY' ? 'SUMMARY' : 'DETAIL';
    this.validateRateFilter(request);

    const includeCancelled = request.includeCancelled === true;
    const noteTypes = this.noteTypesFor(sources);

    const [bills, notes] = await Promise.all([
      sources.includes('PURCHASE')
        ? reportRepository.getPurchaseBills(
            companyId,
            financialYearId,
            dateFrom,
            dateTo,
            includeCancelled,
            null
          )
        : Promise.resolve([] as PurchaseBillReportRecord[]),
      noteTypes.length > 0
        ? reportRepository.getDebitNotes(
            companyId,
            financialYearId,
            dateFrom,
            dateTo,
            noteTypes,
            includeCancelled,
            null
          )
        : Promise.resolve([] as DebitNoteReportRecord[]),
    ]);

    const collected: ReportRow[] = [];
    for (const bill of bills) collected.push(buildPurchaseRow(bill));
    for (const note of notes) collected.push(buildDebitNoteRow(note));

    const filtered = this.applyFilters(collected, request, rateColumn);
    // Column filters run over the complete filtered dataset, before grouping,
    // sorting, totals and pagination, so every total is dataset-wide.
    const columnFilters = this.validateColumnFilters(request.columnFilters);
    const columnFiltered = this.applyColumnFilters(filtered, columnFilters);
    const sorted = this.sortRows(columnFiltered, request.sortBy ?? null, request.sortDir === 'desc' ? 'desc' : 'asc', format);
    sorted.forEach((row, index) => {
      row.values.srNo = index + 1;
    });

    const totals = this.buildTotals(sorted, sources);
    const groups = groupBy.length > 0 ? buildGroups(sorted, groupBy) : [];

    let columns: ReportColumnDef[];
    let rows: ReportRow[];
    if (detailMode === 'SUMMARY') {
      const summary = this.buildSummary(sorted, groupBy);
      columns = summary.columns;
      rows = summary.rows;
    } else {
      columns = this.resolveColumns(request.columns, rateColumn);
      rows = sorted;
    }

    const page = Math.max(1, Math.floor(Number(request.page ?? 1)) || 1);
    const pageSize = Math.min(500, Math.max(1, Math.floor(Number(request.pageSize ?? 100)) || 100));
    const total = rows.length;
    const visible = includeAllRows ? rows : rows.slice((page - 1) * pageSize, page * pageSize);

    const warnings: string[] = [];
    if (format.support === 'PARTIAL' && format.reason) {
      warnings.push(format.label + ': ' + format.reason);
    }
    for (const sourceType of sources) {
      if (totals.bySource.some((entry) => entry.sourceType === sourceType)) continue;
      const def = SOURCES.find((source) => source.key === sourceType);
      warnings.push('No ' + (def?.label ?? sourceType) + ' documents matched the selected dates and filters.');
    }
    if (!includeCancelled) {
      warnings.push('Cancelled documents are excluded. Set Include Cancelled to include them.');
    }
    // Phase 15.2 - a book filter can now match purchase bills as well as debit notes,
    // so the explanation states the real condition instead of blaming the source type.
    if (request.bookId && total === 0) {
      warnings.push('Book filter: no document in the selected dates carries the selected book.');
    }

    const company = await reportRepository.getCompany(companyId);
    const modeLabel = MODES.find((mode) => mode.value === request.mode)?.label ?? request.mode;
    const detailLabel = detailMode === 'DETAIL' ? 'Detail' : 'Summary';
    const sourceLabels = sources.map((sourceType) => SOURCES.find((source) => source.key === sourceType)?.label ?? sourceType);

    return {
      meta: {
        reportTitle: format.label + ' ' + modeLabel + ' ' + detailLabel,
        reportName: format.label,
        formatLabel: format.label,
        mode: request.mode,
        modeLabel,
        detailMode,
        companyName: company?.companyName ?? '',
        dateFrom: toIsoDate(dateFrom),
        dateTo: toIsoDate(dateTo),
        financialYear: financialYear.yearName,
        sourceLabels,
        printItemDetails: request.printItemDetails === true,
        rateColumn,
        columnFilters,
        activeFilters: this.describeColumnFilters(columnFilters),
      },
      columns,
      rows: visible,
      groups,
      groupBy,
      totals,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      rowCount: total,
      warnings,
      unavailable: null,
    };
  }

  async getItemDetails(companyId: string, sourceType: string, sourceId: string): Promise<ReportItemDetailsResponse> {
    const id = (sourceId ?? '').trim();
    if (id.length === 0) throw badRequest('A document id is required.');

    if (sourceType === 'PURCHASE') {
      const bill = await reportRepository.getPurchaseBillById(companyId, id);
      if (!bill) throw notFound('Purchase bill not found.');
      return {
        sourceType: 'PURCHASE',
        sourceId: bill.id,
        documentNo: bill.billNumber,
        documentDate: toIsoDate(bill.billDate),
        itemLines: mapPurchaseItemLines(bill),
      };
    }

    if (sourceType === 'SALES_DEBIT_NOTE' || sourceType === 'PURCHASE_DEBIT_NOTE') {
      const note = await reportRepository.getDebitNoteById(companyId, id);
      if (!note) throw notFound('Debit note not found.');
      return {
        sourceType: note.noteType === 'SALES' ? 'SALES_DEBIT_NOTE' : 'PURCHASE_DEBIT_NOTE',
        sourceId: note.id,
        documentNo: note.noteNumber,
        documentDate: toIsoDate(note.noteDate),
        itemLines: mapDebitNoteItemLines(note),
      };
    }

    throw badRequest('Item details are not available for source type ' + String(sourceType) + '.');
  }

  // ---------------------------------------------------------------
  // Phase 15.1 - dataset-wide column filters
  // ---------------------------------------------------------------

  validateColumnFilters(filters: ReportColumnFilter[] | undefined | null): ReportColumnFilter[] {
    if (filters === undefined || filters === null) return [];
    if (!Array.isArray(filters)) throw badRequest('Column filters must be an array.');
    const result: ReportColumnFilter[] = [];
    for (const raw of filters) {
      if (!raw || typeof raw !== 'object') throw badRequest('Each column filter must be an object.');
      const key = String(raw.key ?? '').trim();
      const column = COLUMNS.find((entry) => entry.key === key);
      if (!column) throw badRequest('Column "' + key + '" is not a filterable report column.');
      if (NON_FILTERABLE_COLUMNS.has(key)) {
        throw badRequest(
          'Column "' + column.label + '" cannot be filtered because its value is assigned after filtering.'
        );
      }
      const operator = String(raw.operator ?? '').trim() as ReportFilterOperator;
      const def = FILTER_OPERATORS.find((entry) => entry.value === operator);
      if (!def) throw badRequest('Unknown column filter operator: ' + String(raw.operator) + '.');
      if (!def.types.includes(column.type)) {
        throw badRequest(
          'Operator "' + def.label + '" is not valid for a ' + column.type + ' column (' + column.label + ').'
        );
      }
      const value = raw.value === undefined || raw.value === null ? null : String(raw.value).trim();
      const valueTo = raw.valueTo === undefined || raw.valueTo === null ? null : String(raw.valueTo).trim();
      const needsValue = operator !== 'empty' && operator !== 'notEmpty';
      if (needsValue && (value === null || value.length === 0)) {
        throw badRequest('A value is required for "' + def.label + '" on column "' + column.label + '".');
      }
      if (operator === 'between' && (valueTo === null || valueTo.length === 0)) {
        throw badRequest('A second value is required for "Between" on column "' + column.label + '".');
      }
      if (column.type === 'number' || column.type === 'currency') {
        if (needsValue && !Number.isFinite(Number(value))) {
          throw badRequest('Column "' + column.label + '" expects a numeric filter value.');
        }
        if (operator === 'between' && !Number.isFinite(Number(valueTo))) {
          throw badRequest('Column "' + column.label + '" expects a numeric upper value.');
        }
        if (operator === 'between' && Number(value) > Number(valueTo)) {
          throw badRequest('Column "' + column.label + '": the lower value cannot be greater than the upper value.');
        }
      }
      if (column.type === 'date') {
        if (needsValue) this.assertFilterDate(String(value), column.label);
        if (operator === 'between') this.assertFilterDate(String(valueTo), column.label);
        if (operator === 'between' && String(value) > String(valueTo)) {
          throw badRequest('Column "' + column.label + '": the From date cannot be after the To date.');
        }
      }
      result.push({
        key,
        operator,
        value: needsValue ? value : null,
        valueTo: operator === 'between' ? valueTo : null,
      });
    }
    return result;
  }

  assertFilterDate(value: string, label: string): void {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + 'T00:00:00.000Z').getTime());
    if (!valid) throw badRequest('Column "' + label + '" expects a date in YYYY-MM-DD format.');
  }

  applyColumnFilters(rows: ReportRow[], filters: ReportColumnFilter[]): ReportRow[] {
    if (filters.length === 0) return rows;
    return rows.filter((row) => filters.every((filter) => this.matchesColumnFilter(row, filter)));
  }

  matchesColumnFilter(row: ReportRow, filter: ReportColumnFilter): boolean {
    const column = COLUMNS.find((entry) => entry.key === filter.key);
    if (!column) return false;
    const raw = row.values[filter.key];
    const text = raw === null || raw === undefined ? '' : String(raw).trim();
    const isEmpty = text.length === 0;
    if (filter.operator === 'empty') return isEmpty;
    if (filter.operator === 'notEmpty') return !isEmpty;

    if (column.type === 'number' || column.type === 'currency') {
      if (isEmpty) return false;
      const actual = Number(raw);
      if (!Number.isFinite(actual)) return false;
      const value = Number(filter.value);
      const valueTo = Number(filter.valueTo);
      switch (filter.operator) {
        case 'equals':
          return actual === value;
        case 'notEquals':
          return actual !== value;
        case 'gt':
          return actual > value;
        case 'gte':
          return actual >= value;
        case 'lt':
          return actual < value;
        case 'lte':
          return actual <= value;
        case 'between':
          return actual >= value && actual <= valueTo;
        default:
          return false;
      }
    }

    if (column.type === 'date') {
      if (isEmpty) return false;
      const actual = text.slice(0, 10);
      const value = String(filter.value ?? '');
      const valueTo = String(filter.valueTo ?? '');
      switch (filter.operator) {
        case 'equals':
          return actual === value;
        case 'before':
          return actual < value;
        case 'after':
          return actual > value;
        case 'between':
          return actual >= value && actual <= valueTo;
        default:
          return false;
      }
    }

    const needle = String(filter.value ?? '').toLowerCase();
    const haystack = text.toLowerCase();
    switch (filter.operator) {
      case 'contains':
        return haystack.includes(needle);
      case 'equals':
        return haystack === needle;
      case 'notEquals':
        return haystack !== needle;
      default:
        return false;
    }
  }

  describeColumnFilters(filters: ReportColumnFilter[]): string[] {
    return filters.map((filter) => {
      const column = COLUMNS.find((entry) => entry.key === filter.key);
      const label = column?.label ?? filter.key;
      const def = FILTER_OPERATORS.find((entry) => entry.value === filter.operator);
      const opLabel = (def?.label ?? filter.operator).toLowerCase();
      if (filter.operator === 'empty' || filter.operator === 'notEmpty') return label + ': ' + opLabel;
      if (filter.operator === 'between') {
        return label + ' ' + opLabel + ' ' + String(filter.value) + ' and ' + String(filter.valueTo);
      }
      return label + ' ' + opLabel + ' "' + String(filter.value) + '"';
    });
  }

  // ---------------------------------------------------------------
  // Phase 15.1 - genuine multi-page PDF export
  // ---------------------------------------------------------------

  buildPdfRows(response: ReportRunResponse): PdfRow[] {
    const columns = response.columns;
    const blank = (): string[] => columns.map(() => '');
    const dataCells = (row: ReportRow): string[] =>
      columns.map((column) => pdfCellValue(row.values[column.key], column.type));
    const detailCells = (item: ReportItemLine): string[] =>
      columns.map((column) => {
        switch (column.key) {
          case 'itemDescription':
            return '  - ' + item.itemName;
          case 'quantity':
            return String(item.quantity);
          case 'unit':
            return item.unit;
          case 'hsnCode':
            return item.hsnCode;
          case 'basicRate':
            return pdfCellValue(item.rate, column.type);
          case 'taxableAmount':
            return pdfCellValue(item.taxableAmount, column.type);
          case 'quality':
            return item.quality;
          default:
            return '';
        }
      });
    const totalCells = (label: string, totals: ReportTotals): string[] =>
      columns.map((column, index) => {
        if (index === 0) return label;
        const value = pdfTotalValue(column.key, totals);
        return value === null ? '' : value;
      });

    const rows: PdfRow[] = [];
    const showItems = response.meta.printItemDetails === true;

    if (response.groupBy.length === 0) {
      for (const row of response.rows) {
        rows.push({ cells: dataCells(row), kind: 'data' });
        if (showItems) {
          for (const item of row.itemLines) rows.push({ cells: detailCells(item), kind: 'detail' });
        }
      }
    } else {
      const walk = (groups: ReportGroupSummary[], path: Array<{ field: string; label: string }>): void => {
        for (const group of groups) {
          const nextPath = path.concat([{ field: group.field, label: group.label }]);
          const groupCells = blank();
          groupCells[0] = group.label + ' (' + group.count + ')';
          rows.push({ cells: groupCells, kind: 'group' });
          if (group.children && group.children.length > 0) {
            walk(group.children, nextPath);
          } else {
            for (const row of response.rows) {
              const matches = nextPath.every((entry) => groupLabel(row, entry.field) === entry.label);
              if (!matches) continue;
              rows.push({ cells: dataCells(row), kind: 'detail' });
              if (showItems) {
                for (const item of row.itemLines) rows.push({ cells: detailCells(item), kind: 'detail' });
              }
            }
          }
          rows.push({ cells: totalCells('Subtotal - ' + group.label, group.totals), kind: 'subtotal' });
        }
      };
      walk(response.groups, []);
    }

    const totalsLabel = response.totals.grandTotalAllowed ? 'GRAND TOTAL' : 'TOTAL (all sources)';
    rows.push({ cells: totalCells(totalsLabel, response.totals.all), kind: 'total' });
    return rows;
  }

  async exportPdf(
    companyId: string,
    financialYearId: string,
    request: ReportRunRequest
  ): Promise<{ buffer: Buffer; filename: string }> {
    const response = await this.execute(companyId, financialYearId, request, true);
    const [company, parties, books, partyGroups, areas, brokers, transporters, salespersons] =
      await Promise.all([
        reportRepository.getCompany(companyId),
        reportRepository.getParties(companyId),
        reportRepository.getBooks(companyId, financialYearId),
        reportRepository.getPartyGroups(companyId),
        reportRepository.getAreas(companyId),
        reportRepository.getBrokers(companyId),
        reportRepository.getTransporters(companyId),
        reportRepository.getSalespersons(companyId),
      ]);

    const partyLabel = request.partyId
      ? parties.find((party) => party.id === request.partyId)?.partyName
      : null;
    const deliveryPartyLabel = request.deliveryPartyId
      ? parties.find((party) => party.id === request.deliveryPartyId)?.partyName
      : null;
    const bookLabel = request.bookId ? books.find((book) => book.id === request.bookId)?.bookName : null;
    const partyGroupLabel = request.partyGroupId
      ? partyGroups.find((group) => group.id === request.partyGroupId)?.groupName
      : null;
    const areaLabel = request.areaId ? areas.find((area) => area.id === request.areaId)?.areaName : null;
    const brokerLabel = request.brokerId
      ? brokers.find((broker) => broker.id === request.brokerId)?.brokerName
      : null;
    const transporterLabel = request.transporterId
      ? transporters.find((transporter) => transporter.id === request.transporterId)?.transporterName
      : null;
    const salespersonLabel = request.salespersonId
      ? salespersons.find((person) => person.id === request.salespersonId)?.salespersonName
      : null;

    // Phase 15.2 - the printed filter summary must list every applied master
    // filter, otherwise the printed report cannot be reconciled with the screen.
    const filters: string[] = [];
    if (partyLabel) filters.push('Party: ' + partyLabel);
    if (partyGroupLabel) filters.push('Party Group: ' + partyGroupLabel);
    if (areaLabel) filters.push('Area: ' + areaLabel);
    if (deliveryPartyLabel) filters.push('Delivery Party: ' + deliveryPartyLabel);
    if (bookLabel) filters.push('Book: ' + bookLabel);
    if (brokerLabel) filters.push('Broker: ' + brokerLabel);
    if (transporterLabel) filters.push('Transporter: ' + transporterLabel);
    if (salespersonLabel) filters.push('Salesperson: ' + salespersonLabel);
    if (request.vehicle) filters.push('Vehicle: ' + request.vehicle);
    if (request.partyCity) filters.push('City: ' + request.partyCity);
    if (request.quality) filters.push('Quality: ' + request.quality);
    if (request.itemGroup) filters.push('Item Group: ' + request.itemGroup);
    if (request.itemId) filters.push('Item: ' + request.itemId);
    if (request.rateFrom !== undefined && request.rateFrom !== null) filters.push('Rate from: ' + request.rateFrom);
    if (request.rateTo !== undefined && request.rateTo !== null) filters.push('Rate to: ' + request.rateTo);
    filters.push('Sources: ' + response.meta.sourceLabels.join(', '));
    filters.push('Rate column: ' + response.meta.rateColumn);
    if (response.groupBy.length > 0) {
      filters.push('Grouping: ' + response.groupBy.map((field) => columnDef(field).label).join(' > '));
    }
    filters.push('Cancelled documents: ' + (request.includeCancelled === true ? 'included' : 'excluded'));
    for (const label of response.meta.activeFilters) filters.push('Column filter - ' + label);

    const companyAddress = [company?.address, company?.city, company?.state, company?.pincode]
      .filter((part) => Boolean(part))
      .join(', ');

    const columns: PdfColumn[] = response.columns.map((column) => ({
      key: column.key,
      label: column.label,
      weight: column.width,
      align: column.align,
    }));

    const result = buildPdf({
      orientation: request.pdfOrientation === 'landscape' ? 'landscape' : 'portrait',
      header: {
        companyName: response.meta.companyName,
        companyAddress,
        companyGstin: company?.gstin ?? '',
        financialYear: response.meta.financialYear,
        reportTitle: response.meta.reportTitle,
        reportType:
          response.meta.modeLabel + ' - ' + (response.meta.detailMode === 'DETAIL' ? 'Detail' : 'Summary'),
        dateRange: response.meta.dateFrom + ' to ' + response.meta.dateTo,
        filters,
      },
      columns,
      rows: this.buildPdfRows(response),
    });

    return { buffer: result.buffer, filename: this.buildPdfFilename(response) };
  }

  buildPdfFilename(response: ReportRunResponse): string {
    const safe =
      response.meta.reportName
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'Bill-Base';
    return safe + '_' + response.meta.dateFrom + '_to_' + response.meta.dateTo + '.pdf';
  }

  exportXlsx(response: ReportRunResponse): { buffer: Buffer; filename: string } {
    const columns: XlsxColumn[] = response.columns.map((column) => ({
      key: column.key,
      label: column.label,
      type: column.type,
      width: column.width,
    }));

    const rows: Array<Array<string | number | null>> = response.rows.map((row) =>
      response.columns.map((column) => {
        const value = row.values[column.key];
        return value === undefined ? null : value;
      })
    );

    if (rows.length > 0) {
      const totalsRow: Array<string | number | null> = response.columns.map((column, index) => {
        if (index === 0) return 'TOTAL';
        switch (column.key) {
          case 'quantity':
            return response.totals.all.quantity;
          case 'taxableAmount':
            return response.totals.all.taxableAmount;
          case 'sgstAmount':
            return response.totals.all.sgstAmount;
          case 'cgstAmount':
            return response.totals.all.cgstAmount;
          case 'igstAmount':
            return response.totals.all.igstAmount;
          case 'roundOff':
            return response.totals.all.roundOff;
          case 'billAmount':
            return response.totals.all.billAmount;
          case 'itemCount':
            return response.totals.all.itemCount;
          case 'documentCount':
            return response.totals.all.documentCount;
          default:
            return null;
        }
      });
      rows.push(totalsRow);
    }

    const buffer = buildXlsx({ sheetName: 'Bill Base', columns, rows });
    return { buffer, filename: this.buildFilename(response) };
  }

  buildFilename(response: ReportRunResponse): string {
    const safe =
      response.meta.reportName
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'Bill-Base';
    return safe + '_' + response.meta.dateFrom + '_to_' + response.meta.dateTo + '.xlsx';
  }

  async run(companyId: string, financialYearId: string, request: ReportRunRequest): Promise<ReportRunResponse> {
    return this.execute(companyId, financialYearId, request);
  }
}

export const reportService = new ReportService();
export const REPORT_FORMATS = FORMATS;
export const REPORT_SOURCES = SOURCES;
export const REPORT_COLUMNS = COLUMNS;
