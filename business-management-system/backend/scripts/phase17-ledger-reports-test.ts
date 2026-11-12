// Phase 17 - Bank Book & Account Ledger report test suite.
// Isolated fixtures only: the suite creates its own company, financial years,
// ledgers, parties, party groups and posted vouchers, then removes them again.
// Nothing is seeded into the live company records.

import { Prisma, PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { bankBookService } from '../src/services/bankBookService.js';
import { accountLedgerService } from '../src/services/accountLedgerService.js';
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

const TEST_COMPANY_CODE = 'P17TEST';
const OTHER_COMPANY_CODE = 'P17OTHER';
const FROM = '2026-04-01';
const TO = '2026-06-30';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.bankBookSavedReport.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationAudit.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationStatement.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationMark.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReconciliationOpening.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.partyGroup.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

interface SuiteContext {
  companyId: string;
  financialYearId: string;
  otherCompanyId: string;
  otherFinancialYearId: string;
  bankLedgerId: string;
  secondBankLedgerId: string;
  otherBankLedgerId: string;
  expenseLedgerId: string;
  customerPartyId: string;
  customerLedgerId: string;
  supplierPartyId: string;
  retailGroupId: string;
  wholesaleGroupId: string;
}

async function createCompanyWithYears(code: string, name: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 17, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '02612345678',
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

  return { company, fy };
}

async function buildContext(): Promise<SuiteContext> {
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 17 LTD');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 17 LTD');

  const bank = await ledgerService.create(primary.company.id, {
    accountCode: '1101',
    accountName: 'HDFC Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '50000.00',
    balanceType: 'DEBIT',
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

  const retailGroup = await prisma.partyGroup.create({
    data: { companyId: primary.company.id, groupName: 'Retail Customers' },
  });
  const wholesaleGroup = await prisma.partyGroup.create({
    data: { companyId: primary.company.id, groupName: 'Wholesale Suppliers' },
  });

  const customer = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P17CUST',
      partyName: 'Patel Yarn Traders',
      partyType: 'CUSTOMER',
      partyGroupId: retailGroup.id,
      phone: '9825011111',
      gstin: '24AAACP1111F1Z2',
      panNumber: 'AAACP1111F',
      city: 'Surat',
      address: '12 Ring Road',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P17SUPP',
      partyName: 'Surat Textile Suppliers',
      partyType: 'SUPPLIER',
      partyGroupId: wholesaleGroup.id,
      phone: '9825022222',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const customerLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1201',
    accountName: 'Patel Yarn Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: customer.id,
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    bankLedgerId: bank.id,
    secondBankLedgerId: secondBank.id,
    otherBankLedgerId: otherBank.id,
    expenseLedgerId: expense.id,
    customerPartyId: customer.id,
    customerLedgerId: customerLedger.id,
    supplierPartyId: supplier.id,
    retailGroupId: retailGroup.id,
    wholesaleGroupId: wholesaleGroup.id,
  };
}

async function createReceipt(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  reference: string,
  partyId: string = ctx.customerPartyId
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'RECEIPT', {
    voucherDate,
    partyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'NEFT',
    amount,
    referenceNumber: reference,
    narration: 'Phase 17 receipt ' + reference,
  });
}

async function createPayment(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  chequeNumber: string,
  partyId: string | null = ctx.supplierPartyId
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    voucherDate,
    partyId,
    counterpartyLedgerId: partyId ? undefined : ctx.expenseLedgerId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: partyId ? 'CHEQUE' : 'NEFT',
    amount,
    chequeNumber: partyId ? chequeNumber : null,
    chequeDate: partyId ? voucherDate : null,
    referenceNumber: partyId ? null : 'UTR-' + chequeNumber,
    narration: 'Phase 17 payment ' + amount,
  });
}
function pdfText(buffer: Buffer): string {
  return buffer.toString('latin1');
}

function pdfPageCount(buffer: Buffer): number {
  const matches = pdfText(buffer).match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

function pdfMediaBox(buffer: Buffer): { width: number; height: number } | null {
  const match = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdfText(buffer));
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

async function main() {
  let journalLineCountBefore = 0;
  try {
    await cleanupTestData();
    const ctx = await buildContext();

    await createReceipt(ctx, '30000.00', '2026-05-10', 'UTR-30000');
    await createReceipt(ctx, '15000.00', '2026-05-11', 'UTR-15000');
    const chequePayment = await createPayment(ctx, '6000.00', '2026-05-10', 'CHQ-1001');
    await createPayment(ctx, '4000.00', '2026-06-15', 'NEFT-4000', null);
    const cancelled = await createReceipt(ctx, '99000.00', '2026-05-12', 'UTR-CANCELLED');
    await voucherService.cancel(
      ctx.companyId,
      ctx.financialYearId,
      'RECEIPT',
      cancelled.id,
      'Phase 17 cancelled fixture'
    );
    const superseded = await createReceipt(ctx, '5000.00', '2026-06-20', 'UTR-SUPERSEDED');
    await prisma.bankVoucher.update({
      where: { id: superseded.id },
      data: { revision: 2 },
    });
    await prisma.journalLine.create({
      data: {
        companyId: ctx.companyId,
        financialYearId: ctx.financialYearId,
        voucherId: chequePayment.id,
        ledgerAccountId: ctx.bankLedgerId,
        revision: 1,
        lineNumber: 99,
        debitAmount: new Prisma.Decimal(777),
        creditAmount: new Prisma.Decimal(0),
        isReversal: true,
        postingDate: new Date('2026-05-10T00:00:00.000Z'),
        narration: 'Phase 17 reversal fixture',
      },
    });

    journalLineCountBefore = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });

    section('A. Bank Book options');
    const options = await bankBookService.getOptions(ctx.companyId, ctx.financialYearId);
    assert(
      options.banks.length === 2 &&
        options.banks.some((bank) => bank.id === ctx.bankLedgerId) &&
        options.banks.some((bank) => bank.id === ctx.secondBankLedgerId),
      'only the two active bank ledgers of the company are offered (received ' + options.banks.length + ')'
    );
    assert(
      options.banks.every((bank) => bank.id !== ctx.expenseLedgerId) &&
        options.banks.every((bank) => bank.id !== ctx.otherBankLedgerId),
      'expense ledgers and other-company bank ledgers are excluded from Book Name'
    );
    const bankOption = options.banks.find((bank) => bank.id === ctx.bankLedgerId);
    assert(
      bankOption?.openingBalance === '50000.00' && bankOption?.openingNature === 'Dr',
      'Book Name popup shows the real stored opening balance (50,000.00 Dr)'
    );
    assert(
      bankOption?.currentBalance === '85000.00' && bankOption?.currentNature === 'Dr',
      'Book Name popup shows the real derived current balance (85,000.00 Dr)'
    );
    assert(
      options.defaultFromDate === '2026-04-01' &&
        options.defaultToDate >= options.defaultFromDate &&
        options.defaultToDate <= '2027-03-31',
      'From/To default to the financial year start and today, capped at the year end'
    );
    assert(
      options.columns.map((column) => column.key).join(',') ===
        'voucherDate,voucherNo,accountName,particulars,chequeRefNo,withdraw,deposit,balance',
      'Bank Book detail columns are the eight required accounting columns in order'
    );
    assert(
      options.summaryColumns.map((column) => column.key).join(',') ===
        'date,totalWithdraw,totalDeposit,netMovement,closingBalance',
      'Bank Book summary columns are the five date-wise columns in order'
    );
    assert(
      options.partyGroups.length === 2 &&
        options.partyGroups.some((group) => group.id === ctx.retailGroupId) &&
        options.partyGroups.some((group) => group.id === ctx.wholesaleGroupId),
      'Party Group lists the real stored party groups of the company'
    );

    section('B. Bank Book detail run');
    const detail = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      detail.rows.length === 4 && detail.totalRows === 4,
      'only the four eligible posted bank postings are reported (cancelled, superseded and reversal lines excluded)'
    );
    assert(
      detail.opening.amount === '50000.00' && detail.opening.nature === 'Dr' && detail.opening.date === FROM,
      'the opening row carries the real ledger opening of 50,000.00 Dr for the period start'
    );
    assert(
      detail.rows.map((row) => row.balance + ' ' + row.balanceNature).join(' | ') ===
        '44000.00 Dr | 74000.00 Dr | 89000.00 Dr | 85000.00 Dr',
      'the running balance is Prev + Deposit - Withdraw for every row'
    );
    assert(
      detail.totals.totalWithdraw === '10000.00' &&
        detail.totals.totalDeposit === '45000.00' &&
        detail.totals.closingBalance === '85000.00' &&
        detail.totals.closingNature === 'Dr',
      'detail totals are Withdraw 10,000.00, Deposit 45,000.00 and closing 85,000.00 Dr'
    );
    assert(
      detail.rows.every((row) => row.voucherNo !== cancelled.voucherNumber) &&
        detail.rows.every((row) => row.voucherNo !== superseded.voucherNumber),
      'cancelled and superseded documents never reach the report'
    );
    assert(
      detail.rows.reduce((sum, row) => sum + Number(row.deposit || 0), 0) === 45000,
      'reversal lines are excluded from the deposit total'
    );
    const chequeRow = detail.rows.find((row) => row.chequeRefNo === 'CHQ-1001');
    assert(
      chequeRow !== undefined &&
        chequeRow.accountName === 'Surat Textile Suppliers' &&
        chequeRow.withdraw === '6000.00' &&
        chequeRow.deposit === '',
      'a payment row shows the party account name, the cheque reference and only the Withdraw amount'
    );
    assert(
      detail.rows.every((row) => row.voucherDate === row.voucherDate.slice(0, 10)),
      'voucher dates are ISO posting dates taken from the posted journal line'
    );
    assert(
      detail.rows[0].voucherDate === '2026-05-10' &&
        detail.rows[1].voucherDate === '2026-05-10' &&
        detail.rows[2].voucherDate === '2026-05-11' &&
        detail.rows[3].voucherDate === '2026-06-15',
      'rows are ordered by posting date and then document number'
    );

    const paged = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 2,
    });
    assert(
      paged.rows.length === 2 &&
        paged.totalRows === 4 &&
        paged.totals.totalDeposit === '45000.00' &&
        paged.totals.closingBalance === '85000.00',
      'totals cover the full filtered dataset even when only one page of rows is returned'
    );

    section('C. Bank Book filters');
    const byVoucher = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      filterField: 'voucherNo',
      filterText: 'BR-2026-0001',
      page: 1,
      pageSize: 100,
    });
    assert(
      byVoucher.rows.length === 1 &&
        byVoucher.rows[0].deposit === '30000.00' &&
        byVoucher.totals.totalWithdraw === '0.00',
      'the Voucher No filter narrows the rows to the matching posting'
    );
    assert(
      byVoucher.opening.amount === '50000.00' && byVoucher.totals.closingBalance === '80000.00',
      'the opening balance stays the true unfiltered opening while the filtered running balance starts from it'
    );

    const byCheque = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      filterField: 'chequeRef',
      filterText: 'CHQ-1001',
      page: 1,
      pageSize: 100,
    });
    assert(
      byCheque.rows.length === 1 && byCheque.rows[0].withdraw === '6000.00',
      'the Cheque / Reference filter matches the stored cheque number'
    );

    const byAccount = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      filterField: 'accountName',
      filterText: 'Patel Yarn',
      page: 1,
      pageSize: 100,
    });
    assert(
      byAccount.rows.length === 2,
      'the Account Name filter matches both posted receipts of the party'
    );

    const bySource = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      filterField: 'sourceType',
      filterText: 'RECEIPT',
      page: 1,
      pageSize: 100,
    });
    assert(
      bySource.rows.length === 2 && bySource.rows.every((row) => row.sourceType === 'RECEIPT'),
      'the Source Type filter returns only bank receipts'
    );

    const byGroup = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      partyGroupId: ctx.retailGroupId,
      page: 1,
      pageSize: 100,
    });
    assert(
      byGroup.rows.length === 2 &&
        byGroup.meta.partyGroupName === 'Retail Customers' &&
        byGroup.opening.amount === '50000.00',
      'the Party Group filter uses the real party group and never changes the opening balance'
    );

    const byWholesale = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      partyGroupId: ctx.wholesaleGroupId,
      page: 1,
      pageSize: 100,
    });
    assert(
      byWholesale.rows.length === 1 && byWholesale.rows[0].withdraw === '6000.00',
      'a second party group returns only its own posting'
    );

    const unassigned = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      fromDate: FROM,
      toDate: TO,
      partyGroupId: 'UNASSIGNED',
      page: 1,
      pageSize: 100,
    });
    assert(
      unassigned.rows.length === 1 && unassigned.rows[0].withdraw === '4000.00',
      'the Unassigned party group returns only postings without a party group'
    );

    await expectError(
      () =>
        bankBookService.run(ctx.companyId, ctx.financialYearId, {
          bankLedgerAccountId: ctx.bankLedgerId,
          detailMode: 'DETAIL',
          fromDate: FROM,
          toDate: TO,
          filterField: 'notAField',
          filterText: 'x',
          page: 1,
          pageSize: 10,
        }),
      400,
      'an unsupported filter field is rejected'
    );

    section('D. Bank Book summary');
    const summary = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'SUMMARY',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      summary.rows.length === 0 && summary.summaryRows.length === 3,
      'summary mode groups the four postings into three date rows'
    );
    assert(
      summary.summaryRows.map((row) => row.date).join(',') === '2026-05-10,2026-05-11,2026-06-15',
      'summary rows are ordered by date'
    );
    assert(
      summary.summaryRows[0].totalWithdraw === '6000.00' &&
        summary.summaryRows[0].totalDeposit === '30000.00' &&
        summary.summaryRows[0].netMovement === '24000.00' &&
        summary.summaryRows[0].closingBalance === '74000.00',
      'the first date row totals both postings and closes at 74,000.00 Dr'
    );
    assert(
      summary.summaryRows[1].closingBalance === '89000.00' &&
        summary.summaryRows[2].netMovement === '-4000.00' &&
        summary.summaryRows[2].closingBalance === '85000.00',
      'the closing balance of one date becomes the opening of the next and ends at 85,000.00 Dr'
    );
    assert(
      summary.totals.totalWithdraw === detail.totals.totalWithdraw &&
        summary.totals.totalDeposit === detail.totals.totalDeposit &&
        summary.totals.closingBalance === detail.totals.closingBalance,
      'summary totals equal the detail totals for the same filtered dataset'
    );

    const detailAgain = await bankBookService.run(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      detailAgain.rows.map((row) => row.journalLineId + ':' + row.balance).join('|') ===
        detail.rows.map((row) => row.journalLineId + ':' + row.balance).join('|'),
      'switching back to Detail returns the identical rows and balances'
    );

    section('E. Bank Book validation and isolation');
    await expectError(
      () =>
        bankBookService.run(ctx.companyId, ctx.financialYearId, {
          bankLedgerAccountId: ctx.bankLedgerId,
          detailMode: 'DETAIL',
          fromDate: '2026-06-30',
          toDate: '2026-05-01',
          page: 1,
          pageSize: 10,
        }),
      400,
      'a From date after the To date is rejected'
    );
    await expectError(
      () =>
        bankBookService.run(ctx.companyId, ctx.financialYearId, {
          bankLedgerAccountId: ctx.bankLedgerId,
          detailMode: 'DETAIL',
          fromDate: '2025-12-01',
          toDate: TO,
          page: 1,
          pageSize: 10,
        }),
      400,
      'a period outside the financial year is rejected'
    );
    await expectError(
      () =>
        bankBookService.run(ctx.companyId, ctx.financialYearId, {
          bankLedgerAccountId: ctx.otherBankLedgerId,
          detailMode: 'DETAIL',
          fromDate: FROM,
          toDate: TO,
          page: 1,
          pageSize: 10,
        }),
      404,
      'another company bank ledger is never reachable'
    );
    await expectError(
      () =>
        bankBookService.run(ctx.companyId, ctx.financialYearId, {
          bankLedgerAccountId: ctx.expenseLedgerId,
          detailMode: 'DETAIL',
          fromDate: FROM,
          toDate: TO,
          page: 1,
          pageSize: 10,
        }),
      400,
      'a non-bank ledger is rejected as a Book Name'
    );

    section('F. Saved Bank Book configurations');
    const saved = await bankBookService.saveReport(
      ctx.companyId,
      ctx.financialYearId,
      {
        reportName: 'Daily HDFC',
        bankLedgerAccountId: ctx.bankLedgerId,
        detailMode: 'DETAIL',
        reportType: 'DAILY',
        fromDate: FROM,
        toDate: TO,
        columns: ['voucherDate', 'particulars', 'withdraw', 'deposit', 'balance'],
      },
      null
    );
    assert(
      saved.reportName === 'Daily HDFC' &&
        saved.columns.includes('balance') &&
        saved.columns.includes('voucherDate'),
      'a Bank Book configuration is saved with its real column set'
    );
    const savedList = await bankBookService.listSavedReports(ctx.companyId, ctx.financialYearId);
    assert(savedList.length === 1 && savedList[0].id === saved.id, 'the saved configuration is listed');
    await expectError(
      () =>
        bankBookService.saveReport(
          ctx.companyId,
          ctx.financialYearId,
          {
            reportName: 'Daily HDFC',
            bankLedgerAccountId: ctx.bankLedgerId,
            detailMode: 'DETAIL',
            fromDate: FROM,
            toDate: TO,
          },
          null
        ),
      409,
      'a duplicate saved report name is rejected'
    );
    const renamed = await bankBookService.saveReport(
      ctx.companyId,
      ctx.financialYearId,
      {
        reportName: 'Daily HDFC Summary',
        bankLedgerAccountId: ctx.bankLedgerId,
        detailMode: 'SUMMARY',
        fromDate: FROM,
        toDate: TO,
        columns: ['date', 'totalDeposit', 'closingBalance'],
      },
      saved.id
    );
    assert(
      renamed.id === saved.id && renamed.detailMode === 'SUMMARY',
      'an existing saved configuration is updated in place'
    );
    await bankBookService.deleteSavedReport(ctx.companyId, saved.id);
    const afterDelete = await bankBookService.listSavedReports(ctx.companyId, ctx.financialYearId);
    assert(afterDelete.length === 0, 'a saved configuration can be deleted');

    const readOnlyLines = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
    assert(
      readOnlyLines === journalLineCountBefore,
      'running every Bank Book report never writes or deletes a journal line'
    );
    const bankAfter = await prisma.ledgerAccount.findUnique({
      where: { companyId_id: { companyId: ctx.companyId, id: ctx.bankLedgerId } },
      select: { openingBalance: true },
    });
    assert(
      bankAfter?.openingBalance.toFixed(2) === '50000.00',
      'the stored ledger opening balance is never modified by a report'
    );
    section('G. Account Ledger options');
    const ledgerOptions = await accountLedgerService.getOptions(ctx.companyId, ctx.financialYearId);
    assert(
      ledgerOptions.accounts.length >= 5 &&
        ledgerOptions.accounts.some((account) => account.id === ctx.bankLedgerId) &&
        ledgerOptions.accounts.some((account) => account.id === ctx.expenseLedgerId) &&
        ledgerOptions.accounts.some((account) => account.id === ctx.customerLedgerId),
      'every permitted ledger group is listed, not only bank accounts (received ' +
        ledgerOptions.accounts.length +
        ')'
    );
    assert(
      ledgerOptions.accounts.every((account) => account.id !== ctx.otherBankLedgerId),
      'another company ledger is never listed'
    );
    const bankLedgerOption = ledgerOptions.accounts.find((account) => account.id === ctx.bankLedgerId);
    assert(
      bankLedgerOption?.isBankAccount === true &&
        bankLedgerOption?.balanceAmount === '85000.00' &&
        bankLedgerOption?.balanceNature === 'Dr',
      'the bank ledger is flagged as a bank account with its real derived balance'
    );
    const customerOption = ledgerOptions.accounts.find((account) => account.id === ctx.customerLedgerId);
    assert(
      customerOption?.partyName === 'Patel Yarn Traders' &&
        customerOption?.partyMobile === '9825011111' &&
        customerOption?.partyGstin === '24AAACP1111F1Z2' &&
        customerOption?.partyPan === 'AAACP1111F' &&
        customerOption?.partyCity === 'Surat' &&
        customerOption?.partyGroupName === 'Retail Customers',
      'the lookup exposes only stored party details (mobile, GSTIN, PAN, city, party group)'
    );
    assert(
      ledgerOptions.columns.map((column) => column.key).join(',') ===
        'date,voucherNo,chequeNo,type,bookName,debit,credit,balance,sign',
      'Account Ledger columns are the nine required columns in order'
    );

    section('H. Account Ledger run');
    const bankLedger = await accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      bankLedger.rows.length === 4 &&
        bankLedger.opening.amount === '50000.00' &&
        bankLedger.opening.nature === 'Dr',
      'the bank ledger reports the four eligible postings from the real ledger opening'
    );
    assert(
      bankLedger.totals.debitTotal === '45000.00' &&
        bankLedger.totals.creditTotal === '10000.00' &&
        bankLedger.totals.closingBalance === '85000.00' &&
        bankLedger.totals.closingNature === 'Dr',
      'Debit 45,000.00, Credit 10,000.00 and closing 85,000.00 Dr match the Bank Book'
    );
    const chequeLedgerRow = bankLedger.rows.find((row) => row.chequeNo === 'CHQ-1001');
    assert(
      chequeLedgerRow !== undefined &&
        chequeLedgerRow.type === 'Bank Payment' &&
        chequeLedgerRow.bookName === 'Bank Payment' &&
        chequeLedgerRow.credit === '6000.00' &&
        chequeLedgerRow.sign === 'Dr',
      'a cheque payment row carries the stored cheque number, voucher type, book and sign'
    );
    const receiptLedgerRow = bankLedger.rows.find((row) => row.voucherNo === 'BR-2026-0001');
    assert(
      receiptLedgerRow !== undefined &&
        receiptLedgerRow.type === 'Bank Receipt' &&
        receiptLedgerRow.bookName === 'Bank Receipt' &&
        receiptLedgerRow.debit === '30000.00',
      'a receipt row is labelled Bank Receipt and posts to Debit'
    );
    assert(
      bankLedger.rows.every(
        (row) => (row.sign === 'Dr' || row.sign === 'Cr') && Number(row.balance) >= 0
      ) && bankLedger.rows[bankLedger.rows.length - 1].sign === bankLedger.totals.closingNature,
      'every balance column is an absolute amount with the sign held in its own column'
    );
    assert(
      bankLedger.rows.map((row) => row.balance).join(',') === '44000.00,74000.00,89000.00,85000.00',
      'the Account Ledger running balance matches the Bank Book row for row'
    );

    const customerLedger = await accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.customerLedgerId,
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      customerLedger.rows.length === 2 &&
        customerLedger.totals.creditTotal === '45000.00' &&
        customerLedger.totals.closingNature === 'Cr',
      'a party ledger works with the same engine and shows the cancelled receipt excluded'
    );

    const expenseLedger = await accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.expenseLedgerId,
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 100,
    });
    assert(
      expenseLedger.rows.length === 1 &&
        expenseLedger.rows[0].debit === '4000.00' &&
        expenseLedger.totals.closingBalance === '4000.00',
      'an expense ledger is reportable without any bank account involvement'
    );

    const narrowed = await accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
      columns: ['date', 'debit', 'credit'],
      page: 1,
      pageSize: 100,
    });
    assert(
      narrowed.columns.map((column) => column.key).join(',') === 'date,debit,credit,balance,sign',
      'a saved layout cannot drop the required Balance and Sign columns'
    );

    const ledgerPaged = await accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
      page: 1,
      pageSize: 2,
    });
    assert(
      ledgerPaged.rows.length === 2 &&
        ledgerPaged.totalRows === 4 &&
        ledgerPaged.totals.closingBalance === '85000.00',
      'Account Ledger totals also cover the full period, not only the visible page'
    );

    await expectError(
      () =>
        accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
          ledgerAccountId: ctx.otherBankLedgerId,
          fromDate: FROM,
          toDate: TO,
          page: 1,
          pageSize: 10,
        }),
      404,
      'another company ledger is rejected by the Account Ledger'
    );
    await expectError(
      () =>
        accountLedgerService.run(ctx.companyId, ctx.financialYearId, {
          ledgerAccountId: ctx.bankLedgerId,
          fromDate: '2026-06-30',
          toDate: '2026-05-01',
          page: 1,
          pageSize: 10,
        }),
      400,
      'the Account Ledger rejects a From date after the To date'
    );

    section('I. PDF and Excel exports');
    const bankPdf = await bankBookService.exportPdf(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      pdfOrientation: 'portrait',
    });
    const bankPdfText = pdfText(bankPdf.buffer);
    assert(
      bankPdfText.startsWith('%PDF-1.4') && bankPdf.pageCount >= 1 && pdfPageCount(bankPdf.buffer) >= 1,
      'the Bank Book PDF is a genuine multi-section PDF file'
    );
    assert(
      bankPdfText.includes('BANK BOOK') &&
        bankPdfText.includes('HDFC Bank Current A/c') &&
        bankPdfText.includes('Opening Balance') &&
        bankPdfText.includes('Total'),
      'the Bank Book PDF carries the BANK header, opening row and totals row'
    );
    const bankPortraitBox = pdfMediaBox(bankPdf.buffer);
    const landscapePdf = await bankBookService.exportPdf(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
      pdfOrientation: 'landscape',
    });
    const bankLandscapeBox = pdfMediaBox(landscapePdf.buffer);
    assert(
      bankPortraitBox !== null &&
        bankLandscapeBox !== null &&
        bankPortraitBox.height > bankPortraitBox.width &&
        bankLandscapeBox.width > bankLandscapeBox.height,
      'the Bank Book PDF honours the A4 portrait and landscape orientations'
    );
    const bankXlsx = await bankBookService.exportXlsx(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      detailMode: 'DETAIL',
      reportType: 'DAILY',
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      bankXlsx.buffer.subarray(0, 2).toString('latin1') === 'PK' &&
        bankXlsx.filename.endsWith('.xlsx'),
      'the Bank Book Excel export is a real xlsx workbook, not renamed HTML'
    );

    const ledgerPdf = await accountLedgerService.exportPdf(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    const ledgerPdfText = pdfText(ledgerPdf.buffer);
    assert(
      ledgerPdfText.startsWith('%PDF-1.4') && pdfPageCount(ledgerPdf.buffer) >= 1,
      'the Account Ledger PDF is a genuine PDF file'
    );
    assert(
      ledgerPdfText.includes('ACCOUNT LEDGER') &&
        ledgerPdfText.includes('HDFC Bank Current A/c') &&
        ledgerPdfText.includes('GSTIN') &&
        ledgerPdfText.includes('Opening Balance'),
      'the Account Ledger PDF prints the letterhead, ledger name, GSTIN and opening row'
    );
    const ledgerXlsx = await accountLedgerService.exportXlsx(ctx.companyId, ctx.financialYearId, {
      ledgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      ledgerXlsx.buffer.subarray(0, 2).toString('latin1') === 'PK' &&
        ledgerXlsx.filename.endsWith('.xlsx'),
      'the Account Ledger Excel export is a real xlsx workbook'
    );

    section('J. Phase 16 regression');
    const reconciliation = await bankReconciliationService.load(ctx.companyId, ctx.financialYearId, {
      bankLedgerAccountId: ctx.bankLedgerId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      reconciliation.transactions.length === 4 &&
        reconciliation.summary.closingBookBalance === '85000.00',
      'Bank Reconciliation still sees the same four postings and the same closing book balance'
    );
    const finalLines = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
    assert(
      finalLines === journalLineCountBefore,
      'the whole suite leaves every journal line untouched'
    );

    console.log('\n========================================');
    console.log('Phase 17 suite: ' + passed + '/' + total + ' assertions passed');
    console.log('========================================');
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\nPhase 17 suite failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});