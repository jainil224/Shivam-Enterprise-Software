// Phase 19 - Account Wise Balance report test suite (Phase 1).
// Isolated fixtures only: the suite creates its own company, financial years,
// ledger accounts, parties, party groups and posted vouchers, then removes them.
// Nothing is written to the live company records and no report run writes data.

import { Prisma, PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { accountWiseBalanceService } from '../src/services/accountWiseBalanceService.js';

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

const TEST_COMPANY_CODE = 'P19TEST';
const OTHER_COMPANY_CODE = 'P19OTHER';
const COMPANY_NAME = 'SHIVAM ENTERPRISE PHASE 19 LTD';
const FY_START = '2026-04-01';
const FY_END = '2027-03-31';
const FROM = '2026-05-01';
const TO = '2026-06-30';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

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
  priorFinancialYearId: string;
  otherCompanyId: string;
  otherFinancialYearId: string;
  otherPartyId: string;
  otherLedgerId: string;
  otherPartyGroupId: string;
  bankLedgerId: string;
  customer1PartyId: string;
  customer2PartyId: string;
  customer3PartyId: string;
  inactivePartyId: string;
  supplier1PartyId: string;
  supplier2PartyId: string;
  customer1LedgerId: string;
  customer2LedgerId: string;
  customer3LedgerId: string;
  inactiveLedgerId: string;
  supplier1LedgerId: string;
  supplier2LedgerId: string;
  capitalLedgerId: string;
  expenseLedgerId: string;
  incomeLedgerId: string;
  assetLedgerId: string;
  retailGroupId: string;
  wholesaleGroupId: string;
  dormantGroupId: string;
}

async function createCompanyWithYears(code: string, name: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 19, Ring Road',
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

  const priorFy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2025 - 2026',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      isActive: false,
      isLocked: false,
    },
  });

  return { company, fy, priorFy };
}

interface PartySeed {
  partyCode: string;
  partyName: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyGroupId?: string | null;
  phone?: string | null;
  panNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  isActive?: boolean;
  balanceType?: 'DEBIT' | 'CREDIT';
}

function createParty(companyId: string, seed: PartySeed) {
  return prisma.party.create({
    data: {
      companyId,
      partyCode: seed.partyCode,
      partyName: seed.partyName,
      partyType: seed.partyType,
      partyGroupId: seed.partyGroupId ?? null,
      phone: seed.phone ?? null,
      panNumber: seed.panNumber ?? null,
      address: seed.address ?? null,
      city: seed.city ?? null,
      state: seed.state ?? null,
      pincode: seed.pincode ?? null,
      isActive: seed.isActive ?? true,
      openingBalance: new Prisma.Decimal(0),
      balanceType: seed.balanceType ?? (seed.partyType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT'),
    },
  });
}

async function buildContext(): Promise<SuiteContext> {
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, COMPANY_NAME);
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 19 LTD');

  const retailGroup = await prisma.partyGroup.create({
    data: { companyId: primary.company.id, groupName: 'Retail Customers' },
  });
  const wholesaleGroup = await prisma.partyGroup.create({
    data: { companyId: primary.company.id, groupName: 'Wholesale Suppliers' },
  });
  const dormantGroup = await prisma.partyGroup.create({
    data: { companyId: primary.company.id, groupName: 'Dormant Group', isActive: false },
  });
  const otherGroup = await prisma.partyGroup.create({
    data: { companyId: other.company.id, groupName: 'Other Company Group' },
  });

  const customer1 = await createParty(primary.company.id, {
    partyCode: 'P19CUST1',
    partyName: 'Patel Yarn Traders',
    partyType: 'CUSTOMER',
    partyGroupId: retailGroup.id,
    phone: '9825011111',
    panNumber: 'AAACP1111F',
    address: '12 Ring Road',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395002',
  });

  const customer2 = await createParty(primary.company.id, {
    partyCode: 'P19CUST2',
    partyName: 'Mehta Fabrics',
    partyType: 'CUSTOMER',
    partyGroupId: retailGroup.id,
    phone: '9825033333',
  });

  const customer3 = await createParty(primary.company.id, {
    partyCode: 'P19CUST3',
    partyName: 'Zero Balance Customer',
    partyType: 'CUSTOMER',
  });

  const inactiveParty = await createParty(primary.company.id, {
    partyCode: 'P19INACT',
    partyName: 'Dormant Customer',
    partyType: 'CUSTOMER',
    partyGroupId: dormantGroup.id,
  });

  const supplier1 = await createParty(primary.company.id, {
    partyCode: 'P19SUPP1',
    partyName: 'Surat Textile Suppliers',
    partyType: 'SUPPLIER',
    partyGroupId: wholesaleGroup.id,
    phone: '9825022222',
    panNumber: 'AAACS2222G',
  });

  const supplier2 = await createParty(primary.company.id, {
    partyCode: 'P19SUPP2',
    partyName: 'Kiran Dyeing Works',
    partyType: 'SUPPLIER',
  });

  const otherParty = await createParty(other.company.id, {
    partyCode: 'P19OTH1',
    partyName: 'Other Company Buyer',
    partyType: 'CUSTOMER',
    partyGroupId: otherGroup.id,
  });

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

  const customer1Ledger = await ledgerService.create(primary.company.id, {
    accountCode: '1201',
    accountName: 'Patel Yarn Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '10000.00',
    balanceType: 'DEBIT',
    partyId: customer1.id,
  });

  const customer2Ledger = await ledgerService.create(primary.company.id, {
    accountCode: '1202',
    accountName: 'Mehta Fabrics',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: customer2.id,
  });

  const customer3Ledger = await ledgerService.create(primary.company.id, {
    accountCode: '1203',
    accountName: 'Zero Balance Customer',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: customer3.id,
  });

  const inactiveLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1204',
    accountName: 'Dormant Customer',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    partyId: inactiveParty.id,
  });
  await prisma.ledgerAccount.update({
    where: { id: inactiveLedger.id },
    data: { isActive: false },
  });
  await prisma.party.update({
    where: { id: inactiveParty.id },
    data: { isActive: false },
  });

  const supplier1Ledger = await ledgerService.create(primary.company.id, {
    accountCode: '2101',
    accountName: 'Surat Textile Suppliers',
    accountGroup: 'SUNDRY_CREDITORS',
    openingBalance: '20000.00',
    balanceType: 'CREDIT',
    partyId: supplier1.id,
  });

  const supplier2Ledger = await ledgerService.create(primary.company.id, {
    accountCode: '2102',
    accountName: 'Kiran Dyeing Works',
    accountGroup: 'SUNDRY_CREDITORS',
    openingBalance: '0.00',
    balanceType: 'CREDIT',
    partyId: supplier2.id,
  });

  const capitalLedger = await ledgerService.create(primary.company.id, {
    accountCode: '3101',
    accountName: 'Owner Capital',
    accountGroup: 'CAPITAL',
    openingBalance: '100000.00',
    balanceType: 'CREDIT',
  });

  const expenseLedger = await ledgerService.create(primary.company.id, {
    accountCode: '5101',
    accountName: 'Office Rent',
    accountGroup: 'INDIRECT_EXPENSES',
    openingBalance: '0.00',
  });

  const incomeLedger = await ledgerService.create(primary.company.id, {
    accountCode: '4101',
    accountName: 'Commission Income',
    accountGroup: 'INDIRECT_INCOME',
    openingBalance: '0.00',
  });

  const assetLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1301',
    accountName: 'Office Furniture',
    accountGroup: 'ASSETS',
    openingBalance: '0.00',
  });

  const otherLedger = await ledgerService.create(other.company.id, {
    accountCode: '1201',
    accountName: 'Other Company Buyer',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '4000.00',
    balanceType: 'DEBIT',
    partyId: otherParty.id,
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    priorFinancialYearId: primary.priorFy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    otherPartyId: otherParty.id,
    otherLedgerId: otherLedger.id,
    otherPartyGroupId: otherGroup.id,
    bankLedgerId: bank.id,
    customer1PartyId: customer1.id,
    customer2PartyId: customer2.id,
    customer3PartyId: customer3.id,
    inactivePartyId: inactiveParty.id,
    supplier1PartyId: supplier1.id,
    supplier2PartyId: supplier2.id,
    customer1LedgerId: customer1Ledger.id,
    customer2LedgerId: customer2Ledger.id,
    customer3LedgerId: customer3Ledger.id,
    inactiveLedgerId: inactiveLedger.id,
    supplier1LedgerId: supplier1Ledger.id,
    supplier2LedgerId: supplier2Ledger.id,
    capitalLedgerId: capitalLedger.id,
    expenseLedgerId: expenseLedger.id,
    incomeLedgerId: incomeLedger.id,
    assetLedgerId: assetLedger.id,
    retailGroupId: retailGroup.id,
    wholesaleGroupId: wholesaleGroup.id,
    dormantGroupId: dormantGroup.id,
  };
}
async function createReceipt(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  reference: string,
  partyId: string,
  financialYearId: string = ctx.financialYearId
) {
  return voucherService.create(ctx.companyId, financialYearId, 'RECEIPT', {
    voucherDate,
    partyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'NEFT',
    amount,
    referenceNumber: reference,
    narration: 'Phase 19 receipt ' + reference,
  });
}

async function createSupplierPayment(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  chequeNumber: string
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    voucherDate,
    partyId: ctx.supplier1PartyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'CHEQUE',
    amount,
    chequeNumber,
    chequeDate: voucherDate,
    narration: 'Phase 19 supplier payment ' + chequeNumber,
  });
}

async function createLedgerPayment(
  ctx: SuiteContext,
  amount: string,
  voucherDate: string,
  ledgerId: string,
  reference: string
) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    voucherDate,
    counterpartyLedgerId: ledgerId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'NEFT',
    amount,
    referenceNumber: reference,
    narration: 'Phase 19 ledger payment ' + reference,
  });
}

async function main() {
  let journalLineCountBefore = 0;
  let voucherCountBefore = 0;
  let ledgerCountBefore = 0;
  let partyCountBefore = 0;

  try {
    await cleanupTestData();
    const ctx = await buildContext();

    // Real posted documents for the active financial year.
    await createReceipt(ctx, '30000.00', '2026-05-10', 'P19-UTR-30000', ctx.customer1PartyId);
    await createReceipt(ctx, '15000.00', '2026-05-11', 'P19-UTR-15000', ctx.customer2PartyId);
    const chequePayment = await createSupplierPayment(ctx, '6000.00', '2026-05-10', 'CHQ-1901');
    await createLedgerPayment(ctx, '4000.00', '2026-06-15', ctx.expenseLedgerId, 'P19-UTR-4000');
    // After the report To date: must never reach the May-June report.
    await createReceipt(ctx, '12000.00', '2026-07-15', 'P19-UTR-12000', ctx.customer1PartyId);
    // Previous financial year: already represented by the stored opening balance.
    // The voucher service only posts into the active year, so the prior year is
    // activated for the posting and closed again immediately afterwards.
    await prisma.financialYear.update({
      where: { id: ctx.priorFinancialYearId },
      data: { isActive: true },
    });
    await createReceipt(
      ctx,
      '5000.00',
      '2026-03-20',
      'P19-PRIOR-5000',
      ctx.customer1PartyId,
      ctx.priorFinancialYearId
    );
    await prisma.financialYear.update({
      where: { id: ctx.priorFinancialYearId },
      data: { isActive: false },
    });

    // Ineligible documents: cancelled, superseded revision and a reversal line.
    const cancelled = await createReceipt(
      ctx,
      '99000.00',
      '2026-05-12',
      'P19-UTR-CANCELLED',
      ctx.customer1PartyId
    );
    await voucherService.cancel(
      ctx.companyId,
      ctx.financialYearId,
      'RECEIPT',
      cancelled.id,
      'Phase 19 cancelled fixture'
    );

    const superseded = await createReceipt(
      ctx,
      '5000.00',
      '2026-06-20',
      'P19-UTR-SUPERSEDED',
      ctx.customer1PartyId
    );
    await prisma.bankVoucher.update({ where: { id: superseded.id }, data: { revision: 2 } });

    await prisma.journalLine.create({
      data: {
        companyId: ctx.companyId,
        financialYearId: ctx.financialYearId,
        voucherId: chequePayment.id,
        ledgerAccountId: ctx.customer1LedgerId,
        revision: 1,
        lineNumber: 99,
        debitAmount: new Prisma.Decimal(777),
        creditAmount: new Prisma.Decimal(0),
        isReversal: true,
        postingDate: new Date('2026-05-10T00:00:00.000Z'),
        narration: 'Phase 19 reversal fixture',
      },
    });

    journalLineCountBefore = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
    voucherCountBefore = await prisma.bankVoucher.count({ where: { companyId: ctx.companyId } });
    ledgerCountBefore = await prisma.ledgerAccount.count({ where: { companyId: ctx.companyId } });
    partyCountBefore = await prisma.party.count({ where: { companyId: ctx.companyId } });

    section('A. Options: report entries, account types, parties, groups and schedules');
    const options = await accountWiseBalanceService.getOptions(ctx.companyId, ctx.financialYearId);
    assert(
      options.reportTypes.length === 2,
      'exactly two report entries are offered (received ' + options.reportTypes.length + ')'
    );
    assert(
      options.reportTypes[0].value === 'ACCOUNT_WISE_BALANCE' &&
        options.reportTypes[0].enabled === true &&
        options.reportTypes[0].label === '1. Account Wise Balance',
      'the first report entry is the enabled Account Wise Balance'
    );
    assert(
      options.reportTypes[1].value === 'ACCOUNT_MONTH_WISE_BALANCE' &&
        options.reportTypes[1].enabled === true &&
        (options.reportTypes[1].note ?? '').includes('Opening balance'),
      'Account + Month Wise Balance is enabled by Phase 2'
    );
    assert(
      options.accountTypes.map((entry) => entry.value).join(',') ===
        'DEBTORS,CREDITORS,CAPITAL,DEPOSITORS,ALL',
      'the five account types are offered in the specified order'
    );
    const depositors = options.accountTypes.find((entry) => entry.value === 'DEPOSITORS');
    assert(
      depositors !== undefined && depositors.supported === false && (depositors.note ?? '').length > 0,
      'Depositors is visibly unsupported with a documented reason'
    );
    assert(
      options.accountTypes
        .filter((entry) => entry.value !== 'DEPOSITORS')
        .every((entry) => entry.supported === true),
      'the four remaining account types are selectable'
    );
    assert(options.defaultAccountType === 'CREDITORS', 'Creditors is the default account type');
    assert(
      options.balanceColumns.map((entry) => entry.value).join(',') === 'BOTH,CREDIT,DEBIT',
      'Balance Columns offers Both, Credit Balance and Debit Balance in order'
    );
    assert(
      options.scheduleModes.map((entry) => entry.value).join(',') === 'ALL,SELECT',
      'Schedule offers All and Select'
    );
    assert(
      options.defaultFromDate === FY_START && options.defaultToDate === FY_END,
      'From/To default to the active financial year start and end'
    );
    assert(
      options.financialYearName === '2026 - 2027' &&
        options.financialYearStart === FY_START &&
        options.financialYearEnd === FY_END,
      'the options payload carries the real financial year'
    );

    const partyIds = options.parties.map((party) => party.id);
    assert(
      partyIds.length === 5 &&
        partyIds.includes(ctx.customer1PartyId) &&
        partyIds.includes(ctx.supplier1PartyId),
      'exactly the five active parties with ledgers are offered (received ' + partyIds.length + ')'
    );
    assert(
      !partyIds.includes(ctx.inactivePartyId),
      'an inactive party is excluded from the Party popup'
    );
    assert(
      !partyIds.includes(ctx.otherPartyId),
      'another company party is never offered'
    );
    const customer1Option = options.parties.find((party) => party.id === ctx.customer1PartyId);
    assert(
      customer1Option?.partyName === 'Patel Yarn Traders' &&
        customer1Option?.partyCode === 'P19CUST1' &&
        customer1Option?.partyGroupName === 'Retail Customers',
      'a party option carries the stored name, code and party group'
    );
    assert(
      customer1Option?.accountGroups.join(',') === 'SUNDRY_DEBTORS',
      'a party option reports the real ledger group of its account'
    );

    assert(
      options.partyGroups.length === 2 &&
        options.partyGroups.every((group) => group.isActive),
      'only active party groups are offered (received ' + options.partyGroups.length + ')'
    );
    assert(
      options.partyGroups.some((group) => group.id === ctx.retailGroupId) &&
        options.partyGroups.some((group) => group.id === ctx.wholesaleGroupId),
      'the real stored party groups are listed'
    );
    assert(
      !options.partyGroups.some((group) => group.id === ctx.dormantGroupId),
      'an inactive party group is excluded'
    );

    const scheduleMap = new Map(options.schedules.map((schedule) => [schedule.id, schedule]));
    assert(
      options.schedules.length === 7,
      'schedules are exactly the groups present on active ledgers (received ' +
        options.schedules.length +
        ')'
    );
    assert(
      scheduleMap.get('BANK')?.accountCount === 1 &&
        scheduleMap.get('SUNDRY_DEBTORS')?.accountCount === 3 &&
        scheduleMap.get('SUNDRY_CREDITORS')?.accountCount === 2,
      'schedule counts come from the active ledger accounts'
    );
    assert(
      scheduleMap.get('SUNDRY_DEBTORS')?.label === 'Sundry Debtors',
      'a schedule is labelled from the real enum value'
    );
    assert(
      scheduleMap.get('SUNDRY_DEBTORS')?.accountTypes.includes('DEBTORS') === true &&
        scheduleMap.get('BANK')?.accountTypes.join(',') === 'ALL',
      'each schedule knows which account types can select it'
    );
    assert(
      !scheduleMap.has('LIABILITIES'),
      'a group with no active account is never offered as a schedule'
    );
    assert(
      options.limitations.depositors.length > 0 &&
        options.limitations.scheduleSource.includes('LedgerAccountGroup'),
      'the options payload documents the Depositors and schedule-source limitations'
    );

    section('B. Default Creditors report');
    const creditors = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      creditors.rows.length === 2 && creditors.totals.accountCount === 2,
      'the default Creditors report returns the two creditor ledgers'
    );
    assert(
      creditors.rows.map((row) => row.accountCode).join(',') === '2102,2101',
      'creditor rows are ordered by account name'
    );
    const surat = creditors.rows.find((row) => row.ledgerAccountId === ctx.supplier1LedgerId);
    assert(
      surat !== undefined &&
        surat.partyName === 'Surat Textile Suppliers' &&
        surat.accountGroup === 'SUNDRY_CREDITORS' &&
        surat.accountType === 'LIABILITY',
      'a creditor row carries the real party, ledger group and ledger type'
    );
    assert(
      surat?.openingBalance === '20000.00' &&
        surat?.openingNature === 'Cr' &&
        surat?.openingSignedAmount === '-20000.00',
      'the creditor opening is the stored 20,000.00 Credit'
    );
    assert(
      surat?.periodDebit === '6000.00' && surat?.periodCredit === '0.00',
      'the May cheque payment is the only period movement'
    );
    assert(
      surat?.closingBalance === '14000.00' &&
        surat?.closingNature === 'Cr' &&
        surat?.creditBalance === '14000.00' &&
        surat?.debitBalance === '0.00',
      'closing = opening + period debit - period credit = 14,000.00 Cr'
    );
    assert(
      creditors.totals.totalDebit === '6000.00' &&
        creditors.totals.totalCredit === '0.00' &&
        creditors.totals.totalOpeningCredit === '20000.00' &&
        creditors.totals.totalClosingCredit === '14000.00',
      'the totals are the sums of the returned creditor rows'
    );
    assert(
      creditors.appliedFilters.accountTypeLabel === '2. Creditors' &&
        creditors.appliedFilters.balanceColumns === 'BOTH' &&
        creditors.appliedFilters.scheduleMode === 'ALL',
      'the applied filters echo the real defaults'
    );
    assert(
      creditors.meta.companyName === COMPANY_NAME &&
        creditors.meta.financialYearName === '2026 - 2027' &&
        creditors.meta.financialYearStart === FY_START,
      'the report meta names the real company and financial year'
    );
    assert(
      typeof creditors.meta.generatedAt === 'string' &&
        !Number.isNaN(Date.parse(creditors.meta.generatedAt)),
      'the report carries a real generation timestamp'
    );

    section('C. Debtors and opening-balance derivation');
    const debtors = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      debtors.rows.length === 3 && debtors.rows.every((row) => row.accountGroup === 'SUNDRY_DEBTORS'),
      'all three active debtor ledgers are returned and no other group leaks in'
    );
    assert(
      debtors.rows.map((row) => row.accountCode).join(',') === '1202,1201,1203',
      'debtor rows are ordered by account name'
    );
    const patel = debtors.rows.find((row) => row.ledgerAccountId === ctx.customer1LedgerId);
    assert(
      patel?.openingBalance === '10000.00' &&
        patel?.openingNature === 'Dr' &&
        patel?.openingSignedAmount === '10000.00',
      'the debtor opening is the stored 10,000.00 Debit'
    );
    assert(
      patel?.periodCredit === '30000.00' &&
        patel?.periodDebit === '0.00' &&
        patel?.closingBalance === '20000.00' &&
        patel?.closingNature === 'Cr',
      'the receipt turns the debtor into a 20,000.00 Credit closing'
    );
    const mehta = debtors.rows.find((row) => row.ledgerAccountId === ctx.customer2LedgerId);
    assert(
      mehta?.openingBalance === '0.00' &&
        mehta?.periodCredit === '15000.00' &&
        mehta?.closingBalance === '15000.00' &&
        mehta?.closingNature === 'Cr',
      'the second debtor closes at 15,000.00 Cr'
    );
    const zeroCustomer = debtors.rows.find((row) => row.ledgerAccountId === ctx.customer3LedgerId);
    assert(
      zeroCustomer?.closingBalance === '0.00' &&
        zeroCustomer?.closingNature === 'Dr' &&
        zeroCustomer?.sign === 'Dr',
      'a ledger with no movement keeps its real zero closing'
    );
    assert(
      debtors.totals.totalCredit === '45000.00' &&
        debtors.totals.totalDebit === '0.00' &&
        debtors.totals.totalOpeningDebit === '10000.00' &&
        debtors.totals.totalClosingCredit === '35000.00',
      'debtor totals add up to 45,000.00 credit movement and 35,000.00 credit closing'
    );

    const juneDebtors = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      fromDate: '2026-06-01',
      toDate: TO,
    });
    const junePatel = juneDebtors.rows.find((row) => row.ledgerAccountId === ctx.customer1LedgerId);
    assert(
      junePatel?.openingBalance === '20000.00' &&
        junePatel?.openingNature === 'Cr' &&
        junePatel?.openingSignedAmount === '-20000.00',
      'the opening of a later period includes every eligible posting before the From date'
    );
    assert(
      junePatel?.periodDebit === '0.00' &&
        junePatel?.periodCredit === '0.00' &&
        junePatel?.closingBalance === '20000.00',
      'the June period has no movement and keeps the 20,000.00 Credit closing'
    );

    const julyDebtors = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      fromDate: FROM,
      toDate: '2026-07-31',
    });
    const julyPatel = julyDebtors.rows.find((row) => row.ledgerAccountId === ctx.customer1LedgerId);
    assert(
      julyPatel?.periodCredit === '42000.00' &&
        julyPatel?.closingBalance === '32000.00' &&
        julyPatel?.closingNature === 'Cr',
      'the 15 July receipt only appears when the To date includes it (42,000.00 credit, 32,000.00 Cr)'
    );

    const priorYear = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.priorFinancialYearId,
      {
        accountType: 'DEBTORS',
        fromDate: '2025-04-01',
        toDate: '2026-03-31',
      }
    );
    const priorPatel = priorYear.rows.find((row) => row.ledgerAccountId === ctx.customer1LedgerId);
    assert(
      priorPatel?.openingBalance === '10000.00' &&
        priorPatel?.periodCredit === '5000.00' &&
        priorPatel?.closingBalance === '5000.00' &&
        priorPatel?.closingNature === 'Dr',
      'the previous financial year reports its own 5,000.00 receipt exactly once'
    );
    assert(
      patel?.openingBalance === '10000.00',
      'a posting stored in the prior financial year is never added to this year opening again'
    );
    section('D. All Accounts totals and per-ledger balances');
    const all = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      all.rows.length === 10 && all.totals.accountCount === 10,
      'All Accounts returns every active ledger of the company (received ' + all.rows.length + ')'
    );
    assert(
      all.rows[0].accountGroup === 'BANK' &&
        all.rows[all.rows.length - 1].accountGroup === 'CAPITAL',
      'rows follow the real ledger group order'
    );
    const bank = all.rows.find((row) => row.ledgerAccountId === ctx.bankLedgerId);
    assert(
      bank?.openingBalance === '50000.00' &&
        bank?.openingNature === 'Dr' &&
        bank?.periodDebit === '45000.00' &&
        bank?.periodCredit === '10000.00' &&
        bank?.closingBalance === '85000.00' &&
        bank?.closingNature === 'Dr',
      'the bank ledger closes at 85,000.00 Dr from 45,000.00 debit and 10,000.00 credit'
    );
    assert(
      bank?.debitBalance === '85000.00' && bank?.creditBalance === '0.00',
      'the bank row fills only the Debit Balance column'
    );
    const capital = all.rows.find((row) => row.ledgerAccountId === ctx.capitalLedgerId);
    assert(
      capital?.openingBalance === '100000.00' &&
        capital?.openingNature === 'Cr' &&
        capital?.periodDebit === '0.00' &&
        capital?.periodCredit === '0.00' &&
        capital?.closingBalance === '100000.00' &&
        capital?.closingNature === 'Cr',
      'a capital ledger with no postings keeps its real 1,00,000.00 Credit'
    );
    const rent = all.rows.find((row) => row.ledgerAccountId === ctx.expenseLedgerId);
    assert(
      rent?.openingBalance === '0.00' &&
        rent?.periodDebit === '4000.00' &&
        rent?.closingBalance === '4000.00' &&
        rent?.closingNature === 'Dr',
      'a ledger-only payment posts to the expense ledger'
    );
    assert(
      all.totals.totalDebit === '55000.00' && all.totals.totalCredit === '55000.00',
      'the period debit and credit totals balance at 55,000.00'
    );
    assert(
      all.totals.totalOpeningDebit === '60000.00' &&
        all.totals.totalOpeningCredit === '120000.00',
      'opening totals split into 60,000.00 Dr and 1,20,000.00 Cr'
    );
    assert(
      all.totals.totalClosingDebit === '89000.00' &&
        all.totals.totalClosingCredit === '149000.00',
      'closing totals split into 89,000.00 Dr and 1,49,000.00 Cr'
    );
    const rowDebitTotal = all.rows.reduce((sum, row) => sum + Number(row.debitBalance), 0);
    const rowCreditTotal = all.rows.reduce((sum, row) => sum + Number(row.creditBalance), 0);
    assert(
      rowDebitTotal === 89000 && rowCreditTotal === 149000,
      'the row Debit/Credit balance columns add up to the closing totals'
    );
    assert(
      all.rows.every((row) => Number(row.periodDebit) >= 0 && Number(row.periodCredit) >= 0),
      'period movement columns are always positive amounts'
    );
    assert(
      all.rows.every(
        (row) => row.sign === row.closingNature && row.closingSignedAmount.startsWith('-') === (row.closingNature === 'Cr')
      ),
      'the sign column always agrees with the closing nature'
    );

    section('E. Balance Columns and Skip 0 (Zero) Transaction');
    const creditOnly = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      balanceColumns: 'CREDIT',
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      creditOnly.rows.length === 4 && creditOnly.rows.every((row) => row.closingNature === 'Cr'),
      'Credit Balance returns only the four credit closings (received ' + creditOnly.rows.length + ')'
    );
    assert(
      creditOnly.rows
        .map((row) => row.ledgerAccountId)
        .sort()
        .join(',') ===
        [ctx.customer1LedgerId, ctx.customer2LedgerId, ctx.supplier1LedgerId, ctx.capitalLedgerId]
          .sort()
          .join(','),
      'the credit rows are exactly the ledgers with a credit closing'
    );
    const debitOnly = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      balanceColumns: 'DEBIT',
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      debitOnly.rows.length === 2 &&
        debitOnly.rows.every((row) => row.closingNature === 'Dr') &&
        debitOnly.rows.some((row) => row.ledgerAccountId === ctx.bankLedgerId) &&
        debitOnly.rows.some((row) => row.ledgerAccountId === ctx.expenseLedgerId),
      'Debit Balance returns only the bank and expense ledgers'
    );
    const skipZero = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      skipZeroBalances: true,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      skipZero.rows.length === 6 && skipZero.totals.accountCount === 6,
      'Skip 0 (Zero) Transaction removes the four zero closings (received ' + skipZero.rows.length + ')'
    );
    assert(
      !skipZero.rows.some((row) =>
        [
          ctx.customer3LedgerId,
          ctx.supplier2LedgerId,
          ctx.incomeLedgerId,
          ctx.assetLedgerId,
        ].includes(row.ledgerAccountId)
      ),
      'the zero ledgers are exactly the removed rows'
    );
    const keepZero = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      skipZeroBalances: false,
      fromDate: FROM,
      toDate: TO,
    });
    assert(keepZero.rows.length === 10, 'with Skip Zero off every active ledger is kept');
    const creditSkipZero = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      {
        accountType: 'ALL',
        balanceColumns: 'CREDIT',
        skipZeroBalances: true,
        fromDate: FROM,
        toDate: TO,
      }
    );
    assert(
      creditSkipZero.rows.length === 4,
      'Skip Zero composes with the Credit Balance column filter'
    );

    section('F. Party, Party Group and Schedule filters');
    const byParty = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      partyId: ctx.customer1PartyId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      byParty.rows.length === 1 && byParty.rows[0].ledgerAccountId === ctx.customer1LedgerId,
      'the Party filter narrows the report to the party ledger'
    );
    assert(
      byParty.appliedFilters.partyId === ctx.customer1PartyId &&
        byParty.appliedFilters.partyName === 'Patel Yarn Traders',
      'the applied filters name the selected party'
    );

    const byGroup = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      partyGroupId: ctx.retailGroupId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      byGroup.rows.length === 2 &&
        byGroup.rows.every((row) => row.partyGroupId === ctx.retailGroupId),
      'the Party Group filter returns only its members'
    );
    assert(
      byGroup.appliedFilters.partyGroupName === 'Retail Customers',
      'the applied filters name the selected party group'
    );
    const crossGroup = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'CREDITORS',
      partyGroupId: ctx.retailGroupId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      crossGroup.rows.length === 0,
      'a party group with no creditor ledger yields no rows'
    );

    const capitalSchedule = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      {
        accountType: 'ALL',
        scheduleMode: 'SELECT',
        scheduleIds: ['CAPITAL'],
        fromDate: FROM,
        toDate: TO,
      }
    );
    assert(
      capitalSchedule.rows.length === 1 &&
        capitalSchedule.rows[0].accountGroup === 'CAPITAL',
      'a single schedule selection returns only that group'
    );
    assert(
      capitalSchedule.appliedFilters.scheduleIds.join(',') === 'CAPITAL' &&
        capitalSchedule.appliedFilters.scheduleLabels.join(',') === 'Capital',
      'the applied filters carry the selected schedule id and label'
    );
    const twoSchedules = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      {
        accountType: 'ALL',
        scheduleMode: 'SELECT',
        scheduleIds: ['SUNDRY_DEBTORS', 'CAPITAL'],
        fromDate: FROM,
        toDate: TO,
      }
    );
    assert(
      twoSchedules.rows.length === 4 &&
        twoSchedules.rows.filter((row) => row.accountGroup === 'SUNDRY_DEBTORS').length === 3,
      'two selected schedules return their combined ledgers'
    );
    const creditorSchedule = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      {
        accountType: 'CREDITORS',
        scheduleMode: 'SELECT',
        scheduleIds: ['SUNDRY_CREDITORS'],
        fromDate: FROM,
        toDate: TO,
      }
    );
    assert(
      creditorSchedule.rows.length === 2,
      'a schedule inside the Creditors classification is accepted'
    );
    const allIgnoresIds = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      {
        accountType: 'CREDITORS',
        scheduleMode: 'ALL',
        scheduleIds: ['CAPITAL'],
        fromDate: FROM,
        toDate: TO,
      }
    );
    assert(
      allIgnoresIds.rows.length === 2 && allIgnoresIds.appliedFilters.scheduleIds.length === 0,
      'Schedule All ignores any leftover selection instead of narrowing the report'
    );
    const deduped = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'ALL',
      scheduleMode: 'SELECT',
      scheduleIds: ['CAPITAL', 'capital'],
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      deduped.rows.length === 1 && deduped.appliedFilters.scheduleIds.length === 1,
      'a repeated schedule id is stored and applied once'
    );
    assert(
      all.rows.every(
        (row) =>
          row.ledgerAccountId !== ctx.inactiveLedgerId &&
          row.ledgerAccountId !== ctx.otherLedgerId
      ),
      'inactive ledgers and other-company ledgers never appear'
    );
    section('G. Checkbox flags are real query inputs');
    const flagsOff = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      partyId: ctx.customer1PartyId,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      flagsOff.rows[0].partyAddress === null &&
        flagsOff.rows[0].mobile === null &&
        flagsOff.rows[0].panNumber === null,
      'address, mobile and PAN stay empty unless they are requested'
    );
    assert(
      flagsOff.appliedFilters.includePartyAddress === false &&
        flagsOff.appliedFilters.includePartyMobile === false &&
        flagsOff.appliedFilters.includePan === false &&
        flagsOff.appliedFilters.pageBreakEveryParty === false &&
        flagsOff.appliedFilters.doNotPrintDescription === false,
      'every unchecked flag is reported as false'
    );
    const flagsOn = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      accountType: 'DEBTORS',
      partyId: ctx.customer1PartyId,
      includePartyAddress: true,
      includePartyMobile: true,
      includePan: true,
      pageBreakEveryParty: true,
      doNotPrintDescription: true,
      fromDate: FROM,
      toDate: TO,
    });
    assert(
      flagsOn.rows[0].partyAddress === '12 Ring Road, Surat, Gujarat, 395002',
      'Party Address Required prints the stored address parts in order'
    );
    assert(
      flagsOn.rows[0].mobile === '9825011111' && flagsOn.rows[0].panNumber === 'AAACP1111F',
      'Party Mobile and PAN print the stored values'
    );
    assert(
      flagsOn.appliedFilters.includePartyAddress === true &&
        flagsOn.appliedFilters.includePartyMobile === true &&
        flagsOn.appliedFilters.includePan === true,
      'the three detail flags are echoed in the applied filters'
    );
    assert(
      flagsOn.appliedFilters.pageBreakEveryParty === true &&
        flagsOn.appliedFilters.doNotPrintDescription === true,
      'Page Break on Every Party and Do not Print Description are carried into the print contract'
    );
    assert(
      flagsOn.rows[0].closingBalance === flagsOff.rows[0].closingBalance &&
        flagsOn.rows[0].periodCredit === flagsOff.rows[0].periodCredit,
      'print-layout flags never change a single balance figure'
    );

    section('H. Validation and rejections');
    const depositorsError = await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'DEPOSITORS',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'the unsupported Depositors account type is rejected'
    );
    assert(
      depositorsError.message.includes('Depositors'),
      'the Depositors rejection explains the missing classification'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'NOT_A_TYPE',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'an unknown account type is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          reportType: 'ACCOUNT_MONTH_WISE_BALANCE',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'the Phase 2 report type cannot be queried'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          reportType: 'SOMETHING_ELSE',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'an unknown report type is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'CREDITORS',
          scheduleMode: 'SELECT',
          scheduleIds: [],
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'Schedule Select with no selection is rejected instead of silently meaning All'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'CREDITORS',
          scheduleMode: 'SELECT',
          scheduleIds: ['BANK'],
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'a schedule outside the account type classification is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'ALL',
          scheduleMode: 'SELECT',
          scheduleIds: ['NOT_A_GROUP'],
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'an unknown schedule id is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'ALL',
          scheduleMode: 'SELECT',
          scheduleIds: 'CAPITAL',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'a non-list schedule selection is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          fromDate: '2026-06-30',
          toDate: '2026-05-01',
        }),
      400,
      'a From date after the To date is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          fromDate: '2025-12-01',
          toDate: TO,
        }),
      400,
      'a period outside the financial year is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          fromDate: '2026-13-01',
          toDate: TO,
        }),
      400,
      'an impossible calendar date is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          partyId: ctx.otherPartyId,
          fromDate: FROM,
          toDate: TO,
        }),
      404,
      'another company party is never reachable'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          partyGroupId: ctx.otherPartyGroupId,
          fromDate: FROM,
          toDate: TO,
        }),
      404,
      'another company party group is never reachable'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          accountType: 'DEBTORS',
          partyId: ctx.inactivePartyId,
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'an inactive party is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.otherFinancialYearId, {
          fromDate: FROM,
          toDate: TO,
        }),
      404,
      'another company financial year is never reachable'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(
          '00000000-0000-0000-0000-000000000000',
          ctx.financialYearId,
          { fromDate: FROM, toDate: TO }
        ),
      404,
      'an unknown company is rejected before any query runs'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          includePan: 'yes',
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'a non-boolean checkbox value is rejected'
    );
    await expectError(
      () =>
        accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
          partyId: 12345,
          fromDate: FROM,
          toDate: TO,
        }),
      400,
      'a non-text party id is rejected'
    );

    section('I. Company isolation and read-only guarantees');
    const otherReport = await accountWiseBalanceService.run(
      ctx.otherCompanyId,
      ctx.otherFinancialYearId,
      { accountType: 'ALL', fromDate: FROM, toDate: TO }
    );
    assert(
      otherReport.rows.length === 1 && otherReport.rows[0].ledgerAccountId === ctx.otherLedgerId,
      'the other company sees only its own ledger'
    );
    assert(
      otherReport.rows[0].openingBalance === '4000.00' &&
        otherReport.rows[0].openingNature === 'Dr',
      'the other company opening is its own stored balance'
    );
    assert(
      otherReport.rows.every((row) => row.ledgerAccountId !== ctx.bankLedgerId) &&
        otherReport.rows.every((row) => row.ledgerAccountId !== ctx.customer1LedgerId),
      'company isolation holds across every row of the report'
    );

    const journalLineCountAfter = await prisma.journalLine.count({
      where: { companyId: ctx.companyId },
    });
    const voucherCountAfter = await prisma.bankVoucher.count({ where: { companyId: ctx.companyId } });
    const ledgerCountAfter = await prisma.ledgerAccount.count({
      where: { companyId: ctx.companyId },
    });
    const partyCountAfter = await prisma.party.count({ where: { companyId: ctx.companyId } });
    assert(
      journalLineCountAfter === journalLineCountBefore,
      'running every report never writes or deletes a journal line (' +
        journalLineCountBefore +
        ' lines)'
    );
    assert(
      voucherCountAfter === voucherCountBefore,
      'running every report never writes or deletes a voucher'
    );
    assert(
      ledgerCountAfter === ledgerCountBefore && partyCountAfter === partyCountBefore,
      'no ledger account or party master record is created by a report run'
    );

    const bankAfter = await prisma.ledgerAccount.findFirst({
      where: { companyId: ctx.companyId, id: ctx.bankLedgerId },
      select: { openingBalance: true },
    });
    const patelAfter = await prisma.ledgerAccount.findFirst({
      where: { companyId: ctx.companyId, id: ctx.customer1LedgerId },
      select: { openingBalance: true },
    });
    assert(
      bankAfter?.openingBalance.toFixed(2) === '50000.00' &&
        patelAfter?.openingBalance.toFixed(2) === '10000.00',
      'the stored ledger opening balances are never modified by a report'
    );

    console.log('\n========================================');
    console.log('Phase 19 suite: ' + passed + '/' + total + ' assertions passed');
    console.log('========================================');
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\nPhase 19 suite failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});