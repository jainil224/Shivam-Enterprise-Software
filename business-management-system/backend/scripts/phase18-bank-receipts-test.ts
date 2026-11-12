// Phase 18 - Bank Receipt Entry (Cheque Receipt) full-stack verification suite.
// Every fixture lives inside throwaway companies (P18TEST / P18OTHER) and is
// removed again in the finally block. The live company is never touched.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { BankReceiptService } from '../src/services/bankReceiptService.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';

const prisma = new PrismaClient();
const receiptService = new BankReceiptService();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

const scriptDir = __dirname;
const repoRoot = path.resolve(scriptDir, '../..');

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log(`  PASS [${total}]: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL [${total}]: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n--- ${title} ---`);
}

interface CaughtError {
  statusCode?: number;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

async function expectError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
  label: string,
  expectedField?: string
): Promise<CaughtError> {
  try {
    await fn();
  } catch (error) {
    const err = error as CaughtError;
    const fieldMatched =
      !expectedField || (err.errors ?? []).some((item) => item.field === expectedField);
    assert(
      err.statusCode === expectedStatus && fieldMatched,
      `${label} (expected ${expectedStatus}, received ${err.statusCode ?? 'none'}${
        fieldMatched ? '' : ' / field mismatch'
      }: ${err.message})`
    );
    return err;
  }
  assert(false, `${label} (expected rejection with ${expectedStatus}, but the call succeeded)`);
  return { message: '' };
}

const TEST_COMPANY_CODE = 'P18TEST';
const OTHER_COMPANY_CODE = 'P18OTHER';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.bankReceiptAdjustmentLine.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.bankReceiptBillAllocation.deleteMany({
    where: { companyId: { in: companyIds } },
  });
  await prisma.bankVoucherLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBill.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReceiptBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankInstrumentMaster.deleteMany({ where: { companyId: { in: companyIds } } });
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
  bankLedgerId: string;
  secondBankLedgerId: string;
  expenseLedgerId: string;
  incomeLedgerId: string;
  capitalLedgerId: string;
  partyAId: string;
  partyBId: string;
  inactivePartyId: string;
  billA1Id: string;
  billA2Id: string;
  billA3Id: string;
  billBId: string;
  instrumentHdfcId: string;
  instrumentIciciId: string;
  bookId: string;
}

async function createCompanyWithYears(code: string, name: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 18, Ring Road',
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
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 18 LTD');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 18 LTD');

  const bankLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1001',
    accountName: 'HDFC Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'HDFC Bank',
    branchName: 'Ring Road, Surat',
    accountHolderName: 'SHIVAM ENTERPRISE',
    ifscCode: 'HDFC0001234',
    bankAccountNumber: '50200012345678',
  });

  const secondBankLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1002',
    accountName: 'ICICI Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'ICICI Bank',
    branchName: 'Adajan, Surat',
    ifscCode: 'ICIC0004567',
  });

  const expenseLedger = await ledgerService.create(primary.company.id, {
    accountCode: '5001',
    accountName: 'Discount Allowed',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const incomeLedger = await ledgerService.create(primary.company.id, {
    accountCode: '4001',
    accountName: 'Interest Received',
    accountGroup: 'INDIRECT_INCOME',
    openingBalance: '0.00',
  });

  const capitalLedger = await ledgerService.create(primary.company.id, {
    accountCode: '3001',
    accountName: 'Capital Account',
    accountGroup: 'CAPITAL',
    openingBalance: '0.00',
  });

  const partyA = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P18CUSTA',
      partyName: 'Mumbai Fashions Pvt Ltd',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
      address: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      phone: '9820011223',
    },
  });

  const partyB = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P18CUSTB',
      partyName: 'Surat Saree House',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      phone: '9820033445',
    },
  });

  const inactiveParty = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P18INACT',
      partyName: 'Closed Customer',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
      isActive: false,
    },
  });

  const makeBill = async (billNumber: string, partyId: string, totalAmount: string, status: 'CONFIRMED' | 'DRAFT', billDate: string) =>
    prisma.purchaseBill.create({
      data: {
        companyId: primary.company.id,
        financialYearId: primary.fy.id,
        billNumber,
        billDate: new Date(`${billDate}T00:00:00.000Z`),
        partyId,
        supplierLegalName: 'Test Supplier',
        totalAmount: new Prisma.Decimal(totalAmount),
        status,
      },
    });

  const billA1 = await makeBill('P18-PUR-001', partyA.id, '10000.00', 'CONFIRMED', '2026-04-10');
  const billA2 = await makeBill('P18-PUR-002', partyA.id, '5000.00', 'CONFIRMED', '2026-04-12');
  const billA3 = await makeBill('P18-PUR-003', partyA.id, '2000.00', 'CONFIRMED', '2026-04-14');
  await makeBill('P18-PUR-DRAFT', partyA.id, '4000.00', 'DRAFT', '2026-04-15');
  const billB = await makeBill('P18-PUR-004', partyB.id, '3000.00', 'CONFIRMED', '2026-04-16');

  const instrumentHdfc = await receiptService.createInstrument(primary.company.id, {
    code: 'HDFC',
    description: 'HDFC Bank',
  });
  const instrumentIcici = await receiptService.createInstrument(primary.company.id, {
    code: 'ICICI',
    description: 'ICICI Bank',
  });

  const book = await receiptService.createBook(primary.company.id, primary.fy.id, {
    prefix: 'BR',
    bookName: 'HDFC Cheque Receipt Book',
    bankAccountLedgerId: bankLedger.id,
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    lockedFinancialYearId: primary.lockedFy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    bankLedgerId: bankLedger.id,
    secondBankLedgerId: secondBankLedger.id,
    expenseLedgerId: expenseLedger.id,
    incomeLedgerId: incomeLedger.id,
    capitalLedgerId: capitalLedger.id,
    partyAId: partyA.id,
    partyBId: partyB.id,
    inactivePartyId: inactiveParty.id,
    billA1Id: billA1.id,
    billA2Id: billA2.id,
    billA3Id: billA3.id,
    billBId: billB.id,
    instrumentHdfcId: instrumentHdfc.id,
    instrumentIciciId: instrumentIcici.id,
    bookId: book.id,
  };
}
const balanceOf = async (ctx: SuiteContext, ledgerId: string): Promise<number> =>
  Number((await ledgerService.getById(ctx.companyId, ctx.financialYearId, ledgerId)).currentBalance);

const bankBalance = async (ctx: SuiteContext): Promise<number> => balanceOf(ctx, ctx.bankLedgerId);

const loadReceipt = async (ctx: SuiteContext, id: string) =>
  voucherService.getById(ctx.companyId, ctx.financialYearId, 'RECEIPT', id);

async function runBookSuite(ctx: SuiteContext) {
  section('Bank Receipt Book master (prefix, real ledger balance, isolation)');

  const books = await receiptService.listBooks(ctx.companyId, ctx.financialYearId);
  assert(books.length === 1, 'Exactly one receipt book exists for the fixture company');
  const book = books[0];
  assert(
    book.prefix === 'BR' && book.bookName === 'HDFC Cheque Receipt Book',
    'Book keeps its prefix and name'
  );
  assert(
    book.bankAccount.id === ctx.bankLedgerId &&
      book.bankAccount.bankAccountNumber === '50200012345678',
    'Book is linked to the real bank ledger and exposes its bank account number'
  );
  assert(
    book.balance.nature === 'Dr' && book.balance.amount === '0.00',
    `Book balance comes from the linked ledger (${book.balance.amount} ${book.balance.nature})`
  );

  const next = await receiptService.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.bookId);
  assert(
    next.voucherNumber === 'BR-2026-0001',
    `Next voucher number uses prefix + FY year + 4 digits (${next.voucherNumber})`
  );

  await expectError(
    () =>
      receiptService.createBook(ctx.companyId, ctx.financialYearId, {
        prefix: 'BR2',
        bookName: 'HDFC Cheque Receipt Book',
        bankAccountLedgerId: ctx.bankLedgerId,
      }),
    400,
    'Duplicate book name in the same company and financial year is rejected',
    'bookName'
  );

  await expectError(
    () =>
      receiptService.createBook(ctx.companyId, ctx.financialYearId, {
        prefix: 'BR',
        bookName: 'Second Book',
        bankAccountLedgerId: ctx.secondBankLedgerId,
      }),
    400,
    'Duplicate prefix in the same financial year is rejected',
    'prefix'
  );

  await expectError(
    () =>
      receiptService.createBook(ctx.companyId, ctx.financialYearId, {
        prefix: 'EXP',
        bookName: 'Expense Book',
        bankAccountLedgerId: ctx.expenseLedgerId,
      }),
    400,
    'A ledger that is not a bank account cannot back a receipt book',
    'bankAccountLedgerId'
  );

  const foreignBank = await ledgerService.create(ctx.otherCompanyId, {
    accountCode: '9001',
    accountName: 'Foreign Bank Account',
    accountGroup: 'BANK',
    bankName: 'Axis Bank',
    openingBalance: '0.00',
  });

  await expectError(
    () =>
      receiptService.createBook(ctx.companyId, ctx.financialYearId, {
        prefix: 'XC',
        bookName: 'Cross Company Book',
        bankAccountLedgerId: foreignBank.id,
      }),
    400,
    'A bank ledger owned by another company is rejected',
    'bankAccountLedgerId'
  );

  const otherBooks = await receiptService.listBooks(ctx.otherCompanyId, ctx.otherFinancialYearId);
  assert(otherBooks.length === 0, 'Other company sees none of this company receipt books');

  await expectError(
    () => receiptService.getBook(ctx.otherCompanyId, ctx.otherFinancialYearId, ctx.bookId),
    404,
    'Reading a book from another company context is a 404'
  );

  const secondBook = await receiptService.createBook(ctx.companyId, ctx.financialYearId, {
    prefix: 'BR2',
    bookName: 'ICICI Cheque Receipt Book',
    bankAccountLedgerId: ctx.secondBankLedgerId,
  });
  assert(
    secondBook.bankAccount.id === ctx.secondBankLedgerId,
    'A second book can link the same company second bank ledger'
  );
  const secondNext = await receiptService.getNextNumber(
    ctx.companyId,
    ctx.financialYearId,
    secondBook.id
  );
  assert(
    secondNext.voucherNumber === 'BR2-2026-0001',
    `Second book previews its own prefix (${secondNext.voucherNumber})`
  );

  const deactivated = await receiptService.updateBook(
    ctx.companyId,
    ctx.financialYearId,
    secondBook.id,
    { isActive: false }
  );
  assert(deactivated.isActive === false, 'A receipt book can be deactivated without deleting history');
  await receiptService.updateBook(ctx.companyId, ctx.financialYearId, secondBook.id, {
    isActive: true,
  });
}

async function runInstrumentSuite(ctx: SuiteContext) {
  section('Bank Name (instrument) master');

  const all = await receiptService.listInstruments(ctx.companyId, {});
  assert(all.length === 2, 'Two instrument codes exist after fixture setup');

  const filtered = await receiptService.listInstruments(ctx.companyId, { search: 'ICICI' });
  assert(
    filtered.length === 1 && filtered[0].code === 'ICICI' && filtered[0].description === 'ICICI Bank',
    'Instrument search matches code and returns its description'
  );

  await expectError(
    () =>
      receiptService.createInstrument(ctx.companyId, {
        code: 'HDFC',
        description: 'Duplicate HDFC',
      }),
    400,
    'Duplicate instrument code is rejected',
    'code'
  );

  await expectError(
    () => receiptService.createInstrument(ctx.companyId, { code: '', description: 'No code' }),
    400,
    'Instrument code is required',
    'code'
  );

  const otherInstruments = await receiptService.listInstruments(ctx.otherCompanyId, {});
  assert(otherInstruments.length === 0, 'Instrument master is company isolated');
}

async function runLookupSuite(ctx: SuiteContext) {
  section('Party lookup and outstanding bills');

  const parties = await receiptService.lookupParties(ctx.companyId, ctx.financialYearId, {
    search: 'Mumbai',
  });
  const found = parties.find((party) => party.id === ctx.partyAId);
  assert(Boolean(found), 'Party lookup finds the party by name');
  assert(
    found?.address === '12 Marine Drive' &&
      found?.city === 'Mumbai' &&
      found?.phone === '9820011223',
    'Party lookup returns address, city and mobile for the popup'
  );
  assert(
    found?.brokerName === null && found?.salespersonName === null,
    'Unstored party fields are returned as null instead of fabricated values'
  );
  assert(
    found?.balance.nature === 'Dr' || found?.balance.nature === 'Cr',
    'Party lookup exposes a signed ledger balance'
  );

  const outstanding = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyAId,
  });
  assert(outstanding.bills.length === 3, 'Only CONFIRMED purchase bills are offered as outstanding');
  assert(
    outstanding.totals.billAmount === '17000.00' && outstanding.totals.balance === '17000.00',
    `Outstanding totals reflect the three real bills (${outstanding.totals.billAmount})`
  );
  assert(
    outstanding.bills.every((bill) => bill.typeCode === 'PUR' && bill.dueValue === null),
    'Outstanding rows carry the real source type code and a null due value'
  );
  assert(
    outstanding.bills.every((bill) => bill.billTds === '0.00' && bill.currentReceived === '0.00'),
    'Bill TDS and current receipt start at zero before allocation'
  );

  const partyBOutstanding = await receiptService.outstandingBills(
    ctx.companyId,
    ctx.financialYearId,
    { partyId: ctx.partyBId }
  );
  assert(
    partyBOutstanding.bills.length === 1 &&
      partyBOutstanding.bills[0].billNumber === 'P18-PUR-004',
    'Outstanding bills are scoped to the selected party'
  );

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyAId,
    receiptAmount: '4000.00',
    allocations: [{ purchaseBillId: ctx.billA1Id, allocatedAmount: '3000.00' }],
  });
  assert(
    validation.allocations.length === 1 &&
      validation.allocations[0].allocatedAmount === '3000.00' &&
      validation.allocations[0].balanceAfter === '7000.00' &&
      validation.chequeBalance === '1000.00',
    'Allocation validation returns the real balance after the allocation and the unallocated cheque balance'
  );

  await expectError(
    () =>
      receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
        partyId: ctx.partyAId,
        receiptAmount: '9000.00',
        allocations: [{ purchaseBillId: ctx.billA3Id, allocatedAmount: '2500.00' }],
      }),
    400,
    'Allocating more than the bill balance is rejected before saving',
    'allocations'
  );
}
interface CreatedReceipts {
  voucher1Id: string;
  voucher2Id: string;
  voucher3Id: string;
  partyALedgerId: string;
  partyBLedgerId: string;
}

async function partyLedgerId(ctx: SuiteContext, partyId: string): Promise<string> {
  const ledger = await prisma.ledgerAccount.findFirst({
    where: { companyId: ctx.companyId, partyId },
    select: { id: true },
  });
  assert(Boolean(ledger), `Party ${partyId} is linked to a real ledger account`);
  return ledger?.id ?? '';
}

async function runCreateSuite(ctx: SuiteContext): Promise<CreatedReceipts> {
  section('Create: one bank debit, many party credits');

  const before = await bankBalance(ctx);
  assert(before === 0, 'Bank ledger starts at zero before the first receipt');

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-10',
    narration: 'Two party cheque receipt',
    lines: [
      {
        partyId: ctx.partyAId,
        bankInstrumentId: ctx.instrumentHdfcId,
        chequeNumber: '100001',
        description: 'Part payment',
        amount: '10000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
      {
        partyId: ctx.partyBId,
        bankInstrumentId: ctx.instrumentIciciId,
        chequeNumber: '100002',
        description: 'Advance receipt',
        amount: '3000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
    ],
  });

  const view = await loadReceipt(ctx, created.id);
  assert(
    view.voucherNumber === 'BR-2026-0001',
    `Voucher number comes from the sequence (${view.voucherNumber})`
  );
  assert(
    view.status === 'POSTED' && view.receiptRowCount === 2,
    'Voucher is POSTED and records two receipt rows under one voucher number'
  );
  assert(
    view.receiptLines?.length === 2 &&
      view.receiptLines[0].party?.id === ctx.partyAId &&
      view.receiptLines[1].party?.id === ctx.partyBId,
    'Detail view returns every party row, not only the first'
  );
  assert(
    view.amount === '13000.00' && view.receiptBook?.prefix === 'BR',
    'Header amount is the sum of the rows and the receipt book is linked'
  );

  const journal = view.journalLines ?? [];
  const revisionOne = journal.filter((line) => line.revision === 1);
  assert(revisionOne.length === 3, 'Revision 1 posts three journal lines (bank + two parties)');

  const partyALedgerId = await partyLedgerId(ctx, ctx.partyAId);
  const partyBLedgerId = await partyLedgerId(ctx, ctx.partyBId);

  const bankLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.bankLedgerId);
  assert(
    bankLine?.debitAmount === '13000.00' && bankLine?.creditAmount === '0.00',
    'Bank ledger is debited with the exact sum of the rows'
  );
  const partyALine = revisionOne.find((line) => line.ledgerAccount.id === partyALedgerId);
  const partyBLine = revisionOne.find((line) => line.ledgerAccount.id === partyBLedgerId);
  assert(
    partyALine?.creditAmount === '10000.00' && partyBLine?.creditAmount === '3000.00',
    'Each party ledger is credited with its own row amount'
  );

  const debitTotal = revisionOne.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const creditTotal = revisionOne.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(
    Math.abs(debitTotal - creditTotal) < 0.005 && Math.abs(debitTotal - 13000) < 0.005,
    'Journal revision 1 is balanced for the full receipt amount'
  );

  assert(
    Math.abs((await bankBalance(ctx)) - 13000) < 0.005,
    'Bank ledger balance increased by the real receipt amount'
  );
  assert(
    Math.abs((await balanceOf(ctx, partyALedgerId)) + 10000) < 0.005 &&
      Math.abs((await balanceOf(ctx, partyBLedgerId)) + 3000) < 0.005,
    'Party ledgers carry the exact credit balances'
  );

  const neighbours = await receiptService.neighbours(ctx.companyId, ctx.financialYearId, created.id);
  assert(
    neighbours.previous === null && neighbours.next === null,
    'A single voucher has no previous or next neighbour'
  );

  return {
    voucher1Id: created.id,
    voucher2Id: '',
    voucher3Id: '',
    partyALedgerId,
    partyBLedgerId,
  };
}

async function runAdjustmentSuite(ctx: SuiteContext, created: CreatedReceipts) {
  section('Against Bill: allocations, journal adjustments and revalidation');

  const preview = await receiptService.adjustmentPreview(ctx.companyId, ctx.financialYearId, {
    adjustmentLedgerAccountId: ctx.expenseLedgerId,
    adjustmentAmount: '500.00',
    drCr: 'DR',
    calculationType: 'AMT',
    partyName: 'Mumbai Fashions Pvt Ltd',
  });
  assert(
    preview.lines[0].drCr === 'DR' &&
      preview.lines[0].accountName === 'Discount Allowed' &&
      preview.lines[1].drCr === 'CR' &&
      preview.partyEffect.drCr === 'CR',
    'Journal Voucher Auto preview debits the adjustment head and credits the party'
  );
  assert(
    preview.totalDebit === preview.totalCredit && preview.balanced === true,
    'Adjustment preview is balanced before confirmation'
  );

  const receipt = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-11',
    narration: 'Allocated receipt with discount and interest',
    lines: [
      {
        partyId: ctx.partyAId,
        bankInstrumentId: ctx.instrumentHdfcId,
        chequeNumber: '100003',
        amount: '4000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billA1Id, allocatedAmount: '3000.00' }],
        adjustments: [
          {
            purchaseBillId: ctx.billA1Id,
            adjustmentLedgerAccountId: ctx.expenseLedgerId,
            calculationType: 'AMT',
            adjustmentAmount: '500.00',
            drCr: 'DR',
            note: 'Cash discount',
          },
          {
            purchaseBillId: ctx.billA1Id,
            adjustmentLedgerAccountId: ctx.incomeLedgerId,
            calculationType: 'AMT',
            adjustmentAmount: '200.00',
            drCr: 'CR',
            note: 'Late payment interest',
          },
        ],
      },
    ],
  });

  const view = await loadReceipt(ctx, receipt.id);
  assert(
    view.voucherNumber === 'BR-2026-0002',
    `Second receipt takes the next number (${view.voucherNumber})`
  );
  const revisionOne = (view.journalLines ?? []).filter((line) => line.revision === 1);
  const bankLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.bankLedgerId);
  const partyLine = revisionOne.find((line) => line.ledgerAccount.id === created.partyALedgerId);
  const expenseLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.expenseLedgerId);
  const incomeLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.incomeLedgerId);

  assert(
    bankLine?.debitAmount === '4000.00',
    'Bank is debited with the row amount only (adjustments do not change the cheque)'
  );
  assert(
    partyLine?.creditAmount === '4300.00',
    'Party is credited with amount + DR adjustment - CR adjustment (4300.00)'
  );
  assert(
    expenseLine?.debitAmount === '500.00' && incomeLine?.creditAmount === '200.00',
    'Each adjustment posts its own DR/CR journal line on the selected head'
  );
  const debitTotal = revisionOne.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const creditTotal = revisionOne.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(
    Math.abs(debitTotal - 4500) < 0.005 && Math.abs(creditTotal - 4500) < 0.005,
    `Adjustment posting stays balanced (DR ${debitTotal} = CR ${creditTotal})`
  );

  const row = view.receiptLines?.[0];
  assert(
    row?.adjustmentMode === 'AGAINST_BILL' &&
      row.allocations.length === 1 &&
      row.allocations[0].allocatedAmount === '3000.00' &&
      row.allocations[0].balanceAfter === '7000.00' &&
      row.allocations[0].status === 'ACTIVE',
    'Allocation is stored against the real bill with the balance after allocation'
  );
  assert(
    row?.allocations[0].adjustments.length === 2 &&
      row.allocations[0].adjustments.every((adjustment) => adjustment.status === 'ACTIVE'),
    'Both journal adjustments are linked to the receipt allocation and active'
  );

  const outstanding = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyAId,
  });
  const billA1 = outstanding.bills.find((bill) => bill.id === ctx.billA1Id);
  assert(
    billA1?.previousReceived === '3300.00' && billA1?.balance === '6700.00',
    `Outstanding bill now shows pre-received 3300.00 and balance 6700.00 (received ${billA1?.balance})`
  );

  const neighbours = await receiptService.neighbours(
    ctx.companyId,
    ctx.financialYearId,
    created.voucher1Id
  );
  assert(
    neighbours.next?.id === receipt.id && neighbours.next?.voucherNumber === 'BR-2026-0002',
    'Previous/Next navigation resolves the next receipt in the same book'
  );

  section('Validation: rejected receipts never post');

  const baseLine = {
    partyId: ctx.partyAId,
    bankInstrumentId: ctx.instrumentHdfcId,
    chequeNumber: '100009',
  };

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '5000.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billA3Id, allocatedAmount: '2500.00' }],
          },
        ],
      }),
    400,
    'Allocation above the real bill balance is rejected server-side',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '1000.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [
              { purchaseBillId: ctx.billA1Id, allocatedAmount: '600.00' },
              { purchaseBillId: ctx.billA2Id, allocatedAmount: '600.00' },
            ],
          },
        ],
      }),
    400,
    'Total allocation above the receipt amount is rejected',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '500.00',
            adjustmentMode: 'SKIP_IN_OS',
            allocations: [{ purchaseBillId: ctx.billA1Id, allocatedAmount: '500.00' }],
          },
        ],
      }),
    400,
    'Skip in O/S is a real ledger posting and rejects bill allocations',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '500.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billA2Id, allocatedAmount: '500.00' }],
            adjustments: [
              {
                purchaseBillId: ctx.billA2Id,
                adjustmentLedgerAccountId: ctx.capitalLedgerId,
                calculationType: 'AMT',
                adjustmentAmount: '50.00',
                drCr: 'DR',
              },
            ],
          },
        ],
      }),
    400,
    'A capital account cannot be used as an adjustment head',
    'adjustmentLedgerAccountId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '500.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billA2Id, allocatedAmount: '500.00' }],
            adjustments: [
              {
                purchaseBillId: ctx.billA2Id,
                adjustmentLedgerAccountId: ctx.bankLedgerId,
                calculationType: 'AMT',
                adjustmentAmount: '50.00',
                drCr: 'DR',
              },
            ],
          },
        ],
      }),
    400,
    'A bank account cannot be used as an adjustment head',
    'adjustmentLedgerAccountId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            ...baseLine,
            amount: '100.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billA2Id, allocatedAmount: '100.00' }],
            adjustments: [
              {
                purchaseBillId: ctx.billA2Id,
                adjustmentLedgerAccountId: ctx.incomeLedgerId,
                calculationType: 'AMT',
                adjustmentAmount: '150.00',
                drCr: 'CR',
              },
            ],
          },
        ],
      }),
    400,
    'Adjustments that leave a zero or negative party credit are rejected',
    'lines.0.adjustments'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            partyId: ctx.partyAId,
            bankInstrumentId: ctx.instrumentHdfcId,
            chequeNumber: 'BAD CHQ#',
            amount: '500.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'Invalid cheque characters are rejected',
    'lines.0.chequeNumber'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [{ partyId: ctx.partyAId, amount: '500.00', adjustmentMode: 'NO_ADJUSTMENT' }],
      }),
    400,
    'A row without a Bank Name code is rejected',
    'lines.0.bankInstrumentId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            partyId: ctx.inactivePartyId,
            bankInstrumentId: ctx.instrumentHdfcId,
            amount: '500.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'An inactive party cannot be received against',
    'lines.0.partyId'
  );

  const foreignParty = await prisma.party.create({
    data: {
      companyId: ctx.otherCompanyId,
      partyCode: 'P18FOREIGN',
      partyName: 'Foreign Customer',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [
          {
            partyId: foreignParty.id,
            bankInstrumentId: ctx.instrumentHdfcId,
            amount: '500.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'A party owned by another company is rejected',
    'lines.0.partyId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-12',
        lines: [],
      }),
    400,
    'A receipt with no rows is rejected',
    'lines'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2025-03-31',
        lines: [
          {
            ...baseLine,
            amount: '500.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'A voucher date outside the financial year is rejected',
    'voucherDate'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.lockedFinancialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2025-05-10',
        lines: [
          {
            ...baseLine,
            amount: '500.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'Posting into a locked financial year is rejected',
    'financialYear'
  );

  assert(
    Math.abs((await bankBalance(ctx)) - 17000) < 0.005,
    'Rejected receipts left the bank ledger untouched'
  );

  created.voucher2Id = receipt.id;
}
async function runEditSuite(ctx: SuiteContext, created: CreatedReceipts) {
  section('Edit: append-only reversal revision');

  const bankBefore = await bankBalance(ctx);
  await receiptService.update(ctx.companyId, ctx.financialYearId, created.voucher1Id, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-10',
    narration: 'Edited two party cheque receipt',
    lines: [
      {
        partyId: ctx.partyAId,
        bankInstrumentId: ctx.instrumentHdfcId,
        chequeNumber: '100001',
        amount: '12000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
      {
        partyId: ctx.partyBId,
        bankInstrumentId: ctx.instrumentIciciId,
        chequeNumber: '100002',
        amount: '3500.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
    ],
  });

  const bankAfter = await bankBalance(ctx);
  assert(
    Math.abs(bankAfter - (bankBefore + 2500)) < 0.005,
    `Edit moves the bank balance by the difference only (${bankBefore} -> ${bankAfter})`
  );

  const view = await loadReceipt(ctx, created.voucher1Id);
  assert(view.revision === 2, 'Edit increments the voucher revision instead of overwriting');
  assert(
    view.receiptRowCount === 2 &&
      view.receiptLines?.[0].amount === '12000.00' &&
      view.receiptLines?.[1].amount === '3500.00',
    'Detail view exposes the corrected revision rows'
  );

  const allLines = await prisma.journalLine.findMany({
    where: { voucherId: created.voucher1Id },
    select: { ledgerAccountId: true, debitAmount: true, creditAmount: true, isReversal: true },
  });
  const netByLedger = new Map<string, number>();
  for (const line of allLines) {
    const current = netByLedger.get(line.ledgerAccountId) ?? 0;
    netByLedger.set(
      line.ledgerAccountId,
      current + Number(line.debitAmount) - Number(line.creditAmount)
    );
  }
  assert(
    allLines.some((line) => line.isReversal),
    'Edit writes explicit reversal lines for the superseded revision'
  );
  assert(
    Math.abs((netByLedger.get(ctx.bankLedgerId) ?? 0) - 15500) < 0.005 &&
      Math.abs((netByLedger.get(created.partyALedgerId) ?? 0) + 12000) < 0.005 &&
      Math.abs((netByLedger.get(created.partyBLedgerId) ?? 0) + 3500) < 0.005,
    'Net effect of both revisions equals the corrected amounts exactly'
  );

  const revisionCounts = await prisma.journalLine.groupBy({
    by: ['revision'],
    where: { voucherId: created.voucher1Id },
    _count: { _all: true },
  });
  assert(
    revisionCounts.length === 2,
    'Journal keeps both revisions for audit (no destructive overwrite)'
  );

  await expectError(
    () =>
      voucherService.update(ctx.companyId, ctx.financialYearId, 'RECEIPT', created.voucher1Id, {
        voucherDate: '2026-05-10',
        partyId: ctx.partyAId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'CHEQUE',
        amount: '1000.00',
        chequeNumber: '100001',
        chequeDate: '2026-05-10',
      }),
    409,
    'The legacy single-line editor refuses to touch a multi-row cheque receipt'
  );
}

async function runCancelSuite(ctx: SuiteContext, created: CreatedReceipts) {
  section('Cancellation: reversal, allocation release and no number reuse');

  const bankBefore = await bankBalance(ctx);
  const cancelled = await voucherService.cancel(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    created.voucher2Id,
    'Cheque returned unpaid'
  );
  assert(
    cancelled.status === 'CANCELLED' && cancelled.cancellationReason === 'Cheque returned unpaid',
    'Cancel records the reason and flips the status instead of deleting the voucher'
  );

  const bankAfter = await bankBalance(ctx);
  assert(
    Math.abs(bankAfter - (bankBefore - 4000)) < 0.005,
    'Cancellation reverses the original bank debit'
  );

  const remaining = await prisma.journalLine.findMany({
    where: { voucherId: created.voucher2Id },
    select: { debitAmount: true, creditAmount: true },
  });
  const residual = remaining.reduce(
    (sum, line) => sum + Number(line.debitAmount) - Number(line.creditAmount),
    0
  );
  assert(Math.abs(residual) < 0.005, 'Every ledger nets to zero after the cancellation reversal');

  const allocations = await prisma.bankReceiptBillAllocation.findMany({
    where: { bankVoucherLine: { bankVoucherId: created.voucher2Id } },
    select: { status: true },
  });
  assert(
    allocations.length === 1 && allocations.every((row) => row.status === 'REVERSED'),
    'Cancellation releases the bill allocation so the bill becomes collectable again'
  );

  const adjustments = await prisma.bankReceiptAdjustmentLine.findMany({
    where: { bankVoucherLine: { bankVoucherId: created.voucher2Id } },
    select: { status: true },
  });
  assert(
    adjustments.length === 2 && adjustments.every((row) => row.status === 'REVERSED'),
    'Cancellation also reverses the linked journal adjustments'
  );

  const outstanding = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyAId,
  });
  const billA1 = outstanding.bills.find((bill) => bill.id === ctx.billA1Id);
  assert(
    billA1?.previousReceived === '0.00' && billA1?.balance === '10000.00',
    'Released bill shows the full amount outstanding again'
  );

  await expectError(
    () =>
      receiptService.update(ctx.companyId, ctx.financialYearId, created.voucher2Id, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-11',
        lines: [
          {
            partyId: ctx.partyAId,
            bankInstrumentId: ctx.instrumentHdfcId,
            amount: '4000.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    409,
    'A cancelled receipt can no longer be edited'
  );

  await expectError(
    () =>
      voucherService.cancel(
        ctx.companyId,
        ctx.financialYearId,
        'RECEIPT',
        created.voucher2Id,
        'Second cancellation attempt'
      ),
    409,
    'Cancelling the same voucher twice is rejected'
  );

  const next = await receiptService.getNextNumber(ctx.companyId, ctx.financialYearId, ctx.bookId);
  assert(
    next.voucherNumber === 'BR-2026-0003',
    `A cancelled voucher number is never reused (next is ${next.voucherNumber})`
  );

  const third = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-12',
    narration: 'Single row receipt after cancellation',
    lines: [
      {
        partyId: ctx.partyAId,
        bankInstrumentId: ctx.instrumentHdfcId,
        chequeNumber: '100004',
        amount: '1000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
    ],
  });
  const thirdView = await loadReceipt(ctx, third.id);
  assert(
    thirdView.voucherNumber === 'BR-2026-0003' && thirdView.receiptRowCount === 1,
    'Next receipt continues the sequence with a single row'
  );

  const afterThird = await receiptService.getNextNumber(
    ctx.companyId,
    ctx.financialYearId,
    ctx.bookId
  );
  assert(
    afterThird.voucherNumber === 'BR-2026-0004',
    `Sequence advances atomically (${afterThird.voucherNumber})`
  );

  const neighbours = await receiptService.neighbours(
    ctx.companyId,
    ctx.financialYearId,
    third.id
  );
  assert(
    neighbours.previous?.id === created.voucher2Id,
    'Previous navigation returns the cancelled voucher in the same book'
  );

  created.voucher3Id = third.id;
}

async function runRegisterSuite(ctx: SuiteContext, created: CreatedReceipts) {
  section('Register: all parties, row count, book and actions data');

  const register = await voucherService.list(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    limit: '50',
  });
  assert(register.total === 3, `Register lists every saved receipt (${register.total})`);

  const first = register.items.find((item) => item.id === created.voucher1Id);
  assert(
    first?.receiptBook?.bookName === 'HDFC Cheque Receipt Book' && first?.receiptRowCount === 2,
    'Register row carries the receipt book and the real row count'
  );
  assert(
    first?.receiptParties?.length === 2 &&
      first.receiptParties.some((party) => party.id === ctx.partyAId) &&
      first.receiptParties.some((party) => party.id === ctx.partyBId),
    'Register serialisation exposes every party on a multi-row receipt'
  );

  const cancelledRow = register.items.find((item) => item.id === created.voucher2Id);
  assert(
    cancelledRow?.status === 'CANCELLED' && cancelledRow.cancellationReason === 'Cheque returned unpaid',
    'Register keeps cancelled receipts visible with their reason'
  );

  const payments = await voucherService.list(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    limit: '50',
  });
  assert(payments.total === 0, 'Phase 12 payment register is unaffected by receipt data');
}

function runSourceWiringChecks() {
  section('Frontend and backend wiring');

  const readSource = (relative: string): string => {
    const full = path.resolve(repoRoot, relative);
    assert(existsSync(full), `Source file exists: ${relative}`);
    return readFileSync(full, 'utf8');
  };

  const entryPage = readSource('frontend/src/pages/ChequeReceiptEntryPage.tsx');
  assert(entryPage.includes('const INITIAL_ROWS = 30;'), 'Cheque receipt grid starts with 30 rows');
  assert(
    entryPage.includes('RECEIPT_ADJUSTMENT_MODE_ORDER') &&
      entryPage.includes('Go To Payment') &&
      entryPage.includes('Pmt.Advice'),
    'Entry screen renders the adjustment modes and the required toolbar actions'
  );
  assert(
    entryPage.includes("event.key.toLowerCase() === 'l'") && entryPage.includes("'Insert'"),
    'Keyboard contract includes Ctrl+L party lookup and Insert semantics'
  );
  assert(
    entryPage.includes("event.key === 'F10'") && entryPage.includes("event.key === '7'"),
    'Toolbar hotkeys 1-9 and F10 are bound on the entry screen'
  );
  assert(
    entryPage.includes('Saved as'),
    'Saving in place shows the real voucher number banner'
  );

  const outstandingDialog = readSource(
    'frontend/src/components/receipt/OutstandingAdjustmentDialog.tsx'
  );
  const sharedTypes = readSource('frontend/src/types/index.ts');
  assert(
    outstandingDialog.includes('J.V Req') &&
      sharedTypes.includes("SKIP_IN_OS: 'Skip in O/S'") &&
      sharedTypes.includes("NO_ADJUSTMENT: 'No Adjustment'") &&
      sharedTypes.includes("AGAINST_BILL: 'Against Bill'"),
    'Outstanding dialog exposes J.V Req and the three adjustment modes render from shared labels'
  );

  const jvDialog = readSource('frontend/src/components/receipt/JournalVoucherAutoDialog.tsx');
  assert(
    jvDialog.includes('Confirm New') && jvDialog.includes('Tds'),
    'Journal Voucher Auto dialog includes the confirm gate and TDS column'
  );

  readSource('frontend/src/components/receipt/ReceiptPartyLookupDialog.tsx');
  readSource('frontend/src/components/receipt/BankNameLookupDialog.tsx');
  readSource('frontend/src/pages/ChequeReceiptPrintPage.tsx');
  readSource('frontend/src/pages/ChequeReceiptAdvicePage.tsx');

  const navigation = readSource('frontend/src/config/navigation.ts');
  assert(
    navigation.includes('BANK_SLIP_MENU_ITEMS') &&
      navigation.includes("'/transactions/bank-receipts/books'") &&
      navigation.includes("'/transactions/bank-receipts'"),
    'Navigation config exposes Cheque Receipt and Reports under Bank Slip / Receipt'
  );
  assert(
    !navigation.includes("label: 'Return Cheque'") &&
      !navigation.includes('/return-cheque') &&
      !navigation.includes('returnCheque'),
    'No dead Return Cheque menu item or route is created'
  );

  const topNav = readSource('frontend/src/components/TopNavigationBar.tsx');
  assert(
    topNav.includes('BANK_SLIP_MENU_ITEMS') && topNav.includes('4. Bank Slip / Receipt'),
    'Top navigation renders the Bank Slip / Receipt flyout from shared config'
  );

  const app = readSource('frontend/src/App.tsx');
  assert(
    app.includes('/transactions/bank-receipts/cheque-entry/:id/print') &&
      app.includes('/transactions/bank-receipts/cheque-entry/:id/advice'),
    'App routes cover entry, print and advice for a saved receipt'
  );

  const registerPage = readSource('frontend/src/pages/BankVoucherRegisterPage.tsx');
  assert(
    registerPage.includes('receiptParties') &&
      registerPage.includes('/transactions/bank-receipts/cheque-entry/${row.id}'),
    'Register shows every party and routes multi-row actions to the cheque receipt screen'
  );

  const routesIndex = readSource('backend/src/routes/index.ts');
  assert(
    routesIndex.indexOf("router.use('/bank-receipts', bankReceiptRoutes)") <
      routesIndex.indexOf("router.use('/bank-receipts', createBankVoucherRoutes('RECEIPT'))"),
    'Phase 18 router is mounted before the Phase 12 receipt router'
  );
  assert(
    routesIndex.includes("router.use('/bank-instruments', bankInstrumentRoutes)") &&
      routesIndex.includes("router.use('/bank-receipt-books', bankReceiptBookRoutes)"),
    'Bank instrument and book routers are mounted'
  );

  const receiptRoutes = readSource('backend/src/routes/bankReceiptRoutes.ts');
  assert(
    receiptRoutes.includes("bankReceiptRoutes.post('/', controller.create)") &&
      receiptRoutes.includes("bankReceiptRoutes.put('/:id', controller.update)") &&
      receiptRoutes.includes('/adjustment-preview'),
    'Receipt endpoints exist for create, update and adjustment preview'
  );

  const controller = readSource('backend/src/controllers/bankReceiptController.ts');
  assert(
    controller.includes('next()'),
    'Phase 18 controller delegates to the Phase 12 router when lines are absent'
  );
}

async function main() {
  try {
    await cleanupTestData();
    const ctx = await buildContext();

    section('Fixture isolation');
    assert(
      ctx.companyId !== ctx.otherCompanyId,
      'Primary and secondary fixture companies are distinct'
    );

    await runBookSuite(ctx);
    await runInstrumentSuite(ctx);
    await runLookupSuite(ctx);
    const created = await runCreateSuite(ctx);
    await runAdjustmentSuite(ctx, created);
    await runEditSuite(ctx, created);
    await runCancelSuite(ctx, created);
    await runRegisterSuite(ctx, created);
    runSourceWiringChecks();

    console.log(`\n=======================================================`);
    console.log(`RESULT: ${passed}/${total} assertions passed`);
    console.log('=======================================================');
    if (passed !== total) throw new Error('Not every assertion passed.');
  } catch (error) {
    console.error(`\nSUITE FAILED after ${passed}/${total} assertions.`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanupTestData();
      console.log('Phase 18 fixtures removed (companies, bills, books, instruments, vouchers).');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }

  process.exit(process.exitCode ?? 0);
}

void main();