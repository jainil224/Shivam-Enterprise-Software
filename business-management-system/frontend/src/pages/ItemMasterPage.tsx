import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { getItemLookups, getItems, setItemStatus } from '../services/api';
import {
  ITEM_TYPE_LABELS,
  Item,
  ItemLookups,
  UNIT_LABELS,
} from '../types/orders';
import { useCompany } from '../context/CompanyContext';
import { ItemModal } from '../components/ItemModal';

const money = (value: string | number | null | undefined): string => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0.00';
  return numeric.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
};

export const ItemMasterPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [items, setItems] = useState<Item[]>([]);
  const [lookups, setLookups] = useState<ItemLookups | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const loadItems = useCallback(async () => {
    if (!activeCompany) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getItems({
        search: searchQuery.trim() || undefined,
        itemType: selectedType === 'ALL' ? undefined : selectedType,
        includeInactive,
      });
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany, searchQuery, selectedType, includeInactive]);

  useEffect(() => {
    if (!activeCompany) return;
    void getItemLookups()
      .then(setLookups)
      .catch(() => setLookups(null));
  }, [activeCompany]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadItems]);

  const handleToggleStatus = async (item: Item) => {
    const nextStatus = !item.isActive;
    try {
      await setItemStatus(item.id, nextStatus);
      setSuccessMsg(
        `Item ${item.itemCode} has been ${nextStatus ? 'activated' : 'deactivated'}.`
      );
      setTimeout(() => setSuccessMsg(null), 3500);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item status.');
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <button onClick={() => navigate('/')} className="hover:text-slate-900 transition-colors">
          Dashboard
        </button>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="text-slate-400">Master Management</span>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="font-semibold text-slate-800">Item Master</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Item Master</h1>
            <p className="text-xs text-slate-500">
              Yarn, raw material and fabric items used by sales and purchase orders.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => void loadItems()}
            title="Refresh List"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg px-3 py-2 text-xs font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-2.5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div className="md:col-span-2 relative">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
              Search
            </label>
            <Search className="absolute left-2 top-[26px] w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Item code, name, HSN or category…"
              className="w-full h-8 pl-7 pr-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
              Item Type
            </label>
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className="w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40"
            >
              <option value="ALL">All types</option>
              {(lookups?.itemTypes ?? []).map((type) => (
                <option key={type} value={type}>
                  {ITEM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 h-8 text-[11.5px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Include inactive
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-bold uppercase tracking-wider text-[10px]">Code</th>
                <th className="px-2.5 py-1.5 text-left font-bold uppercase tracking-wider text-[10px]">Item Name</th>
                <th className="px-2.5 py-1.5 text-left font-bold uppercase tracking-wider text-[10px]">Type</th>
                <th className="px-2.5 py-1.5 text-left font-bold uppercase tracking-wider text-[10px]">Unit</th>
                <th className="px-2.5 py-1.5 text-left font-bold uppercase tracking-wider text-[10px]">HSN</th>
                <th className="px-2.5 py-1.5 text-right font-bold uppercase tracking-wider text-[10px]">GST %</th>
                <th className="px-2.5 py-1.5 text-right font-bold uppercase tracking-wider text-[10px]">Sales Rate</th>
                <th className="px-2.5 py-1.5 text-right font-bold uppercase tracking-wider text-[10px]">Purchase Rate</th>
                <th className="px-2.5 py-1.5 text-center font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-2.5 py-1.5 text-center font-bold uppercase tracking-wider text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1.5" />
                    Loading items…
                  </td>
                </tr>
              )}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    No items found. Add the first item to start creating orders.
                  </td>
                </tr>
              )}

              {!isLoading &&
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-2.5 py-1.5 font-mono text-slate-700">{item.itemCode}</td>
                    <td className="px-2.5 py-1.5">
                      <div className="font-semibold text-slate-800">{item.itemName}</div>
                      {item.itemCategory && (
                        <div className="text-[10.5px] text-slate-500">{item.itemCategory}</div>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5">{ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}</td>
                    <td className="px-2.5 py-1.5">{UNIT_LABELS[item.unit] ?? item.unit}</td>
                    <td className="px-2.5 py-1.5 font-mono">{item.hsnCode ?? '—'}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{Number(item.gstRate).toFixed(2)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{money(item.defaultSalesRate)}</td>
                    <td className="px-2.5 py-1.5 text-right font-mono">{money(item.defaultPurchaseRate)}</td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          title="Edit item"
                          className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(item)}
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${
                            item.isActive
                              ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <ItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          setSuccessMsg('Item saved successfully.');
          setTimeout(() => setSuccessMsg(null), 3500);
          void loadItems();
        }}
        itemToEdit={editingItem}
        lookups={lookups}
      />
    </div>
  );
};