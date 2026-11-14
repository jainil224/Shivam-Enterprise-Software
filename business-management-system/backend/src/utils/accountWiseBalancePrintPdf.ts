// Phase 19.2 - traditional sans-serif A4 print document for the Account Wise
// Balance and Account + Month Wise Balance reports.
//
// Pure formatter: it renders the page document built by
// accountWiseBalancePrint.ts, so the preview and the PDF share one pagination
// source, one set of font sizes and one set of baselines. No accounting figure
// is recalculated here.

import {
  fontTextWidth,
  fitFontSize,
  serializePdfPages,
  winAnsi,
  type PageOps,
  type PdfAlign,
} from './pdfWriter.js';
import {
  AWB_ACCOUNT_COLUMN_LABELS,
  AWB_GEOMETRY,
  centeredBaseline,
  stackedBaseline,
  textBaselineOffset,
} from './accountWiseBalancePrint.js';
import type {
  AccountWiseCompanyHeader,
  AccountWiseMonthPrintDocument,
  AccountWiseMonthPrintPage,
  AccountWisePrintDocument,
  AccountWisePrintLayout,
  AccountWisePrintPage,
} from '../types/accountWiseBalanceTypes.js';

const BLACK: [number, number, number] = [0, 0, 0];
const BORDER = 0.6;
/** Small inset that keeps glyphs off the column rule. */
const CELL_PAD = 3;

const rect = (ops: PageOps, x: number, y: number, width: number, height: number): void => {
  ops.rects.push({ x, y, width, height, fill: BLACK });
};

const frame = (ops: PageOps, x: number, top: number, width: number, height: number): void => {
  rect(ops, x, top - BORDER, width, BORDER);
  rect(ops, x, top - height, width, BORDER);
  rect(ops, x, top - height, BORDER, height);
  rect(ops, x + width - BORDER, top - height, BORDER, height);
};

const hrule = (ops: PageOps, x: number, y: number, width: number): void => {
  rect(ops, x, y - BORDER, width, BORDER);
};

const vrule = (ops: PageOps, x: number, top: number, height: number): void => {
  rect(ops, x, top - height, BORDER, height);
};

/** Draws one sans-serif run, right/left/centre aligned inside a box. */
const drawText = (
  ops: PageOps,
  value: string,
  x: number,
  width: number,
  baseline: number,
  size: number,
  align: PdfAlign,
  bold: boolean
): void => {
  const clean = winAnsi(String(value ?? '')).trim();
  if (clean.length === 0) return;
  const textW = fontTextWidth(clean, size, 'helvetica', bold);
  const tx =
    align === 'right'
      ? x + width - CELL_PAD - textW
      : align === 'center'
        ? x + Math.max(CELL_PAD, (width - textW) / 2)
        : x + CELL_PAD;
  ops.texts.push({ x: tx, y: baseline, text: clean, size, bold, font: 'helvetica', color: BLACK });
};

/** Money shrinks instead of clipping when a column is narrow. */
const fitMoney = (value: string, width: number, size: number): number =>
  fitFontSize(value, width - CELL_PAD * 2, size, 'helvetica', false, 6);

function drawCompanyHeader(
  ops: PageOps,
  layout: AccountWisePrintLayout,
  company: AccountWiseCompanyHeader,
  financialYear: string,
  title: string,
  periodFrom: string,
  periodTo: string,
  pageIndex: number,
  totalPages: number
): void {
  const left = layout.contentLeftPt;
  const width = layout.contentWidthPt;
  const t = layout.typography;
  frame(ops, left, layout.contentTopPt, width, layout.headerHeightPt);

  // 1. Company name centred, financial year right aligned on the same line.
  let y = layout.contentTopPt;
  const financialYearWidth = fontTextWidth(financialYear, t.financialYearPt, 'helvetica', true);
  const nameBlockLeft = left + Math.max(CELL_PAD, layout.companyNameXPt);
  const nameBaseline = centeredBaseline(y, layout.nameHeightPt, t.companyNamePt);
  layout.companyNameLines.forEach((line, index) => {
    const lineWidth = fontTextWidth(line, t.companyNamePt, 'helvetica', true);
    ops.texts.push({
      x: nameBlockLeft + (layout.companyNameBlockWidthPt - lineWidth) / 2,
      y: nameBaseline - index * (t.companyNamePt + 3),
      text: line,
      size: t.companyNamePt,
      bold: true,
      font: 'helvetica',
      color: BLACK,
    });
  });
  ops.texts.push({
    x: left + width - CELL_PAD - financialYearWidth,
    y: nameBaseline,
    text: winAnsi(financialYear),
    size: t.financialYearPt,
    bold: true,
    font: 'helvetica',
    color: BLACK,
  });
  y -= layout.nameHeightPt;
  hrule(ops, left, y, width);

  // 2. Company address, centred and smaller.
  const addressBlockTop =
    y - (layout.addressHeightPt - company.addressLines.length * AWB_GEOMETRY.headerAddressLine) / 2;
  company.addressLines.forEach((line, index) => {
    drawText(
      ops,
      line,
      left,
      width,
      centeredBaseline(addressBlockTop - index * AWB_GEOMETRY.headerAddressLine, AWB_GEOMETRY.headerAddressLine, t.addressPt),
      t.addressPt,
      'center',
      false
    );
  });
  y -= layout.addressHeightPt;
  hrule(ops, left, y, width);

  // 3. PAN left, TAN right only when the Company Master actually stores one.
  const panBaseline = centeredBaseline(y, layout.panHeightPt, t.metaPt);
  drawText(
    ops,
    company.panNumber ? 'PAN NO: ' + company.panNumber : 'PAN NO:',
    left,
    width * 0.55,
    panBaseline,
    t.metaPt,
    'left',
    false
  );
  if (company.tanNumber) {
    drawText(
      ops,
      'TAN NO: ' + company.tanNumber,
      left + width * 0.55,
      width * 0.45,
      panBaseline,
      t.metaPt,
      'right',
      false
    );
  }
  y -= layout.panHeightPt;
  hrule(ops, left, y, width);

  // 4. Report title, centred and bold.
  drawText(
    ops,
    title,
    left,
    width,
    centeredBaseline(y, layout.titleHeightPt, t.titlePt),
    t.titlePt,
    'center',
    true
  );
  y -= layout.titleHeightPt;
  hrule(ops, left, y, width);

  // 5. GSTIN left, period centred, page number right.
  const metaBaseline = centeredBaseline(y, layout.metaHeightPt, t.metaPt);
  drawText(
    ops,
    company.gstin ? 'GSTIN: ' + company.gstin : 'GSTIN:',
    left,
    width * 0.32,
    metaBaseline,
    t.metaPt,
    'left',
    false
  );
  drawText(
    ops,
    'PERIOD: ' + periodFrom + ' TO ' + periodTo,
    left + width * 0.3,
    width * 0.42,
    metaBaseline,
    t.metaPt,
    'center',
    false
  );
  drawText(
    ops,
    'PAGE ' + (pageIndex + 1) + ' OF ' + totalPages,
    left + width * 0.72,
    width * 0.28,
    metaBaseline,
    t.metaPt,
    'right',
    true
  );
}

/** Column offsets for widths that the print document already fixed. */
function columnOffsets(layout: AccountWisePrintLayout, widths: number[]): number[] {
  const xs: number[] = [];
  let cursor = layout.contentLeftPt;
  for (const width of widths) {
    xs.push(cursor);
    cursor += width;
  }
  return xs;
}

function drawAccountTableHead(
  ops: PageOps,
  layout: AccountWisePrintLayout,
  widths: number[],
  xs: number[]
): void {
  const top = layout.bodyTopPt + layout.tableHeadHeightPt;
  const height = layout.tableHeadHeightPt;
  frame(ops, layout.contentLeftPt, top, layout.contentWidthPt, height);
  vrule(ops, xs[1], top, height);
  vrule(ops, xs[2], top, height);
  const baseline = centeredBaseline(top, height, layout.typography.tableHeadPt);
  drawText(ops, AWB_ACCOUNT_COLUMN_LABELS[0], xs[0], widths[0], baseline, layout.typography.tableHeadPt, 'left', true);
  drawText(ops, AWB_ACCOUNT_COLUMN_LABELS[1], xs[1], widths[1], baseline, layout.typography.tableHeadPt, 'right', true);
  drawText(ops, AWB_ACCOUNT_COLUMN_LABELS[2], xs[2], widths[2], baseline, layout.typography.tableHeadPt, 'right', true);
}

function drawAccountBlock(
  ops: PageOps,
  block: AccountWisePrintPage['blocks'][number],
  top: number,
  layout: AccountWisePrintLayout,
  widths: number[],
  xs: number[]
): void {
  const height = block.heightPt;
  const t = layout.typography;
  vrule(ops, xs[1], top, height);
  vrule(ops, xs[2], top, height);
  hrule(ops, layout.contentLeftPt, top - height, layout.contentWidthPt);

  block.nameLines.forEach((line, index) => {
    drawText(
      ops,
      line,
      xs[0],
      widths[0],
      stackedBaseline(top, AWB_GEOMETRY.blockPadTop, t.accountNamePt, AWB_GEOMETRY.blockNameLine, index),
      t.accountNamePt,
      'left',
      true
    );
  });

  // The amount sits on the last printed line of the block: beside the account
  // name when the account has no details, below the details when it has them.
  const hasDetails = block.detailLines.length > 0;
  const lastLineOffset = hasDetails
    ? block.nameLines.length * AWB_GEOMETRY.blockNameLine +
      (block.detailLines.length - 1) * AWB_GEOMETRY.blockDetailLine
    : (block.nameLines.length - 1) * AWB_GEOMETRY.blockNameLine;
  const amountLineHeight = hasDetails ? AWB_GEOMETRY.blockDetailLine : AWB_GEOMETRY.blockNameLine;
  const amountBaseline =
    top - AWB_GEOMETRY.blockPadTop - lastLineOffset - textBaselineOffset(t.amountPt, amountLineHeight);

  if (block.debit) {
    drawText(ops, block.debit, xs[1], widths[1], amountBaseline, fitMoney(block.debit, widths[1], t.amountPt), 'right', false);
  }
  if (block.credit) {
    drawText(ops, block.credit, xs[2], widths[2], amountBaseline, fitMoney(block.credit, widths[2], t.amountPt), 'right', false);
  }

  const detailStart = top - AWB_GEOMETRY.blockPadTop - block.nameLines.length * AWB_GEOMETRY.blockNameLine;
  block.detailLines.forEach((line, index) => {
    drawText(
      ops,
      line,
      xs[0],
      widths[0],
      detailStart - textBaselineOffset(t.detailPt, AWB_GEOMETRY.blockDetailLine) - index * AWB_GEOMETRY.blockDetailLine,
      t.detailPt,
      'left',
      false
    );
  });
}

function drawAccountTotals(
  ops: PageOps,
  totals: AccountWisePrintDocument['totals'],
  top: number,
  layout: AccountWisePrintLayout,
  widths: number[],
  xs: number[]
): void {
  const height = layout.totalsHeightPt;
  const t = layout.typography;
  frame(ops, layout.contentLeftPt, top, layout.contentWidthPt, height);
  vrule(ops, xs[1], top, height);
  vrule(ops, xs[2], top, height);
  const baseline = centeredBaseline(top, height, t.totalPt);
  drawText(ops, 'TOTAL', xs[0], widths[0], baseline, t.totalPt, 'left', true);
  drawText(ops, totals.debit, xs[1], widths[1], baseline, fitFontSize(totals.debit, widths[1] - CELL_PAD * 2, t.totalPt, 'helvetica', true, 6), 'right', true);
  drawText(ops, totals.credit, xs[2], widths[2], baseline, fitFontSize(totals.credit, widths[2] - CELL_PAD * 2, t.totalPt, 'helvetica', true, 6), 'right', true);
}

export function buildAccountWisePrintPdf(document: AccountWisePrintDocument): {
  buffer: Buffer;
  pageCount: number;
} {
  const layout = document.layout;
  const widths = document.columnWidthsPt;
  const xs = columnOffsets(layout, widths);
  const pageCount = document.pages.length;

  const pages: PageOps[] = document.pages.map((page, pageIndex) => {
    const ops: PageOps = { texts: [], rects: [] };
    frame(
      ops,
      AWB_GEOMETRY.outer,
      layout.pageHeightPt - AWB_GEOMETRY.outer,
      layout.pageWidthPt - AWB_GEOMETRY.outer * 2,
      layout.pageHeightPt - AWB_GEOMETRY.outer * 2
    );
    drawCompanyHeader(
      ops,
      layout,
      document.company,
      document.financialYear,
      document.reportTitle,
      document.periodFrom,
      document.periodTo,
      pageIndex,
      pageCount
    );
    drawAccountTableHead(ops, layout, widths, xs);

    let top = layout.bodyTopPt;
    for (const block of page.blocks) {
      drawAccountBlock(ops, block, top, layout, widths, xs);
      top -= block.heightPt;
    }
    if (page.showTotals) {
      drawAccountTotals(ops, document.totals, top, layout, widths, xs);
    }
    return ops;
  });

  return {
    buffer: serializePdfPages(pages, {
      width: layout.pageWidthPt,
      height: layout.pageHeightPt,
    }),
    pageCount,
  };
}
// ---------------------------------------------------------------------------
// Account + Month Wise Balance (A4 landscape, unchanged bands).
// ---------------------------------------------------------------------------

function drawMonthTableHead(
  ops: PageOps,
  layout: AccountWisePrintLayout,
  page: AccountWiseMonthPrintPage,
  widths: number[],
  xs: number[]
): void {
  const top = layout.bodyTopPt + layout.tableHeadHeightPt;
  const height = layout.tableHeadHeightPt;
  const half = height / 2;
  frame(ops, layout.contentLeftPt, top, layout.contentWidthPt, height);
  for (let index = 1; index < widths.length; index += 1) {
    vrule(ops, xs[index], top, height);
  }
  // The account column keeps its full height; only the month band is split.
  hrule(ops, xs[1], top - half, layout.contentWidthPt - (xs[1] - layout.contentLeftPt));

  const rowOne = centeredBaseline(top, half, 8);
  const rowTwo = centeredBaseline(top - half, half, 8);
  drawText(ops, 'ACCOUNT NAME', xs[0], widths[0], centeredBaseline(top, height, 8), 8, 'left', true);
  drawText(ops, 'OPENING', xs[1], widths[1], rowOne, 8, 'center', true);
  drawText(ops, 'BALANCE', xs[1], widths[1], rowTwo, 8, 'center', true);
  const closingIndex = widths.length - 1;
  drawText(ops, 'CLOSING', xs[closingIndex], widths[closingIndex], rowOne, 8, 'center', true);
  drawText(ops, 'BALANCE', xs[closingIndex], widths[closingIndex], rowTwo, 8, 'center', true);

  page.months.forEach((month, monthIndex) => {
    const debitIndex = 2 + monthIndex * 2;
    const monthWidth = widths[debitIndex] + widths[debitIndex + 1];
    drawText(ops, month.shortLabel, xs[debitIndex], monthWidth, rowOne, 7.5, 'center', true);
    drawText(ops, 'DEBIT', xs[debitIndex], widths[debitIndex], rowTwo, 7, 'center', true);
    drawText(ops, 'CREDIT', xs[debitIndex + 1], widths[debitIndex + 1], rowTwo, 7, 'center', true);
  });
}

function drawMonthBlock(
  ops: PageOps,
  block: AccountWiseMonthPrintPage['blocks'][number],
  top: number,
  layout: AccountWisePrintLayout,
  widths: number[],
  xs: number[]
): void {
  const height = block.heightPt;
  for (let index = 1; index < widths.length; index += 1) {
    vrule(ops, xs[index], top, height);
  }
  hrule(ops, layout.contentLeftPt, top - height, layout.contentWidthPt);

  block.nameLines.forEach((line, index) => {
    drawText(
      ops,
      line,
      xs[0],
      widths[0],
      stackedBaseline(top, AWB_GEOMETRY.blockPadTop, AWB_GEOMETRY.monthNamePt, AWB_GEOMETRY.blockNameLine, index),
      AWB_GEOMETRY.monthNamePt,
      'left',
      true
    );
  });
  const detailStart = top - AWB_GEOMETRY.blockPadTop - block.nameLines.length * AWB_GEOMETRY.blockNameLine;
  block.detailLines.forEach((line, index) => {
    drawText(
      ops,
      line,
      xs[0],
      widths[0],
      detailStart - textBaselineOffset(AWB_GEOMETRY.monthDetailPt, AWB_GEOMETRY.blockDetailLine) - index * AWB_GEOMETRY.blockDetailLine,
      AWB_GEOMETRY.monthDetailPt,
      'left',
      false
    );
  });

  const amountBaseline = stackedBaseline(
    top,
    AWB_GEOMETRY.blockPadTop,
    AWB_GEOMETRY.monthAmountPt,
    AWB_GEOMETRY.blockDetailLine,
    0
  );
  drawText(
    ops,
    block.opening,
    xs[1],
    widths[1],
    amountBaseline,
    fitFontSize(block.opening, widths[1] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', false, 6),
    'right',
    false
  );
  block.cells.forEach((cell, index) => {
    const debitIndex = 2 + index * 2;
    if (cell.debit !== '0.00') {
      drawText(
        ops,
        cell.debit,
        xs[debitIndex],
        widths[debitIndex],
        amountBaseline,
        fitFontSize(cell.debit, widths[debitIndex] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', false, 6),
        'right',
        false
      );
    }
    if (cell.credit !== '0.00') {
      drawText(
        ops,
        cell.credit,
        xs[debitIndex + 1],
        widths[debitIndex + 1],
        amountBaseline,
        fitFontSize(cell.credit, widths[debitIndex + 1] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', false, 6),
        'right',
        false
      );
    }
  });
  const closingIndex = widths.length - 1;
  drawText(
    ops,
    block.closing,
    xs[closingIndex],
    widths[closingIndex],
    amountBaseline,
    fitFontSize(block.closing, widths[closingIndex] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', true, 6),
    'right',
    true
  );
}

function drawMonthTotals(
  ops: PageOps,
  page: AccountWiseMonthPrintPage,
  top: number,
  layout: AccountWisePrintLayout,
  widths: number[],
  xs: number[]
): void {
  const height = layout.totalsHeightPt;
  frame(ops, layout.contentLeftPt, top, layout.contentWidthPt, height);
  for (let index = 1; index < widths.length; index += 1) {
    vrule(ops, xs[index], top, height);
  }
  const baseline = centeredBaseline(top, height, 8);
  drawText(ops, 'TOTAL', xs[0], widths[0], baseline, 8, 'left', true);
  page.totals.cells.forEach((cell, index) => {
    const debitIndex = 2 + index * 2;
    drawText(
      ops,
      cell.debit,
      xs[debitIndex],
      widths[debitIndex],
      baseline,
      fitFontSize(cell.debit, widths[debitIndex] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', true, 6),
      'right',
      true
    );
    drawText(
      ops,
      cell.credit,
      xs[debitIndex + 1],
      widths[debitIndex + 1],
      baseline,
      fitFontSize(cell.credit, widths[debitIndex + 1] - CELL_PAD * 2, AWB_GEOMETRY.monthAmountPt, 'helvetica', true, 6),
      'right',
      true
    );
  });
  const closingIndex = widths.length - 1;
  drawText(
    ops,
    page.totals.closingDebit,
    xs[closingIndex],
    widths[closingIndex],
    stackedBaseline(top, AWB_GEOMETRY.blockPadTop, 7, 8, 0),
    7,
    'right',
    true
  );
  drawText(
    ops,
    page.totals.closingCredit,
    xs[closingIndex],
    widths[closingIndex],
    stackedBaseline(top, AWB_GEOMETRY.blockPadTop, 7, 8, 1),
    7,
    'right',
    true
  );
}

export function buildAccountMonthPrintPdf(document: AccountWiseMonthPrintDocument): {
  buffer: Buffer;
  pageCount: number;
} {
  const layout = document.layout;
  const pageCount = document.pages.length;

  const pages: PageOps[] = document.pages.map((page, pageIndex) => {
    const ops: PageOps = { texts: [], rects: [] };
    const widths = page.columnWidthsPt;
    const xs = columnOffsets(layout, widths);
    frame(
      ops,
      AWB_GEOMETRY.outer,
      layout.pageHeightPt - AWB_GEOMETRY.outer,
      layout.pageWidthPt - AWB_GEOMETRY.outer * 2,
      layout.pageHeightPt - AWB_GEOMETRY.outer * 2
    );
    drawCompanyHeader(
      ops,
      layout,
      document.company,
      document.financialYear,
      document.reportTitle,
      document.periodFrom,
      document.periodTo,
      pageIndex,
      pageCount
    );
    drawMonthTableHead(ops, layout, page, widths, xs);

    let top = layout.bodyTopPt;
    for (const block of page.blocks) {
      drawMonthBlock(ops, block, top, layout, widths, xs);
      top -= block.heightPt;
    }
    if (page.showTotals) {
      drawMonthTotals(ops, page, top, layout, widths, xs);
    }
    return ops;
  });

  return {
    buffer: serializePdfPages(pages, {
      width: layout.pageWidthPt,
      height: layout.pageHeightPt,
    }),
    pageCount,
  };
}