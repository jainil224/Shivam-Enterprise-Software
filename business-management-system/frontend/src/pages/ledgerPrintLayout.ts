// Phase 17.1 - print layout mirror.
//
// The on-screen A4 sheets and the downloaded PDF must break on exactly the same
// rows, so this module reproduces the geometry of
// backend/src/utils/ledgerPrintPdf.ts: same page margins, same column
// percentages, same greedy word wrap, same row heights and the same pagination
// loop. Only pure layout lives here - every amount still comes from the report
// response, never from a recalculation.

import type { AccountLedgerReportResult, AccountLedgerRow } from '../types/ledgerReports';

export interface PrintColumn {
  key: string;
  label: string;
  /** Percentage of the printable width. */
  width: number;
  align: 'left' | 'right' | 'center';
}

/** Column order and widths, identical to the PDF catalogue. */
export const PRINT_COLUMNS: PrintColumn[] = [
  { key: 'date', label: 'Date', width: 11, align: 'left' },
  { key: 'voucherRef', label: 'Vch No / Chq No', width: 13, align: 'left' },
  { key: 'type', label: 'Type', width: 7, align: 'left' },
  { key: 'bookName', label: 'Book Name', width: 26, align: 'left' },
  { key: 'debit', label: 'Debit', width: 13, align: 'right' },
  { key: 'credit', label: 'Credit', width: 13, align: 'right' },
  { key: 'balance', label: 'Balance', width: 12, align: 'right' },
  { key: 'sign', label: 'Sign', width: 5, align: 'center' },
];

// A4 portrait geometry in points, copied from the PDF builder.
export const PAGE_WIDTH_PT = 595.28;
export const PAGE_HEIGHT_PT = 841.89;
export const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - 38;
export const CONTENT_TOP_PT = PAGE_HEIGHT_PT - 19;
export const CONTENT_BOTTOM_PT = 19;

export const BODY_PT = 9;
export const SMALL_PT = 8.5;
export const LINE_PT = 11;
export const ROW_PADDING_PT = 4;
export const MIN_ROW_PT = 15;
export const TOTALS_PT = 17;

/** Points to CSS pixels at the 96 dpi A4 scale used by the preview sheet. */
export const PT_TO_PX = 96 / 72;

const NUMERIC_KEYS = new Set(['debit', 'credit', 'balance']);

const maxChars = (widthPt: number, sizePt: number): number =>
  Math.max(1, Math.floor((widthPt - 6) / (sizePt * 0.6)));

/** Greedy word wrap with the same hard-chunk fallback as the PDF writer. */
export function wrapPrintText(text: string, limit: number): string[] {
  const clean = String(text ?? '').trim();
  if (clean.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of clean.split(/\s+/)) {
    if (current.length === 0) current = word;
    else if ((current + ' ' + word).length <= limit) current = current + ' ' + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= limit) return [line];
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += limit) {
      chunks.push(line.slice(index, index + limit));
    }
    return chunks;
  });
}

const lineLimitFor = (key: string): number => {
  if (key === 'bookName') return 8;
  if (key === 'voucherRef') return 2;
  return 1;
};

const cellLines = (
  values: string[],
  widthPt: number,
  limit: number,
  numeric: boolean
): string[] => {
  if (numeric) {
    const single = values.map((value) => String(value ?? '').trim()).find((value) => value.length > 0);
    return single ? [single] : [];
  }
  const lines: string[] = [];
  for (const value of values) {
    const clean = String(value ?? '').trim();
    if (clean.length === 0) continue;
    for (const wrapped of wrapPrintText(clean, maxChars(widthPt, BODY_PT))) {
      lines.push(wrapped);
      if (lines.length >= limit) return lines;
    }
  }
  return lines;
};

/** Voucher number first; cheque or reference number as the second line. */
const voucherLines = (row: AccountLedgerRow): string[] =>
  [row.voucherNo, row.chequeNo || row.referenceNo].filter(
    (value) => Boolean(value) && value.trim().length > 0
  );

/** Book description, counterparty and stored narration, one per line. */
const bookLines = (row: AccountLedgerRow): string[] =>
  [row.bookName, row.accountName, row.particulars].filter(
    (value) => Boolean(value) && value.trim().length > 0
  );

const rawLines = (row: AccountLedgerRow): string[][] =>
  PRINT_COLUMNS.map((column) => {
    switch (column.key) {
      case 'date':
        return [row.date];
      case 'voucherRef':
        return voucherLines(row);
      case 'type':
        return [row.type];
      case 'bookName':
        return bookLines(row);
      case 'debit':
        return [row.debit];
      case 'credit':
        return [row.credit];
      case 'balance':
        return [row.balance];
      case 'sign':
        return [row.sign];
      default:
        return [''];
    }
  });

export interface SheetRow {
  key: string;
  lines: string[][];
  heightPt: number;
  bold: boolean;
}

export interface LedgerSheet {
  rows: SheetRow[];
  showTotals: boolean;
}

export interface LedgerChrome {
  companyNameLines: string[];
  addressLines: string[];
  ledgerNameLines: string[];
  headLines: string[][];
  row1Pt: number;
  row2Pt: number;
  row3Pt: number;
  row4Pt: number;
  ledgerRowPt: number;
  metaRowPt: number;
  headPt: number;
  bodyTopPt: number;
}

const prepareRow = (
  row: AccountLedgerRow,
  widthsPt: number[],
  bold: boolean,
  key: string
): SheetRow => {
  const lines = rawLines(row).map((entry, index) =>
    cellLines(
      entry,
      widthsPt[index],
      lineLimitFor(PRINT_COLUMNS[index].key),
      NUMERIC_KEYS.has(PRINT_COLUMNS[index].key)
    )
  );
  const lineCount = Math.max(1, ...lines.map((entry) => entry.length));
  return {
    key,
    lines,
    heightPt: Math.max(MIN_ROW_PT, lineCount * LINE_PT + ROW_PADDING_PT * 2),
    bold,
  };
};

export interface LedgerDocument {
  chrome: LedgerChrome;
  sheets: LedgerSheet[];
  widthsPt: number[];
}

/**
 * Reproduces the PDF builder's header measurement and page-break loop so the
 * preview page count and row grouping are identical to the downloaded file.
 */
export function buildLedgerDocument(
  result: AccountLedgerReportResult,
  columns: PrintColumn[] = PRINT_COLUMNS
): LedgerDocument {
  const totalWeight = columns.reduce((sum, column) => sum + Math.max(1, column.width), 0);
  const widthsPt = columns.map(
    (column) => (CONTENT_WIDTH_PT * Math.max(1, column.width)) / totalWeight
  );

  const nameWidth = CONTENT_WIDTH_PT * 0.62;
  const companyNameLines = wrapPrintText(
    result.meta.companyName,
    maxChars(nameWidth, 15)
  ).slice(0, 3);
  const addressLines = result.meta.companyAddress
    ? wrapPrintText(result.meta.companyAddress, maxChars(CONTENT_WIDTH_PT - 8, SMALL_PT)).slice(0, 2)
    : [];
  const ledgerNameWidth = CONTENT_WIDTH_PT * 0.72;
  const ledgerNameLines = wrapPrintText(
    result.meta.accountName,
    maxChars(ledgerNameWidth, 11)
  ).slice(0, 2);

  const headLines = columns.map((column, index) => {
    const label = column.label.toUpperCase();
    if (label.includes(' / ')) {
      const [left, right] = label.split(' / ');
      return [left + ' /', right];
    }
    return wrapPrintText(label, maxChars(widthsPt[index], SMALL_PT)).slice(0, 2);
  });
  const headLineCount = Math.max(1, ...headLines.map((lines) => lines.length));

  const row1Pt = Math.max(28, companyNameLines.length * 17 + 8);
  const row2Pt = addressLines.length > 0 ? addressLines.length * 11 + 8 : 14;
  const row3Pt = 38;
  const row4Pt = 25;
  const ledgerRowPt = Math.max(21, ledgerNameLines.length * 13 + 8);
  const metaRowPt = 17;
  const headPt = Math.max(18, headLineCount * 10 + 6);
  const bodyTopPt =
    CONTENT_TOP_PT - (row1Pt + row2Pt + row3Pt + row4Pt) - ledgerRowPt - metaRowPt - headPt;

  const openingRow: AccountLedgerRow = {
    journalLineId: 'opening-balance',
    sourceType: 'RECEIPT',
    sourceId: 'opening-balance',
    date: '',
    voucherNo: '',
    accountName: '',
    particulars: '',
    chequeNo: '',
    referenceNo: '',
    type: '',
    bookName: 'Opening Balance',
    debit: '',
    credit: '',
    balance: result.opening.amount,
    sign: result.opening.nature,
  };

  const prepared: SheetRow[] = [
    prepareRow(openingRow, widthsPt, true, 'opening-balance'),
    ...result.rows.map((row, index) => prepareRow(row, widthsPt, false, row.journalLineId + '-' + index)),
  ];

  const pages: SheetRow[][] = [];
  let page: SheetRow[] = [];
  let y = bodyTopPt;
  prepared.forEach((row, index) => {
    const reserve = index === prepared.length - 1 ? TOTALS_PT : 0;
    if (y - row.heightPt - reserve < CONTENT_BOTTOM_PT) {
      pages.push(page);
      page = [];
      y = bodyTopPt;
    }
    page.push(row);
    y -= row.heightPt;
  });
  if (y - TOTALS_PT < CONTENT_BOTTOM_PT) {
    pages.push(page);
    page = [];
    y = bodyTopPt;
  }
  pages.push(page);

  const chrome: LedgerChrome = {
    companyNameLines,
    addressLines,
    ledgerNameLines,
    headLines,
    row1Pt,
    row2Pt,
    row3Pt,
    row4Pt,
    ledgerRowPt,
    metaRowPt,
    headPt,
    bodyTopPt,
  };

  return {
    chrome,
    widthsPt,
    sheets: pages.map((rows, index) => ({
      rows,
      showTotals: index === pages.length - 1,
    })),
  };
}

