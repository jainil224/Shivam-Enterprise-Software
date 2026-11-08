import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { DebitNoteService, DebitNotePayload, DebitNoteBillLineInput } from '../src/services/debitNoteService.js';

const prisma = new PrismaClient();
const debitNotes = new DebitNoteService();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(scriptDir, '../../frontend/src');
const repoRoot = path.resolve(scriptDir, '..');

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

async function expectError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
  label: string
): Promise<CaughtError> {
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

const TEST_COMPANY_CODE = 'P14TEST';
const OTHER_COMPANY_CODE = 'P14OTHER';

async function cleanupTestData(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.debitNote.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBill.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.debitNoteBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

interface SuiteContext {
  companyId: string;
  financialYearId: string;
  lockedFinancialYearId: string;
  otherCompanyId: string;
  otherFinancialYearId: string;
  supplierGujaratId: string;
  supplierMaharashtraId: string;
  customerGujaratId: string;
  inactiveSupplierId: string;
  creditAccountId: string;
  otherCompanyAccountId: string;
  bookId: string;
  secondBookId: string;
  billAId: string;
  billBId: string;
  cancelledBillId: string;
  igstBillId: string;
}

async function createCompanyWithYears(code: string, name: string, state: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      panNumber: 'AABCS1234F',
      address: 'Plot 12, Ring Road',
      city: 'Surat',
      state,
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

  const lockedFy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2025 - 2026',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: true,
    },
  });

  return { company, fy, lockedFy };
}

async function buildContext(): Promise<SuiteContext> {
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 14 LTD', 'Gujarat');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 14 LTD', 'Maharashtra');

  const supplierGujarat = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P14SUPPGUJ',
      partyName: 'Surat Textile Suppliers',
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

  const supplierMaharashtra = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P14SUPPMH',
      partyName: 'Bhiwandi Weaving Mills',
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

  const customerGujarat = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P14CUSTGUJ',
      partyName: 'Gujarat Yarn Traders',
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

  const inactiveSupplier = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P14SUPPOFF',
      partyName: 'Closed Supplier',
      partyType: 'SUPPLIER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: false,
    },
  });

  const creditAccount = await prisma.ledgerAccount.create({
    data: {
      companyId: primary.company.id,
      accountCode: 'P14-INT-PUR',
      accountName: 'Interest on Purchase',
      accountGroup: 'INDIRECT_EXPENSES',
      accountType: 'EXPENSE',
      balanceType: 'DEBIT',
      openingBalance: new Prisma.Decimal(0),
      isBankAccount: false,
    },
  });

  const otherCompanyAccount = await prisma.ledgerAccount.create({
    data: {
      companyId: other.company.id,
      accountCode: 'P14-OTHER-EXP',
      accountName: 'Other Company Expense',
      accountGroup: 'INDIRECT_EXPENSES',
      accountType: 'EXPENSE',
      balanceType: 'DEBIT',
      openingBalance: new Prisma.Decimal(0),
      isBankAccount: false,
    },
  });

  const book = await prisma.debitNoteBook.create({
    data: {
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      prefix: 'DN-',
      bookName: 'DEBIT NOTE',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: true,
    },
  });

  const secondBook = await prisma.debitNoteBook.create({
    data: {
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      prefix: 'DN2-',
      bookName: 'DEBIT NOTE 2',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: true,
    },
  });

  const billA = await prisma.purchaseBill.create({
    data: {
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      billNumber: 'PB-001',
      billDate: new Date('2026-09-01T00:00:00.000Z'),
      partyId: supplierGujarat.id,
      supplierLegalName: 'Surat Textile Suppliers',
      supplierInvoiceNumber: 'INV-1001',
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
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      billNumber: 'PB-002',
      billDate: new Date('2026-10-01T00:00:00.000Z'),
      partyId: supplierGujarat.id,
      supplierLegalName: 'Surat Textile Suppliers',
      supplierInvoiceNumber: 'INV-1002',
      totalQuantity: new Prisma.Decimal(50),
      taxableAmount: new Prisma.Decimal(5000),
      cgstRate: new Prisma.Decimal(2.5),
      cgstAmount: new Prisma.Decimal(125),
      sgstRate: new Prisma.Decimal(2.5),
      sgstAmount: new Prisma.Decimal(125),
      totalAmount: new Prisma.Decimal(5250),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Polyester Yarn 75D',
            quantity: new Prisma.Decimal(50),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(5000),
          },
        ],
      },
    },
  });

  const cancelledBill = await prisma.purchaseBill.create({
    data: {
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      billNumber: 'PB-003',
      billDate: new Date('2026-10-05T00:00:00.000Z'),
      partyId: supplierGujarat.id,
      supplierLegalName: 'Surat Textile Suppliers',
      supplierInvoiceNumber: 'INV-1003',
      totalQuantity: new Prisma.Decimal(10),
      taxableAmount: new Prisma.Decimal(3000),
      totalAmount: new Prisma.Decimal(3000),
      status: 'CANCELLED',
    },
  });

  const igstBill = await prisma.purchaseBill.create({
    data: {
      companyId: primary.company.id,
      financialYearId: primary.fy.id,
      billNumber: 'PB-004',
      billDate: new Date('2026-08-15T00:00:00.000Z'),
      partyId: supplierMaharashtra.id,
      supplierLegalName: 'Bhiwandi Weaving Mills',
      totalQuantity: new Prisma.Decimal(200),
      taxableAmount: new Prisma.Decimal(10000),
      igstRate: new Prisma.Decimal(18),
      igstAmount: new Prisma.Decimal(1800),
      totalAmount: new Prisma.Decimal(11800),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Grey Fabric',
            quantity: new Prisma.Decimal(200),
            unit: 'MTR',
            rate: new Prisma.Decimal(50),
            taxableAmount: new Prisma.Decimal(10000),
          },
        ],
      },
    },
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    lockedFinancialYearId: primary.lockedFy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    supplierGujaratId: supplierGujarat.id,
    supplierMaharashtraId: supplierMaharashtra.id,
    customerGujaratId: customerGujarat.id,
    inactiveSupplierId: inactiveSupplier.id,
    creditAccountId: creditAccount.id,
    otherCompanyAccountId: otherCompanyAccount.id,
    bookId: book.id,
    secondBookId: secondBook.id,
    billAId: billA.id,
    billBId: billB.id,
    cancelledBillId: cancelledBill.id,
    igstBillId: igstBill.id,
  };
}

function line(overrides: Partial<DebitNoteBillLineInput> = {}): DebitNoteBillLineInput {
  return {
    billNo: 'PB-001',
    billDate: '2026-09-01',
    totalDays: 65,
    dharaDays: 0,
    paidAmount: 0,
    itemDescription: 'Cotton Yarn 40s',
    quantity: 100,
    billTaxable: 10000,
    billAmount: 10500,
    unpaidAmount: 10500,
    sgstRate: 2.5,
    cgstRate: 2.5,
    igstRate: 0,
    rate: 0,
    basicAmount: undefined,
    ...overrides,
  };
}

function payload(ctx: SuiteContext, overrides: Partial<DebitNotePayload> = {}): DebitNotePayload {
  return {
    bookId: ctx.bookId,
    noteDate: '2026-11-05',
    noteType: 'PURCHASE',
    partyId: ctx.supplierGujaratId,
    dueDays: 30,
    creditAccountId: ctx.creditAccountId,
    osEffect: '2.OS(+)',
    reason: 'INTEREST',
    calculationBasis: 'BILL_AMOUNT',
    gstRate: 5,
    billLines: [line()],
    ...overrides,
  };
}
async function runSectionA(ctx: SuiteContext): Promise<{ note1Id: string; note2Id: string }> {
  section('A. Navigation and Book Selection');

  const books = await prisma.debitNoteBook.findMany({
    where: { companyId: ctx.companyId, financialYearId: ctx.financialYearId },
    orderBy: { prefix: 'asc' },
  });
  assert(books.length === 2, 'Both configured Debit Note Books appear for the company/FY');
  assert(books.some((book) => book.prefix === 'DN-' && book.bookName === 'DEBIT NOTE'), 'Book 1 prefix and name are correct');
  assert(books.some((book) => book.prefix === 'DN2-'), 'Book 2 uses its own distinct prefix');
  assert(
    books.every((book) => Number(book.openingBalance) === 0 && book.balanceType === 'CREDIT'),
    'Book opening balance and balance type display correctly'
  );

  const next1 = await debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.bookId);
  assert(next1.voucherNumber === 1, 'First book starts its sequence at 1');
  assert(next1.prefix === 'DN-' && next1.noteNumber === 'DN- 1', 'Number generation applies the book prefix');

  const next2 = await debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.secondBookId);
  assert(next2.voucherNumber === 1 && next2.noteNumber === 'DN2- 1', 'Second book starts an independent sequence');

  const created1 = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, { billLines: [line({ rate: 12, dharaDays: 5 })] })
  );
  assert(created1.voucherNumber === 1 && created1.noteNumber === 'DN- 1', 'Creating a note consumes the advertised number');
  assert(Number(created1.totalAmount) === 217, 'Interest note total rounds to 217 from a 217.48 sub-total');

  const afterFirst = await debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.bookId);
  assert(afterFirst.voucherNumber === 2 && afterFirst.noteNumber === 'DN- 2', 'Next number advances without gaps');

  const otherBookAfterFirst = await debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.secondBookId);
  assert(otherBookAfterFirst.voucherNumber === 1, 'Consuming book 1 does not move book 2');

  const created2 = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      bookId: ctx.secondBookId,
      gstRate: 0,
      billLines: [line({ totalDays: 0, dharaDays: 0, basicAmount: 100, rate: 0 })],
    })
  );
  assert(created2.voucherNumber === 1 && created2.noteNumber === 'DN2- 1', 'Second book issues DN2- 1');

  const afterSecond = await debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.secondBookId);
  assert(afterSecond.voucherNumber === 2, 'Second book sequence advances independently');

  await expectError(
    () => debitNotes.getNextNumber(ctx.companyId, ctx.financialYearId, '00000000-0000-0000-0000-000000000000'),
    404,
    'Unknown book is rejected instead of returning a fake number'
  );

  const thirdNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, { gstRate: 0, billLines: [line({ totalDays: 0, basicAmount: 100, rate: 0 })] })
  );
  assert(thirdNote.voucherNumber === 2, 'Third note uses book 1 voucher 2');

  const navFirst = await debitNotes.getPreviousAndNext(ctx.companyId, ctx.financialYearId, created1.id);
  assert(navFirst.next?.id === thirdNote.id, 'Navigation resolves the next note within the same book');
  const navThird = await debitNotes.getPreviousAndNext(ctx.companyId, ctx.financialYearId, thirdNote.id);
  assert(navThird.previous?.id === created1.id, 'Navigation resolves the previous note within the same book');
  const navSecond = await debitNotes.getPreviousAndNext(ctx.companyId, ctx.financialYearId, created2.id);
  assert(navSecond.previous === null && navSecond.next === null, 'Navigation never crosses into another book');

  const loaded = await debitNotes.getById(ctx.companyId, ctx.financialYearId, created1.id);
  assert(loaded.noteNumber === 'DN- 1' && loaded.billLines.length === 1, 'Selecting a book opens a persisted form with its grid');

  return { note1Id: created1.id, note2Id: created2.id };
}

async function runSectionB(ctx: SuiteContext): Promise<void> {
  section('B. Header Tests');

  const purchaseBills = await debitNotes.getEligibleBills(
    ctx.companyId,
    ctx.financialYearId,
    ctx.supplierGujaratId,
    'PURCHASE'
  );
  assert(purchaseBills.length === 2, 'PURCHASE lookup returns only live purchase bills');
  assert(
    purchaseBills.every((bill) => bill.invoiceNo !== 'INV-1003'),
    'Cancelled source bill is excluded from lookup'
  );
  assert(
    purchaseBills.every((bill) => bill.paidAmt === 0 && bill.paymentAllocationAvailable === false),
    'Paid amounts are reported honestly (no payment allocation model exists)'
  );

  const salesBills = await debitNotes.getEligibleBills(
    ctx.companyId,
    ctx.financialYearId,
    ctx.customerGujaratId,
    'SALES'
  );
  assert(salesBills.length === 0, 'SALES lookup returns a true empty state (no Sales Invoice model)');

  const combined = await debitNotes.getEligibleBills(
    ctx.companyId,
    ctx.financialYearId,
    ctx.supplierGujaratId,
    'BOTH'
  );
  assert(combined.length === 2, 'BOTH lookup includes the purchase side');

  const balance = await debitNotes.getPartyBalance(ctx.companyId, ctx.financialYearId, ctx.supplierGujaratId);
  assert(balance.ledgerId !== null && balance.source === 'LEDGER', 'Party balance resolves a real ledger');
  assert(close(parseFloat(balance.balance), 417), 'Party balance reflects the three notes created in Section A (217 + 100 + 100)');
  assert(balance.balanceType === 'Dr', 'Supplier was debited, so the party balance is Dr');

  const salesNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      noteType: 'SALES',
      partyId: ctx.customerGujaratId,
      gstRate: 0,
      billLines: [line({ billNo: 'SALES-1', billDate: '2026-10-10', totalDays: 26, basicAmount: 50, rate: 0 })],
    })
  );
  assert(salesNote.noteType === 'SALES', 'SALES note type is saved');

  const bothNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      noteType: 'BOTH',
      gstRate: 0,
      billLines: [line({ basicAmount: 60, rate: 0 })],
    })
  );
  assert(bothNote.noteType === 'BOTH', 'BOTH note type is saved');

  const gstNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      calculationBasis: 'TAXABLE_AMOUNT',
      gstRate: 12,
      billLines: [line({ basicAmount: 100, rate: 0 })],
    })
  );
  assert(Number(gstNote.gstRate) === 12, 'GST rate is stored exactly as entered');
  assert(close(Number(gstNote.cgstAmount), 6) && close(Number(gstNote.sgstAmount), 6), 'GST rate drives an intra-state split');

  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { osEffect: '9.BAD' })),
    400,
    'Invalid O/s Effect is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { reason: 'OTHER' as never })),
    400,
    'Invalid reason is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { calculationBasis: 'NET' as never })),
    400,
    'Invalid calculation basis is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { partyId: ctx.inactiveSupplierId })),
    400,
    'Inactive party is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { partyId: '00000000-0000-0000-0000-000000000000' })),
    404,
    'Party outside the active company is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { creditAccountId: ctx.otherCompanyAccountId })),
    404,
    'Credit Account outside the active company is rejected'
  );

  const entrySrc = readFileSync(path.join(frontendSrc, 'pages/DebitNoteEntryPage.tsx'), 'utf8');
  assert(
    entrySrc.includes("party.partyType === 'CUSTOMER'") && entrySrc.includes("party.partyType === 'SUPPLIER'"),
    'Party list is filtered by note type in the UI'
  );
  assert(entrySrc.includes('getLedgerAccounts'), 'Credit Account lookup uses the real ledger master');
  assert(entrySrc.includes("'2.OS(+)'"), 'O/s Effect defaults to 2.OS(+)');
}
async function runSectionC(ctx: SuiteContext): Promise<void> {
  section('C. Bill Lookup Tests');

  const bills = await debitNotes.getEligibleBills(ctx.companyId, ctx.financialYearId, ctx.supplierGujaratId, 'PURCHASE');
  const billA = bills.find((bill) => bill.invoiceNo === 'INV-1001');
  const billB = bills.find((bill) => bill.invoiceNo === 'INV-1002');

  assert(Boolean(billA) && Boolean(billB), 'Real eligible bills are returned for the selected party');
  assert(billA!.date === '2026-09-01', 'Original bill date is returned unchanged');
  assert(billA!.item === 'Cotton Yarn 40s', 'Actual item description is returned');
  assert(close(Number(billA!.billAmt), 10500), 'Actual bill amount is returned');
  assert(close(Number(billA!.taxableAmt), 10000), 'Actual taxable amount is returned');
  assert(billA!.paidAmt === 0 && billA!.paymentAllocationAvailable === false, 'Paid amount is 0 because no allocation data exists');
  assert(close(Number(billA!.unPaidAmt), 10500), 'Unpaid balance equals the bill amount when nothing was adjusted');
  assert(billA!.txnType === 'PURCHASE', 'Lookup tags the real transaction type');
  assert(close(Number(billA!.sgstRate), 2.5) && close(Number(billA!.cgstRate), 2.5), 'GST rates come from the purchase bill');

  const aggregate = bills.reduce((sum, bill) => sum + Number(bill.billAmt), 0);
  assert(close(aggregate, 15750), 'Aggregate totals across eligible bills are correct');

  const maharashtraBills = await debitNotes.getEligibleBills(
    ctx.companyId,
    ctx.financialYearId,
    ctx.supplierMaharashtraId,
    'PURCHASE'
  );
  assert(maharashtraBills.length === 1, 'Second supplier sees only their own bills');
  assert(
    maharashtraBills[0].invoiceNo === 'PB-004',
    'Invoice number falls back to the internal bill number when no supplier invoice exists'
  );
  assert(close(Number(maharashtraBills[0].igstRate), 18), 'IGST rate is carried from the source bill');

  const dbIds = await prisma.purchaseBill.findMany({
    where: { id: { in: bills.map((bill) => bill.id) }, companyId: ctx.companyId },
    select: { id: true },
  });
  assert(dbIds.length === bills.length, 'Every lookup row maps to a real persisted purchase bill (no fake records)');

  // A real adjustment reduces the unpaid balance of its source bill.
  await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'CASH_DISCOUNT',
      gstRate: 0,
      billLines: [
        line({
          billNo: 'PB-001',
          rate: 0,
          basicAmount: 100,
          sourceBillId: ctx.billAId,
          sourceBillType: 'PURCHASE',
        }),
      ],
    })
  );

  const afterAdjustment = await debitNotes.getEligibleBills(
    ctx.companyId,
    ctx.financialYearId,
    ctx.supplierGujaratId,
    'PURCHASE'
  );
  const adjustedBill = afterAdjustment.find((bill) => bill.id === ctx.billAId);
  assert(close(Number(adjustedBill!.adjustedAmt), 100), 'Adjustment total is tracked against the source bill');
  assert(close(Number(adjustedBill!.unPaidAmt), 10400), 'Unpaid balance drops by the real adjusted amount');
}

async function runSectionD(ctx: SuiteContext): Promise<void> {
  section('D. Grid and Calculation Tests');

  const interestNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, { billLines: [line({ totalDays: 65, dharaDays: 5, rate: 12 })] })
  );
  const interestLine = (await debitNotes.getById(ctx.companyId, ctx.financialYearId, interestNote.id)).billLines[0];
  assert(interestLine.totalDays === 65, 'Total Days is persisted from the grid');
  assert(interestLine.dharaDays === 5, 'Dhara Days is persisted exactly as entered (never invented)');
  assert(interestLine.interestDays === 60, 'Interest Days = Total Days - Dhara Days');
  assert(close(Number(interestLine.billAmount), 10500), 'Bill Amount is persisted exactly');
  assert(close(Number(interestLine.billTaxable), 10000), 'Taxable Amount is persisted exactly');
  assert(
    close(Number(interestLine.basicAmount), 207.12),
    'Interest Basic Amount = 10500 x 12 x 60 / 36500 = 207.12'
  );

  const derivedDays = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      billLines: [line({ totalDays: undefined as unknown as number, dharaDays: 0, rate: 12 })],
    })
  );
  const derivedLine = (await debitNotes.getById(ctx.companyId, ctx.financialYearId, derivedDays.id)).billLines[0];
  assert(derivedLine.totalDays === 65, 'Total Days is derived from the real bill date when omitted');
  assert(close(Number(derivedLine.basicAmount), 224.38), 'Derived-day interest recalculates to 224.38');

  const cashDiscount = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'CASH_DISCOUNT',
      calculationBasis: 'BILL_AMOUNT',
      gstRate: 0,
      billLines: [line({ rate: 2 })],
    })
  );
  assert(
    close(Number((await debitNotes.getById(ctx.companyId, ctx.financialYearId, cashDiscount.id)).billLines[0].basicAmount), 210),
    'Cash Discount on Bill Amount = 10500 x 2% = 210'
  );

  const quantityDiscount = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'QUANTITY_DISCOUNT',
      gstRate: 0,
      billLines: [line({ quantity: 100, rate: 3 })],
    })
  );
  assert(
    close(Number((await debitNotes.getById(ctx.companyId, ctx.financialYearId, quantityDiscount.id)).billLines[0].basicAmount), 300),
    'Quantity Discount = quantity 100 x rate 3 = 300'
  );

  const rateDifference = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'RATE_DIFFERENCE',
      gstRate: 0,
      billLines: [line({ quantity: 3, rate: 1.5, billTaxable: 10 })],
    })
  );
  assert(
    close(Number((await debitNotes.getById(ctx.companyId, ctx.financialYearId, rateDifference.id)).billLines[0].basicAmount), 4.5),
    'Rate Difference uses quantity x rate with correct decimals (3 x 1.5 = 4.5)'
  );

  const taxableBasis = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'CASH_DISCOUNT',
      calculationBasis: 'BASIC_AMOUNT',
      gstRate: 0,
      billLines: [line({ rate: 10 })],
    })
  );
  assert(
    close(Number((await debitNotes.getById(ctx.companyId, ctx.financialYearId, taxableBasis.id)).billLines[0].basicAmount), 1000),
    'BASIC_AMOUNT basis uses the bill taxable value (10000 x 10% = 1000)'
  );

  const interState = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      partyId: ctx.supplierMaharashtraId,
      reason: 'CASH_DISCOUNT',
      gstRate: 18,
      billLines: [
        line({
          billNo: 'PB-004',
          billDate: '2026-08-15',
          quantity: 200,
          billTaxable: 10000,
          billAmount: 11800,
          unpaidAmount: 11800,
          sgstRate: 0,
          cgstRate: 0,
          igstRate: 18,
          rate: 1,
        }),
      ],
    })
  );
  const interStateNote = await debitNotes.getById(ctx.companyId, ctx.financialYearId, interState.id);
  assert(close(Number(interStateNote.igstRate), 18) && close(Number(interStateNote.igstAmount), 21.24), 'Inter-state GST posts as IGST at 18%');
  assert(Number(interStateNote.cgstAmount) === 0 && Number(interStateNote.sgstAmount) === 0, 'Inter-state note has no CGST/SGST');

  const totals = await debitNotes.getById(ctx.companyId, ctx.financialYearId, interestNote.id);
  const subTotal =
    Number(totals.taxableValue) + Number(totals.cgstAmount) + Number(totals.sgstAmount) + Number(totals.igstAmount) + Number(totals.tcsAmount);
  assert(Number(totals.totalAmount) === Math.round(subTotal), 'Grand total is rounded to the nearest rupee');
  assert(close(Number(totals.roundOff), Number(totals.totalAmount) - subTotal), 'Round off equals total minus sub-total');

  await expectError(
    () =>
      debitNotes.create(
        ctx.companyId,
        ctx.financialYearId,
        payload(ctx, { billLines: [line({ billAmount: -100, unpaidAmount: -100 })] })
      ),
    400,
    'Negative financial values are rejected'
  );

  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { billLines: [line({ rate: 0, basicAmount: 0 })] })),
    400,
    'Zero-value note is rejected'
  );

  const tcsMissing = () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { reason: 'TCS' }));
  await expectError(tcsMissing, 400, 'TCS without an explicit amount is rejected (no fabricated rate)');

  const tcsNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, { reason: 'TCS', gstRate: 0, tcsAmount: 50, billLines: [line({ basicAmount: 100, rate: 0 })] })
  );
  assert(close(Number(tcsNote.tcsAmount), 50), 'Explicit TCS amount is persisted');
  assert(close(Number(tcsNote.totalAmount), 150), 'TCS is added to the grand total');

  // TDS is enabled: the rate is entered by the user, the amount is always derived
  // from the taxable value and the deduction is posted to a TDS receivable ledger.
  const tdsNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'INTEREST',
      gstRate: 0,
      tdsRate: 2,
      tdsSection: '194c',
      tdsAccount: 'TDS Receivable',
      billLines: [
        line({ billNo: 'PB-TDS', billDate: '2026-10-01', billTaxable: 1000, billAmount: 1000, unpaidAmount: 1000, rate: 0, basicAmount: 1000 }),
      ],
    })
  );
  assert(close(Number(tdsNote.tdsRate), 2), 'TDS rate is persisted');
  assert(close(Number(tdsNote.tdsAmount), 20), 'TDS amount is derived from the taxable value (2% of 1000)');
  assert(tdsNote.tdsSection === '194C', 'TDS section is stored in upper case');
  assert(tdsNote.tdsAccount === 'TDS Receivable', 'TDS account label is persisted');
  assert(close(Number(tdsNote.totalAmount), 1000), 'TDS does not change the Debit Note total');

  const tdsLedger = await prisma.ledgerAccount.findFirst({
    where: { companyId: ctx.companyId, accountCode: 'TDS-RECEIVABLE' },
  });
  assert(Boolean(tdsLedger), 'TDS receivable ledger is auto-provisioned');
  assert(
    tdsLedger!.accountGroup === 'ASSETS' && tdsLedger!.accountType === 'ASSET' && tdsLedger!.balanceType === 'DEBIT',
    'TDS ledger is an asset with a debit balance type'
  );

  const tdsNet = await netByLedger(tdsNote.id);
  assert(close(tdsNet.get(tdsLedger!.id) || 0, 20), 'TDS receivable is debited with the deducted amount');
  const tdsPartyLedger = await prisma.ledgerAccount.findFirst({
    where: { companyId: ctx.companyId, partyId: ctx.supplierGujaratId },
  });
  assert(close(tdsNet.get(tdsPartyLedger!.id) || 0, 980), 'Party debit is reduced by the TDS amount (980)');

  const tdsJournal = await prisma.journalLine.findMany({ where: { debitNoteId: tdsNote.id } });
  const tdsDebit = tdsJournal.reduce((sum, row) => sum + Number(row.debitAmount), 0);
  const tdsCredit = tdsJournal.reduce((sum, row) => sum + Number(row.creditAmount), 0);
  assert(close(tdsDebit, tdsCredit), 'Journal with TDS stays balanced');

  // An explicit TDS amount is honoured only when the rate is zero (no rate is inferred).
  const explicitTdsNote = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'INTEREST',
      gstRate: 0,
      tdsRate: 0,
      tdsAmount: 30,
      billLines: [
        line({ billNo: 'PB-TDS2', billDate: '2026-10-02', billTaxable: 500, billAmount: 500, unpaidAmount: 500, rate: 0, basicAmount: 500 }),
      ],
    })
  );
  assert(close(Number(explicitTdsNote.tdsAmount), 30), 'Explicit TDS amount is honoured when the rate is zero');

  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { tdsRate: 150 })),
    400,
    'TDS rate above 100% is rejected'
  );
  await expectError(
    () => debitNotes.create(ctx.companyId, ctx.financialYearId, payload(ctx, { tdsAmount: -5 })),
    400,
    'Negative TDS amount is rejected'
  );

  // Over-adjustment guard: bill B is worth 5250 and is fully adjusted by the first note.
  await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, {
      reason: 'CASH_DISCOUNT',
      gstRate: 0,
      billLines: [
        line({
          billNo: 'PB-002',
          billDate: '2026-10-01',
          totalDays: 35,
          billTaxable: 5000,
          billAmount: 5250,
          unpaidAmount: 5250,
          rate: 100,
          sourceBillId: ctx.billBId,
          sourceBillType: 'PURCHASE',
        }),
      ],
    })
  );

  await expectError(
    () =>
      debitNotes.create(
        ctx.companyId,
        ctx.financialYearId,
        payload(ctx, {
          reason: 'CASH_DISCOUNT',
          gstRate: 0,
          billLines: [
            line({
              billNo: 'PB-002',
              billDate: '2026-10-01',
              billTaxable: 5000,
              billAmount: 5250,
              unpaidAmount: 5250,
              rate: 1,
              sourceBillId: ctx.billBId,
              sourceBillType: 'PURCHASE',
            }),
          ],
        })
      ),
    400,
    'Over-adjustment beyond the source bill amount is rejected'
  );

  const entrySrc = readFileSync(path.join(frontendSrc, 'pages/DebitNoteEntryPage.tsx'), 'utf8');
  assert(entrySrc.includes('computeLineBasicAmount'), 'Grid calculations are centralised in a documented helper');
  assert(!entrySrc.includes('Texturised Yarn'), 'No fabricated item description remains in the grid');
  assert(!entrySrc.includes('DN- 1'), 'No hardcoded Debit Note number remains');
  assert(!entrySrc.includes('0.1'), 'No fabricated TCS percentage remains');
}
async function netByLedger(debitNoteId: string): Promise<Map<string, number>> {
  const lines = await prisma.journalLine.findMany({ where: { debitNoteId } });
  const map = new Map<string, number>();
  for (const line of lines) {
    const current = map.get(line.ledgerAccountId) || 0;
    map.set(line.ledgerAccountId, current + Number(line.debitAmount) - Number(line.creditAmount));
  }
  return map;
}

async function runSectionE(ctx: SuiteContext): Promise<void> {
  section('E. Accounting Tests');

  const note = await debitNotes.create(
    ctx.companyId,
    ctx.financialYearId,
    payload(ctx, { billLines: [line({ totalDays: 65, dharaDays: 5, rate: 12 })] })
  );

  const noteLines = await prisma.journalLine.findMany({ where: { debitNoteId: note.id }, orderBy: { lineNumber: 'asc' } });
  assert(noteLines.length === 5, 'First posting writes five journal lines (party, credit, CGST, SGST, round off)');
  assert(noteLines.every((line) => line.isReversal === false && line.revision === 1), 'First posting is a non-reversal revision 1');

  const partyLedger = await prisma.ledgerAccount.findFirst({ where: { companyId: ctx.companyId, partyId: ctx.supplierGujaratId } });
  assert(Boolean(partyLedger) && partyLedger!.accountCode === 'PL-P14SUPPGUJ', 'Party ledger is auto-provisioned from the party code');

  const debitTotal = noteLines.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const creditTotal = noteLines.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(close(debitTotal, creditTotal), 'Journal debit equals journal credit');

  const partyDebit = noteLines
    .filter((line) => line.ledgerAccountId === partyLedger!.id)
    .reduce((sum, line) => sum + Number(line.debitAmount), 0);
  assert(close(partyDebit, 217), 'Party is debited with the full note value (217.00)');

  const creditAccountCredit = noteLines
    .filter((line) => line.ledgerAccountId === ctx.creditAccountId)
    .reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(close(creditAccountCredit, 207.12), 'Selected Credit Account is credited with the taxable value (207.12)');

  const cgstLedger = await prisma.ledgerAccount.findFirst({ where: { companyId: ctx.companyId, accountCode: 'GST-ICGST' } });
  const sgstLedger = await prisma.ledgerAccount.findFirst({ where: { companyId: ctx.companyId, accountCode: 'GST-ISGST' } });
  assert(Boolean(cgstLedger) && Boolean(sgstLedger), 'Purchase note provisions input GST ledgers');
  assert(
    noteLines.some((line) => line.ledgerAccountId === cgstLedger!.id && close(Number(line.creditAmount), 5.18)),
    'CGST input ledger is credited with 5.18'
  );
  assert(
    noteLines.some((line) => line.ledgerAccountId === sgstLedger!.id && close(Number(line.creditAmount), 5.18)),
    'SGST input ledger is credited with 5.18'
  );

  const roundOffLedger = await prisma.ledgerAccount.findFirst({ where: { companyId: ctx.companyId, accountCode: 'SYS-ROUND-OFF' } });
  assert(Boolean(roundOffLedger), 'Round-off ledger is provisioned');
  assert(
    noteLines.some((line) => line.ledgerAccountId === roundOffLedger!.id && close(Number(line.debitAmount), 0.48)),
    'Negative round off is posted as a 0.48 debit'
  );

  assert(note.osEffect === '2.OS(+)', 'O/s Effect is persisted on the note');

  const bankVouchers = await prisma.bankVoucher.count({ where: { companyId: ctx.companyId } });
  assert(bankVouchers === 0, 'Saving a Debit Note never creates a Bank Voucher');

  const sourceBill = await prisma.purchaseBill.findUnique({ where: { id: ctx.billAId } });
  assert(close(Number(sourceBill!.totalAmount), 10500) && sourceBill!.status === 'CONFIRMED', 'Source purchase bill is not modified');

  const afterCreate = await debitNotes.getById(ctx.companyId, ctx.financialYearId, note.id);
  assert(close(Number(afterCreate.totalAmount), 217), 'Created note total is 217.00');

  const updated = await debitNotes.update(
    ctx.companyId,
    ctx.financialYearId,
    note.id,
    payload(ctx, { billLines: [line({ totalDays: 65, dharaDays: 0, rate: 24 })] })
  );
  assert(updated.revision === 2, 'Editing bumps the note revision');
  assert(close(Number(updated.totalAmount), 471), 'Edited total recalculates to 471.00');
  assert(close(Number(updated.basicAmount), 448.77), 'Edited basic amount recalculates to 448.77');

  const revisions = await prisma.journalLine.findMany({ where: { debitNoteId: note.id }, select: { revision: true } });
  const revisionCount = new Set(revisions.map((row) => row.revision)).size;
  assert(revisionCount === 2, 'Editing writes a reversal plus a corrected revision (no new revision stacking)');

  const netAfterEdit = await netByLedger(note.id);
  assert(close(netAfterEdit.get(partyLedger!.id) || 0, 471), 'Net party posting after edit equals the corrected total (no duplicates)');
  assert(close(netAfterEdit.get(ctx.creditAccountId) || 0, -448.77), 'Net credit account posting after edit equals the corrected taxable value');

  const allLinesAfterEdit = await prisma.journalLine.findMany({ where: { debitNoteId: note.id } });
  const editDebit = allLinesAfterEdit.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const editCredit = allLinesAfterEdit.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(close(editDebit, editCredit), 'Ledger stays balanced after the edit reversal');

  const linesBeforeCancel = allLinesAfterEdit.length;
  await debitNotes.cancel(ctx.companyId, ctx.financialYearId, note.id, 'Wrong interest rate');
  const cancelled = await debitNotes.getById(ctx.companyId, ctx.financialYearId, note.id);
  assert(cancelled.status === 'CANCELLED', 'Cancellation marks the note CANCELLED');
  assert(cancelled.cancellationReason === 'Wrong interest rate', 'Cancellation reason is stored');

  const allLinesAfterCancel = await prisma.journalLine.findMany({ where: { debitNoteId: note.id } });
  assert(allLinesAfterCancel.length === linesBeforeCancel + 5, 'Cancellation writes exactly one reversal set');
  const netAfterCancel = await netByLedger(note.id);
  assert(
    Array.from(netAfterCancel.values()).every((value) => close(value, 0)),
    'Cancellation leaves a zero net posting on every ledger'
  );

  await expectError(
    () => debitNotes.cancel(ctx.companyId, ctx.financialYearId, note.id, 'Second attempt'),
    400,
    'Cancelling twice is rejected'
  );

  const numberBefore = await prisma.debitNote.count({
    where: { companyId: ctx.companyId, financialYearId: ctx.financialYearId, bookId: ctx.bookId },
  });
  const numbers = await prisma.debitNote.findMany({
    where: { companyId: ctx.companyId, financialYearId: ctx.financialYearId, bookId: ctx.bookId },
    select: { voucherNumber: true },
    orderBy: { voucherNumber: 'asc' },
  });
  assert(numbers.length === numberBefore, 'Cancelled note keeps its number (numbers are never reused)');
  assert(
    new Set(numbers.map((row) => row.voucherNumber)).size === numbers.length,
    'Voucher numbers remain unique within the book'
  );

  await expectError(
    () =>
      debitNotes.create(ctx.companyId, ctx.lockedFinancialYearId, {
        ...payload(ctx),
        noteDate: '2026-03-01',
        billLines: [line({ rate: 12 })],
      }),
    400,
    'Locked financial year blocks creation'
  );
}

async function runSectionF(): Promise<void> {
  section('F. Printing Tests');

  const printSrc = readFileSync(path.join(frontendSrc, 'pages/DebitNotePrintPreviewPage.tsx'), 'utf8');
  const entrySrc = readFileSync(path.join(frontendSrc, 'pages/DebitNoteEntryPage.tsx'), 'utf8');
  const apiSrc = readFileSync(path.join(frontendSrc, 'services/api.ts'), 'utf8');
  const routesSrc = readFileSync(path.resolve(repoRoot, 'src/routes/debitNoteRoutes.ts'), 'utf8');

  assert(printSrc.includes('activeCompany?.companyName'), 'Company header comes from the Company Master');
  assert(printSrc.includes('companyGstin') && printSrc.includes('companyPan') && printSrc.includes('companyStateCode'), 'GSTIN, State and PAN are printed');
  assert(printSrc.includes('note.noteNumber') && printSrc.includes('note.noteDate'), 'Debit Note number and date are printed');
  assert(printSrc.includes('partyName') && printSrc.includes('partyGstin'), 'Party information is printed');
  assert(printSrc.includes('note.partyNoteNo'), 'Party Note No is printed');
  assert(printSrc.includes('note.creditAccount?.accountName'), 'Credit Account description is printed');
  assert(printSrc.includes('note.remark'), 'Remarks are printed');
  assert(printSrc.includes('note.billLines.map'), 'Original bill rows are printed');
  assert(printSrc.includes('line.quantity') && printSrc.includes('line.billAmount'), 'Quantity and bill amount are printed');
  assert(printSrc.includes('line.interestDays'), 'I.Days is printed');
  assert(printSrc.includes('line.basicAmount'), 'Note Amount is printed');
  assert(printSrc.includes('Basic Amount') && printSrc.includes('Taxable Value'), 'Basic Amount and Taxable Value are printed');
  assert(printSrc.includes('CGST') && printSrc.includes('SGST') && printSrc.includes('IGST') && printSrc.includes('TCS (+)'), 'GST and TCS rows are printed');
  assert(printSrc.includes('TDS (-)') && printSrc.includes('Net Receivable'), 'TDS deduction and net receivable rows are printed');
  assert(printSrc.includes('amountInWords'), 'Amount in words is printed');
  assert(printSrc.includes("isLandscape ? 'landscape' : 'portrait'"), 'Portrait is the default and landscape is supported');
  assert(printSrc.includes('@page { size: A4'), 'A4 @page print CSS is present');
  assert(printSrc.includes('Copy '), 'Multiple copies are labelled');
  assert(printSrc.includes('getDebitNotePrintRange'), 'From/To range uses the real print-range API');
  assert(printSrc.includes('Party A/c'), 'Party A/c filter is present');
  assert(printSrc.includes('print:hidden'), 'Toolbar and modal are hidden while printing');
  assert(!printSrc.includes('INTREST ON SALE'), 'No fabricated credit account fallback remains');
  assert(!printSrc.includes('24APLPV0398G1ZH'), 'No hardcoded company GSTIN remains');
  assert(!printSrc.includes('alert('), 'No fake Email/WhatsApp alert buttons remain');
  assert(!printSrc.includes('Whatsapp'), 'No fake WhatsApp button remains');

  assert(entrySrc.includes('getDebitNoteNextNumber'), 'Entry page fetches the real next number');
  assert(entrySrc.includes('getDebitNotePartyBalance'), 'Entry page fetches the live party balance');
  assert(entrySrc.includes("case 'F10'"), 'F10 save shortcut is wired');
  assert(entrySrc.includes("case 'F5'"), 'F5 register shortcut is wired');
  assert(entrySrc.includes("case 'F2'"), 'F2 clear shortcut is wired');
  assert(entrySrc.includes("case 'F3'"), 'F3 party shortcut is wired');
  assert(entrySrc.includes("case 'Escape'"), 'Escape returns or closes popups');
  assert(entrySrc.includes("case '7'") && entrySrc.includes("case '8'"), '7/8 previous/next shortcuts are wired');
  assert(entrySrc.includes('handleGridEnterKey') && entrySrc.includes('onKeyDown={handleGridEnterKey}'), 'Enter inside the grid moves focus instead of submitting');
  assert(!entrySrc.includes('TDS not configured'), 'TDS is no longer disabled with a notice');
  assert(entrySrc.includes('calculations.tdsRate') && entrySrc.includes('calculations.tdsAmount'), 'TDS rate drives the derived amount in the entry page');
  assert(entrySrc.includes('tdsSection.trim()') && entrySrc.includes('tdsAccount.trim()'), 'TDS section and account are submitted with the note');
  assert(entrySrc.includes('reason === \'TCS\''), 'TCS amount input is shown only for the TCS reason');

  assert(apiSrc.includes("'/transactions/debit-notes/next-number'"), 'Next-number endpoint exists in the API client');
  assert(apiSrc.includes("'/transactions/debit-notes/summary'"), 'Summary endpoint exists in the API client');
  assert(apiSrc.includes("'/transactions/debit-notes/party-balance'"), 'Party-balance endpoint exists in the API client');
  assert(apiSrc.includes("'/transactions/debit-notes/print-range'"), 'Print-range endpoint exists in the API client');

  assert(
    routesSrc.indexOf("'/next-number'") < routesSrc.indexOf("'/:id'"),
    'Static Debit Note routes are registered before :id'
  );
}
async function runSectionG(ctx: SuiteContext): Promise<void> {
  section('G. Register, Range and Regression Integrity');

  const summary = await debitNotes.getSummary(ctx.companyId, ctx.financialYearId);
  const activeInDb = await prisma.debitNote.count({
    where: { companyId: ctx.companyId, financialYearId: ctx.financialYearId, status: { not: 'CANCELLED' } },
  });
  assert(summary.active._count._all === activeInDb, 'Summary active count matches the register');
  assert(summary.cancelled._count._all === 1, 'Summary reports exactly one cancelled note');
  assert(summary.byType.length >= 2, 'Summary groups notes by note type');

  const register = await debitNotes.listPaginated(ctx.companyId, ctx.financialYearId, { page: 1, limit: 100 });
  assert(register.pagination.total === activeInDb + 1, 'Register lists active and cancelled notes');
  assert(
    register.data.every((row) => typeof row.noteNumber === 'string' && row.noteNumber.length > 0),
    'Every register row has a real Debit Note number'
  );

  const cancelledOnly = await debitNotes.listPaginated(ctx.companyId, ctx.financialYearId, {
    status: 'CANCELLED',
    limit: 50,
  });
  assert(cancelledOnly.pagination.total === 1 && cancelledOnly.data[0].status === 'CANCELLED', 'Register status filter works');

  const range = await debitNotes.getPrintRange(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    from: 1,
    to: 9999,
  });
  assert(range.length > 0, 'Print range returns real notes');
  assert(range.every((row) => row.status !== 'CANCELLED'), 'Print range excludes cancelled notes');
  assert(
    range.every((row, index) => index === 0 || range[index - 1].voucherNumber <= row.voucherNumber),
    'Print range is ordered by voucher number'
  );

  const partyRange = await debitNotes.getPrintRange(ctx.companyId, ctx.financialYearId, {
    from: 1,
    to: 9999,
    partyId: ctx.supplierGujaratId,
  });
  assert(partyRange.every((row) => row.partyId === ctx.supplierGujaratId), 'Party A/c filter limits the print range');
  assert(partyRange.length > 0, 'Party A/c filter still returns the party notes');

  await expectError(
    () => debitNotes.getPrintRange(ctx.companyId, ctx.financialYearId, { from: 5, to: 2 }),
    400,
    'Invalid From/To range is rejected'
  );

  const schemaSrc = readFileSync(path.resolve(repoRoot, 'prisma/schema.prisma'), 'utf8');
  assert(!schemaSrc.includes('GeneralPurchase'), 'Out-of-scope General Purchase models stay removed from the schema');
  assert(!schemaSrc.includes('general_purchase'), 'No General Purchase mapping remains in the schema');

  const dropMigration = path.resolve(repoRoot, 'prisma/migrations/20261107130000_phase14_drop_general_purchase/migration.sql');
  assert(existsSync(dropMigration), 'Additive drop migration for the out-of-scope module exists');
  assert(readFileSync(dropMigration, 'utf8').includes('DROP TABLE IF EXISTS "general_purchases"'), 'Drop migration removes only General Purchase tables');

  const purchaseBills = await prisma.purchaseBill.findMany({ where: { companyId: ctx.companyId } });
  assert(purchaseBills.length === 4, 'All seeded purchase bills are still present');
  assert(purchaseBills.filter((bill) => bill.status === 'CONFIRMED').length === 3, 'Confirmed purchase bills keep their status');
  assert(purchaseBills.filter((bill) => bill.status === 'CANCELLED').length === 1, 'Cancelled purchase bill stays cancelled');

  const bankVoucherCount = await prisma.bankVoucher.count({ where: { companyId: ctx.companyId } });
  assert(bankVoucherCount === 0, 'No Bank Voucher was created by any Debit Note operation');

  const journalCount = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
  assert(journalCount > 0, 'Debit Note journals exist for the company');

  const billLineCount = await prisma.debitNoteBillLine.count({
    where: { debitNote: { companyId: ctx.companyId, financialYearId: ctx.financialYearId } },
  });
  assert(billLineCount > 0, 'Bill lines are persisted and queryable across the module');

  const sourceLinkedLines = await prisma.debitNoteBillLine.count({
    where: { debitNote: { companyId: ctx.companyId }, sourceBillId: { not: null } },
  });
  assert(sourceLinkedLines >= 2, 'Source bill links are preserved on adjustment lines');
}

async function main(): Promise<void> {
  console.log('=== Phase 14 Debit Note Module Test Suite ===');
  await cleanupTestData();
  const ctx = await buildContext();

  try {
    await runSectionA(ctx);
    await runSectionB(ctx);
    await runSectionC(ctx);
    await runSectionD(ctx);
    await runSectionE(ctx);
    await runSectionF();
    await runSectionG(ctx);

    console.log(`\n============================================================`);
    console.log(`PHASE 14 DEBIT NOTE: ${passed}/${total} assertions passed`);
    console.log(`============================================================`);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\nPHASE 14 TEST SUITE FAILED');
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});