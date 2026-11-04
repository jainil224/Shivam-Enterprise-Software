import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  Search,
  Eye,
  RotateCw,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import { listPurchaseBills } from '../services/api';

export const PurchaseRegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany, activeFinancialYear } = useCompany();

  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPurchaseBills({
        search: search.trim() || undefined,
        page,
        limit: 20,
      });
      setBills(res.data);
      setTotalPages(res.totalPages);
      setTotalRecords(res.total);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBills();
  };

  return (
    <div className="min-h-screen bg-[#dce8e1] text-slate-800 flex flex-col font-sans select-none text-xs">
      {/* ── Title Bar ────────────────────────────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-4 py-2 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-5 h-5 text-emerald-300" />
          <div>
            <h1 className="font-bold text-sm tracking-wide">
              Purchase Bill Register (Tax Inward)
            </h1>
            <p className="text-[10px] text-emerald-100">
              {activeCompany?.companyName || 'SHIVAM ENTERPRISE'} • FY: {activeFinancialYear?.yearName || '2026-2027'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/transactions/purchase/new')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded flex items-center space-x-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Bill</span>
          </button>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#789d93] px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search by Bill #, Supplier, GSTIN or Invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-1 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
            />
          </div>
          <button
            type="submit"
            className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSearch('');
              setPage(1);
              fetchBills();
            }}
            className="p-1 hover:bg-slate-100 rounded text-slate-600 cursor-pointer"
            title="Refresh List"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <span className="font-mono text-slate-600 text-[11px]">
            Total: <strong>{totalRecords}</strong> bills
          </span>
        </div>
      </div>

      {/* ── Data Table ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded border border-[#789d93] overflow-hidden shadow-xs">
          <table className="w-full text-xs">
            <thead className="bg-[#c2ded7] text-[#1e403a] font-bold border-b border-[#789d93]">
              <tr>
                <th className="py-2 px-3 text-left w-32">Bill Number</th>
                <th className="py-2 px-2 text-center w-24">Date</th>
                <th className="py-2 px-3 text-left">Supplier Name & GSTIN</th>
                <th className="py-2 px-2 text-center w-28">Source Challan</th>
                <th className="py-2 px-3 text-right w-24">Qty (KG)</th>
                <th className="py-2 px-3 text-right w-28">Taxable (₹)</th>
                <th className="py-2 px-3 text-right w-32">Bill Total (₹)</th>
                <th className="py-2 px-2 text-center w-24">Verification</th>
                <th className="py-2 px-2 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    Loading Purchase Bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    No purchase bills found. Create a new bill directly or from a confirmed production challan.
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-bold text-[#2c5f57]">
                      <button
                        onClick={() => navigate(`/transactions/purchase/${b.id}`)}
                        className="hover:underline cursor-pointer"
                      >
                        {b.billNumber}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center text-slate-700">
                      {new Date(b.billDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <div className="font-semibold text-slate-900">{b.supplierLegalName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        GSTIN: {b.supplierGstin || 'Unregistered'}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono">
                      {b.sourceChallan ? (
                        <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 text-[11px] font-bold">
                          #{b.sourceChallan.challanNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {Number(b.totalQuantity).toFixed(3)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-700">
                      ₹{Number(b.taxableAmount).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-[#0d5f32] text-sm">
                      ₹{Number(b.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {b.isVerifiedSupplier ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => navigate(`/transactions/purchase/${b.id}`)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                        title="View Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 px-2">
            <span className="text-[11px] text-slate-600">
              Page {page} of {totalPages}
            </span>
            <div className="flex space-x-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseRegisterPage;
