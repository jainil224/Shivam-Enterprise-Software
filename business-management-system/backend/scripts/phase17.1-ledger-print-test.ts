// Phase 17.1 - Account Ledger print document test suite.
// Pure formatter tests: the PDF builder receives synthetic rows and is checked
// byte for byte. No database record is created, changed or read here.

import {
  buildAccountLedgerPrintPdf,
  type LedgerPrintColumn,
  type LedgerPrintRow,
} from '../src/utils/ledgerPrintPdf.js';
// The preview layout module is imported directly so this suite proves the
// on-screen sheets and the PDF break on the same rows.
import { PRINT_COLUMNS, buildLedgerDocument } from '../../frontend/src/pages/ledgerPrintLayout';

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string): void {
  total += 1;
  if (condition) {
    passed += 1;
    console.log('  PASS [' + total + ']: ' + msg);
  } else {
    console.log('  FAIL [' + total + ']: ' + msg);
    throw new Error('Assertion failed: ' + msg);
  }
}

const COLUMNS: LedgerPrintColumn[] = [
  { key: 'date', label: 'Date', width: 11, align: 'left' },
  { key: 'voucherRef', label: 'Vch No / Chq No', width: 13, align: 'left' },
  { key: 'type', label: 'Type', width: 7, align: 'left' },
  { key: 'bookName', label: 'Book Name', width: 26, align: 'left' },
  { key: 'debit', label: 'Debit', width: 13, align: 'right' },
  { key: 'credit', label: 'Credit', width: 13, align: 'right' },
  { key: 'balance', label: 'Balance', width: 12, align: 'right' },
  { key: 'sign', label: 'Sign', width: 5, align: 'center' },
];

/** Every literal text run written into the PDF content streams. */
function textRuns(buffer: Buffer): string[] {
  const raw = buffer.toString('latin1');
  const runs: string[] = [];
  const pattern = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    runs.push(
      match[1]
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(parseInt(octal, 8)))
    );
  }
  return runs;
}

function pageCount(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

function mediaBox(buffer: Buffer): string | null {
  const match = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(buffer.toString('latin1'));
  return match ? match[1] + ' x ' + match[2] : null;
}

const countRun = (runs: string[], value: string): number =>
  runs.filter((run) => run === value).length;

function buildRows(): LedgerPrintRow[] {
  return Array.from({ length: 45 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, '0');
    return {
      date: day + '-05-2026',
      voucherLines: [
        'BR-2026-' + String(index + 1).padStart(4, '0'),
        index % 3 === 0 ? 'CHQ-' + (9100 + index) : '',
      ],
      type: 'Bank Receipt',
      bookLines: [
        'Bank Receipt',
        'Counterparty ' + (index + 1),
        index % 5 === 0
          ? 'A long narration line that must wrap across several lines without clipping any words from the printed document at all.'
          : 'Short narration ' + (index + 1),
      ],
      debit: '',
      credit: '1,00,000.00',
      balance: '1,00,000.00',
      sign: 'Dr',
    };
  });
}

function buildLongDocument() {
  return buildAccountLedgerPrintPdf({
    companyName: 'SHIVAM ENTERPRISE SOFTWARE PRIVATE LIMITED WITH A LONG REGISTERED NAME',
    companyAddress:
      'Unit 402, 4th Floor, Sunrise Business Park, LBS Marg, Vikhroli West, Mumbai, Maharashtra, 400079',
    companyPhone: '022 4567 8900',
    companyGstin: '27AABCS9999F1Z1',
    financialYear: '2026 - 2027',
    fromDate: '01-04-2026',
    toDate: '31-03-2027',
    ledgerName: 'A Very Long Customer Ledger Name For Wrapping Checks Pvt Ltd',
    ledgerCode: 'PL-OTCUST01',
    ledgerGstin: '27AABCM9012J1Z9',
    ledgerPan: 'AABCM9012J',
    schedule: 'SUNDRY DEBTORS',
    columns: COLUMNS,
    opening: { date: '', amount: '18,500.00', nature: 'Dr' },
    rows: buildRows(),
    totals: { debit: '0.00', credit: '45,00,000.00', balance: '45,18,500.00', nature: 'Dr' },
  });
}

function main(): void {
  console.log('\n--- A. Traditional Account Ledger print document ---');
  const document = buildLongDocument();
  const runs = textRuns(document.buffer);
  const all = runs.join('\n');
  const pages = pageCount(document.buffer);

  assert(document.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4', 'the print document is a genuine PDF 1.4 file');
  assert(mediaBox(document.buffer) === '595.28 x 841.89', 'the print document is A4 portrait');
  assert(pages >= 2 && document.pageCount === pages, 'a long ledger produces multiple pages and reports the same page count');

  assert(all.includes('SHIVAM ENTERPRISE SOFTWARE') && all.includes('REGISTERED'), 'a long company name wraps inside the header instead of being clipped');
  assert(all.includes('2026 - 2027'), 'the financial year prints in the header');
  assert(all.includes('Phone : 022 4567 8900'), 'the company phone prints when recorded');
  assert(all.includes('GSTIN : 27AABCS9999F1Z1'), 'the company GSTIN prints in the header');
  assert(all.includes('ACCOUNT LEDGER'), 'the centred ACCOUNT LEDGER title prints');

  assert(all.includes('A Very Long Customer Ledger') && all.includes('Wrapping Checks'), 'the selected ledger name prints in its own row');
  assert(all.includes('PL-OTCUST01'), 'the selected ledger code prints beside its name');
  assert(all.includes('GST No. : 27AABCM9012J1Z9'), 'the party GST number prints in the metadata row');
  assert(all.includes('PAN No. : AABCM9012J'), 'the party PAN prints in the metadata row');
  assert(all.includes('Schedule : SUNDRY DEBTORS'), 'the ledger schedule prints in the metadata row');

  assert(all.includes('VCH NO /') && all.includes('CHQ NO'), 'the combined Vch No / Chq No column header prints on two lines');
  assert(all.includes('BOOK NAME') && all.includes('DEBIT') && all.includes('CREDIT') && all.includes('BALANCE') && all.includes('SIGN'), 'every remaining table header prints');

  assert(countRun(runs, 'Opening Balance') === 1, 'the opening balance row prints exactly once');
  assert(countRun(runs, 'Total') === 1, 'the totals row prints only at the final position');
  assert(all.includes('45,00,000.00') && all.includes('45,18,500.00'), 'the totals row carries the full-period debit, credit and closing balance');

  assert(countRun(runs, 'ACCOUNT LEDGER') === pages, 'the company header repeats on every page');
  assert(all.includes('Page 1 of ' + pages) && all.includes('Page ' + pages + ' of ' + pages), 'every page carries the correct Page X of Y number');
  assert(!/Generated/i.test(all), 'the document has no Generated footer');

  const vouchers = buildRows().map((row) => row.voucherLines[0]);
  assert(vouchers.every((voucher) => countRun(runs, voucher) === 1), 'no transaction row is omitted or duplicated across pages');
  assert(all.includes('10-05-2026'), 'the date prints on one line');
  assert(all.includes('BR-2026-0001') && all.includes('CHQ-9100'), 'the voucher and cheque numbers print inside the combined column');
  // Wrapped lines are separate text runs, so the narration is compared as one
  // flattened sentence: every word must survive the wrap, in the original order.
  const flat = runs.join(' ').replace(/\s+/g, ' ');
  assert(
    flat.includes('A long narration line that must wrap across several lines without clipping any words from the printed document at all.'),
    'a long narration wraps without losing words'
  );

  console.log('\n--- B. Ledger without GSTIN or PAN ---');
  const blank = buildAccountLedgerPrintPdf({
    companyName: 'OTHER TEXTILES LTD',
    companyAddress: 'Mumbai, Maharashtra',
    companyPhone: null,
    companyGstin: '27AABCS9999F1Z1',
    financialYear: '2026 - 2027',
    fromDate: '01-04-2026',
    toDate: '11-11-2026',
    ledgerName: 'HDFC Bank Current A/c',
    ledgerCode: 'BANK-HDFC',
    ledgerGstin: null,
    ledgerPan: null,
    schedule: 'BANK',
    columns: COLUMNS,
    opening: { date: '', amount: '5,00,000.00', nature: 'Dr' },
    rows: [
      {
        date: '10-05-2026',
        voucherLines: ['BP-2026-0003', 'CHQ-9001'],
        type: 'Bank Payment',
        bookLines: ['Bank Payment', 'P16 TEMP Supplier', 'Payment by cheque'],
        debit: '6,000.00',
        credit: '',
        balance: '4,94,000.00',
        sign: 'Dr',
      },
    ],
    totals: { debit: '6,000.00', credit: '0.00', balance: '4,94,000.00', nature: 'Dr' },
  });
  const blankRuns = textRuns(blank.buffer);
  const blankText = blankRuns.join('\n');
  assert(pageCount(blank.buffer) === 1 && blankText.includes('Page 1 of 1'), 'a short ledger prints exactly one page numbered Page 1 of 1');
  assert(blankRuns.some((run) => run.trim() === 'GST No. :') && blankRuns.some((run) => run.trim() === 'PAN No. :'), 'a ledger without a party prints blank GST and PAN labels');
  assert(!/Not recorded|N\/A|undefined|null/i.test(blankText), 'no placeholder or undefined value is fabricated');
  assert(blankText.includes('Schedule : BANK'), 'the bank ledger schedule prints as BANK');
  assert(blankText.includes('Opening Balance') && blankText.includes('Total'), 'the short ledger still prints its opening row and totals');

  console.log('\n--- C. Preview and PDF page parity ---');
  const PARITY_COLUMNS: LedgerPrintColumn[] = PRINT_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
    width: column.width,
    align: column.align,
  }));

  const parityRows = (count: number, longNarration: boolean) =>
    Array.from({ length: count }, (_, index) => ({
      journalLineId: 'line-' + index,
      sourceType: 'RECEIPT' as const,
      sourceId: 'source-' + index,
      date: String((index % 28) + 1).padStart(2, '0') + '-05-2026',
      voucherNo: 'BR-2026-' + String(index + 1).padStart(4, '0'),
      chequeNo: index % 3 === 0 ? 'CHQ-' + (9100 + index) : '',
      type: 'Bank Receipt',
      bookName: 'Bank Receipt',
      accountName: 'Counterparty ' + (index + 1),
      particulars: longNarration
        ? 'A deliberately long narration that wraps across several lines inside the wide Book Name column so the row grows taller and forces real page breaks across the document.'
        : 'Short narration ' + (index + 1),
      referenceNo: '',
      debit: '',
      credit: '1,00,000.00',
      balance: '1,00,000.00',
      sign: 'Dr' as const,
    }));

  /** Voucher numbers printed on each PDF page, read back from the content streams. */
  const pdfRowsPerPage = (buffer: Buffer): number[] => {
    const perPage: number[] = [];
    let current = 0;
    let started = false;
    for (const run of textRuns(buffer)) {
      if (/^Page \d+ of \d+$/.test(run)) {
        if (started) perPage.push(current);
        started = true;
        current = 0;
        continue;
      }
      if (started && /^BR-2026-\d{4}$/.test(run)) current += 1;
    }
    if (started) perPage.push(current);
    return perPage;
  };

  const parityCase = (label: string, count: number, longNarration: boolean): void => {
    const rows = parityRows(count, longNarration);
    const pdf = buildAccountLedgerPrintPdf({
      companyName: 'SHIVAM ENTERPRISE SOFTWARE PRIVATE LIMITED WITH A LONG REGISTERED NAME',
      companyAddress:
        'Unit 402, 4th Floor, Sunrise Business Park, LBS Marg, Vikhroli West, Mumbai, Maharashtra, 400079',
      companyPhone: '022 4567 8900',
      companyGstin: '27AABCS9999F1Z1',
      financialYear: '2026 - 2027',
      fromDate: '01-04-2026',
      toDate: '31-03-2027',
      ledgerName: 'A Very Long Customer Ledger Name For Wrapping Checks Pvt Ltd',
      ledgerCode: 'PL-OTCUST01',
      ledgerGstin: '27AABCM9012J1Z9',
      ledgerPan: 'AABCM9012J',
      schedule: 'SUNDRY DEBTORS',
      columns: PARITY_COLUMNS,
      opening: { date: '', amount: '18,500.00', nature: 'Dr' },
      rows: rows.map((row) => ({
        date: row.date,
        voucherLines: [row.voucherNo, row.chequeNo || row.referenceNo].filter((value) => value.length > 0),
        type: row.type,
        bookLines: [row.bookName, row.accountName, row.particulars].filter((value) => value.length > 0),
        debit: row.debit,
        credit: row.credit,
        balance: row.balance,
        sign: row.sign,
      })),
      totals: { debit: '0.00', credit: '45,00,000.00', balance: '45,18,500.00', nature: 'Dr' },
    });

    const preview = buildLedgerDocument({
      meta: {
        companyName: 'SHIVAM ENTERPRISE SOFTWARE PRIVATE LIMITED WITH A LONG REGISTERED NAME',
        companyAddress:
          'Unit 402, 4th Floor, Sunrise Business Park, LBS Marg, Vikhroli West, Mumbai, Maharashtra, 400079',
        companyPhone: '022 4567 8900',
        companyGstin: '27AABCS9999F1Z1',
        financialYear: '2026 - 2027',
        ledgerAccountId: 'ledger-1',
        accountCode: 'PL-OTCUST01',
        accountName: 'A Very Long Customer Ledger Name For Wrapping Checks Pvt Ltd',
        accountGroup: 'SUNDRY_DEBTORS',
        accountType: 'ASSET',
        ledgerGstin: '27AABCM9012J1Z9',
        ledgerPan: 'AABCM9012J',
        schedule: 'SUNDRY DEBTORS',
        fromDate: '2026-04-01',
        toDate: '2027-03-31',
      },
      opening: { date: '2026-04-01', amount: '18,500.00', nature: 'Dr', signedAmount: '18500.00' },
      rows,
      totals: {
        debitTotal: '0.00',
        creditTotal: '45,00,000.00',
        closingBalance: '45,18,500.00',
        closingNature: 'Dr',
        transactionCount: rows.length,
      },
      columns: PRINT_COLUMNS.map((column) => ({
        key: column.key,
        label: column.label,
        type: 'text',
        align: column.align,
        weight: column.width,
      })),
      totalRows: rows.length,
      page: 1,
      pageSize: 500,
      generatedAt: new Date().toISOString(),
    } as unknown as Parameters<typeof buildLedgerDocument>[0]);

    const pdfRows = pdfRowsPerPage(pdf.buffer);
    const previewRows = preview.sheets.map(
      (sheet) => sheet.rows.filter((row) => row.key !== 'opening-balance').length
    );
    assert(
      preview.sheets.length === pdf.pageCount &&
        previewRows.length === pdfRows.length &&
        previewRows.every((value, index) => value === pdfRows[index]),
      label +
        ': the preview and the PDF use the same pages and the same rows per page (pages ' +
        pdf.pageCount +
        ', rows ' +
        JSON.stringify(pdfRows) +
        ')'
    );
  };

  parityCase('a long multi-page ledger', 45, true);
  parityCase('a dense single-line ledger', 70, false);
  parityCase('a ledger that just overflows one page', 6, true);

  console.log('\n========================================');
  console.log('Phase 17.1 print suite: ' + passed + '/' + total + ' assertions passed');
  console.log('========================================');
}

main();