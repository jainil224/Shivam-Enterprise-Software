import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { getDebitNoteById, getDebitNotePrintRange, DebitNote } from '../services/api';
import { amountInWords } from '../utils/amountInWords';
import { Printer, ArrowLeft, Loader2, Sliders, Download } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  CASH_DISCOUNT: 'Cash Discount',
  QUANTITY_DISCOUNT: 'Quantity Discount',
  RATE_DIFFERENCE: 'Rate Difference',
  INTEREST: 'Interest',
  TCS: 'TCS',
};

const money = (value: string | number | null | undefined) =>
  parseFloat(String(value ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface NoteSheetProps {
  note: DebitNote;
  copyLabel: string | null;
  landscape: boolean;
}

/** One printable A4 sheet. Company data comes only from the Company Master. */
const NoteSheet: React.FC<NoteSheetProps> = ({ note, copyLabel, landscape }) => {
  const { activeCompany } = useCompany();

  const companyName = activeCompany?.companyName || '—';
  const companyAddress =
    [activeCompany?.address, activeCompany?.city, activeCompany?.pincode].filter(Boolean).join(' ') || '—';
  const companyPhone = activeCompany?.phone || '—';
  const companyGstin = activeCompany?.gstin || '';
  const companyState = activeCompany?.state || '';
  const companyStateCode = companyGstin ? companyGstin.substring(0, 2) : '';
  const companyPan = activeCompany?.panNumber || '';

  const partyName = note.party?.partyName || '—';
  const partyAddress =
    [note.party?.address, note.party?.city, note.party?.pincode].filter(Boolean).join(' ') || '—';
  const partyGstin = note.party?.gstin || '';

  const basicAmt = parseFloat(String(note.basicAmount ?? 0));
  const taxableVal = parseFloat(String(note.taxableValue ?? 0));
  const cgstAmt = parseFloat(String(note.cgstAmount ?? 0));
  const sgstAmt = parseFloat(String(note.sgstAmount ?? 0));
  const igstAmt = parseFloat(String(note.igstAmount ?? 0));
  const tcsAmt = parseFloat(String(note.tcsAmount ?? 0));
  const roundOff = parseFloat(String(note.roundOff ?? 0));
  const grandTot = parseFloat(String(note.totalAmount ?? 0));

  return (
    <div
      className={`note-sheet bg-white border-2 border-slate-900 shadow-xl p-6 print:border-none print:shadow-none print:p-0 w-full ${
        landscape ? 'max-w-[297mm] min-h-[210mm]' : 'max-w-[210mm] min-h-[297mm]'
      }`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="border-2 border-slate-900 p-3 h-full flex flex-col justify-between text-xs leading-tight">
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold tracking-widest text-slate-700 uppercase mb-0.5">
            <span>!! SHREE GANESHAI NAMAH !!</span>
            {copyLabel && <span className="tracking-normal">{copyLabel}</span>}
          </div>

          <div className="text-center space-y-0.5 pb-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-950">{companyName}</h1>
            <p className="text-[11px] text-slate-800">{companyAddress}</p>
            <p className="text-[11px] font-semibold text-slate-800">(MO) : {companyPhone}</p>
            <div className="flex items-center justify-center gap-6 text-[10.5px] font-bold text-slate-900 pt-0.5 flex-wrap">
              <span>GSTIN : {companyGstin || '—'}</span>
              <span>State &amp; Code : {companyStateCode || '—'} - {companyState || '—'}</span>
              <span>PAN : {companyPan || '—'}</span>
            </div>
          </div>

          <div className="border-t-2 border-b-2 border-slate-900 py-1 text-center my-1">
            <h2 className="text-sm font-black tracking-widest uppercase">DEBIT NOTE</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2 text-xs border-b border-slate-900">
            <div className="space-y-0.5">
              <span className="font-bold text-slate-700">M/s.</span>
              <p className="font-black text-sm text-slate-950 uppercase">{partyName}</p>
              <p className="text-[11px] text-slate-700">{partyAddress}</p>
              <p className="text-[11px] font-mono font-bold text-slate-900 pt-0.5">
                GSTIN : {partyGstin || 'URP / Not Available'}
              </p>
            </div>

            <div className="space-y-1 text-right flex flex-col items-end justify-start">
              <div className="flex gap-2">
                <span className="font-bold text-slate-700">Note No :</span>
                <span className="font-mono font-black text-slate-950">{note.noteNumber}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-slate-700">Note Date :</span>
                <span className="font-mono font-bold text-slate-950">
                  {new Date(note.noteDate).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-slate-700">Party Note No :</span>
                <span className="font-mono text-slate-800">{note.partyNoteNo || '—'}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-slate-700">Note Type :</span>
                <span className="font-mono text-slate-800">{note.noteType}</span>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-slate-700">Reason :</span>
                <span className="font-mono text-slate-800">{REASON_LABELS[note.reason] || note.reason}</span>
              </div>
            </div>
          </div>

          <div className="py-2 text-xs space-y-1 border-b border-slate-900">
            <p className="text-slate-900">
              Being the amount Debited to A/c. towards{' '}
              <span className="font-black uppercase underline tracking-wide">
                {note.creditAccount?.accountName || '—'}
              </span>
            </p>
            <p className="font-bold text-slate-950 text-sm">
              Rs. : <span className="font-mono font-black">{money(grandTot)}</span>
            </p>
            {note.remark && (
              <p className="text-[11px] text-slate-700 font-mono">Remark : {note.remark}</p>
            )}
          </div>
          <div className="pt-2">
            <table className="w-full border-collapse border border-slate-900 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-950 font-bold border-b border-slate-900 text-center">
                  <th className="border border-slate-900 py-1 px-1.5 w-8">Sr.</th>
                  <th className="border border-slate-900 py-1 px-2 text-left">Org. Bill No</th>
                  <th className="border border-slate-900 py-1 px-2 text-center">Org. Bill Date</th>
                  <th className="border border-slate-900 py-1 px-2 text-right">Quantity</th>
                  <th className="border border-slate-900 py-1 px-2 text-right">Bill Amount</th>
                  <th className="border border-slate-900 py-1 px-2 text-right">I.Days</th>
                  <th className="border border-slate-900 py-1 px-2 text-right">Note Amount</th>
                </tr>
              </thead>
              <tbody>
                {note.billLines && note.billLines.length > 0 ? (
                  note.billLines.map((line, idx) => (
                    <tr key={idx} className="border-b border-slate-300 text-slate-900">
                      <td className="border-r border-slate-900 py-1 px-1.5 text-center font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="border-r border-slate-900 py-1 px-2 font-mono font-bold text-left">{line.billNo}</td>
                      <td className="border-r border-slate-900 py-1 px-2 font-mono text-center text-[11px]">
                        {line.billDate ? new Date(line.billDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="border-r border-slate-900 py-1 px-2 text-right font-mono">
                        {parseFloat(String(line.quantity ?? 0)) > 0 ? money(line.quantity) : '—'}
                      </td>
                      <td className="border-r border-slate-900 py-1 px-2 text-right font-mono font-semibold">
                        {money(line.billAmount)}
                      </td>
                      <td className="border-r border-slate-900 py-1 px-2 text-right font-mono font-bold text-slate-800">
                        {parseFloat(String(line.interestDays ?? 0)).toFixed(2)}
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-black text-slate-950">
                        {money(line.basicAmount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-4 text-center text-slate-500 italic">
                      No bill details available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-3">
            <div className="w-72 border border-slate-900 text-xs">
              <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                <span className="font-bold text-slate-800">Basic Amount</span>
                <span className="font-mono font-bold">{money(basicAmt)}</span>
              </div>

              {taxableVal !== basicAmt && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="font-bold text-slate-800">Taxable Value</span>
                  <span className="font-mono font-bold">{money(taxableVal)}</span>
                </div>
              )}

              {cgstAmt !== 0 && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="text-slate-800">
                    CGST (+) {parseFloat(String(note.cgstRate ?? 0)).toFixed(2)} %
                  </span>
                  <span className="font-mono">{money(cgstAmt)}</span>
                </div>
              )}

              {sgstAmt !== 0 && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="text-slate-800">
                    SGST (+) {parseFloat(String(note.sgstRate ?? 0)).toFixed(2)} %
                  </span>
                  <span className="font-mono">{money(sgstAmt)}</span>
                </div>
              )}

              {igstAmt !== 0 && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="text-slate-800">
                    IGST (+) {parseFloat(String(note.igstRate ?? 0)).toFixed(2)} %
                  </span>
                  <span className="font-mono">{money(igstAmt)}</span>
                </div>
              )}

              {tcsAmt !== 0 && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="text-slate-800">TCS (+)</span>
                  <span className="font-mono">{money(tcsAmt)}</span>
                </div>
              )}

              {roundOff !== 0 && (
                <div className="flex justify-between py-1 px-2 border-b border-slate-300">
                  <span className="text-slate-800">Round Off ({roundOff > 0 ? '+' : '−'})</span>
                  <span className="font-mono">{money(Math.abs(roundOff))}</span>
                </div>
              )}

              <div className="flex justify-between py-1.5 px-2 bg-slate-100 font-black border-t border-slate-900 text-slate-950">
                <span>Grand Total</span>
                <span className="font-mono text-sm">₹ {money(grandTot)}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 text-xs">
            <p className="font-bold text-slate-800">
              Amount in Words:{' '}
              <span className="italic font-normal uppercase text-slate-900">{amountInWords(grandTot)}</span>
            </p>
          </div>
        </div>

        <div className="pt-12 flex justify-between items-end text-xs">
          <div className="text-center">
            <div className="w-36 border-t border-slate-400 mb-1"></div>
            <span className="text-slate-600 font-semibold text-[10px]">Prepared By</span>
          </div>

          <div className="text-right">
            <p className="font-bold text-slate-900 uppercase text-[11px] mb-10">For, {companyName}</p>
            <span className="text-slate-700 font-bold border-t border-slate-900 pt-1 px-4 text-[11px]">
              Authorised Signatory
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
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
    // Let React commit the chosen note set before the browser print dialog opens.
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
    <div className="min-h-screen bg-[#6b7280] flex flex-col items-center py-4 print:p-0 print:bg-white text-slate-900 font-sans">
      <style>{`
        @media print {
          @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .note-sheet { page-break-inside: avoid; }
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
          <span className="font-bold tracking-wide">Print Preview: Debit Note {note.noteNumber}</span>
          {activeNotes.length > 1 && (
            <span className="bg-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">
              {activeNotes.length} notes selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOptionsModal(true)}
            className="bg-[#1f4842] hover:bg-[#163530] text-emerald-200 px-3 py-1 rounded font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Print Options</span>
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