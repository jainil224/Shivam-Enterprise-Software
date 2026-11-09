// Phase 15 - Sales & Purchase Report (Bill Base) service test.
// Read-only verification: every expected value comes from the fixtures created
// below or from the database, never from a hardcoded "sample" total.
import { inflateRawSync } from 'node:zlib';
import { Prisma, PrismaClient } from '@prisma/client';
import { reportService } from '../src/services/reportService.js';
import { debitNoteService } from '../src/services/debitNoteService.js';
import type { DebitNoteBillLineInput, DebitNotePayload } from '../src/services/debitNoteService.js';
import type { ReportRunRequest, ReportRunResponse, ReportSourceType } from '../src/types/reportTypes.js';

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

// Reads the deflated parts of a ZIP container so the test can assert on the
// real workbook XML instead of trusting the file extension.
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

const TEST_COMPANY_CODE = 'P15TEST';

async function cleanupTestData(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { companyCode: TEST_COMPANY_CODE },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  // DebitNoteBillLine / DebitNoteLine / PurchaseBillItem cascade from their parents.
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
  financialYearId: string;
  supplierSuratId: string;
  supplierBhiwandiId: string;
  customerSuratId: string;
  bookId: string;
  creditAccountId: string;
  billAId: string;
  billBId: string;
  billCId: string;
  cancelledBillId: string;
  purchaseNoteId: string;
  salesNoteId: string;
  purchaseNoteTotal: number;
  salesNoteTotal: number;
}

async function buildFixture(): Promise<Fixture> {
  const company = await prisma.company.create({
    data: {
      companyCode: TEST_COMPANY_CODE,
      companyName: 'SHIVAM ENTERPRISE PHASE 15 LTD',
      gstin: '24AABCS1234F1Z8',
      panNumber: 'AABCS1234F',
      address: 'Plot 12, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '9876543210',
      email: 'accounts@shivam.example',
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
      partyCode: 'P15SUPSRT',
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
      partyCode: 'P15SUPBHI',
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
      partyCode: 'P15CUSSRT',
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

  const creditAccount = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: 'P15-INT-PUR',
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
      billNumber: 'P15-PB-001',
      billDate: new Date('2026-05-10T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P15-INV-1001',
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
      billNumber: 'P15-PB-002',
      billDate: new Date('2026-06-15T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P15-INV-1002',
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
      billNumber: 'P15-PB-003',
      billDate: new Date('2026-07-20T00:00:00.000Z'),
      partyId: supplierBhiwandi.id,
      supplierLegalName: 'Beta Weaving Mills',
      supplierInvoiceNumber: 'P15-INV-1003',
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

  const cancelledBill = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P15-PB-004',
      billDate: new Date('2026-08-01T00:00:00.000Z'),
      partyId: supplierBhiwandi.id,
      supplierLegalName: 'Beta Weaving Mills',
      supplierInvoiceNumber: 'P15-INV-1004',
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

  // A bill outside the financial year: the report must never show it.
  await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P15-PB-OLD',
      billDate: new Date('2025-05-01T00:00:00.000Z'),
      partyId: supplierSurat.id,
      supplierLegalName: 'Alpha Textiles',
      supplierInvoiceNumber: 'P15-INV-OLD',
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
    billNo: 'P15-PB-001',
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
  const salesNote = await debitNoteService.create(
    company.id,
    fy.id,
    noteBase({ noteType: 'SALES', partyId: customerSurat.id, noteDate: '2026-09-20' })
  );

  // The note service stores bill lines; an item-wise adjustment line is stored
  // separately on debit_note_lines. Record one real line so the item-detail
  // lookup has genuine stored data to return.
  await prisma.debitNoteLine.create({
    data: {
      companyId: company.id,
      debitNoteId: purchaseNote.id,
      lineNumber: 1,
      itemName: 'Cotton Yarn 40s',
      itemCode: 'P15-ITEM-40S',
      yarnQuality: '40s',
      yarnCount: '40',
      yarnGrade: 'A',
      lotNumber: 'LOT-P15-1',
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
    financialYearId: fy.id,
    supplierSuratId: supplierSurat.id,
    supplierBhiwandiId: supplierBhiwandi.id,
    customerSuratId: customerSurat.id,
    bookId: book.id,
    creditAccountId: creditAccount.id,
    billAId: billA.id,
    billBId: billB.id,
    billCId: billC.id,
    cancelledBillId: cancelledBill.id,
    purchaseNoteId: purchaseNote.id,
    salesNoteId: salesNote.id,
    purchaseNoteTotal: Number(purchaseNote.totalAmount),
    salesNoteTotal: Number(salesNote.totalAmount),
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
  section('A. Report options and capability registry');
  const options = await reportService.getOptions(fixture.companyId, fixture.financialYearId);

  assert(options.formats.length === 20, 'The reference screen exposes 20 report names');
  assert(options.formats.filter((entry) => entry.support === 'FULL').length === 7, 'Seven formats are fully supported');
  assert(options.formats.filter((entry) => entry.support === 'PARTIAL').length === 5, 'Five formats are partial (real data, missing field)');
  assert(options.formats.filter((entry) => entry.support === 'UNAVAILABLE').length === 8, 'Eight formats are unavailable');
  assert(
    options.formats.every((entry) => entry.support === 'FULL' || Boolean(entry.reason)),
    'Every partial or unavailable format explains itself'
  );
  const salesmanLabels = options.formats.filter((entry) => entry.label === 'Salesman + Party Wise');
  assert(salesmanLabels.length === 2, 'Both duplicate "Salesman + Party Wise" labels are preserved');
  assert(
    salesmanLabels.every((entry) => entry.support === 'UNAVAILABLE'),
    'Both duplicate salesman labels are honestly marked unavailable'
  );

  assert(options.sources.length === 9, 'Nine document sources are declared');
  assert(options.sources.filter((entry) => entry.supported).length === 3, 'Three document sources really exist');
  assert(
    options.sources
      .filter((entry) => entry.supported)
      .map((entry) => entry.key)
      .sort()
      .join(',') === ['PURCHASE', 'PURCHASE_DEBIT_NOTE', 'SALES_DEBIT_NOTE'].sort().join(','),
    'Supported sources are Purchase, Purchase Debit Note and Sales Debit Note'
  );
  assert(
    options.sources.find((entry) => entry.key === 'GENERAL_PURCHASE')?.supported === false,
    'General Purchase is not offered after the Phase 14 removal'
  );

  assert(options.columns.length === 30, 'The column catalogue lists 30 columns');
  assert(options.standardColumns.length === 13, 'The standard layout has 13 columns');
  assert(options.standardColumns[0] === 'srNo', 'The standard layout always starts with Sr No');
  assert(options.books.length === 1, 'Only the real Debit Note book is offered as a book filter');
  assert(options.parties.length === 3, 'All three real parties are offered');
  assert(options.cities.length === 2, 'Cities come from the real party master (2 distinct cities)');
  assert(options.items.length === 0, 'No Item master rows exist for this fixture, so the item filter stays empty');
  assert(options.qualities.length === 0, 'No Yarn Quality master rows exist for this fixture');
  assert(options.unavailableFilters.length === 8, 'The unavailable filter panel documents 8 missing fields');
  assert(
    options.unavailableFilters.every((entry) => entry.reason.trim().length > 0),
    'Every unavailable filter states the missing source field'
  );
  assert(
    options.defaultDateFrom === '2026-04-01' && options.defaultDateTo <= '2027-03-31',
    'The default bill date range stays inside the financial year'
  );
  assert(
    options.modes.find((entry) => entry.value === 'SALES')?.available === false &&
      options.modes.find((entry) => entry.value === 'EXPENSE')?.available === false,
    'Sales and Expense modes are declared but unavailable'
  );
  assert(options.modes.find((entry) => entry.value === 'PURCHASE')?.available === true, 'Purchase mode is available');
}

async function runValidationSection(fixture: Fixture): Promise<void> {
  section('B. Mode, source and format validation');

  assert(reportService.resolveSources('PURCHASE').join(',') === 'PURCHASE', 'Purchase mode resolves to the purchase source only');
  await expectError(() => run(fixture, { mode: 'SALES' }), 400, 'Sales mode is rejected instead of faking invoices');
  await expectError(() => run(fixture, { mode: 'EXPENSE' }), 400, 'Expense mode is rejected instead of faking expenses');
  await expectError(
    () => run(fixture, { mode: 'SELECTED', sources: [] }),
    400,
    'Selected mode without sources is rejected'
  );
  await expectError(
    () => run(fixture, { mode: 'SELECTED', sources: ['SALES'] as ReportSourceType[] }),
    400,
    'Selected mode rejects an unsupported source'
  );
  await expectError(
    () => run(fixture, { mode: 'SELECTED', sources: ['NOT_A_SOURCE'] as unknown as ReportSourceType[] }),
    400,
    'Selected mode rejects an unknown source key'
  );
  await expectError(
    () => run(fixture, { format: 'BROKER_PARTY_WISE' }),
    400,
    'Broker + Party Wise is rejected with a reason instead of returning empty rows'
  );
  await expectError(() => run(fixture, { format: 'NOT_A_FORMAT' }), 400, 'An unknown format key is rejected');
  await expectError(
    () => run(fixture, { rateFrom: 500, rateTo: 100 }),
    400,
    'A reversed rate filter is rejected'
  );
  await expectError(
    () => run(fixture, { dateFrom: '2026-06-01', dateTo: '2026-05-01' }),
    400,
    'A reversed bill date range is rejected'
  );
  await expectError(
    () => run(fixture, { dateFrom: '2026-03-01', dateTo: '2026-06-01' }),
    400,
    'A bill date range starting before the financial year is rejected'
  );
  await expectError(
    () => run(fixture, { dateFrom: '2027-01-01', dateTo: '2027-06-01' }),
    400,
    'A bill date range ending after the financial year is rejected'
  );
}

async function runCoreSection(fixture: Fixture): Promise<void> {
  section('C. Core bill base run');

  const response = await run(fixture);
  assert(response.rows.length === 3, 'Only the three confirmed in-year purchase bills are returned');
  assert(response.pagination.total === 3, 'The pagination total matches the returned rows');
  assert(
    response.rows.every((row) => row.sourceType === 'PURCHASE'),
    'Purchase mode never mixes in debit notes'
  );
  assert(
    response.rows.map((row) => row.documentNo).join(',') === 'P15-PB-001,P15-PB-002,P15-PB-003',
    'Default order is bill date ascending'
  );
  assert(
    !response.rows.some((row) => row.documentNo === 'P15-PB-004'),
    'The cancelled bill is excluded by default'
  );
  assert(
    !response.rows.some((row) => row.documentNo === 'P15-PB-OLD'),
    'A bill dated outside the financial year never appears'
  );

  const billA = response.rows[0];
  assert(close(billA.taxableAmount, 10000), 'PB-001 taxable amount comes from the stored bill');
  assert(close(billA.billAmount, 10500), 'PB-001 bill amount comes from the stored bill');
  assert(close(billA.sgstAmount, 250) && close(billA.cgstAmount, 250), 'PB-001 GST split is the stored split');
  assert(billA.quantity === 100 && billA.unit === 'KG', 'PB-001 quantity and unit come from the stored item line');
  assert(close(billA.basicRate ?? 0, 100), 'Basic rate is gross value divided by quantity');
  assert(close(billA.avgRate ?? 0, 100), 'Average rate is taxable value divided by quantity');
  assert(close(billA.netRate ?? 0, 105), 'Net rate is bill amount divided by quantity');
  assert(billA.itemCount === 1, 'Item count reflects the single stored item line');
  assert(billA.partyName === 'Alpha Textiles' && billA.partyCity === 'Surat', 'Party name and city come from the party master');
  assert(billA.partyGstin === '24AAACC3333C1Z7', 'Party GSTIN comes from the party master');

  assert(close(response.totals.all.billAmount, 40950), 'Bill amount total equals 10500 + 11550 + 18900');
  assert(close(response.totals.all.taxableAmount, 39000), 'Taxable total equals 10000 + 11000 + 18000');
  assert(close(response.totals.all.igstAmount, 550), 'IGST total equals the stored IGST');
  assert(close(response.totals.all.sgstAmount, 700), 'SGST total equals 250 + 450');
  assert(response.totals.all.documentCount === 3, 'Document count equals the three bills');
  assert(response.totals.all.itemCount === 3, 'Item count equals the three stored item lines');
  assert(response.totals.grandTotalAllowed === true, 'A single purchase source allows a grand total');
  assert(close(response.totals.grandTotal ?? 0, 40950), 'The grand total equals the purchase total');
  assert(response.totals.bySource.length === 1, 'One source subtotal is reported');
  assert(response.totals.bySource[0].direction === 'PAYABLE', 'Purchase direction is PAYABLE');
  assert(
    response.rows.map((row) => row.values.srNo).join(',') === '1,2,3',
    'Sr No is assigned after sorting'
  );
  assert(
    response.warnings.some((warning) => warning.includes('Cancelled documents are excluded')),
    'The response states that cancelled documents are excluded'
  );
  assert(
    response.columns.some((column) => column.key === 'basicRate') &&
      !response.columns.some((column) => column.key === 'avgRate'),
    'The Basic rate column selection exposes only the basic rate'
  );
}

async function runFilterSection(fixture: Fixture): Promise<void> {
  section('D. Filters');

  const byParty = await run(fixture, { partyId: fixture.supplierSuratId });
  assert(byParty.rows.length === 2, 'Party filter keeps only that party (2 bills)');
  assert(
    byParty.rows.every((row) => row.partyName === 'Alpha Textiles'),
    'Party filter never leaks another party'
  );

  const byCity = await run(fixture, { partyCity: 'Bhiwandi' });
  assert(byCity.rows.length === 1 && byCity.rows[0].documentNo === 'P15-PB-003', 'City filter matches the real party city');

  const byCityLower = await run(fixture, { partyCity: '  bhiwandi ' });
  assert(byCityLower.rows.length === 1, 'City filter is trimmed and case insensitive');

  const byItem = await run(fixture, { itemId: 'Cotton Yarn 40s' });
  assert(byItem.rows.length === 1 && byItem.rows[0].documentNo === 'P15-PB-001', 'Item filter matches the stored item name');
  const byItemLower = await run(fixture, { itemId: 'cotton yarn 40s' });
  assert(byItemLower.rows.length === 1, 'Item filter is case insensitive');
  const byUnknownItem = await run(fixture, { itemId: 'No Such Item' });
  assert(byUnknownItem.rows.length === 0, 'An unknown item returns no rows instead of a fabricated match');

  const byRateFrom = await run(fixture, { rateFrom: 200 });
  assert(byRateFrom.rows.length === 1 && byRateFrom.rows[0].documentNo === 'P15-PB-002', 'Rate From filters on the basic rate');
  const byRateTo = await run(fixture, { rateTo: 100 });
  assert(
    byRateTo.rows.length === 2 &&
      byRateTo.rows.every((row) => (row.basicRate ?? 0) <= 100) &&
      byRateTo.rows.map((row) => row.documentNo).join(',') === 'P15-PB-001,P15-PB-003',
    'Rate To filters on the basic rate (100 and 90 qualify, 220 does not)'
  );
  const byRateRange = await run(fixture, { rateFrom: 50, rateTo: 150 });
  assert(byRateRange.rows.length === 2, 'A rate range keeps every bill inside the range');

  const byBook = await run(fixture, { bookId: fixture.bookId });
  assert(byBook.rows.length === 0, 'The book filter excludes purchase bills, which carry no book');
  assert(
    byBook.warnings.some((warning) => warning.includes('Book filter only matches Debit Notes')),
    'The book filter explains why purchase bills disappeared'
  );

  const emptyRange = await run(fixture, { dateFrom: '2026-12-01', dateTo: '2026-12-31' });
  assert(emptyRange.rows.length === 0, 'A date range with no documents returns no rows');
  assert(emptyRange.totals.all.billAmount === 0, 'An empty result has a zero total, not a fabricated one');
  assert(emptyRange.pagination.totalPages === 1, 'An empty result still reports one page');
}

async function runGroupingSection(fixture: Fixture): Promise<void> {
  section('E. Grouping and totals integrity');

  const partyWise = await run(fixture, { format: 'PARTY_WISE' });
  assert(partyWise.groupBy.join(',') === 'partyName', 'Party Wise groups by party name');
  assert(partyWise.groups.length === 2, 'Party Wise produces one group per real party');
  const groupTotal = partyWise.groups.reduce((sum, group) => sum + group.totals.billAmount, 0);
  assert(close(groupTotal, 40950), 'Group totals add up to the grand total');
  const alphaGroup = partyWise.groups.find((group) => group.label === 'Alpha Textiles');
  assert(alphaGroup !== undefined && close(alphaGroup.totals.billAmount, 22050), 'Alpha group total is 10500 + 11550');
  assert(alphaGroup !== undefined && alphaGroup.count === 2, 'Alpha group counts two documents');

  const dateWise = await run(fixture, { format: 'DATE_WISE' });
  assert(dateWise.groups.length === 3, 'Date Wise produces one group per distinct bill date');

  const cityWise = await run(fixture, { format: 'CITY_WISE' });
  assert(cityWise.groups.length === 2, 'City Wise produces one group per real city');

  const monthWiseAll = await run(fixture, { format: 'MONTH_WISE_ALL' });
  assert(monthWiseAll.groupBy.join(',') === 'month,sourceType', 'Month Wise All Report groups by month and source');
  assert(monthWiseAll.groups.length === 3, 'Month Wise All Report nests the source inside the month');

  const custom = await run(fixture, { groupBy: ['partyName', 'partyCity'] });
  assert(custom.groupBy.join(',') === 'partyName,partyCity', 'A custom grouping level is accepted');
  assert(
    custom.groups.every((group) => Array.isArray(group.children)),
    'Custom grouping nests child groups'
  );

  await expectError(() => run(fixture, { groupBy: ['broker'] }), 400, 'Grouping by a non-existent field is rejected');

  const qualityWise = await run(fixture, { format: 'QUALITY_WISE' });
  assert(
    qualityWise.warnings.some((warning) => warning.includes('Quality is recorded only on Debit Note lines')),
    'A partial format returns an explicit warning'
  );
  assert(qualityWise.groups.length === 1, 'Partial quality grouping falls into the honest "not recorded" group');
}

async function runSummarySection(fixture: Fixture): Promise<void> {
  section('F. Detail and summary modes');

  const summary = await run(fixture, { format: 'PARTY_WISE', detailMode: 'SUMMARY' });
  assert(summary.rows.length === 2, 'Summary mode returns one row per group');
  assert(
    summary.columns.some((column) => column.key === 'documentCount'),
    'Summary mode exposes the document count column'
  );
  const summaryTotal = summary.rows.reduce((sum, row) => sum + Number(row.values.billAmount ?? 0), 0);
  assert(close(summaryTotal, 40950), 'Summary rows add up to the same grand total');
  assert(summary.meta.detailMode === 'SUMMARY', 'The response reports the summary detail mode');

  const detail = await run(fixture, { format: 'PARTY_WISE', detailMode: 'DETAIL' });
  assert(detail.rows.length === 3, 'Detail mode keeps one row per document');
}

async function runSortPageSection(fixture: Fixture): Promise<void> {
  section('G. Sorting and pagination');

  const desc = await run(fixture, { sortBy: 'billAmount', sortDir: 'desc' });
  assert(desc.rows[0].documentNo === 'P15-PB-003', 'Descending bill amount puts the largest bill first');
  assert(close(desc.totals.all.billAmount, 40950), 'Sorting does not change the dataset-wide total');

  const asc = await run(fixture, { sortBy: 'billAmount', sortDir: 'asc' });
  assert(asc.rows[0].documentNo === 'P15-PB-001', 'Ascending bill amount puts the smallest bill first');

  const pageOne = await run(fixture, { page: 1, pageSize: 2 });
  assert(pageOne.rows.length === 2, 'Page one respects the page size');
  assert(pageOne.pagination.total === 3 && pageOne.pagination.totalPages === 2, 'Pagination reports two pages for three bills');
  assert(close(pageOne.totals.all.billAmount, 40950), 'Page totals stay dataset-wide');

  const pageTwo = await run(fixture, { page: 2, pageSize: 2 });
  assert(pageTwo.rows.length === 1 && pageTwo.rows[0].documentNo === 'P15-PB-003', 'Page two returns the remaining bill');

  const beyond = await run(fixture, { page: 9, pageSize: 2 });
  assert(beyond.rows.length === 0, 'A page beyond the end returns no rows');
}

async function runCancelledSection(fixture: Fixture): Promise<void> {
  section('H. Cancelled document handling');

  const included = await run(fixture, { includeCancelled: true });
  assert(included.rows.length === 4, 'Include Cancelled adds the cancelled bill');
  assert(
    included.rows.some((row) => row.documentNo === 'P15-PB-004' && row.status === 'CANCELLED'),
    'The cancelled bill is labelled with its real status'
  );
  assert(close(included.totals.all.billAmount, 45950), 'The cancelled bill is only counted when it is included');
  assert(
    !included.warnings.some((warning) => warning.includes('Cancelled documents are excluded')),
    'The exclusion warning disappears when cancelled documents are included'
  );
}

async function runSourceSection(fixture: Fixture): Promise<void> {
  section('I. Document sources and grand total direction');

  const selectedPurchase = await run(fixture, { mode: 'SELECTED', sources: ['PURCHASE'] });
  assert(selectedPurchase.rows.length === 3, 'Selected mode with Purchase matches Purchase mode');

  const purchaseOnlyNote = await run(fixture, { mode: 'SELECTED', sources: ['PURCHASE_DEBIT_NOTE'] });
  assert(purchaseOnlyNote.rows.length === 1, 'Purchase Debit Note source returns the purchase note only');
  assert(
    purchaseOnlyNote.rows[0].sourceType === 'PURCHASE_DEBIT_NOTE' && purchaseOnlyNote.rows[0].sourceId === fixture.purchaseNoteId,
    'The purchase debit note row points at the real note'
  );
  assert(
    close(purchaseOnlyNote.totals.all.billAmount, fixture.purchaseNoteTotal),
    'The purchase debit note total is the stored note total'
  );
  assert(
    purchaseOnlyNote.totals.grandTotalAllowed === true,
    'A single debit note source still allows a grand total'
  );

  const salesOnlyNote = await run(fixture, { mode: 'SELECTED', sources: ['SALES_DEBIT_NOTE'] });
  assert(salesOnlyNote.rows.length === 1, 'Sales Debit Note source returns the sales note only');
  assert(
    salesOnlyNote.rows[0].sourceType === 'SALES_DEBIT_NOTE' && salesOnlyNote.rows[0].sourceId === fixture.salesNoteId,
    'The sales debit note row points at the real note'
  );
  assert(
    close(salesOnlyNote.totals.all.billAmount, fixture.salesNoteTotal),
    'The sales debit note total is the stored note total'
  );
  assert(
    salesOnlyNote.totals.bySource[0].direction === 'RECEIVABLE_INCREASE',
    'Sales debit note direction is RECEIVABLE_INCREASE'
  );

  const mixed = await run(fixture, { mode: 'SELECTED', sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'] });
  assert(mixed.rows.length === 4, 'Mixed sources return every matching document');
  assert(mixed.totals.bySource.length === 2, 'Mixed sources report one subtotal per source');
  assert(mixed.totals.grandTotalAllowed === false, 'Mixed accounting directions forbid a single grand total');
  assert(mixed.totals.grandTotal === null, 'No grand total is invented when directions differ');
  assert(
    mixed.totals.grandTotalReason.length > 0 && /direction/i.test(mixed.totals.grandTotalReason),
    'The missing grand total is explained in words'
  );
  assert(
    mixed.totals.bySource.every((subtotal) => subtotal.billAmount > 0),
    'Each source subtotal carries its own real amount'
  );

  const allThree = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE', 'SALES_DEBIT_NOTE'],
  });
  assert(allThree.rows.length === 5, 'All three supported sources return five documents');
  assert(allThree.totals.bySource.length === 3, 'Three sources produce three subtotals');
  assert(allThree.totals.grandTotalAllowed === false, 'Three directions still forbid a single grand total');
  assert(
    allThree.warnings.some((warning) => warning.includes('No ')) === false,
    'No source warning is raised when every selected source has rows'
  );

  const noRowsSource = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'SALES_DEBIT_NOTE'],
    dateFrom: '2026-04-01',
    dateTo: '2026-05-31',
  });
  assert(
    noRowsSource.warnings.some((warning) => warning.includes('No Sales Debit Note documents matched')),
    'A selected source with no rows is called out explicitly'
  );
}

async function runExportSection(fixture: Fixture): Promise<void> {
  section('J. Excel export and full-row loading');

  const response = await run(fixture, { format: 'PARTY_WISE' });
  const exported = reportService.exportXlsx(response);
  assert(exported.buffer.length > 1000, 'The export buffer is a real workbook, not an empty stub');
  assert(exported.buffer[0] === 0x50 && exported.buffer[1] === 0x4b, 'The workbook starts with the ZIP signature PK');
  assert(exported.filename.toLowerCase().endsWith('.xlsx'), 'The export filename ends with .xlsx');
  assert(
    exported.filename.includes('2026-04-01') && exported.filename.includes('2027-03-31'),
    'The export filename carries the real date range'
  );
  const entries = readZipEntries(exported.buffer);
  const names = entries.map((entry) => entry.name);
  assert(names.includes('xl/worksheets/sheet1.xml'), 'The workbook contains a worksheet part');
  assert(names.includes('xl/workbook.xml') && names.includes('xl/styles.xml'), 'The workbook contains its workbook and styles parts');
  assert(names.includes('[Content_Types].xml') && names.includes('_rels/.rels'), 'The workbook contains the OOXML package parts');
  const sheetXml = entries.find((entry) => entry.name === 'xl/worksheets/sheet1.xml')?.content ?? '';
  assert(sheetXml.includes('<worksheet'), 'The worksheet part is real SpreadsheetML');
  assert(sheetXml.includes('t="inlineStr"'), 'Text cells are stored as inline strings');
  assert(sheetXml.includes('TOTAL'), 'The workbook contains the TOTAL footer row');
  assert(sheetXml.includes('P15-PB-001') && sheetXml.includes('P15-PB-003'), 'The workbook contains the real bill numbers');
  assert(sheetXml.includes('Alpha Textiles'), 'The workbook contains the real party name');

  const allRows = await reportService.execute(
    fixture.companyId,
    fixture.financialYearId,
    baseRequest({ page: 1, pageSize: 1 }),
    true
  );
  assert(allRows.rows.length === 3, 'Export mode ignores pagination and loads every row');
  assert(allRows.pagination.pageSize === 1, 'The requested page size is still reported honestly');
}

async function runItemDetailSection(fixture: Fixture): Promise<void> {
  section('K. Stored item detail lookup');

  const billDetails = await reportService.getItemDetails(fixture.companyId, 'PURCHASE', fixture.billAId);
  assert(billDetails.documentNo === 'P15-PB-001', 'Item details resolve the real bill number');
  assert(billDetails.itemLines.length === 1, 'The purchase bill exposes its single stored item line');
  assert(billDetails.itemLines[0].itemName === 'Cotton Yarn 40s', 'The item line name is the stored description');
  assert(close(billDetails.itemLines[0].taxableAmount, 10000), 'The item line taxable amount is the stored amount');

  const purchaseNoteDetails = await reportService.getItemDetails(
    fixture.companyId,
    'PURCHASE_DEBIT_NOTE',
    fixture.purchaseNoteId
  );
  assert(purchaseNoteDetails.sourceType === 'PURCHASE_DEBIT_NOTE', 'The purchase note detail keeps its source type');
  assert(purchaseNoteDetails.itemLines.length === 1, 'The purchase note exposes its stored line');
  assert(
    purchaseNoteDetails.itemLines[0].itemName === 'Cotton Yarn 40s' &&
      purchaseNoteDetails.itemLines[0].quality === '40s' &&
      purchaseNoteDetails.itemLines[0].grade === 'A' &&
      purchaseNoteDetails.itemLines[0].lotNumber === 'LOT-P15-1',
    'The stored note line keeps its item name, quality, grade and lot'
  );
  assert(
    close(purchaseNoteDetails.itemLines[0].quantity, 100) &&
      close(purchaseNoteDetails.itemLines[0].taxableAmount, 10000),
    'The stored note line keeps its real quantity and taxable amount'
  );

  const salesNoteDetails = await reportService.getItemDetails(fixture.companyId, 'SALES_DEBIT_NOTE', fixture.salesNoteId);
  assert(salesNoteDetails.sourceType === 'SALES_DEBIT_NOTE', 'The sales note detail keeps its source type');

  await expectError(
    () => reportService.getItemDetails(fixture.companyId, 'SALES', fixture.billAId),
    400,
    'Item details reject an unsupported source type'
  );
  await expectError(
    () => reportService.getItemDetails(fixture.companyId, 'PURCHASE', '00000000-0000-0000-0000-000000000000'),
    404,
    'Item details return 404 for an unknown document instead of empty fake lines'
  );
  await expectError(
    () => reportService.getItemDetails(fixture.companyId, 'PURCHASE', '   '),
    400,
    'Item details require a document id'
  );
}

async function runReadOnlySection(fixture: Fixture): Promise<void> {
  section('L. Read-only guarantee');

  const before = {
    bills: await prisma.purchaseBill.count({ where: { companyId: fixture.companyId } }),
    notes: await prisma.debitNote.count({ where: { companyId: fixture.companyId } }),
    journals: await prisma.journalLine.count({ where: { companyId: fixture.companyId } }),
  };

  await run(fixture, { format: 'PARTY_WISE' });
  await run(fixture, { mode: 'SELECTED', sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'] });
  await run(fixture, { detailMode: 'SUMMARY', format: 'MONTH_WISE_ALL' });

  const after = {
    bills: await prisma.purchaseBill.count({ where: { companyId: fixture.companyId } }),
    notes: await prisma.debitNote.count({ where: { companyId: fixture.companyId } }),
    journals: await prisma.journalLine.count({ where: { companyId: fixture.companyId } }),
  };

  assert(before.bills === after.bills, 'Running reports never creates or deletes purchase bills');
  assert(before.notes === after.notes, 'Running reports never creates or deletes debit notes');
  assert(before.journals === after.journals, 'Running reports never posts a journal entry');
}

async function main(): Promise<void> {
  console.log('Phase 15 - Sales & Purchase Report (Bill Base) service test');
  await cleanupTestData();

  const fixture = await buildFixture();
  try {
    await runOptionsSection(fixture);
    await runValidationSection(fixture);
    await runCoreSection(fixture);
    await runFilterSection(fixture);
    await runGroupingSection(fixture);
    await runSummarySection(fixture);
    await runSortPageSection(fixture);
    await runCancelledSection(fixture);
    await runSourceSection(fixture);
    await runExportSection(fixture);
    await runItemDetailSection(fixture);
    await runReadOnlySection(fixture);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 15 report tests: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

main().catch(async (error) => {
  console.error('\nPhase 15 report test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
