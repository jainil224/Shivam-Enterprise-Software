import React from 'react';

export interface PackingSlipData {
  challanId: string;
  challanNumber: string;
  challanDate: string;
  companyName: string;
  companyPhone?: string;
  bookName: string;
  quality: string; // e.g. "75/600 TPM YARN"
  denier?: string;
  cartonNumber: string; // Box No
  cops: number; // Cheese
  lotNumber: string;
  grossWeight: number;
  shadeNo?: string;
  tareWeight: number;
  grade: string;
  netWeight: number;
}

interface PackingSlipTemplateProps {
  slips: PackingSlipData[];
  landscape?: boolean;
  copies?: number;
}

const BORDER = '1px solid #000';

// Shared cell styling for the two-column information table
const cellBase: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: '10.5px',
  fontFamily: 'sans-serif',
  color: '#000',
  verticalAlign: 'middle',
  wordBreak: 'break-word',
};

const labelStyle: React.CSSProperties = { fontWeight: 'bold' };

const toText = (value: string | number | undefined | null): string =>
  value === undefined || value === null ? '' : String(value).trim();

const formatWeight = (value: number): string => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : '0.000';
};

// Single Packing Slip Card: company header + full-width Quality row +
// two-column information table (4 paired rows) + full-width warning row
const PackingSlipCard: React.FC<{ slip: PackingSlipData }> = ({ slip }) => {
  // Quality shows Yarn Quality together with Denier, without repeating the denier
  // when it is already contained inside the quality name
  const buildQualityText = (): string => {
    const quality = toText(slip.quality);
    const denier = toText(slip.denier);
    if (!quality) return denier;
    if (!denier || quality.toUpperCase().includes(denier.toUpperCase())) return quality;
    return `${quality} (${denier})`;
  };

  const companyName = toText(slip.companyName) || 'SHIVAM ENTERPRISE';
  const companyPhone = toText(slip.companyPhone);

  // One horizontal information row: left cell + right cell split by the central divider
  const pairRow = (
    leftLabel: string,
    leftValue: string,
    rightLabel: string,
    rightValue: string,
    isLast: boolean
  ) => (
    <tr>
      <td
        style={{
          ...cellBase,
          width: '50%',
          borderRight: BORDER,
          borderBottom: isLast ? undefined : BORDER,
        }}
      >
        <span style={labelStyle}>{leftLabel} : </span>
        <span>{leftValue}</span>
      </td>
      <td
        style={{
          ...cellBase,
          width: '50%',
          borderBottom: isLast ? undefined : BORDER,
        }}
      >
        <span style={labelStyle}>{rightLabel} : </span>
        <span>{rightValue}</span>
      </td>
    </tr>
  );

  return (
    <div
      style={{
        border: BORDER,
        background: '#fff',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        color: '#000',
        pageBreakInside: 'avoid',
      }}
    >
      {/* Company header */}
      <div
        style={{
          borderBottom: BORDER,
          padding: '4px 4px 3px 4px',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          color: '#000',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            lineHeight: 1.2,
          }}
        >
          {companyName}
        </div>
        {companyPhone && (
          <div style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1.3 }}>
            Phone: {companyPhone}
          </div>
        )}
        {/* Blank spacer row between the phone line and the slip title */}
        <div aria-hidden="true" style={{ height: '12px' }} />
        <div
          style={{
            fontSize: '11.5px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            textDecoration: 'underline',
            lineHeight: 1.3,
          }}
        >
          Packing Slip
        </div>
      </div>

      {/* Quality row + two-column information table */}
      <table
        style={{
          width: '100%',
          height: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          flex: 1,
        }}
      >
        <tbody>
          <tr>
            <td
              colSpan={2}
              style={{ ...cellBase, borderBottom: BORDER, fontWeight: 'bold', padding: '3px 6px' }}
            >
              Quality : {buildQualityText()}
            </td>
          </tr>
          {pairRow('Box No', toText(slip.cartonNumber), 'Cheese', toText(slip.cops), false)}
          {pairRow('Lot No', toText(slip.lotNumber), 'Gross Weight', formatWeight(slip.grossWeight), false)}
          {pairRow('Shade No', toText(slip.shadeNo), 'Tare Weight', formatWeight(slip.tareWeight), false)}
          {pairRow('Grade', toText(slip.grade), 'Net Weight', formatWeight(slip.netWeight), true)}
        </tbody>
      </table>

      {/* Warning row */}
      <div
        style={{
          borderTop: BORDER,
          textAlign: 'center',
          padding: '3px 4px',
          fontSize: '9.5px',
          fontWeight: 'bold',
          fontFamily: 'sans-serif',
          color: '#000',
        }}
      >
        Please do not mix different Lot No.
      </div>
    </div>
  );
};

// Empty placeholder for unused grid positions on final page
const EmptySlipCard: React.FC = () => (
  <div
    style={{
      border: '1px dashed #d1d5db',
      background: '#fff',
      boxSizing: 'border-box',
      height: '100%',
      minHeight: 0,
    }}
  />
);

export const PackingSlipTemplate: React.FC<PackingSlipTemplateProps> = ({
  slips,
  landscape = false,
  copies = 1,
}) => {
  // Expand by copies
  const expandedSlips: PackingSlipData[] = [];
  for (let c = 0; c < copies; c++) {
    for (const slip of slips) {
      expandedSlips.push(slip);
    }
  }

  const slipsPerPage = 8;
  const pageColumns = landscape ? 4 : 2;
  const pageRows = landscape ? 2 : 4;

  const pages: (PackingSlipData | null)[][] = [];
  for (let i = 0; i < expandedSlips.length; i += slipsPerPage) {
    const page: (PackingSlipData | null)[] = [];
    for (let j = 0; j < slipsPerPage; j += 1) {
      page.push(expandedSlips[i + j] || null);
    }
    pages.push(page);
  }
  if (pages.length === 0) {
    pages.push(Array.from({ length: slipsPerPage }, () => null));
  }

  return (
    <div>
      <style>{`
        @page {
          size: ${landscape ? 'A4 landscape' : 'A4 portrait'};
          margin: 5mm;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
          }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .packing-slip-page {
            page-break-after: always;
            break-after: page;
            break-inside: avoid;
            overflow: hidden;
          }

          .packing-slip-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      {pages.map((page, pi) => (
        <div
          key={pi}
          className="packing-slip-page"
          style={{
            width: landscape ? '277mm' : '190mm',
            height: landscape ? '190mm' : '277mm',
            padding: '0',
            margin: '0 auto 6mm auto',
            boxSizing: 'border-box',
            background: '#fff',
            display: 'grid',
            gridTemplateColumns: `repeat(${pageColumns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${pageRows}, minmax(0, 1fr))`,
            gap: '3mm',
          }}
        >
          {page.map((slip, si) =>
            slip ? <PackingSlipCard key={si} slip={slip} /> : <EmptySlipCard key={si} />
          )}
        </div>
      ))}
    </div>
  );
};

export default PackingSlipTemplate;