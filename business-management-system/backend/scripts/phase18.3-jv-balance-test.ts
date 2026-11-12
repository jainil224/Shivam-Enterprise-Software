// Phase 18.3 - Journal Voucher Auto bill balance and description.
// Verifies the settlement arithmetic (DR settles, CR inflates), the reactive
// preview contract, the over-settlement guard and a real 18,000 cash + 14,550
// discount posting against a 32,550 bill. Every fixture lives inside a
// throwaway company removed in the finally block.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { BankReceiptService } from '../src/services/bankReceiptService.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import {
  exceedsBillBalance,
  netSettlement,
  remainingBillBalance,
  totalSettled,
} from '../../frontend/src/utils/receiptSettlement.js';
import { buildBillDescription } from '../../frontend/src/utils/receiptDescription.js';

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

const TEST_COMPANY_CODE = 'P183TEST';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: TEST_COMPANY_CODE },
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
  bankLedgerId: string;
  discountLedgerId: string;
  partyId: string;
  partyLedgerId: string;
  billId: string;
  billNumber: string;
  instrumentId: string;
  bookId: string;
}

async function buildContext(): Promise<SuiteContext> {
  const company = await prisma.company.create({
    data: {
      companyCode: TEST_COMPANY_CODE,
      companyName: 'SHIVAM ENTERPRISE PHASE 18.3 LTD',
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

  const bankLedger = await ledgerService.create(company.id, {
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

  const discountLedger = await ledgerService.create(company.id, {
    accountCode: '5001',
    accountName: 'Cash Discount Allowed',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const party = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P183RAJ',
      partyName: 'Rajkot Cotton Traders',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
      address: '150 Kalawad Road, Rajkot',
    },
  });

  const partyLedger = await ledgerService.create(company.id, {
    accountCode: 'PL-P183RAJ',
    accountName: 'Rajkot Cotton Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: party.id,
  });

  const bill = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P183-PUR-32550',
      billDate: new Date('2026-04-05T00:00:00.000Z'),
      partyId: party.id,
      supplierLegalName: 'Test Supplier',
      totalAmount: new Prisma.Decimal('32550.00'),
      status: 'CONFIRMED',
    },
  });
  await prisma.purchaseBillItem.create({
    data: {
      purchaseBillId: bill.id,
      itemDescription: 'Cotton Saree',
      quantity: new Prisma.Decimal('25.000'),
      unit: 'PCS',
      rate: new Prisma.Decimal('1302.00'),
      taxableAmount: new Prisma.Decimal('32550.00'),
    },
  });

  const instrument = await receiptService.createInstrument(company.id, {
    code: 'P183HDFC',
    description: 'HDFC Bank Phase 18.3',
  });

  const book = await receiptService.createBook(company.id, fy.id, {
    prefix: 'B183',
    bookName: 'Phase 18.3 Receipt Book',
    bankAccountLedgerId: bankLedger.id,
  });

  return {
    companyId: company.id,
    financialYearId: fy.id,
    bankLedgerId: bankLedger.id,
    discountLedgerId: discountLedger.id,
    partyId: party.id,
    partyLedgerId: partyLedger.id,
    billId: bill.id,
    billNumber: bill.billNumber,
    instrumentId: instrument.id,
    bookId: book.id,
  };
}

function runSettlementMathSuite() {
  section('Test A / B / C - the header reacts to the Add/Less amount');

  // Test A - full settlement.
  const netA = netSettlement([{ drCr: 'DR', adjustmentAmount: '14550.00' }]);
  assert(netA === 14550, `Test A: a DR adjustment settles 14,550.00 (${netA})`);
  assert(
    remainingBillBalance('14550.00', netA) === 0,
    'Test A: Bill Balance becomes 0.00 immediately'
  );
  assert(
    totalSettled('18000.00', netA) === 32550,
    'Test A: Cur Received shows the 32,550.00 total settlement'
  );

  // Test B - partial discount.
  const netB = netSettlement([{ drCr: 'DR', adjustmentAmount: '5000.00' }]);
  assert(
    remainingBillBalance('14550.00', netB) === 9550,
    'Test B: a 5,000.00 discount leaves 9,550.00'
  );

  // Test C - no adjustment.
  const netC = netSettlement([]);
  assert(netC === 0, 'Test C: no adjustment contributes nothing');
  assert(
    remainingBillBalance('14550.00', netC) === 14550,
    'Test C: Bill Balance stays 14,550.00 without an adjustment'
  );

  // Direction rules.
  const creditNet = netSettlement([{ drCr: 'CR', adjustmentAmount: '500.00' }]);
  assert(
    creditNet === -500 && remainingBillBalance('14550.00', creditNet) === 15050,
    'A CR adjustment increases the outstanding balance instead of settling it'
  );
  assert(
    netSettlement([
      { drCr: 'DR', adjustmentAmount: '14550.00' },
      { drCr: 'CR', adjustmentAmount: '500.00' },
    ]) === 14050,
    'Mixed DR and CR adjustments net out'
  );

  // Over-settlement guard.
  assert(
    exceedsBillBalance('14550.00', 14550) === false,
    'Settling exactly the remaining balance is allowed'
  );
  assert(
    exceedsBillBalance('14550.00', 14551) === true,
    'Settling more than the remaining balance is blocked'
  );
  assert(
    exceedsBillBalance('14550.00', 0) === false,
    'An empty adjustment is never flagged'
  );
}

function runSourceContractSuite() {
  section('UI source contract - reactive header and guard');

  const dialog = readFileSync(
    path.join(repoRoot, 'frontend/src/components/receipt/JournalVoucherAutoDialog.tsx'),
    'utf8'
  );
  assert(
    dialog.includes('netSettlement(') &&
      dialog.includes('remainingBillBalance(billBalance, settlement)') &&
      dialog.includes('totalSettled(curReceived, settlement)'),
    'The header derives Bill Balance and Cur Received from the typed adjustment'
  );
  assert(
    dialog.includes('{money(balanceAfterAdjustment)}'),
    'The Bill Balance cell renders the recalculated value'
  );
  assert(
    dialog.includes('{money(settledTotal)}'),
    'The Cur Received cell renders the total settlement'
  );
  assert(
    dialog.includes('exceedsBillBalance(billBalance, settlement)'),
    'Confirm New refuses an adjustment larger than the remaining balance'
  );
  assert(
    !/createJournalVoucher|postJournalVoucher/.test(dialog),
    'Closing the popup never posts journal lines on its own'
  );

  const outstanding = readFileSync(
    path.join(repoRoot, 'frontend/src/components/receipt/OutstandingAdjustmentDialog.tsx'),
    'utf8'
  );
  assert(
    outstanding.includes('purchaseBillId: jvTarget.id'),
    'The accepted adjustment stays attached to the exact purchase bill'
  );
  assert(
    outstanding.includes('bill.balance) - netAdj(bill.id)') ||
      outstanding.includes('toAmount(bill.balance) - toAmount(curRec[bill.id]) - netAdj(bill.id)'),
    'Outstanding Adjustment nets the accepted adjustment into the balance column'
  );
}

async function runPostingSuite(ctx: SuiteContext) {
  section('Test E - 18,000 cash plus 14,550 discount posts once and balances');

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyId,
    receiptAmount: 18000,
    allocations: [{ purchaseBillId: ctx.billId, allocatedAmount: '18000.00' }],
  });
  assert(
    validation.allocations[0]?.billNumber === ctx.billNumber,
    'Validation returns the real bill number for the description'
  );

  const description = buildBillDescription(validation.allocations.map((row) => row.billNumber));
  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-26',
    narration: 'Phase 18.3 discount settlement',
    lines: [
      {
        partyId: ctx.partyId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '500001',
        description,
        amount: '18000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billId, allocatedAmount: '18000.00' }],
        adjustments: [
          {
            purchaseBillId: ctx.billId,
            adjustmentLedgerAccountId: ctx.discountLedgerId,
            calculationType: 'AMT',
            adjustmentAmount: '14550.00',
            drCr: 'DR',
            note: 'Approved cash discount',
          },
        ],
      },
    ],
  });

  const view = await voucherService.getById(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    created.id
  );
  const revisionOne = (view.journalLines ?? []).filter((line) => line.revision === 1);
  const bankLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.bankLedgerId);
  const partyLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.partyLedgerId);
  const discountLine = revisionOne.find((line) => line.ledgerAccount.id === ctx.discountLedgerId);

  assert(bankLine?.debitAmount === '18000.00', 'Test E: the bank is debited with the real cash only');
  assert(
    partyLine?.creditAmount === '32550.00',
    `Test E: the party is credited with the full 32,550.00 settlement (${partyLine?.creditAmount})`
  );
  assert(
    discountLine?.debitAmount === '14550.00',
    'Test E: the discount ledger receives its 14,550.00 debit'
  );

  const debit = revisionOne.reduce((sum, line) => sum + Number(line.debitAmount), 0);
  const credit = revisionOne.reduce((sum, line) => sum + Number(line.creditAmount), 0);
  assert(Math.abs(debit - credit) < 0.005, `Test E: total debit equals total credit (${debit})`);

  const adjustmentCount = await prisma.bankReceiptAdjustmentLine.count({
    where: { companyId: ctx.companyId },
  });
  assert(adjustmentCount === 1, 'Test E: the discount is posted exactly once');

  const line = view.receiptLines?.[0];
  assert(line?.amount === '18000.00', 'Test E: the receipt amount stays at the actual cash');
  assert(
    line?.description === `Bill No: ${ctx.billNumber}`,
    `Test E: the generated description is stored (${line?.description ?? 'null'})`
  );
  assert(
    line?.allocations?.[0]?.allocatedAmount === '18000.00',
    'Test E: the cash allocation is preserved'
  );

  const outstanding = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.partyId,
  });
  const stillOpen = outstanding.bills.find((bill) => bill.billNumber === ctx.billNumber);
  assert(
    !stillOpen || Number(stillOpen.balance) === 0,
    `Test E: the settled bill is no longer outstanding (${stillOpen?.balance ?? 'removed'})`
  );

  // The party ledger carries a credit balance (negative by the ledger sign
  // convention) equal to the whole 32,550.00 settlement, not the 18,000.00
  // cash. That is what closes the bill.
  const partyBalance = await ledgerService.getById(
    ctx.companyId,
    ctx.financialYearId,
    ctx.partyLedgerId
  );
  assert(
    Number(partyBalance.currentBalance) === -32550,
    `Test E: the party ledger carries the full 32,550.00 credit (${partyBalance.currentBalance})`
  );

  const reopened = await voucherService.getById(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    created.id
  );
  assert(
    reopened.receiptLines?.[0]?.description === `Bill No: ${ctx.billNumber}`,
    'Reopening the voucher preserves the description'
  );
}

async function main() {
  console.log('Phase 18.3 - Journal Voucher Auto bill balance and description');
  await cleanupTestData();

  runSettlementMathSuite();
  runSourceContractSuite();

  const ctx = await buildContext();
  try {
    await runPostingSuite(ctx);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 18.3 result: ${passed}/${total} assertions passed.`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('\nPhase 18.3 suite failed:', error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});