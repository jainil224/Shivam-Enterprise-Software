// Phase 19.2 - Account Wise Balance print document builder.
//
// One pure builder owns the A4 geometry, the account block heights, the page
// breaks and the typography. The screen preview and the PDF writer both render
// this exact document, so page count, row order, totals and every font size
// cannot drift apart. The layout is a traditional sans-serif accounting
// document, so wrapping and column maths use real Helvetica metrics instead of
// Courier's fixed 0.6 em advance. No accounting value is calculated here: every
// amount comes from the service.

import { PAGE_SIZES, fitFontSize, fontTextWidth, wrapText, wrapTextToWidth } from './pdfWriter.js';
import type {
  AccountWiseBalanceResult,
  AccountWiseCompanyHeader,
  AccountWiseMonthGroup,
  AccountWiseMonthPrintBlock,
  AccountWiseMonthPrintDocument,
  AccountWiseMonthPrintPage,
  AccountWiseMonthWiseResult,
  AccountWisePrintBlock,
  AccountWisePrintDocument,
  AccountWisePrintLayout,
  AccountWisePrintPage,
  AccountWisePrintTypography,
} from '../types/accountWiseBalanceTypes.js';

export const AWB_GEOMETRY = {
  /** Page margin: 20pt outer + 8pt inset = 28pt (about 10 mm) on every side. */
  outer: 20,
  pad: 8,
  headerName: 30,
  headerAddressLine: 10,
  headerAddressPad: 10,
  headerPan: 20,
  headerTitle: 24,
  headerMeta: 22,
  tableHeadPortrait: 20,
  tableHeadLandscape: 26,
  totals: 22,
  blockNameLine: 13,
  blockDetailLine: 10,
  blockPadTop: 3,
  blockPadding: 7,
  minBlock: 26,
  /** 55 / 22.5 / 22.5 - the traditional three-column split. */
  accountWeight: 55,
  debitWeight: 22.5,
  creditWeight: 22.5,
  monthAccountPt: 150,
  monthOpeningPt: 64,
  monthClosingPt: 64,
  monthCellPt: 46,
  monthNamePt: 9,
  monthDetailPt: 7.5,
  monthAmountPt: 7.5,
  companyNamePt: 14,
  companyNameMinPt: 9,
  financialYearPt: 10,
  addressPt: 8,
  titlePt: 11,
  metaPt: 8,
  tableHeadPt: 8.5,
  accountNamePt: 9.5,
  detailPt: 7.5,
  amountPt: 9,
  totalPt: 9.5,
} as const;

export const AWB_REPORT_TITLE = 'ACCOUNT BALANCE REPORT';

/** Column headers of the Account Wise Balance document, left to right. */
export const AWB_ACCOUNT_COLUMN_LABELS = ['ACCOUNT NAME', 'DEBIT', 'CREDIT'] as const;

/** DD-MM-YYYY, the accounting display format used by every print document. */
export function isoToDisplay(iso: string): string {
  const parts = String(iso ?? '').split('-');
  return parts.length === 3 ? parts[2] + '-' + parts[1] + '-' + parts[0] : String(iso ?? '');
}
export const AWB_MONTH_REPORT_TITLE = 'ACCOUNT + MONTH WISE BALANCE';

/** Indian digit grouping for a fixed two-decimal string. */
export function groupMoney(value: string): string {
  const text = String(value ?? '').trim();
  if (text.length === 0) return '';
  const negative = text.startsWith('-');
  const digits = negative ? text.slice(1) : text;
  const [integerPart, decimalPart = '00'] = digits.split('.');
  const safeInteger = integerPart.length === 0 ? '0' : integerPart;
  const lastThree = safeInteger.slice(-3);
  let rest = safeInteger.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length > 0) groups.unshift(rest);
  const formatted = [...groups, lastThree].filter((part) => part.length > 0).join(',');
  return (negative ? '-' : '') + formatted + '.' + decimalPart;
}

/**
 * Baseline of a text run inside a CSS line box of `lineHeightPt`.
 * The preview uses the same line height and padding, so the PDF glyphs land on
 * the same visual row as the on-screen sheet.
 */
export function textBaselineOffset(sizePt: number, lineHeightPt: number): number {
  return sizePt * 0.905 + (lineHeightPt - sizePt) / 2;
}

/** Baseline of vertically centred text inside a band or row. */
export function centeredBaseline(topPt: number, heightPt: number, sizePt: number): number {
  return topPt - heightPt / 2 + sizePt * 0.35;
}

/** Baseline of line `index` of a block that starts at `topPt`. */
export function stackedBaseline(
  topPt: number,
  padTopPt: number,
  sizePt: number,
  lineHeightPt: number,
  index: number
): number {
  return topPt - padTopPt - textBaselineOffset(sizePt, lineHeightPt) - index * lineHeightPt;
}

/** Real company values, split into the printed address lines. */
export function buildCompanyHeader(company: {
  companyName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  panNumber: string | null;
  gstin: string | null;
  phone: string | null;
}, maxChars: number): AccountWiseCompanyHeader {
  const locality = [company.city, company.state, company.pincode]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .map((part) => part.trim())
    .join(', ');
  const raw = [company.address?.trim() ?? '', locality].filter((part) => part.length > 0);
  const addressLines = raw
    .flatMap((line) => wrapText(line, maxChars))
    .slice(0, 2)
    .filter((line) => line.length > 0);
  return {
    companyName: company.companyName,
    addressLines,
    panNumber: company.panNumber?.trim() ? company.panNumber.trim() : null,
    // No TAN column exists in the Company model, so the header omits the label.
    tanNumber: null,
    gstin: company.gstin?.trim() ? company.gstin.trim() : null,
    phone: company.phone?.trim() ? company.phone.trim() : null,
  };
}

function layoutFor(
  orientation: 'portrait' | 'landscape',
  company: AccountWiseCompanyHeader,
  financialYear: string
): AccountWisePrintLayout {
  const size = PAGE_SIZES[orientation];
  const contentLeft = AWB_GEOMETRY.outer + AWB_GEOMETRY.pad;
  const contentWidth = size.width - contentLeft * 2;
  const contentTop = size.height - AWB_GEOMETRY.outer - AWB_GEOMETRY.pad;
  const contentBottom = AWB_GEOMETRY.outer + AWB_GEOMETRY.pad;

  // The financial year sits on the same line as the company name, right
  // aligned, so the name is centred inside the space that is left over.
  const financialYearPt = AWB_GEOMETRY.financialYearPt;
  const financialYearWidth = fontTextWidth(financialYear, financialYearPt, 'helvetica', true);
  const nameWidth = Math.max(160, contentWidth - financialYearWidth - 24);
  const companyNamePt = fitFontSize(
    company.companyName,
    nameWidth,
    AWB_GEOMETRY.companyNamePt,
    'helvetica',
    true,
    AWB_GEOMETRY.companyNameMinPt
  );
  const companyNameLines = wrapTextToWidth(
    company.companyName,
    nameWidth,
    companyNamePt,
    'helvetica',
    true
  ).slice(0, 2);
  const nameHeightPt = Math.max(
    AWB_GEOMETRY.headerName,
    companyNameLines.length * (companyNamePt + 3) + 8
  );
  // The name sits on the page centre, but never runs under the financial year:
  // when the two would collide the block slides left by the minimum amount.
  const companyNameBlockWidthPt = companyNameLines.reduce(
    (max, line) => Math.max(max, fontTextWidth(line, companyNamePt, 'helvetica', true)),
    0
  );
  const financialYearLeft = contentWidth - 3 - financialYearWidth;
  const companyNameXPt = Math.max(
    3,
    Math.min(
      (contentWidth - companyNameBlockWidthPt) / 2,
      financialYearLeft - 12 - companyNameBlockWidthPt
    )
  );
  const addressHeightPt =
    company.addressLines.length > 0
      ? company.addressLines.length * AWB_GEOMETRY.headerAddressLine + AWB_GEOMETRY.headerAddressPad
      : 12;
  const headerHeight =
    nameHeightPt +
    addressHeightPt +
    AWB_GEOMETRY.headerPan +
    AWB_GEOMETRY.headerTitle +
    AWB_GEOMETRY.headerMeta;
  const tableHeadHeight =
    orientation === 'portrait'
      ? AWB_GEOMETRY.tableHeadPortrait
      : AWB_GEOMETRY.tableHeadLandscape;

  const typography: AccountWisePrintTypography = {
    companyNamePt,
    financialYearPt,
    addressPt: AWB_GEOMETRY.addressPt,
    titlePt: AWB_GEOMETRY.titlePt,
    metaPt: AWB_GEOMETRY.metaPt,
    tableHeadPt: AWB_GEOMETRY.tableHeadPt,
    accountNamePt: AWB_GEOMETRY.accountNamePt,
    detailPt: AWB_GEOMETRY.detailPt,
    amountPt: AWB_GEOMETRY.amountPt,
    totalPt: AWB_GEOMETRY.totalPt,
  };

  return {
    orientation,
    pageWidthPt: size.width,
    pageHeightPt: size.height,
    outerPt: AWB_GEOMETRY.outer,
    padPt: AWB_GEOMETRY.pad,
    contentLeftPt: contentLeft,
    contentWidthPt: contentWidth,
    contentTopPt: contentTop,
    contentBottomPt: contentBottom,
    headerHeightPt: headerHeight,
    tableHeadHeightPt: tableHeadHeight,
    totalsHeightPt: AWB_GEOMETRY.totals,
    bodyTopPt: contentTop - headerHeight - tableHeadHeight,
    bodyBottomPt: contentBottom,
    companyNameLines,
    companyNameWidthPt: nameWidth,
    companyNameBlockWidthPt,
    companyNameXPt,
    typography,
    nameHeightPt,
    addressHeightPt,
    panHeightPt: AWB_GEOMETRY.headerPan,
    titleHeightPt: AWB_GEOMETRY.headerTitle,
    metaHeightPt: AWB_GEOMETRY.headerMeta,
  };
}
/** Pages are only created when they receive content, so no blank page exists. */
function paginate<T extends { heightPt: number }>(
  blocks: T[],
  bodyHeight: number,
  totalsHeight: number,
  pageBreakEveryBlock: boolean
): Array<{ blocks: T[]; showTotals: boolean }> {
  if (blocks.length === 0) return [{ blocks: [], showTotals: true }];
  const pages: Array<{ blocks: T[]; showTotals: boolean }> = [];
  let current: { blocks: T[]; showTotals: boolean } = { blocks: [], showTotals: false };
  let used = 0;
  for (const block of blocks) {
    const mustBreak =
      current.blocks.length > 0 &&
      (pageBreakEveryBlock || used + block.heightPt + totalsHeight > bodyHeight);
    if (mustBreak) {
      pages.push(current);
      current = { blocks: [], showTotals: false };
      used = 0;
    }
    current.blocks.push(block);
    used += block.heightPt;
  }
  current.showTotals = true;
  pages.push(current);
  return pages;
}

/** Exact column widths in points; the preview and the PDF both consume these. */
export function accountColumnWidths(layout: AccountWisePrintLayout): number[] {
  const total =
    AWB_GEOMETRY.accountWeight + AWB_GEOMETRY.debitWeight + AWB_GEOMETRY.creditWeight;
  return [
    (layout.contentWidthPt * AWB_GEOMETRY.accountWeight) / total,
    (layout.contentWidthPt * AWB_GEOMETRY.debitWeight) / total,
    (layout.contentWidthPt * AWB_GEOMETRY.creditWeight) / total,
  ];
}

/** One account block of the Account Wise Balance document. */
function accountBlock(
  row: AccountWiseBalanceResult['rows'][number],
  layout: AccountWisePrintLayout,
  maxDetailLines: number
): AccountWisePrintBlock {
  const accountWidth = accountColumnWidths(layout)[0];
  const textWidthPt = accountWidth - 8;
  const nameLines = wrapTextToWidth(
    row.accountName,
    textWidthPt,
    AWB_GEOMETRY.accountNamePt,
    'helvetica',
    true
  ).slice(0, 2);
  const rawDetails = [row.description ?? '', row.partyAddress ?? ''];
  if (row.mobile) rawDetails.push('Mobile No: ' + row.mobile);
  if (row.panNumber) rawDetails.push('PAN No: ' + row.panNumber);
  const detailLines = rawDetails
    .filter((line) => line.trim().length > 0)
    .flatMap((line) =>
      wrapTextToWidth(line, textWidthPt, AWB_GEOMETRY.detailPt, 'helvetica', false)
    )
    .slice(0, maxDetailLines);
  const heightPt = Math.max(
    AWB_GEOMETRY.minBlock,
    nameLines.length * AWB_GEOMETRY.blockNameLine +
      detailLines.length * AWB_GEOMETRY.blockDetailLine +
      AWB_GEOMETRY.blockPadding
  );
  return {
    accountName: row.accountName,
    nameLines,
    detailLines,
    // Only the side that actually carries the balance is printed.
    debit: row.debitBalance === '0.00' ? '' : groupMoney(row.debitBalance),
    credit: row.creditBalance === '0.00' ? '' : groupMoney(row.creditBalance),
    heightPt,
  };
}

export function buildAccountWisePrintDocument(
  result: Omit<AccountWiseBalanceResult, 'print'>
): AccountWisePrintDocument {
  const companyHeader = result.meta.company;
  const layout = layoutFor('portrait', companyHeader, result.meta.financialYearName);
  const bodyHeight = layout.bodyTopPt - layout.bodyBottomPt;
  const maxDetailLines = Math.max(
    0,
    Math.floor(
      (bodyHeight - AWB_GEOMETRY.totals - AWB_GEOMETRY.blockPadding - AWB_GEOMETRY.blockNameLine * 2) /
        AWB_GEOMETRY.blockDetailLine
    )
  );

  const blocks = result.rows.map((row) => accountBlock(row, layout, maxDetailLines));
  const pages = paginate(
    blocks,
    bodyHeight,
    AWB_GEOMETRY.totals,
    result.appliedFilters.pageBreakEveryParty
  );

  const printPages: AccountWisePrintPage[] = pages.map((page, index) => ({
    pageNumber: index + 1,
    blocks: page.blocks,
    showTotals: page.showTotals,
  }));

  return {
    reportTitle: AWB_REPORT_TITLE,
    orientation: 'portrait',
    company: companyHeader,
    financialYear: result.meta.financialYearName,
    periodFrom: isoToDisplay(result.appliedFilters.fromDate),
    periodTo: isoToDisplay(result.appliedFilters.toDate),
    layout,
    columnWidthsPt: accountColumnWidths(layout),
    pages: printPages,
    totals: {
      debit: groupMoney(result.totals.totalClosingDebit),
      credit: groupMoney(result.totals.totalClosingCredit),
      accountCount: result.totals.accountCount,
    },
    notes: [
      'Totals are the sums of every account in the filtered dataset, not of one page.',
      'Debit and Credit totals are independent balance totals and are never forced to agree.',
    ],
  };
}
// ---------------------------------------------------------------------------
// Account + Month Wise Balance print document (A4 landscape, month bands).
// ---------------------------------------------------------------------------

/** Exact month-band column widths in points for one page. */
export function monthColumnWidths(layout: AccountWisePrintLayout, monthCount: number): number[] {
  const base = [
    AWB_GEOMETRY.monthAccountPt,
    AWB_GEOMETRY.monthOpeningPt,
    ...Array.from({ length: monthCount * 2 }, () => AWB_GEOMETRY.monthCellPt),
    AWB_GEOMETRY.monthClosingPt,
  ];
  const baseTotal = base.reduce((sum, value) => sum + value, 0);
  const scale = baseTotal > 0 ? layout.contentWidthPt / baseTotal : 1;
  return base.map((value) => value * scale);
}

export function monthColumnsPerPage(layout: AccountWisePrintLayout): number {
  const available =
    layout.contentWidthPt -
    (AWB_GEOMETRY.monthAccountPt + AWB_GEOMETRY.monthOpeningPt + AWB_GEOMETRY.monthClosingPt);
  return Math.max(1, Math.floor(available / (AWB_GEOMETRY.monthCellPt * 2)));
}

function monthBlock(
  row: AccountWiseMonthWiseResult['rows'][number],
  months: AccountWiseMonthGroup[],
  maxDetailLines: number
): AccountWiseMonthPrintBlock {
  const textWidthPt = AWB_GEOMETRY.monthAccountPt - 8;
  const nameLines = wrapTextToWidth(
    row.accountName,
    textWidthPt,
    AWB_GEOMETRY.monthNamePt,
    'helvetica',
    true
  ).slice(0, 2);
  const rawDetails = [row.description ?? '', row.partyAddress ?? ''];
  if (row.mobile) rawDetails.push('Mobile No: ' + row.mobile);
  if (row.panNumber) rawDetails.push('PAN No: ' + row.panNumber);
  const detailLines = rawDetails
    .filter((line) => line.trim().length > 0)
    .flatMap((line) =>
      wrapTextToWidth(line, textWidthPt, AWB_GEOMETRY.monthDetailPt, 'helvetica', false)
    )
    .slice(0, maxDetailLines);
  const byKey = new Map(row.months.map((entry) => [entry.key, entry]));
  const cells = months.map((month) => {
    const entry = byKey.get(month.key);
    return {
      debit: entry ? groupMoney(entry.debit) : '0.00',
      credit: entry ? groupMoney(entry.credit) : '0.00',
    };
  });
  const heightPt = Math.max(
    AWB_GEOMETRY.minBlock,
    nameLines.length * AWB_GEOMETRY.blockNameLine +
      detailLines.length * AWB_GEOMETRY.blockDetailLine +
      AWB_GEOMETRY.blockPadding
  );
  return {
    accountName: row.accountName,
    nameLines,
    detailLines,
    opening: groupMoney(row.openingBalance) + ' ' + row.openingNature,
    cells,
    closing: groupMoney(row.closingBalance) + ' ' + row.closingNature,
    heightPt,
  };
}

export function buildAccountMonthPrintDocument(
  result: Omit<AccountWiseMonthWiseResult, 'print'>
): AccountWiseMonthPrintDocument {
  const companyHeader = result.meta.company;
  const layout = layoutFor('landscape', companyHeader, result.meta.financialYearName);
  const bodyHeight = layout.bodyTopPt - layout.bodyBottomPt;
  const maxDetailLines = Math.max(
    0,
    Math.floor(
      (bodyHeight - AWB_GEOMETRY.totals - AWB_GEOMETRY.blockPadding - AWB_GEOMETRY.blockNameLine * 2) /
        AWB_GEOMETRY.blockDetailLine
    )
  );
  const perPage = monthColumnsPerPage(layout);

  const chunks: AccountWiseMonthGroup[][] = [];
  for (let index = 0; index < result.months.length; index += perPage) {
    chunks.push(result.months.slice(index, index + perPage));
  }
  if (chunks.length === 0) chunks.push([]);

  const totalByKey = new Map(result.totals.months.map((entry) => [entry.key, entry]));
  const pages: AccountWiseMonthPrintPage[] = [];

  for (const months of chunks) {
    const blocks = result.rows.map((row) => monthBlock(row, months, maxDetailLines));
    const pageBreaks = paginate(
      blocks,
      bodyHeight,
      AWB_GEOMETRY.totals,
      result.appliedFilters.pageBreakEveryParty
    );
    for (const page of pageBreaks) {
      pages.push({
        pageNumber: pages.length + 1,
        columnWidthsPt: monthColumnWidths(layout, months.length),
        months,
        monthRangeLabel:
          months.length === 0
            ? 'NO MONTH IN RANGE'
            : months.length === 1
              ? months[0].shortLabel
              : months[0].shortLabel + ' - ' + months[months.length - 1].shortLabel,
        blocks: page.blocks,
        showTotals: page.showTotals,
        totals: {
          cells: months.map((month) => {
            const entry = totalByKey.get(month.key);
            return {
              debit: groupMoney(entry?.debit ?? '0.00'),
              credit: groupMoney(entry?.credit ?? '0.00'),
            };
          }),
          openingDebit: groupMoney(result.totals.totalOpeningDebit),
          openingCredit: groupMoney(result.totals.totalOpeningCredit),
          closingDebit: groupMoney(result.totals.totalClosingDebit),
          closingCredit: groupMoney(result.totals.totalClosingCredit),
        },
      });
    }
  }

  return {
    reportTitle: AWB_MONTH_REPORT_TITLE,
    orientation: 'landscape',
    company: companyHeader,
    financialYear: result.meta.financialYearName,
    periodFrom: isoToDisplay(result.appliedFilters.fromDate),
    periodTo: isoToDisplay(result.appliedFilters.toDate),
    layout,
    monthColumnsPerPage: perPage,
    pages,
    totals: result.totals,
    notes: [
      'Monthly Debit/Credit are net movements inside the actual selected date range.',
      'Opening is the balance immediately before the From date; Closing is opening plus all period movements.',
      'Wide periods are split into month bands; every band repeats the account identity and totals.',
    ],
  };
}