import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import {
  getDebitNoteBooks,
  getDebitNoteById,
  createDebitNote,
  updateDebitNote,
  cancelDebitNote,
  getEligibleDebitNoteBills,
  getDebitNoteNavigation,
  getDebitNoteNextNumber,
  getDebitNotePartyBalance,
  getParties,
  getLedgerAccounts,
  DebitNoteBook,
  DebitNote,
  DebitNoteBillLine,
  CreateDebitNotePayload,
} from '../services/api';
import {
  Save,
  Printer,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Building,
} from 'lucide-react';

const REASON_OPTIONS = [
  { value: 'INTEREST', label: '3.Interest' },
  { value: 'CASH_DISCOUNT', label: '1.Cash Discount' },
  { value: 'QUANTITY_DISCOUNT', label: '2.Quantity Discount' },
  { value: 'RATE_DIFFERENCE', label: '3.Rate Difference' },
  { value: 'TCS', label: '4.Tcs' },
];

const CALC_BASIS_OPTIONS = [
  { value: 'BILL_AMOUNT', label: '1.Bill Amount' },
  { value: 'TAXABLE_AMOUNT', label: '2.Taxable Amount' },
  { value: 'BASIC_AMOUNT', label: '3.Basic Amount' },
];

const NOTE_TYPE_OPTIONS = [
  { value: 'SALES', label: '1.SALES' },
  { value: 'PURCHASE', label: '2.PURCHASE' },
  { value: 'BOTH', label: '3.BOTH' },
];

const OS_EFFECT_OPTIONS = [
  { value: '2.OS(+)', label: '2.OS(+)' },
  { value: '1.OS(-)', label: '1.OS(-)' },
  { value: '3.NONE', label: '3.NONE' },
];

function computeLineBasicAmount(
  row: DebitNoteBillLine,
  reason: 'CASH_DISCOUNT' | 'QUANTITY_DISCOUNT' | 'RATE_DIFFERENCE' | 'INTEREST' | 'TCS',
  calculationBasis: 'BILL_AMOUNT' | 'TAXABLE_AMOUNT' | 'BASIC_AMOUNT'
): number {
  const rate = Number(row.rate || 0);
  if (rate <= 0) return 0;

  const base = calculationBasis === 'BILL_AMOUNT'
    ? Number(row.billAmount || 0)
    : Number(row.billTaxable || row.billAmount || 0);
  const days = Math.max(0, Number(row.interestDays || 0));
  const quantity = Number(row.quantity || 0);

  let value = 0;
  if (reason === 'INTEREST') {
    // Annual simple interest on a 365-day year: base x rate x days / 36500.
    value = days > 0 ? (base * rate * days) / 36500 : (base * rate) / 100;
  } else if (reason === 'QUANTITY_DISCOUNT' || reason === 'RATE_DIFFERENCE') {
    // Per-unit rate applied to quantity; falls back to a percentage when quantity is absent.
    value = quantity > 0 ? quantity * rate : (base * rate) / 100;
  } else {
    value = (base * rate) / 100;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const DebitNoteEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const bookIdParam = searchParams.get('bookId');

  const { activeCompany } = useCompany();

  const isEditMode = Boolean(id);

  const [, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [loadedNote, setLoadedNote] = useState<DebitNote | null>(null);
  const [selectedBook, setSelectedBook] = useState<DebitNoteBook | null>(null);
  const [allBooks, setAllBooks] = useState<DebitNoteBook[]>([]);

  const [navIds, setNavIds] = useState<{ previous: { id: string } | null; next: { id: string } | null }>({
    previous: null,
    next: null,
  });

  const [parties, setParties] = useState<any[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<any[]>([]);
  const [partyBalance, setPartyBalance] = useState<{ balance: string; balanceType: 'Dr' | 'Cr' } | null>(null);

  // Header
  const [noteNumber, setNoteNumber] = useState('—');
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [partyNoteNo, setPartyNoteNo] = useState('');
  const [noteType, setNoteType] = useState<'SALES' | 'PURCHASE' | 'BOTH'>('SALES');
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [dueDays, setDueDays] = useState(0);

  const [creditAccountId, setCreditAccountId] = useState('');
  const [osEffect, setOsEffect] = useState('2.OS(+)');
  const [reason, setReason] = useState<'CASH_DISCOUNT' | 'QUANTITY_DISCOUNT' | 'RATE_DIFFERENCE' | 'INTEREST' | 'TCS'>('INTEREST');
  const [calculationBasis, setCalculationBasis] = useState<'BILL_AMOUNT' | 'TAXABLE_AMOUNT' | 'BASIC_AMOUNT'>('BILL_AMOUNT');
  const [gstRate, setGstRate] = useState<number>(5.0);
  const [tcsAmount, setTcsAmount] = useState<number>(0);

  const [gridRows, setGridRows] = useState<DebitNoteBillLine[]>([]);

  // TDS has no configured ledger or rate in this BMS. The fields stay disabled and
  // always submit zero; the backend rejects any non-zero value.
  const [tdsRate, setTdsRate] = useState<number>(0);
  const [tdsAmount, setTdsAmount] = useState<number>(0);
  const [tdsSection, setTdsSection] = useState('');
  const [tdsAccount, setTdsAccount] = useState('TDS RECEIVABLE');
  const [remark, setRemark] = useState('');

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showBillModal, setShowBillModal] = useState(false);
  const [eligibleBills, setEligibleBills] = useState<any[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<Set<string>>(new Set());
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState('');

  // Load masters
  useEffect(() => {
    if (!activeCompany) return;

    getDebitNoteBooks()
      .then((books) => {
        setAllBooks(books);
        if (bookIdParam) {
          const found = books.find((book) => book.id === bookIdParam);
          if (found) setSelectedBook(found);
        } else if (!isEditMode && books.length > 0) {
          setSelectedBook(books[0]);
        }
      })
      .catch(() => {});

    getParties().then((data) => setParties(data)).catch(() => {});

    getLedgerAccounts()
      .then((data) => {
        setCreditAccounts(data);
        if (!isEditMode && data.length > 0) {
          const interestAccount = data.find((account: any) => {
            const name = String(account.accountName || '').toLowerCase();
            return name.includes('interest on sale') || name.includes('interest on purchase') || name.includes('interest');
          });
          setCreditAccountId(interestAccount ? interestAccount.id : data[0].id);
        }
      })
      .catch(() => {});
  }, [activeCompany, bookIdParam, isEditMode]);

  const loadDebitNote = useCallback(async (noteId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const note = await getDebitNoteById(noteId);
      setLoadedNote(note);
      setSelectedBook(note.book || null);
      setNoteNumber(note.noteNumber);
      setNoteDate(note.noteDate.slice(0, 10));
      setPartyNoteNo(note.partyNoteNo || '');
      setNoteType(note.noteType);
      setSelectedParty(note.party || null);
      setDueDays(note.dueDays);
      setCreditAccountId(note.creditAccountId);
      setOsEffect(note.osEffect);
      setReason(note.reason);
      setCalculationBasis(note.calculationBasis);
      setGstRate(parseFloat(String(note.gstRate ?? 0)) || 0);
      setTcsAmount(parseFloat(String(note.tcsAmount ?? 0)) || 0);
      setTdsRate(0);
      setTdsAmount(0);
      setTdsSection(note.tdsSection || '');
      setTdsAccount(note.tdsAccount || 'TDS RECEIVABLE');
      setRemark(note.remark || '');
      setGridRows(note.billLines || []);

      getDebitNoteNavigation(noteId).then((nav) => setNavIds(nav)).catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Failed to load Debit Note.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadDebitNote(id);
    } else {
      setLoadedNote(null);
      setGridRows([]);
    }
  }, [id, loadDebitNote]);

  // Real next number from the selected book. Never a hardcoded "1".
  useEffect(() => {
    if (isEditMode || !selectedBook) return;
    let cancelled = false;

    getDebitNoteNextNumber(selectedBook.id)
      .then((next) => {
        if (!cancelled) setNoteNumber(next.noteNumber);
      })
      .catch(() => {
        if (!cancelled) setNoteNumber(`${selectedBook.prefix} —`);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBook, isEditMode]);

  // Live party outstanding from the ledger. Falls back to no value when the party
  // has no ledger account yet (honest empty state).
  useEffect(() => {
    if (!selectedParty?.id) {
      setPartyBalance(null);
      return;
    }

    let cancelled = false;
    getDebitNotePartyBalance(selectedParty.id)
      .then((result) => {
        if (!cancelled) setPartyBalance(result.ledgerId ? { balance: result.balance, balanceType: result.balanceType } : null);
      })
      .catch(() => {
        if (!cancelled) setPartyBalance(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedParty?.id]);
  const filteredParties = useMemo(() => {
    return parties
      .filter((party) => {
        if (noteType === 'SALES') return party.partyType === 'CUSTOMER' || party.partyType === 'BOTH';
        if (noteType === 'PURCHASE') return party.partyType === 'SUPPLIER' || party.partyType === 'BOTH';
        return true;
      })
      .filter((party) => {
        if (!partySearchTerm.trim()) return true;
        const search = partySearchTerm.toLowerCase();
        return (
          String(party.partyName || '').toLowerCase().includes(search) ||
          String(party.partyCode || '').toLowerCase().includes(search) ||
          String(party.city || '').toLowerCase().includes(search) ||
          String(party.gstin || '').toLowerCase().includes(search)
        );
      });
  }, [parties, noteType, partySearchTerm]);

  const updateGridRow = (index: number, field: string, value: any) => {
    setGridRows((prev) => {
      const updated = [...prev];
      const row: any = { ...updated[index], [field]: value };

      const numericFields = [
        'totalDays', 'dharaDays', 'paidAmount', 'quantity',
        'billTaxable', 'billAmount', 'unpaidAmount',
        'sgstRate', 'cgstRate', 'igstRate', 'rate', 'basicAmount',
      ];
      if (numericFields.includes(field)) {
        const numeric = Number(value);
        row[field] = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
      }

      if (field === 'dharaDays' || field === 'totalDays') {
        row.interestDays = Math.max(0, Number(row.totalDays || 0) - Number(row.dharaDays || 0));
      }

      if (field !== 'basicAmount' && Number(row.rate || 0) > 0) {
        row.basicAmount = computeLineBasicAmount(row as DebitNoteBillLine, reason, calculationBasis);
      }

      updated[index] = row as DebitNoteBillLine;
      return updated;
    });
  };

  const removeGridRow = (index: number) => {
    setGridRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const calculations = useMemo(() => {
    const validRows = gridRows.filter((row) => row.billNo && Number(row.basicAmount) > 0);

    const totalBillAmt = validRows.reduce((sum, row) => sum + Number(row.billAmount || 0), 0);
    const totalTaxableAmt = validRows.reduce((sum, row) => sum + Number(row.billTaxable || 0), 0);
    const totalPaidAmt = validRows.reduce((sum, row) => sum + Number(row.paidAmount || 0), 0);
    const totalUnpaidAmt = validRows.reduce((sum, row) => sum + Number(row.unpaidAmount || 0), 0);
    const basicAmount = validRows.reduce((sum, row) => sum + Number(row.basicAmount || 0), 0);
    const taxableValue = basicAmount;

    const companyGstin = activeCompany?.gstin ? String(activeCompany.gstin).trim().toUpperCase() : '';
    const companyStateCode = companyGstin ? companyGstin.substring(0, 2) : '';
    const partyGstin = selectedParty?.gstin ? String(selectedParty.gstin).trim().toUpperCase() : '';
    const partyStateCode = partyGstin ? partyGstin.substring(0, 2) : '';
    const isIntraState = companyStateCode && partyStateCode ? partyStateCode === companyStateCode : true;

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmt = 0;
    let sgstAmt = 0;
    let igstAmt = 0;

    if (gstRate > 0) {
      if (isIntraState) {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmt = Math.round(((taxableValue * cgstRate) / 100) * 100) / 100;
        sgstAmt = Math.round(((taxableValue * sgstRate) / 100) * 100) / 100;
      } else {
        igstRate = gstRate;
        igstAmt = Math.round(((taxableValue * igstRate) / 100) * 100) / 100;
      }
    }

    // No TCS rate is configured in this BMS, so the TCS amount is entered explicitly.
    const tcs = reason === 'TCS' ? Math.max(0, Number(tcsAmount) || 0) : 0;
    const subTotal = taxableValue + cgstAmt + sgstAmt + igstAmt + tcs;
    const finalTotal = Math.round(subTotal);
    const roundOff = Math.round((finalTotal - subTotal) * 100) / 100;

    return {
      billCount: validRows.length,
      totalBillAmt: Math.round(totalBillAmt * 100) / 100,
      totalTaxableAmt: Math.round(totalTaxableAmt * 100) / 100,
      totalPaidAmt: Math.round(totalPaidAmt * 100) / 100,
      totalUnpaidAmt: Math.round(totalUnpaidAmt * 100) / 100,
      basicAmount: Math.round(basicAmount * 100) / 100,
      taxableValue: Math.round(taxableValue * 100) / 100,
      cgstRate,
      cgstAmount: cgstAmt,
      sgstRate,
      sgstAmount: sgstAmt,
      igstRate,
      igstAmount: igstAmt,
      tcsAmount: tcs,
      roundOff,
      totalAmount: finalTotal,
    };
  }, [gridRows, gstRate, activeCompany, selectedParty, reason, tcsAmount]);
  const handleOpenBillsModal = async () => {
    if (!selectedParty) {
      setError('Please select a Party first before looking up bills.');
      return;
    }

    setIsLoadingBills(true);
    setShowBillModal(true);
    setSelectedBillIds(new Set());

    try {
      const data = await getEligibleDebitNoteBills(selectedParty.id, noteType);
      setEligibleBills(data);
    } catch (err: any) {
      setEligibleBills([]);
      setError(err.message || 'Failed to load eligible bills.');
    } finally {
      setIsLoadingBills(false);
    }
  };

  const handleAddSelectedBills = () => {
    const chosen = eligibleBills.filter((bill) => selectedBillIds.has(bill.id));
    if (chosen.length === 0) {
      setShowBillModal(false);
      return;
    }

    const newRows: DebitNoteBillLine[] = chosen.map((bill, index) => {
      const billDate = new Date(bill.date);
      const noteDt = new Date(noteDate);
      const totalDays = Math.max(0, Math.floor((noteDt.getTime() - billDate.getTime()) / 86400000));

      return {
        lineNumber: gridRows.length + index + 1,
        billNo: bill.invoiceNo,
        billDate: bill.date,
        totalDays,
        // Dhara Days is a manual credit period, never invented by the system.
        dharaDays: 0,
        interestDays: totalDays,
        paidAmount: bill.paidAmt || 0,
        paidDate: bill.paymentDate || null,
        itemDescription: bill.item || null,
        quantity: bill.quantity || 0,
        billTaxable: bill.taxableAmt ?? bill.billAmt,
        billAmount: bill.billAmt,
        unpaidAmount: bill.unPaidAmt ?? bill.billAmt,
        sgstRate: bill.sgstRate || 0,
        cgstRate: bill.cgstRate || 0,
        igstRate: bill.igstRate || 0,
        rate: 0,
        basicAmount: 0,
        sourceBillId: bill.id,
        sourceBillType: bill.txnType,
      };
    });

    setGridRows((prev) => [...prev, ...newRows]);

    const billNumbers = chosen.map((bill) => bill.invoiceNo).join(',');
    setRemark((prev) => (prev ? `${prev},${billNumbers}` : `BILL#${billNumbers}`));
    setShowBillModal(false);
  };

  const clearForm = () => {
    if (isEditMode) {
      setError('Saved notes cannot be cleared. Cancel the note instead.');
      return;
    }
    setGridRows([]);
    setRemark('');
    setSelectedParty(null);
    setPartyBalance(null);
    setPartyNoteNo('');
    setTcsAmount(0);
    setTdsSection('');
    setTdsAccount('TDS RECEIVABLE');
    setError(null);
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setError(null);
    setSuccessMsg(null);

    if (!selectedBook) {
      setError('Please select a Debit Note Book.');
      return;
    }
    if (!selectedParty) {
      setError('Please select a Party.');
      return;
    }
    if (!creditAccountId) {
      setError('Please select a Credit Account.');
      return;
    }

    const validRows = gridRows.filter((row) => row.billNo && Number(row.basicAmount) > 0);
    if (validRows.length === 0) {
      setError('Enter a Basic Amount greater than zero for at least one bill line.');
      return;
    }
    if (reason === 'TCS' && Number(tcsAmount) <= 0) {
      setError('TCS amount must be entered explicitly because no TCS rate is configured.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreateDebitNotePayload = {
        bookId: selectedBook.id,
        noteDate,
        partyNoteNo: partyNoteNo.trim() || null,
        noteType,
        partyId: selectedParty.id,
        dueDays,
        creditAccountId,
        osEffect,
        reason,
        calculationBasis,
        gstRate,
        tcsAmount: reason === 'TCS' ? tcsAmount : 0,
        tdsRate: 0,
        tdsAmount: 0,
        tdsSection: null,
        tdsAccount: null,
        remark: remark.trim() || null,
        billLines: validRows.map((row) => ({
          billNo: row.billNo,
          billDate: row.billDate,
          totalDays: row.totalDays,
          dharaDays: row.dharaDays,
          interestDays: row.interestDays,
          paidAmount: row.paidAmount,
          paidDate: row.paidDate,
          itemDescription: row.itemDescription,
          quantity: row.quantity,
          billTaxable: row.billTaxable,
          billAmount: row.billAmount,
          unpaidAmount: row.unpaidAmount,
          sgstRate: row.sgstRate,
          cgstRate: row.cgstRate,
          igstRate: row.igstRate,
          rate: row.rate,
          basicAmount: row.basicAmount,
          sourceBillId: row.sourceBillId,
          sourceBillType: row.sourceBillType,
        })),
      };

      if (isEditMode && id) {
        const updated = await updateDebitNote(id, payload);
        setSuccessMsg(`Debit Note ${updated.noteNumber} updated successfully. Total: ${updated.totalAmount}`);
        await loadDebitNote(id);
      } else {
        const created = await createDebitNote(payload);
        setSuccessMsg(`Debit Note ${created.noteNumber} created successfully. Total: ${created.totalAmount}`);
        setTimeout(() => navigate(`/transactions/debit-notes/${created.id}`), 900);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save Debit Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelNote = async () => {
    if (!id || !cancelReasonInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const cancelled = await cancelDebitNote(id, cancelReasonInput.trim());
      setShowCancelModal(false);
      setCancelReasonInput('');
      setSuccessMsg(`Debit Note ${cancelled.noteNumber} cancelled successfully.`);
      await loadDebitNote(id);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel Debit Note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enter inside a grid cell moves focus to the next input instead of submitting.
  const handleGridEnterKey = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement;
    if (!target || target.tagName !== 'INPUT') return;
    event.preventDefault();
    const inputs = Array.from(event.currentTarget.querySelectorAll('input')) as HTMLInputElement[];
    const currentIndex = inputs.indexOf(target as HTMLInputElement);
    if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
      inputs[currentIndex + 1].focus();
    }
  };

  // Page-scoped shortcuts: F10 Save, F5 Register, F2 Clear, F3 Party, F4 Print,
  // Esc close/back, 7 Previous, 8 Next.
  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName);
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F10':
          event.preventDefault();
          void handleSave();
          break;
        case 'F5':
          event.preventDefault();
          navigate('/transactions/debit-notes');
          break;
        case 'F2':
          event.preventDefault();
          clearForm();
          break;
        case 'F3':
          event.preventDefault();
          if (loadedNote?.status !== 'CANCELLED') setShowPartyModal(true);
          break;
        case 'F4':
          event.preventDefault();
          if (id) navigate(`/transactions/debit-notes/${id}/print`);
          break;
        case 'Escape':
          if (showPartyModal || showBillModal || showCancelModal) {
            setShowPartyModal(false);
            setShowBillModal(false);
            setShowCancelModal(false);
          } else {
            navigate('/transactions/debit-notes');
          }
          break;
        case '7':
          if (!isTyping(event.target) && navIds.previous) {
            event.preventDefault();
            navigate(`/transactions/debit-notes/${navIds.previous.id}`);
          }
          break;
        case '8':
          if (!isTyping(event.target) && navIds.next) {
            event.preventDefault();
            navigate(`/transactions/debit-notes/${navIds.next.id}`);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });
  return (
    <div className="min-h-screen bg-[#c2dcd5] text-slate-800 flex flex-col font-sans select-none text-xs">
      {/* ── Top Bar matching Chandni header ───────────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-3 py-1 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-300" />
          <span className="font-bold text-xs uppercase tracking-wide">
            Debit Note → {selectedBook?.bookName || 'DEBIT NOTE'}
          </span>
          {loadedNote?.status === 'CANCELLED' && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              CANCELLED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => navigate('/transactions/debit-notes/books')}
            className="bg-[#1f4842] hover:bg-[#163530] text-emerald-200 px-2 py-0.5 rounded cursor-pointer font-bold"
          >
            Books ({allBooks.length})
          </button>
          <button
            onClick={() => navigate('/transactions/debit-notes')}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white px-2.5 py-0.5 rounded cursor-pointer font-bold"
          >
            Register
          </button>
          <button
            onClick={() => navigate('/transactions/debit-notes')}
            className="w-5 h-5 flex items-center justify-center text-xs text-white bg-[#eb5757] hover:bg-red-600 rounded font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────────── */}
      {successMsg && (
        <div className="bg-emerald-100 border-b border-emerald-300 text-emerald-800 px-3 py-1 flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 px-3 py-1 flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" /> {error}
          </span>
          <button onClick={() => setError(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Main Form Area ────────────────────────────────────────────── */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {/* TOP HEADER BOX — Matches Screenshot 3 & 4 layout */}
        <div className="bg-white border border-[#789d93] p-2.5 rounded shadow-xs grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          {/* Left Column */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Note No :</label>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                  {noteNumber}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  ({selectedBook?.prefix || 'DN-'})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Date :</label>
              <input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="bg-white border border-[#789d93] rounded px-2 py-0.5 font-mono text-xs focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Party Cr/Dr Note No :</label>
              <input
                type="text"
                value={partyNoteNo}
                onChange={(e) => setPartyNoteNo(e.target.value)}
                disabled={loadedNote?.status === 'CANCELLED'}
                placeholder="External Ref No"
                className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Note Type :</label>
              <select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as any)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-bold text-blue-900 focus:ring-1 focus:ring-[#2c5f57]"
              >
                {NOTE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Party Selection with Balance Display */}
            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Party :</label>
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={selectedParty ? `${selectedParty.partyName}` : ''}
                  placeholder="Click Select Party..."
                  className="flex-1 bg-slate-50 border border-[#789d93] rounded px-2 py-0.5 text-xs font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  disabled={loadedNote?.status === 'CANCELLED'}
                  className="bg-[#2c5f57] hover:bg-[#204741] text-white px-2 py-0.5 rounded font-bold cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  <Search className="w-3 h-3" />
                  <span>F3</span>
                </button>

                {/* Display Dr/Cr Balance beside Party matching Screenshot 3 */}
                {selectedParty && (
                  <span className="font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                    {partyBalance
                      ? `${parseFloat(partyBalance.balance).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${partyBalance.balanceType}`
                      : 'No ledger'}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Due Days :</label>
              <input
                type="number"
                value={dueDays}
                onChange={(e) => setDueDays(parseInt(e.target.value, 10) || 0)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="w-20 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-mono text-center focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Credit Account :</label>
              <select
                value={creditAccountId}
                onChange={(e) => setCreditAccountId(e.target.value)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-[#2c5f57]"
              >
                {creditAccounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>
                    {acct.accountName} ({acct.accountCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">O/s Effect :</label>
              <select
                value={osEffect}
                onChange={(e) => setOsEffect(e.target.value)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="w-32 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-mono font-bold focus:ring-1 focus:ring-[#2c5f57]"
              >
                {OS_EFFECT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Reason :</label>
              <div className="flex-1 flex items-center gap-1.5">
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  disabled={loadedNote?.status === 'CANCELLED'}
                  className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-semibold focus:ring-1 focus:ring-[#2c5f57]"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  value={calculationBasis}
                  onChange={(e) => setCalculationBasis(e.target.value as any)}
                  disabled={loadedNote?.status === 'CANCELLED'}
                  className="w-36 bg-white border border-[#789d93] rounded px-2 py-0.5 text-[11px] font-semibold focus:ring-1 focus:ring-[#2c5f57]"
                >
                  {CALC_BASIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-32 font-bold text-slate-700">Gst Rate (%) :</label>
              <input
                type="number"
                step="0.01"
                value={gstRate}
                onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="w-24 bg-white border border-[#789d93] rounded px-2 py-0.5 text-xs font-mono font-bold text-right focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            {/* Bill Lookup Action Button */}
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleOpenBillsModal}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Select Original Bills ({gridRows.length} loaded)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Add a manual blank line
                  setGridRows((prev) => [
                    ...prev,
                    {
                      lineNumber: prev.length + 1,
                      billNo: '',
                      billDate: noteDate,
                      totalDays: 0,
                      dharaDays: 0,
                      interestDays: 0,
                      paidAmount: 0,
                      paidDate: null,
                      itemDescription: null,
                      quantity: 0,
                      billTaxable: 0,
                      billAmount: 0,
                      unpaidAmount: 0,
                      sgstRate: gstRate / 2,
                      cgstRate: gstRate / 2,
                      igstRate: 0,
                      rate: 0,
                      basicAmount: 0,
                    },
                  ]);
                }}
                disabled={loadedNote?.status === 'CANCELLED'}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
              >
                + Add Manual Row
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CALCULATION GRID (MATCHES SCREENSHOTS 3 & 4) ────────── */}
        <div className="bg-white border border-[#789d93] rounded shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full border-collapse text-xs select-text" onKeyDown={handleGridEnterKey}>
              <thead>
                <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left whitespace-nowrap">
                  <th className="py-1 px-2 border-r border-[#789d93] w-10 text-center">Sr.</th>
                  <th className="py-1 px-2 border-r border-[#789d93]">Bill No</th>
                  <th className="py-1 px-2 border-r border-[#789d93]">Bill Dt</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Total Days</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Dhara Days</th>
                  <th className="py-1 px-2 border-r border-[#789d93]">Item</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Bill Txble</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Bill Amt</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Sgst %</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Cgst %</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Igst %</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Int.Days</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right">Rate</th>
                  <th className="py-1 px-2 border-r border-[#789d93] text-right bg-[#c2dcd5]">Basic Amt</th>
                  <th className="py-1 px-1 text-center w-8">✕</th>
                </tr>
              </thead>
              <tbody>
                {gridRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center text-slate-400 italic">
                      No bill rows added. Click &quot;Select Original Bills&quot; above to import bills.
                    </td>
                  </tr>
                ) : (
                  gridRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-100 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      } hover:bg-emerald-50/40`}
                    >
                      <td className="py-1 px-2 border-r border-slate-200 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.billNo}
                          onChange={(e) => updateGridRow(idx, 'billNo', e.target.value)}
                          className="w-24 bg-transparent border-0 font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 font-mono text-[11px] whitespace-nowrap">
                        {row.billDate ? new Date(row.billDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-right">
                        <input
                          type="number"
                          value={row.totalDays}
                          onChange={(e) => updateGridRow(idx, 'totalDays', parseInt(e.target.value, 10) || 0)}
                          className="w-14 bg-transparent border-0 text-right font-mono focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-right">
                        <input
                          type="number"
                          value={row.dharaDays}
                          onChange={(e) => updateGridRow(idx, 'dharaDays', parseInt(e.target.value, 10) || 0)}
                          className="w-14 bg-transparent border-0 text-right font-mono focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs font-semibold text-blue-800"
                        />
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.itemDescription || ''}
                          onChange={(e) => updateGridRow(idx, 'itemDescription', e.target.value)}
                          className="w-28 bg-transparent border-0 text-slate-800 focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-slate-700">
                        {Number(row.billTaxable || row.billAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                        {Number(row.billAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-slate-600">
                        {Number(row.sgstRate || 0).toFixed(2)}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-slate-600">
                        {Number(row.cgstRate || 0).toFixed(2)}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-slate-600">
                        {Number(row.igstRate || 0).toFixed(2)}
                      </td>
                      <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold text-blue-900">
                        {row.interestDays}
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={row.rate || 0}
                          onChange={(e) => updateGridRow(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-transparent border-0 text-right font-mono focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs font-bold text-purple-900"
                        />
                      </td>
                      <td className="py-0.5 px-1 border-r border-slate-200 text-right bg-emerald-50/60">
                        <input
                          type="number"
                          step="0.01"
                          value={row.basicAmount || 0}
                          onChange={(e) => updateGridRow(idx, 'basicAmount', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-transparent border-0 text-right font-mono font-bold text-emerald-800 focus:bg-white focus:ring-1 focus:ring-[#2c5f57] px-1 py-0.5 text-xs"
                        />
                      </td>
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeGridRow(idx)}
                          className="text-red-500 hover:text-red-700 cursor-pointer"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── BOTTOM PANELS: TDS & REMARKS (LEFT) + SUMMARY TOTALS (RIGHT) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Bottom Left: TDS and Remark */}
          <div className="bg-white border border-[#789d93] p-2.5 rounded shadow-xs space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <label className="w-24 font-bold text-slate-700">TDS Rate :</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  value={tdsRate}
                  disabled
                  onChange={(e) => {
                    const r = parseFloat(e.target.value) || 0;
                    setTdsRate(r);
                    setTdsAmount(Math.round(((calculations.taxableValue * r) / 100) * 100) / 100);
                  }}
                  className="w-20 bg-white border border-[#789d93] rounded px-2 py-0.5 font-mono text-right"
                />
                <span className="font-mono text-slate-600">₹ {tdsAmount.toFixed(2)}</span>
                <span className="text-[10px] text-amber-700">TDS not configured</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="w-24 font-bold text-slate-700">TDS Section :</label>
              <input
                type="text"
                value={tdsSection}
                disabled
                onChange={(e) => setTdsSection(e.target.value)}
                placeholder="e.g. 194C / 194Q"
                className="w-40 bg-white border border-[#789d93] rounded px-2 py-0.5 font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="w-24 font-bold text-slate-700">TDS ACC :</label>
              <input
                type="text"
                value={tdsAccount}
                disabled
                onChange={(e) => setTdsAccount(e.target.value)}
                className="flex-1 bg-white border border-[#789d93] rounded px-2 py-0.5 font-semibold text-slate-800 text-xs"
              />
            </div>

            {reason === 'TCS' && (
              <div className="flex items-center gap-2">
                <label className="w-24 font-bold text-slate-700">TCS Amt :</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tcsAmount}
                  onChange={(e) => setTcsAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-28 bg-white border border-[#789d93] rounded px-2 py-0.5 font-mono text-right"
                />
                <span className="text-[10px] text-slate-500">Entered explicitly (no TCS rate configured)</span>
              </div>
            )}
            <div className="flex items-start gap-2 pt-1">
              <label className="w-24 font-bold text-slate-700 mt-1">Remark :</label>
              <textarea
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="BILL#1,2,3,5,4"
                className="flex-1 bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          {/* Bottom Right: Financial Summary Totals (Matches Screenshot 4) */}
          <div className="bg-white border border-[#789d93] p-2.5 rounded shadow-xs space-y-1 text-xs">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-slate-600 font-semibold">Basic Amount :</span>
              <span className="font-mono font-bold text-slate-900">
                ₹ {calculations.basicAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Taxable Value :</span>
              <span className="font-mono text-slate-900">
                ₹ {calculations.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span>(+) CGST ({calculations.cgstRate.toFixed(2)}%) :</span>
              <span className="font-mono">
                ₹ {calculations.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span>(+) SGST ({calculations.sgstRate.toFixed(2)}%) :</span>
              <span className="font-mono">
                ₹ {calculations.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span>(+) IGST ({calculations.igstRate.toFixed(2)}%) :</span>
              <span className="font-mono">
                ₹ {calculations.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {calculations.tcsAmount > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span>(+) TCS :</span>
                <span className="font-mono">
                  ₹ {calculations.tcsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-300">
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded">
                  {loadedNote?.status === 'CANCELLED' ? 'CANCELLED' : 'Un Paid'}
                </span>
                <span className="font-bold text-slate-900">Total ₹ :</span>
              </div>
              <span className="font-mono font-extrabold text-blue-900 text-sm sm:text-base">
                ₹ {calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ACTION BAR (MATCHES SCREENSHOTS 3 & 4) ──────────────── */}
      <div className="bg-[#dce8e1] border-t border-[#789d93] px-3 py-1.5 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Save / Change button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || loadedNote?.status === 'CANCELLED'}
            className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded font-bold cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{isEditMode ? '1 - Change (F10)' : '1 - Save (F10)'}</span>
          </button>

          {/* Clear button */}
          <button
            type="button"
            onClick={clearForm}
            disabled={loadedNote?.status === 'CANCELLED'}
            className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2.5 py-1 rounded font-bold cursor-pointer"
          >
            2 - Clear
          </button>

          {/* Delete / Cancel button (in edit mode) */}
          {isEditMode && loadedNote?.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded font-bold cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>3 - Delete</span>
            </button>
          )}

          {/* Print button */}
          <button
            type="button"
            onClick={() => {
              if (isEditMode && id) {
                navigate(`/transactions/debit-notes/${id}/print`);
              } else {
                setError('Please save the Debit Note first before printing.');
              }
            }}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white px-2.5 py-1 rounded font-bold cursor-pointer flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>4 - Print (F4)</span>
          </button>

          {/* Exit button */}
          <button
            type="button"
            onClick={() => navigate('/transactions/debit-notes')}
            className="bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-1 rounded font-bold cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>5 - Exit</span>
          </button>
        </div>

        {/* Navigation Previous / Next */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!navIds.previous}
            onClick={() => navIds.previous && navigate(`/transactions/debit-notes/${navIds.previous.id}`)}
            className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2 py-1 rounded font-bold cursor-pointer disabled:opacity-40 flex items-center gap-0.5"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>7 - Previous</span>
          </button>
          <button
            type="button"
            disabled={!navIds.next}
            onClick={() => navIds.next && navigate(`/transactions/debit-notes/${navIds.next.id}`)}
            className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 px-2 py-1 rounded font-bold cursor-pointer disabled:opacity-40 flex items-center gap-0.5"
          >
            <span>8 - Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── MODAL 1: PARTY SELECTION POPUP (MATCHES SCREENSHOT 3) ──────── */}
      {showPartyModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-[#2c5f57] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col text-xs max-h-[85vh]">
            <div className="bg-[#2c5f57] text-white px-3 py-2 font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-300" />
                Select Party ({noteType} eligible)
              </span>
              <button
                onClick={() => setShowPartyModal(false)}
                className="hover:text-red-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2.5 bg-[#eef5f2] border-b border-slate-200">
              <input
                type="text"
                value={partySearchTerm}
                onChange={(e) => setPartySearchTerm(e.target.value)}
                placeholder="Search party name, code, city, GSTIN..."
                className="w-full bg-white border border-[#789d93] rounded px-3 py-1 text-xs focus:ring-1 focus:ring-[#2c5f57]"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto max-h-72">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left">
                    <th className="py-1 px-3 border-r border-[#789d93]">Party Name</th>
                    <th className="py-1 px-3 border-r border-[#789d93]">City</th>
                    <th className="py-1 px-3 border-r border-[#789d93]">GSTIN</th>
                    <th className="py-1 px-3 text-right">Opening Bal.</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        No parties match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredParties.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          setSelectedParty(p);
                          setShowPartyModal(false);
                        }}
                        className="border-b border-slate-100 hover:bg-emerald-50 cursor-pointer"
                      >
                        <td className="py-1.5 px-3 border-r border-slate-100 font-bold text-slate-800">
                          {p.partyName} <span className="text-[10px] text-slate-500 font-mono">({p.partyCode})</span>
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-100 text-slate-600">
                          {p.city || '—'}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-100 font-mono text-[11px] text-slate-600">
                          {p.gstin || '—'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-red-600">
                          {parseFloat(String(p.openingBalance || 0)).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          {p.balanceType === 'CREDIT' ? 'Cr' : 'Dr'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2 bg-[#dce8e1] border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowPartyModal(false)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: ORIGINAL BILL SELECTION POPUP (MATCHES SCREENSHOTS 7 & 8) ─ */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-[#2c5f57] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col text-xs max-h-[85vh]">
            <div className="bg-[#2c5f57] text-white px-3 py-2 font-bold flex items-center justify-between">
              <span>Select Original Bills — {selectedParty?.partyName}</span>
              <button
                onClick={() => setShowBillModal(false)}
                className="hover:text-red-300 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Bills Table with Checkboxes */}
            <div className="flex-1 overflow-y-auto max-h-80">
              {isLoadingBills ? (
                <div className="p-12 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#2c5f57]" />
                  <span>Loading eligible bills...</span>
                </div>
              ) : eligibleBills.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <p className="font-bold text-slate-700">No eligible bills found for this party.</p>
                  <p className="text-[11px] mt-1 text-slate-500">
                    No matching real {noteType} invoices exist for {selectedParty?.partyName}.
                  </p>
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#d5e7e1] text-slate-800 font-bold border-b border-[#789d93] text-left whitespace-nowrap">
                      <th className="py-1 px-2 border-r border-[#789d93] text-center w-10">Tick</th>
                      <th className="py-1 px-2 border-r border-[#789d93]">Invoice No</th>
                      <th className="py-1 px-2 border-r border-[#789d93]">Date</th>
                      <th className="py-1 px-2 border-r border-[#789d93]">Item</th>
                      <th className="py-1 px-2 border-r border-[#789d93] text-right">Bill Amt</th>
                      <th className="py-1 px-2 border-r border-[#789d93]">Payment Date</th>
                      <th className="py-1 px-2 border-r border-[#789d93] text-right">Paid Amt</th>
                      <th className="py-1 px-2 border-r border-[#789d93] text-right">Un-Paid Amt</th>
                      <th className="py-1 px-2 text-center">Txn Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleBills.map((bill) => {
                      const isChecked = selectedBillIds.has(bill.id);
                      return (
                        <tr
                          key={bill.id}
                          onClick={() => {
                            setSelectedBillIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(bill.id)) next.delete(bill.id);
                              else next.add(bill.id);
                              return next;
                            });
                          }}
                          className={`border-b border-slate-100 cursor-pointer ${
                            isChecked ? 'bg-emerald-50 font-bold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-1 px-2 border-r border-slate-200 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="accent-[#2c5f57]"
                            />
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 font-mono text-blue-900 font-bold">
                            {bill.invoiceNo}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 font-mono text-[11px]">
                            {new Date(bill.date).toLocaleDateString('en-IN')}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200">{bill.item}</td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono font-bold">
                            ₹ {bill.billAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-slate-500 font-mono text-[11px]">
                            {bill.paymentDate ? new Date(bill.paymentDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-emerald-700">
                            ₹ {bill.paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right font-mono text-red-600">
                            ₹ {bill.unPaidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-1 px-2 text-center text-[10px] font-bold text-slate-600">
                            {bill.txnType}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom summary and action */}
            <div className="p-3 bg-[#dce8e1] border-t border-slate-300 flex items-center justify-between">
              <span className="font-bold text-slate-700">
                Selected: {selectedBillIds.size} of {eligibleBills.length} bills
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowBillModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSelectedBills}
                  disabled={selectedBillIds.size === 0}
                  className="bg-[#2c5f57] hover:bg-[#204741] text-white px-4 py-1 rounded font-bold cursor-pointer disabled:opacity-50"
                >
                  Add Selected Bills ({selectedBillIds.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: CANCELLATION / DELETE REASON ───────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-red-600 shadow-2xl w-full max-w-md overflow-hidden text-xs">
            <div className="bg-red-600 text-white px-3 py-2 font-bold flex items-center justify-between">
              <span>Cancel Debit Note #{noteNumber}</span>
              <button
                onClick={() => setShowCancelModal(false)}
                className="hover:text-red-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-slate-700">
                This will void the Debit Note and reverse all associated accounting journal entries. This action cannot be undone.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cancellation Reason <span className="text-red-500">*</span> :
                </label>
                <textarea
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Enter reason for voiding this note..."
                  className="w-full bg-white border border-[#789d93] rounded p-2 text-xs focus:ring-1 focus:ring-red-600"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1 rounded font-bold cursor-pointer"
                >
                  Keep Note
                </button>
                <button
                  type="button"
                  onClick={handleCancelNote}
                  disabled={!cancelReasonInput.trim() || isSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded font-bold cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Void</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};