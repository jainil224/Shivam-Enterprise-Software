// Phase 19.3 - server-side document PDF builder for WhatsApp delivery.
//
// This is a NEW layout module. It does not modify any existing PDF generator
// (report bill base, bank book, ledger, account-wise balance, reconciliation)
// and it does not render HTML. It reuses the single existing PDF engine in
// utils/pdfWriter.ts (buildStatementPdf) so the ERP keeps exactly one renderer.

import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../utils/appError.js';
import { formatIndianMoney } from '../../utils/money.js';
import { toDisplayDate } from '../../utils/ledgerPosting.js';
import {
  buildStatementPdf,
  type StatementBlock,
  type StatementCell,
  type StatementHeaderInfo,
} from '../../utils/pdfWriter.js';
import { reportService } from '../reportService.js';
import { bankBookService } from '../bankBookService.js';
import { accountLedgerService } from '../accountLedgerService.js';
import { accountWiseBalanceService } from '../accountWiseBalanceService.js';
import { bankReconciliationService } from '../bankReconciliationService.js';
import {
  WHATSAPP_DOCUMENT_LABELS,
  type WhatsAppDocumentType,
} from '../../types/whatsapp.js';

export interface DocumentPdfScope {
  companyId: string;
  financialYearId: string;
}

export interface BuiltDocumentPdf {
  documentType: WhatsAppDocumentType;
  documentId: string;
  documentNumber: string;
  partyId: string | null;
  partyName: string | null;
  fileName: string;
  buffer: Buffer;
}

function money(value: unknown): string {
  return formatIndianMoney(value as never);
}

function qty(value: unknown): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : '0.000';
}

function rate(value: unknown): string {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00';
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function safeFileName(base: string): string {
  const cleaned = base
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned.length > 0 ? cleaned : 'document') + '.pdf';
}

function addressLine(company: {
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}): string {
  return [company.address, company.city, company.state, company.pincode]
    .map((part) => text(part))
    .filter((part) => part.length > 0)
    .join(', ');
}

function infoRow(cells: Array<[string, string]>): StatementBlock {
  const statementCells: StatementCell[] = [];
  for (const [label, value] of cells) {
    statementCells.push({ text: label, weight: 1.15, align: 'left', bold: true });
    statementCells.push({ text: value.length > 0 ? value : '-', weight: 2.35, align: 'left' });
  }
  return { type: 'row', cells: statementCells };
}

interface LetterheadScope {
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  companyPan: string;
  companyPhone: string;
  companyEmail: string;
  financialYear: string;
}

async function loadLetterhead(scope: DocumentPdfScope): Promise<LetterheadScope> {
  const [company, financialYear] = await Promise.all([
    prisma.company.findFirst({ where: { id: scope.companyId } }),
    prisma.financialYear.findFirst({
      where: { id: scope.financialYearId, companyId: scope.companyId },
    }),
  ]);
  if (!company) {
    throw new AppError(404, 'Company not found for the active session.', undefined, 'NOT_FOUND');
  }
  if (!financialYear) {
    throw new AppError(
      404,
      'Financial year not found for the active company.',
      undefined,
      'NOT_FOUND'
    );
  }
  return {
    companyName: company.companyName,
    companyAddress: addressLine(company),
    companyGstin: text(company.gstin),
    companyPan: text(company.panNumber),
    companyPhone: text(company.phone),
    companyEmail: text(company.email),
    financialYear: financialYear.yearName,
  };
}

function buildHeader(
  letterhead: LetterheadScope,
  title: string,
  reference: string,
  dateText: string
): StatementHeaderInfo {
  return {
    companyName: letterhead.companyName,
    companyAddress: letterhead.companyAddress,
    companyGstin: letterhead.companyGstin,
    companyPan: letterhead.companyPan || undefined,
    companyPhone: letterhead.companyPhone || undefined,
    companyEmail: letterhead.companyEmail || undefined,
    financialYear: letterhead.financialYear,
    title,
    ledgerName: reference,
    period: dateText,
  };
}

function render(
  letterhead: LetterheadScope,
  title: string,
  reference: string,
  dateText: string,
  blocks: StatementBlock[],
  orientation: 'portrait' | 'landscape' = 'portrait'
): Buffer {
  const pdf = buildStatementPdf({
    orientation,
    headerMode: 'letterhead',
    header: buildHeader(letterhead, title, reference, dateText),
    blocks,
  });
  return pdf.buffer;
}

/* ------------------------------------------------------------------ */
/* Bank Receipt / Bank Payment                                        */
/* ------------------------------------------------------------------ */

async function resolveBankVoucher(
  scope: DocumentPdfScope,
  documentId: string,
  documentType: 'BANK_RECEIPT' | 'BANK_PAYMENT'
): Promise<BuiltDocumentPdf> {
  const voucherType = documentType === 'BANK_RECEIPT' ? 'RECEIPT' : 'PAYMENT';
  const voucher = await prisma.bankVoucher.findFirst({
    where: { id: documentId, companyId: scope.companyId, financialYearId: scope.financialYearId },
    include: {
      party: true,
      counterpartyLedger: true,
      bankAccountLedger: true,
    },
  });
  if (!voucher) {
    throw new AppError(
      404,
      WHATSAPP_DOCUMENT_LABELS[documentType] + ' not found for the active company and financial year.',
      undefined,
      'DOCUMENT_NOT_FOUND'
    );
  }

  const letterhead = await loadLetterhead(scope);
  const isReceipt = voucherType === 'RECEIPT';
  const bankName =
    text(voucher.bankAccountLedger.bankName) || text(voucher.bankAccountLedger.accountName);
  const bankLine = [bankName, text(voucher.branchName)].filter((part) => part.length > 0).join(' · ');
  const reference =
    voucher.paymentMode === 'CHEQUE'
      ? 'Cheque ' + text(voucher.chequeNumber) + (voucher.chequeDate ? ' dated ' + toDisplayDate(voucher.chequeDate) : '')
      : text(voucher.referenceNumber);

  // A receipt debits the bank and credits the counterparty; a payment is the
  // mirror image. This matches the existing print preview exactly.
  const bankRef = {
    name: text(voucher.bankAccountLedger.accountName),
    code: text(voucher.bankAccountLedger.accountCode),
  };
  const counterpartyRef = {
    name: text(voucher.counterpartyLedger.accountName),
    code: text(voucher.counterpartyLedger.accountCode),
  };
  const debitRef = isReceipt ? bankRef : counterpartyRef;
  const creditRef = isReceipt ? counterpartyRef : bankRef;

  const blocks: StatementBlock[] = [
    infoRow([
      ['Voucher No.', text(voucher.voucherNumber)],
      ['Date', toDisplayDate(voucher.voucherDate)],
    ]),
    infoRow([
      [isReceipt ? 'Received From' : 'Paid To', text(voucher.counterpartyLedger.accountName)],
      ['Payment Mode', text(voucher.paymentMode)],
    ]),
    infoRow([
      ['Bank Account', bankLine],
      [voucher.paymentMode === 'CHEQUE' ? 'Cheque' : 'Reference', reference],
    ]),
    { type: 'spacer', height: 4 },
    {
      type: 'table',
      columns: [
        { text: 'Account / Particulars', weight: 4, align: 'left' },
        { text: 'Account Code', weight: 2, align: 'left' },
        { text: 'Debit', weight: 2, align: 'right' },
        { text: 'Credit', weight: 2, align: 'right' },
      ],
      rows: [
        [debitRef.name, debitRef.code, money(voucher.amount), ''],
        ['To ' + creditRef.name, creditRef.code, '', money(voucher.amount)],
      ],
      totalRow: [
        { text: 'Total', weight: 4, align: 'left', bold: true },
        { text: '', weight: 2, align: 'left' },
        { text: money(voucher.amount), weight: 2, align: 'right', bold: true },
        { text: money(voucher.amount), weight: 2, align: 'right', bold: true },
      ],
    },
    { type: 'spacer', height: 6 },
    infoRow([
      ['Narration', text(voucher.narration)],
      ['Remarks', text(voucher.remarks)],
    ]),
  ];

  if (voucher.status === 'CANCELLED') {
    blocks.push({
      type: 'note',
      text:
        'CANCELLED - ' +
        (text(voucher.cancellationReason) || 'cancelled voucher') +
        ' (posting reversed)',
      bold: true,
    });
  }

  const buffer = render(
    letterhead,
    isReceipt ? 'BANK RECEIPT VOUCHER' : 'BANK PAYMENT VOUCHER',
    text(voucher.voucherNumber),
    'Date: ' + toDisplayDate(voucher.voucherDate),
    blocks
  );

  return {
    documentType,
    documentId: voucher.id,
    documentNumber: text(voucher.voucherNumber),
    partyId: voucher.partyId,
    partyName: voucher.party ? text(voucher.party.partyName) : null,
    fileName: safeFileName(
      (isReceipt ? 'Bank_Receipt_' : 'Bank_Payment_') + text(voucher.voucherNumber)
    ),
    buffer,
  };
}
/* ------------------------------------------------------------------ */
/* Purchase Bill                                                      */
/* ------------------------------------------------------------------ */

async function resolvePurchaseBill(
  scope: DocumentPdfScope,
  documentId: string
): Promise<BuiltDocumentPdf> {
  const bill = await prisma.purchaseBill.findFirst({
    where: { id: documentId, companyId: scope.companyId, financialYearId: scope.financialYearId },
    include: {
      party: true,
      items: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!bill) {
    throw new AppError(
      404,
      'Purchase Bill not found for the active company and financial year.',
      undefined,
      'DOCUMENT_NOT_FOUND'
    );
  }

  const letterhead = await loadLetterhead(scope);
  const supplierName = text(bill.supplierLegalName) || (bill.party ? text(bill.party.partyName) : '');
  const supplierAddress = [text(bill.supplierAddress), text(bill.supplierCity), text(bill.supplierState)]
    .filter((part) => part.length > 0)
    .join(', ');

  const itemRows = bill.items.map((item, index) => [
    String(index + 1),
    text(item.itemDescription),
    text(item.hsnCode),
    qty(item.quantity),
    text(item.unit),
    rate(item.rate),
    money(item.taxableAmount),
  ]);

  const blocks: StatementBlock[] = [
    infoRow([
      ['Bill No.', text(bill.billNumber)],
      ['Bill Date', toDisplayDate(bill.billDate)],
    ]),
    infoRow([
      ['Supplier', supplierName],
      ['GSTIN', text(bill.supplierGstin)],
    ]),
    infoRow([
      ['Supplier Address', supplierAddress],
      ['Place of Supply', text(bill.placeOfSupply)],
    ]),
    infoRow([
      ['Supplier Invoice', text(bill.supplierInvoiceNumber)],
      ['Invoice Date', bill.supplierInvoiceDate ? toDisplayDate(bill.supplierInvoiceDate) : ''],
    ]),
    infoRow([
      ['Party', bill.party ? text(bill.party.partyName) : ''],
      ['Party Code', bill.party ? text(bill.party.partyCode) : ''],
    ]),
    { type: 'spacer', height: 4 },
    {
      type: 'table',
      columns: [
        { text: 'Sr.', weight: 0.8, align: 'center' },
        { text: 'Item Description', weight: 4.2, align: 'left' },
        { text: 'HSN', weight: 1.4, align: 'left' },
        { text: 'Qty', weight: 1.4, align: 'right' },
        { text: 'Unit', weight: 1, align: 'left' },
        { text: 'Rate', weight: 1.4, align: 'right' },
        { text: 'Taxable', weight: 1.8, align: 'right' },
      ],
      rows: itemRows,
      emptyText: 'No items recorded on this bill.',
      totalRow: [
        { text: 'Total', weight: 5, align: 'left', bold: true },
        { text: qty(bill.totalQuantity), weight: 2.4, align: 'right', bold: true },
        { text: '', weight: 1, align: 'left' },
        { text: '', weight: 1.4, align: 'right' },
        { text: money(bill.taxableAmount), weight: 1.8, align: 'right', bold: true },
      ],
    },
    { type: 'spacer', height: 6 },
    infoRow([
      ['Taxable Amount', money(bill.taxableAmount)],
      ['CGST', rate(bill.cgstRate) + '% · ' + money(bill.cgstAmount)],
    ]),
    infoRow([
      ['SGST', rate(bill.sgstRate) + '% · ' + money(bill.sgstAmount)],
      ['IGST', rate(bill.igstRate) + '% · ' + money(bill.igstAmount)],
    ]),
    infoRow([
      ['Round Off', money(bill.roundOff)],
      ['Total Amount', money(bill.totalAmount)],
    ]),
    infoRow([
      ['Status', text(bill.status)],
      ['Remarks', text(bill.remarks)],
    ]),
  ];

  const buffer = render(
    letterhead,
    'PURCHASE BILL',
    text(bill.billNumber),
    'Bill Date: ' + toDisplayDate(bill.billDate),
    blocks
  );

  return {
    documentType: 'PURCHASE_BILL',
    documentId: bill.id,
    documentNumber: text(bill.billNumber),
    partyId: bill.partyId,
    partyName: bill.party ? text(bill.party.partyName) : supplierName || null,
    fileName: safeFileName('Purchase_Bill_' + text(bill.billNumber)),
    buffer,
  };
}

/* ------------------------------------------------------------------ */
/* Debit Note                                                         */
/* ------------------------------------------------------------------ */

async function resolveDebitNote(
  scope: DocumentPdfScope,
  documentId: string
): Promise<BuiltDocumentPdf> {
  const note = await prisma.debitNote.findFirst({
    where: { id: documentId, companyId: scope.companyId, financialYearId: scope.financialYearId },
    include: {
      party: true,
      itemLines: { orderBy: { lineNumber: 'asc' } },
    },
  });
  if (!note) {
    throw new AppError(
      404,
      'Debit Note not found for the active company and financial year.',
      undefined,
      'DOCUMENT_NOT_FOUND'
    );
  }

  const letterhead = await loadLetterhead(scope);
  const lineRows = note.itemLines.map((line) => [
    String(line.lineNumber),
    text(line.itemName),
    text(line.lotNumber),
    qty(line.currentQuantity),
    text(line.unit),
    rate(line.revisedRate ?? line.originalRate),
    money(line.taxableAmount),
    money(line.lineTotal),
  ]);

  const blocks: StatementBlock[] = [
    infoRow([
      ['Note No.', text(note.noteNumber)],
      ['Note Date', toDisplayDate(note.noteDate)],
    ]),
    infoRow([
      ['Party', text(note.party.partyName)],
      ['Party Code', text(note.party.partyCode)],
    ]),
    infoRow([
      ['Note Type', text(note.noteType)],
      ['Reason', text(note.reason)],
    ]),
    infoRow([
      ['Original Invoice', text(note.originalInvoiceNumber)],
      ['Invoice Date', note.originalInvoiceDate ? toDisplayDate(note.originalInvoiceDate) : ''],
    ]),
    infoRow([
      ['GST Status', text(note.gstStatus)],
      ['Status', text(note.status)],
    ]),
    { type: 'spacer', height: 4 },
    {
      type: 'table',
      columns: [
        { text: 'Sr.', weight: 0.8, align: 'center' },
        { text: 'Item', weight: 3.6, align: 'left' },
        { text: 'Lot', weight: 1.6, align: 'left' },
        { text: 'Qty', weight: 1.4, align: 'right' },
        { text: 'Unit', weight: 1, align: 'left' },
        { text: 'Rate', weight: 1.4, align: 'right' },
        { text: 'Taxable', weight: 1.8, align: 'right' },
        { text: 'Line Total', weight: 1.8, align: 'right' },
      ],
      rows: lineRows,
      emptyText: 'No item lines recorded on this note.',
      totalRow: [
        { text: 'Total', weight: 4.4, align: 'left', bold: true },
        { text: qty(note.totalQuantity), weight: 1.4, align: 'right', bold: true },
        { text: '', weight: 1, align: 'left' },
        { text: '', weight: 1.4, align: 'right' },
        { text: money(note.taxableValue), weight: 1.8, align: 'right', bold: true },
        { text: money(note.totalAmount), weight: 1.8, align: 'right', bold: true },
      ],
    },
    { type: 'spacer', height: 6 },
    infoRow([
      ['Basic Amount', money(note.basicAmount)],
      ['Taxable Value', money(note.taxableValue)],
    ]),
    infoRow([
      ['CGST', rate(note.cgstRate) + '% · ' + money(note.cgstAmount)],
      ['SGST', rate(note.sgstRate) + '% · ' + money(note.sgstAmount)],
    ]),
    infoRow([
      ['IGST', rate(note.igstRate) + '% · ' + money(note.igstAmount)],
      ['TCS', money(note.tcsAmount)],
    ]),
    infoRow([
      ['Round Off', money(note.roundOff)],
      ['Total Amount', money(note.totalAmount)],
    ]),
    infoRow([
      ['Remark', text(note.remark)],
      ['Cancellation', text(note.cancellationReason)],
    ]),
  ];

  const buffer = render(
    letterhead,
    'DEBIT NOTE',
    text(note.noteNumber),
    'Note Date: ' + toDisplayDate(note.noteDate),
    blocks
  );

  return {
    documentType: 'DEBIT_NOTE',
    documentId: note.id,
    documentNumber: text(note.noteNumber),
    partyId: note.partyId,
    partyName: text(note.party.partyName),
    fileName: safeFileName('Debit_Note_' + text(note.noteNumber)),
    buffer,
  };
}
/* ------------------------------------------------------------------ */
/* Production Challan                                                 */
/* ------------------------------------------------------------------ */

async function resolveProductionChallan(
  scope: DocumentPdfScope,
  documentId: string
): Promise<BuiltDocumentPdf> {
  const challan = await prisma.productionReceive.findFirst({
    where: { id: documentId, companyId: scope.companyId, financialYearId: scope.financialYearId },
    include: {
      party: true,
      machine: true,
      operator: true,
      yarnQuality: true,
      yarnGrade: true,
      location: true,
      productionBook: true,
      items: { orderBy: { cartonNumber: 'asc' } },
    },
  });
  if (!challan) {
    throw new AppError(
      404,
      'Production Challan not found for the active company and financial year.',
      undefined,
      'DOCUMENT_NOT_FOUND'
    );
  }

  const letterhead = await loadLetterhead(scope);
  const totals = challan.items.reduce(
    (acc, item) => {
      acc.cartonWeight += Number(item.cartonWeight);
      acc.cops += item.cops;
      acc.grossWeight += Number(item.grossWeight);
      acc.copsWeight += Number(item.copsWeight);
      acc.tareWeight += Number(item.tareWeight);
      acc.netWeight += Number(item.netWeight);
      return acc;
    },
    { cartonWeight: 0, cops: 0, grossWeight: 0, copsWeight: 0, tareWeight: 0, netWeight: 0 }
  );

  const itemRows = challan.items.map((item) => [
    text(item.cartonNumber),
    qty(item.cartonWeight),
    String(item.cops),
    qty(item.grossWeight),
    qty(item.copsWeight),
    qty(item.tareWeight),
    qty(item.netWeight),
    text(item.twist),
    text(item.lotNumber),
  ]);

  const blocks: StatementBlock[] = [
    infoRow([
      ['Challan No.', text(challan.challanNumber)],
      ['Challan Date', toDisplayDate(challan.challanDate)],
    ]),
    infoRow([
      ['Party', challan.party ? text(challan.party.partyName) : ''],
      ['Party Code', challan.party ? text(challan.party.partyCode) : ''],
    ]),
    infoRow([
      ['Production Book', text(challan.productionBook.bookName)],
      ['Machine', text(challan.machine?.machineCode)],
    ]),
    infoRow([
      ['Operator', text(challan.operator?.operatorName)],
      ['Location', text(challan.location?.locationName)],
    ]),
    infoRow([
      ['Yarn Quality', text(challan.yarnQuality?.qualityName)],
      ['Yarn Grade', text(challan.yarnGrade?.gradeName)],
    ]),
    infoRow([
      ['Lot No.', text(challan.lotNumber)],
      ['Empty Cops Weight', qty(challan.emptyCopsWeight)],
    ]),
    { type: 'spacer', height: 4 },
    {
      type: 'table',
      columns: [
        { text: 'Carton No', weight: 1.6, align: 'left' },
        { text: 'Carton Wt', weight: 1.4, align: 'right' },
        { text: 'Cops', weight: 0.9, align: 'right' },
        { text: 'Gross', weight: 1.3, align: 'right' },
        { text: 'Cops Wt', weight: 1.3, align: 'right' },
        { text: 'Tare Wt', weight: 1.3, align: 'right' },
        { text: 'Net Wt', weight: 1.3, align: 'right' },
        { text: 'Twist', weight: 1.1, align: 'left' },
        { text: 'Lot No', weight: 1.4, align: 'left' },
      ],
      rows: itemRows,
      emptyText: 'No cartons recorded on this challan.',
      totalRow: [
        { text: 'Total', weight: 1.6, align: 'left', bold: true },
        { text: qty(totals.cartonWeight), weight: 1.4, align: 'right', bold: true },
        { text: String(totals.cops), weight: 0.9, align: 'right', bold: true },
        { text: qty(totals.grossWeight), weight: 1.3, align: 'right', bold: true },
        { text: qty(totals.copsWeight), weight: 1.3, align: 'right', bold: true },
        { text: qty(totals.tareWeight), weight: 1.3, align: 'right', bold: true },
        { text: qty(totals.netWeight), weight: 1.3, align: 'right', bold: true },
        { text: '', weight: 1.1, align: 'left' },
        { text: '', weight: 1.4, align: 'left' },
      ],
    },
    { type: 'spacer', height: 6 },
    infoRow([
      ['Status', text(challan.status)],
      ['Remarks', text(challan.remarks)],
    ]),
  ];

  const buffer = render(
    letterhead,
    'PRODUCTION CHALLAN',
    text(challan.challanNumber),
    'Challan Date: ' + toDisplayDate(challan.challanDate),
    blocks,
    'landscape'
  );

  return {
    documentType: 'PRODUCTION_CHALLAN',
    documentId: challan.id,
    documentNumber: text(challan.challanNumber),
    partyId: challan.partyId,
    partyName: challan.party ? text(challan.party.partyName) : null,
    fileName: safeFileName('Production_Challan_' + text(challan.challanNumber)),
    buffer,
  };
}

/* ------------------------------------------------------------------ */
/* Existing reports (reuse the current server-side PDF generators)     */
/* ------------------------------------------------------------------ */

type ReportBuilder = (
  companyId: string,
  financialYearId: string,
  request: Record<string, unknown>
) => Promise<{ buffer: Buffer; filename: string }>;

const REPORT_BUILDERS: Partial<Record<WhatsAppDocumentType, ReportBuilder>> = {
  REPORT_BILL_BASE: (companyId, financialYearId, request) =>
    reportService.exportPdf(companyId, financialYearId, request as never),
  REPORT_BANK_BOOK: (companyId, financialYearId, request) =>
    bankBookService.exportPdf(companyId, financialYearId, request),
  REPORT_ACCOUNT_LEDGER: (companyId, financialYearId, request) =>
    accountLedgerService.exportPdf(companyId, financialYearId, request),
  REPORT_ACCOUNT_WISE_BALANCE: (companyId, financialYearId, request) =>
    accountWiseBalanceService.exportPdf(companyId, financialYearId, request),
  REPORT_ACCOUNT_MONTH_WISE_BALANCE: (companyId, financialYearId, request) =>
    accountWiseBalanceService.exportMonthWisePdf(companyId, financialYearId, request),
  REPORT_BANK_RECONCILIATION: (companyId, financialYearId, request) =>
    bankReconciliationService.exportPdf(companyId, financialYearId, request),
};

async function resolveReport(
  documentType: WhatsAppDocumentType,
  scope: DocumentPdfScope,
  documentId: string,
  reportRequest: Record<string, unknown> | undefined
): Promise<BuiltDocumentPdf> {
  const builder = REPORT_BUILDERS[documentType];
  if (!builder) {
    throw new AppError(400, 'Unsupported report document type.', undefined, 'UNSUPPORTED_DOCUMENT');
  }
  if (!reportRequest || Object.keys(reportRequest).length === 0) {
    throw new AppError(
      400,
      'A report request payload is required to generate this report PDF.',
      undefined,
      'REPORT_REQUEST_REQUIRED'
    );
  }
  // Company and financial year come from the request headers, never the body.
  const built = await builder(scope.companyId, scope.financialYearId, reportRequest);
  const stem = built.filename.replace(/\.pdf$/i, '');
  const label = WHATSAPP_DOCUMENT_LABELS[documentType];
  return {
    documentType,
    documentId: documentId.length > 0 ? documentId : 'adhoc',
    documentNumber: stem.replace(/_/g, ' ') || label,
    partyId: null,
    partyName: null,
    fileName: safeFileName(stem || label),
    buffer: built.buffer,
  };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                         */
/* ------------------------------------------------------------------ */

export async function buildWhatsAppDocumentPdf(
  documentType: WhatsAppDocumentType,
  documentId: string,
  scope: DocumentPdfScope,
  reportRequest?: Record<string, unknown>
): Promise<BuiltDocumentPdf> {
  switch (documentType) {
    case 'BANK_RECEIPT':
    case 'BANK_PAYMENT':
      return resolveBankVoucher(scope, documentId, documentType);
    case 'PURCHASE_BILL':
      return resolvePurchaseBill(scope, documentId);
    case 'DEBIT_NOTE':
      return resolveDebitNote(scope, documentId);
    case 'PRODUCTION_CHALLAN':
      return resolveProductionChallan(scope, documentId);
    default:
      return resolveReport(documentType, scope, documentId, reportRequest);
  }
}