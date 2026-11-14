import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  Printer,
  Save,
  X,
} from 'lucide-react';
import {
  exportAccountWiseBalanceMonthWisePdf,
  exportAccountWiseBalancePdf,
  queryAccountWiseBalance,
  queryAccountWiseBalanceMonthWise,
} from '../services/api';
import type {
  AccountWiseBalanceQueryRequest,
  AccountWiseBalanceResult,
  AccountWiseCompanyHeader,
  AccountWiseMonthPrintDocument,
  AccountWiseMonthPrintPage,
  AccountWiseMonthWiseResult,
  AccountWisePrintBlock,
  AccountWisePrintDocument,
  AccountWisePrintLayout,
  AccountWisePrintPage,
} from '../types/accountWiseBalance';
import { readPreviewState } from './accountWiseBalanceShared';
import { downloadBlob, readError } from './ledgerReportShared';

const BASE = '/reports/final-reports/account-wise-balance';

/** Points to CSS pixels so the sheet geometry matches the PDF exactly. */
const PT_TO_PX = 96 / 72;
const px = (points: number): string => (points * PT_TO_PX).toFixed(2) + 'px';

const BORDER = '0.6pt solid #000000';
/** Arial/Helvetica is the traditional accounting face; the PDF uses Helvetica. */
const SANS = 'Arial, Helvetica, "Liberation Sans", sans-serif';
const COLUMN_LABELS = ['ACCOUNT NAME', 'DEBIT', 'CREDIT'];

/** Mirrors AWB_GEOMETRY in accountWiseBalancePrint.ts. */
const BLOCK_NAME_LINE = 13;
const BLOCK_DETAIL_LINE = 10;
const BLOCK_PAD_TOP = 3;

/** Grid template from the exact column widths the backend printed. */
const template = (widths: number[]): string => widths.map((width) => px(width)).join(' ');

const PageFrame: React.FC<{ layout: AccountWisePrintLayout; children: React.ReactNode }> = ({
  layout,
  children,
}) => (
  <div
    className={
      'ledger-sheet awb-sheet awb-sheet-' + layout.orientation + ' relative bg-white text-black'
    }
    style={{
      width: px(layout.pageWidthPt),
      height: px(layout.pageHeightPt),
      fontFamily: SANS,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        left: px(layout.outerPt),
        top: px(layout.outerPt),
        width: px(layout.pageWidthPt - layout.outerPt * 2),
        height: px(layout.pageHeightPt - layout.outerPt * 2),
        border: BORDER,
      }}
    />
    {children}
  </div>
);

/** Absolute box anchored to the top content edge, like the PDF writer. */
const ContentBox: React.FC<{
  layout: AccountWisePrintLayout;
  top: number;
  height: number;
  children: React.ReactNode;
  bordered?: boolean;
}> = ({ layout, top, height, children, bordered = true }) => (
  <div
    style={{
      position: 'absolute',
      left: px(layout.contentLeftPt),
      top: px(layout.pageHeightPt - top),
      width: px(layout.contentWidthPt),
      height: px(height),
      border: bordered ? BORDER : undefined,
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

const CompanyHeader: React.FC<{
  layout: AccountWisePrintLayout;
  company: AccountWiseCompanyHeader;
  financialYear: string;
  title: string;
  periodFrom: string;
  periodTo: string;
  pageIndex: number;
  pageCount: number;
}> = ({ layout, company, financialYear, title, periodFrom, periodTo, pageIndex, pageCount }) => {
  const t = layout.typography;
  const cell = 'border-b border-black';
  return (
    <ContentBox layout={layout} top={layout.contentTopPt} height={layout.headerHeightPt}>
      {/* Company name centred, financial year right aligned on the same line. */}
      <div className="relative" style={{ height: px(layout.nameHeightPt) }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: px(layout.companyNameWidthPt),
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            overflow: 'hidden',
          }}
        >
          {layout.companyNameLines.map((line, index) => (
            <p
              key={index}
              style={{
                fontSize: px(t.companyNamePt),
                lineHeight: px(t.companyNamePt + 3),
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {line}
            </p>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            right: px(3),
            top: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: px(t.financialYearPt), fontWeight: 700 }}>{financialYear}</span>
        </div>
      </div>

      {/* Company address, centred. */}
      <div
        className={cell + ' flex flex-col justify-center'}
        style={{
          height: px(layout.addressHeightPt),
          paddingLeft: px(3),
          paddingRight: px(3),
          overflow: 'hidden',
        }}
      >
        {company.addressLines.map((line, index) => (
          <p
            key={index}
            style={{
              fontSize: px(t.addressPt),
              lineHeight: px(10),
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* PAN left, TAN right only when the Company Master stores one. */}
      <div
        className={cell + ' flex items-center'}
        style={{
          height: px(layout.panHeightPt),
          paddingLeft: px(3),
          paddingRight: px(3),
          overflow: 'hidden',
        }}
      >
        <p style={{ flex: '1 1 55%', fontSize: px(t.metaPt), whiteSpace: 'nowrap' }}>
          PAN NO: {company.panNumber ?? ''}
        </p>
        {company.tanNumber !== null && (
          <p
            style={{
              flex: '0 0 45%',
              textAlign: 'right',
              fontSize: px(t.metaPt),
              whiteSpace: 'nowrap',
            }}
          >
            TAN NO: {company.tanNumber}
          </p>
        )}
      </div>

      {/* Report title, centred and bold. */}
      <div className={cell + ' flex items-center justify-center'} style={{ height: px(layout.titleHeightPt) }}>
        <p style={{ fontSize: px(t.titlePt), fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
          {title}
        </p>
      </div>

      {/* GSTIN left, period centred, page number right. */}
      <div
        className="flex items-center"
        style={{ height: px(layout.metaHeightPt), paddingLeft: px(3), paddingRight: px(3), overflow: 'hidden' }}
      >
        <p style={{ width: '32%', fontSize: px(t.metaPt), whiteSpace: 'nowrap' }}>
          GSTIN: {company.gstin ?? ''}
        </p>
        <p style={{ width: '40%', textAlign: 'center', fontSize: px(t.metaPt), whiteSpace: 'nowrap' }}>
          PERIOD: {periodFrom} TO {periodTo}
        </p>
        <p style={{ width: '28%', textAlign: 'right', fontWeight: 700, fontSize: px(t.metaPt), whiteSpace: 'nowrap' }}>
          PAGE {pageIndex + 1} OF {pageCount}
        </p>
      </div>
    </ContentBox>
  );
};
/** Exact column offsets in points, relative to the content left edge. */
const offsets = (widths: number[]): number[] => {
  const xs: number[] = [];
  let cursor = 0;
  for (const width of widths) {
    xs.push(cursor);
    cursor += width;
  }
  return xs;
};

/**
 * One bordered table row. The top rule always comes from the row above (the
 * table head ends with a bottom rule), so adjacent rows never double a border.
 */
const SheetRow: React.FC<{
  layout: AccountWisePrintLayout;
  top: number;
  height: number;
  widths: number[];
  children: React.ReactNode;
}> = ({ layout, top, height, widths, children }) => (
  <div
    style={{
      position: 'absolute',
      left: px(layout.contentLeftPt),
      top: px(layout.pageHeightPt - top),
      width: px(layout.contentWidthPt),
      height: px(height),
      display: 'grid',
      gridTemplateColumns: template(widths),
      borderLeft: BORDER,
      borderRight: BORDER,
      borderBottom: BORDER,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}
  >
    {children}
  </div>
);

/** The repeated ACCOUNT NAME / DEBIT / CREDIT band. */
const AccountTableHead: React.FC<{ layout: AccountWisePrintLayout; widths: number[] }> = ({
  layout,
  widths,
}) => {
  const t = layout.typography;
  return (
    <ContentBox
      layout={layout}
      top={layout.bodyTopPt + layout.tableHeadHeightPt}
      height={layout.tableHeadHeightPt}
    >
      <div className="grid h-full" style={{ gridTemplateColumns: template(widths) }}>
        {COLUMN_LABELS.map((label, index) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: index === 0 ? 'flex-start' : 'flex-end',
              paddingLeft: px(3),
              paddingRight: px(3),
              borderLeft: index === 0 ? undefined : BORDER,
              fontSize: px(t.tableHeadPt),
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </ContentBox>
  );
};

/** One account block; the money sits on the last printed line of the block. */
const AccountBlockRow: React.FC<{
  layout: AccountWisePrintLayout;
  widths: number[];
  top: number;
  block: AccountWisePrintBlock;
}> = ({ layout, widths, top, block }) => {
  const t = layout.typography;
  const stackHeight =
    block.nameLines.length * BLOCK_NAME_LINE + block.detailLines.length * BLOCK_DETAIL_LINE;
  const amountPadBottom = Math.max(0, block.heightPt - BLOCK_PAD_TOP - stackHeight);
  const amountLineHeight = block.detailLines.length > 0 ? BLOCK_DETAIL_LINE : BLOCK_NAME_LINE;
  return (
    <SheetRow layout={layout} top={top} height={block.heightPt} widths={widths}>
      <div
        style={{
          paddingTop: px(BLOCK_PAD_TOP),
          paddingLeft: px(3),
          paddingRight: px(3),
          overflow: 'hidden',
        }}
      >
        {block.nameLines.map((line, index) => (
          <p
            key={'name-' + index}
            style={{
              fontSize: px(t.accountNamePt),
              lineHeight: px(BLOCK_NAME_LINE),
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {line}
          </p>
        ))}
        {block.detailLines.map((line, index) => (
          <p
            key={'detail-' + index}
            style={{
              fontSize: px(t.detailPt),
              lineHeight: px(BLOCK_DETAIL_LINE),
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {line}
          </p>
        ))}
      </div>
      {[block.debit, block.credit].map((amount, index) => (
        <div
          key={index === 0 ? 'debit' : 'credit'}
          style={{
            borderLeft: BORDER,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            paddingBottom: px(amountPadBottom),
            paddingLeft: px(3),
            paddingRight: px(3),
            overflow: 'hidden',
          }}
        >
          {amount.length > 0 && (
            <span
              style={{
                fontSize: px(t.amountPt),
                lineHeight: px(amountLineHeight),
                whiteSpace: 'nowrap',
              }}
            >
              {amount}
            </span>
          )}
        </div>
      ))}
    </SheetRow>
  );
};

/** The bold TOTAL row, printed on the last page of the document. */
const AccountTotalsRow: React.FC<{
  layout: AccountWisePrintLayout;
  widths: number[];
  top: number;
  totals: AccountWisePrintDocument['totals'];
}> = ({ layout, widths, top, totals }) => {
  const t = layout.typography;
  const cell = (value: string, align: 'left' | 'right', border: boolean) => (
    <div
      style={{
        borderLeft: border ? BORDER : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        paddingLeft: px(3),
        paddingRight: px(3),
        fontSize: px(t.totalPt),
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {value}
    </div>
  );
  return (
    <SheetRow layout={layout} top={top} height={layout.totalsHeightPt} widths={widths}>
      {cell('TOTAL', 'left', false)}
      {cell(totals.debit, 'right', true)}
      {cell(totals.credit, 'right', true)}
    </SheetRow>
  );
};

/** One printed A4 portrait page of the Account Wise Balance document. */
const AccountSheet: React.FC<{
  document: AccountWisePrintDocument;
  page: AccountWisePrintPage;
  pageIndex: number;
  pageCount: number;
}> = ({ document, page, pageIndex, pageCount }) => {
  const layout = document.layout;
  const widths = document.columnWidthsPt;
  const rows: Array<{ block: AccountWisePrintBlock; top: number }> = [];
  let top = layout.bodyTopPt;
  for (const block of page.blocks) {
    rows.push({ block, top });
    top -= block.heightPt;
  }
  return (
    <PageFrame layout={layout}>
      <CompanyHeader
        layout={layout}
        company={document.company}
        financialYear={document.financialYear}
        title={document.reportTitle}
        periodFrom={document.periodFrom}
        periodTo={document.periodTo}
        pageIndex={pageIndex}
        pageCount={pageCount}
      />
      <AccountTableHead layout={layout} widths={widths} />
      {rows.map((row, index) => (
        <AccountBlockRow
          key={pageIndex + '-' + index}
          layout={layout}
          widths={widths}
          top={row.top}
          block={row.block}
        />
      ))}
      {page.showTotals && (
        <AccountTotalsRow layout={layout} widths={widths} top={top} totals={document.totals} />
      )}
    </PageFrame>
  );
};
/* ----------------------- Account + Month Wise Balance ---------------------- */

const RULE = '0.6pt';

/** Absolutely placed text cell used by the two-row month band header. */
const AbsCell: React.FC<{
  left: number;
  top: number;
  width: number;
  height: number;
  size: number;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  children: React.ReactNode;
}> = ({ left, top, width, height, size, bold = false, align = 'center', children }) => (
  <div
    style={{
      position: 'absolute',
      left: px(left),
      top: px(top),
      width: px(width),
      height: px(height),
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
      paddingLeft: px(3),
      paddingRight: px(3),
      fontSize: px(size),
      fontWeight: bold ? 700 : 400,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

/** Two-row month band head: OPENING | APR.. | CLOSING over DEBIT/CREDIT pairs. */
const MonthTableHead: React.FC<{
  layout: AccountWisePrintLayout;
  page: AccountWiseMonthPrintPage;
}> = ({ layout, page }) => {
  const widths = page.columnWidthsPt;
  const xs = offsets(widths);
  const height = layout.tableHeadHeightPt;
  const half = height / 2;
  const last = widths.length - 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: px(layout.contentLeftPt),
        top: px(layout.pageHeightPt - (layout.bodyTopPt + height)),
        width: px(layout.contentWidthPt),
        height: px(height),
        borderLeft: BORDER,
        borderRight: BORDER,
        borderBottom: BORDER,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {xs.map((x, index) =>
        index === 0 ? null : (
          <div
            key={'rule-' + index}
            style={{
              position: 'absolute',
              left: px(x),
              top: 0,
              width: RULE,
              height: '100%',
              background: '#000000',
            }}
          />
        )
      )}
      <div
        style={{
          position: 'absolute',
          left: px(xs[1]),
          top: px(half),
          width: px(layout.contentWidthPt - xs[1]),
          height: RULE,
          background: '#000000',
        }}
      />
      <AbsCell left={0} top={0} width={widths[0]} height={height} size={8} bold align="left">
        ACCOUNT NAME
      </AbsCell>
      <AbsCell left={xs[1]} top={0} width={widths[1]} height={half} size={8} bold>
        OPENING
      </AbsCell>
      <AbsCell left={xs[1]} top={half} width={widths[1]} height={half} size={8} bold>
        BALANCE
      </AbsCell>
      {page.months.map((month, index) => {
        const debitIndex = 2 + index * 2;
        return (
          <React.Fragment key={month.key}>
            <AbsCell
              left={xs[debitIndex]}
              top={0}
              width={widths[debitIndex] + widths[debitIndex + 1]}
              height={half}
              size={7.5}
              bold
            >
              {month.shortLabel}
            </AbsCell>
            <AbsCell
              left={xs[debitIndex]}
              top={half}
              width={widths[debitIndex]}
              height={half}
              size={7}
              bold
            >
              DEBIT
            </AbsCell>
            <AbsCell
              left={xs[debitIndex + 1]}
              top={half}
              width={widths[debitIndex + 1]}
              height={half}
              size={7}
              bold
            >
              CREDIT
            </AbsCell>
          </React.Fragment>
        );
      })}
      <AbsCell left={xs[last]} top={0} width={widths[last]} height={half} size={8} bold>
        CLOSING
      </AbsCell>
      <AbsCell left={xs[last]} top={half} width={widths[last]} height={half} size={8} bold>
        BALANCE
      </AbsCell>
    </div>
  );
};

/** Money cell of a month row, aligned with the first line of the account name. */
const MonthAmountCell: React.FC<{
  border: boolean;
  size: number;
  bold?: boolean;
  children: React.ReactNode;
}> = ({ border, size, bold = false, children }) => (
  <div
    style={{
      borderLeft: border ? BORDER : undefined,
      paddingTop: px(BLOCK_PAD_TOP),
      paddingLeft: px(3),
      paddingRight: px(3),
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      overflow: 'hidden',
    }}
  >
    <span
      style={{
        fontSize: px(size),
        lineHeight: px(BLOCK_DETAIL_LINE),
        fontWeight: bold ? 700 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  </div>
);

const MonthBlockRow: React.FC<{
  layout: AccountWisePrintLayout;
  widths: number[];
  top: number;
  block: AccountWiseMonthPrintPage['blocks'][number];
}> = ({ layout, widths, top, block }) => (
  <SheetRow layout={layout} top={top} height={block.heightPt} widths={widths}>
    <div
      style={{
        paddingTop: px(BLOCK_PAD_TOP),
        paddingLeft: px(3),
        paddingRight: px(3),
        overflow: 'hidden',
      }}
    >
      {block.nameLines.map((line, index) => (
        <p
          key={'name-' + index}
          style={{
            fontSize: px(9),
            lineHeight: px(BLOCK_NAME_LINE),
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {line}
        </p>
      ))}
      {block.detailLines.map((line, index) => (
        <p
          key={'detail-' + index}
          style={{
            fontSize: px(7.5),
            lineHeight: px(BLOCK_DETAIL_LINE),
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {line}
        </p>
      ))}
    </div>
    <MonthAmountCell border size={7.5}>
      {block.opening}
    </MonthAmountCell>
    {block.cells.map((cell, index) => (
      <React.Fragment key={'cell-' + index}>
        <MonthAmountCell border size={7.5}>
          {cell.debit === '0.00' ? '' : cell.debit}
        </MonthAmountCell>
        <MonthAmountCell border size={7.5}>
          {cell.credit === '0.00' ? '' : cell.credit}
        </MonthAmountCell>
      </React.Fragment>
    ))}
    <MonthAmountCell border size={7.5} bold>
      {block.closing}
    </MonthAmountCell>
  </SheetRow>
);

const MonthTotalsRow: React.FC<{
  layout: AccountWisePrintLayout;
  widths: number[];
  top: number;
  page: AccountWiseMonthPrintPage;
}> = ({ layout, widths, top, page }) => (
  <SheetRow layout={layout} top={top} height={layout.totalsHeightPt} widths={widths}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: px(3),
        paddingRight: px(3),
        fontSize: px(8),
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      TOTAL
    </div>
    <div style={{ borderLeft: BORDER }} />
    {page.totals.cells.map((cell, index) => (
      <React.Fragment key={'total-' + index}>
        <MonthAmountCell border size={7.5} bold>
          {cell.debit}
        </MonthAmountCell>
        <MonthAmountCell border size={7.5} bold>
          {cell.credit}
        </MonthAmountCell>
      </React.Fragment>
    ))}
    <div
      style={{
        borderLeft: BORDER,
        paddingTop: px(BLOCK_PAD_TOP),
        paddingLeft: px(3),
        paddingRight: px(3),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: px(7), lineHeight: px(8), fontWeight: 700, whiteSpace: 'nowrap' }}>
        {page.totals.closingDebit}
      </span>
      <span style={{ fontSize: px(7), lineHeight: px(8), fontWeight: 700, whiteSpace: 'nowrap' }}>
        {page.totals.closingCredit}
      </span>
    </div>
  </SheetRow>
);

/** One printed A4 landscape page of the Account + Month Wise document. */
const MonthSheet: React.FC<{
  document: AccountWiseMonthPrintDocument;
  page: AccountWiseMonthPrintPage;
  pageIndex: number;
  pageCount: number;
}> = ({ document, page, pageIndex, pageCount }) => {
  const layout = document.layout;
  const widths = page.columnWidthsPt;
  const rows: Array<{ block: AccountWiseMonthPrintPage['blocks'][number]; top: number }> = [];
  let top = layout.bodyTopPt;
  for (const block of page.blocks) {
    rows.push({ block, top });
    top -= block.heightPt;
  }
  return (
    <PageFrame layout={layout}>
      <CompanyHeader
        layout={layout}
        company={document.company}
        financialYear={document.financialYear}
        title={document.reportTitle}
        periodFrom={document.periodFrom}
        periodTo={document.periodTo}
        pageIndex={pageIndex}
        pageCount={pageCount}
      />
      <MonthTableHead layout={layout} page={page} />
      {rows.map((row, index) => (
        <MonthBlockRow
          key={pageIndex + '-' + index}
          layout={layout}
          widths={widths}
          top={row.top}
          block={row.block}
        />
      ))}
      {page.showTotals && (
        <MonthTotalsRow layout={layout} widths={widths} top={top} page={page} />
      )}
    </PageFrame>
  );
};
/* ----------------------------- print window ------------------------------ */

const toolButton =
  'flex h-6 items-center gap-1 rounded-sm border border-[#7a7a7a] bg-[#efefef] px-2 text-[11px] font-semibold text-[#1a1a1a] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40';

const railButton =
  'flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-sm border border-[#7a7a7a] bg-[#efefef] text-[9px] font-bold tracking-wide text-[#1a1a1a] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40';

export const AccountWiseBalancePrintPage: React.FC = () => {
  const navigate = useNavigate();
  const [state] = useState(() => readPreviewState());
  const [accountResult, setAccountResult] = useState<AccountWiseBalanceResult | null>(null);
  const [monthResult, setMonthResult] = useState<AccountWiseMonthWiseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const request: AccountWiseBalanceQueryRequest | null = state?.request ?? null;
  const monthWise = request?.reportType === 'ACCOUNT_MONTH_WISE_BALANCE';

  useEffect(() => {
    if (!state) navigate(BASE, { replace: true });
  }, [state, navigate]);

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      if (request.reportType === 'ACCOUNT_MONTH_WISE_BALANCE') {
        const data = await queryAccountWiseBalanceMonthWise(request);
        setMonthResult(data);
        setAccountResult(null);
      } else {
        const data = await queryAccountWiseBalance(request);
        setAccountResult(data);
        setMonthResult(null);
      }
    } catch (err) {
      setAccountResult(null);
      setMonthResult(null);
      setError(readError(err, 'Failed to generate the print document.'));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  // The page count always comes from the backend print document.
  const totalPages = monthWise
    ? monthResult?.print.pages.length ?? 0
    : accountResult?.print.pages.length ?? 0;
  const lastPage = Math.max(0, totalPages - 1);

  useEffect(() => {
    setPageIndex((current) => (current > lastPage ? lastPage : current));
  }, [lastPage]);

  const closePrint = useCallback(() => {
    navigate(BASE + '/preview');
  }, [navigate]);

  const printSheet = useCallback(() => {
    window.print();
  }, []);

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      const file =
        request.reportType === 'ACCOUNT_MONTH_WISE_BALANCE'
          ? await exportAccountWiseBalanceMonthWisePdf(request)
          : await exportAccountWiseBalancePdf(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Wise Balance PDF.'));
    } finally {
      setBusy(false);
    }
  }, [request, busy]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePrint();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setPageIndex((current) => Math.max(0, current - 1));
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        setPageIndex((current) => Math.min(lastPage, current + 1));
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setPageIndex(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setPageIndex(lastPage);
        return;
      }
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void downloadPdf();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closePrint, downloadPdf, lastPage]);

  if (!state) return null;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex < totalPages - 1;
  const accountPage = accountResult?.print.pages[pageIndex];
  const monthPage = monthResult?.print.pages[pageIndex];

  return (
    <div className="awb-print-canvas flex h-full min-h-0 flex-col bg-[#8e8e8e] text-[#1a1a1a]">
      <div className="awb-print-toolbar flex shrink-0 flex-wrap items-center gap-1 border-b border-[#4a4a4a] bg-[#dcdcdc] px-2 py-1">
        <button type="button" onClick={printSheet} className={toolButton}>
          <Printer className="h-3.5 w-3.5" /> Print
        </button>
        <button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={busy || loading || totalPages === 0}
          className={toolButton}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
        </button>
        <span className="mx-1 h-5 w-px bg-[#9a9a9a]" />
        <button
          type="button"
          onClick={() => setPageIndex(0)}
          disabled={!canPrev}
          aria-label="First"
          title="First page"
          className={toolButton}
        >
          <ChevronsLeft className="h-3.5 w-3.5" /> First
        </button>
        <button
          type="button"
          onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
          disabled={!canPrev}
          title="Previous page"
          className={toolButton}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <span className="min-w-[64px] rounded-sm border border-[#7a7a7a] bg-white px-2 py-0.5 text-center font-mono text-[11px] font-bold">
          {totalPages === 0 ? 0 : pageIndex + 1} OF {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPageIndex((current) => Math.min(lastPage, current + 1))}
          disabled={!canNext}
          title="Next page"
          className={toolButton}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPageIndex(lastPage)}
          disabled={!canNext}
          aria-label="Last"
          title="Last page"
          className={toolButton}
        >
          Last <ChevronsRight className="h-3.5 w-3.5" />
        </button>
        <span className="mx-1 h-5 w-px bg-[#9a9a9a]" />
        <button
          type="button"
          onClick={closePrint}
          aria-label="Close (Esc)"
          title="Close (Esc)"
          className={toolButton}
        >
          <X className="h-3.5 w-3.5" /> Close
        </button>
        <span className="ml-auto rounded-sm border border-[#7a7a7a] bg-[#efefef] px-2 py-0.5 text-[10px] font-bold">
          {monthWise ? 'A4 Landscape' : 'A4 Portrait'}
        </span>
      </div>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="awb-print-rail flex w-[58px] shrink-0 flex-col items-center gap-1.5 border-r border-[#4a4a4a] bg-[#c9c9c9] py-2">
          <button
            type="button"
            disabled
            aria-label="Wap (WhatsApp is not connected)"
            title="WhatsApp sharing is not connected"
            className={railButton}
          >
            <span className="text-[11px]">Wap</span>
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy || loading || totalPages === 0}
            aria-label="Save as PDF"
            title="Save as PDF"
            className={railButton}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            PDF
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy || loading || totalPages === 0}
            aria-label="Save (Ctrl+S)"
            title="Save as PDF (Ctrl+S)"
            className={railButton}
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </aside>

        <div className="awb-print-stage min-h-0 min-w-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-[#f0f0f0]">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing the print document...
            </div>
          ) : totalPages === 0 ? (
            <div className="mx-auto max-w-md border border-[#4a4a4a] bg-white p-6 text-center text-xs font-semibold text-[#333333]">
              No account matches the selected filters for this period.
            </div>
          ) : (
            <div className="mx-auto w-fit">
              {monthWise
                ? monthResult && monthPage && (
                    <div className="awb-sheet-print mb-4 print:mb-0">
                      <MonthSheet
                        document={monthResult.print}
                        page={monthPage}
                        pageIndex={pageIndex}
                        pageCount={totalPages}
                      />
                    </div>
                  )
                : accountResult && accountPage && (
                    <div className="awb-sheet-print mb-4 print:mb-0">
                      <AccountSheet
                        document={accountResult.print}
                        page={accountPage}
                        pageIndex={pageIndex}
                        pageCount={totalPages}
                      />
                    </div>
                  )}
              <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[#f0f0f0] print:hidden">
                Page {pageIndex + 1} of {totalPages} - the downloaded PDF matches this sheet exactly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccountWiseBalancePrintPage;