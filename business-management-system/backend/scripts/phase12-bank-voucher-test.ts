import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Prisma } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { amountInWords } from '../../frontend/src/utils/amountInWords.js';

const prisma = new PrismaClient();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(scriptDir, '../../frontend/src');

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
      `${label} (expected ${expectedStatus}, received ${err.statusCode ?? 'none'}${fieldMatched ? '' : ' / field mismatch'}: ${err.message})`
    );
    return err;
  }
  assert(false, `${label} (expected rejection with ${expectedStatus}, but the call succeeded)`);
  return { message: '' };
}

const TEST_COMPANY_CODE = 'P12TEST';
const OTHER_COMPANY_CODE = 'P12OTHER';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);

  if (companyIds.length === 0) {
    const strayParties = await prisma.party.findMany({
      where: { partyCode: { startsWith: 'P12' } },
      select: { id: true },
    });
    if (strayParties.length === 0) return;
  }

  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
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
  bankLedgerId: string;
  secondBankLedgerId: string;
  expenseLedgerId: string;
  inactiveLedgerId: string;
  customerPartyId: string;
  supplierPartyId: string;
}

async function createCompanyWithYears(code: string, name: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
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
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 12 LTD');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 12 LTD');

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
    accountName: 'Office Rent',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const inactiveLedger = await ledgerService.create(primary.company.id, {
    accountCode: '5002',
    accountName: 'Closed Expense Ledger',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });
  await ledgerService.setActive(primary.company.id, primary.fy.id, inactiveLedger.id, false);

  const customer = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P12CUST',
      partyName: 'Patel Yarn Traders',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P12SUPP',
      partyName: 'Surat Textile Suppliers',
      partyType: 'SUPPLIER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
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
    inactiveLedgerId: inactiveLedger.id,
    customerPartyId: customer.id,
    supplierPartyId: supplier.id,
  };
}
interface SuiteConfig {
  voucherType: 'RECEIPT' | 'PAYMENT';
  label: string;
  prefix: string;
  bankLedgerId: string;
  counterpartyPartyId: string;
  counterpartyNature: 'DEBIT' | 'CREDIT';
  amount: string;
  reference: string;
  mode: 'NEFT';
}

interface SuiteResult {
  firstVoucherId: string;
  secondVoucherId: string;
  counterpartyLedgerId: string;
}

async function runVoucherSuite(ctx: SuiteContext, config: SuiteConfig): Promise<SuiteResult> {
  const { voucherType, label, prefix } = config;
  const direction = voucherType === 'RECEIPT' ? 1 : -1;
  const amountNumber = Number(config.amount);
  const n = (index: number) => `${label} Test ${index}`;

  const bankBefore = Number(
    (await ledgerService.getById(ctx.companyId, ctx.financialYearId, config.bankLedgerId)).currentBalance
  );

  const created = await voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
    voucherDate: '2026-05-10',
    partyId: config.counterpartyPartyId,
    bankAccountLedgerId: config.bankLedgerId,
    paymentMode: config.mode,
    amount: config.amount,
    referenceNumber: config.reference,
    narration: `${label} test posting`,
  });

  assert(
    created.status === 'POSTED' && created.voucherType === voucherType,
    `${n(1)}: valid ${label.toLowerCase()} is created with status POSTED`
  );

  assert(
    new RegExp(`^${prefix}-2026-0001$`).test(created.voucherNumber),
    `${n(2)}: voucher number uses the ${prefix}-YYYY-0001 sequence format (received ${created.voucherNumber})`
  );

  const createdWithLines = await voucherService.getById(
    ctx.companyId,
    ctx.financialYearId,
    voucherType,
    created.id
  );
  const revisionOneLines = (createdWithLines.journalLines ?? []).filter((line) => line.revision === 1);
  assert(
    revisionOneLines.length === 2,
    `${n(3)}: journal stores exactly two lines (debit + credit) for revision 1`
  );

  const partyLedger = await prisma.ledgerAccount.findFirst({
    where: { companyId: ctx.companyId, partyId: config.counterpartyPartyId },
  });
  assert(
    Boolean(partyLedger),
    `${n(4)}: party counterparty is linked to a ledger account`
  );

  const counterpartyLedgerId = partyLedger?.id ?? '';
  const expectedDebitId = voucherType === 'RECEIPT' ? config.bankLedgerId : counterpartyLedgerId;
  const expectedCreditId = voucherType === 'RECEIPT' ? counterpartyLedgerId : config.bankLedgerId;
  const debitLine = revisionOneLines.find((line) => Number(line.debitAmount) > 0);
  const creditLine = revisionOneLines.find((line) => Number(line.creditAmount) > 0);
  assert(
    debitLine?.ledgerAccount.id === expectedDebitId &&
      creditLine?.ledgerAccount.id === expectedCreditId &&
      debitLine?.ledgerAccount.accountName !== creditLine?.ledgerAccount.accountName,
    `${n(5)}: ${
      voucherType === 'RECEIPT'
        ? 'bank is debited and the receiving ledger is credited'
        : 'the paying ledger is debited and the bank is credited'
    }`
  );

  assert(
    Number(debitLine?.debitAmount ?? 0) === amountNumber &&
      Number(creditLine?.creditAmount ?? 0) === amountNumber,
    `${n(6)}: debit amount equals credit amount (no reversal of direction)`
  );

  const bankAfter = Number(
    (await ledgerService.getById(ctx.companyId, ctx.financialYearId, config.bankLedgerId)).currentBalance
  );
  assert(
    Math.abs(bankAfter - (bankBefore + direction * amountNumber)) < 0.005,
    `${n(7)}: bank ledger balance moved by ${direction > 0 ? '+' : '-'}${config.amount} (real ledger balance)`
  );

  const counterpartyBefore = 0;
  const counterpartyAfter = Number(
    (await ledgerService.getById(ctx.companyId, ctx.financialYearId, counterpartyLedgerId)).currentBalance
  );
  const counterpartyDelta =
    (voucherType === 'RECEIPT' ? -1 : 1) * (config.counterpartyNature === 'DEBIT' ? 1 : -1) * amountNumber;
  assert(
    Math.abs(counterpartyAfter - (counterpartyBefore + counterpartyDelta)) < 0.005,
    `${n(8)}: counterparty ledger balance moved by the exact opposite amount (${counterpartyDelta})`
  );

  assert(
    partyLedger?.isAutoCreated === true &&
      partyLedger?.openingBalance.toFixed(2) === '0.00' &&
      partyLedger?.isBankAccount === false,
    `${n(9)}: auto-created party ledger keeps a zero opening balance and is not a bank account`
  );

  assert(
    created.amount === amountNumber.toFixed(2),
    `${n(10)}: persisted amount keeps exactly two decimals (${created.amount})`
  );

  const second = await voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
    voucherDate: '2026-05-11',
    counterpartyLedgerId: ctx.expenseLedgerId,
    bankAccountLedgerId: config.bankLedgerId,
    paymentMode: 'BANK_TRANSFER',
    amount: '1000.00',
    referenceNumber: null,
    narration: 'Non-party ledger posting',
  });
  assert(
    new RegExp(`^${prefix}-2026-0002$`).test(second.voucherNumber),
    `${n(11)}: next voucher number increments atomically (${second.voucherNumber})`
  );

  assert(
    second.counterparty.id === ctx.expenseLedgerId &&
      second.party === null &&
      second.bankAccount.id === config.bankLedgerId,
    `${n(12)}: non-party ledger counterparty is accepted without creating a Party Master record`
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        partyId: config.counterpartyPartyId,
        bankAccountLedgerId: config.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '0',
        referenceNumber: 'UTRZERO0001',
      }),
    400,
    `${n(13)}: zero amount is rejected`,
    'amount'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        partyId: config.counterpartyPartyId,
        bankAccountLedgerId: config.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '100.999',
        referenceNumber: 'UTRTHREE0001',
      }),
    400,
    `${n(14)}: amount with three decimal places is rejected`,
    'amount'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        partyId: config.counterpartyPartyId,
        bankAccountLedgerId: ctx.expenseLedgerId,
        paymentMode: 'NEFT',
        amount: '500.00',
        referenceNumber: 'UTRNOBANK0001',
      }),
    400,
    `${n(15)}: a ledger that is not classified as a bank account is rejected as bank`,
    'bankAccountLedgerId'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        counterpartyLedgerId: config.bankLedgerId,
        bankAccountLedgerId: config.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '500.00',
        referenceNumber: 'UTRSAMEBANK01',
      }),
    400,
    `${n(16)}: the bank account cannot also be the counterparty`,
    'counterpartyLedgerId'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        partyId: config.counterpartyPartyId,
        bankAccountLedgerId: config.bankLedgerId,
        paymentMode: 'RTGS',
        amount: '500.00',
        referenceNumber: null,
      }),
    400,
    `${n(17)}: electronic mode without a UTR / reference number is rejected`,
    'referenceNumber'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, voucherType, {
        voucherDate: '2026-05-12',
        partyId: config.counterpartyPartyId,
        bankAccountLedgerId: config.bankLedgerId,
        paymentMode: 'CHEQUE',
        amount: '500.00',
        chequeNumber: null,
        chequeDate: null,
      }),
    400,
    `${n(18)}: cheque mode without cheque number and date is rejected`,
    'chequeNumber'
  );

  return {
    firstVoucherId: created.id,
    secondVoucherId: second.id,
    counterpartyLedgerId,
  };
}
async function runIntegritySuite(
  ctx: SuiteContext,
  receipt: SuiteResult,
  payment: SuiteResult,
  receiptConfig: SuiteConfig,
  paymentConfig: SuiteConfig
) {
  section('Financial integrity, cancellation, edit revision and isolation');

  const bankBalance = async (ledgerId: string) =>
    Number((await ledgerService.getById(ctx.companyId, ctx.financialYearId, ledgerId)).currentBalance);

  // 1. Duplicate reference
  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
        voucherDate: '2026-05-12',
        partyId: receiptConfig.counterpartyPartyId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '999.00',
        referenceNumber: receiptConfig.reference,
      }),
    400,
    'Duplicate UTR reference within the same company, voucher type and mode is rejected',
    'referenceNumber'
  );

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
        voucherDate: '2026-05-12',
        partyId: paymentConfig.counterpartyPartyId,
        bankAccountLedgerId: ctx.secondBankLedgerId,
        paymentMode: 'NEFT',
        amount: '999.00',
        referenceNumber: paymentConfig.reference,
      }),
    400,
    'Duplicate UTR reference on the payment side is rejected',
    'referenceNumber'
  );

  // 2. Inactive ledger
  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
        voucherDate: '2026-05-12',
        counterpartyLedgerId: ctx.inactiveLedgerId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'BANK_TRANSFER',
        amount: '250.00',
      }),
    400,
    'Inactive ledger account cannot be used as a voucher counterparty',
    'counterpartyLedgerId'
  );

  // 3. Cross-company account
  const foreignBank = await ledgerService.create(ctx.otherCompanyId, {
    accountCode: '9001',
    accountName: 'Foreign Bank Account',
    accountGroup: 'BANK',
    bankName: 'Axis Bank',
    openingBalance: '0.00',
  });

  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
        voucherDate: '2026-05-12',
        partyId: receiptConfig.counterpartyPartyId,
        bankAccountLedgerId: foreignBank.id,
        paymentMode: 'NEFT',
        amount: '250.00',
        referenceNumber: 'UTRXCROSS001',
      }),
    400,
    'Bank account owned by another company is rejected (company isolation)',
    'bankAccountLedgerId'
  );

  // 4. Date outside financial year
  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
        voucherDate: '2025-03-31',
        partyId: receiptConfig.counterpartyPartyId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '250.00',
        referenceNumber: 'UTRXDATE0001',
      }),
    400,
    'Voucher date outside the active financial year is rejected',
    'voucherDate'
  );

  // 5. Locked financial year
  await expectError(
    () =>
      voucherService.create(ctx.companyId, ctx.lockedFinancialYearId, 'RECEIPT', {
        voucherDate: '2025-05-10',
        partyId: receiptConfig.counterpartyPartyId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '250.00',
        referenceNumber: 'UTRXLOCK0001',
      }),
    400,
    'Posting into a locked financial year is rejected',
    'financialYear'
  );

  // 6. Edit creates a corrected revision without duplicating the posting
  const editable = await voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    voucherDate: '2026-05-20',
    partyId: receiptConfig.counterpartyPartyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'BANK_TRANSFER',
    amount: '5000.00',
    narration: 'Editable voucher',
  });

  const bankBeforeEdit = await bankBalance(ctx.bankLedgerId);
  const edited = await voucherService.update(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    editable.id,
    {
      voucherDate: '2026-05-20',
      partyId: receiptConfig.counterpartyPartyId,
      bankAccountLedgerId: ctx.bankLedgerId,
      paymentMode: 'BANK_TRANSFER',
      amount: '6500.00',
      narration: 'Edited voucher',
    }
  );
  const bankAfterEdit = await bankBalance(ctx.bankLedgerId);

  assert(
    Math.abs(bankAfterEdit - (bankBeforeEdit + 1500)) < 0.005,
    'Editing a voucher replaces the posting instead of stacking it (bank moved by the 1500.00 delta only)'
  );

  const editLines = await prisma.journalLine.findMany({
    where: { voucherId: editable.id },
    orderBy: [{ revision: 'asc' }, { lineNumber: 'asc' }],
  });
  const editRevisions = Array.from(new Set(editLines.map((line) => line.revision))).sort((a, b) => a - b);
  const reversalLines = editLines.filter((line) => line.isReversal);
  assert(
    editRevisions.length === 2 &&
      editRevisions[0] === 1 &&
      editRevisions[1] === 2 &&
      reversalLines.length === 2 &&
      editLines.length === 6 &&
      edited.revision === 2,
    'Edit appends a mirrored reversal plus the corrected posting and never deletes the original lines'
  );

  // 7. Cancel reverses the posting and keeps the voucher
  const bankBeforeCancel = await bankBalance(ctx.bankLedgerId);
  const cancelled = await voucherService.cancel(
    ctx.companyId,
    ctx.financialYearId,
    'RECEIPT',
    receipt.firstVoucherId,
    'Customer cancelled the transfer'
  );
  const bankAfterCancel = await bankBalance(ctx.bankLedgerId);

  assert(
    cancelled.status === 'CANCELLED' &&
      cancelled.cancellationReason === 'Customer cancelled the transfer' &&
      Boolean(cancelled.cancelledAt),
    'Cancellation stores status, reason and timestamp without deleting the voucher'
  );

  assert(
    Math.abs(bankAfterCancel - (bankBeforeCancel - 25000.5)) < 0.005,
    'Cancellation reverses the accounting posting so the bank ledger returns to its prior balance'
  );

  const cancelledNet = await prisma.journalLine.groupBy({
    by: ['voucherId'],
    where: { voucherId: receipt.firstVoucherId },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const netDebit = Number(cancelledNet[0]?._sum.debitAmount ?? 0);
  const netCredit = Number(cancelledNet[0]?._sum.creditAmount ?? 0);
  assert(
    Math.abs(netDebit - netCredit) < 0.005,
    'Cancelled voucher nets to zero (total debit equals total credit after reversal)'
  );

  // 8. Double cancellation blocked
  await expectError(
    () =>
      voucherService.cancel(
        ctx.companyId,
        ctx.financialYearId,
        'RECEIPT',
        receipt.firstVoucherId,
        'Second attempt'
      ),
    409,
    'Cancelling the same voucher twice is rejected'
  );

  // 9. Cancelled vouchers are immutable
  await expectError(
    () =>
      voucherService.update(ctx.companyId, ctx.financialYearId, 'RECEIPT', receipt.firstVoucherId, {
        voucherDate: '2026-05-10',
        partyId: receiptConfig.counterpartyPartyId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'NEFT',
        amount: '26000.00',
        referenceNumber: receiptConfig.reference,
      }),
    409,
    'Cancelled vouchers cannot be edited'
  );

  // 10. Voucher numbers are never reused after cancellation
  const next = await voucherService.nextNumber(ctx.companyId, ctx.financialYearId, 'RECEIPT');
  assert(
    next.voucherNumber === 'BR-2026-0004',
    `Cancelled voucher numbers stay consumed (next receipt number is ${next.voucherNumber})`
  );

  // 11. Register totals and filters
  const list = await voucherService.list(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    page: 1,
    limit: 50,
  });
  assert(
    list.total === 3 && list.totalAmount === '32500.50',
    `Register returns all vouchers with a filtered total (total=${list.total}, amount=${list.totalAmount})`
  );

  const cancelledList = await voucherService.list(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    page: 1,
    limit: 50,
    status: 'CANCELLED',
  });
  assert(
    cancelledList.total === 1 && cancelledList.items[0]?.id === receipt.firstVoucherId,
    'Status filter isolates cancelled vouchers in the register'
  );

  const searchList = await voucherService.list(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    page: 1,
    limit: 50,
    search: paymentConfig.reference,
  });
  assert(
    searchList.total === 1 && searchList.items[0]?.referenceNumber === paymentConfig.reference,
    'Reference search returns the matching voucher'
  );

  // 12. Company isolation on list + lookup
  const foreignList = await voucherService.list(ctx.otherCompanyId, ctx.otherFinancialYearId, 'RECEIPT', {
    page: 1,
    limit: 50,
  });
  const foreignLookups = await voucherService.getLookups(
    ctx.otherCompanyId,
    ctx.otherFinancialYearId,
    'RECEIPT'
  );
  assert(
    foreignList.total === 0 && foreignLookups.financialYear.id === ctx.otherFinancialYearId,
    'A second company sees none of the first company vouchers'
  );

  // 13. Global debit / credit integrity for the whole company ledger
  const totals = await prisma.journalLine.groupBy({
    by: ['companyId'],
    where: { companyId: ctx.companyId },
    _sum: { debitAmount: true, creditAmount: true },
  });
  const totalDebit = Number(totals[0]?._sum.debitAmount ?? 0);
  const totalCredit = Number(totals[0]?._sum.creditAmount ?? 0);
  assert(
    Math.abs(totalDebit - totalCredit) < 0.005,
    `All journal lines in the company balance globally (Dr ${totalDebit} = Cr ${totalCredit})`
  );

  // 14. Sequence row exists per company + FY + voucher type and never collides
  const sequences = await prisma.voucherSequence.findMany({ where: { companyId: ctx.companyId } });
  const receiptSequence = sequences.find((row) => row.voucherType === 'RECEIPT');
  const paymentSequence = sequences.find((row) => row.voucherType === 'PAYMENT');
  assert(
    Boolean(receiptSequence) &&
      Boolean(paymentSequence) &&
      receiptSequence?.financialYearId === ctx.financialYearId &&
      receiptSequence?.lastNumber === 3 &&
      paymentSequence?.lastNumber === 2,
    'Separate concurrency-safe sequences are kept per voucher type, company and financial year'
  );

  // 15. Unique constraint guards duplicate voucher numbers at the database level
  const firstVoucher = await prisma.bankVoucher.findUnique({ where: { id: receipt.firstVoucherId } });
  let duplicateNumberRejected = false;
  try {
    await prisma.bankVoucher.create({
      data: {
        companyId: ctx.companyId,
        financialYearId: ctx.financialYearId,
        voucherType: 'RECEIPT',
        voucherNumber: firstVoucher?.voucherNumber ?? 'BR-2026-0001',
        voucherDate: new Date('2026-05-10T00:00:00.000Z'),
        counterpartyLedgerId: receipt.counterpartyLedgerId,
        bankAccountLedgerId: ctx.bankLedgerId,
        paymentMode: 'NEFT',
        amount: new Prisma.Decimal(1),
      },
    });
  } catch (error) {
    duplicateNumberRejected =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
  assert(
    duplicateNumberRejected,
    'Database unique constraint blocks duplicate voucher numbers for the same company, FY and type'
  );

  // Payment side reversal must also restore the bank balance
  const paymentBankBefore = await bankBalance(ctx.secondBankLedgerId);
  await voucherService.cancel(
    ctx.companyId,
    ctx.financialYearId,
    'PAYMENT',
    payment.firstVoucherId,
    'Supplier payment returned'
  );
  const paymentBankAfter = await bankBalance(ctx.secondBankLedgerId);
  assert(
    Math.abs(paymentBankAfter - (paymentBankBefore + 18000.25)) < 0.005,
    'Cancelling a bank payment restores the bank balance by the payment amount'
  );
}
function runFrontendWiringChecks() {
  section('Frontend wiring and shared utilities');

  const requiredFiles = [
    'components/BankVoucherForm.tsx',
    'components/LedgerAccountModal.tsx',
    'pages/BankVoucherEntryPage.tsx',
    'pages/BankVoucherRegisterPage.tsx',
    'pages/BankVoucherDetailPage.tsx',
    'pages/BankVoucherPrintPage.tsx',
    'pages/LedgerAccountsPage.tsx',
    'utils/amountInWords.ts',
  ];

  for (const relative of requiredFiles) {
    assert(existsSync(path.join(frontendSrc, relative)), `Frontend file exists: src/${relative}`);
  }

  const appSource = readFileSync(path.join(frontendSrc, 'App.tsx'), 'utf8');
  const appRoutes = [
    '/masters/ledger-accounts',
    '/transactions/bank-receipts',
    '/transactions/bank-receipts/new',
    '/transactions/bank-receipts/:id/edit',
    '/transactions/bank-receipts/:id/print',
    '/transactions/bank-payments',
    '/transactions/bank-payments/new',
    '/transactions/bank-payments/:id/edit',
    '/transactions/bank-payments/:id/print',
  ];
  for (const route of appRoutes) {
    assert(appSource.includes(`path="${route}"`), `Route registered in App.tsx: ${route}`);
  }

  assert(
    appSource.includes('<BankVoucherRegisterPage voucherType="RECEIPT" />') &&
      appSource.includes('<BankVoucherRegisterPage voucherType="PAYMENT" />') &&
      appSource.includes('<BankVoucherForm') === false,
    'Both registers render the shared voucher page with the correct voucherType prop'
  );

  const navigationSource = readFileSync(path.join(frontendSrc, 'config/navigation.ts'), 'utf8');
  const receiptBlock = navigationSource.slice(
    navigationSource.indexOf("id: 'bank_receipt'"),
    navigationSource.indexOf("id: 'bank_payment'")
  );
  const paymentBlock = navigationSource.slice(
    navigationSource.indexOf("id: 'bank_payment'"),
    navigationSource.indexOf("id: 'ledger_accounts'")
  );
  assert(
    receiptBlock.includes('implemented: true') &&
      receiptBlock.includes("route: '/transactions/bank-receipts'") &&
      paymentBlock.includes('implemented: true') &&
      paymentBlock.includes("route: '/transactions/bank-payments'") &&
      navigationSource.includes("id: 'ledger_accounts'") &&
      navigationSource.includes("route: '/masters/ledger-accounts'"),
    'Dashboard navigation marks Bank Receipt, Bank Payment and Ledger master as implemented with routes'
  );

  assert(
    !receiptBlock.includes('implemented: false') && !paymentBlock.includes('implemented: false'),
    'No "Coming Soon" placeholder remains on the Bank Receipt or Bank Payment dashboard card'
  );

  const topNavSource = readFileSync(path.join(frontendSrc, 'components/TopNavigationBar.tsx'), 'utf8');
  assert(
    topNavSource.includes("route: '/transactions/bank-receipts'") &&
      topNavSource.includes("route: '/transactions/bank-payments'") &&
      topNavSource.includes("route: '/masters/ledger-accounts'"),
    'Top navigation menus link to both voucher registers and the ledger master'
  );

  const formSource = readFileSync(path.join(frontendSrc, 'components/BankVoucherForm.tsx'), 'utf8');
  assert(
    formSource.includes("event.key === 'F10'") &&
      formSource.includes("event.key === 'F5'") &&
      formSource.includes("event.key === 'F2'") &&
      formSource.includes("event.key === 'F3'") &&
      formSource.includes("event.key === 'Escape'"),
    'Entry form wires page-scoped F10 / F5 / F2 / F3 / Esc shortcuts'
  );
  assert(
    !formSource.includes('<form') && formSource.includes("event.key === 'Enter'"),
    'Entry form never uses a native form element and blocks Enter-to-submit'
  );

  const printSource = readFileSync(path.join(frontendSrc, 'pages/BankVoucherPrintPage.tsx'), 'utf8');
  assert(
    printSource.includes('print-toolbar') &&
      printSource.includes('window.print()') &&
      printSource.includes('amountInWords(voucher.amount)') &&
      printSource.includes('Authorised Signatory'),
    'Print page exposes Print / Save as PDF with letterhead, amount in words and signature blocks'
  );

  assert(
    amountInWords('125000.50') === 'Rupees One Lakh Twenty Five Thousand And Paise Fifty Only',
    'Shared amountInWords utility renders the Indian numbering system correctly'
  );
  assert(
    amountInWords('0') === 'Rupees Zero Only' && amountInWords('') === '',
    'amountInWords handles zero and empty input safely'
  );

  const apiSource = readFileSync(path.join(frontendSrc, 'services/api.ts'), 'utf8');
  assert(
    apiSource.includes("'/bank-receipts'") &&
      apiSource.includes("'/bank-payments'") &&
      apiSource.includes("'/ledger-accounts'") &&
      apiSource.includes('/cancel'),
    'Frontend API client targets the Phase 12 REST endpoints'
  );
}

async function main() {
  console.log('Phase 12 — Bank Receipt & Bank Payment Voucher Test Suite');
  console.log('=======================================================');

  let receiptResult: SuiteResult | null = null;
  let paymentResult: SuiteResult | null = null;

  const receiptConfig: SuiteConfig = {
    voucherType: 'RECEIPT',
    label: 'Bank Receipt',
    prefix: 'BR',
    bankLedgerId: '',
    counterpartyPartyId: '',
    counterpartyNature: 'DEBIT',
    amount: '25000.50',
    reference: 'UTR123456789',
    mode: 'NEFT',
  };

  const paymentConfig: SuiteConfig = {
    voucherType: 'PAYMENT',
    label: 'Bank Payment',
    prefix: 'BP',
    bankLedgerId: '',
    counterpartyPartyId: '',
    counterpartyNature: 'CREDIT',
    amount: '18000.25',
    reference: 'UTR987654321',
    mode: 'NEFT',
  };

  try {
    await cleanupTestData();
    const ctx = await buildContext();

    receiptConfig.bankLedgerId = ctx.bankLedgerId;
    receiptConfig.counterpartyPartyId = ctx.customerPartyId;
    paymentConfig.bankLedgerId = ctx.secondBankLedgerId;
    paymentConfig.counterpartyPartyId = ctx.supplierPartyId;

    section('Bank Receipt voucher suite (debit bank / credit receiving ledger)');
    receiptResult = await runVoucherSuite(ctx, receiptConfig);

    section('Bank Payment voucher suite (debit paying ledger / credit bank)');
    paymentResult = await runVoucherSuite(ctx, paymentConfig);

    await runIntegritySuite(ctx, receiptResult, paymentResult, receiptConfig, paymentConfig);
    runFrontendWiringChecks();

    console.log(`\n=======================================================`);
    console.log(`RESULT: ${passed}/${total} assertions passed`);
    console.log('=======================================================');

    if (passed !== total) {
      throw new Error('Not every assertion passed.');
    }
  } catch (error) {
    console.error(`\nSUITE FAILED after ${passed}/${total} assertions.`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanupTestData();
      console.log('Test data cleaned up (vouchers, journal lines, sequences, ledgers, parties, companies).');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }

  process.exit(process.exitCode ?? 0);
}

void main();