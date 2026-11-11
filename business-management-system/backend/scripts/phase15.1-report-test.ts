// Phase 15.1 - Sales & Purchase Report (Bill Base) enhancement test.
// Every expected value comes from the fixtures created below or from the
// database. No fake rows, no hardcoded "sample" totals.
import { inflateRawSync } from 'node:zlib';
import { Prisma, PrismaClient } from '@prisma/client';
import { REPORT_COLUMNS, reportService } from '../src/services/reportService.js';
import { reportLayoutService } from '../src/services/reportLayoutService.js';
import { computePdfLayout } from '../src/utils/pdfWriter.js';
import { debitNoteService } from '../src/services/debitNoteService.js';
import type { DebitNoteBillLineInput, DebitNotePayload } from '../src/services/debitNoteService.js';
import type {
  ReportColumnFilter,
  ReportRunRequest,
  ReportRunResponse,
  ReportSourceType,
} from '../src/types/reportTypes.js';

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string): void {
  total++;
  if (condition) {
    console.log(`  PASS [${total}]: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL [${total}]: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

function close(actual: number, expected: number, tolerance = 0.005): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

interface CaughtError {
  statusCode?: number;
  message: string;
}

async function expectError(fn: () => Promise<unknown>, expectedStatus: number, label: string): Promise<CaughtError> {
  try {
    await fn();
  } catch (error) {
    const err = error as CaughtError;
    assert(
      err.statusCode === expectedStatus,
      `${label} (expected ${expectedStatus}, received ${err.statusCode ?? 'none'}: ${err.message})`
    );
    return err;
  }
  assert(false, `${label} (expected rejection with ${expectedStatus}, but the call succeeded)`);
  return { message: '' };
}

interface ZipEntry {
  name: string;
  content: string;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const dataStart = offset + 30 + nameLength + extraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8');
    entries.push({ name, content });
    offset = dataStart + compressedSize;
  }
  return entries;
}

const TEST_COMPANY_CODE = 'P151TEST';
const OTHER_COMPANY_CODE = 'P151OTHER';

async function cleanupTestData(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  // ReportColumnLayout, PurchaseBillItem, DebitNoteBillLine and DebitNoteLine
  // all cascade from their parents / company.
  await prisma.debitNote.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBill.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.debitNoteBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.item.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

interface Fixture {
  companyId: string;
  otherCompanyId: string;
  financialYearId: string;
  supplierSuratId: string;
  supplierBhiwandiId: string;
  customerSuratId: string;
  bookId: string;
  creditAccountId: string;
  billAId: string;
  billBId: string;
  billCId: string;
  purchaseNoteId: string;
  purchaseNoteTotal: number;
}

async function buildFixture(): Promise<Fixture> {
  const company = await prisma.company.create({
    data: {
      companyCode: TEST_COMPANY_CODE,
      companyName: 'SHIVAM ENTERPRISE PHASE 151 LTD',
      gstin: '24AABCS1234F1Z8',
      panNumber: 'AABCS1234F',
      address: 'Plot 12, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '9876543210',
      email: 'accounts@shivam151.example',
    },
  });

  // A second company proves the saved layouts are company scoped.
  const otherCompany = await prisma.company.create({
    data: {
      companyCode: OTHER_COMPANY_CODE,
      companyName: 'OTHER COMPANY PHASE 151 LTD',
      gstin: '27AABCS9999F1Z1',
      panNumber: 'AABCS9999F',
      address: 'Plot 9, Industrial Estate',
      city: 'Bhiwandi',
      state: 'Maharashtra',
      pincode: '421302',
    },
  });

  const fy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2026 - 2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });

  const supplierSurat = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P151SUPSRT',
      partyName: 'Alpha Textiles',
      partyType: 'SUPPLIER',
      gstin: '24AAACC3333C1Z7',
      address: 'Sahara Darwaja',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395003',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const supplierBhiwandi = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P151SUPBHI',
      partyName: 'Beta Weaving Mills',
      partyType: 'SUPPLIER',
      gstin: '27AAACC4444D1Z8',
      address: 'Powerloom Marg',
      city: 'Bhiwandi',
      state: 'Maharashtra',
      pincode: '421302',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const customerSurat = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P151CUSSRT',
      partyName: 'Gamma Yarn Traders',
      partyType: 'CUSTOMER',
      gstin: '24AAACC1111A1Z5',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  // Item Master: one name that a bill line also uses, one name that no bill
  // line uses. Both are genuine master rows.
  await prisma.item.createMany({
    data: [
      {
        companyId: company.id,
        itemCode: 'P151-IM-1',
        itemName: 'Polyester Yarn 75D',
        itemCategory: 'Yarn',
        unit: 'KG',
        hsnCode: '5402',
      },
      {
        companyId: company.id,
        itemCode: 'P151-IM-2',
        itemName: 'Master Only Viscose',
        itemCategory: 'Yarn',
        unit: 'KG',
        hsnCode: '5504',
      },
    ],
  });

  const creditAccount = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: 'P151-INT-PUR',
      accountName: 'Interest on Purchase',
      accountGroup: 'INDIRECT_EXPENSES',
      accountType: 'EXPENSE',
      balanceType: 'DEBIT',
      openingBalance: new Prisma.Decimal(0),
      isBankAccount: false,
    },
  });

  const book = await prisma.debitNoteBook.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      prefix: 'DN-',
      bookName: 'DEBIT NOTE',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: true,
    },
  });

  const billA = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P151-PB-001',
      billDate: new Date('2026-05-10T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P151-INV-1001',
      totalQuantity: new Prisma.Decimal(100),
      taxableAmount: new Prisma.Decimal(10000),
      cgstRate: new Prisma.Decimal(2.5),
      cgstAmount: new Prisma.Decimal(250),
      sgstRate: new Prisma.Decimal(2.5),
      sgstAmount: new Prisma.Decimal(250),
      totalAmount: new Prisma.Decimal(10500),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Cotton Yarn 40s',
            quantity: new Prisma.Decimal(100),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(10000),
          },
        ],
      },
    },
  });

  const billB = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P151-PB-002',
      billDate: new Date('2026-06-15T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P151-INV-1002',
      totalQuantity: new Prisma.Decimal(50),
      taxableAmount: new Prisma.Decimal(11000),
      igstRate: new Prisma.Decimal(5),
      igstAmount: new Prisma.Decimal(550),
      totalAmount: new Prisma.Decimal(11550),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Polyester Yarn 75D',
            quantity: new Prisma.Decimal(50),
            unit: 'KG',
            rate: new Prisma.Decimal(220),
            taxableAmount: new Prisma.Decimal(11000),
          },
        ],
      },
    },
  });

  const billC = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P151-PB-003',
      billDate: new Date('2026-07-20T00:00:00.000Z'),
      partyId: supplierBhiwandi.id,
      supplierLegalName: 'Beta Weaving Mills',
      supplierInvoiceNumber: 'P151-INV-1003',
      totalQuantity: new Prisma.Decimal(200),
      taxableAmount: new Prisma.Decimal(18000),
      cgstRate: new Prisma.Decimal(2.5),
      cgstAmount: new Prisma.Decimal(450),
      sgstRate: new Prisma.Decimal(2.5),
      sgstAmount: new Prisma.Decimal(450),
      totalAmount: new Prisma.Decimal(18900),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Cotton Yarn 60s',
            quantity: new Prisma.Decimal(200),
            unit: 'KG',
            rate: new Prisma.Decimal(90),
            taxableAmount: new Prisma.Decimal(18000),
          },
        ],
      },
    },
  });

  // Cancelled and out-of-year documents: their item descriptions must never be
  // offered as filter values because the report cannot return them by default.
  await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P151-PB-004',
      billDate: new Date('2026-08-01T00:00:00.000Z'),
      partyId: supplierBhiwandi.id,
      supplierLegalName: 'Beta Weaving Mills',
      supplierInvoiceNumber: 'P151-INV-1004',
      totalQuantity: new Prisma.Decimal(20),
      taxableAmount: new Prisma.Decimal(5000),
      totalAmount: new Prisma.Decimal(5000),
      status: 'CANCELLED',
      items: {
        create: [
          {
            itemDescription: 'Cancelled Lot',
            quantity: new Prisma.Decimal(20),
            unit: 'KG',
            rate: new Prisma.Decimal(250),
            taxableAmount: new Prisma.Decimal(5000),
          },
        ],
      },
    },
  });

  await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P151-PB-OLD',
      billDate: new Date('2025-05-01T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P151-INV-OLD',
      totalQuantity: new Prisma.Decimal(10),
      taxableAmount: new Prisma.Decimal(1000),
      totalAmount: new Prisma.Decimal(1000),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Old Stock',
            quantity: new Prisma.Decimal(10),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(1000),
          },
        ],
      },
    },
  });

  const line = (overrides: Partial<DebitNoteBillLineInput> = {}): DebitNoteBillLineInput => ({
    billNo: 'P151-PB-001',
    billDate: '2026-05-10',
    totalDays: 65,
    dharaDays: 5,
    paidAmount: 0,
    itemDescription: 'Cotton Yarn 40s',
    quantity: 100,
    billTaxable: 10000,
    billAmount: 10500,
    unpaidAmount: 10500,
    sgstRate: 2.5,
    cgstRate: 2.5,
    igstRate: 0,
    rate: 12,
    ...overrides,
  });

  const noteBase = (overrides: Partial<DebitNotePayload>): DebitNotePayload => ({
    bookId: book.id,
    noteDate: '2026-09-05',
    noteType: 'PURCHASE',
    partyId: supplierSurat.id,
    dueDays: 30,
    creditAccountId: creditAccount.id,
    osEffect: '2.OS(+)',
    reason: 'INTEREST',
    calculationBasis: 'BILL_AMOUNT',
    gstRate: 5,
    billLines: [line()],
    ...overrides,
  });

  const purchaseNote = await debitNoteService.create(company.id, fy.id, noteBase({}));
  await debitNoteService.create(
    company.id,
    fy.id,
    noteBase({ noteType: 'SALES', partyId: customerSurat.id, noteDate: '2026-09-20' })
  );

  await prisma.debitNoteLine.create({
    data: {
      companyId: company.id,
      debitNoteId: purchaseNote.id,
      lineNumber: 1,
      itemName: 'Cotton Yarn 40s',
      itemCode: 'P151-ITEM-40S',
      yarnQuality: '40s',
      yarnCount: '40',
      yarnGrade: 'A',
      lotNumber: 'LOT-P151-1',
      originalQuantity: new Prisma.Decimal(100),
      acceptedQuantity: new Prisma.Decimal(100),
      currentQuantity: new Prisma.Decimal(100),
      unit: 'KG',
      originalRate: new Prisma.Decimal(100),
      taxableAmount: new Prisma.Decimal(10000),
      gstRate: new Prisma.Decimal(5),
      cgstAmount: new Prisma.Decimal(250),
      sgstAmount: new Prisma.Decimal(250),
      lineTotal: new Prisma.Decimal(10500),
    },
  });

  return {
    companyId: company.id,
    otherCompanyId: otherCompany.id,
    financialYearId: fy.id,
    supplierSuratId: supplierSurat.id,
    supplierBhiwandiId: supplierBhiwandi.id,
    customerSuratId: customerSurat.id,
    bookId: book.id,
    creditAccountId: creditAccount.id,
    billAId: billA.id,
    billBId: billB.id,
    billCId: billC.id,
    purchaseNoteId: purchaseNote.id,
    purchaseNoteTotal: Number(purchaseNote.totalAmount),
  };
}

function baseRequest(overrides: Partial<ReportRunRequest> = {}): ReportRunRequest {
  return {
    dateFrom: '2026-04-01',
    dateTo: '2027-03-31',
    mode: 'PURCHASE',
    format: 'BILL_NO_WISE',
    rateColumn: 'BASIC',
    detailMode: 'DETAIL',
    page: 1,
    pageSize: 100,
    sortDir: 'asc',
    ...overrides,
  };
}

async function run(fixture: Fixture, overrides: Partial<ReportRunRequest> = {}): Promise<ReportRunResponse> {
  return reportService.execute(fixture.companyId, fixture.financialYearId, baseRequest(overrides));
}

async function runOptionsSection(fixture: Fixture): Promise<void> {
  section('A. Options, Item filter source and operator catalogue');
  const options = await reportService.getOptions(fixture.companyId, fixture.financialYearId);

  assert(options.items.length === 4, 'Item options merge 2 Item Master names with the distinct bill descriptions');
  assert(options.itemFilter.masterItemCount === 2, 'The options report the real Item Master row count');
  assert(
    options.itemFilter.billItemCount === 3,
    'Only descriptions the report can return are counted (cancelled and out-of-year lines excluded)'
  );
  assert(
    options.items.some(
      (entry) => entry.value === 'Master Only Viscose' && (entry.meta ?? '').includes('P151-IM-2')
    ),
    'An Item Master name with no bill line is still offered with its master code'
  );
  assert(
    options.items.some((entry) => entry.value === 'Cotton Yarn 40s'),
    'A purchase bill line description with no Item Master row is offered'
  );
  assert(
    !options.items.some((entry) => entry.value === 'Cancelled Lot' || entry.value === 'Old Stock'),
    'No item value is offered that the report cannot return'
  );
  assert(
    options.items.filter((entry) => entry.value === 'Polyester Yarn 75D').length === 1,
    'A name present in both sources appears only once'
  );
  assert(
    options.itemFilter.note.includes('2 Item Master record(s)') &&
      options.itemFilter.note.includes('3 distinct description(s)'),
    'The Item filter explains exactly where its values come from'
  );

  assert(options.filterOperators.length === 12, 'Twelve column filter operators are exposed');
  assert(
    options.filterOperators.every((entry) => entry.types.length > 0),
    'Every operator declares the column types it supports'
  );
  const contains = options.filterOperators.find((entry) => entry.value === 'contains');
  assert(
    contains !== undefined && contains.types.join(',') === 'text',
    'Contains is offered for text columns only'
  );
  const between = options.filterOperators.find((entry) => entry.value === 'between');
  assert(
    between !== undefined && between.types.includes('date') && between.types.includes('currency'),
    'Between is offered for date and numeric columns'
  );
  assert(options.requiredColumns.join(',') === 'srNo', 'Sr No is the only protected column');
}

async function runItemFilterSection(fixture: Fixture): Promise<void> {
  section('B. Real Item filter');

  const byDescription = await run(fixture, { itemId: 'Cotton Yarn 40s' });
  assert(
    byDescription.rows.length === 1 && byDescription.rows[0].documentNo === 'P151-PB-001',
    'The Item filter matches the stored PurchaseBillItem description'
  );

  const byDescriptionLower = await run(fixture, { itemId: '  cotton yarn 40S ' });
  assert(byDescriptionLower.rows.length === 1, 'The Item filter is trimmed and case insensitive');

  const byMasterName = await run(fixture, { itemId: 'Polyester Yarn 75D' });
  assert(
    byMasterName.rows.length === 1 && byMasterName.rows[0].documentNo === 'P151-PB-002',
    'An Item Master name also matches the bill line that stores it'
  );

  const masterOnly = await run(fixture, { itemId: 'Master Only Viscose' });
  assert(masterOnly.rows.length === 0, 'A master-only item returns no document instead of a fabricated match');
  assert(masterOnly.rowCount === 0, 'The master-only item reports a zero row count');

  const unknown = await run(fixture, { itemId: 'No Such Item' });
  assert(unknown.rows.length === 0 && unknown.totals.all.billAmount === 0, 'An unknown item returns an honest empty result');

  const noteMatch = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'],
    itemId: 'Cotton Yarn 40s',
  });
  assert(noteMatch.rows.length === 2, 'The Item filter also matches a stored Debit Note item name');
  assert(
    noteMatch.rows.some((row) => row.sourceType === 'PURCHASE_DEBIT_NOTE') &&
      noteMatch.rows.some((row) => row.sourceType === 'PURCHASE'),
    'Both matching document sources are returned'
  );

  const empty = await run(fixture, { itemId: '' });
  assert(empty.rows.length === 3, 'An empty Item filter never restricts the report');
}

async function runColumnFilterSection(fixture: Fixture): Promise<void> {
  section('C. Dataset-wide column filters');

  const byParty = await run(fixture, {
    columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
  });
  assert(byParty.rows.length === 2, 'Contains filters the complete dataset, not the page');
  assert(byParty.rowCount === 2, 'The filtered row count is reported');
  assert(close(byParty.totals.all.billAmount, 22050), 'Totals are recalculated over the filtered dataset');
  assert(
    byParty.meta.columnFilters.length === 1 && byParty.meta.activeFilters[0].includes('Party Name'),
    'The response echoes the applied filter and a readable description'
  );

  const byBillNo = await run(fixture, {
    columnFilters: [{ key: 'billNo', operator: 'equals', value: 'p151-pb-002' }],
  });
  assert(byBillNo.rows.length === 1 && byBillNo.rows[0].documentNo === 'P151-PB-002', 'Equals is case insensitive for text');

  const notSurat = await run(fixture, {
    columnFilters: [{ key: 'partyCity', operator: 'notEquals', value: 'Surat' }],
  });
  assert(notSurat.rows.length === 1 && notSurat.rows[0].documentNo === 'P151-PB-003', 'Does not equal excludes the matching city');

  const bigBills = await run(fixture, {
    columnFilters: [{ key: 'billAmount', operator: 'gte', value: '15000' }],
  });
  assert(bigBills.rows.length === 1 && bigBills.rows[0].documentNo === 'P151-PB-003', 'Greater than or equal works on currency');

  const amountRange = await run(fixture, {
    columnFilters: [{ key: 'billAmount', operator: 'between', value: '10000', valueTo: '12000' }],
  });
  assert(
    amountRange.rows.length === 2 &&
      amountRange.rows.map((row) => row.documentNo).join(',') === 'P151-PB-001,P151-PB-002',
    'Between keeps both bills inside the numeric range'
  );

  const dateRange = await run(fixture, {
    columnFilters: [{ key: 'billDate', operator: 'between', value: '2026-06-01', valueTo: '2026-07-31' }],
  });
  assert(
    dateRange.rows.length === 2 &&
      dateRange.rows.map((row) => row.documentNo).join(',') === 'P151-PB-002,P151-PB-003',
    'Between works on the bill date'
  );

  const before = await run(fixture, {
    columnFilters: [{ key: 'billDate', operator: 'before', value: '2026-06-01' }],
  });
  assert(before.rows.length === 1 && before.rows[0].documentNo === 'P151-PB-001', 'Before works on the bill date');

  const emptyQuality = await run(fixture, {
    columnFilters: [{ key: 'quality', operator: 'empty' }],
  });
  assert(emptyQuality.rows.length === 3, 'Is empty matches every purchase bill, which stores no quality');
  assert(emptyQuality.meta.activeFilters[0].includes('is empty'), 'Is empty is described without a value');

  const filledQuality = await run(fixture, {
    columnFilters: [{ key: 'quality', operator: 'notEmpty' }],
  });
  assert(filledQuality.rows.length === 0, 'Is not empty returns no row when the field is never populated');

  const combined = await run(fixture, {
    columnFilters: [
      { key: 'partyName', operator: 'contains', value: 'alpha' },
      { key: 'billAmount', operator: 'gte', value: '11000' },
    ],
  });
  assert(
    combined.rows.length === 1 && combined.rows[0].documentNo === 'P151-PB-002',
    'Multiple column filters are combined with AND'
  );

  const paged = await run(fixture, {
    columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
    page: 1,
    pageSize: 1,
  });
  assert(paged.rows.length === 1, 'A filtered dataset is paginated after filtering');
  assert(paged.pagination.total === 2 && paged.pagination.totalPages === 2, 'Pagination reflects the filtered total');
  assert(close(paged.totals.all.billAmount, 22050), 'Page one totals stay dataset-wide');
  const pagedTwo = await run(fixture, {
    columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
    page: 2,
    pageSize: 1,
  });
  assert(pagedTwo.rows.length === 1 && pagedTwo.rows[0].documentNo === 'P151-PB-002', 'Page two returns the second match');

  const grouped = await run(fixture, {
    format: 'PARTY_WISE',
    columnFilters: [{ key: 'partyCity', operator: 'equals', value: 'Surat' }],
  });
  assert(grouped.groups.length === 1 && grouped.groups[0].label === 'Alpha Textiles', 'Grouping is built from the filtered dataset');
  assert(close(grouped.groups[0].totals.billAmount, 22050), 'Group totals use the filtered rows');
  assert(close(grouped.totals.grandTotal ?? 0, 22050), 'The grand total uses the filtered rows');

  const summary = await run(fixture, {
    format: 'PARTY_WISE',
    detailMode: 'SUMMARY',
    columnFilters: [{ key: 'partyCity', operator: 'equals', value: 'Surat' }],
  });
  assert(summary.rows.length === 1, 'Summary mode also respects the dataset-wide filter');

  const itemAndColumn = await run(fixture, {
    itemId: 'Cotton Yarn 40s',
    columnFilters: [{ key: 'partyCity', operator: 'equals', value: 'Surat' }],
  });
  assert(itemAndColumn.rows.length === 1, 'The Item filter and column filters combine');

  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'srNo', operator: 'equals', value: '1' }] }),
    400,
    'Sr No cannot be filtered because it is assigned after filtering'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'billAmount', operator: 'contains', value: '10' }] }),
    400,
    'A text operator is rejected for a numeric column'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'partyName', operator: 'contains', value: '   ' }] }),
    400,
    'A missing filter value is rejected instead of being ignored'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'billDate', operator: 'equals', value: '10-05-2026' }] }),
    400,
    'A malformed date filter is rejected'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'billAmount', operator: 'between', value: '20000', valueTo: '10000' }] }),
    400,
    'A reversed numeric range is rejected'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'notAColumn', operator: 'contains', value: 'x' }] }),
    400,
    'An unknown column key is rejected'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'partyName', operator: 'gt', value: '10' }] }),
    400,
    'A numeric operator is rejected for a text column'
  );

  const validated = reportService.validateColumnFilters([
    { key: 'partyName', operator: 'contains', value: ' alpha ' },
  ]);
  assert(validated.length === 1 && validated[0].value === 'alpha', 'Filter values are trimmed before use');
}

async function runGroupingSection(fixture: Fixture): Promise<void> {
  section('D. Drag and drop grouping semantics');

  const nested = await run(fixture, { groupBy: ['partyName', 'partyCity'] });
  assert(nested.groupBy.join(',') === 'partyName,partyCity', 'A two level grouping keeps the requested order');
  assert(nested.groups.length === 2, 'The first level produces one group per party');
  assert(
    nested.groups.every((group) => Array.isArray(group.children) && group.children.length === 1),
    'The second level nests inside each party'
  );

  const reordered = await run(fixture, { groupBy: ['partyCity', 'partyName'] });
  assert(reordered.groupBy.join(',') === 'partyCity,partyName', 'Reordering the levels is accepted');
  assert(reordered.groups.length === 2, 'Reordering changes the top level to city');
  const surat = reordered.groups.find((group) => group.label === 'Surat');
  assert(
    surat !== undefined && surat.count === 2 && surat.children?.length === 1 && surat.children[0].label === 'Alpha Textiles',
    'The reordered grouping nests the party inside the city'
  );

  const threeLevels = await run(fixture, { groupBy: ['partyCity', 'partyName', 'billNo'] });
  assert(threeLevels.groupBy.length === 3, 'Three grouping levels are accepted');
  assert(
    threeLevels.groups.every((group) => group.children?.every((child) => Array.isArray(child.children))),
    'Three levels nest all the way down'
  );

  const duplicated = await run(fixture, { groupBy: ['partyName', 'partyName'] });
  assert(duplicated.groupBy.join(',') === 'partyName', 'A duplicated grouping level is collapsed, not repeated');

  const groupTotal = reordered.groups.reduce((sum, group) => sum + group.totals.billAmount, 0);
  assert(close(groupTotal, 40950), 'Group totals add up to the grand total');

  // Phase 15.2 - Broker is now a real master reference, so grouping by it works.
  const brokerGrouped = await run(fixture, { groupBy: ['broker'] });
  assert(brokerGrouped.groupBy.join(',') === 'broker', 'Grouping by the Broker master is accepted');
  await expectError(() => run(fixture, { groupBy: ['hsnCode'] }), 400, 'Grouping by a column with no grouping meaning is rejected');
  await expectError(() => run(fixture, { groupBy: ['partyName', 'notAField'] }), 400, 'An invalid second level is rejected');

  const cleared = await run(fixture, { groupBy: [] });
  assert(cleared.groupBy.length === 0, 'Clearing the grouping returns an ungrouped report');
  assert(cleared.groups.length === 0, 'An ungrouped report has no group summary');
}

async function runLayoutSection(fixture: Fixture): Promise<void> {
  section('E. PostgreSQL column layouts');

  const initial = await reportLayoutService.list(fixture.companyId);
  assert(initial.length === 0, 'A company starts with no saved layout');

  const compact = await reportLayoutService.create(fixture.companyId, {
    name: 'Compact',
    columns: ['srNo', 'billNo', 'partyName', 'billAmount'],
  });
  assert(
    compact.columns.join(',') === 'srNo,billNo,partyName,billAmount',
    'The saved layout keeps the requested column order'
  );
  assert(compact.isDefault === false, 'A new layout is not the default unless asked');
  assert(compact.reportType === 'BILL_BASE', 'The layout is scoped to the bill base report');
  assert((await reportLayoutService.list(fixture.companyId)).length === 1, 'The layout is really persisted');

  await expectError(
    () => reportLayoutService.create(fixture.companyId, { name: 'Compact', columns: ['srNo', 'billNo'] }),
    409,
    'A duplicate layout name in the same company is rejected'
  );
  await expectError(
    () => reportLayoutService.create(fixture.companyId, { name: 'compact', columns: ['srNo', 'billNo'] }),
    409,
    'A duplicate name is detected regardless of case'
  );
  await expectError(
    () => reportLayoutService.create(fixture.companyId, { name: 'Bad Column', columns: ['srNo', 'notAColumn'] }),
    400,
    'An unknown column id is rejected against the live catalogue'
  );
  await expectError(
    () => reportLayoutService.create(fixture.companyId, { name: 'No Sr No', columns: ['billNo'] }),
    400,
    'A layout without the required Sr No column is rejected'
  );
  await expectError(
    () => reportLayoutService.create(fixture.companyId, { name: '   ', columns: ['srNo'] }),
    400,
    'An empty layout name is rejected'
  );

  const wide = await reportLayoutService.create(fixture.companyId, {
    name: 'Wide',
    columns: ['srNo', 'billDate', 'partyName', 'taxableAmount', 'billAmount'],
    isDefault: true,
  });
  assert(wide.isDefault === true, 'A layout can be created as the default');
  const afterFirstDefault = await reportLayoutService.list(fixture.companyId);
  assert(
    afterFirstDefault.filter((layout) => layout.isDefault).length === 1,
    'Only one layout is the default at a time'
  );

  const nightly = await reportLayoutService.create(fixture.companyId, {
    name: 'Nightly',
    columns: ['srNo', 'billNo'],
    isDefault: true,
  });
  const afterSecondDefault = await reportLayoutService.list(fixture.companyId);
  assert(
    afterSecondDefault.filter((layout) => layout.isDefault).length === 1 &&
      afterSecondDefault.find((layout) => layout.isDefault)?.id === nightly.id,
    'Setting a new default clears the previous default'
  );

  const renamed = await reportLayoutService.update(fixture.companyId, compact.id, {
    name: 'Compact Renamed',
    columns: ['srNo', 'billNo', 'partyName', 'billAmount', 'taxableAmount'],
  });
  assert(renamed.name === 'Compact Renamed', 'A layout can be renamed');
  assert(renamed.columns.includes('taxableAmount'), 'A layout column list can be updated');
  assert(renamed.columns[0] === 'srNo', 'The required column stays first after an update');

  await expectError(
    () => reportLayoutService.update(fixture.companyId, compact.id, { name: 'Wide' }),
    409,
    'Renaming onto an existing name is rejected'
  );
  await expectError(
    () => reportLayoutService.update(fixture.companyId, compact.id, { columns: ['srNo', 'notAColumn'] }),
    400,
    'Updating with an unknown column is rejected'
  );
  await expectError(
    () => reportLayoutService.update(fixture.companyId, compact.id, { columns: ['billNo'] }),
    400,
    'The required column cannot be removed by an update'
  );

  await expectError(
    () => reportLayoutService.getById(fixture.otherCompanyId, compact.id),
    404,
    'Another company cannot read the layout'
  );
  await expectError(
    () => reportLayoutService.update(fixture.otherCompanyId, compact.id, { name: 'Hijack' }),
    404,
    'Another company cannot update the layout'
  );
  await expectError(
    () => reportLayoutService.remove(fixture.otherCompanyId, compact.id),
    404,
    'Another company cannot delete the layout'
  );
  const otherList = await reportLayoutService.list(fixture.otherCompanyId);
  assert(otherList.length === 0, 'Another company sees none of the layouts');
  const sameNameOtherCompany = await reportLayoutService.create(fixture.otherCompanyId, {
    name: 'Compact Renamed',
    columns: ['srNo', 'billNo'],
  });
  assert(
    sameNameOtherCompany.id !== compact.id,
    'The same layout name can exist independently in another company'
  );

  const legacy = await prisma.reportColumnLayout.create({
    data: {
      companyId: fixture.companyId,
      reportType: 'BILL_BASE',
      layoutName: 'Legacy Layout',
      selectedColumns: ['srNo', 'legacyColumn'],
      columnOrder: ['srNo', 'legacyColumn'],
      isDefault: false,
    },
  });
  const listed = await reportLayoutService.list(fixture.companyId);
  const legacyRead = listed.find((layout) => layout.id === legacy.id);
  assert(legacyRead !== undefined, 'A stored layout is returned');
  assert(legacyRead !== undefined && legacyRead.columns.join(',') === 'srNo', 'A column that left the catalogue is skipped');
  assert(
    legacyRead !== undefined && legacyRead.unavailableColumns?.join(',') === 'legacyColumn',
    'The skipped column is reported so the UI can warn'
  );

  await reportLayoutService.remove(fixture.companyId, legacy.id);
  assert(
    (await reportLayoutService.list(fixture.companyId)).every((layout) => layout.id !== legacy.id),
    'A layout can be deleted'
  );
  await expectError(
    () => reportLayoutService.remove(fixture.companyId, legacy.id),
    404,
    'Deleting an already deleted layout reports 404'
  );

  const defaulted = await reportLayoutService.setDefault(fixture.companyId, wide.id);
  assert(defaulted.isDefault === true, 'The default can be changed later');
  assert(
    (await reportLayoutService.list(fixture.companyId)).filter((layout) => layout.isDefault).length === 1,
    'Changing the default keeps exactly one default'
  );
}

async function runPdfSection(fixture: Fixture): Promise<void> {
  section('F. Direct PDF export');

  // Extra real rows so the export must break across pages. They are removed
  // again before the read-only check at the end of the run.
  for (let index = 1; index <= 70; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    await prisma.purchaseBill.create({
      data: {
        companyId: fixture.companyId,
        financialYearId: fixture.financialYearId,
        billNumber: 'PF-' + String(index).padStart(3, '0'),
        billDate: new Date('2026-10-' + day + 'T00:00:00.000Z'),
        partyId: fixture.supplierBhiwandiId,
        supplierLegalName: 'Beta Weaving Mills',
        supplierInvoiceNumber: 'P151-PDFINV-' + index,
        totalQuantity: new Prisma.Decimal(10),
        taxableAmount: new Prisma.Decimal(1000 + index),
        totalAmount: new Prisma.Decimal(1000 + index),
        status: 'CONFIRMED',
        items: {
          create: [
            {
              itemDescription: 'Pdf Test Yarn ' + index,
              quantity: new Prisma.Decimal(10),
              unit: 'KG',
              rate: new Prisma.Decimal(100),
              taxableAmount: new Prisma.Decimal(1000 + index),
            },
          ],
        },
      },
    });
  }

  const pdf = await reportService.exportPdf(
    fixture.companyId,
    fixture.financialYearId,
    baseRequest({ format: 'PARTY_WISE', printItemDetails: true, pdfOrientation: 'portrait' })
  );
  const text = pdf.buffer.toString('latin1');

  assert(pdf.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4', 'The export starts with a real PDF header');
  assert(pdf.buffer.subarray(-6).toString('latin1').includes('%%EOF'), 'The export ends with a real EOF marker');
  assert(pdf.filename.toLowerCase().endsWith('.pdf'), 'The export filename ends with .pdf');
  assert(
    pdf.filename.includes('2026-04-01') && pdf.filename.includes('2027-03-31'),
    'The PDF filename carries the real date range'
  );

  const pageObjects = text.match(/\/Type \/Page /g) ?? [];
  const countMatch = /\/Count (\d+)/.exec(text);
  const declaredPages = countMatch ? Number(countMatch[1]) : 0;
  assert(pageObjects.length >= 2, 'The export contains more than one page object for a large dataset');
  assert(declaredPages === pageObjects.length, 'The page tree count matches the real page objects');
  // Parentheses are escaped inside PDF text literals, so match the word only.
  assert(text.includes('continued'), 'Continuation pages repeat a header');
  assert(text.includes('Page 1 of ' + declaredPages), 'The first page is numbered');
  assert(text.includes('Page ' + declaredPages + ' of ' + declaredPages), 'The last page is numbered');

  assert(text.includes('SHIVAM ENTERPRISE PHASE 151 LTD'), 'The company name is printed');
  assert(text.includes('GSTIN: 24AABCS1234F1Z8'), 'The company GSTIN is printed');
  assert(text.includes('Financial Year: 2026 - 2027'), 'The financial year is printed');
  assert(text.includes('Party Wise'), 'The report title is printed');
  assert(text.includes('Report Type: 2. Purchase - Detail'), 'The report type is printed with a readable detail mode');
  assert(text.includes('Period: 2026-04-01 to 2027-03-31'), 'The date range is printed');
  assert(text.includes('Grouping: Party Name'), 'The grouping levels are printed');
  assert(text.includes('GRAND TOTAL'), 'The grand total row is printed');
  assert(text.includes('PF-001') && text.includes('PF-070'), 'Rows from the first and last page are printed');
  assert(text.includes('Alpha Textiles') && text.includes('Beta Weaving Mills'), 'Group headings are printed');
  assert(text.includes('/MediaBox [0 0 595.28 841.89]'), 'Portrait uses the A4 portrait media box');

  const landscape = await reportService.exportPdf(
    fixture.companyId,
    fixture.financialYearId,
    baseRequest({ pdfOrientation: 'landscape' })
  );
  const landscapeText = landscape.buffer.toString('latin1');
  assert(
    landscapeText.includes('/MediaBox [0 0 841.89 595.28]'),
    'Landscape uses the A4 landscape media box'
  );

  const filtered = await reportService.exportPdf(
    fixture.companyId,
    fixture.financialYearId,
    baseRequest({
      columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
      partyCity: 'Surat',
    })
  );
  const filteredText = filtered.buffer.toString('latin1');
  assert(filteredText.includes('Column filter - Party Name'), 'Applied column filters are printed in the header');
  assert(filteredText.includes('City: Surat'), 'The party city filter is printed in the header');
  assert(!filteredText.includes('PF-070'), 'The PDF only contains rows that match the filters');

  const allColumns = REPORT_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    weight: column.width,
    align: column.align,
  }));
  const portraitLayout = computePdfLayout(allColumns, 'portrait');
  const portraitWidth = portraitLayout.columns.reduce((sum, column) => sum + column.width, 0);
  assert(
    portraitWidth <= portraitLayout.usableWidth + 0.5,
    'All 30 columns fit inside the printable width in portrait'
  );
  assert(
    portraitLayout.columns.every((column) => column.maxChars >= 1),
    'Every column keeps at least one printable character'
  );
  assert(portraitLayout.fontSize >= 5, 'The font never shrinks below the readable floor');
  const landscapeLayout = computePdfLayout(allColumns, 'landscape');
  assert(
    landscapeLayout.columns.reduce((sum, column) => sum + column.width, 0) <= landscapeLayout.usableWidth + 0.5,
    'All 30 columns fit inside the printable width in landscape'
  );

  await prisma.purchaseBill.deleteMany({
    where: { companyId: fixture.companyId, billNumber: { startsWith: 'PF-' } },
  });
}

async function runXlsxSection(fixture: Fixture): Promise<void> {
  section('G. XLSX regression');

  const filtered = await run(fixture, {
    columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
  });
  const exported = reportService.exportXlsx(filtered);
  assert(exported.buffer[0] === 0x50 && exported.buffer[1] === 0x4b, 'The workbook still starts with the ZIP signature');
  const entries = readZipEntries(exported.buffer);
  const sheetXml = entries.find((entry) => entry.name === 'xl/worksheets/sheet1.xml')?.content ?? '';
  assert(sheetXml.includes('P151-PB-001') && sheetXml.includes('P151-PB-002'), 'The workbook contains the filtered rows');
  assert(!sheetXml.includes('P151-PB-003'), 'The workbook does not contain rows excluded by the filter');
  assert(sheetXml.includes('TOTAL'), 'The workbook still contains its TOTAL footer');
}

async function runReadOnlySection(fixture: Fixture): Promise<void> {
  section('H. Read-only guarantee');

  const before = {
    bills: await prisma.purchaseBill.count({ where: { companyId: fixture.companyId } }),
    notes: await prisma.debitNote.count({ where: { companyId: fixture.companyId } }),
    journals: await prisma.journalLine.count({ where: { companyId: fixture.companyId } }),
    layouts: await prisma.reportColumnLayout.count({ where: { companyId: fixture.companyId } }),
  };

  await run(fixture, {
    format: 'PARTY_WISE',
    columnFilters: [{ key: 'partyName', operator: 'contains', value: 'alpha' }],
  });
  await reportService.exportPdf(fixture.companyId, fixture.financialYearId, baseRequest({}));

  const after = {
    bills: await prisma.purchaseBill.count({ where: { companyId: fixture.companyId } }),
    notes: await prisma.debitNote.count({ where: { companyId: fixture.companyId } }),
    journals: await prisma.journalLine.count({ where: { companyId: fixture.companyId } }),
    layouts: await prisma.reportColumnLayout.count({ where: { companyId: fixture.companyId } }),
  };

  assert(before.bills === after.bills, 'Running and exporting reports never changes purchase bills');
  assert(before.notes === after.notes, 'Running and exporting reports never changes debit notes');
  assert(before.journals === after.journals, 'Running and exporting reports never posts a journal line');
  assert(before.layouts === after.layouts, 'Running and exporting reports never changes saved layouts');
}

async function main(): Promise<void> {
  console.log('Phase 15.1 - Sales & Purchase Report (Bill Base) enhancement test');
  await cleanupTestData();

  const fixture = await buildFixture();
  try {
    await runOptionsSection(fixture);
    await runItemFilterSection(fixture);
    await runColumnFilterSection(fixture);
    await runGroupingSection(fixture);
    await runLayoutSection(fixture);
    await runPdfSection(fixture);
    await runXlsxSection(fixture);
    await runReadOnlySection(fixture);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 15.1 report tests: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

main().catch(async (error) => {
  console.error('\nPhase 15.1 report test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
