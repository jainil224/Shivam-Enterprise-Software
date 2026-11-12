// Minimal, dependency-free PDF writer (PDF 1.4).
// Produces a genuine multi-page .pdf with base-14 Courier fonts so text widths
// are deterministic and columns can be measured instead of guessed.
// No external PDF library is installed in this project, so this mirrors the
// hand-rolled approach already used by xlsxWriter.ts.

export type PdfAlign = 'left' | 'right' | 'center';

export interface PdfColumn {
  key: string;
  label: string;
  /** Relative width hint taken from the report column catalogue. */
  weight: number;
  align: PdfAlign;
}

export type PdfRowKind = 'data' | 'group' | 'subtotal' | 'detail' | 'total';

export interface PdfRow {
  cells: string[];
  kind?: PdfRowKind;
}

export interface PdfHeaderInfo {
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  financialYear: string;
  reportTitle: string;
  reportType: string;
  dateRange: string;
  filters: string[];
}

export interface PdfLayoutColumn {
  label: string;
  width: number;
  align: PdfAlign;
  maxChars: number;
}

export interface PdfLayout {
  orientation: 'portrait' | 'landscape';
  pageWidth: number;
  pageHeight: number;
  fontSize: number;
  leading: number;
  usableWidth: number;
  columns: PdfLayoutColumn[];
}

export interface PdfBuildOptions {
  orientation: 'portrait' | 'landscape';
  header: PdfHeaderInfo;
  columns: PdfColumn[];
  rows: PdfRow[];
  generatedAt?: Date;
}

export interface PdfBuildResult {
  buffer: Buffer;
  pageCount: number;
  layout: PdfLayout;
}

export const PAGE_SIZES = {
  portrait: { width: 595.28, height: 841.89 },
  landscape: { width: 841.89, height: 595.28 },
} as const;

const MARGIN_LEFT = 24;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 30;
const FOOTER_HEIGHT = 16;
export const COURIER_ADVANCE = 0.6; // Courier advance width in em units.

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Characters that have no single-byte WinAnsi code point but are common in ERP
 * data. They are transliterated so amounts and names never lose their meaning.
 */
const CHAR_REPLACEMENTS: Record<string, string> = {
  '\u20B9': 'Rs.',
  '\u2012': '-',
  '\u2013': '-',
  '\u2014': '-',
  '\u2015': '-',
  '\u2212': '-',
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201B': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2026': '...',
  '\u2022': '-',
  '\u00B7': '-',
  '\u2044': '/',
  '\u00D7': 'x',
  '\u2192': '->',
  '\u2190': '<-',
  '\u00B0': ' deg',
  '\u00BD': '1/2',
  '\u00BC': '1/4',
  '\u00BE': '3/4',
  '\u00AE': '(R)',
  '\u00A9': '(C)',
  '\u2122': '(TM)',
  '\u00A0': ' ',
};

/**
 * Sanitises text to the WinAnsi byte range that the base-14 Courier fonts can
 * render. Latin-1 (U+00A0-U+00FF) is kept and written as an octal escape by
 * escapePdfText(), so accented names survive. Everything outside WinAnsi is
 * either transliterated above or replaced with "?" - that is the documented
 * limitation: non-Latin scripts (Devanagari, Gujarati, CJK) are not embedded.
 */
export function winAnsi(value: string): string {
  let out = '';
  for (const char of String(value ?? '')) {
    const replacement = CHAR_REPLACEMENTS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      out += char;
      continue;
    }
    out += '?';
  }
  return out;
}

/** Escapes a WinAnsi string for a PDF literal, octal-escaping the high bytes. */
function escapePdfText(value: string): string {
  let out = '';
  for (const char of winAnsi(value)) {
    if (char === '\\') out += '\\\\';
    else if (char === '(') out += '\\(';
    else if (char === ')') out += '\\)';
    else {
      const code = char.charCodeAt(0);
      out += code < 0x20 || code > 0x7e ? '\\' + code.toString(8).padStart(3, '0') : char;
    }
  }
  return out;
}

export function textWidth(text: string, fontSize: number): number {
  return winAnsi(text).length * fontSize * COURIER_ADVANCE;
}

export function fitText(text: string, maxChars: number): string {
  const clean = winAnsi(text);
  if (clean.length <= maxChars) return clean;
  if (maxChars <= 3) return clean.slice(0, Math.max(0, maxChars));
  return clean.slice(0, maxChars - 2) + '..';
}

/**
 * Computes a layout that always fits inside the printable width.
 * Column widths are proportional to the catalogue width hint but never below
 * the width needed for the header label; the font shrinks before anything is
 * clipped, and cell text is truncated to the measured capacity.
 */
export function computePdfLayout(columns: PdfColumn[], orientation: 'portrait' | 'landscape'): PdfLayout {
  const size = PAGE_SIZES[orientation];
  const usableWidth = size.width - MARGIN_LEFT - MARGIN_RIGHT;
  const safeColumns = columns.length > 0 ? columns : [{ key: 'empty', label: 'No columns', weight: 10, align: 'left' as PdfAlign }];

  let fontSize = safeColumns.length <= 8 ? 9 : safeColumns.length <= 12 ? 8 : safeColumns.length <= 18 ? 7 : 6;
  let widths: number[] = [];

  for (;;) {
    const charWidth = fontSize * COURIER_ADVANCE;
    const minWidths = safeColumns.map((column) => {
      const labelChars = Math.min(Math.max(column.label.length, 4), 14);
      return labelChars * charWidth + 5;
    });
    const totalWeight = safeColumns.reduce((sum, column) => sum + Math.max(1, column.weight), 0);
    widths = safeColumns.map((column, index) => {
      const proportional = (usableWidth * Math.max(1, column.weight)) / totalWeight;
      return Math.max(proportional, minWidths[index]);
    });
    const sum = widths.reduce((total, width) => total + width, 0);
    if (sum > usableWidth) {
      const scale = usableWidth / sum;
      widths = widths.map((width) => width * scale);
    }
    const tooNarrow = widths.some((width) => width < fontSize * COURIER_ADVANCE * 3);
    if ((tooNarrow || minWidths.reduce((total, width) => total + width, 0) > usableWidth) && fontSize > 5) {
      fontSize -= 0.5;
      continue;
    }
    break;
  }

  const charWidth = fontSize * COURIER_ADVANCE;
  const leading = round3(fontSize + 2.4);

  return {
    orientation,
    pageWidth: size.width,
    pageHeight: size.height,
    fontSize,
    leading,
    usableWidth,
    columns: safeColumns.map((column, index) => {
      const width = round3(widths[index]);
      return {
        label: column.label,
        width,
        align: column.align,
        maxChars: Math.max(1, Math.floor((width - 4) / charWidth)),
      };
    }),
  };
}

export interface TextOp {
  x: number;
  y: number;
  text: string;
  bold?: boolean;
  size?: number;
  /** Renders with Courier-Oblique / Courier-BoldOblique. */
  italic?: boolean;
  /**
   * Explicit fill colour for this text run. Defaults to black. Rects are written
   * before text, so without this every glyph inherits the last rectangle's fill
   * colour and prints washed-out (grey text on white paper).
   */
  color?: [number, number, number];
}

export interface RectOp {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: [number, number, number];
  stroke?: boolean;
}

export interface PageOps {
  texts: TextOp[];
  rects: RectOp[];
}

export function wrapText(text: string, maxChars: number): string[] {
  const clean = winAnsi(text).trim();
  if (clean.length === 0) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current = current + ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= maxChars) return [line];
    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += maxChars) {
      chunks.push(line.slice(index, index + maxChars));
    }
    return chunks;
  });
}

function alignX(cellX: number, width: number, text: string, fontSize: number, align: PdfAlign): number {
  if (align === 'right') return cellX + width - 2 - textWidth(text, fontSize);
  if (align === 'center') return cellX + Math.max(2, (width - textWidth(text, fontSize)) / 2);
  return cellX + 2;
}

export function buildContentStream(ops: PageOps): string {
  const parts: string[] = [];
  for (const rect of ops.rects) {
    if (rect.fill) {
      parts.push(
        round3(rect.fill[0]) + ' ' + round3(rect.fill[1]) + ' ' + round3(rect.fill[2]) + ' rg ' +
        round3(rect.x) + ' ' + round3(rect.y) + ' ' + round3(rect.width) + ' ' + round3(rect.height) + ' re f'
      );
    }
    if (rect.stroke) {
      parts.push('0.72 0.72 0.72 RG 0.4 w ' + round3(rect.x) + ' ' + round3(rect.y) + ' m ' + round3(rect.x + rect.width) + ' ' + round3(rect.y) + ' l S');
    }
  }
  for (const op of ops.texts) {
    const size = op.size ?? 8;
    const color = op.color ?? [0, 0, 0];
    parts.push(
      round3(color[0]) + ' ' + round3(color[1]) + ' ' + round3(color[2]) + ' rg ' +
      'BT /' + (op.bold ? (op.italic ? 'F4' : 'F2') : op.italic ? 'F3' : 'F1') + ' ' + round3(size) + ' Tf 1 0 0 1 ' +
      round3(op.x) + ' ' + round3(op.y) + ' Tm (' + escapePdfText(op.text) + ') Tj ET'
    );
  }
  return parts.join('\n');
}

function headerBlock(header: PdfHeaderInfo, layout: PdfLayout, top: number, continuation: boolean): { ops: PageOps; nextY: number } {
  const ops: PageOps = { texts: [], rects: [] };
  const left = MARGIN_LEFT;
  let y = top;

  if (continuation) {
    ops.texts.push({ x: left, y: y - 8, text: winAnsi(header.companyName) + ' - ' + winAnsi(header.reportTitle) + ' (continued)', bold: true, size: 8 });
    y -= 14;
    return { ops, nextY: y };
  }

  ops.texts.push({ x: left, y: y - 11, text: winAnsi(header.companyName), bold: true, size: 12 });
  y -= 15;

  const infoChars = Math.floor(layout.usableWidth / (8 * COURIER_ADVANCE));
  for (const line of wrapText(header.companyAddress, infoChars).slice(0, 2)) {
    ops.texts.push({ x: left, y: y - 8, text: line, size: 8 });
    y -= 10;
  }
  ops.texts.push({ x: left, y: y - 8, text: 'GSTIN: ' + winAnsi(header.companyGstin || 'Not recorded') + '    Financial Year: ' + winAnsi(header.financialYear), size: 8 });
  y -= 12;

  ops.rects.push({ x: left, y: y + 2, width: layout.usableWidth, height: 0.6, fill: [0.17, 0.37, 0.34] });
  y -= 6;

  ops.texts.push({ x: left, y: y - 10, text: winAnsi(header.reportTitle), bold: true, size: 10 });
  y -= 14;
  ops.texts.push({ x: left, y: y - 8, text: 'Report Type: ' + winAnsi(header.reportType) + '    Period: ' + winAnsi(header.dateRange), size: 8 });
  y -= 11;

  for (const line of header.filters.flatMap((filter) => wrapText(filter, infoChars)).slice(0, 6)) {
    ops.texts.push({ x: left, y: y - 8, text: line, size: 8 });
    y -= 10;
  }

  y -= 4;
  return { ops, nextY: y };
}

function tableHeader(layout: PdfLayout, top: number): { ops: PageOps; nextY: number } {
  const ops: PageOps = { texts: [], rects: [] };
  const height = layout.leading + 2;
  ops.rects.push({ x: MARGIN_LEFT, y: top - height, width: layout.usableWidth, height, fill: [0.17, 0.37, 0.34] });
  let x = MARGIN_LEFT;
  for (const column of layout.columns) {
    const label = fitText(column.label, column.maxChars);
    ops.texts.push({
      x: alignX(x, column.width, label, layout.fontSize, column.align),
      y: top - layout.leading + 2,
      text: label,
      bold: true,
      size: layout.fontSize,
      color: [1, 1, 1],
    });
    x += column.width;
  }
  return { ops, nextY: top - height };
}

function rowOps(layout: PdfLayout, row: PdfRow, top: number): { ops: PageOps; nextY: number; height: number } {
  const kind = row.kind ?? 'data';
  const height = layout.leading + (kind === 'group' || kind === 'total' ? 1.5 : 0.5);
  const ops: PageOps = { texts: [], rects: [] };
  const bold = kind === 'group' || kind === 'total' || kind === 'subtotal';
  const indent = kind === 'group' ? 0 : kind === 'detail' ? 8 : 0;

  if (kind === 'group') {
    ops.rects.push({ x: MARGIN_LEFT, y: top - height, width: layout.usableWidth, height, fill: [0.87, 0.92, 0.90] });
  } else if (kind === 'subtotal') {
    ops.rects.push({ x: MARGIN_LEFT, y: top - height, width: layout.usableWidth, height, fill: [0.95, 0.97, 0.96] });
  } else if (kind === 'total') {
    ops.rects.push({ x: MARGIN_LEFT, y: top - height, width: layout.usableWidth, height, fill: [0.78, 0.86, 0.83] });
  }

  // A group heading or a subtotal label starts in column 0 and spans every
  // leading column that has no value of its own. That keeps "Subtotal - Party"
  // readable instead of clipping it to the width of the Sr No column.
  let firstValueIndex = layout.columns.length;
  for (let index = 1; index < layout.columns.length; index += 1) {
    const candidate = row.cells[index];
    if (candidate !== undefined && String(candidate).trim().length > 0) {
      firstValueIndex = index;
      break;
    }
  }

  let x = MARGIN_LEFT;
  layout.columns.forEach((column, index) => {
    const raw = row.cells[index] ?? '';
    if (index > 0 && index < firstValueIndex) {
      x += column.width;
      return;
    }
    const spanWidth =
      index === 0 && firstValueIndex > 1
        ? layout.columns.slice(0, firstValueIndex).reduce((total, entry) => total + entry.width, 0)
        : column.width;
    const width = index === 0 ? spanWidth - indent : spanWidth;
    const charWidth = layout.fontSize * COURIER_ADVANCE;
    const maxChars = Math.max(1, Math.floor((width - 4) / charWidth));
    const text = fitText(raw, maxChars);
    if (text.length > 0) {
      const shiftedX = index === 0 ? x + indent : x;
      ops.texts.push({
        x: alignX(shiftedX, width, text, layout.fontSize, column.align),
        y: top - layout.leading + 1.5,
        text,
        bold,
        size: layout.fontSize,
      });
    }
    x += column.width;
  });

  ops.rects.push({ x: MARGIN_LEFT, y: top - height, width: layout.usableWidth, height: 0, stroke: true });
  return { ops, nextY: top - height, height };
}

function mergeOps(target: PageOps, addition: PageOps): void {
  target.texts.push(...addition.texts);
  target.rects.push(...addition.rects);
}

export function buildPdf(options: PdfBuildOptions): PdfBuildResult {
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const layout = computePdfLayout(options.columns, orientation);
  const rows = options.rows.length > 0 ? options.rows : [{ cells: ['No documents matched the selected filters.'], kind: 'data' as PdfRowKind }];

  // First pass: work out page breaks so "Page X of Y" is correct.
  const firstHeaderTop = layout.pageHeight - MARGIN_TOP;
  const probeHeader = headerBlock(options.header, layout, firstHeaderTop, false);
  const firstTableTop = probeHeader.nextY - 6;
  const probeTable = tableHeader(layout, firstTableTop);
  const firstBodyTop = probeTable.nextY;
  const bodyBottom = MARGIN_BOTTOM + FOOTER_HEIGHT;
  const firstCapacity = Math.max(1, Math.floor((firstBodyTop - bodyBottom) / (layout.leading + 2)));

  const contHeaderTop = layout.pageHeight - MARGIN_TOP;
  const probeCont = headerBlock(options.header, layout, contHeaderTop, true);
  const contTableTop = probeCont.nextY - 6;
  const probeContTable = tableHeader(layout, contTableTop);
  const contCapacity = Math.max(1, Math.floor((probeContTable.nextY - bodyBottom) / (layout.leading + 2)));

  const pages: PdfRow[][] = [];
  let index = 0;
  let capacity = firstCapacity;
  while (index < rows.length || pages.length === 0) {
    const slice = rows.slice(index, index + capacity);
    pages.push(slice);
    index += slice.length;
    capacity = contCapacity;
    if (slice.length === 0) break;
  }

  // Second pass: render each page.
  const rendered: PageOps[] = pages.map((pageRows, pageIndex) => {
    const ops: PageOps = { texts: [], rects: [] };
    const isFirst = pageIndex === 0;
    const header = headerBlock(options.header, layout, layout.pageHeight - MARGIN_TOP, !isFirst);
    mergeOps(ops, header.ops);
    const table = tableHeader(layout, header.nextY - 6);
    mergeOps(ops, table.ops);

    let y = table.nextY;
    for (const row of pageRows) {
      const renderedRow = rowOps(layout, row, y);
      mergeOps(ops, renderedRow.ops);
      y = renderedRow.nextY;
    }

    const generated = options.generatedAt ?? new Date();
    const stamp = generated.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    ops.texts.push({ x: MARGIN_LEFT, y: MARGIN_BOTTOM - 4, text: 'Generated ' + stamp, size: 7 });
    const pageLabel = 'Page ' + (pageIndex + 1) + ' of ' + pages.length;
    ops.texts.push({
      x: layout.pageWidth - MARGIN_RIGHT - textWidth(pageLabel, 7),
      y: MARGIN_BOTTOM - 4,
      text: pageLabel,
      size: 7,
    });
    return ops;
  });

  return { buffer: serializePdfPages(rendered, { width: layout.pageWidth, height: layout.pageHeight }), pageCount: rendered.length, layout };
}

// ---------------------------------------------------------------------------
// Phase 16.1 - traditional accounting-statement renderer.
//
// Produces the five-section Bank Reconciliation Statement as a white A4
// portrait document with thin black rules, repeating table headers and no
// decorative fills. Only presentation lives here: every figure is supplied by
// the caller from the existing reconciliation engine, which is never touched.
// ---------------------------------------------------------------------------

export interface StatementCell {
  /** Cell text exactly as it should print. */
  text: string;
  /** Relative column width, normalised against the other cells in the row. */
  weight: number;
  align: PdfAlign;
  bold?: boolean;
  italic?: boolean;
  /** Overrides the block font size for this cell only. */
  size?: number;
}

export interface StatementTableTotal {
  label: string;
  amount: string;
  /** Zero-based index of the amount column the total is right-aligned to. */
  amountColumn: number;
}

export type StatementBlock =
  /** One bordered row, optionally split into vertical cells. */
  | { type: 'row'; cells: StatementCell[]; size?: number }
  /** Bordered table with a repeating header, an All Clear fallback and a total row. */
  | {
      type: 'table';
      columns: StatementCell[];
      rows: string[][];
      emptyText?: string;
      total?: StatementTableTotal;
      /** Final row aligned 1:1 to the table columns (e.g. two money totals). */
      totalRow?: StatementCell[];
      size?: number;
    }
  | { type: 'spacer'; height?: number }
  /** Free text printed outside the bordered statement, e.g. a difference warning. */
  | { type: 'note'; text: string; size?: number; bold?: boolean; italic?: boolean; align?: PdfAlign }
  | { type: 'pageBreak' };

export interface StatementHeaderInfo {
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  financialYear: string;
  /** Report title, printed centred and bold italic. */
  title: string;
  /** Bank book name, printed centred and bold. */
  bankName?: string;
  /** Period line, printed centred beneath the title. */
  period?: string;
  /** Optional company PAN, printed in the letterhead contact line. */
  companyPan?: string;
  /** Optional company phone, printed in the letterhead contact line. */
  companyPhone?: string;
  /** Optional company email, printed in the letterhead contact line. */
  companyEmail?: string;
  /** Ledger name line printed under the title in letterhead mode. */
  ledgerName?: string;
}

export interface StatementBuildOptions {
  orientation: 'portrait' | 'landscape';
  /**
   * centered (default) keeps the boxed Phase 16.1 header untouched.
   * letterhead prints a classic left/right company letterhead for ledgers.
   */
  headerMode?: 'centered' | 'letterhead';
  header: StatementHeaderInfo;
  blocks: StatementBlock[];
  generatedAt?: Date;
}

export interface StatementBuildResult {
  buffer: Buffer;
  pageCount: number;
}

const STMT_MARGIN_X = 28;
const STMT_MARGIN_TOP = 30;
const STMT_MARGIN_BOTTOM = 36;
const STMT_FOOTER_Y = 20;
const STMT_BORDER = 0.5;
const STMT_BORDER_COLOR: [number, number, number] = [0, 0, 0];
const STMT_FONT_SIZE = 8.5;
const STMT_MIN_ROW_HEIGHT = 12;
const STMT_ROW_PADDING = 5;
const STMT_CELL_PADDING = 3;
const STMT_MIN_FONT_SIZE = 7;

/** Row height for a font size: glyph box plus padding, never below the minimum. */
function statementRowHeight(fontSize: number): number {
  return Math.max(STMT_MIN_ROW_HEIGHT, Math.round((fontSize + STMT_ROW_PADDING) * 100) / 100);
}

/**
 * Fits text into a cell without clipping glyphs. The font shrinks down to the
 * minimum readable size first; only then is the string truncated.
 */
function fitCellText(
  text: string,
  maxWidth: number,
  preferredSize: number
): { value: string; fontSize: number } {
  const clean = winAnsi(text);
  let fontSize = preferredSize;
  while (fontSize > STMT_MIN_FONT_SIZE && textWidth(clean, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }
  const capacity = Math.max(1, Math.floor(maxWidth / (fontSize * COURIER_ADVANCE)));
  return { value: fitText(clean, capacity), fontSize };
}

export function buildStatementPdf(options: StatementBuildOptions): StatementBuildResult {
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const size = PAGE_SIZES[orientation];
  const left = STMT_MARGIN_X;
  const usableWidth = size.width - STMT_MARGIN_X * 2;
  const bodyBottom = STMT_MARGIN_BOTTOM;
  const pages: PageOps[] = [];
  let ops: PageOps = { texts: [], rects: [] };
  let y = size.height - STMT_MARGIN_TOP;

  const newPage = (): void => {
    pages.push(ops);
    ops = { texts: [], rects: [] };
    y = size.height - STMT_MARGIN_TOP;
  };

  const ensureSpace = (height: number): void => {
    if (y - height < bodyBottom) newPage();
  };

  /** Closed thin black frame around one cell or row. */
  const frame = (x: number, top: number, width: number, height: number): void => {
    ops.rects.push({ x, y: top - STMT_BORDER, width, height: STMT_BORDER, fill: STMT_BORDER_COLOR });
    ops.rects.push({ x, y: top - height, width, height: STMT_BORDER, fill: STMT_BORDER_COLOR });
    ops.rects.push({ x, y: top - height, width: STMT_BORDER, height, fill: STMT_BORDER_COLOR });
    ops.rects.push({
      x: x + width - STMT_BORDER,
      y: top - height,
      width: STMT_BORDER,
      height,
      fill: STMT_BORDER_COLOR,
    });
  };

  const verticalRule = (x: number, top: number, height: number): void => {
    ops.rects.push({ x, y: top - height, width: STMT_BORDER, height, fill: STMT_BORDER_COLOR });
  };

  const drawText = (
    text: string,
    cellLeft: number,
    cellWidth: number,
    top: number,
    height: number,
    fontSize: number,
    align: PdfAlign,
    bold: boolean,
    italic: boolean
  ): void => {
    if (text.length === 0) return;
    const inner = Math.max(1, cellWidth - STMT_CELL_PADDING * 2);
    const fitted = fitCellText(text, inner, fontSize);
    const textW = textWidth(fitted.value, fitted.fontSize);
    const x =
      align === 'right'
        ? cellLeft + cellWidth - STMT_CELL_PADDING - textW
        : align === 'center'
          ? cellLeft + Math.max(STMT_CELL_PADDING, (cellWidth - textW) / 2)
          : cellLeft + STMT_CELL_PADDING;
    ops.texts.push({
      x,
      y: top - height / 2 - fitted.fontSize * 0.32,
      text: fitted.value,
      size: fitted.fontSize,
      bold,
      italic,
    });
  };

  const drawTable = (block: Extract<StatementBlock, { type: 'table' }>): void => {
    const fontSize = block.size ?? STMT_FONT_SIZE;
    const headerHeight = statementRowHeight(fontSize);
    const rowHeight = statementRowHeight(fontSize);
    const totalHeight = block.total ? statementRowHeight(fontSize) : 0;
    const totalRowHeight = block.totalRow && block.totalRow.length > 0 ? statementRowHeight(fontSize) : 0;
    const columns =
      block.columns.length > 0
        ? block.columns
        : [{ text: '', weight: 10, align: 'left' as PdfAlign }];
    const totalWeight = columns.reduce((sum, column) => sum + Math.max(1, column.weight), 0);
    const widths = columns.map((column) => (usableWidth * Math.max(1, column.weight)) / totalWeight);
    const columnLeft = (index: number): number =>
      left + widths.slice(0, index).reduce((sum, width) => sum + width, 0);

    const drawHeader = (): void => {
      frame(left, y, usableWidth, headerHeight);
      columns.forEach((column, index) => {
        if (index > 0) verticalRule(columnLeft(index), y, headerHeight);
        drawText(
          column.text,
          columnLeft(index),
          widths[index],
          y,
          headerHeight,
          column.size ?? fontSize,
          column.align,
          true,
          column.italic ?? false
        );
      });
      y -= headerHeight;
    };

    // Never strand a header at the foot of a page without a row and the total.
    ensureSpace(headerHeight + rowHeight + totalHeight + totalRowHeight);
    drawHeader();

    if (block.rows.length === 0) {
      frame(left, y, usableWidth, rowHeight);
      drawText(
        block.emptyText ?? 'All Clear',
        left,
        usableWidth,
        y,
        rowHeight,
        fontSize,
        'center',
        false,
        true
      );
      y -= rowHeight;
    } else {
      for (const row of block.rows) {
        if (y - rowHeight < bodyBottom) {
          newPage();
          drawHeader();
        }
        frame(left, y, usableWidth, rowHeight);
        columns.forEach((column, index) => {
          if (index > 0) verticalRule(columnLeft(index), y, rowHeight);
          drawText(
            String(row[index] ?? ''),
            columnLeft(index),
            widths[index],
            y,
            rowHeight,
            fontSize,
            column.align,
            false,
            false
          );
        });
        y -= rowHeight;
      }
    }

    if (block.totalRow && block.totalRow.length > 0) {
      if (y - totalRowHeight < bodyBottom) {
        newPage();
        drawHeader();
      }
      frame(left, y, usableWidth, totalRowHeight);
      columns.forEach((column, index) => {
        if (index > 0) verticalRule(columnLeft(index), y, totalRowHeight);
        const cell = block.totalRow![index];
        drawText(
          cell?.text ?? '',
          columnLeft(index),
          widths[index],
          y,
          totalRowHeight,
          cell?.size ?? fontSize,
          cell?.align ?? column.align,
          true,
          cell?.italic ?? false
        );
      });
      y -= totalRowHeight;
    }

    if (block.total) {
      if (y - totalHeight < bodyBottom) {
        newPage();
        drawHeader();
      }
      const amountColumn = Math.min(Math.max(block.total.amountColumn, 0), columns.length - 1);
      const amountLeft = columnLeft(amountColumn);
      frame(left, y, usableWidth, totalHeight);
      drawText(
        block.total.label,
        left,
        amountLeft - left,
        y,
        totalHeight,
        fontSize,
        'right',
        true,
        false
      );
      drawText(
        block.total.amount,
        amountLeft,
        widths[amountColumn],
        y,
        totalHeight,
        fontSize,
        'right',
        true,
        false
      );
      y -= totalHeight;
    }
  };

  // --- Company header -------------------------------------------------------
  const header = options.header;
  const headerMode = options.headerMode ?? 'centered';

  const freeText = (
    text: string,
    x: number,
    baseline: number,
    fontSize: number,
    bold = false,
    italic = false
  ): void => {
    if (text.length === 0) return;
    ops.texts.push({ x, y: baseline, text: winAnsi(text), size: fontSize, bold, italic });
  };

  const rule = (): void => {
    ops.rects.push({ x: left, y, width: usableWidth, height: 1, fill: STMT_BORDER_COLOR });
  };

  if (headerMode === 'letterhead') {
    // Classic accounting letterhead: company block on the left, GSTIN on the
    // right, a full-width rule, then the report identity centred.
    const nameSize = 13;
    let baseline = y - nameSize;
    freeText(header.companyName, left + 2, baseline, nameSize, true);
    const gstinText = 'GSTIN : ' + (header.companyGstin || 'Not recorded');
    freeText(gstinText, left + usableWidth - textWidth(gstinText, 8.5) - 2, baseline, 8.5);
    y = baseline - 7;

    const bodySize = 8.5;
    const capacity = Math.max(10, Math.floor((usableWidth - 6) / (bodySize * COURIER_ADVANCE)));

    if (header.companyAddress) {
      for (const line of wrapText(header.companyAddress, capacity)) {
        y -= bodySize + 2;
        freeText(line, left + 2, y, bodySize);
      }
    }

    const contact: string[] = [];
    if (header.companyPhone) contact.push('Phone: ' + header.companyPhone);
    if (header.companyEmail) contact.push('Email: ' + header.companyEmail);
    if (header.companyPan) contact.push('PAN: ' + header.companyPan);
    if (contact.length > 0) {
      y -= bodySize + 2;
      freeText(fitText(winAnsi(contact.join('   ')), capacity), left + 2, y, bodySize);
    }

    if (header.financialYear) {
      y -= bodySize + 2;
      freeText('Financial Year: ' + header.financialYear, left + 2, y, bodySize);
    }

    y -= 7;
    rule();
    y -= 12;

    const titleSize = 11;
    const titleWidth = textWidth(header.title, titleSize);
    y -= titleSize;
    freeText(header.title, left + Math.max(0, (usableWidth - titleWidth) / 2), y, titleSize, true, true);

    if (header.ledgerName) {
      const ledgerSize = 9.5;
      const ledgerWidth = textWidth(header.ledgerName, ledgerSize);
      y -= ledgerSize + 3;
      freeText(header.ledgerName, left + Math.max(0, (usableWidth - ledgerWidth) / 2), y, ledgerSize, true);
    }

    if (header.period) {
      const periodSize = 8.5;
      const periodWidth = textWidth(header.period, periodSize);
      y -= periodSize + 3;
      freeText(header.period, left + Math.max(0, (usableWidth - periodWidth) / 2), y, periodSize);
    }

    y -= 9;
    rule();
    y -= 10;
  } else {
    const header = options.header;
    const nameHeight = statementRowHeight(13);
    const yearHeight = statementRowHeight(8.5);
    ensureSpace(nameHeight + yearHeight);
    frame(left, y, usableWidth, nameHeight + yearHeight);
    drawText(header.companyName, left, usableWidth, y, nameHeight, 13, 'center', true, true);
    drawText(header.financialYear, left, usableWidth, y - nameHeight, yearHeight, 8.5, 'center', false, false);
    y -= nameHeight + yearHeight;

    if (header.companyAddress) {
      const addressHeight = statementRowHeight(8.5);
      ensureSpace(addressHeight);
      frame(left, y, usableWidth, addressHeight);
      drawText(header.companyAddress, left, usableWidth, y, addressHeight, 8.5, 'center', false, false);
      y -= addressHeight;
    }

    const gstinHeight = statementRowHeight(8.5);
    ensureSpace(gstinHeight);
    frame(left, y, usableWidth, gstinHeight);
    drawText(
      'GSTIN: ' + (header.companyGstin || 'Not recorded'),
      left,
      usableWidth,
      y,
      gstinHeight,
      8.5,
      'left',
      false,
      false
    );
    y -= gstinHeight;

    if (header.bankName) {
      const bankHeight = statementRowHeight(9.5);
      ensureSpace(bankHeight);
      frame(left, y, usableWidth, bankHeight);
      drawText('BANK : ' + header.bankName, left, usableWidth, y, bankHeight, 9.5, 'center', true, false);
      y -= bankHeight;
    }

    const titleHeight = statementRowHeight(10);
    const periodHeight = header.period ? statementRowHeight(8.5) : 0;
    ensureSpace(titleHeight + periodHeight);
    frame(left, y, usableWidth, titleHeight + periodHeight);
    drawText(header.title, left, usableWidth, y, titleHeight, 10, 'center', true, true);
    if (header.period) {
      drawText(header.period, left, usableWidth, y - titleHeight, periodHeight, 8.5, 'center', false, false);
    }
    y -= titleHeight + periodHeight;
  }

  // --- Body blocks ----------------------------------------------------------
  for (const block of options.blocks) {
    if (block.type === 'pageBreak') {
      newPage();
      continue;
    }

    if (block.type === 'spacer') {
      const height = block.height ?? 8;
      ensureSpace(height);
      y -= height;
      continue;
    }

    if (block.type === 'note') {
      const noteSize = block.size ?? 8;
      const maxChars = Math.max(20, Math.floor((usableWidth - 4) / (noteSize * COURIER_ADVANCE)));
      const lines = wrapText(block.text, maxChars);
      const height = lines.length * (noteSize + 3) + 4;
      ensureSpace(height);
      const align = block.align ?? 'left';
      for (const line of lines) {
        const textW = textWidth(line, noteSize);
        const x =
          align === 'center'
            ? left + Math.max(0, (usableWidth - textW) / 2)
            : align === 'right'
              ? left + usableWidth - textW
              : left + 2;
        ops.texts.push({
          x,
          y: y - noteSize,
          text: line,
          size: noteSize,
          bold: block.bold ?? false,
          italic: block.italic ?? false,
        });
        y -= noteSize + 3;
      }
      y -= 4;
      continue;
    }

    if (block.type === 'row') {
      const rowSize = block.size ?? STMT_FONT_SIZE;
      const height = statementRowHeight(rowSize);
      ensureSpace(height);
      frame(left, y, usableWidth, height);
      const totalWeight = block.cells.reduce((sum, cell) => sum + Math.max(1, cell.weight), 0);
      let cellLeft = left;
      block.cells.forEach((cell, index) => {
        const cellWidth = (usableWidth * Math.max(1, cell.weight)) / totalWeight;
        if (index > 0) verticalRule(cellLeft, y, height);
        drawText(
          cell.text,
          cellLeft,
          cellWidth,
          y,
          height,
          cell.size ?? rowSize,
          cell.align,
          cell.bold ?? false,
          cell.italic ?? false
        );
        cellLeft += cellWidth;
      });
      y -= height;
      continue;
    }

    drawTable(block);
  }

  pages.push(ops);

  // --- Footer on every page -------------------------------------------------
  const generated = options.generatedAt ?? new Date();
  const stamp = generated.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  pages.forEach((pageOps, pageIndex) => {
    pageOps.texts.push({ x: left, y: STMT_FOOTER_Y, text: 'Generated ' + stamp, size: 7 });
    const pageLabel = 'Page ' + (pageIndex + 1) + ' of ' + pages.length;
    pageOps.texts.push({
      x: size.width - STMT_MARGIN_X - textWidth(pageLabel, 7),
      y: STMT_FOOTER_Y,
      text: pageLabel,
      size: 7,
    });
  });

  return { buffer: serializePdfPages(pages, size), pageCount: pages.length };
}

/**
 * Serialises finished page operations into a genuine PDF 1.4 byte stream.
 * Every statement builder shares this single writer, so exactly one place knows
 * the PDF object graph.
 */
export function serializePdfPages(pages: PageOps[], size: { width: number; height: number }): Buffer {
  // --- Object graph ---------------------------------------------------------
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('__PAGES_PLACEHOLDER__');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Oblique /Encoding /WinAnsiEncoding >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-BoldOblique /Encoding /WinAnsiEncoding >>');

  const kids: number[] = [];
  for (const pageOps of pages) {
    const stream = buildContentStream(pageOps);
    const pageNumber = addObject('__PAGE_PLACEHOLDER__');
    const contentNumber = addObject(
      '<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream'
    );
    objects[pageNumber - 1] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + round3(size.width) + ' ' + round3(size.height) + '] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> /Contents ' +
      contentNumber +
      ' 0 R >>';
    kids.push(pageNumber);
  }
  objects[1] =
    '<< /Type /Pages /Kids [' + kids.map((kid) => kid + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';

  const headerBuffer = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks: Buffer[] = [headerBuffer];
  const offsets: number[] = [];
  let cursor = headerBuffer.length;
  objects.forEach((body, objectIndex) => {
    offsets.push(cursor);
    const chunk = Buffer.from(objectIndex + 1 + ' 0 obj\n' + body + '\nendobj\n', 'latin1');
    chunks.push(chunk);
    cursor += chunk.length;
  });

  const xrefOffset = cursor;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (const offset of offsets) {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
  chunks.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(chunks);
}