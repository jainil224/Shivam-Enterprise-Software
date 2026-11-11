// Phase 16.1 - Bank Reconciliation Statement PDF format verification.
//
// Validates the printed document only: section order, table content, the All
// Clear fallback, totals, Indian currency formatting, pagination, header
// repetition, border colour and the absence of clipped text. Every financial
// figure is compared against the existing reconciliation summary; nothing is
// recalculated here and no accounting row is written.

import { PrismaClient } from '@prisma/client';
import { buildStatementPdf } from '../src/utils/pdfWriter.js';
import type { StatementBlock, StatementCell, StatementHeaderInfo } from '../src/utils/pdfWriter.js';
import { bankReconciliationService } from '../src/services/bankReconciliationService.js';
import { formatIndianMoney } from '../src/utils/money.js';

const prisma = new PrismaClient();

let total = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  total += 1;
  if (condition) {
    console.log('  PASS [' + total + ']: ' + message);
  } else {
    failed += 1;
    console.log('  FAIL [' + total + ']: ' + message);
  }
}

function section(title: string): void {
  console.log('\n--- ' + title + ' ---');
}

// ---------------------------------------------------------------------------
// PDF inspection helpers
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 28;

interface TextRun {
  x: number;
  y: number;
  font: string;
  size: number;
  color: string;
  text: string;
}

interface ParsedPage {
  texts: TextRun[];
  fills: string[];
}

function unescapePdf(value: string): string {
  return value.replace(/\\([()\\]|([0-7]{3}))/g, (_match, literal: string, octal: string) =>
    octal ? String.fromCharCode(parseInt(octal, 8)) : literal
  );
}

function parsePdf(buffer: Buffer): ParsedPage[] {
  const raw = buffer.toString('latin1');
  const streams = [...raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => match[1]);
  return streams.map((stream) => {
    const texts: TextRun[] = [];
    const fills: string[] = [];
    for (const line of stream.split('\n')) {
      const rect = /^([\d.]+) ([\d.]+) ([\d.]+) rg ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re f$/.exec(line);
      if (rect) {
        fills.push(rect[1] + ' ' + rect[2] + ' ' + rect[3]);
        continue;
      }
      const text = /^([\d.]+) ([\d.]+) ([\d.]+) rg BT \/(F[1-4]) ([\d.]+) Tf 1 0 0 1 ([\d.]+) ([\d.]+) Tm \(([\s\S]*)\) Tj ET$/.exec(line);
      if (text) {
        texts.push({
          x: Number(text[6]),
          y: Number(text[7]),
          font: text[4],
          size: Number(text[5]),
          color: text[1] + ' ' + text[2] + ' ' + text[3],
          text: unescapePdf(text[8]),
        });
      }
    }
    return { texts, fills };
  });
}

function allText(pages: ParsedPage[]): string[] {
  return pages.flatMap((page) => page.texts.map((run) => run.text));
}

function indexOfText(texts: string[], needle: string): number {
  return texts.findIndex((value) => value === needle);
}

// ---------------------------------------------------------------------------
// Document fixtures - mirror exactly what the service builds
// ---------------------------------------------------------------------------

function heading(text: string): StatementBlock {
  return { type: 'row', cells: [{ text, weight: 100, align: 'left', bold: true, italic: true }] };
}

function amountRow(label: string, amount: string): StatementBlock {
  return {
    type: 'row',
    cells: [
      { text: label, weight: 74, align: 'left', bold: true, italic: true },
      { text: amount, weight: 26, align: 'right', bold: true },
    ],
  };
}

const PAYMENT_COLUMNS: StatementCell[] = [
  { text: 'Date', weight: 12, align: 'left' },
  { text: 'Chq. No.', weight: 15, align: 'left' },
  { text: 'Favouring', weight: 37, align: 'left' },
  { text: 'Amount (Rs.)', weight: 18, align: 'right' },
  { text: 'Cl. Date', weight: 13, align: 'left' },
];

const RECEIPT_COLUMNS: StatementCell[] = [
  { text: 'Date', weight: 12, align: 'left' },
  { text: 'Chq. No.', weight: 15, align: 'left' },
  { text: 'Received From', weight: 45, align: 'left' },
  { text: 'Amount (Rs.)', weight: 18, align: 'right' },
];

interface DocOptions {
  companyName?: string;
  bankName?: string;
  payments?: string[][];
  receipts?: string[][];
  bookBalance?: string;
  paymentTotal?: string;
  receiptTotal?: string;
  statementBalance?: string | null;
  calculatedBank?: string;
  difference?: string | null;
  generatedAt?: Date;
}

interface BuiltDoc {
  buffer: Buffer;
  pageCount: number;
  pages: ParsedPage[];
  texts: string[];
}

function buildDocument(options: DocOptions = {}): BuiltDoc {
  const payments = options.payments ?? [];
  const receipts = options.receipts ?? [];
  const header: StatementHeaderInfo = {
    companyName: options.companyName ?? 'SHIVAM ENTERPRISE',
    companyAddress: '12 Textile Market Road, Ring Road, Surat, Gujarat, 395002',
    companyGstin: '24AABCS1234F1Z5',
    financialYear: '2026 - 2027',
    title: 'BANK RECONCILIATION REPORT',
    bankName: options.bankName ?? 'HDFC Bank Current A/c',
    period: 'FROM: 01-04-2026 TO: 11-11-2026',
  };

  const blocks: StatementBlock[] = [
    amountRow('1. Balance as per our Bank Book :-', 'Rs. ' + (options.bookBalance ?? '5,34,500.00')),
    heading('2. Add : Cheques issued but not presented for payment :-'),
    {
      type: 'table',
      columns: PAYMENT_COLUMNS,
      rows: payments,
      emptyText: 'All Clear',
      total: { label: 'Total', amount: options.paymentTotal ?? '0.00', amountColumn: 3 },
    },
    heading('3. Less : Cheque deposited but not credited :-'),
    {
      type: 'table',
      columns: RECEIPT_COLUMNS,
      rows: receipts,
      emptyText: 'All Clear',
      total: { label: 'Total', amount: options.receiptTotal ?? '0.00', amountColumn: 3 },
    },
    amountRow(
      '4. Balance as per Bank Statement :-',
      options.statementBalance === null || options.statementBalance === undefined
        ? 'Not entered'
        : 'Rs. ' + options.statementBalance
    ),
    amountRow('5. Cl. Bal :-', 'Rs. ' + (options.calculatedBank ?? '5,34,500.00')),
  ];

  const difference = options.difference ?? null;
  if (difference !== null && difference !== '0.00' && difference !== '-0.00') {
    blocks.push({
      type: 'note',
      text: 'Unreconciled Difference: Rs. ' + difference,
      size: 8.5,
      bold: true,
    });
  }

  const result = buildStatementPdf({
    orientation: 'portrait',
    header,
    blocks,
    generatedAt: options.generatedAt ?? new Date('2026-11-11T00:00:00Z'),
  });
  const pages = parsePdf(result.buffer);
  return { buffer: result.buffer, pageCount: result.pageCount, pages, texts: allText(pages) };
}

/** Every text run must sit inside the printable box; nothing may be clipped. */
function assertNothingClipped(doc: BuiltDoc, label: string): void {
  const outside = doc.pages.flatMap((page) =>
    page.texts.filter((run) => {
      const width = run.text.length * run.size * 0.6;
      return run.x < PAGE_MARGIN - 0.01 || run.x + width > PAGE_WIDTH - PAGE_MARGIN + 0.01;
    })
  );
  assert(
    outside.length === 0,
    label + ': every text run stays inside the ' + PAGE_MARGIN + 'pt margins (' + outside.length + ' outside)'
  );
  const overTall = doc.pages.flatMap((page) =>
    page.texts.filter((run) => run.y < 0 || run.y > PAGE_HEIGHT)
  );
  assert(overTall.length === 0, label + ': no text run falls outside the A4 page height');
}

/** The printed statement must be black on white - no coloured bands. */
function assertMonochrome(doc: BuiltDoc, label: string): void {
  const fills = doc.pages.flatMap((page) => page.fills);
  const nonBlack = fills.filter((fill) => fill !== '0 0 0');
  assert(nonBlack.length === 0, label + ': every border is thin black (' + fills.length + ' rules, 0 coloured)');
  const colouredText = doc.pages.flatMap((page) => page.texts.filter((run) => run.color !== '0 0 0'));
  assert(colouredText.length === 0, label + ': every text run prints pure black');
}

function assertSectionOrder(doc: BuiltDoc, label: string): void {
  const texts = doc.texts;
  const s1 = indexOfText(texts, '1. Balance as per our Bank Book :-');
  const s2 = indexOfText(texts, '2. Add : Cheques issued but not presented for payment :-');
  const s3 = indexOfText(texts, '3. Less : Cheque deposited but not credited :-');
  const s4 = indexOfText(texts, '4. Balance as per Bank Statement :-');
  const s5 = indexOfText(texts, '5. Cl. Bal :-');
  assert(
    s1 >= 0 && s2 > s1 && s3 > s2 && s4 > s3 && s5 > s4,
    label + ': sections 1-5 print in the reference order'
  );
}

// ---------------------------------------------------------------------------
// Scenario suite
// ---------------------------------------------------------------------------

const PAYMENT_A = ['08-05-2026', '900001', 'Shree Ganesh Textiles', '6,000.00', ''];
const PAYMENT_B = ['18-05-2026', '900002', 'Rajkot Cotton Traders', '12,500.00', '20-05-2026'];
const RECEIPT_A = ['10-05-2026', 'P16-TEMP-R1', 'Mumbai Fashions Pvt Ltd', '30,000.00'];
const RECEIPT_B = ['11-05-2026', 'P16-TEMP-R2', 'Surat Weaving House', '15,000.00'];

function runScenarios(): void {
  section('A. Header, monochrome and page geometry');

  const base = buildDocument({
    payments: [PAYMENT_A, PAYMENT_B],
    receipts: [RECEIPT_A, RECEIPT_B],
    paymentTotal: '18,500.00',
    receiptTotal: '45,000.00',
    statementBalance: '5,09,000.00',
    calculatedBank: '5,34,500.00',
    difference: '-25,500.00',
  });

  assert(base.pageCount === 1, 'A4 portrait statement fits the sample data on a single page');
  assert(base.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4', 'the output is a genuine PDF file');
  assertMonochrome(base, 'both table types');
  assertSectionOrder(base, 'both table types');
  assertNothingClipped(base, 'both table types');

  assert(
    base.texts[0] === 'SHIVAM ENTERPRISE',
    'the company name is the first printed line'
  );
  const companyRun = base.pages[0].texts[0];
  assert(companyRun.font === 'F4', 'the company name uses the bold-italic face');
  assert(
    base.texts[1] === '2026 - 2027',
    'the financial year prints directly beneath the company name'
  );
  assert(
    base.texts.includes('GSTIN: 24AABCS1234F1Z5'),
    'the real company GSTIN prints on its own left-aligned row'
  );
  assert(
    base.texts.includes('BANK : HDFC Bank Current A/c'),
    'the bank name prints centred and bold on its own row'
  );
  assert(
    base.texts.includes('BANK RECONCILIATION REPORT'),
    'the report title prints in bold italic'
  );
  assert(
    base.texts.includes('FROM: 01-04-2026 TO: 11-11-2026'),
    'the report period prints the actual selected dates'
  );
  const headingRun = base.pages[0].texts.find(
    (run) => run.text === '2. Add : Cheques issued but not presented for payment :-'
  );
  assert(headingRun !== undefined && headingRun.font === 'F4', 'section headings are bold italic');

  section('B. Section 2 - uncleared payments');

  const paymentsOnly = buildDocument({
    payments: [PAYMENT_A, PAYMENT_B],
    paymentTotal: '18,500.00',
    receiptTotal: '0.00',
  });
  assert(
    paymentsOnly.texts.includes('Favouring'),
    'the payments table uses the Favouring column'
  );
  assert(
    paymentsOnly.texts.includes('Cl. Date'),
    'the payments table uses the Cl. Date column'
  );
  assert(
    paymentsOnly.texts.includes('Shree Ganesh Textiles') &&
      paymentsOnly.texts.includes('Rajkot Cotton Traders'),
    'every uncleared payment row prints with its counterparty name'
  );
  assert(
    paymentsOnly.texts.includes('900001') && paymentsOnly.texts.includes('900002'),
    'every uncleared payment row prints its cheque number'
  );
  assert(paymentsOnly.texts.includes('20-05-2026'), 'a recorded clearing date prints in Cl. Date');
  assert(
    paymentsOnly.texts.filter((value) => value === '6,000.00').length === 1 &&
      paymentsOnly.texts.filter((value) => value === '12,500.00').length === 1,
    'payment amounts print right-aligned in Indian grouping'
  );
  assert(
    paymentsOnly.texts.includes('18,500.00'),
    'the payments total prints the correct sum'
  );

  section('C. Section 3 - uncleared receipts');

  const receiptsOnly = buildDocument({
    receipts: [RECEIPT_A, RECEIPT_B],
    receiptTotal: '45,000.00',
  });
  assert(
    receiptsOnly.texts.includes('Received From'),
    'the receipts table uses the Received From column'
  );
  assert(
    receiptsOnly.texts.includes('Mumbai Fashions Pvt Ltd') &&
      receiptsOnly.texts.includes('Surat Weaving House'),
    'every uncleared receipt row prints with its counterparty name'
  );
  assert(
    receiptsOnly.texts.includes('P16-TEMP-R1') && receiptsOnly.texts.includes('P16-TEMP-R2'),
    'every uncleared receipt row prints its cheque or reference number'
  );
  assert(receiptsOnly.texts.includes('45,000.00'), 'the receipts total prints the correct sum');
  const receiptSectionStart = indexOfText(
    receiptsOnly.texts,
    '3. Less : Cheque deposited but not credited :-'
  );
  const clDateIndex = receiptsOnly.texts.indexOf('Cl. Date');
  assert(
    receiptSectionStart >= 0 && clDateIndex >= 0 && clDateIndex < receiptSectionStart,
    'the receipts table omits the clearing-date column, matching the reference'
  );

  section('D. All Clear fallbacks');

  const paymentsClear = buildDocument({
    receipts: [RECEIPT_A],
    receiptTotal: '30,000.00',
  });
  assert(
    paymentsClear.texts.filter((value) => value === 'All Clear').length === 1,
    'All Clear prints once when there are no uncleared payments'
  );
  const clearIndex = indexOfText(paymentsClear.texts, 'All Clear');
  const heading2 = indexOfText(paymentsClear.texts, '2. Add : Cheques issued but not presented for payment :-');
  const heading3 = indexOfText(paymentsClear.texts, '3. Less : Cheque deposited but not credited :-');
  assert(
    clearIndex > heading2 && clearIndex < heading3,
    'the All Clear row sits inside section 2, not section 3'
  );

  const receiptsClear = buildDocument({ payments: [PAYMENT_A], paymentTotal: '6,000.00' });
  assert(
    receiptsClear.texts.filter((value) => value === 'All Clear').length === 1,
    'All Clear prints once when there are no uncleared receipts'
  );
  assert(
    indexOfText(receiptsClear.texts, 'All Clear') > indexOfText(receiptsClear.texts, '3. Less : Cheque deposited but not credited :-'),
    'the All Clear row sits inside section 3'
  );

  const bothClear = buildDocument({});
  assert(
    bothClear.texts.filter((value) => value === 'All Clear').length === 2,
    'both sections print All Clear when nothing is uncleared'
  );
  assert(
    !bothClear.texts.some((value) => /^\d{2}-\d{2}-\d{4}$/.test(value)),
    'no dummy transaction rows are invented when both tables are empty'
  );
  assert(bothClear.texts.includes('0.00'), 'the totals print 0.00 instead of disappearing');

  section('E. Difference handling');

  const balanced = buildDocument({
    statementBalance: '5,34,500.00',
    calculatedBank: '5,34,500.00',
    difference: null,
  });
  assert(
    !balanced.texts.some((value) => value.startsWith('Unreconciled Difference:')),
    'a zero difference prints no warning'
  );

  const unbalanced = buildDocument({
    statementBalance: '5,09,000.00',
    calculatedBank: '5,34,500.00',
    difference: '-25,500.00',
  });
  assert(
    unbalanced.texts.includes('Unreconciled Difference: Rs. -25,500.00'),
    'a non-zero difference prints the exact signed amount below the statement'
  );
  const noteRun = unbalanced.pages[0].texts.find((run) =>
    run.text.startsWith('Unreconciled Difference:')
  );
  const lastBoxRun = unbalanced.pages[0].texts.find((run) => run.text === 'Rs. 5,34,500.00');
  assert(
    noteRun !== undefined && lastBoxRun !== undefined && noteRun.y < lastBoxRun.y,
    'the warning prints below the main statement box'
  );
  assert(
    unbalanced.texts.includes('Rs. 5,09,000.00') &&
      unbalanced.texts.includes('Rs. 5,34,500.00'),
    'the statement balance and calculated closing balance both print unchanged'
  );

  const notEntered = buildDocument({ statementBalance: null });
  assert(
    notEntered.texts.includes('Not entered'),
    'a missing statement balance prints "Not entered" rather than a fake zero'
  );

  section('F. Long company and bank names');

  const longNames = buildDocument({
    companyName:
      'SHREE SIDDHI VINAYAK COTTON AND SYNTHETIC TEXTILE TRADING CORPORATION PRIVATE LIMITED',
    bankName:
      'ICICI Bank Limited - Ring Road Branch - Current Account - 004501234567 - Surat',
    payments: [PAYMENT_A],
    paymentTotal: '6,000.00',
  });
  assertNothingClipped(longNames, 'long names');
  assertMonochrome(longNames, 'long names');
  assert(
    longNames.texts[0].startsWith('SHREE SIDDHI VINAYAK COTTON'),
    'a long company name prints on one line instead of overflowing'
  );
  const bankRun = longNames.pages[0].texts.find((run) => run.text.startsWith('BANK : ICICI Bank Limited'));
  assert(bankRun !== undefined, 'a long bank name prints on its own row');

  section('G. Multi-page behaviour');

  const manyRows: string[][] = [];
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    manyRows.push([
      day + '-05-2026',
      String(900000 + index),
      'Favouring Party Number ' + (index + 1),
      (1000 + index).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      '',
    ]);
  }
  const multi = buildDocument({ payments: manyRows, paymentTotal: '1,27,140.00' });

  assert(multi.pageCount >= 3, 'a 120-row statement paginates across multiple A4 pages');
  assertNothingClipped(multi, 'multi-page');
  assertMonochrome(multi, 'multi-page');
  assertSectionOrder(multi, 'multi-page');

  const headerRepeat = multi.pages.every(
    (page) =>
      page.texts.some((run) => run.text === 'Date') &&
      page.texts.some((run) => run.text === 'Favouring') &&
      page.texts.some((run) => run.text === 'Amount (Rs.)')
  );
  assert(headerRepeat, 'the table header repeats on every page');

  const printedDates = multi.texts.filter((value) => /^\d{2}-05-2026$/.test(value));
  assert(printedDates.length === 120, 'no data row is dropped across page breaks (' + printedDates.length + '/120)');

  const pageLabels = multi.pages.map(
    (page) => page.texts.find((run) => run.text.startsWith('Page '))?.text ?? ''
  );
  assert(
    pageLabels[0] === 'Page 1 of ' + multi.pageCount &&
      pageLabels[multi.pageCount - 1] === 'Page ' + multi.pageCount + ' of ' + multi.pageCount,
    'every page is numbered "Page X of Y"'
  );
  assert(
    multi.pages.every((page) => page.texts.some((run) => run.text.startsWith('Generated '))),
    'every page carries the generated stamp'
  );
}

// ---------------------------------------------------------------------------
// Live integration: the PDF must carry exactly the on-screen figures
// ---------------------------------------------------------------------------

async function runLiveComparison(): Promise<void> {
  section('H. Live scope - PDF matches the on-screen statement');

  const bank = await prisma.ledgerAccount.findFirst({
    where: { isBankAccount: true, isActive: true },
    select: { id: true, companyId: true, accountName: true },
    orderBy: { accountName: 'asc' },
  });
  if (!bank) {
    assert(false, 'a bank ledger exists for the PDF-versus-screen comparison');
    return;
  }

  const financialYear = await prisma.financialYear.findFirst({
    where: { companyId: bank.companyId },
    select: { id: true, yearName: true, startDate: true, endDate: true },
    orderBy: { startDate: 'desc' },
  });
  if (!financialYear) {
    assert(false, 'the bank ledger belongs to a financial year');
    return;
  }

  const query = {
    bankLedgerAccountId: bank.id,
    fromDate: financialYear.startDate.toISOString().slice(0, 10),
    toDate: financialYear.endDate.toISOString().slice(0, 10),
  };

  const statement = await bankReconciliationService.getStatement(
    bank.companyId,
    financialYear.id,
    query
  );
  const exported = await bankReconciliationService.exportPdf(
    bank.companyId,
    financialYear.id,
    query
  );
  const pages = parsePdf(exported.buffer);
  const texts = allText(pages);

  const again = await bankReconciliationService.getStatement(
    bank.companyId,
    financialYear.id,
    query
  );

  assert(exported.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4', 'the live export is a genuine PDF');
  assert(exported.pageCount === pages.length, 'the reported page count matches the rendered pages');
  assert(exported.filename.endsWith('.pdf'), 'the export returns a .pdf filename');

  const money = (value: string): string => formatIndianMoney(value);
  assert(
    texts.includes('Rs. ' + money(statement.summary.closingBookBalance)),
    'section 1 prints the live closing book balance ' + money(statement.summary.closingBookBalance)
  );
  assert(
    texts.includes(money(statement.summary.unclearedPayments)),
    'section 2 prints the live uncleared payment total ' + money(statement.summary.unclearedPayments)
  );
  const receiptTotalMagnitude = money(
    String(Math.abs(Number(statement.summary.unclearedReceipts)))
  );
  assert(
    texts.includes(receiptTotalMagnitude),
    'section 3 prints the live uncleared receipt total ' + receiptTotalMagnitude
  );
  assert(
    statement.summary.statementBalance === null
      ? texts.includes('Not entered')
      : texts.includes('Rs. ' + money(statement.summary.statementBalance)),
    'section 4 prints the live statement balance'
  );
  assert(
    texts.includes('Rs. ' + money(statement.summary.calculatedBankBalance)),
    'section 5 prints the live calculated closing balance ' + money(statement.summary.calculatedBankBalance)
  );

  if (statement.summary.difference !== null && !statement.summary.differenceIsZero) {
    assert(
      texts.includes('Unreconciled Difference: Rs. ' + money(statement.summary.difference)),
      'the live unreconciled difference prints with its exact signed value'
    );
  } else {
    assert(
      !texts.some((value) => value.startsWith('Unreconciled Difference:')),
      'a balanced live statement prints no difference warning'
    );
  }

  const missingPayments = statement.paymentRows.filter(
    (row) =>
      !texts.includes(row.chequeNo || '') ||
      !texts.includes(row.favouring) ||
      !texts.includes(money(row.amount))
  );
  assert(
    missingPayments.length === 0,
    'all ' + statement.paymentRows.length + ' live uncleared payment rows print verbatim'
  );

  const missingReceipts = statement.receiptRows.filter(
    (row) =>
      !texts.includes(row.chequeNo || '') ||
      !texts.includes(row.receivedFrom) ||
      !texts.includes(money(row.amount))
  );
  assert(
    missingReceipts.length === 0,
    'all ' + statement.receiptRows.length + ' live uncleared receipt rows print verbatim'
  );

  assert(
    texts.includes('BANK : ' + bank.accountName),
    'the live bank book name prints in the header'
  );
  assert(texts.includes('2026 - 2027') || texts.includes(financialYear.yearName), 'the live financial year prints');

  assert(
    JSON.stringify(again.summary) === JSON.stringify(statement.summary),
    'generating the PDF leaves every reconciliation figure unchanged'
  );
  assert(
    JSON.stringify(again.paymentRows) === JSON.stringify(statement.paymentRows) &&
      JSON.stringify(again.receiptRows) === JSON.stringify(statement.receiptRows),
    'generating the PDF leaves every printed row unchanged'
  );

  assertNothingClipped({ buffer: exported.buffer, pageCount: pages.length, pages, texts }, 'live scope');
  assertMonochrome({ buffer: exported.buffer, pageCount: pages.length, pages, texts }, 'live scope');
}

async function main(): Promise<void> {
  console.log('Phase 16.1 - Bank Reconciliation Statement PDF format tests\n');
  runScenarios();
  await runLiveComparison();

  console.log('\n=======================================================');
  console.log('RESULT: ' + (total - failed) + '/' + total + ' assertions passed');
  console.log('=======================================================');
  await prisma.$disconnect();
  if (failed > 0) process.exitCode = 1;
}

void main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});