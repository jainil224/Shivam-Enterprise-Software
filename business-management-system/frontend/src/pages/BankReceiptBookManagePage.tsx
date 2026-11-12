import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Plus, RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  createBankReceiptBook,
  getBankReceiptBooks,
  getLedgerAccounts,
  updateBankReceiptBook,
} from '../services/api';
import { BankReceiptBook, LedgerAccount } from '../types';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40';

interface BookFormState {
  id: string | null;
  prefix: string;
  bookName: string;
  bankAccountLedgerId: string;
  isActive: boolean;
}

const emptyForm: BookFormState = {
  id: null,
  prefix: 'BR-',
  bookName: '',
  bankAccountLedgerId: '',
  isActive: true,
};

export const BankReceiptBookManagePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [books, setBooks] = useState<BankReceiptBook[]>([]);
  const [bankLedgers, setBankLedgers] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<BookFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompany || !activeFinancialYear) return;
    setLoading(true);
    setError(null);
    try {
      const [bookRows, ledgers] = await Promise.all([
        getBankReceiptBooks(),
        getLedgerAccounts({ isBankAccount: true, includeInactive: false }),
      ]);
      setBooks(bookRows);
      setBankLedgers(ledgers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Bank Receipt Books.');
    } finally {
      setLoading(false);
    }
  }, [activeCompany, activeFinancialYear]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setForm({ ...emptyForm });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const activeBankLedgers = useMemo(
    () => bankLedgers.filter((ledger) => ledger.isActive && ledger.isBankAccount),
    [bankLedgers]
  );

  const openEdit = (book: BankReceiptBook) => {
    setForm({
      id: book.id,
      prefix: book.prefix,
      bookName: book.bookName,
      bankAccountLedgerId: book.bankAccountLedgerId,
      isActive: book.isActive,
    });
    setFormError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        prefix: form.prefix.trim(),
        bookName: form.bookName.trim(),
        bankAccountLedgerId: form.bankAccountLedgerId,
        isActive: form.isActive,
      };
      if (form.id) {
        await updateBankReceiptBook(form.id, payload);
        setNotice(`Book ${payload.bookName} updated.`);
      } else {
        await createBankReceiptBook(payload);
        setNotice(`Book ${payload.bookName} created.`);
      }
      setForm(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save the Bank Receipt Book.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef5f2] p-4">
      <div className="max-w-5xl mx-auto space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/transactions/bank-receipts/books')}
              className="flex items-center gap-1 bg-[#2c5f57] hover:bg-[#204741] text-white px-2.5 py-1 rounded text-[11.5px] font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Book Selector
            </button>
            <h1 className="text-[15px] font-bold text-slate-800">Bank Receipt Books</h1>
            <span className="text-[11px] text-slate-500 font-mono">
              {activeFinancialYear?.yearName ?? ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-[11.5px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ ...emptyForm });
                setFormError(null);
              }}
              className="flex items-center gap-1 bg-[#107c41] hover:bg-[#0c6334] text-white px-2.5 py-1 rounded text-[11.5px] font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              New Book
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-[11.5px] px-2.5 py-1.5 rounded">
            <TriangleAlert className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11.5px] px-2.5 py-1.5 rounded">
            {notice}
          </div>
        )}

        <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                  <th className="px-2 py-1.5 text-left border-b border-slate-300 w-24">Prefix</th>
                  <th className="px-2 py-1.5 text-left border-b border-slate-300">Book Name</th>
                  <th className="px-2 py-1.5 text-left border-b border-slate-300">Linked Bank A/C</th>
                  <th className="px-2 py-1.5 text-right border-b border-slate-300 w-40">Balance</th>
                  <th className="px-2 py-1.5 text-center border-b border-slate-300 w-24">Status</th>
                  <th className="px-2 py-1.5 text-center border-b border-slate-300 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57] mx-auto mb-2" />
                      Loading books...
                    </td>
                  </tr>
                ) : books.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-10 text-center text-slate-500">
                      <p className="text-[12.5px] font-semibold text-slate-600">
                        No Bank Receipt Books yet
                      </p>
                      <p className="text-[11px] mt-1">
                        A book links a prefix and a bank ledger to every cheque receipt you enter.
                      </p>
                    </td>
                  </tr>
                ) : (
                  books.map((book) => (
                    <tr key={book.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-2 py-1.5 font-mono font-bold text-slate-800">
                        {book.prefix || '(blank)'}
                      </td>
                      <td className="px-2 py-1.5 font-semibold text-slate-800">{book.bookName}</td>
                      <td className="px-2 py-1.5">
                        <div>{book.bankAccount.accountName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {book.bankAccount.bankAccountNumber ?? book.bankAccount.accountCode}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        <span
                          className={
                            book.balance.nature === 'Cr' ? 'text-red-600' : 'text-emerald-700'
                          }
                        >
                          {money(book.balance.amount)} {book.balance.nature}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border ${
                            book.isActive
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          {book.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => openEdit(book)}
                          title="Edit book"
                          className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10.5px] text-slate-500">
          Voucher numbers are generated per financial year from the book prefix. Deactivating a book
          hides it from the selector but keeps every existing voucher readable.
        </p>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-[#2c5f57] text-white">
              <span className="text-[12.5px] font-bold">
                {form.id ? 'Edit Bank Receipt Book' : 'New Bank Receipt Book'}
              </span>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="p-1 rounded hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls} htmlFor="bookPrefix">
                    Prefix
                  </label>
                  <input
                    id="bookPrefix"
                    value={form.prefix}
                    onChange={(event) =>
                      setForm((prev) => (prev ? { ...prev, prefix: event.target.value } : prev))
                    }
                    maxLength={10}
                    className={`${inputCls} font-mono uppercase`}
                    placeholder="BR-"
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} htmlFor="bookName">
                    Book Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="bookName"
                    value={form.bookName}
                    onChange={(event) =>
                      setForm((prev) => (prev ? { ...prev, bookName: event.target.value } : prev))
                    }
                    maxLength={60}
                    className={inputCls}
                    placeholder="HDFC CURRENT RECEIPTS"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="bookBank">
                  Linked Bank Ledger <span className="text-red-500">*</span>
                </label>
                <select
                  id="bookBank"
                  value={form.bankAccountLedgerId}
                  onChange={(event) =>
                    setForm((prev) =>
                      prev ? { ...prev, bankAccountLedgerId: event.target.value } : prev
                    )
                  }
                  className={inputCls}
                >
                  <option value="">Select a bank ledger...</option>
                  {activeBankLedgers.map((ledger) => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.accountCode} - {ledger.bankName || ledger.accountName}
                    </option>
                  ))}
                </select>
                {activeBankLedgers.length === 0 && (
                  <p className="text-[10.5px] text-amber-700 mt-1">
                    No active bank ledger found. Create one in Ledger &amp; Bank Accounts first.
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 text-[11.5px] text-slate-700 font-semibold">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                  }
                  className="w-3.5 h-3.5"
                />
                Book is active and selectable for new receipts
              </label>

              {formError && (
                <p className="text-[11px] text-red-700 font-semibold bg-red-50 border border-red-200 rounded px-2 py-1">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-1.5 px-3 py-2 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={saving}
                className="px-3 py-1.5 text-[11.5px] font-bold rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3 py-1.5 text-[11.5px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#204741] disabled:bg-slate-400 flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saving ? 'Saving...' : 'Save Book'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BankReceiptBookManagePage;