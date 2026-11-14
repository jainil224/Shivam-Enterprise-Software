// Phase 19.2 - traditional Chandni-style print format test suite.
//
// Verifies the Account Wise Balance print document and its genuine A4 PDF:
// header band layout, real Company Master values, PAN/TAN/GSTIN, title,
// financial year, period, PAGE X OF Y, the 55/22.5/22.5 table, left account
// names, right aligned money, the six print options, Skip 0, Page Break on
// Every Party, multi-page output, the TOTAL row, the PDF signature and text,
// the PDF matching the preview document, and the untouched Account + Month
// Wise landscape regression.
//
// Isolated fixtures only: this suite creates its own company, financial year
// and ledger accounts, then removes them. No report run writes any accounting
// record.

import { Prisma, PrismaClient } from '@prisma/client';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import { accountWiseBalanceService } from '../src/services/accountWiseBalanceService.js';
import { AWB_GEOMETRY, groupMoney } from '../src/utils/accountWiseBalancePrint.js';
import { fontTextWidth } from '../src/utils/pdfWriter.js';

const prisma = new PrismaClient();
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

const TEST_COMPANY_CODE = 'P192TEST';
const OTHER_COMPANY_CODE = 'P192OTHER';
const COMPANY_NAME = 'SIVAM PHASE 19.2 TRADERS PRIVATE LIMITED';
const COMPANY_PAN = 'AAACS7777Q';
const COMPANY_GSTIN = '24AABCS7777F1Z5';
const FY_NAME = '2026 - 2027';
const FY_START = '2026-04-01';
const FY_END = '2027-03-31';
const FROM = '2026-04-01';
const TO = '2027-03-31';
const BULK_COUNT = 30;

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

interface TextOp {
  font: string;
  size: number;
  x: number;
  y: number;
  text: string;
}

function decodePdfText(raw: string): string {
  let out = '';
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = raw[index + 1];
    if (next === 'n') {
      out += '\n';
      index += 1;
    } else if (next === 'r') {
      out += '\r';
      index += 1;
    } else if (next === 't') {
      out += '\t';
      index += 1;
    } else if (next === '(' || next === ')' || next === '\\') {
      out += next;
      index += 1;
    } else {
      const octal = /^[0-7]{1,3}/.exec(raw.slice(index + 1, index + 4));
      if (octal) {
        out += String.fromCharCode(parseInt(octal[0], 8));
        index += octal[0].length;
      } else {
        out += next;
        index += 1;
      }
    }
  }
  return out;
}

/** Text runs of every page, in drawing order. */
function parseTextOps(buffer: Buffer): TextOp[][] {
  const source = buffer.toString('latin1');
  const streams = [...source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)];
  return streams.map((stream) => {
    const ops: TextOp[] = [];
    for (const line of stream[1].split('\n')) {
      const match =
        /BT \/(F\d) ([\d.]+) Tf 1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm \((.*)\) Tj ET$/.exec(line.trim());
      if (match) {
        ops.push({
          font: match[1],
          size: Number(match[2]),
          x: Number(match[3]),
          y: Number(match[4]),
          text: decodePdfText(match[5]),
        });
      }
    }
    return ops;
  });
}

const findOp = (ops: TextOp[], text: string): TextOp | undefined =>
  ops.find((op) => op.text === text);

const opsWithPrefix = (ops: TextOp[], prefix: string): TextOp[] =>
  ops.filter((op) => op.text.startsWith(prefix));
interface SuiteContext {
  companyId: string;
  financialYearId: string;
  otherCompanyId: string;
  otherFinancialYearId: string;
  bankLedgerId: string;
  customerLedgerId: string;
  supplierLedgerId: string;
  zeroLedgerIds: string[];
  bulkLedgerIds: string[];
  otherLedgerId: string;
}

async function createCompanyWithYear(
  code: string,
  name: string,
  pan: string | null,
  address: string | null
) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: COMPANY_GSTIN,
      panNumber: pan,
      address,
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
  const primary = await createCompanyWithYear(
    TEST_COMPANY_CODE,
    COMPANY_NAME,
    COMPANY_PAN,
    'Plot 19, Ring Road'
  );
  const other = await createCompanyWithYear(OTHER_COMPANY_CODE, 'OTHER PHASE 19.2 LTD', null, null);

  const customerParty = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P192CUST',
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

  const otherParty = await prisma.party.create({
    data: {
      companyId: other.company.id,
      partyCode: 'P192OTH1',
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

  const customer = await ledgerService.create(primary.company.id, {
    accountCode: '1201',
    accountName: 'Alpha Traders',
    accountGroup: 'SUNDRY_DEBTORS',
    openingBalance: '5000.00',
    balanceType: 'DEBIT',
    partyId: customerParty.id,
    description: 'Key retail buyer',
  });

  const supplier = await ledgerService.create(primary.company.id, {
    accountCode: '2101',
    accountName: 'Beta Suppliers',
    accountGroup: 'SUNDRY_CREDITORS',
    openingBalance: '10000.00',
    balanceType: 'CREDIT',
  });

  const zeroLedgerIds: string[] = [];
  for (const index of [1, 2]) {
    const ledger = await ledgerService.create(primary.company.id, {
      accountCode: '13' + String(index).padStart(2, '0'),
      accountName: 'Zero Balance Party ' + index,
      accountGroup: 'SUNDRY_DEBTORS',
      openingBalance: '0.00',
      balanceType: 'DEBIT',
    });
    zeroLedgerIds.push(ledger.id);
  }

  const bulkLedgerIds: string[] = [];
  for (let index = 1; index <= BULK_COUNT; index += 1) {
    const ledger = await ledgerService.create(primary.company.id, {
      accountCode: '2' + String(200 + index),
      accountName: 'Bulk Party ' + String(index).padStart(2, '0'),
      accountGroup: 'SUNDRY_DEBTORS',
      openingBalance: (index * 1000).toFixed(2),
      balanceType: 'DEBIT',
      ...(index === 1 ? { description: 'Bulk buyer with details' } : {}),
    });
    bulkLedgerIds.push(ledger.id);
  }

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
    customerLedgerId: customer.id,
    supplierLedgerId: supplier.id,
    zeroLedgerIds,
    bulkLedgerIds,
    otherLedgerId: otherLedger.id,
  };
}

const request = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  reportType: 'ACCOUNT_WISE_BALANCE',
  accountType: 'ALL',
  fromDate: FROM,
  toDate: TO,
  ...overrides,
});
async function main() {
  try {
    await cleanupTestData();
    const ctx = await buildContext();
    const base = request();
    const result = await accountWiseBalanceService.run(ctx.companyId, ctx.financialYearId, base);
    const print = result.print;
    const layout = print.layout;
    const typography = layout.typography;
    const widths = print.columnWidthsPt;
    const left = layout.contentLeftPt;
    const contentRight = left + layout.contentWidthPt;
    const pdf = await accountWiseBalanceService.exportPdf(ctx.companyId, ctx.financialYearId, base);
    const pdfPages = parseTextOps(pdf.buffer);
    const first = pdfPages[0];
    const pdfText = pdf.buffer.toString('latin1');

    section('A. A4 page geometry and header band (items 1-2)');
    assert(
      near(layout.pageWidthPt, 595.28, 0.01) && near(layout.pageHeightPt, 841.89, 0.01),
      'the document is A4 portrait (595.28 x 841.89 pt)'
    );
    assert(
      near((layout.contentLeftPt / 72) * 25.4, 10, 0.5) &&
        near((layout.bodyBottomPt / 72) * 25.4, 10, 0.5),
      'the content sits on a 10 mm margin on every side'
    );
    const documentTop = layout.pageHeightPt - layout.bodyTopPt;
    assert(
      documentTop > 100 && documentTop < 220,
      'the document starts near the top of the page (received ' + documentTop.toFixed(2) + ' pt)'
    );
    assert(
      print.company.companyName === COMPANY_NAME,
      'the header prints the real Company Master name'
    );
    assert(
      layout.companyNameLines.length >= 1 &&
        layout.companyNameLines.length <= 2 &&
        layout.companyNameLines.join(' ') === COMPANY_NAME,
      'the company name is wrapped with the real Helvetica metrics'
    );
    assert(
      typography.companyNamePt >= 13 && typography.companyNamePt <= 15,
      'the company name is set at 13-15 pt (received ' + typography.companyNamePt + ')'
    );
    assert(layout.nameHeightPt >= 30, 'the company name keeps its own header band');
    assert(
      near(
        layout.headerHeightPt,
        layout.nameHeightPt +
          layout.addressHeightPt +
          layout.panHeightPt +
          layout.titleHeightPt +
          layout.metaHeightPt
      ),
      'the header is the sum of its five bands'
    );
    assert(
      layout.companyNameWidthPt + fontTextWidth(FY_NAME, typography.financialYearPt, 'helvetica', true) + 24 <=
        layout.contentWidthPt + 0.05,
      'the name band leaves room for the right aligned financial year'
    );
    const nameOp = findOp(first, layout.companyNameLines[0]);
    const financialYearOp = findOp(first, FY_NAME);
    assert(nameOp !== undefined && financialYearOp !== undefined, 'both the name and the financial year print');
    assert(
      nameOp !== undefined &&
        financialYearOp !== undefined &&
        Math.abs(nameOp.y - financialYearOp.y) < 0.01,
      'the financial year shares the company name baseline'
    );
    const nameWidth = fontTextWidth(
      layout.companyNameLines[0],
      typography.companyNamePt,
      'helvetica',
      true
    );
    assert(
      nameOp !== undefined &&
        near(nameOp.x, left + (layout.companyNameWidthPt - nameWidth) / 2, 0.6),
      'the company name is centred in the page'
    );
    assert(
      financialYearOp !== undefined &&
        near(
          financialYearOp.x + fontTextWidth(FY_NAME, financialYearOp.size, 'helvetica', true),
          contentRight - 3,
          0.6
        ),
      'the financial year is right aligned on the company line'
    );

    section('B. Real company address (item 2)');
    assert(
      print.company.addressLines.length === 2,
      'the stored address and locality print on two centred lines'
    );
    assert(
      print.company.addressLines[0].includes('Plot 19, Ring Road') &&
        print.company.addressLines.join(' ').includes('Surat'),
      'the address lines come from the Company Master, not a hardcoded value'
    );
    assert(
      near(
        layout.addressHeightPt,
        print.company.addressLines.length * AWB_GEOMETRY.headerAddressLine +
          AWB_GEOMETRY.headerAddressPad
      ),
      'the address band grows with its line count'
    );
    const addressOp = findOp(first, print.company.addressLines[0]);
    assert(
      addressOp !== undefined &&
        near(
          addressOp.x + fontTextWidth(addressOp.text, addressOp.size, 'helvetica', false) / 2,
          left + layout.contentWidthPt / 2,
          0.6
        ),
      'the address block is centred'
    );

    section('C. PAN, TAN, GSTIN, title, financial year, period, page (items 3-9)');
    assert(print.company.panNumber === COMPANY_PAN, 'the header carries the stored PAN');
    assert(print.company.tanNumber === null, 'TAN is null because the Company model stores no TAN');
    assert(findOp(first, 'PAN NO: ' + COMPANY_PAN) !== undefined, 'the PDF prints PAN NO with the real value');
    assert(opsWithPrefix(first, 'TAN NO:').length === 0, 'the PDF omits TAN NO entirely when unavailable');
    assert(
      findOp(first, 'GSTIN: ' + COMPANY_GSTIN) !== undefined,
      'the PDF prints the stored GSTIN'
    );
    assert(print.reportTitle === 'ACCOUNT BALANCE REPORT', 'the report title is the traditional one');
    const titleOp = findOp(first, 'ACCOUNT BALANCE REPORT');
    assert(titleOp !== undefined && titleOp.font === 'F6', 'the report title is bold');
    assert(
      typography.titlePt >= 10 && typography.titlePt <= 12 && titleOp !== undefined && titleOp.size === typography.titlePt,
      'the report title is set at 10-12 pt'
    );
    assert(
      titleOp !== undefined &&
        near(
          titleOp.x + fontTextWidth(titleOp.text, titleOp.size, 'helvetica', true) / 2,
          left + layout.contentWidthPt / 2,
          0.6
        ),
      'the report title is centred'
    );
    assert(
      print.periodFrom === '01-04-2026' && print.periodTo === '31-03-2027',
      'the period is displayed as DD-MM-YYYY'
    );
    assert(
      findOp(first, 'PERIOD: 01-04-2026 TO 31-03-2027') !== undefined,
      'the PDF prints the From and To dates'
    );
    assert(
      findOp(first, 'PAGE 1 OF ' + print.pages.length) !== undefined,
      'the PDF prints PAGE 1 OF the real page count'
    );
    assert(
      print.pages.every((page, index) =>
        findOp(pdfPages[index] ?? [], 'PAGE ' + (index + 1) + ' OF ' + print.pages.length) !== undefined
      ),
      'every page carries its own PAGE X OF Y'
    );

    section('D. Table columns and amount alignment (items 10-12)');
    const weight =
      AWB_GEOMETRY.accountWeight + AWB_GEOMETRY.debitWeight + AWB_GEOMETRY.creditWeight;
    assert(
      near(widths[0], (layout.contentWidthPt * AWB_GEOMETRY.accountWeight) / weight, 0.01),
      'the account column takes 55% of the content width'
    );
    assert(
      near(widths[1], (layout.contentWidthPt * AWB_GEOMETRY.debitWeight) / weight, 0.01) &&
        near(widths[2], (layout.contentWidthPt * AWB_GEOMETRY.creditWeight) / weight, 0.01),
      'the debit and credit columns take 22.5% each'
    );
    assert(
      near(widths[0] + widths[1] + widths[2], layout.contentWidthPt, 0.01),
      'the three columns fill the content width exactly'
    );
    const accountHeadOp = findOp(first, 'ACCOUNT NAME');
    assert(
      accountHeadOp !== undefined && near(accountHeadOp.x, left + 3, 0.01),
      'the ACCOUNT NAME heading is left aligned'
    );
    assert(
      accountHeadOp !== undefined && accountHeadOp.font === 'F6',
      'the column headings are bold'
    );
    assert(
      typography.tableHeadPt >= 8 && typography.tableHeadPt <= 9,
      'the column headings are set at 8-9 pt'
    );
    const debitHeadOp = findOp(first, 'DEBIT');
    assert(
      debitHeadOp !== undefined &&
        near(
          debitHeadOp.x + fontTextWidth('DEBIT', debitHeadOp.size, 'helvetica', true),
          left + widths[0] + widths[1] - 3,
          0.6
        ),
      'the DEBIT heading is right aligned to its column edge'
    );
    const creditHeadOp = findOp(first, 'CREDIT');
    assert(
      creditHeadOp !== undefined &&
        near(
          creditHeadOp.x + fontTextWidth('CREDIT', creditHeadOp.size, 'helvetica', true),
          contentRight - 3,
          0.6
        ),
      'the CREDIT heading is right aligned to its column edge'
    );
    const pageOneBlocks = print.pages[0].blocks;
    // The credit-balance and detail fixtures can land on either page, so look
    // every block up across the whole document and read its own page stream.
    const allBlocks = print.pages.flatMap((page, index) =>
      page.blocks.map((block) => ({ block, pageIndex: index }))
    );
    const findBlock = (name: string) => allBlocks.find((entry) => entry.block.accountName === name);
    assert(
      pageOneBlocks.every((block) =>
        block.nameLines.every((line) => {
          const op = findOp(first, line);
          return op !== undefined && near(op.x, left + 3, 0.01);
        })
      ),
      'every account name starts at the left edge of the account column'
    );
    assert(
      pageOneBlocks.every((block) => {
        if (block.debit.length === 0) return true;
        const op = findOp(first, block.debit);
        return (
          op !== undefined &&
          near(
            op.x + fontTextWidth(block.debit, op.size, 'helvetica', false),
            left + widths[0] + widths[1] - 3,
            0.6
          )
        );
      }),
      'every debit amount ends at the debit column right edge'
    );
    assert(
      pageOneBlocks.every((block) => {
        if (block.credit.length === 0) return true;
        const op = findOp(first, block.credit);
        return (
          op !== undefined &&
          near(
            op.x + fontTextWidth(block.credit, op.size, 'helvetica', false),
            contentRight - 3,
            0.6
          )
        );
      }),
      'every credit amount ends at the credit column right edge'
    );
    assert(
      typography.amountPt >= 8.5 && typography.amountPt <= 9.5,
      'the amounts are set at about 9 pt'
    );
    const bankEntry = findBlock('HDFC Bank Current A/c');
    assert(
      bankEntry !== undefined &&
        bankEntry.block.debit === '50,000.00' &&
        bankEntry.block.credit === '',
      'a debit balance prints only in the debit column'
    );
    const supplierEntry = findBlock('Beta Suppliers');
    assert(
      supplierEntry !== undefined &&
        supplierEntry.block.credit === '10,000.00' &&
        supplierEntry.block.debit === '',
      'a credit balance prints only in the credit column'
    );
    const bankOps = bankEntry ? pdfPages[bankEntry.pageIndex] ?? [] : [];
    const bankNameOp = bankEntry ? findOp(bankOps, bankEntry.block.nameLines[0]) : undefined;
    const bankAmountOp = bankEntry ? findOp(bankOps, bankEntry.block.debit) : undefined;
    assert(
      bankNameOp !== undefined && bankAmountOp !== undefined && Math.abs(bankNameOp.y - bankAmountOp.y) < 1,
      'an account without details prints its amount on the account name line'
    );
    const detailEntry = findBlock('Bulk Party 01');
    assert(
      detailEntry !== undefined &&
        detailEntry.block.detailLines.length === 1 &&
        detailEntry.block.debit === '1,000.00',
      'a block with a description keeps its detail line and its amount'
    );
    const detailOps = detailEntry ? pdfPages[detailEntry.pageIndex] ?? [] : [];
    const detailOp = detailEntry ? findOp(detailOps, detailEntry.block.detailLines[0]) : undefined;
    const detailAmountOp = detailEntry ? findOp(detailOps, detailEntry.block.debit) : undefined;
    assert(
      detailOp !== undefined &&
        detailAmountOp !== undefined &&
        Math.abs(detailOp.y - detailAmountOp.y) < 1,
      'the amount sits on the last printed line of a block with details'
    );
    assert(
      typography.detailPt >= 7 && typography.detailPt <= 8,
      'the detail lines are set at 7-8 pt'
    );
    assert(
      typography.accountNamePt >= 9 && typography.accountNamePt <= 10,
      'the account names are set at 9-10 pt'
    );
    section('E. The six print options (items 13-18)');
    assert(
      result.rows.length === 35,
      'the base report keeps every real account, including the zero ones (received ' +
        result.rows.length +
        ')'
    );
    const detailText = (blocks: typeof pageOneBlocks): string =>
      blocks.flatMap((block) => block.detailLines).join(' | ');
    const withDetails = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      request({ includePartyAddress: true, includePartyMobile: true, includePan: true })
    );
    const customerWithDetails = withDetails.print.pages
      .flatMap((page) => page.blocks)
      .find((block) => block.accountName === 'Alpha Traders');
    const withText = customerWithDetails ? customerWithDetails.detailLines.join(' | ') : '';
    assert(
      withText.includes('12 Ring Road'),
      'Party Address Required prints the stored party address'
    );
    assert(
      withText.includes('Mobile No: 9825011111'),
      'Party Mobile No Required prints the stored mobile number'
    );
    assert(
      withText.includes('PAN No: AAACP1111F'),
      'PAN No Required prints the stored party PAN'
    );
    assert(withText.includes('Key retail buyer'), 'the stored description prints by default');
    const customerWithout = print.pages
      .flatMap((page) => page.blocks)
      .find((block) => block.accountName === 'Alpha Traders');
    const withoutText = customerWithout ? customerWithout.detailLines.join(' | ') : '';
    assert(
      !withoutText.includes('12 Ring Road') &&
        !withoutText.includes('Mobile No:') &&
        !withoutText.includes('PAN No:'),
      'a disabled checkbox never prints its optional detail'
    );
    assert(
      withoutText.includes('Key retail buyer'),
      'the description is independent of the three party checkboxes'
    );
    const noDescription = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      request({
        doNotPrintDescription: true,
        includePartyAddress: true,
        includePartyMobile: true,
        includePan: true,
      })
    );
    const noDescriptionBlock = noDescription.print.pages
      .flatMap((page) => page.blocks)
      .find((block) => block.accountName === 'Alpha Traders');
    const noDescriptionText = noDescriptionBlock
      ? noDescriptionBlock.detailLines.join(' | ')
      : '';
    assert(
      !noDescriptionText.includes('Key retail buyer'),
      'Do Not Print Description removes the stored description'
    );
    assert(
      noDescriptionText.includes('12 Ring Road') &&
        noDescriptionText.includes('Mobile No:') &&
        noDescriptionText.includes('PAN No:'),
      'Do Not Print Description leaves the other optional details intact'
    );
    const skipZero = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      request({ skipZeroBalances: true })
    );
    assert(
      skipZero.rows.length === result.rows.length - 2,
      'Skip 0 removes exactly the two zero-balance accounts'
    );
    assert(
      !skipZero.print.pages
        .flatMap((page) => page.blocks)
        .some((block) => block.accountName.startsWith('Zero Balance Party')),
      'no zero-balance account survives Skip 0'
    );
    const perParty = await accountWiseBalanceService.run(
      ctx.companyId,
      ctx.financialYearId,
      request({ pageBreakEveryParty: true })
    );
    assert(
      perParty.print.pages.length === perParty.rows.length,
      'Page Break on Every Party prints one account per page'
    );
    assert(
      perParty.print.pages.every((page) => page.blocks.length === 1),
      'no page carries more than one account'
    );
    assert(
      perParty.print.pages.every((page) => page.blocks.length > 0),
      'no blank page is created between accounts'
    );
    assert(
      perParty.print.pages.filter((page) => page.showTotals).length === 1 &&
        perParty.print.pages[perParty.print.pages.length - 1].showTotals === true,
      'the TOTAL row prints once, on the final page'
    );

    section('F. TOTAL row and multi-page output (items 19-20)');
    assert(
      print.pages.length >= 2,
      'thirty-five accounts span more than one A4 page (received ' + print.pages.length + ')'
    );
    assert(
      print.pages.every((page, index) => page.pageNumber === index + 1),
      'the print pages are numbered sequentially'
    );
    assert(
      print.pages.slice(0, -1).every((page) => page.showTotals === false) &&
        print.pages[print.pages.length - 1].showTotals === true,
      'the TOTAL row is only on the last page'
    );
    const usedOnLastPage =
      print.pages[print.pages.length - 1].blocks.reduce((sum, block) => sum + block.heightPt, 0) +
      layout.totalsHeightPt;
    assert(
      usedOnLastPage <= layout.bodyTopPt - layout.bodyBottomPt,
      'the last page never runs into the bottom margin'
    );
    assert(
      result.totals.totalClosingDebit === '520000.00' &&
        result.totals.totalClosingCredit === '10000.00',
      'the closing totals are unchanged by the new format'
    );
    assert(
      print.totals.debit === groupMoney('520000.00') &&
        print.totals.credit === groupMoney('10000.00'),
      'the print totals use Indian digit grouping (5,20,000.00 / 10,000.00)'
    );
    assert(
      print.totals.debit !== print.totals.credit,
      'the two totals are independent and never forced to agree'
    );
    const lastPageOps = pdfPages[pdfPages.length - 1] ?? [];
    const totalOp = findOp(lastPageOps, 'TOTAL');
    assert(totalOp !== undefined, 'the PDF prints the TOTAL label on the last page');
    assert(totalOp !== undefined && totalOp.font === 'F6', 'the TOTAL row is bold');
    assert(
      typography.totalPt >= 9 && typography.totalPt <= 10,
      'the total row is set at 9-10 pt'
    );
    assert(
      findOp(lastPageOps, print.totals.debit) !== undefined &&
        findOp(lastPageOps, print.totals.credit) !== undefined,
      'the PDF prints both total amounts'
    );
    assert(
      print.pages.every((page, index) => {
        const ops = pdfPages[index] ?? [];
        return (
          findOp(ops, 'ACCOUNT BALANCE REPORT') !== undefined &&
          findOp(ops, 'ACCOUNT NAME') !== undefined &&
          findOp(ops, 'DEBIT') !== undefined &&
          findOp(ops, 'CREDIT') !== undefined &&
          opsWithPrefix(ops, 'GSTIN:').length === 1
        );
      }),
      'every page repeats the header, the title and the table headings'
    );

    section('G. Genuine PDF and preview parity (items 21-24)');
    assert(pdfText.startsWith('%PDF-1.4'), 'the export is a genuine PDF file');
    assert(pdfText.trimEnd().endsWith('%%EOF'), 'the PDF is terminated with %%EOF');
    assert(
      pdfText.includes('/MediaBox [0 0 595.28 841.89]'),
      'every PDF page declares the A4 portrait media box'
    );
    assert(
      pdfText.includes('/BaseFont /Helvetica') && pdfText.includes('/BaseFont /Helvetica-Bold'),
      'the PDF is set in the sans-serif Helvetica family'
    );
    assert(pdfText.includes('/F5 7 0 R') && pdfText.includes('/F6 8 0 R'), 'the PDF resources expose both Helvetica fonts');
    assert(pdf.buffer.length > 2000, 'the downloaded file is a real document, not a stub');
    assert(
      pdf.filename === 'Account_Wise_Balance_2026-2027.pdf',
      'the PDF filename is Account_Wise_Balance_2026-2027.pdf (received ' + pdf.filename + ')'
    );
    assert(
      pdf.pageCount === print.pages.length,
      'the PDF page count equals the shared print document page count'
    );
    const pdfNamesOnPageOne = first
      .filter((op) => op.font === 'F6' && op.size === typography.accountNamePt)
      .map((op) => op.text);
    const previewNamesOnPageOne = pageOneBlocks.flatMap((block) => block.nameLines);
    assert(
      pdfNamesOnPageOne.length === previewNamesOnPageOne.length &&
        pdfNamesOnPageOne.every((text, index) => text === previewNamesOnPageOne[index]),
      'the PDF page carries exactly the preview blocks, in the same order'
    );
    const pdfAmountsOnPageOne = first
      .filter((op) => op.font === 'F5' && op.size === typography.amountPt)
      .map((op) => op.text);
    const previewAmountsOnPageOne = pageOneBlocks
      .flatMap((block) => [block.debit, block.credit])
      .filter((value) => value.length > 0);
    assert(
      pdfAmountsOnPageOne.length === previewAmountsOnPageOne.length &&
        pdfAmountsOnPageOne.every((text, index) => text === previewAmountsOnPageOne[index]),
      'the PDF page carries exactly the preview amounts, in the same order'
    );
    assert(
      pdfText.includes('Mobile No: 9825011111') === false,
      'the PDF never invents optional details that the request disabled'
    );
    const pdfNames = new Set(
      pdfPages.flatMap((ops) =>
        ops.filter((op) => op.font === 'F6' && op.size === typography.accountNamePt).map((op) => op.text)
      )
    );
    assert(
      print.pages
        .flatMap((page) => page.blocks)
        .every((block) => block.nameLines.every((line) => pdfNames.has(line))),
      'every account block of every page reaches the PDF'
    );

    section('H. Month-wise regression and unchanged values (items 25-26)');
    const monthRequest = request({
      reportType: 'ACCOUNT_MONTH_WISE_BALANCE',
      fromDate: FY_START,
      toDate: FY_END,
    });
    const monthResult = await accountWiseBalanceService.runMonthWise(
      ctx.companyId,
      ctx.financialYearId,
      monthRequest
    );
    assert(monthResult.months.length === 12, 'a full financial year still yields twelve month buckets');
    assert(monthResult.print.orientation === 'landscape', 'the month-wise document stays A4 landscape');
    assert(
      monthResult.print.monthColumnsPerPage === 5,
      'the month band still fits five month columns'
    );
    const bands: string[] = [];
    for (const page of monthResult.print.pages) {
      if (bands[bands.length - 1] !== page.monthRangeLabel) bands.push(page.monthRangeLabel);
    }
    assert(bands.length === 3, 'twelve months still split into three band pages');
    assert(
      bands[0] === 'APR 2026 - AUG 2026' &&
        bands[1] === 'SEP 2026 - JAN 2027' &&
        bands[2] === 'FEB 2027 - MAR 2027',
      'the month band labels are unchanged'
    );
    assert(
      monthResult.print.pages.every((page) => page.columnWidthsPt.length === 9),
      'every month band keeps its nine columns'
    );
    const monthPdf = await accountWiseBalanceService.exportMonthWisePdf(
      ctx.companyId,
      ctx.financialYearId,
      monthRequest
    );
    const monthPdfText = monthPdf.buffer.toString('latin1');
    assert(
      monthPdfText.includes('/MediaBox [0 0 841.89 595.28]'),
      'the month-wise PDF is still A4 landscape'
    );
    assert(
      monthPdf.pageCount === monthResult.print.pages.length,
      'the month-wise PDF paginates exactly like its print document'
    );
    assert(
      monthPdf.filename === 'Account_Month_Wise_Balance_2026-2027.pdf',
      'the month-wise PDF filename is unchanged'
    );
    assert(
      monthPdfText.includes('ACCOUNT + MONTH WISE BALANCE') &&
        monthPdfText.includes('OPENING') &&
        monthPdfText.includes('CLOSING'),
      'the month-wise PDF keeps its title and balance columns'
    );
    assert(
      monthPdfText.includes('PAGE 1 OF ' + monthPdf.pageCount),
      'the month-wise PDF keeps its PAGE X OF Y numbering'
    );
    const otherResult = await accountWiseBalanceService.run(
      ctx.otherCompanyId,
      ctx.otherFinancialYearId,
      base
    );
    assert(
      otherResult.rows.length === 1 && otherResult.print.company.panNumber === null,
      'another company prints only its own ledger and omits a missing PAN'
    );
    assert(
      opsWithPrefix(pdfPages.flat(), 'TAN NO:').length === 0,
      'no page of the PDF ever invents a TAN number'
    );
    assert(
      print.notes.join(' ').includes('never forced'),
      'the document still documents that the totals are never forced to agree'
    );

    console.log('\n========================================');
    console.log('Phase 19.2 print format suite: ' + passed + '/' + total + ' assertions passed');
    console.log('========================================');
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\nPhase 19.2 print format suite failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});