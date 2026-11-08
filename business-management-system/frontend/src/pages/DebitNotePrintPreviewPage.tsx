import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { getDebitNoteById, getDebitNotePrintRange, DebitNote } from '../services/api';
import { amountInWords } from '../utils/amountInWords';
import { Printer, ArrowLeft, Loader2, Sliders, Download } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  CASH_DISCOUNT: 'CASH DISCOUNT',
  QUANTITY_DISCOUNT: 'QUANTITY DISCOUNT',
  RATE_DIFFERENCE: 'RATE DIFFERENCE',
  INTEREST: 'INTREST ON SALE',
  TCS: 'TCS',
};

const money = (value: string | number | null | undefined) =>
  parseFloat(String(value ?? 0)).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
};

interface NoteSheetProps {
  note: DebitNote;
  copyLabel: string | null;
  landscape: boolean;
}

/**
 * Chandni ERP 100% Exact Debit Note Format (Matches Reference Screenshot Exactly):
 * - White A4 sheet centered on gray background
 * - White page margin surrounding the black border box
 * - Crisp black border box enclosing all document content
 * - Edge-to-edge internal divider lines touching the black box borders
 * - Continuous column gridlines through table body
 * - Basic Amount row with top and bottom horizontal lines
 * - Tax Summary with vertical divider line continuing down
 * - Amount in Words and Prepared By / Authorised Signatory footer
 */
const NoteSheet: React.FC<NoteSheetProps> = ({ note, copyLabel, landscape }) => {
  const { activeCompany } = useCompany();

  const companyName = activeCompany?.companyName || 'CHANDNI WEAVING DEMO';
  const companyAddress =
    [activeCompany?.address, activeCompany?.city, activeCompany?.pincode].filter(Boolean).join(' ') ||
    '204 LA CITADEL COMPLES PARVAT PATIA SURAT  SURAT 395010';
  const companyPhone = activeCompany?.phone || '9824177701';
  const companyGstin = activeCompany?.gstin || '';
  const companyState = activeCompany?.state || 'GUJARAT';
  const companyStateCode = companyGstin ? companyGstin.substring(0, 2) : '24';
  const companyPan = activeCompany?.panNumber || (companyGstin ? companyGstin.substring(2, 12) : '');

  const partyName = note.party?.partyName || '—';
  const partyAddress =
    [note.party?.address, note.party?.city, note.party?.state, note.party?.pincode]
      .filter(Boolean)
      .join(', ') || '—';
  const partyGstin = note.party?.gstin || '';

  const basicAmt = parseFloat(String(note.basicAmount ?? 0));
  const taxableVal = parseFloat(String(note.taxableValue ?? basicAmt));
  const cgstRate = parseFloat(String(note.cgstRate ?? 0));
  const sgstRate = parseFloat(String(note.sgstRate ?? 0));
  const igstRate = parseFloat(String(note.igstRate ?? 0));
  const cgstAmt = parseFloat(String(note.cgstAmount ?? 0));
  const sgstAmt = parseFloat(String(note.sgstAmount ?? 0));
  const igstAmt = parseFloat(String(note.igstAmount ?? 0));
  const tcsAmt = parseFloat(String(note.tcsAmount ?? 0));
  const tdsAmt = parseFloat(String(note.tdsAmount ?? 0));
  const tdsRateVal = parseFloat(String(note.tdsRate ?? 0));
  const tdsSectionVal = note.tdsSection || '';
  const roundOff = parseFloat(String(note.roundOff ?? 0));
  const grandTot = parseFloat(String(note.totalAmount ?? 0));

  const creditAccountName =
    note.creditAccount?.accountName ||
    REASON_LABELS[note.reason] ||
    (note.reason === 'INTEREST' ? 'INTREST ON SALE' : note.reason);

  const cleanNoteNumber = (note.noteNumber || '').replace(/-\s+/, '-').trim();
  const billLines = note.billLines || [];

  return (
    <div
      className={`note-sheet bg-white shadow-xl p-5 sm:p-7 print:p-0 w-full ${
        landscape ? 'max-w-[297mm]' : 'max-w-[210mm]'
      }`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      {/* ── Outer Black Border Box (Enclosing all document content) ── */}
      <div className="border border-black flex flex-col justify-between text-xs leading-normal text-black min-h-[260mm]">
        <div>
          {/* 1. Header Section */}
          <div className="text-center pt-2 pb-1.5 px-3 relative">
            <div className="flex items-center justify-between text-[11px] font-bold tracking-widest text-black uppercase mb-0.5">
              <span className="w-full text-center">!! SHREE GANESHAI NAMAH !!</span>
              {copyLabel && (
                <span className="absolute right-3 text-[10px] font-semibold text-slate-700 tracking-normal">
                  {copyLabel}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black uppercase tracking-wide text-black mt-0.5 mb-0.5">
              {companyName}
            </h1>
            <p className="text-[11px] text-black tracking-tight">{companyAddress}</p>
            <p className="text-[11px] font-bold text-black pt-0.5">(MO) : {companyPhone}</p>

            <div className="flex items-center justify-between text-[11px] font-bold text-black pt-1 px-1">
              <span>GSTIN : {companyGstin || '—'}</span>
              <span>
                State &amp; Code : {companyStateCode ? `${companyStateCode} - ${companyState}` : companyState || '—'}
              </span>
              <span>PAN : {companyPan || '—'}</span>
            </div>
          </div>

          {/* 2. DEBIT NOTE Title Bar */}
          <div className="border-t border-b border-black py-0.5 text-center bg-transparent">
            <h2 className="text-sm font-black tracking-widest uppercase">DEBIT NOTE</h2>
          </div>

          {/* 3. Party & Note Details Block */}
          <div className="px-3 py-1.5 text-xs border-b border-black">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-8 space-y-0.5">
                <span className="font-bold text-black">M/s.</span>
                <p className="font-black text-sm text-black uppercase">{partyName}</p>
                <p className="text-[11px] text-black leading-tight pr-2">{partyAddress}</p>
                <p className="text-[11px] font-mono font-bold text-black pt-0.5">
                  GSTIN : {partyGstin || 'URP / Not Available'}
                </p>
              </div>

              <div className="col-span-4 flex justify-end">
                <div className="space-y-0.5 text-xs font-medium">
                  <div className="flex items-center">
                    <span className="font-bold text-black w-28 text-left">Note No</span>
                    <span className="text-black mr-2">:</span>
                    <span className="font-mono font-bold text-black">{cleanNoteNumber}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-black w-28 text-left">Note Date</span>
                    <span className="text-black mr-2">:</span>
                    <span className="font-mono font-bold text-black">{fmtDate(note.noteDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-black w-28 text-left">Party Note No</span>
                    <span className="text-black mr-2">:</span>
                    <span className="font-mono text-black">{note.partyNoteNo || ''}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-0.5 text-xs pt-1.5">
              <p className="text-black">
                Being the amount Debited to A/c. towards{' '}
                <span className="font-black uppercase underline tracking-wide">
                  {creditAccountName}
                </span>
              </p>
              <p className="font-bold text-black text-xs">
                Rs. &nbsp; : &nbsp; <span className="font-mono font-black">{money(grandTot)}</span>
              </p>
              <p className="text-[11px] text-black font-mono">
                Remark : {note.remark || '—'}
              </p>
            </div>
          </div>

          {/* 4. Table with continuous vertical gridlines */}
          <table className="w-full border-collapse text-xs text-black">
            <thead>
              <tr className="border-b border-black font-bold text-center">
                <th className="border-r border-black py-1 px-1 w-[5%] text-center">Sr.</th>
                <th className="border-r border-black py-1 px-2 w-[15%] text-center">Org. Bill No</th>
                <th className="border-r border-black py-1 px-2 w-[16%] text-center">Org. Bill Date</th>
                <th className="border-r border-black py-1 px-2 w-[14%] text-center">Quantity</th>
                <th className="border-r border-black py-1 px-2 w-[16%] text-center">Bill Amount</th>
                <th className="border-r border-black py-1 px-2 w-[14%] text-center">I.Days</th>
                <th className="py-1 px-2 w-[20%] text-center">Note Amount</th>
              </tr>
            </thead>
            <tbody>
              {billLines.map((line, idx) => (
                <tr key={idx} className="text-black">
                  <td className="border-r border-black py-0.5 px-1 text-center font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="border-r border-black py-0.5 px-2 font-mono text-center">
                    {line.billNo}
                  </td>
                  <td className="border-r border-black py-0.5 px-2 font-mono text-center text-[11px]">
                    {fmtDate(line.billDate)}
                  </td>
                  <td className="border-r border-black py-0.5 px-2 text-right font-mono">
                    {parseFloat(String(line.quantity ?? 0)) > 0 ? money(line.quantity) : ''}
                  </td>
                  <td className="border-r border-black py-0.5 px-2 text-right font-mono">
                    {money(line.billAmount)}
                  </td>
                  <td className="border-r border-black py-0.5 px-2 text-right font-mono">
                    {parseFloat(String(line.interestDays ?? 0)) > 0
                      ? parseFloat(String(line.interestDays ?? 0)).toFixed(2)
                      : ''}
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-medium">
                    {money(line.basicAmount)}
                  </td>
                </tr>
              ))}

              {/* Spacer row to extend vertical lines down to the bottom of the table */}
              <tr style={{ height: `${Math.max(140, 400 - billLines.length * 24)}px` }}>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td className="border-r border-black"></td>
                <td></td>
              </tr>
            </tbody>

            {/* 5. Table Footer: Basic Amount & Tax Summary with vertical divider line */}
            <tfoot>
              {/* Basic Amount Row with top and bottom horizontal lines */}
              <tr className="border-t border-b border-black font-bold text-black">
                <td colSpan={6} className="border-r border-black py-1 px-3 text-right font-bold">
                  Basic Amount
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold">
                  {money(basicAmt)}
                </td>
              </tr>

              {/* Taxable Value Row */}
              <tr className="text-black">
                <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right font-bold">
                  Taxable Value
                </td>
                <td className="py-0.5 px-2 text-right font-mono font-bold">
                  {money(taxableVal)}
                </td>
              </tr>

              {/* CGST Row */}
              {cgstAmt !== 0 && (
                <tr className="text-black">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    <span className="inline-flex justify-between w-48">
                      <span className="font-bold">CGST (+)</span>
                      <span>{cgstRate.toFixed(2)} %</span>
                    </span>
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(cgstAmt)}
                  </td>
                </tr>
              )}

              {/* SGST Row */}
              {sgstAmt !== 0 && (
                <tr className="text-black">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    <span className="inline-flex justify-between w-48">
                      <span className="font-bold">SGST (+)</span>
                      <span>{sgstRate.toFixed(2)} %</span>
                    </span>
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(sgstAmt)}
                  </td>
                </tr>
              )}

              {/* IGST Row */}
              {igstAmt !== 0 && (
                <tr className="text-black">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    <span className="inline-flex justify-between w-48">
                      <span className="font-bold">IGST (+)</span>
                      <span>{igstRate.toFixed(2)} %</span>
                    </span>
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(igstAmt)}
                  </td>
                </tr>
              )}

              {/* TCS Row */}
              {tcsAmt !== 0 && (
                <tr className="text-black">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    TCS (+)
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(tcsAmt)}
                  </td>
                </tr>
              )}

              {/* Round Off Row */}
              {roundOff !== 0 && (
                <tr className="text-black">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    Round Off ({roundOff > 0 ? '+' : '−'})
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(Math.abs(roundOff))}
                  </td>
                </tr>
              )}

              {tdsAmt !== 0 && (
                <tr className="text-red-700">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right font-medium">
                    TDS (-) &nbsp; {tdsRateVal.toFixed(2)} %{tdsSectionVal ? ` (${tdsSectionVal})` : ''}
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono font-semibold">
                    {money(tdsAmt)}
                  </td>
                </tr>
              )}

              {/* Net Receivable Row */}
              {tdsAmt !== 0 && (
                <tr className="text-black font-semibold border-t border-slate-300">
                  <td colSpan={6} className="border-r border-black py-0.5 px-3 text-right">
                    Net Receivable
                  </td>
                  <td className="py-0.5 px-2 text-right font-mono">
                    {money(grandTot - tdsAmt)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          {/* Closing line below tax summary */}
          <div className="border-t border-black w-full" />
        </div>

        {/* 6. Footer: Amount in Words & Signatures */}
        <div className="px-3 pt-3 pb-6 text-xs flex flex-col justify-between flex-1">
          <div>
            <p className="font-bold text-black">
              Amount in Words : &nbsp;
              <span className="italic font-normal uppercase text-black">{amountInWords(grandTot)}</span>
            </p>
          </div>

          <div className="pt-24 flex justify-between items-end text-xs">
            <div className="text-center">
              <div className="w-32 border-t border-black mb-1"></div>
              <span className="text-black text-[11px] font-semibold">Prepared By</span>
            </div>

            <div className="text-right">
              <p className="font-bold text-black uppercase text-[11px] mb-10">For, {companyName}</p>
              <div className="inline-block border-t border-black pt-1 px-4">
                <span className="text-black font-bold text-[11px]">Authorised Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────
   Main Print Preview Page
───────────────────────────────────────────────────────────────── */
export const DebitNotePrintPreviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [note, setNote] = useState<DebitNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [noteFrom, setNoteFrom] = useState(1);
  const [noteTo, setNoteTo] = useState(1);
  const [copies, setCopies] = useState(1);
  const [isLandscape, setIsLandscape] = useState(false);
  const [partyAcFilter, setPartyAcFilter] = useState('1.All');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [isRangeLoading, setIsRangeLoading] = useState(false);
  const [activeNotes, setActiveNotes] = useState<DebitNote[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDebitNoteById(id);
      setNote(data);
      setActiveNotes([data]);
      setNoteFrom(data.voucherNumber || 1);
      setNoteTo(data.voucherNumber || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load Debit Note for printing.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const printSheets = () => {
    window.setTimeout(() => window.print(), 100);
  };

  const handlePrintCurrent = () => {
    if (!note) return;
    setActiveNotes([note]);
    printSheets();
  };

  const handleRangePrint = async () => {
    if (!note) return;

    const from = Math.max(1, Math.trunc(noteFrom));
    const to = Math.max(from, Math.trunc(noteTo));
    setIsRangeLoading(true);
    setRangeError(null);

    try {
      const notes = await getDebitNotePrintRange({
        from,
        to,
        bookId: note.bookId,
        partyId: partyAcFilter === '1.All' ? undefined : note.partyId,
      });

      if (notes.length === 0) {
        setRangeError('No Debit Notes exist in the selected Note From / To range.');
        return;
      }

      setActiveNotes(notes);
      setShowOptionsModal(false);
      printSheets();
    } catch (err: any) {
      setRangeError(err.message || 'Failed to load the selected Debit Note range.');
    } finally {
      setIsRangeLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-slate-700 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57]" />
          <span>Generating Debit Note Print Preview...</span>
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-red-300 p-6 rounded shadow max-w-md text-center space-y-3">
          <p className="text-red-600 font-bold text-xs">{error || 'Debit Note not found.'}</p>
          <button
            onClick={() => navigate('/transactions/debit-notes')}
            className="bg-[#2c5f57] text-white px-4 py-1.5 rounded text-xs font-bold"
          >
            Back to Debit Notes
          </button>
        </div>
      </div>
    );
  }

  const sheetsToRender = activeNotes.length > 0 ? activeNotes : [note];
  const copyCount = Math.min(5, Math.max(1, Math.trunc(copies) || 1));
  const flatSheets = sheetsToRender.flatMap((sheetNote) =>
    Array.from({ length: copyCount }, (_, copyIndex) => ({ sheetNote, copyIndex }))
  );

  return (
    <div className="min-h-screen bg-[#808080] flex flex-col items-center py-6 print:py-0 print:bg-white text-slate-900 font-sans">
      <style>{`
        @media print {
          @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 6mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .note-sheet {
            padding: 0 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* ── Top Toolbar (hidden during print) ─────────────────────────── */}
      <div className="w-full max-w-[210mm] bg-[#2c5f57] text-white px-4 py-2 rounded-t flex items-center justify-between shadow-md print:hidden mb-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/transactions/debit-notes/${id}`)}
            className="hover:bg-[#204741] p-1 rounded cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold tracking-wide">Print Preview: {note.noteNumber}</span>
          {activeNotes.length > 1 && (
            <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
              {activeNotes.length} notes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOptionsModal(true)}
            className="bg-[#1f4842] hover:bg-[#163530] text-emerald-200 px-3 py-1 rounded font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Options</span>
          </button>

          <button
            onClick={handlePrintCurrent}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white px-3 py-1 rounded font-bold cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ── Printable sheets ─────────────────────────────────────────── */}
      <div className="w-full flex flex-col items-center gap-4 print:gap-0">
        {flatSheets.map(({ sheetNote, copyIndex }, index) => (
          <div
            key={`${sheetNote.id}-${copyIndex}`}
            className={index === 0 ? 'w-full flex justify-center' : 'w-full flex justify-center hidden print:flex'}
            style={{ pageBreakAfter: index === flatSheets.length - 1 ? 'auto' : 'always' }}
          >
            <NoteSheet
              note={sheetNote}
              landscape={isLandscape}
              copyLabel={copyCount > 1 ? `Copy ${copyIndex + 1} of ${copyCount}` : null}
            />
          </div>
        ))}
      </div>

      {/* ── PRINT OPTIONS MODAL ───────────────────────────────────────── */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-[#eef5f2] border-2 border-[#2c5f57] rounded shadow-2xl w-full max-w-lg overflow-hidden text-xs">
            <div className="bg-[#2c5f57] text-white px-3 py-1.5 font-bold flex items-center justify-between">
              <span>Print Options</span>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="hover:text-red-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <label className="w-24 font-bold text-slate-700">Note From :</label>
                <input
                  type="number"
                  min={1}
                  value={noteFrom}
                  onChange={(e) => setNoteFrom(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-white border border-[#789d93] rounded px-2 py-0.5 text-center font-mono font-bold"
                />
                <span className="font-bold text-slate-700">To :</span>
                <input
                  type="number"
                  min={1}
                  value={noteTo}
                  onChange={(e) => setNoteTo(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-white border border-[#789d93] rounded px-2 py-0.5 text-center font-mono font-bold"
                />

                <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLandscape}
                    onChange={(e) => setIsLandscape(e.target.checked)}
                    className="accent-[#2c5f57]"
                  />
                  <span className="font-semibold text-slate-800">Landscape</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <label className="w-24 font-bold text-slate-700">Copies :</label>
                <input
                  type="number"
                  value={copies}
                  min={1}
                  max={5}
                  onChange={(e) => setCopies(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-white border border-[#789d93] rounded px-2 py-0.5 text-center font-mono font-bold"
                />
                <span className="text-[10px] text-slate-600">1 to 5 copies, printed on separate A4 pages.</span>
              </div>

              <div className="flex items-center gap-3">
                <label className="w-24 font-bold text-slate-700">Party A/c. :</label>
                <select
                  value={partyAcFilter}
                  onChange={(e) => setPartyAcFilter(e.target.value)}
                  className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-semibold"
                >
                  <option value="1.All">1.All</option>
                  <option value={note.partyId}>{note.party?.partyName || 'Selected Party'}</option>
                </select>
              </div>

              <p className="text-[10px] text-slate-600 border-t border-slate-200 pt-2">
                Printer, paper source and PDF destination are chosen in the browser print dialog.
              </p>

              {rangeError && (
                <p className="text-[11px] font-bold text-red-600 border border-red-300 bg-red-50 rounded px-2 py-1">
                  {rangeError}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleRangePrint}
                    disabled={isRangeLoading}
                    className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {isRangeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />}
                    <span>1. Print Range</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowOptionsModal(false)}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1 rounded font-bold cursor-pointer"
                  >
                    2. Preview
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCurrent}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>3. Export / Save as PDF</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowOptionsModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
