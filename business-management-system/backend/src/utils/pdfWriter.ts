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

const PAGE_SIZES = {
  portrait: { width: 595.28, height: 841.89 },
  landscape: { width: 841.89, height: 595.28 },
} as const;

const MARGIN_LEFT = 24;
const MARGIN_RIGHT = 24;
const MARGIN_TOP = 28;
const MARGIN_BOTTOM = 30;
const FOOTER_HEIGHT = 16;
const COURIER_ADVANCE = 0.6; // Courier advance width in em units.

function round3(value: number): number {
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
function winAnsi(value: string): string {
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

function textWidth(text: string, fontSize: number): number {
  return winAnsi(text).length * fontSize * COURIER_ADVANCE;
}

function fitText(text: string, maxChars: number): string {
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

interface TextOp {
  x: number;
  y: number;
  text: string;
  bold?: boolean;
  size?: number;
}

interface RectOp {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: [number, number, number];
  stroke?: boolean;
}

interface PageOps {
  texts: TextOp[];
  rects: RectOp[];
}

function wrapText(text: string, maxChars: number): string[] {
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

function buildContentStream(ops: PageOps): string {
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
    parts.push(
      'BT /' + (op.bold ? 'F2' : 'F1') + ' ' + round3(size) + ' Tf 1 0 0 1 ' +
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

  // Assemble the PDF object graph.
  const objects: string[] = [];
  const addObject = (body: string): number => {
    objects.push(body);
    return objects.length;
  };

  addObject('<< /Type /Catalog /Pages 2 0 R >>');
  addObject('__PAGES_PLACEHOLDER__');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>');

  const kids: number[] = [];
  for (const ops of rendered) {
    const stream = buildContentStream(ops);
    const pageNumber = addObject('__PAGE_PLACEHOLDER__');
    const contentNumber = addObject('<< /Length ' + Buffer.byteLength(stream, 'latin1') + ' >>\nstream\n' + stream + '\nendstream');
    objects[pageNumber - 1] =
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + round3(layout.pageWidth) + ' ' + round3(layout.pageHeight) + '] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + contentNumber + ' 0 R >>';
    kids.push(pageNumber);
  }
  objects[1] = '<< /Type /Pages /Kids [' + kids.map((kid) => kid + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';

  const headerBuffer = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks: Buffer[] = [headerBuffer];
  const offsets: number[] = [];
  let cursor = headerBuffer.length;
  objects.forEach((body, objectIndex) => {
    offsets.push(cursor);
    const chunk = Buffer.from((objectIndex + 1) + ' 0 obj\n' + body + '\nendobj\n', 'latin1');
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

  return { buffer: Buffer.concat(chunks), pageCount: rendered.length, layout };
}
