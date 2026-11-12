// Phase 17.1 - traditional Account Ledger print document.
//
// Renders the classic accounting sheet requested for the Account Ledger: a boxed
// company header (name / financial year / address / phone / page / period /
// GSTIN), the selected ledger row, the GSTIN-PAN-Schedule row, one combined
// "Vch No / Chq No" column, debit/credit/running balance and a full-page outer
// border. It is a pure formatter: every value comes from the report service, so
// no accounting figure is recalculated here.

import {
  COURIER_ADVANCE,
  PAGE_SIZES,
  fitText,
  serializePdfPages,
  textWidth,
  winAnsi,
  wrapText,
  type PageOps,
  type PdfAlign,
} from './pdfWriter.js';

export interface LedgerPrintColumn {
  key: string;
  label: string;
  /** Relative width; normalised to the printable width. */
  width: number;
  align: PdfAlign;
}

export interface LedgerPrintRow {
  date: string;
  /** Voucher number on the first line, cheque/reference on the second. */
  voucherLines: string[];
  type: string;
  /** Book description, counterparty and particulars, one per line. */
  bookLines: string[];
  debit: string;
  credit: string;
  balance: string;
  sign: string;
}

export interface LedgerPrintOptions {
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyGstin: string | null;
  financialYear: string;
  fromDate: string;
  toDate: string;
  ledgerName: string;
  ledgerCode: string | null;
  ledgerGstin: string | null;
  ledgerPan: string | null;
  schedule: string | null;
  columns: LedgerPrintColumn[];
  opening: { date: string; amount: string; nature: string };
  rows: LedgerPrintRow[];
  totals: { debit: string; credit: string; balance: string; nature: string };
}

export interface LedgerPrintResult {
  buffer: Buffer;
  pageCount: number;
}

const PAGE = PAGE_SIZES.portrait;
const OUTER = 12;
const PAD = 7;
const BORDER = 0.6;
const BLACK: [number, number, number] = [0, 0, 0];
const NAVY: [number, number, number] = [0.05, 0.12, 0.35];
const BODY = 9;
const SMALL = 8.5;
const LINE = 11;
const ROW_PADDING = 4;
const MIN_ROW = 15;
const TOTALS_HEIGHT = 17;

const CONTENT_LEFT = OUTER + PAD;
const CONTENT_WIDTH = PAGE.width - (OUTER + PAD) * 2;
const CONTENT_TOP = PAGE.height - OUTER - PAD;
const CONTENT_BOTTOM = OUTER + PAD;

/** Characters that fit a cell without clipping at the given size. */
const maxChars = (width: number, size: number): number =>
  Math.max(1, Math.floor((width - 6) / (size * COURIER_ADVANCE)));

/** Baseline of one text line whose box starts at boxTop. */
const lineBaseline = (boxTop: number, size: number): number => boxTop - size * 0.9;

const rect = (ops: PageOps, x: number, y: number, width: number, height: number): void => {
  ops.rects.push({ x, y, width, height, fill: BLACK });
};

const frame = (ops: PageOps, x: number, top: number, width: number, height: number): void => {
  rect(ops, x, top - BORDER, width, BORDER);
  rect(ops, x, top - height, width, BORDER);
  rect(ops, x, top - height, BORDER, height);
  rect(ops, x + width - BORDER, top - height, BORDER, height);
};

const vrule = (ops: PageOps, x: number, top: number, height: number): void => {
  rect(ops, x, top - height, BORDER, height);
};

const hrule = (ops: PageOps, x: number, y: number, width: number): void => {
  rect(ops, x, y - BORDER, width, BORDER);
};

const drawAligned = (
  ops: PageOps,
  value: string,
  x: number,
  width: number,
  baseline: number,
  size: number,
  align: PdfAlign,
  bold: boolean,
  italic = false,
  color: [number, number, number] = BLACK
): void => {
  const clean = winAnsi(String(value ?? '')).trim();
  if (clean.length === 0) return;
  const fitted = fitText(clean, maxChars(width, size));
  const textW = textWidth(fitted, size);
  const tx =
    align === 'right'
      ? x + width - 3 - textW
      : align === 'center'
        ? x + Math.max(3, (width - textW) / 2)
        : x + 3;
  ops.texts.push({ x: tx, y: baseline, text: fitted, size, bold, italic, color });
};

/** Money columns never wrap: a wrapped amount would silently lose digits. */
const NUMERIC_KEYS = new Set(['debit', 'credit', 'balance']);
const MIN_NUMERIC = 7;

const fitsWidth = (value: string, width: number, size: number): boolean =>
  textWidth(winAnsi(value), size) <= width - 6;

/**
 * Largest font, starting at the body size, that still fits the cell. Money is
 * the one thing a ledger may never clip, so it shrinks to 7pt instead of being
 * truncated when the amount is very large.
 */
const fitSize = (value: string, width: number, size = BODY): number => {
  let current = size;
  while (current > MIN_NUMERIC && !fitsWidth(value, width, current)) current -= 0.5;
  return current;
};

/** Wraps one cell's logical lines into the printed lines of that cell. */
const cellLines = (values: string[], width: number, limit: number, numeric: boolean): string[] => {
  if (numeric) {
    const single = values.map((value) => String(value ?? '').trim()).find((value) => value.length > 0);
    return single ? [single] : [];
  }
  const lines: string[] = [];
  for (const value of values) {
    const clean = String(value ?? '').trim();
    if (clean.length === 0) continue;
    for (const wrapped of wrapText(clean, maxChars(width, BODY))) {
      lines.push(wrapped);
      if (lines.length >= limit) return lines;
    }
  }
  return lines;
};

const lineLimitFor = (key: string): number => {
  if (key === 'bookName') return 8;
  if (key === 'voucherRef') return 2;
  return 1;
};

interface PreparedRow {
  lines: string[][];
  height: number;
  bold: boolean;
}

export function buildAccountLedgerPrintPdf(options: LedgerPrintOptions): LedgerPrintResult {
  const addressLines = options.companyAddress
    ? wrapText(options.companyAddress, maxChars(CONTENT_WIDTH - 8, SMALL)).slice(0, 2)
    : [];

  const columns: LedgerPrintColumn[] =
    options.columns.length > 0
      ? options.columns
      : [{ key: 'bookName', label: 'Book Name', width: 100, align: 'left' }];
  const totalWeight = columns.reduce((sum, column) => sum + Math.max(1, column.width), 0);
  const widths = columns.map((column) => (CONTENT_WIDTH * Math.max(1, column.width)) / totalWeight);
  const columnX = (index: number): number =>
    CONTENT_LEFT + widths.slice(0, index).reduce((sum, width) => sum + width, 0);

  // A long company name wraps inside row 1 instead of being clipped.
  const nameWidth = CONTENT_WIDTH * 0.62;
  const companyNameLines = wrapText(options.companyName, maxChars(nameWidth, 15)).slice(0, 3);
  const row1 = Math.max(28, companyNameLines.length * 17 + 8);
  const row2 = addressLines.length > 0 ? addressLines.length * 11 + 8 : 14;
  const row3 = 38;
  const row4 = 25;
  const headerHeight = row1 + row2 + row3 + row4;
  const ledgerNameWidth = CONTENT_WIDTH * 0.72;
  const ledgerNameLines = wrapText(options.ledgerName, maxChars(ledgerNameWidth, 11)).slice(0, 2);
  const ledgerRowHeight = Math.max(21, ledgerNameLines.length * 13 + 8);
  const metaRowHeight = 17;

  // Column headers wrap as well, so "VCH NO / CHQ NO" stays fully readable.
  // Labels with a slash break at the slash, giving the traditional two-line head.
  const headLines = columns.map((column, index) => {
    const label = column.label.toUpperCase();
    if (label.includes(' / ')) {
      const [left, right] = label.split(' / ');
      return [left + ' /', right];
    }
    return wrapText(label, maxChars(widths[index], SMALL)).slice(0, 2);
  });
  const headLineCount = Math.max(1, ...headLines.map((lines) => lines.length));
  const tableHeadHeight = Math.max(18, headLineCount * 10 + 6);
  const bodyTop = CONTENT_TOP - headerHeight - ledgerRowHeight - metaRowHeight - tableHeadHeight;

  const rawLines = (row: LedgerPrintRow): string[][] =>
    columns.map((column) => {
      switch (column.key) {
        case 'date':
          return [row.date];
        case 'voucherRef':
          return row.voucherLines;
        case 'type':
          return [row.type];
        case 'bookName':
          return row.bookLines;
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

  const prepare = (row: LedgerPrintRow, bold: boolean): PreparedRow => {
    const lines = rawLines(row).map((entry, index) =>
      cellLines(
        entry,
        widths[index],
        lineLimitFor(columns[index].key),
        NUMERIC_KEYS.has(columns[index].key)
      )
    );
    const lineCount = Math.max(1, ...lines.map((entry) => entry.length));
    return {
      lines,
      height: Math.max(MIN_ROW, lineCount * LINE + ROW_PADDING * 2),
      bold,
    };
  };

  const openingRow = prepare(
    {
      date: options.opening.date,
      voucherLines: [],
      type: '',
      bookLines: ['Opening Balance'],
      debit: '',
      credit: '',
      balance: options.opening.amount,
      sign: options.opening.nature,
    },
    true
  );

  const prepared: PreparedRow[] = [openingRow, ...options.rows.map((row) => prepare(row, false))];

  const drawHeader = (ops: PageOps, pageIndex: number, totalPages: number): void => {
    let top = CONTENT_TOP;
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, headerHeight);

    // Row 1 - company name (left, wraps) and financial year (right).
    const nameBoxTop = top - (row1 - companyNameLines.length * 17) / 2;
    companyNameLines.forEach((line, index) => {
      drawAligned(ops, line, CONTENT_LEFT, nameWidth, lineBaseline(nameBoxTop - index * 17, 15), 15, 'left', true);
    });
    drawAligned(ops, options.financialYear, CONTENT_LEFT + nameWidth, CONTENT_WIDTH - nameWidth, lineBaseline(top - (row1 - 13) / 2, 13), 13, 'right', true);
    top -= row1;
    hrule(ops, CONTENT_LEFT, top, CONTENT_WIDTH);

    // Row 2 - full company address.
    if (addressLines.length > 0) {
      const boxTop = top - (row2 - addressLines.length * LINE) / 2;
      addressLines.forEach((line, index) => {
        drawAligned(ops, line, CONTENT_LEFT, CONTENT_WIDTH, lineBaseline(boxTop - index * LINE, SMALL), SMALL, 'left', false);
      });
    }
    top -= row2;
    hrule(ops, CONTENT_LEFT, top, CONTENT_WIDTH);

    // Row 3 - phone (left); page and period (right).
    if (options.companyPhone) {
      drawAligned(ops, 'Phone : ' + options.companyPhone, CONTENT_LEFT, CONTENT_WIDTH * 0.5, lineBaseline(top - 6, BODY), BODY, 'left', false);
    }
    const rightWidth = CONTENT_WIDTH * 0.34;
    const rightX = CONTENT_LEFT + CONTENT_WIDTH - rightWidth;
    const rightLines: Array<{ text: string; bold: boolean; size: number }> = [
      { text: 'Page ' + (pageIndex + 1) + ' of ' + totalPages, bold: true, size: 9.5 },
      { text: 'From : ' + options.fromDate, bold: false, size: BODY },
      { text: 'To : ' + options.toDate, bold: false, size: BODY },
    ];
    const rightBoxTop = top - (row3 - rightLines.length * LINE) / 2;
    rightLines.forEach((line, index) => {
      drawAligned(ops, line.text, rightX, rightWidth, lineBaseline(rightBoxTop - index * LINE, line.size), line.size, 'right', line.bold);
    });
    top -= row3;
    hrule(ops, CONTENT_LEFT, top, CONTENT_WIDTH);

    // Row 4 - company GSTIN (left) and the centred report title.
    drawAligned(ops, 'GSTIN : ' + (options.companyGstin ?? ''), CONTENT_LEFT, CONTENT_WIDTH * 0.34, lineBaseline(top - 6, BODY), BODY, 'left', false);
    drawAligned(ops, 'ACCOUNT LEDGER', CONTENT_LEFT, CONTENT_WIDTH, lineBaseline(top - (row4 - 13) / 2, 12), 12, 'center', true, false, NAVY);
    top -= row4;
  };

  const drawLedgerRow = (ops: PageOps, top: number): void => {
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, ledgerRowHeight);
    const nameBoxTop = top - (ledgerRowHeight - ledgerNameLines.length * 13) / 2;
    ledgerNameLines.forEach((line, index) => {
      drawAligned(ops, line, CONTENT_LEFT, ledgerNameWidth, lineBaseline(nameBoxTop - index * 13, 11), 11, 'left', true);
    });
    if (options.ledgerCode) {
      drawAligned(
        ops,
        options.ledgerCode,
        CONTENT_LEFT + ledgerNameWidth,
        CONTENT_WIDTH - ledgerNameWidth,
        lineBaseline(top - (ledgerRowHeight - SMALL) / 2, SMALL),
        SMALL,
        'right',
        false
      );
    }
  };

  const drawMetaRow = (ops: PageOps, top: number): void => {
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, metaRowHeight);
    const third = CONTENT_WIDTH / 3;
    vrule(ops, CONTENT_LEFT + third, top, metaRowHeight);
    vrule(ops, CONTENT_LEFT + third * 2, top, metaRowHeight);
    const baseline = lineBaseline(top - 6, BODY);
    drawAligned(ops, 'GST No. : ' + (options.ledgerGstin ?? ''), CONTENT_LEFT, third, baseline, BODY, 'left', false);
    drawAligned(ops, 'PAN No. : ' + (options.ledgerPan ?? ''), CONTENT_LEFT + third, third, baseline, BODY, 'center', false);
    drawAligned(ops, 'Schedule : ' + (options.schedule ?? ''), CONTENT_LEFT + third * 2, third, baseline, BODY, 'right', false);
  };

  const drawTableHead = (ops: PageOps, top: number): void => {
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, tableHeadHeight);
    columns.forEach((column, index) => {
      if (index > 0) vrule(ops, columnX(index), top, tableHeadHeight);
      const lines = headLines[index];
      const boxTop = top - (tableHeadHeight - lines.length * 10) / 2;
      lines.forEach((line, lineIndex) => {
        drawAligned(
          ops,
          line,
          columnX(index),
          widths[index],
          lineBaseline(boxTop - lineIndex * 10, SMALL),
          SMALL,
          column.align,
          true
        );
      });
    });
  };

  const drawRow = (ops: PageOps, row: PreparedRow, top: number): void => {
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, row.height);
    const lineCount = Math.max(1, ...row.lines.map((entry) => entry.length));
    const boxTop = top - (row.height - lineCount * LINE) / 2;
    row.lines.forEach((entry, index) => {
      if (index > 0) vrule(ops, columnX(index), top, row.height);
      const numeric = NUMERIC_KEYS.has(columns[index].key);
      entry.forEach((line, lineIndex) => {
        const size = numeric ? fitSize(line, widths[index]) : BODY;
        drawAligned(
          ops,
          line,
          columnX(index),
          widths[index],
          lineBaseline(boxTop - lineIndex * LINE, size),
          size,
          columns[index].align,
          row.bold
        );
      });
    });
  };

  const drawTotals = (ops: PageOps, top: number): void => {
    frame(ops, CONTENT_LEFT, top, CONTENT_WIDTH, TOTALS_HEIGHT);
    const baseline = lineBaseline(top - 5, BODY);
    const labelIndex = columns.findIndex((column) => column.key === 'bookName');
    columns.forEach((column, index) => {
      if (index > 0) vrule(ops, columnX(index), top, TOTALS_HEIGHT);
      let value = '';
      if (index === (labelIndex >= 0 ? labelIndex : 0)) value = 'Total';
      if (column.key === 'debit') value = options.totals.debit;
      if (column.key === 'credit') value = options.totals.credit;
      if (column.key === 'balance') value = options.totals.balance;
      if (column.key === 'sign') value = options.totals.nature;
      const size = NUMERIC_KEYS.has(column.key) ? fitSize(value, widths[index]) : BODY;
      drawAligned(ops, value, columnX(index), widths[index], baseline, size, column.align, true);
    });
  };

  const render = (totalPages: number, draw: boolean): PageOps[] => {
    const pages: PageOps[] = [];
    let ops: PageOps = { texts: [], rects: [] };

    const startPage = (): void => {
      ops = { texts: [], rects: [] };
      pages.push(ops);
      if (!draw) return;
      frame(ops, OUTER, PAGE.height - OUTER, PAGE.width - OUTER * 2, PAGE.height - OUTER * 2);
      drawHeader(ops, pages.length - 1, totalPages);
      drawLedgerRow(ops, CONTENT_TOP - headerHeight);
      drawMetaRow(ops, CONTENT_TOP - headerHeight - ledgerRowHeight);
      drawTableHead(ops, bodyTop);
    };

    startPage();
    let y = bodyTop;
    prepared.forEach((row, index) => {
      const reserve = index === prepared.length - 1 ? TOTALS_HEIGHT : 0;
      if (y - row.height - reserve < CONTENT_BOTTOM) {
        startPage();
        y = bodyTop;
      }
      if (draw) drawRow(ops, row, y);
      y -= row.height;
    });

    if (y - TOTALS_HEIGHT < CONTENT_BOTTOM) {
      startPage();
      y = bodyTop;
    }
    if (draw) drawTotals(ops, y);

    return pages;
  };

  const dryRun = render(1, false);
  const pages = render(dryRun.length, true);

  return { buffer: serializePdfPages(pages, PAGE), pageCount: pages.length };
}