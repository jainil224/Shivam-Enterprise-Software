import React, { useState, useEffect } from 'react';

export interface PrintOptions {
  challanFrom: string;
  challanTo: string;
  cartonFrom: string;
  cartonTo: string;
  copies: number;
  landscape: boolean;
  onePage2Copy: boolean;
  packingSlipTitle: 'None';
  printOnlyStockEntries: boolean;
}

interface PackingSlipPrintOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChallanNumber: string;
  challanId: string | null; // null if unsaved
  productionBookId: string;
  onPrint: (options: PrintOptions) => void;
  onPreview: (options: PrintOptions) => void;
  onExport: (options: PrintOptions) => void;
  onEmail: (options: PrintOptions) => void;
  onWhatsApp: (options: PrintOptions) => void;
}

export const PackingSlipPrintOptionsModal: React.FC<PackingSlipPrintOptionsModalProps> = ({
  isOpen,
  onClose,
  currentChallanNumber,
  challanId,
  productionBookId: _productionBookId,
  onPrint,
  onPreview,
  onExport,
  onEmail,
  onWhatsApp,
}) => {
  const [options, setOptions] = useState<PrintOptions>({
    challanFrom: currentChallanNumber,
    challanTo: currentChallanNumber,
    cartonFrom: '',
    cartonTo: '',
    copies: 1,
    landscape: false,
    onePage2Copy: false,
    packingSlipTitle: 'None',
    printOnlyStockEntries: false,
  });
  const [error, setError] = useState<string | null>(null);

  // Reset defaults whenever modal opens with a new challan number
  useEffect(() => {
    if (isOpen) {
      setOptions((prev) => ({
        ...prev,
        challanFrom: currentChallanNumber || '',
        challanTo: currentChallanNumber || '',
      }));
      setError(null);
    }
  }, [isOpen, currentChallanNumber]);

  const validate = (): boolean => {
    setError(null);
    if (!options.challanFrom.trim()) {
      setError('Challan From is required.');
      return false;
    }
    if (!options.challanTo.trim()) {
      setError('Challan To is required.');
      return false;
    }
    const from = parseInt(options.challanFrom, 10);
    const to = parseInt(options.challanTo, 10);
    if (!isNaN(from) && !isNaN(to) && from > to) {
      setError('Challan From cannot be greater than Challan To.');
      return false;
    }
    if (options.cartonFrom && options.cartonTo) {
      const cf = parseInt(options.cartonFrom, 10);
      const ct = parseInt(options.cartonTo, 10);
      if (!isNaN(cf) && !isNaN(ct) && cf > ct) {
        setError('Carton From cannot be greater than Carton To.');
        return false;
      }
    }
    if (options.copies < 1 || options.copies > 20) {
      setError('Copies must be between 1 and 20.');
      return false;
    }
    return true;
  };

  if (!isOpen) return null;

  const inputCls =
    'bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs font-mono w-28 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]';
  const labelCls = 'font-bold text-slate-800 text-xs w-36 text-right pr-2 select-none';
  const rowCls = 'flex items-center gap-2 py-1';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#dce8e1] rounded-none shadow-2xl border-2 border-[#2c5f57] w-[460px] max-w-full flex flex-col font-sans select-none">
        {/* Title Bar */}
        <div className="bg-[#2c5f57] text-white px-3 py-1 flex items-center justify-between border-b border-[#1f4842]">
          <span className="font-bold text-xs tracking-wide">Print Options</span>
          <button
            onClick={onClose}
            className="w-4 h-4 bg-[#eb5757] hover:bg-red-600 text-white flex items-center justify-center text-[10px] font-bold rounded-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 space-y-1">
          {/* Error Notice */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-800 px-2 py-1 text-xs rounded mb-2">
              ⚠️ {error}
            </div>
          )}

          {/* Unsaved warning */}
          {!challanId && (
            <div className="bg-amber-100 border border-amber-400 text-amber-800 px-2 py-1 text-xs rounded mb-2">
              ⚠️ Challan not yet saved. Please save before printing.
            </div>
          )}

          {/* Challan Range */}
          <div className="text-[10px] font-bold text-slate-600 uppercase border-b border-[#789d93] pb-0.5 mb-1 tracking-wider">
            Challan Range
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Challan From :</span>
            <input
              type="text"
              className={inputCls}
              value={options.challanFrom}
              onChange={(e) => setOptions((o) => ({ ...o, challanFrom: e.target.value }))}
            />
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Challan To :</span>
            <input
              type="text"
              className={inputCls}
              value={options.challanTo}
              onChange={(e) => setOptions((o) => ({ ...o, challanTo: e.target.value }))}
            />
          </div>

          {/* Carton Range */}
          <div className="text-[10px] font-bold text-slate-600 uppercase border-b border-[#789d93] pb-0.5 mb-1 mt-2 tracking-wider">
            Carton Range
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Carton From :</span>
            <input
              type="text"
              className={`${inputCls} w-24`}
              placeholder="(all)"
              value={options.cartonFrom}
              onChange={(e) => setOptions((o) => ({ ...o, cartonFrom: e.target.value }))}
            />
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Carton To :</span>
            <input
              type="text"
              className={`${inputCls} w-24`}
              placeholder="(all)"
              value={options.cartonTo}
              onChange={(e) => setOptions((o) => ({ ...o, cartonTo: e.target.value }))}
            />
          </div>

          {/* Format & Copies */}
          <div className="text-[10px] font-bold text-slate-600 uppercase border-b border-[#789d93] pb-0.5 mb-1 mt-2 tracking-wider">
            Format & Copies
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Format :</span>
            <span className="text-xs font-mono font-bold text-slate-800 bg-white/70 px-2 py-0.5 border border-[#789d93] rounded-xs">
              A4
            </span>
          </div>
          <div className={rowCls}>
            <span className={labelCls}>Copies :</span>
            <input
              type="number"
              min={1}
              max={20}
              className={`${inputCls} w-16`}
              value={options.copies}
              onChange={(e) =>
                setOptions((o) => ({
                  ...o,
                  copies: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)),
                }))
              }
            />
          </div>

          {/* Checkboxes */}
          <div className={rowCls}>
            <span className={labelCls}></span>
            <label className="flex items-center gap-2 text-xs cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={options.landscape}
                onChange={(e) => setOptions((o) => ({ ...o, landscape: e.target.checked }))}
                className="w-3.5 h-3.5 accent-[#2c5f57]"
              />
              <span>Landscape</span>
            </label>
          </div>

          <div className={rowCls}>
            <span className={labelCls}></span>
            <label
              className="flex items-center gap-2 text-xs cursor-not-allowed"
              title="One page 2 Copy — Behaviour pending confirmation from original software. Currently unavailable."
            >
              <input
                type="checkbox"
                checked={options.onePage2Copy}
                disabled
                className="w-3.5 h-3.5 opacity-50"
              />
              <span className="text-slate-500">One page 2 Copy</span>
              <span className="text-[9px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-mono">
                (pending confirmation)
              </span>
            </label>
          </div>

          <div className={rowCls}>
            <span className={labelCls}>Packing Slip Title :</span>
            <select
              className={`${inputCls} w-32`}
              value={options.packingSlipTitle}
              onChange={(e) =>
                setOptions((o) => ({ ...o, packingSlipTitle: e.target.value as 'None' }))
              }
            >
              <option value="None">None</option>
            </select>
          </div>

          <div className={rowCls}>
            <span className={labelCls}></span>
            <label
              className="flex items-center gap-2 text-xs cursor-not-allowed"
              title="Print Only in Stock Entries — Disabled until the Stock Entry module is available."
            >
              <input type="checkbox" disabled checked={false} className="w-3.5 h-3.5 opacity-50" />
              <span className="text-slate-500">Print Only in Stock Entries</span>
              <span className="text-[9px] text-amber-700 bg-amber-100 px-1 py-0.2 rounded font-mono">
                (module pending)
              </span>
            </label>
          </div>

          <div className={rowCls}>
            <span className={labelCls}>Printer :</span>
            <span className="text-[11px] text-slate-600 italic">
              Select your printer in the Windows print dialog.
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="px-4 py-2.5 bg-[#e4eee8] flex flex-wrap gap-1.5 justify-center border-t border-[#789d93]">
          <button
            onClick={() => {
              if (validate()) onPrint(options);
            }}
            disabled={!challanId}
            className="bg-[#2c5f57] hover:bg-[#1f4842] text-white border border-[#1f4842] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Print
          </button>
          <button
            onClick={() => {
              if (validate()) onPreview(options);
            }}
            disabled={!challanId}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-[#789d93] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Preview
          </button>
          <button
            onClick={() => {
              if (validate()) onExport(options);
            }}
            disabled={!challanId}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-[#789d93] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Export PDF
          </button>
          <button
            onClick={() => {
              if (validate()) onEmail(options);
            }}
            disabled={!challanId}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-[#789d93] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Email
          </button>
          <button
            onClick={() => {
              if (validate()) onWhatsApp(options);
            }}
            disabled={!challanId}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-[#789d93] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            WhatsApp
          </button>
          <button
            onClick={onClose}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-[#789d93] rounded-xs px-3 py-1 text-xs font-bold shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackingSlipPrintOptionsModal;

