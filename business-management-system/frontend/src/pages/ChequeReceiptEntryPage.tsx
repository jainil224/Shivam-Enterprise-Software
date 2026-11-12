import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  createChequeReceipt,
  getBankReceiptBook,
  getBankReceiptBooks,
  getBankVoucherById,
  getNextChequeReceiptNumber,
  getReceiptNeighbours,
  lookupReceiptParties,
  updateChequeReceipt,
} from '../services/api';
import {
  BankInstrument,
  BankReceiptAdjustmentMode,
  BankReceiptBook,
  BankVoucher,
  ChequeReceiptPayload,
  RECEIPT_ADJUSTMENT_MODE_LABELS,
  RECEIPT_ADJUSTMENT_MODE_ORDER,
  ReceiptAdjustmentPayload,
  ReceiptAllocationPayload,
  ReceiptNeighbours,
  ReceiptPartyLookup,
  ReceiptVoucherLine,
  SignedLedgerBalance,
} from '../types';
import { BankNameLookupDialog } from '../components/receipt/BankNameLookupDialog';
import {
  OutstandingAdjustmentDialog,
  OutstandingApplyResult,
} from '../components/receipt/OutstandingAdjustmentDialog';
import { ReceiptPartyLookupDialog } from '../components/receipt/ReceiptPartyLookupDialog';

const INITIAL_ROWS = 30;
const EXTRA_ROWS = 10;

type CellKey = 'party' | 'bankName' | 'cheque' | 'description' | 'amount' | 'adjustment';

const CELL_ORDER: CellKey[] = ['party', 'bankName', 'cheque', 'description', 'amount', 'adjustment'];

const CHEQUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{0,19}$/;

let rowSequence = 0;

interface ReceiptRow {
  key: string;
  partyId: string | null;
  partyName: string;
  partyCode: string;
  partyAddress: string;
  partyBalance: SignedLedgerBalance | null;
  bankInstrumentId: string | null;
  bankNameCode: string;
  bankNameDescription: string;
  chequeNumber: string;
  description: string;
  amount: string;
  adjustmentMode: BankReceiptAdjustmentMode;
  allocations: ReceiptAllocationPayload[];
  adjustments: ReceiptAdjustmentPayload[];
}

const makeRow = (): ReceiptRow => ({
  key: `rr-${rowSequence++}`,
  partyId: null,
  partyName: '',
  partyCode: '',
  partyAddress: '',
  partyBalance: null,
  bankInstrumentId: null,
  bankNameCode: '',
  bankNameDescription: '',
  chequeNumber: '',
  description: '',
  amount: '',
  adjustmentMode: 'NO_ADJUSTMENT',
  allocations: [],
  adjustments: [],
});

const padRows = (source: ReceiptRow[]): ReceiptRow[] => {
  const padded = [...source];
  while (padded.length < INITIAL_ROWS) padded.push(makeRow());
  return padded;
};

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const dateLabel = (value: string | null | undefined): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const signedBalance = (balance: SignedLedgerBalance | null): string => {
  if (!balance) return '-';
  return `${money(balance.amount)} ${balance.nature}`;
};

const todayInput = (): string => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const isBlankRow = (row: ReceiptRow): boolean =>
  !row.partyId && row.amount.trim() === '' && row.chequeNumber.trim() === '';

const extractError = (err: unknown): string => {
  const apiErrors = (err as { errors?: Array<{ field: string; message: string }> }).errors;
  if (apiErrors && apiErrors.length > 0) return apiErrors.map((item) => item.message).join(' - ');
  return err instanceof Error ? err.message : 'Unexpected error.';
};

const mapVoucherLines = (lines: ReceiptVoucherLine[]): ReceiptRow[] =>
  lines.map((line) => ({
    key: `rr-${rowSequence++}`,
    partyId: line.party?.id ?? null,
    partyName: line.party?.partyName ?? '',
    partyCode: line.party?.partyCode ?? '',
    partyAddress: '',
    partyBalance: null,
    bankInstrumentId: line.bankInstrument?.id ?? null,
    bankNameCode: line.bankNameCode ?? line.bankInstrument?.code ?? '',
    bankNameDescription: line.bankInstrument?.description ?? '',
    chequeNumber: line.chequeNumber ?? '',
    description: line.description ?? '',
    amount: line.amount,
    adjustmentMode: line.adjustmentMode,
    allocations: line.allocations
      .filter((allocation) => allocation.status === 'ACTIVE')
      .map((allocation) => ({
        purchaseBillId: allocation.purchaseBillId,
        allocatedAmount: allocation.allocatedAmount,
      })),
    adjustments: line.allocations.flatMap((allocation) =>
      allocation.adjustments
        .filter((adjustment) => adjustment.status === 'ACTIVE')
        .map((adjustment) => ({
          purchaseBillId: allocation.purchaseBillId,
          adjustmentLedgerAccountId: adjustment.adjustmentLedgerAccount.id,
          calculationType: adjustment.calculationType,
          interestPercent: adjustment.interestPercent,
          dueValue: adjustment.dueValue,
          tdsPercent: adjustment.tdsPercent,
          adjustmentAmount: adjustment.adjustmentAmount,
          drCr: adjustment.drCr,
          note: adjustment.note,
        }))
    ),
  }));

interface ToolbarButtonProps {
  hotkey: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary';
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  hotkey,
  label,
  onClick,
  disabled = false,
  tone = 'default',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      tone === 'primary'
        ? 'bg-emerald-500 hover:bg-emerald-400 border-emerald-300 text-white'
        : 'bg-white/10 hover:bg-white/20 border-white/25 text-white'
    }`}
  >
    <span className="font-mono text-[10px] bg-black/25 rounded px-1">{hotkey}</span>
    <span>{label}</span>
  </button>
);
export const ChequeReceiptEntryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedBookId = searchParams.get('bookId') ?? '';
  const { activeFinancialYear } = useCompany();

  const [books, setBooks] = useState<BankReceiptBook[]>([]);
  const [book, setBook] = useState<BankReceiptBook | null>(null);
  const [bookId, setBookId] = useState('');
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState(todayInput());
  const [narration, setNarration] = useState('');
  const [rows, setRows] = useState<ReceiptRow[]>(() => padRows([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ id: string; number: string } | null>(null);
  const [voucherId, setVoucherId] = useState<string | null>(null);
  const [cancelledVoucher, setCancelledVoucher] = useState<BankVoucher | null>(null);
  const [neighbours, setNeighbours] = useState<ReceiptNeighbours | null>(null);
  const [dirty, setDirty] = useState(false);
  const [activeRow, setActiveRow] = useState(0);
  const [partyDialog, setPartyDialog] = useState<{ row: number; search: string } | null>(null);
  const [bankDialog, setBankDialog] = useState<{ row: number } | null>(null);
  const [outstandingDialog, setOutstandingDialog] = useState<{ row: number } | null>(null);

  const cellRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const savingRef = useRef(false);

  const activeVoucherId = voucherId ?? id ?? null;
  const dialogOpen = Boolean(partyDialog || bankDialog || outstandingDialog);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );
  const filledRows = useMemo(() => rows.filter((row) => !isBlankRow(row)), [rows]);
  const activeRowData = rows[activeRow];

  const setCellRef = (rowIndex: number, cell: CellKey) => (element: HTMLElement | null) => {
    cellRefs.current.set(`${rowIndex}:${cell}`, element);
  };

  const focusCell = useCallback((rowIndex: number, cell: CellKey) => {
    const element = cellRefs.current.get(`${rowIndex}:${cell}`);
    if (!element) return;
    element.focus();
    if (element instanceof HTMLInputElement) element.select();
  }, []);

  const updateRow = useCallback((index: number, patch: Partial<ReceiptRow>) => {
    setRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
    setDirty(true);
  }, []);

  const setRowError = useCallback((key: string, message: string) => {
    setRowErrors((prev) => ({ ...prev, [key]: message }));
  }, []);

  const clearRowError = useCallback((key: string) => {
    setRowErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  useEffect(() => {
    setRowErrors({});
  }, [id]);

  const enrichParties = useCallback(async (source: ReceiptRow[]) => {
    const codes = Array.from(
      new Set(source.filter((row) => row.partyId && row.partyCode).map((row) => row.partyCode))
    );
    if (codes.length === 0) return;
    const results = await Promise.all(
      codes.map((code) => lookupReceiptParties(code, 10).catch(() => [] as ReceiptPartyLookup[]))
    );
    const byId = new Map<string, ReceiptPartyLookup>();
    results.flat().forEach((party) => byId.set(party.id, party));
    setRows((prev) =>
      prev.map((row) => {
        if (!row.partyId) return row;
        const found = byId.get(row.partyId);
        if (!found) return row;
        return {
          ...row,
          partyName: found.partyName,
          partyCode: found.partyCode,
          partyAddress: found.address ?? '',
          partyBalance: found.balance,
        };
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadForEdit = async (voucherIdToLoad: string) => {
      const voucher = await getBankVoucherById('RECEIPT', voucherIdToLoad);
      if (voucher.status === 'CANCELLED') {
        const loadedBook = voucher.receiptBook
          ? await getBankReceiptBook(voucher.receiptBook.id).catch(() => null)
          : null;
        if (cancelled) return;
        setCancelledVoucher(voucher);
        setBook(loadedBook);
        setBooks(loadedBook ? [loadedBook] : []);
        setBookId(loadedBook ? loadedBook.id : '');
        setVoucherNumber(voucher.voucherNumber);
        setVoucherDate(voucher.voucherDate.slice(0, 10));
        setNarration(voucher.narration ?? '');
        setRows(padRows(mapVoucherLines(voucher.receiptLines ?? [])));
        setNeighbours(null);
        setVoucherId(voucherIdToLoad);
        setSavedInfo(null);
        setDirty(false);
        setActiveRow(0);
        return;
      }
      if (!voucher.receiptBook) {
        throw new Error(
          'This voucher was not created from a Bank Receipt Book. Use the Bank Receipt register to edit it.'
        );
      }
      const [loadedBook, nextNeighbours] = await Promise.all([
        getBankReceiptBook(voucher.receiptBook.id),
        getReceiptNeighbours(voucherIdToLoad).catch(() => null),
      ]);
      const mapped = mapVoucherLines(voucher.receiptLines ?? []);
      if (cancelled) return;
      setBook(loadedBook);
      setBooks([loadedBook]);
      setBookId(loadedBook.id);
      setVoucherNumber(voucher.voucherNumber);
      setVoucherDate(voucher.voucherDate.slice(0, 10));
      setNarration(voucher.narration ?? '');
      setRows(padRows(mapped));
      setNeighbours(nextNeighbours);
      setVoucherId(voucherIdToLoad);
      setSavedInfo(null);
      setDirty(false);
      setActiveRow(0);
      void enrichParties(mapped);
    };

    const loadForCreate = async () => {
      const list = await getBankReceiptBooks();
      if (cancelled) return;
      setBooks(list);
      const requested = requestedBookId
        ? list.find((candidate) => candidate.id === requestedBookId)
        : undefined;
      const selected = requested ?? (list.length === 1 ? list[0] : undefined);
      if (!selected) {
        setBook(null);
        setBookId('');
        return;
      }
      setBook(selected);
      setBookId(selected.id);
      const next = await getNextChequeReceiptNumber(selected.id);
      if (cancelled) return;
      setVoucherNumber(next.voucherNumber);
    };

    setLoading(true);
    setError(null);
    setCancelledVoucher(null);
    const task = id ? loadForEdit(id) : loadForCreate();
    task
      .catch((err: unknown) => {
        if (!cancelled) setError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, requestedBookId, enrichParties]);

  const handleBookChange = useCallback(
    async (nextBookId: string) => {
      const nextBook = books.find((candidate) => candidate.id === nextBookId) ?? null;
      setBook(nextBook);
      setBookId(nextBookId);
      setDirty(true);
      if (!nextBook) {
        setVoucherNumber('');
        return;
      }
      try {
        const next = await getNextChequeReceiptNumber(nextBookId);
        setVoucherNumber(next.voucherNumber);
      } catch (err) {
        setVoucherNumber('');
        setError(extractError(err));
      }
    },
    [books]
  );

  const openPartyDialog = useCallback((rowIndex: number, search: string) => {
    setActiveRow(rowIndex);
    setPartyDialog({ row: rowIndex, search });
  }, []);

  const handlePartySelected = useCallback(
    (party: ReceiptPartyLookup) => {
      if (!partyDialog) return;
      const index = partyDialog.row;
      updateRow(index, {
        partyId: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyAddress: party.address ?? '',
        partyBalance: party.balance,
      });
      setPartyDialog(null);
      setActiveRow(index);
      window.setTimeout(() => focusCell(index, 'bankName'), 0);
    },
    [partyDialog, updateRow, focusCell]
  );

  const handleBankSelected = useCallback(
    (instrument: BankInstrument) => {
      if (!bankDialog) return;
      const index = bankDialog.row;
      updateRow(index, {
        bankInstrumentId: instrument.id,
        bankNameCode: instrument.code,
        bankNameDescription: instrument.description,
      });
      setBankDialog(null);
      setActiveRow(index);
      window.setTimeout(() => focusCell(index, 'cheque'), 0);
    },
    [bankDialog, updateRow, focusCell]
  );

  const changeAdjustmentMode = useCallback(
    (index: number, mode: BankReceiptAdjustmentMode) => {
      const row = rows[index];
      if (!row) return;
      if (mode === 'AGAINST_BILL') {
        if (!row.partyId) {
          setRowError(row.key, 'Select a party account before choosing Against Bill.');
          return;
        }
        if (!(Number(row.amount) > 0)) {
          setRowError(row.key, 'Enter a positive receipt amount before choosing Against Bill.');
          return;
        }
        updateRow(index, { adjustmentMode: mode });
        clearRowError(row.key);
        setOutstandingDialog({ row: index });
        return;
      }
      updateRow(index, { adjustmentMode: mode, allocations: [], adjustments: [] });
      clearRowError(row.key);
    },
    [rows, updateRow, setRowError, clearRowError]
  );

  const handleOutstandingApply = useCallback(
    (result: OutstandingApplyResult) => {
      if (!outstandingDialog) return;
      const target = rows[outstandingDialog.row];
      updateRow(outstandingDialog.row, {
        allocations: result.allocations,
        adjustments: result.adjustments,
      });
      if (target) clearRowError(target.key);
      setOutstandingDialog(null);
    },
    [outstandingDialog, rows, updateRow, clearRowError]
  );
  const handleSave = useCallback(async () => {
    if (savingRef.current) return;
    setError(null);

    if (!bookId) {
      setError('Select a Bank Receipt Book before saving.');
      return;
    }
    if (!voucherDate) {
      setError('Voucher date is required.');
      return;
    }
    if (filledRows.length === 0) {
      setError('Enter at least one receipt row before saving.');
      return;
    }

    const nextRowErrors: Record<string, string> = {};
    for (const row of rows) {
      if (isBlankRow(row)) continue;
      if (!row.partyId) {
        nextRowErrors[row.key] = 'Select a party account for this receipt row.';
        continue;
      }
      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        nextRowErrors[row.key] = 'Enter a positive receipt amount.';
        continue;
      }
      const cheque = row.chequeNumber.trim();
      if (cheque !== '' && !CHEQUE_PATTERN.test(cheque)) {
        nextRowErrors[row.key] = 'Cheque/reference number contains invalid characters.';
        continue;
      }
      if (row.adjustmentMode === 'AGAINST_BILL' && row.allocations.length === 0) {
        nextRowErrors[row.key] =
          'No bill allocation has been entered. Allocate this receipt against a bill or select No Adjustment / Skip in O/S.';
        continue;
      }
    }
    if (Object.keys(nextRowErrors).length > 0) {
      setRowErrors(nextRowErrors);
      setError(null);
      const firstKey = Object.keys(nextRowErrors)[0];
      const firstIndex = rows.findIndex((row) => row.key === firstKey);
      if (firstIndex >= 0) {
        setActiveRow(firstIndex);
        window.setTimeout(() => focusCell(firstIndex, 'party'), 0);
      }
      return;
    }
    setRowErrors({});

    const payload: ChequeReceiptPayload = {
      bookId,
      voucherDate,
      narration: narration.trim() === '' ? null : narration.trim(),
      remarks: null,
      lines: filledRows.map((row) => ({
        partyId: row.partyId as string,
        bankInstrumentId: row.bankInstrumentId,
        bankNameCode: row.bankNameCode.trim() === '' ? null : row.bankNameCode.trim(),
        chequeNumber: row.chequeNumber.trim() === '' ? null : row.chequeNumber.trim(),
        description: row.description.trim() === '' ? null : row.description.trim(),
        amount: row.amount,
        adjustmentMode: row.adjustmentMode,
        allocations: row.adjustmentMode === 'AGAINST_BILL' ? row.allocations : [],
        adjustments: row.adjustmentMode === 'AGAINST_BILL' ? row.adjustments : [],
      })),
    };

    savingRef.current = true;
    setSaving(true);
    try {
      const targetId = activeVoucherId;
      const result = targetId
        ? await updateChequeReceipt(targetId, payload)
        : await createChequeReceipt(payload);
      const saved = await getBankVoucherById('RECEIPT', result.id).catch(() => null);
      setVoucherId(result.id);
      setSavedInfo({
        id: result.id,
        number: saved ? saved.voucherNumber : voucherNumber,
      });
      if (saved) setVoucherNumber(saved.voucherNumber);
      const nextNeighbours = await getReceiptNeighbours(result.id).catch(() => null);
      if (nextNeighbours) setNeighbours(nextNeighbours);
      setDirty(false);
    } catch (err) {
      setError(extractError(err));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    activeVoucherId,
    bookId,
    filledRows,
    focusCell,
    narration,
    rows,
    voucherDate,
    voucherNumber,
  ]);

  const handleClear = useCallback(() => {
    if (dirty && !window.confirm('Clear all unsaved receipt rows?')) return;
    setRows(padRows([]));
    setVoucherDate(todayInput());
    setNarration('');
    setSavedInfo(null);
    setError(null);
    setRowErrors({});
    setDirty(false);
    setActiveRow(0);
  }, [dirty]);

  const handleBack = useCallback(() => {
    if (
      dirty &&
      !window.confirm('Discard unsaved receipt data and return to the book selection?')
    ) {
      return;
    }
    navigate('/transactions/bank-receipts/books');
  }, [dirty, navigate]);

  const handleExit = useCallback(() => {
    if (dirty && !window.confirm('Discard unsaved receipt data and leave this screen?')) return;
    navigate('/');
  }, [dirty, navigate]);

  const handlePrint = useCallback(() => {
    if (!activeVoucherId) {
      setError('Save the receipt before printing.');
      return;
    }
    if (dirty && !window.confirm('The receipt has unsaved changes. Print the last saved version?')) {
      return;
    }
    navigate(`/transactions/bank-receipts/cheque-entry/${activeVoucherId}/print`);
  }, [activeVoucherId, dirty, navigate]);

  const handleAdvice = useCallback(() => {
    if (!activeVoucherId) {
      setError('Save the receipt before generating a payment advice.');
      return;
    }
    if (
      dirty &&
      !window.confirm('The receipt has unsaved changes. Open the advice for the saved version?')
    ) {
      return;
    }
    navigate(`/transactions/bank-receipts/cheque-entry/${activeVoucherId}/advice`);
  }, [activeVoucherId, dirty, navigate]);

  const handleNeighbour = useCallback(
    (direction: 'previous' | 'next') => {
      const target = direction === 'previous' ? neighbours?.previous : neighbours?.next;
      if (!target) {
        setError(`No ${direction} receipt voucher was found in this book.`);
        return;
      }
      if (dirty && !window.confirm('Discard unsaved receipt data and open another voucher?')) return;
      navigate(`/transactions/bank-receipts/cheque-entry/${target.id}`);
    },
    [dirty, navigate, neighbours]
  );

  const handleGoToPayment = useCallback(() => {
    if (dirty && !window.confirm('Leave the unsaved receipt and open Bank Payment entry?')) return;
    navigate('/transactions/bank-payments/new');
  }, [dirty, navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? '';
      const typing =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable === true;

      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        setPartyDialog({ row: activeRow, search: '' });
        return;
      }
      if (dialogOpen) return;
      if (event.key === 'F10') {
        event.preventDefault();
        void handleSave();
        return;
      }
      if (typing) return;

      if (event.key === '1') {
        event.preventDefault();
        void handleSave();
      } else if (event.key === '2') {
        event.preventDefault();
        handleClear();
      } else if (event.key === '3') {
        event.preventDefault();
        handleBack();
      } else if (event.key === '4') {
        event.preventDefault();
        handlePrint();
      } else if (event.key === '5') {
        event.preventDefault();
        handleExit();
      } else if (event.key === '7') {
        event.preventDefault();
        handleNeighbour('previous');
      } else if (event.key === '8') {
        event.preventDefault();
        handleNeighbour('next');
      } else if (event.key === '9') {
        event.preventDefault();
        handleAdvice();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    activeRow,
    dialogOpen,
    handleAdvice,
    handleBack,
    handleClear,
    handleExit,
    handleNeighbour,
    handlePrint,
    handleSave,
  ]);

  const moveToNextCell = (rowIndex: number, cell: CellKey) => {
    const position = CELL_ORDER.indexOf(cell);
    if (position === CELL_ORDER.length - 1) {
      if (rowIndex + 1 >= rows.length) {
        setRows((prev) => [...prev, ...Array.from({ length: EXTRA_ROWS }, makeRow)]);
        window.setTimeout(() => focusCell(rowIndex + 1, 'party'), 0);
        return;
      }
      focusCell(rowIndex + 1, 'party');
      return;
    }
    focusCell(rowIndex, CELL_ORDER[position + 1]);
  };

  const handleCellKeyDown = (event: React.KeyboardEvent, rowIndex: number, cell: CellKey) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      moveToNextCell(rowIndex, cell);
      return;
    }
    if (event.key === 'Insert') {
      event.preventDefault();
      (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'Escape') {
      (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'ArrowDown' && cell !== 'adjustment') {
      event.preventDefault();
      focusCell(Math.min(rows.length - 1, rowIndex + 1), cell);
      return;
    }
    if (event.key === 'ArrowUp' && cell !== 'adjustment') {
      event.preventDefault();
      focusCell(Math.max(0, rowIndex - 1), cell);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#2c5f57] mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading cheque receipt entry...</p>
        </div>
      </div>
    );
  }

  if (cancelledVoucher) {
    const cancelledLines = cancelledVoucher.receiptLines ?? [];
    const cancelledTotal = cancelledLines.length
      ? cancelledLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
      : Number(cancelledVoucher.amount) || 0;

    return (
      <div className="w-full max-w-[1100px] mx-auto pb-4">
        <div className="bg-[#2c5f57] text-white rounded-t-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-200" />
            <div>
              <h1 className="text-[13px] font-bold leading-tight">
                Bank Receipt &gt; Cheque Receipt
              </h1>
              <p className="text-[10.5px] text-white/70 leading-tight">
                {cancelledVoucher.voucherNumber}
                {activeFinancialYear ? ` - FY ${activeFinancialYear.yearName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate('/transactions/bank-receipts')}
              className="flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 px-2 py-1 text-[11px] font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Register
            </button>
            <button
              type="button"
              onClick={() =>
                navigate(`/transactions/bank-receipts/cheque-entry/${cancelledVoucher.id}/print`)
              }
              className="flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 px-2 py-1 text-[11px] font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white border-x border-b border-slate-300 rounded-b-lg">
          <div className="flex items-start gap-2 bg-red-50 border-b border-red-200 px-3 py-2 text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-bold">This receipt voucher is cancelled and read-only</p>
              <p className="text-[11.5px] leading-snug">
                The accounting entries were reversed in full and the voucher number can never be
                reused. Record a new cheque receipt if the money was received again.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 px-3 py-2 bg-[#eef5f2] border-b border-slate-200 text-[11.5px]">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Voucher No.
              </span>
              <div className="font-mono font-bold text-[13px] text-slate-900">
                {cancelledVoucher.voucherNumber}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Date
              </span>
              <div className="font-mono text-slate-800">
                {dateLabel(cancelledVoucher.voucherDate)}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Book
              </span>
              <div className="text-slate-800">
                {book?.bookName ?? cancelledVoucher.receiptBook?.bookName ?? 'Bank receipt book'}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Bank A/C
              </span>
              <div className="text-slate-800">{cancelledVoucher.bankAccountDisplayName}</div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Receipt
              </span>
              <div className="font-mono font-bold text-[13px] text-slate-900">
                Rs. {money(cancelledTotal)}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Status
              </span>
              <span className="inline-block mt-0.5 rounded bg-red-100 border border-red-300 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                CANCELLED
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Cancelled On
              </span>
              <div className="font-mono text-slate-800">
                {dateLabel(cancelledVoucher.cancelledAt)}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Revision
              </span>
              <div className="font-mono text-slate-800">{cancelledVoucher.revision}</div>
            </div>
          </div>

          <div className="px-3 py-2 border-b border-slate-200 text-[11.5px]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Cancellation Reason
            </span>
            <p className="text-slate-800">{cancelledVoucher.cancellationReason ?? '-'}</p>
          </div>

          {cancelledVoucher.narration && (
            <div className="px-3 py-2 border-b border-slate-200 text-[11.5px]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Narration
              </span>
              <p className="text-slate-800">{cancelledVoucher.narration}</p>
            </div>
          )}

          <div className="overflow-auto">
            <table className="w-full text-[11.5px] border-collapse">
              <thead className="bg-[#d5e7e1]">
                <tr className="text-slate-700 text-[10px] uppercase tracking-wider">
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-10">#</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Party</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-40">Bank Name</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-32">Cheque No.</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93]">Description</th>
                  <th className="px-2 py-1.5 text-left border-b border-[#789d93] w-28">Adjustment</th>
                  <th className="px-2 py-1.5 text-right border-b border-[#789d93] w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {cancelledLines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-center text-slate-500">
                      No receipt rows are stored for this cancelled voucher.
                    </td>
                  </tr>
                )}
                {cancelledLines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-200">
                    <td className="px-2 py-1 text-slate-500">{line.rowNumber}</td>
                    <td className="px-2 py-1">
                      <div className="font-semibold text-slate-800">
                        {line.party?.partyName ?? '-'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {line.party?.partyCode ?? ''}
                      </div>
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-700">
                      {line.bankInstrument?.code ?? line.bankNameCode ?? '-'}
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-700">{line.chequeNumber ?? '-'}</td>
                    <td className="px-2 py-1 text-slate-700">{line.description ?? '-'}</td>
                    <td className="px-2 py-1 text-slate-700">
                      {RECEIPT_ADJUSTMENT_MODE_LABELS[line.adjustmentMode]}
                    </td>
                    <td className="px-2 py-1 text-right font-mono font-semibold text-slate-900">
                      {money(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef5f2] font-bold">
                  <td colSpan={6} className="px-2 py-1.5 text-right text-slate-700">
                    Total Receipt
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[13px] text-slate-900">
                    Rs. {money(cancelledTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }
  if (!bookId && !book) {
    return (
      <div className="max-w-xl mx-auto mt-12 bg-white border border-slate-300 rounded-lg shadow-sm p-6 text-center space-y-3">
        <Landmark className="w-8 h-8 text-[#2c5f57] mx-auto" />
        <h1 className="text-[15px] font-bold text-slate-800">Select a Bank Receipt Book</h1>
        <p className="text-[12px] text-slate-600">
          A Bank Receipt Book links the voucher prefix to the bank ledger account that receives the
          money.
        </p>
        {error && (
          <p className="text-[11.5px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => navigate('/transactions/bank-receipts/books')}
          className="px-3 py-1.5 text-[11.5px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#204741]"
        >
          Open Bank Receipt Books
        </button>
      </div>
    );
  }

  const outstandingRow = outstandingDialog ? rows[outstandingDialog.row] : null;

  return (
    <div className="w-full max-w-[1500px] mx-auto pb-4">
      <div className="bg-[#2c5f57] text-white rounded-t-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-200" />
          <div>
            <h1 className="text-[13px] font-bold leading-tight">
              Bank Receipt &gt; Cheque Receipt
            </h1>
            <p className="text-[10.5px] text-white/70 leading-tight">
              {book?.bookName ?? 'No book'}
              {activeFinancialYear ? ` - FY ${activeFinancialYear.yearName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 rounded bg-white/10 hover:bg-white/20 border border-white/25 px-2 py-1 text-[11px] font-bold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Books
          </button>
          <button
            type="button"
            onClick={handleGoToPayment}
            className="rounded bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 text-[11px] font-bold"
          >
            Go To Payment
          </button>
        </div>
      </div>

      <div className="bg-[#eef5f2] border-x border-slate-300 px-2 py-1.5 flex flex-wrap items-end gap-x-4 gap-y-1 text-[11px]">
        <div className="min-w-[110px]">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Voucher No.
          </span>
          <div className="font-mono font-bold text-[12.5px] leading-tight text-slate-900">
            {voucherNumber || 'AUTO'}
          </div>
        </div>
        <div>
          <label
            className="block text-[9px] font-bold uppercase tracking-wider text-slate-500"
            htmlFor="voucherDate"
          >
            Date
          </label>
          <input
            id="voucherDate"
            type="date"
            value={voucherDate}
            onChange={(event) => {
              setVoucherDate(event.target.value);
              setDirty(true);
            }}
            className="h-6 px-1 text-[11px] bg-white border border-slate-300 focus:outline-none focus:border-[#2c5f57]"
          />
        </div>
        <div>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            Bank A/C No.
          </span>
          <div className="font-mono leading-tight text-slate-800">
            {book?.bankAccount.bankAccountNumber ?? (
              <span className="text-amber-700">Not configured</span>
            )}
          </div>
        </div>
        <div className="min-w-[170px]">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
            A/C Name / Balance
          </span>
          <div className="leading-tight text-slate-800">
            {book?.bankAccount.bankName ?? book?.bankAccount.accountName ?? '-'}
            <span
              className={`ml-1.5 font-mono font-bold ${
                book?.balance.nature === 'Cr' ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {signedBalance(book?.balance ?? null)}
            </span>
          </div>
        </div>
        <div className="min-w-[170px]">
          <label
            className="block text-[9px] font-bold uppercase tracking-wider text-slate-500"
            htmlFor="bookSelect"
          >
            Book
          </label>
          <select
            id="bookSelect"
            value={bookId}
            onChange={(event) => void handleBookChange(event.target.value)}
            disabled={Boolean(activeVoucherId)}
            className="h-6 px-1 text-[11px] bg-white border border-slate-300 focus:outline-none focus:border-[#2c5f57] disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Select a book</option>
            {books.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.prefix ? `${candidate.prefix} - ` : ''}
                {candidate.bookName}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label
            className="block text-[9px] font-bold uppercase tracking-wider text-slate-500"
            htmlFor="narration"
          >
            Narration
          </label>
          <input
            id="narration"
            value={narration}
            onChange={(event) => {
              setNarration(event.target.value);
              setDirty(true);
            }}
            maxLength={250}
            placeholder="Optional voucher narration"
            className="w-full h-6 px-1 text-[11px] bg-white border border-slate-300 focus:outline-none focus:border-[#2c5f57]"
          />
        </div>
      </div>

      {error && !dialogOpen && (
        <div className="bg-red-50 border-x border-b border-red-300 text-red-800 px-3 py-1.5 text-[11.5px] font-semibold flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {savedInfo && (
        <div className="bg-emerald-50 border-x border-b border-emerald-300 text-emerald-800 px-3 py-1.5 text-[11.5px] font-semibold flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>
            Saved as <span className="font-mono font-bold">{savedInfo.number}</span>
          </span>
          <button
            type="button"
            onClick={() =>
              navigate(`/transactions/bank-receipts/cheque-entry/${savedInfo.id}/print`)
            }
            className="ml-auto flex items-center gap-1 rounded border border-emerald-400 bg-white px-2 py-0.5 text-[10.5px] font-bold"
          >
            <Printer className="w-3 h-3" />
            Print
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/transactions/bank-receipts/cheque-entry/${savedInfo.id}/advice`)
            }
            className="flex items-center gap-1 rounded border border-emerald-400 bg-white px-2 py-0.5 text-[10.5px] font-bold"
          >
            <FileText className="w-3 h-3" />
            Pmt. Advice
          </button>
        </div>
      )}
      <div className="bg-white border-x border-slate-300">
        <div className="overflow-auto max-h-[calc(100vh-360px)] min-h-[300px]">
          <table className="w-full border-collapse text-[11.5px] min-w-[1060px]">
            <thead className="sticky top-0 z-10 bg-[#d5e7e1]">
              <tr className="text-[10px] uppercase tracking-wider text-slate-700">
                <th className="w-9 border border-[#789d93] px-1 py-1">Sr</th>
                <th className="w-[230px] border border-[#789d93] px-1 py-1 text-left">
                  Account Name
                </th>
                <th className="w-[110px] border border-[#789d93] px-1 py-1 text-left">Bank Name</th>
                <th className="w-[150px] border border-[#789d93] px-1 py-1 text-left">
                  Chq No{' '}
                  <span className="normal-case text-[8.5px] text-slate-500">
                    (Insert Key To Save)
                  </span>
                </th>
                <th className="border border-[#789d93] px-1 py-1 text-left">
                  Description{' '}
                  <span className="normal-case text-[8.5px] text-slate-500">
                    (Insert Key To Save)
                  </span>
                </th>
                <th className="w-[110px] border border-[#789d93] px-1 py-1 text-right">Amount</th>
                <th className="w-[160px] border border-[#789d93] px-1 py-1 text-left">Adjustment</th>
                <th className="w-7 border border-[#789d93]" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isActive = index === activeRow;
                const allocated = row.allocations.reduce(
                  (sum, allocation) => sum + (Number(allocation.allocatedAmount) || 0),
                  0
                );
                const rowError = rowErrors[row.key];
                return (
                  <React.Fragment key={row.key}>
                    <tr
                      className={
                        isActive ? 'bg-[#e3f1ec]' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      }
                    >
                    <td className="border border-slate-200 px-1 py-0.5 text-center font-mono text-[10.5px] text-slate-500">
                      {index + 1}
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <div className="flex items-center gap-0.5">
                        <input
                          ref={setCellRef(index, 'party')}
                          value={row.partyName}
                          placeholder="Type party name..."
                          onFocus={() => setActiveRow(index)}
                          onChange={(event) => {
                            updateRow(index, {
                              partyName: event.target.value,
                              partyId: null,
                              partyCode: '',
                              partyAddress: '',
                              partyBalance: null,
                              allocations: [],
                              adjustments: [],
                            });
                            clearRowError(row.key);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              openPartyDialog(index, row.partyName);
                              return;
                            }
                            if (
                              event.key.length === 1 &&
                              !event.ctrlKey &&
                              !event.metaKey &&
                              !event.altKey
                            ) {
                              event.preventDefault();
                              openPartyDialog(index, event.key);
                              return;
                            }
                            handleCellKeyDown(event, index, 'party');
                          }}
                          className="w-full h-6 px-1 bg-transparent text-[11.5px] focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                        />
                        <button
                          type="button"
                          onClick={() => openPartyDialog(index, row.partyName)}
                          className="p-0.5 text-slate-400 hover:text-[#2c5f57]"
                          title="Party lookup (Ctrl+L)"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <input
                        ref={setCellRef(index, 'bankName')}
                        value={row.bankNameCode}
                        placeholder="Code"
                        readOnly
                        onFocus={() => setActiveRow(index)}
                        onClick={() => setBankDialog({ row: index })}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' ||
                            event.key === 'ArrowDown' ||
                            (event.key.length === 1 && !event.ctrlKey && !event.metaKey)
                          ) {
                            event.preventDefault();
                            setBankDialog({ row: index });
                            return;
                          }
                          handleCellKeyDown(event, index, 'bankName');
                        }}
                        className="w-full h-6 px-1 bg-transparent font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#2c5f57] cursor-pointer"
                        title={row.bankNameDescription || 'Open bank name lookup'}
                      />
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <input
                        ref={setCellRef(index, 'cheque')}
                        value={row.chequeNumber}
                        placeholder="Cheque / UTR"
                        maxLength={20}
                        onFocus={() => setActiveRow(index)}
                        onChange={(event) => updateRow(index, { chequeNumber: event.target.value })}
                        onKeyDown={(event) => handleCellKeyDown(event, index, 'cheque')}
                        className="w-full h-6 px-1 bg-transparent font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                      />
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <input
                        ref={setCellRef(index, 'description')}
                        value={row.description}
                        placeholder="Description"
                        maxLength={200}
                        onFocus={() => setActiveRow(index)}
                        onChange={(event) => updateRow(index, { description: event.target.value })}
                        onKeyDown={(event) => handleCellKeyDown(event, index, 'description')}
                        className="w-full h-6 px-1 bg-transparent text-[11.5px] focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                      />
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <input
                        ref={setCellRef(index, 'amount')}
                        value={row.amount}
                        placeholder="0.00"
                        inputMode="decimal"
                        onFocus={() => setActiveRow(index)}
                        onChange={(event) => {
                          const cleaned = event.target.value.replace(/[^0-9.]/g, '');
                          const nextAmount = Number(cleaned) || 0;
                          const allocated = row.allocations.reduce(
                            (sum, allocation) => sum + (Number(allocation.allocatedAmount) || 0),
                            0
                          );
                          const patch: Partial<ReceiptRow> = { amount: cleaned };
                          if (nextAmount + 0.004 < allocated) {
                            patch.allocations = [];
                            patch.adjustments = [];
                          }
                          updateRow(index, patch);
                          clearRowError(row.key);
                        }}
                        onKeyDown={(event) => handleCellKeyDown(event, index, 'amount')}
                        className="w-full h-6 px-1 bg-transparent text-right font-mono text-[11.5px] focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                      />
                    </td>
                    <td className="border border-slate-200 px-1 py-0.5">
                      <div className="flex items-center gap-1">
                        <select
                          ref={setCellRef(index, 'adjustment')}
                          value={row.adjustmentMode}
                          onFocus={() => setActiveRow(index)}
                          onChange={(event) =>
                            changeAdjustmentMode(
                              index,
                              event.target.value as BankReceiptAdjustmentMode
                            )
                          }
                          className="h-6 flex-1 bg-transparent text-[10.5px] border-0 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                        >
                          {RECEIPT_ADJUSTMENT_MODE_ORDER.map((mode) => (
                            <option key={mode} value={mode}>
                              {RECEIPT_ADJUSTMENT_MODE_LABELS[mode]}
                            </option>
                          ))}
                        </select>
                        {row.adjustmentMode === 'AGAINST_BILL' && (
                          <button
                            type="button"
                            onClick={() => setOutstandingDialog({ row: index })}
                            className="rounded border border-emerald-400 bg-emerald-50 px-1 text-[9.5px] font-bold text-emerald-700"
                            title="Open outstanding adjustment"
                          >
                            {allocated > 0 ? money(allocated) : 'Adjust'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-slate-200 px-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          updateRow(index, { ...makeRow(), key: row.key });
                        }}
                        className="p-0.5 text-slate-300 hover:text-red-600"
                        title="Clear row"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                    </tr>
                    {rowError && (
                      <tr className="bg-red-50">
                        <td
                          colSpan={8}
                          className="border border-red-200 px-2 py-0.5 text-[10.5px] font-semibold text-red-700"
                        >
                          Row {index + 1} {'\u2014'} {rowError}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="sticky bottom-0 z-20">
        <div className="bg-[#eef5f2] border border-slate-300 border-t-0 px-3 py-1.5 flex items-end justify-between gap-3 flex-wrap text-[11px]">
          <div className="min-w-0">
            <div className="truncate">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Party:{' '}
              </span>
              <span className="font-semibold text-slate-800">
                {activeRowData?.partyName || '-'}
              </span>
            </div>
            <div className="truncate text-slate-600" title={activeRowData?.partyAddress ?? ''}>
              {activeRowData?.partyAddress || '-'}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Balance:{' '}
              </span>
              <span
                className={`font-mono font-bold ${
                  activeRowData?.partyBalance?.nature === 'Cr'
                    ? 'text-red-600'
                    : 'text-emerald-700'
                }`}
              >
                {signedBalance(activeRowData?.partyBalance ?? null)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              Total Receipt
            </div>
            <div className="font-mono text-[16px] font-bold text-blue-800">Rs. {money(total)}</div>
            <div className="text-[10px] text-slate-500">{filledRows.length} receipt row(s)</div>
          </div>
        </div>

        <div className="bg-[#2c5f57] rounded-b-lg px-2 py-1.5 flex flex-wrap items-center gap-1">
          <ToolbarButton
            hotkey="1"
            label="Save"
            tone="primary"
            onClick={() => void handleSave()}
            disabled={saving}
          />
          <ToolbarButton hotkey="2" label="Clear" onClick={handleClear} disabled={saving} />
          <ToolbarButton hotkey="3" label="Go Back" onClick={handleBack} disabled={saving} />
          <ToolbarButton hotkey="4" label="Print" onClick={handlePrint} disabled={saving} />
          <ToolbarButton hotkey="5" label="Exit" onClick={handleExit} disabled={saving} />
          <ToolbarButton
            hotkey="7"
            label="Previous"
            onClick={() => handleNeighbour('previous')}
            disabled={saving || !neighbours?.previous}
          />
          <ToolbarButton
            hotkey="8"
            label="Next"
            onClick={() => handleNeighbour('next')}
            disabled={saving || !neighbours?.next}
          />
          <ToolbarButton hotkey="9" label="Pmt.Advice" onClick={handleAdvice} disabled={saving} />
          {saving && (
            <span className="ml-2 flex items-center gap-1 text-[10.5px] text-emerald-200">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
        </div>
      </div>

      <ReceiptPartyLookupDialog
        open={Boolean(partyDialog)}
        initialSearch={partyDialog?.search ?? ''}
        onClose={() => setPartyDialog(null)}
        onSelect={handlePartySelected}
      />

      <BankNameLookupDialog
        open={Boolean(bankDialog)}
        onClose={() => setBankDialog(null)}
        onSelect={handleBankSelected}
      />

      {outstandingRow && (
        <OutstandingAdjustmentDialog
          open={Boolean(outstandingDialog)}
          partyId={outstandingRow.partyId}
          partyName={outstandingRow.partyName}
          partyAddress={outstandingRow.partyAddress}
          receiptAmount={Number(outstandingRow.amount) || 0}
          excludeVoucherId={activeVoucherId ?? undefined}
          initialAllocations={outstandingRow.allocations}
          initialAdjustments={outstandingRow.adjustments}
          onClose={() => setOutstandingDialog(null)}
          onApply={handleOutstandingApply}
        />
      )}
    </div>
  );
};

export default ChequeReceiptEntryPage;