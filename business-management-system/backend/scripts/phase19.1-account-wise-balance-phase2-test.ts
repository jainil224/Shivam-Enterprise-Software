// Phase 19.1 (Phase 2) - Account Wise Balance result data, A4 print document,
// genuine PDF and Account + Month Wise Balance test suite.
//
// Isolated fixtures only: this suite creates its own company, financial year,
// ledger accounts, parties and posted vouchers, then removes them. No report
// run writes data and no live company record is touched.

import { Prisma, PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { accountWiseBalanceService } from '../src/services/accountWiseBalanceService.js';
import { PAGE_SIZES } from '../src/utils/pdfWriter.js';

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

function near(actual: number, expected: number, tolerance = 0.05): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function rowOf<T extends { ledgerAccountId: string }>(rows: T[], id: string, label: string): T {
  const found = rows.find((entry) => entry.ledgerAccountId === id);
  assert(found !== undefined, label + ' appears in the report rows');
  return found as T;
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

const TEST_COMPANY_CODE = 'P191TEST';
const OTHER_COMPANY_CODE = 'P191OTHER';
const COMPANY_NAME = 'SIVAM PHASE 19 PRINT LTD';
const COMPANY_PAN = 'AAACS9999K';
const COMPANY_GSTIN = '24AABCS1234F1Z8';
const FY_NAME = '2026 - 2027';
const FY_START = '2026-04-01';
const FY_END = '2027-03-31';
const FROM = '2026-05-15';
const TO = '2026-07-10';

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
  otherCompanyId: string;
  otherFinancialYearId: string;
  bankLedgerId: string;
  customerLedgerId: string;
  zeroLedgerId: string;
  supplierLedgerId: string;
  customerPartyId: string;
  supplierPartyId: string;
  otherLedgerId: string;
}

async function createCompanyWithYear(code: string, name: string, pan: string | null) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: COMPANY_GSTIN,
      panNumber: pan,
      address: 'Plot 19, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '02612345678',
    },
  });
  const financialYear = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: FY_NAME,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });
  return { company, financialYear };
}
async function buildContext(): Promise<SuiteContext> {
  const primary = await createCompanyWithYear(TEST_COMPANY_CODE, COMPANY_NAME, COMPANY_PAN);
  const other = await createCompanyWithYear(OTHER_COMPANY_CODE, 'OTHER PHASE 19 PRINT LTD', null);

  const customerParty = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P191CUST',
      partyName: 'Alpha Traders',
      partyType: 'CUSTOMER',
      phone: '9825011111',
      panNumber: 'AAACP1111F',
      address: '12 Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const zeroParty = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P191ZERO',
      partyName: 'Zero Traders',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplierParty = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P191SUPP',
      partyName: 'Beta Suppliers',
      partyType: 'SUPPLIER',
      phone: '9825022222',
      panNumber: 'AAACS2222G',
      address: '8 Udhna Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '394210',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const otherParty = await prisma.party.create({
    data: {
      companyId: other.company.id,
      partyCode: 'P191OTH1',
      partyName: 'Other Buyer',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
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

  const customerLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1201',
    accountName: 'Alpha Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    balanceType: 'DEBIT',
    partyId: customerParty.id,
    description: 'Key retail buyer',
  });

  const zeroLedger = await ledgerService.create(primary.company.id, {
    accountCode: '1202',
    accountName: 'Zero Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '0.00',
    balanceType: 'DEBIT',
    partyId: zeroParty.id,
  });

  const supplierLedger = await ledgerService.create(primary.company.id, {
    accountCode: '2101',
    accountName: 'Beta Suppliers',
    accountGroup: 'SUNDRY_CREDITORS',
    openingBalance: '10000.00',
    balanceType: 'CREDIT',
    partyId: supplierParty.id,
  });

  const otherLedger = await ledgerService.create(other.company.id, {
    accountCode: '1201',
    accountName: 'Other Buyer',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '4000.00',
    balanceType: 'DEBIT',
    partyId: otherParty.id,
  });

  return {
    companyId: primary.company.id,
    financialYearId: primary.financialYear.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.financialYear.id,
    bankLedgerId: bank.id,
    customerLedgerId: customerLedger.id,
    zeroLedgerId: zeroLedger.id,
    supplierLedgerId: supplierLedger.id,
    customerPartyId: customerParty.id,
    supplierPartyId: supplierParty.id,
    otherLedgerId: otherLedger.id,
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
    narration: 'Phase 19.1 receipt ' + reference,
  });
}

async function createSupplierPayment(ctx: SuiteContext, amount: string, voucherDate: string) {
  return voucherService.create(ctx.companyId, ctx.financialYearId, 'PAYMENT', {
    voucherDate,
    partyId: ctx.supplierPartyId,
    bankAccountLedgerId: ctx.bankLedgerId,
    paymentMode: 'CHEQUE',
    amount,
    chequeNumber: 'CHQ-1911',
    chequeDate: voucherDate,
    narration: 'Phase 19.1 supplier payment',
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

    await createReceipt(ctx, '4000.00', '2026-04-10', 'P191-UTR-4000');
    await createReceipt(ctx, '3000.00', '2026-05-20', 'P191-UTR-3000');
    await createReceipt(ctx, '1000.00', '2026-07-05', 'P191-UTR-1000');
    // After the report To date: must never reach the May-July report.
    await createReceipt(ctx, '9000.00', '2026-08-01', 'P191-UTR-9000');
    await createSupplierPayment(ctx, '6000.00', '2026-06-10');

    journalLineCountBefore = await prisma.journalLine.count({ where: { companyId: ctx.companyId } });
    voucherCountBefore = await prisma.bankVoucher.count({ where: { companyId: ctx.companyId } });
    ledgerCountBefore = await prisma.ledgerAccount.count({ where: { companyId: ctx.companyId } });
    partyCountBefore = await prisma.party.count({ where: { companyId: ctx.companyId } });

    const baseRequest: Record<string, unknown> = {
      reportType: 'ACCOUNT_WISE_BALANCE',
      accountType: 'ALL',
      fromDate: FROM,
      toDate: TO,
    };
    const monthRequest: Record<string, unknown> = {
      reportType: 'ACCOUNT_MONTH_WISE_BALANCE',
      accountType: 'ALL',
      fromDate: FROM,
      toDate: TO,
    };

    section('A. Report entries: both reports enabled in Phase 2');
    const options = await accountWiseBalanceService.getOptions(ctx.companyId, ctx.financialYearId);
    assert(options.reportTypes.length === 2, 'exactly two report entries are offered');
    assert(
      options.reportTypes[0].value === 'ACCOUNT_WISE_BALANCE' && options.reportTypes[0].enabled,
      'the first entry is the enabled Account Wise Balance'
    );
    const monthEntry = options.reportTypes[1];
    assert(
      monthEntry.value === 'ACCOUNT_MONTH_WISE_BALANCE' && monthEntry.enabled === true,
      'Account + Month Wise Balance is enabled in Phase 2'
    );
    assert(
      monthEntry.label === '2. Account + Month Wise Balance',
      'the second entry keeps its numbered label'
    );
    assert(
      (monthEntry.note ?? '').includes('Opening balance') &&
        (monthEntry.note ?? '').includes('closing balance'),
      'the second entry documents opening, monthly movement and closing balance'
    );
    assert(
      options.reportTypes.every((entry) => entry.enabled === true),
      'both report entries are selectable'
    );

    section('B. Account Wise Balance result data (real backend rows only)');
    const accountWise = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      baseRequest
    );
    assert(
      accountWise.rows.length === 4,
      'the report returns the four active ledger accounts (received ' + accountWise.rows.length + ')'
    );
    assert(
      accountWise.appliedFilters.reportType === 'ACCOUNT_WISE_BALANCE',
      'the applied filters carry the account-wise report type'
    );

    const bankRow = rowOf(accountWise.rows, ctx.bankLedgerId, 'the bank ledger');
    assert(
      bankRow.openingBalance === '54000.00' && bankRow.openingNature === 'Dr',
      'bank opening is stored 50,000 plus the 4,000 receipt before the From date'
    );
    assert(
      bankRow.periodDebit === '4000.00' && bankRow.periodCredit === '6000.00',
      'bank period movement only counts postings inside the range'
    );
    assert(
      bankRow.closingBalance === '52000.00' && bankRow.closingNature === 'Dr',
      'bank closing is opening plus period debit minus period credit'
    );

    const customerRow = rowOf(accountWise.rows, ctx.customerLedgerId, 'the customer ledger');
    assert(
      customerRow.openingBalance === '4000.00' && customerRow.openingNature === 'Cr',
      'customer opening is the 4,000 receipt dated before the From date'
    );
    assert(
      customerRow.periodDebit === '0.00' && customerRow.periodCredit === '4000.00',
      'customer period credit is the 3,000 and 1,000 receipts inside the range'
    );
    assert(
      customerRow.closingBalance === '8000.00' && customerRow.closingNature === 'Cr',
      'customer closing is 8,000 credit'
    );
    assert(
      customerRow.debitBalance === '0.00' && customerRow.creditBalance === '8000.00',
      'a credit closing never appears in the debit column'
    );
    assert(
      customerRow.description === 'Key retail buyer',
      'the stored ledger description is present by default'
    );

    const supplierRow = rowOf(accountWise.rows, ctx.supplierLedgerId, 'the supplier ledger');
    assert(
      supplierRow.openingBalance === '10000.00' && supplierRow.openingNature === 'Cr',
      'supplier opening is the stored 10,000 credit'
    );
    assert(
      supplierRow.periodDebit === '6000.00' && supplierRow.closingBalance === '4000.00',
      'supplier closing is 10,000 credit minus the 6,000 payment'
    );

    const zeroRow = rowOf(accountWise.rows, ctx.zeroLedgerId, 'the zero-balance ledger');
    assert(
      zeroRow.closingBalance === '0.00' &&
        zeroRow.debitBalance === '0.00' &&
        zeroRow.creditBalance === '0.00',
      'a zero-balance account carries no amount in either column'
    );

    assert(
      accountWise.totals.totalDebit === '10000.00' &&
        accountWise.totals.totalCredit === '10000.00',
      'period movement totals cover every returned row'
    );
    assert(
      accountWise.totals.totalClosingDebit === '52000.00' &&
        accountWise.totals.totalClosingCredit === '12000.00',
      'closing totals are the sums of the debit and credit closing balances'
    );
    assert(
      accountWise.totals.totalClosingDebit !== accountWise.totals.totalClosingCredit,
      'debit and credit totals are never forced to agree'
    );
    assert(accountWise.totals.accountCount === 4, 'the totals report the real account count');

    section('C. A4 portrait print document geometry and content');
    const print = accountWise.print;
    assert(
      print.reportTitle === 'ACCOUNT BALANCE REPORT',
      'the document title is ACCOUNT BALANCE REPORT'
    );
    assert(print.orientation === 'portrait', 'the account-wise document is portrait');
    assert(
      near(print.layout.pageWidthPt, PAGE_SIZES.portrait.width, 0.01) &&
        near(print.layout.pageHeightPt, PAGE_SIZES.portrait.height, 0.01),
      'the page is A4 portrait 595.28 x 841.89 points'
    );
    assert(
      print.columnWidthsPt.length === 3 &&
        near(sum(print.columnWidthsPt), print.layout.contentWidthPt, 0.05),
      'the three column widths exactly fill the content width'
    );
    assert(
      print.columnWidthsPt[0] > print.columnWidthsPt[1] &&
        near(print.columnWidthsPt[1], print.columnWidthsPt[2], 0.05),
      'the account column is wider and the debit/credit columns are equal'
    );
    assert(
      print.pages.length >= 1 && print.pages[0].pageNumber === 1,
      'the document starts at page 1'
    );
    assert(
      print.pages.every((page, index) => page.pageNumber === index + 1),
      'page numbers are sequential with no gaps'
    );
    assert(
      print.pages.filter((page) => page.showTotals).length === 1 &&
        print.pages[print.pages.length - 1].showTotals === true,
      'only the final page carries the total row'
    );
    assert(
      print.pages[0].blocks.length === 4,
      'all four accounts fit on the first page of this fixture'
    );
    assert(
      print.pages[0].blocks.every((block) => block.heightPt >= 26 && block.nameLines.length > 0),
      'every block has a real height and a wrapped account name'
    );
    assert(
      print.totals.debit === '52,000.00' &&
        print.totals.credit === '12,000.00' &&
        print.totals.accountCount === 4,
      'the printed totals use Indian grouping and the full dataset'
    );
    assert(
      print.company.companyName === COMPANY_NAME &&
        print.company.panNumber === COMPANY_PAN &&
        print.company.gstin === COMPANY_GSTIN,
      'the header carries the real Company Master name, PAN and GSTIN'
    );
    assert(print.company.tanNumber === null, 'TAN is null because the schema stores no TAN value');
    assert(
      print.company.addressLines.length > 0 &&
        print.company.addressLines.join(' ').includes('Ring Road') &&
        print.company.addressLines.join(' ').includes('Surat'),
      'the header address is the real stored address, split for printing'
    );
    assert(
      print.periodFrom === '15-05-2026' && print.periodTo === '10-07-2026',
      'the period prints as DD-MM-YYYY'
    );
    assert(print.financialYear === FY_NAME, 'the header carries the real financial year');
    const bankBlock = print.pages[0].blocks.find(
      (block) => block.accountName === 'HDFC Bank Current A/c'
    );
    assert(
      bankBlock !== undefined && bankBlock.debit === '52,000.00' && bankBlock.credit === '',
      'a debit account prints only its debit balance'
    );
    const customerBlock = print.pages[0].blocks.find(
      (block) => block.accountName === 'Alpha Traders'
    );
    assert(
      customerBlock !== undefined && customerBlock.credit === '8,000.00' && customerBlock.debit === '',
      'a credit account prints only its credit balance'
    );
    assert(
      customerBlock !== undefined &&
        customerBlock.detailLines.join(' ').includes('Key retail buyer'),
      'the description prints below the account name by default'
    );
    assert(
      print.notes.length >= 2 && print.notes.join(' ').includes('never forced'),
      'the document documents that totals are never forced to agree'
    );
    section('D. The six print options change the same document');
    const detailed = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      includePartyAddress: true,
      includePartyMobile: true,
      includePan: true,
    });
    const detailedCustomer = rowOf(detailed.rows, ctx.customerLedgerId, 'the customer ledger');
    assert(
      (detailedCustomer.partyAddress ?? '').includes('12 Ring Road') &&
        (detailedCustomer.partyAddress ?? '').includes('395002'),
      'Party Address Required fills the stored address'
    );
    assert(
      detailedCustomer.mobile === '9825011111' && detailedCustomer.panNumber === 'AAACP1111F',
      'Mobile and PAN are filled only when requested'
    );
    const detailedBlock = detailed.print.pages[0].blocks.find(
      (block) => block.accountName === 'Alpha Traders'
    );
    const detailedDetailText = (detailedBlock?.detailLines ?? []).join(' ');
    assert(
      detailedDetailText.includes('Mobile No: 9825011111') &&
        detailedDetailText.includes('PAN No: AAACP1111F') &&
        detailedDetailText.includes('12 Ring Road'),
      'the print block carries the address, mobile and PAN lines'
    );
    const detailedBankBlock = detailed.print.pages[0].blocks.find(
      (block) => block.accountName === 'HDFC Bank Current A/c'
    );
    assert(
      detailedBankBlock !== undefined && detailedBankBlock.detailLines.length === 0,
      'a ledger without a party or description prints no detail line'
    );

    const noDescription = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      doNotPrintDescription: true,
    });
    const noDescriptionCustomer = rowOf(
      noDescription.rows,
      ctx.customerLedgerId,
      'the customer ledger'
    );
    assert(
      noDescriptionCustomer.description === null,
      'Do not Print Description nulls the stored description'
    );
    const noDescriptionBlock = noDescription.print.pages[0].blocks.find(
      (block) => block.accountName === 'Alpha Traders'
    );
    assert(
      noDescriptionBlock !== undefined &&
        !noDescriptionBlock.detailLines.join(' ').includes('Key retail buyer'),
      'Do not Print Description removes the description from the print block'
    );

    const pageBreak = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      pageBreakEveryParty: true,
    });
    assert(
      pageBreak.print.pages.length === pageBreak.rows.length,
      'Page Break on Every Party creates one page per account'
    );
    assert(
      pageBreak.print.pages.every((page) => page.blocks.length === 1),
      'every page of a page-break document holds exactly one account'
    );
    assert(
      pageBreak.print.pages[0].showTotals === false &&
        pageBreak.print.pages[pageBreak.print.pages.length - 1].showTotals === true,
      'the total row appears only on the last page of a page-break document'
    );

    const skipZero = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      skipZeroBalances: true,
    });
    assert(
      skipZero.rows.length === 3 &&
        skipZero.rows.every((row) => row.ledgerAccountId !== ctx.zeroLedgerId),
      'Skip 0 removes the zero-balance account from the result'
    );
    assert(
      skipZero.print.pages[0].blocks.length === 3 && skipZero.print.totals.accountCount === 3,
      'Skip 0 removes the zero-balance account from the print document'
    );

    const debitOnly = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      balanceColumns: 'DEBIT',
    });
    assert(
      debitOnly.rows.length === 1 && debitOnly.rows[0].ledgerAccountId === ctx.bankLedgerId,
      'Debit Balance keeps only the debit closing balance'
    );
    const creditOnly = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      balanceColumns: 'CREDIT',
    });
    assert(
      creditOnly.rows.length === 2 && creditOnly.rows.every((row) => row.closingNature === 'Cr'),
      'Credit Balance keeps only the credit closing balances'
    );

    const partyFiltered = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, {
      ...baseRequest,
      partyId: ctx.customerPartyId,
    });
    assert(
      partyFiltered.rows.length === 1 &&
        partyFiltered.rows[0].ledgerAccountId === ctx.customerLedgerId,
      'the Party filter narrows both the result and the print document'
    );
    assert(
      partyFiltered.print.totals.debit === '0.00' &&
        partyFiltered.print.totals.credit === '8,000.00',
      'the printed totals follow the filtered dataset'
    );

    const scheduleFiltered = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      { ...baseRequest, scheduleMode: 'SELECT', scheduleIds: ['BANK'] }
    );
    assert(
      scheduleFiltered.rows.length === 1 &&
        scheduleFiltered.rows[0].ledgerAccountId === ctx.bankLedgerId,
      'a single selected schedule limits the report to that ledger group'
    );

    section('E. Genuine A4 portrait PDF');
    const pdf = await accountWiseBalanceService.exportPdf(
      ctx.companyId,
      ctx.financialYearId,
      baseRequest
    );
    const pdfText = pdf.buffer.toString('latin1');
    assert(
      pdf.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4',
      'the export is a real PDF file'
    );
    assert(pdfText.trimEnd().endsWith('%%EOF'), 'the PDF is terminated with %%EOF');
    assert(
      pdfText.includes('/MediaBox [0 0 595.28 841.89]'),
      'every PDF page declares the A4 portrait media box'
    );
    assert(
      pdf.pageCount === print.pages.length && pdfText.includes('/Count ' + pdf.pageCount),
      'the PDF page count matches the shared print document'
    );
    assert(
      pdf.filename === 'Account_Wise_Balance_2026-2027.pdf',
      'the filename is derived from the financial year'
    );
    assert(
      pdfText.includes('ACCOUNT BALANCE REPORT'),
      'the PDF contains the report title as real text'
    );
    assert(pdfText.includes(COMPANY_NAME), 'the PDF contains the company name');
    assert(pdfText.includes('PAN NO: ' + COMPANY_PAN), 'the PDF contains the stored PAN');
    assert(pdfText.includes('GSTIN: ' + COMPANY_GSTIN), 'the PDF contains the stored GSTIN');
    assert(
      pdfText.includes('PERIOD: 15-05-2026 TO 10-07-2026'),
      'the PDF contains the DD-MM-YYYY period'
    );
    assert(pdfText.includes('PAGE 1 OF 1'), 'the PDF contains the page number of the total pages');
    assert(
      pdfText.includes('ACCOUNT NAME') && pdfText.includes('DEBIT') && pdfText.includes('CREDIT'),
      'the PDF contains the three column headers'
    );
    assert(pdfText.includes('TOTAL'), 'the PDF contains the bold total row');
    assert(
      pdfText.includes('52,000.00') && pdfText.includes('12,000.00'),
      'the PDF contains the grouped closing totals'
    );
    assert(pdfText.includes('HDFC Bank Current A/c'), 'the PDF contains the account names');
    assert(pdfText.includes('8,000.00'), 'the PDF contains the credit closing balance');
    assert(!pdfText.includes('TAN NO:'), 'the PDF omits the TAN label when no TAN is stored');

    const detailedPdf = await accountWiseBalanceService.exportPdf(
      ctx.companyId,
      ctx.financialYearId,
      { ...baseRequest, includePartyAddress: true, includePartyMobile: true, includePan: true }
    );
    const detailedPdfText = detailedPdf.buffer.toString('latin1');
    assert(
      detailedPdfText.includes('Mobile No: 9825011111') &&
        detailedPdfText.includes('PAN No: AAACP1111F'),
      'the PDF prints the requested mobile and PAN detail lines'
    );
    assert(detailedPdfText.includes('12 Ring Road'), 'the PDF prints the requested party address');

    const noDescriptionPdf = await accountWiseBalanceService.exportPdf(
      ctx.companyId,
      ctx.financialYearId,
      { ...baseRequest, doNotPrintDescription: true }
    );
    assert(
      !noDescriptionPdf.buffer.toString('latin1').includes('Key retail buyer'),
      'Do not Print Description also removes the description from the PDF'
    );

    const pageBreakPdf = await accountWiseBalanceService.exportPdf(
      ctx.companyId,
      ctx.financialYearId,
      { ...baseRequest, pageBreakEveryParty: true }
    );
    const pageBreakPdfText = pageBreakPdf.buffer.toString('latin1');
    assert(
      pageBreakPdf.pageCount === 4 && pageBreakPdfText.includes('PAGE 4 OF 4'),
      'Page Break on Every Party produces four PDF pages with correct numbering'
    );
    assert(
      (pageBreakPdfText.match(/PAGE \d+ OF 4/g) ?? []).length === 4,
      'every page of the page-break PDF carries its own page number'
    );
    section('F. Account + Month Wise Balance data');
    const monthWise = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      monthRequest
    );
    assert(
      monthWise.appliedFilters.reportType === 'ACCOUNT_MONTH_WISE_BALANCE',
      'the applied filters carry the month-wise report type'
    );
    assert(
      monthWise.months.map((month) => month.key).join(',') === '2026-05,2026-06,2026-07',
      'the month buckets follow the selected From and To dates'
    );
    assert(
      monthWise.months[0].startDate === FROM && monthWise.months[0].endDate === '2026-05-31',
      'the first month is clipped to the From date'
    );
    assert(
      monthWise.months[1].startDate === '2026-06-01' &&
        monthWise.months[1].endDate === '2026-06-30',
      'a full month keeps its whole date range'
    );
    assert(
      monthWise.months[2].startDate === '2026-07-01' && monthWise.months[2].endDate === TO,
      'the last month is clipped to the To date'
    );
    assert(
      monthWise.months[0].label === 'MAY 2026' && monthWise.months[0].shortLabel === 'MAY 2026',
      'month labels are the documented uppercase names'
    );

    const monthBank = rowOf(monthWise.rows, ctx.bankLedgerId, 'the bank ledger');
    assert(
      monthBank.months.length === 3 &&
        monthBank.months[0].debit === '3000.00' &&
        monthBank.months[1].credit === '6000.00' &&
        monthBank.months[2].debit === '1000.00',
      'bank monthly movement lands in the correct month buckets'
    );
    assert(
      monthBank.openingBalance === bankRow.openingBalance &&
        monthBank.closingBalance === bankRow.closingBalance,
      'month-wise opening and closing agree with the account-wise report'
    );

    const monthCustomer = rowOf(monthWise.rows, ctx.customerLedgerId, 'the customer ledger');
    assert(
      monthCustomer.months[0].credit === '3000.00' &&
        monthCustomer.months[1].credit === '0.00' &&
        monthCustomer.months[2].credit === '1000.00',
      'customer receipts are split across May and July with an empty June'
    );
    assert(
      monthCustomer.openingBalance === '4000.00' &&
        monthCustomer.openingNature === 'Cr' &&
        monthCustomer.closingBalance === '8000.00' &&
        monthCustomer.closingNature === 'Cr',
      'the customer opening and closing match the account-wise report'
    );

    const monthSupplier = rowOf(monthWise.rows, ctx.supplierLedgerId, 'the supplier ledger');
    assert(
      monthSupplier.months[1].debit === '6000.00' &&
        monthSupplier.months[0].debit === '0.00' &&
        monthSupplier.months[2].debit === '0.00',
      'the supplier payment is recorded in June only'
    );

    assert(
      monthWise.totals.months.length === 3 &&
        monthWise.totals.months[0].debit === '3000.00' &&
        monthWise.totals.months[0].credit === '3000.00',
      'May movement totals cover the whole filtered dataset'
    );
    assert(
      monthWise.totals.months[1].debit === '6000.00' &&
        monthWise.totals.months[1].credit === '6000.00' &&
        monthWise.totals.months[2].debit === '1000.00' &&
        monthWise.totals.months[2].credit === '1000.00',
      'June and July movement totals are correct'
    );
    assert(
      monthWise.totals.totalOpeningDebit === '54000.00' &&
        monthWise.totals.totalOpeningCredit === '14000.00',
      'month-wise opening totals are the sums of the opening balances'
    );
    assert(
      monthWise.totals.totalClosingDebit === '52000.00' &&
        monthWise.totals.totalClosingCredit === '12000.00' &&
        monthWise.totals.accountCount === 4,
      'month-wise closing totals agree with the account-wise report'
    );

    const monthSkipZero = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, skipZeroBalances: true }
    );
    assert(
      monthSkipZero.rows.length === 3 &&
        monthSkipZero.rows.every((row) => row.ledgerAccountId !== ctx.zeroLedgerId),
      'Skip 0 removes the zero-balance account from the month-wise report'
    );
    const monthCreditOnly = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, balanceColumns: 'CREDIT' }
    );
    assert(
      monthCreditOnly.rows.length === 2 &&
        monthCreditOnly.rows.every((row) => row.closingNature === 'Cr'),
      'Balance Columns filters the month-wise report the same way'
    );
    const monthDetailed = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, includePartyAddress: true, includePartyMobile: true, includePan: true }
    );
    const monthDetailedCustomer = rowOf(
      monthDetailed.rows,
      ctx.customerLedgerId,
      'the customer ledger'
    );
    assert(
      (monthDetailedCustomer.partyAddress ?? '').includes('12 Ring Road') &&
        monthDetailedCustomer.mobile === '9825011111' &&
        monthDetailedCustomer.panNumber === 'AAACP1111F',
      'the month-wise result honours the same optional print fields'
    );
    const monthNoDescription = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, doNotPrintDescription: true }
    );
    assert(
      rowOf(monthNoDescription.rows, ctx.customerLedgerId, 'the customer ledger').description === null,
      'Do not Print Description also applies to the month-wise report'
    );

    section('G. A4 landscape month-wise print document and PDF');
    const monthPrint = monthWise.print;
    assert(
      monthPrint.reportTitle === 'ACCOUNT + MONTH WISE BALANCE' &&
        monthPrint.orientation === 'landscape',
      'the month-wise document is titled and landscape'
    );
    assert(
      near(monthPrint.layout.pageWidthPt, PAGE_SIZES.landscape.width, 0.01) &&
        near(monthPrint.layout.pageHeightPt, PAGE_SIZES.landscape.height, 0.01),
      'the month-wise page is A4 landscape 841.89 x 595.28 points'
    );
    assert(
      monthPrint.monthColumnsPerPage === 5,
      'A4 landscape fits five month pairs per band (received ' +
        monthPrint.monthColumnsPerPage +
        ')'
    );
    assert(monthPrint.pages.length === 1, 'a three-month period fits on one page');
    assert(
      monthPrint.pages[0].months.length === 3 &&
        monthPrint.pages[0].monthRangeLabel === 'MAY 2026 - JUL 2026',
      'the page band lists the three months and their range label'
    );
    assert(
      monthPrint.pages[0].columnWidthsPt.length === 9 &&
        near(sum(monthPrint.pages[0].columnWidthsPt), monthPrint.layout.contentWidthPt, 0.05),
      'the month band widths exactly fill the content width'
    );
    const monthBankBlock = monthPrint.pages[0].blocks.find(
      (block) => block.accountName === 'HDFC Bank Current A/c'
    );
    assert(
      monthBankBlock !== undefined &&
        monthBankBlock.opening === '54,000.00 Dr' &&
        monthBankBlock.closing === '52,000.00 Dr',
      'the month-wise block prints the opening and closing balance with nature'
    );
    assert(
      monthBankBlock !== undefined &&
        monthBankBlock.cells.length === 3 &&
        monthBankBlock.cells[0].debit === '3,000.00' &&
        monthBankBlock.cells[1].credit === '6,000.00' &&
        monthBankBlock.cells[2].debit === '1,000.00',
      'the month-wise block prints one debit/credit pair per month'
    );
    assert(
      monthPrint.pages[0].totals.cells.length === 3 &&
        monthPrint.pages[0].totals.cells[0].debit === '3,000.00' &&
        monthPrint.pages[0].totals.cells[0].credit === '3,000.00',
      'the monthly total row carries the movement totals'
    );
    assert(
      monthPrint.pages[0].totals.openingDebit === '54,000.00' &&
        monthPrint.pages[0].totals.openingCredit === '14,000.00' &&
        monthPrint.pages[0].totals.closingDebit === '52,000.00' &&
        monthPrint.pages[0].totals.closingCredit === '12,000.00',
      'the total row carries the opening and closing totals'
    );
    assert(
      monthPrint.notes.length === 3 && monthPrint.notes.join(' ').includes('month bands'),
      'the month-wise document documents the month-band interpretation'
    );

    const fullYear = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, fromDate: FY_START, toDate: FY_END }
    );
    assert(fullYear.months.length === 12, 'a full financial year yields twelve month buckets');
    assert(
      fullYear.print.pages.length === 3,
      'twelve months split into three bands of five, five and two'
    );
    assert(
      fullYear.print.pages[0].months.length === 5 &&
        fullYear.print.pages[1].months.length === 5 &&
        fullYear.print.pages[2].months.length === 2,
      'the month bands are 5, 5 and 2 columns wide'
    );
    assert(
      fullYear.print.pages.every((page) => page.blocks.length === fullYear.rows.length),
      'every band repeats the account identity for all rows'
    );
    assert(
      fullYear.print.pages[0].monthRangeLabel === 'APR 2026 - AUG 2026' &&
        fullYear.print.pages[1].monthRangeLabel === 'SEP 2026 - JAN 2027' &&
        fullYear.print.pages[2].monthRangeLabel === 'FEB 2027 - MAR 2027',
      'each band carries its own month range label'
    );
    assert(
      fullYear.print.pages[2].totals.cells.length === 2 &&
        fullYear.print.totals.months.length === 12,
      'the last band totals only its own two months while the document totals all twelve'
    );
    const monthPdf = await accountWiseBalanceService.exportMonthWisePdf(
      ctx.companyId,
      ctx.financialYearId,
      monthRequest
    );
    const monthPdfText = monthPdf.buffer.toString('latin1');
    assert(
      monthPdf.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4' &&
        monthPdfText.trimEnd().endsWith('%%EOF'),
      'the month-wise export is a real PDF file'
    );
    assert(
      monthPdfText.includes('/MediaBox [0 0 841.89 595.28]'),
      'the month-wise PDF declares the A4 landscape media box'
    );
    assert(
      monthPdf.pageCount === monthPrint.pages.length && monthPdfText.includes('/Count 1'),
      'the month-wise PDF page count matches the print document'
    );
    assert(
      monthPdf.filename === 'Account_Month_Wise_Balance_2026-2027.pdf',
      'the month-wise filename is derived from the financial year'
    );
    assert(
      monthPdfText.includes('ACCOUNT + MONTH WISE BALANCE'),
      'the month-wise PDF contains the report title'
    );
    assert(
      monthPdfText.includes('MAY 2026') &&
        monthPdfText.includes('JUN 2026') &&
        monthPdfText.includes('JUL 2026'),
      'the month-wise PDF contains the three month headers'
    );
    assert(
      monthPdfText.includes('OPENING') &&
        monthPdfText.includes('CLOSING') &&
        monthPdfText.includes('TOTAL'),
      'the month-wise PDF contains the opening, closing and total labels'
    );
    assert(
      monthPdfText.includes('54,000.00 Dr') && monthPdfText.includes('12,000.00'),
      'the month-wise PDF contains the opening balance and closing total'
    );

    const fullYearPdf = await accountWiseBalanceService.exportMonthWisePdf(
      ctx.companyId,
      ctx.financialYearId,
      { ...monthRequest, fromDate: FY_START, toDate: FY_END }
    );
    const fullYearPdfText = fullYearPdf.buffer.toString('latin1');
    assert(
      fullYearPdf.pageCount === 3 && fullYearPdfText.includes('PAGE 3 OF 3'),
      'the full-year month-wise PDF has three correctly numbered pages'
    );
    assert(
      (fullYearPdfText.match(/PAGE \d+ OF 3/g) ?? []).length === 3,
      'every month band page carries its own page number'
    );

    section('H. Endpoint mode guards');
    await expectError(
      () => accountWiseBalanceService.runMonthWise(ctx.companyId, ctx.financialYearId, baseRequest),
      400,
      'the month-wise endpoint rejects the account-wise report type'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(ctx.companyId, ctx.financialYearId, {
          ...monthRequest,
          reportType: 'SOMETHING_ELSE',
        }),
      400,
      'the month-wise endpoint rejects an unknown report type'
    );
    await expectError(
      () => accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, monthRequest),
      400,
      'the account-wise endpoint still rejects the month-wise report type'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(ctx.companyId, ctx.financialYearId, {
          ...monthRequest,
          accountType: 'DEPOSITORS',
        }),
      400,
      'the month-wise report rejects the unsupported Depositors account type'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(ctx.companyId, ctx.financialYearId, {
          ...monthRequest,
          fromDate: '2025-12-01',
        }),
      400,
      'the month-wise report rejects a period outside the financial year'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(ctx.companyId, ctx.financialYearId, {
          ...monthRequest,
          skipZeroBalances: 'yes',
        }),
      400,
      'the month-wise report rejects a non-boolean checkbox value'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(
          ctx.companyId,
          ctx.otherFinancialYearId,
          monthRequest
        ),
      404,
      'another company financial year is never reachable from the month-wise endpoint'
    );
    await expectError(
      () =>
        accountWiseBalanceService.runMonthWise(
          '00000000-0000-0000-0000-000000000000',
          ctx.financialYearId,
          monthRequest
        ),
      404,
      'an unknown company is rejected before the month-wise query runs'
    );
    await expectError(
      () => accountWiseBalanceService.exportPdf(ctx.companyId, ctx.financialYearId, monthRequest),
      400,
      'the account-wise PDF export refuses the month-wise report type'
    );
    await expectError(
      () =>
        accountWiseBalanceService.exportMonthWisePdf(
          ctx.companyId,
          ctx.financialYearId,
          baseRequest
        ),
      400,
      'the month-wise PDF export refuses the account-wise report type'
    );

    section('I. Company isolation and read-only guarantees');
    const otherMonthWise = await accountWiseBalanceService.runMonthWise(
      ctx.otherCompanyId,
      ctx.otherFinancialYearId,
      monthRequest
    );
    assert(
      otherMonthWise.rows.length === 1 &&
        otherMonthWise.rows[0].ledgerAccountId === ctx.otherLedgerId,
      'another company sees only its own ledger in the month-wise report'
    );
    assert(
      otherMonthWise.rows[0].openingBalance === '4000.00' &&
        otherMonthWise.months.length === 3 &&
        otherMonthWise.rows[0].months.every((month) => month.debit === '0.00'),
      'the other company opening is its own stored balance with empty month buckets'
    );
    assert(
      otherMonthWise.print.company.companyName === 'OTHER PHASE 19 PRINT LTD' &&
        otherMonthWise.print.company.panNumber === null,
      'the other company header prints its own values and omits a missing PAN'
    );

    const journalLineCountAfter = await prisma.journalLine.count({
      where: { companyId: ctx.companyId },
    });
    const voucherCountAfter = await prisma.bankVoucher.count({
      where: { companyId: ctx.companyId },
    });
    const ledgerCountAfter = await prisma.ledgerAccount.count({
      where: { companyId: ctx.companyId },
    });
    const partyCountAfter = await prisma.party.count({ where: { companyId: ctx.companyId } });
    assert(
      journalLineCountAfter === journalLineCountBefore,
      'running every report and export never writes or deletes a journal line'
    );
    assert(
      voucherCountAfter === voucherCountBefore,
      'running every report and export never writes or deletes a voucher'
    );
    assert(
      ledgerCountAfter === ledgerCountBefore && partyCountAfter === partyCountBefore,
      'no ledger account or party master record is created by a report run'
    );

    const bankAfter = await prisma.ledgerAccount.findFirst({
      where: { companyId: ctx.companyId, id: ctx.bankLedgerId },
      select: { openingBalance: true, description: true },
    });
    const customerAfter = await prisma.ledgerAccount.findFirst({
      where: { companyId: ctx.companyId, id: ctx.customerLedgerId },
      select: { openingBalance: true, description: true },
    });
    assert(
      bankAfter?.openingBalance.toFixed(2) === '50000.00' &&
        customerAfter?.openingBalance.toFixed(2) === '0.00',
      'the stored ledger opening balances are never modified by a report'
    );
    assert(
      customerAfter?.description === 'Key retail buyer',
      'Do not Print Description never erases the stored description'
    );

    console.log('\n========================================');
    console.log('Phase 19.1 Phase 2 suite: ' + passed + '/' + total + ' assertions passed');
    console.log('========================================');
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\nPhase 19.1 Phase 2 suite failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});