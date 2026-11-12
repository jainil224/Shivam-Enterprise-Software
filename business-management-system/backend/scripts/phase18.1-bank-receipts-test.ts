// Phase 18.1 - Bank Receipt Entry UI and Outstanding Adjustment corrections.
// Verifies the row-specific allocation contract, cheque balance, genuine
// previous receipts, preserved negative balances, discount settlement and the
// Phase 12 append-only journal safety rules. Every fixture lives inside a
// throwaway company and is removed again in the finally block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { BankReceiptService } from '../src/services/bankReceiptService.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';

const prisma = new PrismaClient();
const repoRoot = path.resolve(__dirname, '../..');
const receiptService = new BankReceiptService();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

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

const TEST_COMPANY_CODE = 'P181TEST';
const OTHER_COMPANY_CODE = 'P181OTHER';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.bankReceiptAdjustmentLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReceiptBillAllocation.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucherLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBillItem.deleteMany({
    where: { purchaseBill: { companyId: { in: companyIds } } },
  });
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
  discountLedgerId: string;
  interestLedgerId: string;
  mumbaiId: string;
  rajkotId: string;
  betaId: string;
  deltaId: string;
  epsilonId: string;
  mumbaiLedgerId: string;
  billM1Id: string;
  billM2Id: string;
  billR1Id: string;
  billR2Id: string;
  billB1Id: string;
  billD1Id: string;
  billE1Id: string;
  instrumentId: string;
  bookId: string;
  lockedBookId: string;
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
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 18.1 LTD');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 18.1 LTD');

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

  const discountLedger = await ledgerService.create(primary.company.id, {
    accountCode: '5001',
    accountName: 'Discount Allowed',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const interestLedger = await ledgerService.create(primary.company.id, {
    accountCode: '4001',
    accountName: 'Interest Received',
    accountGroup: 'INDIRECT_INCOME',
    openingBalance: '0.00',
  });

  const makeParty = async (partyCode: string, partyName: string, address: string) =>
    prisma.party.create({
      data: {
        companyId: primary.company.id,
        partyCode,
        partyName,
        partyType: 'CUSTOMER',
        openingBalance: new Prisma.Decimal(0),
        balanceType: 'DEBIT',
        address,
      },
    });

  const mumbai = await makeParty('P181MUM', 'Mumbai Fashions Pvt Ltd', '12 Marine Drive, Mumbai');
  const rajkot = await makeParty('P181RAJ', 'Rajkot Cotton Traders', '150 Kalawad Road, Rajkot');
  const beta = await makeParty('P181BET', 'Beta Traders', 'Station Road, Surat');
  const delta = await makeParty('P181DEL', 'Delta Textiles', 'Ring Road, Surat');
  const epsilon = await makeParty('P181EPS', 'Epsilon Fabrics', 'Adajan, Surat');

  const mumbaiLedger = await ledgerService.create(primary.company.id, {
    accountCode: 'PL-P181MUM',
    accountName: 'Mumbai Fashions Pvt Ltd',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: mumbai.id,
  });

  const makeBill = async (
    billNumber: string,
    partyId: string,
    totalAmount: string,
    billDate: string,
    items: Array<{ itemDescription: string; quantity: string; unit: string; rate: string }>
  ) => {
    const bill = await prisma.purchaseBill.create({
      data: {
        companyId: primary.company.id,
        financialYearId: primary.fy.id,
        billNumber,
        billDate: new Date(`${billDate}T00:00:00.000Z`),
        partyId,
        supplierLegalName: 'Test Supplier',
        totalAmount: new Prisma.Decimal(totalAmount),
        status: 'CONFIRMED',
      },
    });
    for (const item of items) {
      await prisma.purchaseBillItem.create({
        data: {
          purchaseBillId: bill.id,
          itemDescription: item.itemDescription,
          quantity: new Prisma.Decimal(item.quantity),
          unit: item.unit,
          rate: new Prisma.Decimal(item.rate),
          taxableAmount: new Prisma.Decimal(
            (Number(item.quantity) * Number(item.rate)).toFixed(2)
          ),
        },
      });
    }
    return bill;
  };

  const billM1 = await makeBill('P181-PUR-18703', mumbai.id, '18703.00', '2026-04-05', [
    { itemDescription: 'Cotton Saree', quantity: '10.000', unit: 'PCS', rate: '1200.00' },
    { itemDescription: 'Silk Dupatta', quantity: '5.000', unit: 'PCS', rate: '800.00' },
  ]);
  const billM2 = await makeBill('P181-PUR-17700', mumbai.id, '17700.00', '2026-04-06', [
    { itemDescription: 'Cotton Fabric', quantity: '20.000', unit: 'MTR', rate: '600.00' },
  ]);
  const billR1 = await makeBill('P181-PUR-30000', rajkot.id, '30000.00', '2026-04-07', [
    { itemDescription: 'Saree Box', quantity: '30.000', unit: 'PCS', rate: '900.00' },
  ]);
  const billR2 = await makeBill('P181-PUR-4000', rajkot.id, '4000.00', '2026-04-08', []);
  const billB1 = await makeBill('P181-PUR-3000', beta.id, '3000.00', '2026-04-09', []);
  const billD1 = await makeBill('P181-PUR-9000', delta.id, '9000.00', '2026-04-10', []);
  const billE1 = await makeBill('P181-PUR-6000', epsilon.id, '6000.00', '2026-04-11', []);

  const instrument = await receiptService.createInstrument(primary.company.id, {
    code: 'HDFC',
    description: 'HDFC Bank',
  });

  const book = await receiptService.createBook(primary.company.id, primary.fy.id, {
    prefix: 'BR',
    bookName: 'HDFC Cheque Receipt Book',
    bankAccountLedgerId: bankLedger.id,
  });

  const lockedBook = await receiptService.createBook(primary.company.id, primary.lockedFy.id, {
    prefix: 'BRL',
    bookName: 'Locked Year Receipt Book',
    bankAccountLedgerId: bankLedger.id,
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    lockedFinancialYearId: primary.lockedFy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    bankLedgerId: bankLedger.id,
    discountLedgerId: discountLedger.id,
    interestLedgerId: interestLedger.id,
    mumbaiId: mumbai.id,
    rajkotId: rajkot.id,
    betaId: beta.id,
    deltaId: delta.id,
    epsilonId: epsilon.id,
    mumbaiLedgerId: mumbaiLedger.id,
    billM1Id: billM1.id,
    billM2Id: billM2.id,
    billR1Id: billR1.id,
    billR2Id: billR2.id,
    billB1Id: billB1.id,
    billD1Id: billD1.id,
    billE1Id: billE1.id,
    instrumentId: instrument.id,
    bookId: book.id,
    lockedBookId: lockedBook.id,
  };
}

const balanceOf = async (ctx: SuiteContext, ledgerId: string): Promise<number> =>
  Number((await ledgerService.getById(ctx.companyId, ctx.financialYearId, ledgerId)).currentBalance);

const bankBalance = async (ctx: SuiteContext): Promise<number> => balanceOf(ctx, ctx.bankLedgerId);

const loadReceipt = async (ctx: SuiteContext, id: string) =>
  voucherService.getById(ctx.companyId, ctx.financialYearId, 'RECEIPT', id);
async function runOutstandingContractSuite(ctx: SuiteContext) {
  section('Cases A / E / F - party-scoped bills, real items, no leakage');

  const mumbai = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.mumbaiId,
  });
  assert(
    mumbai.bills.length === 2 && mumbai.bills.every((bill) => bill.billNumber.startsWith('P181-PUR-1')),
    'Mumbai popup only receives Mumbai bills'
  );
  assert(
    !mumbai.bills.some((bill) => bill.billNumber.includes('30000') || bill.billNumber.includes('4000')),
    'Rajkot bills never appear in the Mumbai popup'
  );
  assert(
    mumbai.totals.billAmount === '36403.00' && mumbai.totals.balance === '36403.00',
    `Outstanding totals use the real bill amounts (${mumbai.totals.billAmount})`
  );

  const m1 = mumbai.bills.find((bill) => bill.id === ctx.billM1Id);
  assert(
    m1?.billAmount === '18703.00' && m1?.billTds === '0.00' && m1?.previousReceived === '0.00',
    'Bill Amt / Bill Tds / PreRec are the real stored values'
  );
  assert(
    m1?.typeCode === 'PUR' && m1?.dueValue === null,
    'Type is the real source code and Due stays null when no due data exists'
  );
  assert(
    m1?.items.length === 2 &&
      m1.items[0].itemName === 'Cotton Saree' &&
      m1.items[0].quantity === '10.000' &&
      m1.items[0].unit === 'PCS',
    `Item footer is fed by real PurchaseBillItem rows (${m1?.items.length ?? 0} items)`
  );
  assert(
    m1?.currentReceived === '0.00' && m1?.jvRequired === false,
    'CurRec starts at zero and J.V Req starts unchecked'
  );

  const rajkot = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.rajkotId,
  });
  assert(
    rajkot.bills.length === 2 &&
      rajkot.bills.every((bill) => bill.billNumber.startsWith('P181-PUR-')),
    'Rajkot popup only receives Rajkot bills'
  );
}

async function runChequeBalanceSuite(ctx: SuiteContext) {
  section('Cases B / G / H - cheque balance and CurRec recalculation');

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.rajkotId,
    receiptAmount: '30000.00',
    allocations: [
      { purchaseBillId: ctx.billR1Id, allocatedAmount: '9000.00' },
      { purchaseBillId: ctx.billR2Id, allocatedAmount: '4000.00' },
    ],
  });
  assert(
    validation.allocatedTotal === '13000.00' && validation.chequeBalance === '17000.00',
    `Cheque Balance is receipt amount minus cash allocated (${validation.chequeBalance})`
  );
  const r1 = validation.allocations.find((row) => row.purchaseBillId === ctx.billR1Id);
  const r2 = validation.allocations.find((row) => row.purchaseBillId === ctx.billR2Id);
  assert(
    r1?.balanceAfter === '21000.00' && r2?.balanceAfter === '0.00',
    'Each bill balance recalculates from its own CurRec'
  );

  const fullyAllocated = await receiptService.validateAllocation(
    ctx.companyId,
    ctx.financialYearId,
    {
      partyId: ctx.rajkotId,
      receiptAmount: '5000.00',
      allocations: [{ purchaseBillId: ctx.billR1Id, allocatedAmount: '5000.00' }],
    }
  );
  assert(
    fullyAllocated.chequeBalance === '0.00',
    'A fully allocated row leaves a zero cheque balance'
  );

  await expectError(
    () =>
      receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
        partyId: ctx.rajkotId,
        receiptAmount: '40000.00',
        allocations: [{ purchaseBillId: ctx.billR1Id, allocatedAmount: '30000.01' }],
      }),
    400,
    'Allocating above the real bill balance is rejected before saving',
    'allocations'
  );

  await expectError(
    () =>
      receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
        partyId: ctx.rajkotId,
        receiptAmount: '40000.00',
        allocations: [{ purchaseBillId: ctx.billR1Id, allocatedAmount: '0.00' }],
      }),
    400,
    'A zero allocation line is rejected',
    'allocations'
  );
}

async function runNegativeBalanceSuite(ctx: SuiteContext) {
  section('Case D - an over-received bill keeps its genuine negative balance');

  const voucher = await prisma.bankVoucher.create({
    data: {
      companyId: ctx.companyId,
      financialYearId: ctx.financialYearId,
      voucherType: 'RECEIPT',
      voucherNumber: 'P181-HIST-0001',
      voucherDate: new Date('2026-04-20T00:00:00.000Z'),
      partyId: ctx.mumbaiId,
      counterpartyLedgerId: ctx.mumbaiLedgerId,
      bankAccountLedgerId: ctx.bankLedgerId,
      bankReceiptBookId: ctx.bookId,
      paymentMode: 'CHEQUE',
      amount: new Prisma.Decimal('17724.00'),
      status: 'POSTED',
      revision: 1,
    },
  });

  const line = await prisma.bankVoucherLine.create({
    data: {
      companyId: ctx.companyId,
      financialYearId: ctx.financialYearId,
      bankVoucherId: voucher.id,
      rowNumber: 1,
      revision: 1,
      partyId: ctx.mumbaiId,
      partyLedgerAccountId: ctx.mumbaiLedgerId,
      amount: new Prisma.Decimal('17724.00'),
      adjustmentMode: 'AGAINST_BILL',
    },
  });

  await prisma.bankReceiptBillAllocation.create({
    data: {
      companyId: ctx.companyId,
      financialYearId: ctx.financialYearId,
      bankVoucherLineId: line.id,
      purchaseBillId: ctx.billM2Id,
      sourceDocumentType: 'PURCHASE_BILL',
      sourceDocumentNumber: 'P181-PUR-17700',
      billDate: new Date('2026-04-06T00:00:00.000Z'),
      billAmount: new Prisma.Decimal('17700.00'),
      billTds: new Prisma.Decimal('0.00'),
      previousReceived: new Prisma.Decimal('0.00'),
      allocatedAmount: new Prisma.Decimal('17724.00'),
      balanceAfter: new Prisma.Decimal('-24.00'),
      status: 'ACTIVE',
      revision: 1,
    },
  });

  const mumbai = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.mumbaiId,
  });
  const m2 = mumbai.bills.find((bill) => bill.id === ctx.billM2Id);
  assert(
    Boolean(m2),
    'An over-received bill is not silently dropped from the outstanding grid'
  );
  assert(
    m2?.previousReceived === '17724.00' && m2?.balance === '-24.00',
    `PreRec is real and the negative balance is preserved (${m2?.balance})`
  );

  await expectError(
    () =>
      receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
        partyId: ctx.mumbaiId,
        receiptAmount: '24.00',
        allocations: [{ purchaseBillId: ctx.billM2Id, allocatedAmount: '24.00' }],
      }),
    400,
    'A negative bill balance cannot receive further cash',
    'allocations'
  );
}

async function runDiscountSuite(ctx: SuiteContext) {
  section('Cases C / L / M / N - discount settlement keeps cash and settlement separate');

  const bankBefore = await bankBalance(ctx);

  const receipt = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-14',
    narration: 'Settlement with approved discount',
    lines: [
      {
        partyId: ctx.mumbaiId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '200001',
        amount: '18000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billM1Id, allocatedAmount: '18000.00' }],
        adjustments: [
          {
            purchaseBillId: ctx.billM1Id,
            adjustmentLedgerAccountId: ctx.discountLedgerId,
            calculationType: 'AMT',
            adjustmentAmount: '703.00',
            drCr: 'DR',
            note: 'Approved cash discount',
          },
        ],
      },
    ],
  });

  const view = await loadReceipt(ctx, receipt.id);
  assert(
    view.amount === '18000.00',
    `The actual bank receipt stays at the cash amount (${view.amount})`
  );

  const revisionOne = (view.journalLines ?? []).filter((line) => line.revision === 1);
  const bankLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.bankLedgerId);
  const partyLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.mumbaiLedgerId);
  const discountLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.discountLedgerId);

  assert(
    bankLine?.debitAmount === '18000.00',
    'The bank is debited with the cash only, never with the discount'
  );
  assert(
    partyLine?.creditAmount === '18703.00' && discountLine?.debitAmount === '703.00',
    'Party is credited with the full settlement and the discount head carries the 703.00 adjustment'
  );
  const debitTotal = revisionOne.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const creditTotal = revisionOne.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(
    Math.abs(debitTotal - creditTotal) < 0.005 && Math.abs(debitTotal - 18703) < 0.005,
    `The posted journal is balanced at the settlement total (${debitTotal})`
  );

  const row = view.receiptLines?.[0];
  assert(
    row?.allocations.length === 1 &&
      row.allocations[0].allocatedAmount === '18000.00' &&
      row.allocations[0].adjustments.length === 1 &&
      row.allocations[0].adjustments[0].adjustmentAmount === '703.00' &&
      row.allocations[0].adjustments[0].drCr === 'DR',
    'The adjustment is stored against the allocation, not posted as its own voucher'
  );

  const mumbai = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.mumbaiId,
  });
  assert(
    !mumbai.bills.some((bill) => bill.id === ctx.billM1Id),
    'After the discount the 18703 bill settles to zero and leaves the outstanding grid'
  );
  const m2 = mumbai.bills.find((bill) => bill.id === ctx.billM2Id);
  assert(
    m2?.balance === '-24.00',
    'Settling one bill never changes another bill balance'
  );

  assert(
    Math.abs((await bankBalance(ctx)) - (bankBefore + 18000)) < 0.005,
    'The bank ledger moves by the cash amount only'
  );

  const vouchers = await prisma.bankVoucher.count({
    where: { companyId: ctx.companyId, voucherNumber: view.voucherNumber },
  });
  assert(vouchers === 1, 'The discount did not create a second receipt voucher');
}
interface MultiRowReceipt {
  voucherId: string;
}

async function runMultiRowSuite(ctx: SuiteContext): Promise<MultiRowReceipt> {
  section('Cases E / T - two rows keep completely separate allocations');

  const receipt = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-15',
    narration: 'Two independent party rows',
    lines: [
      {
        partyId: ctx.deltaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '300001',
        amount: '9000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billD1Id, allocatedAmount: '4000.00' }],
      },
      {
        partyId: ctx.epsilonId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '300002',
        amount: '6000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billE1Id, allocatedAmount: '1500.00' }],
      },
    ],
  });

  const view = await loadReceipt(ctx, receipt.id);
  assert(
    view.receiptRowCount === 2 && view.amount === '15000.00',
    'Both rows are stored under one receipt voucher'
  );
  assert(
    view.receiptLines?.[0].allocations.length === 1 &&
      view.receiptLines[0].allocations[0].purchaseBillId === ctx.billD1Id &&
      view.receiptLines?.[1].allocations.length === 1 &&
      view.receiptLines[1].allocations[0].purchaseBillId === ctx.billE1Id,
    'Each row keeps only its own bill allocation'
  );

  const delta = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.deltaId,
  });
  const epsilon = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.epsilonId,
  });
  assert(
    delta.bills[0]?.previousReceived === '4000.00' && delta.bills[0]?.balance === '5000.00',
    'Row 1 allocation applies only to the Delta bill'
  );
  assert(
    epsilon.bills[0]?.previousReceived === '1500.00' && epsilon.bills[0]?.balance === '4500.00',
    'Row 2 allocation applies only to the Epsilon bill'
  );

  const allocations = await prisma.bankReceiptBillAllocation.count({
    where: { companyId: ctx.companyId, bankVoucherLine: { bankVoucherId: receipt.id } },
  });
  assert(allocations === 2, 'Exactly one allocation row exists per receipt row (no duplicates)');

  return { voucherId: receipt.id };
}

async function runNoAdjustmentSuite(ctx: SuiteContext) {
  section('Cases B / C - No Adjustment and Skip in O/S never allocate');

  const bankBefore = await bankBalance(ctx);
  const receipt = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-16',
    narration: 'On account receipts',
    lines: [
      {
        partyId: ctx.betaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400001',
        amount: '1000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
      {
        partyId: ctx.betaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400002',
        amount: '2000.00',
        adjustmentMode: 'SKIP_IN_OS',
      },
    ],
  });

  const allocationCount = await prisma.bankReceiptBillAllocation.count({
    where: { companyId: ctx.companyId, bankVoucherLine: { bankVoucherId: receipt.id } },
  });
  const adjustmentCount = await prisma.bankReceiptAdjustmentLine.count({
    where: { companyId: ctx.companyId, bankVoucherLine: { bankVoucherId: receipt.id } },
  });
  assert(allocationCount === 0, 'No Adjustment and Skip in O/S create no allocation rows');
  assert(adjustmentCount === 0, 'No Adjustment and Skip in O/S create no adjustment rows');

  const beta = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.betaId,
  });
  assert(
    beta.bills.length === 1 &&
      beta.bills[0].previousReceived === '0.00' &&
      beta.bills[0].balance === '3000.00',
    'On-account receipts leave the bill outstanding untouched'
  );
  assert(
    Math.abs((await bankBalance(ctx)) - (bankBefore + 3000)) < 0.005,
    'Both on-account rows still debit the bank with real cash'
  );
}

async function runEditAndCancelSuite(ctx: SuiteContext, multi: MultiRowReceipt) {
  section('Cases R / S / T - edit reversal, allocation release, no duplicates');

  const bankBefore = await bankBalance(ctx);
  await receiptService.update(ctx.companyId, ctx.financialYearId, multi.voucherId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-15',
    narration: 'Two independent party rows - corrected',
    lines: [
      {
        partyId: ctx.deltaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '300001',
        amount: '9000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billD1Id, allocatedAmount: '3000.00' }],
      },
      {
        partyId: ctx.epsilonId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '300002',
        amount: '6000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billE1Id, allocatedAmount: '1500.00' }],
      },
    ],
  });

  assert(
    Math.abs((await bankBalance(ctx)) - bankBefore) < 0.005,
    'Editing only the allocation leaves the bank balance unchanged'
  );

  const view = await loadReceipt(ctx, multi.voucherId);
  assert(view.revision === 2, 'Edit increments the voucher revision');
  const revisions = await prisma.journalLine.groupBy({
    by: ['revision'],
    where: { voucherId: multi.voucherId },
    _count: { _all: true },
  });
  assert(revisions.length === 2, 'Both journal revisions are kept for audit');

  const deltaAllocations = await prisma.bankReceiptBillAllocation.findMany({
    where: { companyId: ctx.companyId, purchaseBillId: ctx.billD1Id },
    select: { status: true, revision: true, allocatedAmount: true },
    orderBy: { revision: 'asc' },
  });
  assert(
    deltaAllocations.length === 2 &&
      deltaAllocations[0].status === 'REVERSED' &&
      deltaAllocations[1].status === 'ACTIVE' &&
      deltaAllocations[1].allocatedAmount.toFixed(2) === '3000.00',
    'The superseded allocation is reversed and the new revision is active'
  );

  const delta = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.deltaId,
  });
  assert(
    delta.bills[0]?.previousReceived === '3000.00' && delta.bills[0]?.balance === '6000.00',
    'Outstanding reflects the corrected allocation only, never both revisions'
  );

  section('Cancellation releases allocations');

  const bankBeforeCancel = await bankBalance(ctx);
  await voucherService.cancel(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    multi.voucherId,
    'Cheque returned unpaid'
  );

  assert(
    Math.abs((await bankBalance(ctx)) - (bankBeforeCancel - 15000)) < 0.005,
    'Cancellation reverses the full receipt amount'
  );

  const activeAllocations = await prisma.bankReceiptBillAllocation.count({
    where: {
      companyId: ctx.companyId,
      purchaseBillId: { in: [ctx.billD1Id, ctx.billE1Id] },
      status: 'ACTIVE',
    },
  });
  assert(activeAllocations === 0, 'Cancellation releases every allocation of the voucher');

  const deltaAfter = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.deltaId,
  });
  const epsilonAfter = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.epsilonId,
  });
  assert(
    deltaAfter.bills[0]?.previousReceived === '0.00' &&
      deltaAfter.bills[0]?.balance === '9000.00' &&
      epsilonAfter.bills[0]?.previousReceived === '0.00' &&
      epsilonAfter.bills[0]?.balance === '6000.00',
    'Cancelled allocations disappear from both bills'
  );
}

async function runGuardSuite(ctx: SuiteContext) {
  section('Cases D / U / V - row validation, over-allocation guard, isolation');

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-17',
        lines: [
          {
            partyId: ctx.betaId,
            bankInstrumentId: ctx.instrumentId,
            amount: '1000.00',
            adjustmentMode: 'AGAINST_BILL',
          },
        ],
      }),
    400,
    'An Against Bill row with no allocation is rejected server-side',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-17',
        lines: [
          {
            partyId: ctx.betaId,
            bankInstrumentId: ctx.instrumentId,
            amount: '1000.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billD1Id, allocatedAmount: '500.00' }],
          },
        ],
      }),
    400,
    'A bill owned by another party is rejected',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.financialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-17',
        lines: [
          {
            partyId: ctx.rajkotId,
            bankInstrumentId: ctx.instrumentId,
            amount: '5000.00',
            adjustmentMode: 'AGAINST_BILL',
            allocations: [{ purchaseBillId: ctx.billR1Id, allocatedAmount: '5000.00' }],
            adjustments: [
              {
                purchaseBillId: ctx.billR1Id,
                adjustmentLedgerAccountId: ctx.discountLedgerId,
                calculationType: 'AMT',
                adjustmentAmount: '26000.00',
                drCr: 'DR',
              },
            ],
          },
        ],
      }),
    400,
    'Cash plus adjustment above the bill balance is rejected',
    'lines.0.allocations'
  );

  await expectError(
    () =>
      receiptService.outstandingBills(ctx.otherCompanyId, ctx.otherFinancialYearId, {
        partyId: ctx.mumbaiId,
      }),
    400,
    'Another company cannot read this party outstanding bills',
    'partyId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.otherCompanyId, ctx.otherFinancialYearId, {
        bookId: ctx.bookId,
        voucherDate: '2026-05-17',
        lines: [
          {
            partyId: ctx.betaId,
            bankInstrumentId: ctx.instrumentId,
            amount: '1000.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'Another company cannot post into this receipt book',
    'bookId'
  );

  await expectError(
    () =>
      receiptService.create(ctx.companyId, ctx.lockedFinancialYearId, {
        bookId: ctx.lockedBookId,
        voucherDate: '2025-05-17',
        lines: [
          {
            partyId: ctx.betaId,
            bankInstrumentId: ctx.instrumentId,
            amount: '1000.00',
            adjustmentMode: 'NO_ADJUSTMENT',
          },
        ],
      }),
    400,
    'A locked financial year rejects writes',
    'financialYear'
  );
}

function runSourceContractSuite() {
  section('UI source contract - adjustment linkage and row-scoped validation');

  const popup = readFileSync(
    path.join(repoRoot, 'frontend/src/components/receipt/OutstandingAdjustmentDialog.tsx'),
    'utf8'
  );
  assert(
    popup.includes('purchaseBillId: jvTarget.id'),
    'Accepted journal adjustments are linked to the allocated bill before they leave the popup'
  );
  assert(
    /const chequeBalance = Math\.max\(0, round2\(receiptAmount - allocatedTotal\)\)/.test(popup),
    'Cheque balance is this row cash minus its own allocations only'
  );
  assert(
    /jvBills\[allocation\.purchaseBillId\]/.test(popup),
    'Only the selected bill adjustments are sent with the allocation'
  );

  const entry = readFileSync(
    path.join(repoRoot, 'frontend/src/pages/ChequeReceiptEntryPage.tsx'),
    'utf8'
  );
  assert(
    entry.includes(
      'No bill allocation has been entered. Allocate this receipt against a bill or select No Adjustment / Skip in O/S.'
    ),
    'Entry screen carries the exact row-linked allocation warning'
  );
  assert(
    entry.includes('clearRowError') && entry.includes('setRowErrors'),
    'Row warnings are tracked and cleared per row'
  );
  assert(
    entry.includes("row.adjustmentMode === 'AGAINST_BILL' && row.allocations.length === 0"),
    'Against Bill rows are validated against their own allocations'
  );

  const jv = readFileSync(
    path.join(repoRoot, 'frontend/src/components/receipt/JournalVoucherAutoDialog.tsx'),
    'utf8'
  );
  assert(
    !/createJournalVoucher|postJournalVoucher|journalVouchers/.test(jv),
    'The JV Auto dialog never posts a journal independently'
  );
  assert(
    jv.includes('Are you sure to close?') && jv.includes('(+) Yes') && jv.includes('(-) No'),
    'JV Auto confirmation keeps the Yes/No contract'
  );
}

async function main() {
  runSourceContractSuite();
  await cleanupTestData();
  const ctx = await buildContext();
  try {
    await runOutstandingContractSuite(ctx);
    await runChequeBalanceSuite(ctx);
    await runNegativeBalanceSuite(ctx);
    await runDiscountSuite(ctx);
    const multi = await runMultiRowSuite(ctx);
    await runNoAdjustmentSuite(ctx);
    await runEditAndCancelSuite(ctx, multi);
    await runGuardSuite(ctx);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 18.1 suite: ${passed}/${total} assertions passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  await cleanupTestData();
  await prisma.$disconnect();
  process.exit(1);
});