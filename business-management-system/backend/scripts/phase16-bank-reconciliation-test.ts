// Phase 16 - Bank Reconciliation test suite.
// Isolated fixtures only: creates its own company, financial years, bank
// ledgers and posted vouchers, then removes them again. No demo data is seeded
// into the live company records.

import { Prisma, PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { bankReconciliationService } from '../src/services/bankReconciliationService.js';

const prisma = new PrismaClient();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log('  PASS [' + total + ']: ' + msg);
    passed++;
  } else {
    console.error('  FAIL [' + total + ']: ' + msg);
    throw new Error('Assertion failed: ' + msg);
  }
}

function section(title: string) {
  console.log('\n--- ' + title + ' ---');
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
      label +
        ' (expected ' +
        expectedStatus +
        ', received ' +
        (err.statusCode ?? 'none') +
        ': ' +
        err.message +
        ')'
    );
    return err;
  }
  assert(false, label + ' (expected rejection with ' + expectedStatus + ', but the call succeeded)');
  return { message: '' };
}

const TEST_COMPANY_CODE = 'P16TEST';
const OTHER_COMPANY_CODE = 'P16OTHER';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.bankReconciliationAudit.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationStatement.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationMark.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationOpening.deleteMany({ where: { companyId: { in: companyIds } } });
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
  otherBankLedgerId: string;
  expenseLedgerId: string;
  customerPartyId: string;
  supplierPartyId: string;
}

async function createCompanyWithYears(code: string, name: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 16, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
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
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 16 LTD');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 16 LTD');

  const bank = await ledgerService.create(primary.company.id, {
    accountCode: '1101',
    accountName: 'HDFC Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'HDFC Bank',
    branchName: 'Ring Road, Surat',
    ifscCode: 'HDFC0001234',
    bankAccountNumber: '50200012345678',
  });

  const secondBank = await ledgerService.create(primary.company.id, {
    accountCode: '1102',
    accountName: 'ICICI Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'ICICI Bank',
    ifscCode: 'ICIC0004567',
  });

  const otherBank = await ledgerService.create(other.company.id, {
    accountCode: '1101',
    accountName: 'Axis Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'Axis Bank',
  });

  const expense = await ledgerService.create(primary.company.id, {
    accountCode: '5101',
    accountName: 'Office Rent',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const customer = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P16CUST',
      partyName: 'Patel Yarn Traders',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P16SUPP',
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
    bankLedgerId: bank.id,
    secondBankLedgerId: secondBank.id,
    otherBankLedgerId: otherBank.id,
    expenseLedgerId: expense.id,
    customerPartyId: customer.id,
    supplierPartyId: supplier.id,
  };
}

async function createReceipt(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  reference: string
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    voucherDate,
    partyId: ctx.customerPartyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'NEFT',
    amount,
    referenceNumber: reference,
    narration: 'Phase 16 test receipt',
  });
}

async function createPayment(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  chequeNumber: string,
  chequeDate: string
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    voucherDate,
    partyId: ctx.supplierPartyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'CHEQUE',
    amount,
    chequeNumber,
    chequeDate,
    narration: 'Phase 16 test payment',
  });
}
const FROM = '2026-04-01';
const TO = '2026-06-30';

function findLine(
  transactions: Array<{ receiptAmount: string; paymentAmount: string; journalLineId: string }>,
  field: 'receiptAmount' | 'paymentAmount',
  amount: string
) {
  const row = transactions.find((entry) => entry[field] === amount);
  if (!row) throw new Error('Expected a transaction with ' + field + ' ' + amount);
  return row;
}

async function main() {
  try {
    await cleanupTestData();
    const ctx = await buildContext();

    await createReceipt(ctx, '30000.00', '2026-05-10', 'UTR-30000');
    await createReceipt(ctx, '15000.00', '2026-05-11', 'UTR-15000');
    await createPayment(ctx, '6000.00', '2026-05-10', 'CHQ-1001', '2026-05-08');
    const secondBankVoucher = await voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
      voucherDate: '2026-05-12',
      partyId: ctx.customerPartyId,
      bankAccountLedgerId: ctx.secondBankLedgerId,
      paymentMode: 'NEFT',
      amount: '2000.00',
      referenceNumber: 'UTR-SECOND-BANK',
      narration: 'Second bank receipt',
    });

    section('A. Bank book selection');
    const banks = await bankReconciliationService.listBanks(ctx.companyId, ctx.financialYearId);
    assert(banks.length === 2, 'only the two active bank ledgers are listed (received ' + banks.length + ')');
    assert(
      banks.every((bank) => bank.id !== ctx.expenseLedgerId),
      'non-bank expense ledger is excluded from the bank book list'
    );
    assert(
      banks.every((bank) => bank.id !== ctx.otherBankLedgerId),
      'another company bank ledger is excluded from the bank book list'
    );
    const primaryBank = banks.find((bank) => bank.id === ctx.bankLedgerId);
    assert(
      primaryBank?.currentBalance === '39000.00' && primaryBank?.balanceNature === 'Dr',
      'bank book balance is the real derived balance (39,000.00 Dr)'
    );

    section('B. Main reconciliation load');
    const initial = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(initial.opening.requiresSetup === true, 'opening balance dialog is required on first open');
    assert(
      initial.summary.closingBookBalance === '39000.00',
      'closing balance as per books is 39,000.00'
    );
    assert(initial.summary.unclearedPayments === '6000.00', 'uncleared payments are 6,000.00');
    assert(
      initial.summary.unclearedReceipts === '-45000.00',
      'uncleared receipts are displayed as -45,000.00'
    );
    assert(
      initial.summary.calculatedBankBalance === '0.00',
      'closing balance as per bank is 0.00 (39,000 + 6,000 - 45,000)'
    );
    assert(initial.transactions.length === 3, 'only the three primary-bank transactions are loaded');
    const paymentRow = findLine(initial.transactions, 'paymentAmount', '6000.00');
    assert(
      paymentRow.chequeNumber === 'CHQ-1001' && paymentRow.chequeDate === '2026-05-08',
      'cheque number and cheque date come from the stored payment'
    );
    const receiptRow = findLine(initial.transactions, 'receiptAmount', '30000.00');
    assert(
      receiptRow.accountName === 'Patel Yarn Traders',
      'account name uses the linked party name'
    );

    section('C. Closing statement balance');
    const savedZero = await bankReconciliationService.saveStatementBalance(
      ctx.companyId,
      ctx.financialYearId,
      {
        bankLedgerAccountId: ctx.bankLedgerId,
        fromDate: FROM,
        toDate: TO,
        statementBalance: '0.00',
      }
    );
    assert(savedZero.status === 'BALANCED', 'a zero difference is saved with status BALANCED');
    assert(savedZero.summary.difference === '0.00', 'difference is 0.00 when statement equals bank');

    section('D. Opening statement balance');
    const openingWarning = await bankReconciliationService.saveOpeningBalance(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, openingStatementBalance: '-5000.00' }
    );
    assert(
      openingWarning.opening.difference === '-5000.00',
      'opening difference is calculated as -5,000.00 against a nil book opening'
    );
    assert(
      openingWarning.opening.requiresAcknowledgement === true &&
        openingWarning.opening.isAcknowledged === false,
      'a non-zero opening difference requires explicit acknowledgement'
    );
    assert(
      openingWarning.warning !== null &&
        openingWarning.warning.message.indexOf('Difference: -5000.00') >= 0,
      'the opening mismatch warning reports the real difference'
    );

    const journalCountBefore = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
    const openingAcknowledged = await bankReconciliationService.saveOpeningBalance(
      ctx.companyId,
      ctx.financialYearId,
      {
        bankLedgerAccountId: ctx.bankLedgerId,
        openingStatementBalance: '-5000.00',
        acknowledgeDifference: true,
      }
    );
    assert(
      openingAcknowledged.opening.isAcknowledged === true &&
        openingAcknowledged.warning?.requiresAcknowledgement === false,
      'the opening difference can be acknowledged explicitly'
    );
    const journalCountAfterOpening = await prisma.journalLine.count({
      where: { companyId: ctx.companyId },
    });
    assert(
      journalCountBefore === journalCountAfterOpening,
      'opening balance setup never creates a journal entry'
    );

    const afterOpening = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      afterOpening.opening.requiresSetup === false &&
        afterOpening.opening.openingStatementBalance === '-5000.00',
      'the saved opening statement balance is reloaded'
    );
    assert(
      afterOpening.opening.requiresAcknowledgement === false,
      'an acknowledged opening difference no longer blocks the screen'
    );

    section('E. Mark reconciled and duplicate protection');
    const paymentLineId = paymentRow.journalLineId;
    const journalCountBeforeMark = await prisma.journalLine.count({
      where: { companyId: ctx.companyId },
    });
    const receiptLineId = findLine(initial.transactions, 'receiptAmount', '15000.00').journalLineId;
    const marked = await bankReconciliationService.markReconciled(
      ctx.companyId,
      ctx.financialYearId,
      paymentLineId,
      { clearingDate: '2026-05-12' }
    );
    assert(marked.clearingDate === '2026-05-12', 'a payment can be marked reconciled with a clearing date');
    const journalCountAfterMark = await prisma.journalLine.count({
      where: { companyId: ctx.companyId },
    });
    assert(
      journalCountBeforeMark === journalCountAfterMark,
      'marking a transaction reconciled never creates a journal line'
    );

    await expectError(
      () =>
        bankReconciliationService.markReconciled(ctx.companyId, ctx.financialYearId, paymentLineId, {
          clearingDate: '2026-05-13',
        }),
      409,
      'duplicate reconciliation is rejected'
    );

    await expectError(
      () =>
        bankReconciliationService.markReconciled(ctx.companyId, ctx.financialYearId, receiptLineId, {
          clearingDate: '2026-05-09',
        }),
      400,
      'a clearing date before the transaction date is rejected',
      'clearingDate'
    );

    await bankReconciliationService.markReconciled(ctx.companyId, ctx.financialYearId, receiptLineId, {
      clearingDate: '2026-05-13',
    });

    const afterClearing = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      afterClearing.summary.unclearedPayments === '0.00',
      'cleared payments are removed from uncleared payments'
    );
    assert(
      afterClearing.summary.unclearedReceipts === '-30000.00',
      'only the genuinely uncleared receipt remains (-30,000.00)'
    );
    assert(
      afterClearing.summary.calculatedBankBalance === '9000.00',
      'closing balance as per bank becomes 9,000.00 (39,000 + 0 - 30,000)'
    );

    const savedNine = await bankReconciliationService.saveStatementBalance(
      ctx.companyId,
      ctx.financialYearId,
      {
        bankLedgerAccountId: ctx.bankLedgerId,
        fromDate: FROM,
        toDate: TO,
        statementBalance: '9000.00',
      }
    );
    assert(
      savedNine.summary.difference === '0.00' && savedNine.status === 'BALANCED',
      'statement 9,000.00 matches the calculated bank balance'
    );

    section('F. Persistence and filters');
    const reloaded = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    const persistedPayment = findLine(reloaded.transactions, 'paymentAmount', '6000.00');
    assert(
      persistedPayment.clearingDate === '2026-05-12' && persistedPayment.isCleared === true,
      'clearing dates persist across a reload'
    );

    const paymentsOnly = await bankReconciliationService.listTransactions(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, fromDate: FROM, toDate: TO, viewType: 'PAYMENTS' }
    );
    assert(paymentsOnly.transactions.length === 1, 'Payments filter shows only payments');

    const receiptsOnly = await bankReconciliationService.listTransactions(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, fromDate: FROM, toDate: TO, viewType: 'RECEIPTS' }
    );
    assert(receiptsOnly.transactions.length === 2, 'Receipts filter shows only receipts');

    const pendingOnly = await bankReconciliationService.listTransactions(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, fromDate: FROM, toDate: TO, viewType: 'PENDING' }
    );
    assert(pendingOnly.transactions.length === 1, 'Pending filter shows only uncleared rows');

    const allRows = await bankReconciliationService.listTransactions(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, fromDate: FROM, toDate: TO, viewType: 'ALL' }
    );
    assert(allRows.transactions.length === 3, 'All filter shows receipts and payments');
    assert(
      allRows.summary.calculatedBankBalance === paymentsOnly.summary.calculatedBankBalance &&
        paymentsOnly.summary.calculatedBankBalance === receiptsOnly.summary.calculatedBankBalance,
      'changing the display filter never changes the reconciliation totals'
    );

    section('G. Cancelled and cross-bank transactions');
    const cancelled = await createReceipt(ctx, '7000.00', '2026-05-20', 'UTR-CANCELLED');
    await voucherService.cancel(
      ctx.companyId,
      ctx.financialYearId,
      'RECEIPT',
      cancelled.id,
      'Phase 16 cancellation coverage'
    );
    const afterCancel = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      afterCancel.transactions.every((row) => row.receiptAmount !== '7000.00'),
      'cancelled vouchers are excluded from the reconciliation grid'
    );
    assert(
      afterCancel.summary.closingBookBalance === '39000.00',
      'a cancelled voucher leaves the book balance unchanged'
    );
    assert(
      afterCancel.transactions.every((row) => row.sourceId !== secondBankVoucher.id) &&
        afterCancel.transactions.length === 3,
      'cross-bank transactions are excluded from the selected bank'
    );

    section('H. Company, financial-year and lock isolation');
    await expectError(
      () =>
        bankReconciliationService.load(ctx.otherCompanyId, ctx.otherFinancialYearId, {
          bankLedgerAccountId: ctx.bankLedgerId,
          fromDate: FROM,
          toDate: TO,
        }),
      404,
      'another company cannot reconcile this bank ledger'
    );

    await expectError(
      () =>
        bankReconciliationService.markReconciled(
          ctx.companyId,
          ctx.lockedFinancialYearId,
          paymentLineId,
          { clearingDate: '2026-05-12' }
        ),
      409,
      'a locked financial year blocks reconciliation changes'
    );

    section('I. Historical clearing after To Date');
    const secondBankReceipt = await voucherService.create(
      ctx.companyId,
      ctx.financialYearId,
      'RECEIPT',
      {
        voucherDate: '2026-06-01',
        partyId: ctx.customerPartyId,
        bankAccountLedgerId: ctx.secondBankLedgerId,
        paymentMode: 'NEFT',
        amount: '3000.00',
        referenceNumber: 'UTR-FUTURE-CLEAR',
        narration: 'Future clearing test',
      }
    );
    const secondLoad = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.secondBankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    const futureLine = findLine(secondLoad.transactions, 'receiptAmount', '3000.00');
    await bankReconciliationService.markReconciled(
      ctx.companyId,
      ctx.financialYearId,
      futureLine.journalLineId,
      { clearingDate: '2026-07-15' }
    );
    const historical = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.secondBankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    const futureRow = findLine(historical.transactions, 'receiptAmount', '3000.00');
    assert(
      futureRow.isPending === true,
      'a clearing date later than To Date still counts as uncleared for the historical report'
    );
    assert(
      historical.summary.unclearedReceipts === '-5000.00',
      'both second-bank receipts remain uncleared at 30-06-2026'
    );
    const laterPeriod = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.secondBankLedgerId,
      fromDate: FROM,
      toDate: '2026-07-31',
    });
    const laterRow = findLine(laterPeriod.transactions, 'receiptAmount', '3000.00');
    assert(laterRow.isCleared === true, 'the same clearing date clears the row in a later period');
    assert(
      laterPeriod.summary.calculatedBankBalance === '3000.00',
      'later period excludes the cleared receipt from uncleared totals'
    );

    section('J. Remove clearing date and audit trail');
    const removed = await bankReconciliationService.removeClearing(
      ctx.companyId,
      ctx.financialYearId,
      receiptLineId,
      { reason: 'Phase 16 removal coverage' }
    );
    assert(removed.clearingDate === null, 'removing a clearing date returns the row to pending');
    const afterRemoval = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      afterRemoval.summary.unclearedReceipts === '-45000.00',
      'the removed clearing date returns the receipt to uncleared totals'
    );

    const audits = await prisma.bankReconciliationAudit.groupBy({
      by: ['action'],
      where: { companyId: ctx.companyId },
      _count: { _all: true },
    });
    const auditByAction = new Map(audits.map((row) => [row.action, row._count._all]));
    assert((auditByAction.get('SET_CLEARING_DATE') ?? 0) >= 3, 'audit records every clearing-date assignment');
    assert(
      (auditByAction.get('REMOVE_CLEARING_DATE') ?? 0) >= 1,
      'audit records the clearing-date removal'
    );
    assert(
      (auditByAction.get('OPENING_BALANCE_SET') ?? 0) >= 1 &&
        (auditByAction.get('OPENING_BALANCE_ACKNOWLEDGED') ?? 0) >= 1,
      'audit records opening balance setup and acknowledgement'
    );

    section('K. Statement data and PDF');
    const statement = await bankReconciliationService.getStatement(
      ctx.companyId,
      ctx.financialYearId,
      { bankLedgerAccountId: ctx.bankLedgerId, fromDate: FROM, toDate: TO }
    );
    assert(
      statement.paymentRows.length === 0,
      'the statement shows All Clear when no payment is outstanding'
    );
    assert(
      statement.receiptRows.length === 2,
      'the statement lists the genuinely uncleared receipts'
    );
    assert(statement.history.length >= 2, 'statement snapshots are retained as history');

    const pdf = await bankReconciliationService.exportPdf(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
      orientation: 'portrait',
    });
    assert(
      pdf.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4',
      'the exported file is a genuine PDF'
    );
    assert(
      pdf.filename === 'BankReco_HDFC_Bank_Current_A_c_01-04-2026_30-06-2026.pdf',
      'the suggested filename is descriptive (received ' + pdf.filename + ')'
    );
    assert(pdf.pageCount >= 1, 'the PDF contains at least one A4 page');
    assert(pdf.buffer.length > 1000, 'the PDF has real rendered content');

    section('L. Accounting safety');
    assert(
      (await prisma.bankReconciliationMark.count({ where: { companyId: ctx.companyId } })) >= 1,
      'reconciliation metadata rows are stored separately from accounting data'
    );
    const ledgerAfter = await ledgerService.getById(
      ctx.companyId,
      ctx.financialYearId,
      ctx.bankLedgerId
    );
    assert(
      ledgerAfter.currentBalance === '39000.00',
      'reconciliation never changes the bank ledger balance'
    );

    console.log('\n=======================================================');
    console.log('RESULT: ' + passed + '/' + total + ' assertions passed');
    console.log('=======================================================');
    if (passed !== total) throw new Error('Not every assertion passed.');
  } catch (error) {
    console.error('\nSUITE FAILED after ' + passed + '/' + total + ' assertions.');
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanupTestData();
      console.log('Test data cleaned up (reconciliation records, vouchers, ledgers, companies).');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  }

  process.exit(process.exitCode ?? 0);
}

void main();