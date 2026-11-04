import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { getProductionReceiveById, listProductionReceivesPaginated } from '../services/api';
import { PackingSlipTemplate, PackingSlipData } from './PackingSlipTemplate';

// A4 sheet geometry in CSS pixels (96 dpi) - see the @page rule inside PackingSlipTemplate.
// Used only to zoom the on-screen preview; printing always uses the real millimetre sizes.
// Trade name printed on the slip. The company master stores the short legal form
// ("SHIVAM PVT"), so the printed document expands it to the trading name. Display-only:
// no database write. Any other / renamed company prints exactly what the master stores.
const PRINT_TRADE_NAME = 'SHIVAM ENTERPRISE';

const resolvePrintCompanyName = (storedName?: string): string => {
  const name = (storedName || '').trim();
  if (!name) return PRINT_TRADE_NAME;
  if (/^shivam\s+pvt\.?$/i.test(name)) return PRINT_TRADE_NAME;
  return name;
};

const A4_PORTRAIT_WIDTH_PX = (190 / 25.4) * 96;
const A4_LANDSCAPE_WIDTH_PX = (277 / 25.4) * 96;

export const PackingSlipPrintPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeCompany } = useCompany();

  // Query Parameters from Modal
  const challanFrom = searchParams.get('challanFrom') || '';
  const challanTo = searchParams.get('challanTo') || '';
  const cartonFrom = searchParams.get('cartonFrom') || '';
  const cartonTo = searchParams.get('cartonTo') || '';
  const copies = Math.max(1, parseInt(searchParams.get('copies') || '1', 10));
  const landscape = searchParams.get('landscape') === 'true';
  const bookId = searchParams.get('bookId') || '';
  const singleChallanId = searchParams.get('challanId') || '';

  const [slips, setSlips] = useState<PackingSlipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSlips = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allSlips: PackingSlipData[] = [];

      // If single challan id was directly provided and no range divergence
      if (singleChallanId && (!challanTo || challanFrom === challanTo)) {
        const detail = await getProductionReceiveById(singleChallanId);
        const quality = detail.yarnQuality?.qualityName || '';
        const denier = detail.yarnQuality?.denier || '';
        const headerLot = detail.lotNumber || '';
        const headerGrade = detail.yarnGrade?.gradeName || '';

        for (const item of detail.items || []) {
          // Carton range filtering
          if (cartonFrom || cartonTo) {
            const cNum = parseInt(item.cartonNumber, 10);
            const cfNum = parseInt(cartonFrom, 10);
            const ctNum = parseInt(cartonTo, 10);
            if (!isNaN(cfNum) && cNum < cfNum) continue;
            if (!isNaN(ctNum) && cNum > ctNum) continue;
          }

          allSlips.push({
            challanId: detail.id,
            challanNumber: detail.challanNumber,
            challanDate: detail.challanDate,
            companyName: resolvePrintCompanyName(activeCompany?.companyName),
            companyPhone: activeCompany?.phone || undefined,
            bookName: detail.productionBook?.bookName || '',
            quality,
            denier,
            cartonNumber: item.cartonNumber,
            cops: item.cops,
            lotNumber: item.lotNumber || headerLot,
            grossWeight: parseFloat(item.grossWeight) || 0,
            shadeNo: item.shadeNo || undefined,
            tareWeight: parseFloat(item.tareWeight) || 0,
            grade: item.grade || headerGrade,
            netWeight: parseFloat(item.netWeight) || 0,
          });
        }
      } else {
        // Query paginated list to find all challans within range
        const result = await listProductionReceivesPaginated({
          productionBookId: bookId || undefined,
          page: 1,
          limit: 500,
        });

        const challans = result.data || [];
        const fromNum = parseInt(challanFrom, 10);
        const toNum = parseInt(challanTo, 10);

        const matchingChallans = challans.filter((c: any) => {
          const cNum = parseInt(c.challanNumber, 10);
          if (!isNaN(fromNum) && !isNaN(toNum)) {
            return cNum >= fromNum && cNum <= toNum;
          }
          if (!isNaN(fromNum)) return cNum === fromNum;
          return true;
        });

        // Load details for each matching challan
        for (const ch of matchingChallans) {
          const detail = await getProductionReceiveById(ch.id);
          const quality = detail.yarnQuality?.qualityName || '';
          const denier = detail.yarnQuality?.denier || '';
          const headerLot = detail.lotNumber || '';
          const headerGrade = detail.yarnGrade?.gradeName || '';

          for (const item of detail.items || []) {
            if (cartonFrom || cartonTo) {
              const cNum = parseInt(item.cartonNumber, 10);
              const cfNum = parseInt(cartonFrom, 10);
              const ctNum = parseInt(cartonTo, 10);
              if (!isNaN(cfNum) && cNum < cfNum) continue;
              if (!isNaN(ctNum) && cNum > ctNum) continue;
            }

            allSlips.push({
              challanId: detail.id,
              challanNumber: detail.challanNumber,
              challanDate: detail.challanDate,
              companyName: resolvePrintCompanyName(activeCompany?.companyName),
              companyPhone: activeCompany?.phone || undefined,
              bookName: detail.productionBook?.bookName || '',
              quality,
              denier,
              cartonNumber: item.cartonNumber,
              cops: item.cops,
              lotNumber: item.lotNumber || headerLot,
              grossWeight: parseFloat(item.grossWeight) || 0,
              shadeNo: item.shadeNo || undefined,
              tareWeight: parseFloat(item.tareWeight) || 0,
              grade: item.grade || headerGrade,
              netWeight: parseFloat(item.netWeight) || 0,
            });
          }
        }
      }

      setSlips(allSlips);
    } catch (err: any) {
      setError(err.message || 'Failed to load packing slip data.');
    } finally {
      setLoading(false);
    }
  }, [challanFrom, challanTo, cartonFrom, cartonTo, bookId, singleChallanId, activeCompany]);

  useEffect(() => {
    loadSlips();
  }, [loadSlips]);

  // Screen-only fit-to-width preview: the A4 sheet keeps its exact print geometry and is
  // only zoomed on screen, so wide monitors no longer show empty gutters around the sheet.
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    const computeZoom = () => {
      const sheetWidth = landscape ? A4_LANDSCAPE_WIDTH_PX : A4_PORTRAIT_WIDTH_PX;
      const available = container.clientWidth - 24;
      if (available <= 0 || sheetWidth <= 0) return;
      const next = Math.min(1.6, Math.max(0.4, available / sheetWidth));
      setPreviewZoom(Number(next.toFixed(3)));
    };

    computeZoom();
    const observer = new ResizeObserver(computeZoom);
    observer.observe(container);
    return () => observer.disconnect();
  }, [landscape, loading, slips.length]);

  // Set document title for clean browser PDF export
  useEffect(() => {
    const range = challanFrom === challanTo ? challanFrom : `${challanFrom}_to_${challanTo}`;
    const orig = document.title;
    document.title = `SHIVAM_ENTERPRISE_PACKING_SLIP_${range || 'EXPORT'}`;
    return () => {
      document.title = orig;
    };
  }, [challanFrom, challanTo]);

  const totalSlips = slips.length * copies;
  const slipsPerPage = 8;
  const pageCount = Math.ceil(totalSlips / slipsPerPage) || 1;

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const range = challanFrom === challanTo ? `#${challanFrom}` : `#${challanFrom}–${challanTo}`;
    const subject = encodeURIComponent(
      `Packing Slip — ${resolvePrintCompanyName(activeCompany?.companyName)} Challan ${range}`
    );
    const body = encodeURIComponent(
      `Dear Sir/Madam,\n\nPlease find the Packing Slip for Challan ${range} attached.\n\nNote: If downloading the PDF, please attach it manually to this email.\n\nRegards,\n${
        resolvePrintCompanyName(activeCompany?.companyName)
      }`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleWhatsApp = () => {
    const range = challanFrom === challanTo ? `#${challanFrom}` : `#${challanFrom}–${challanTo}`;
    const msg = encodeURIComponent(
      `Packing Slip for Challan ${range} — ${
        resolvePrintCompanyName(activeCompany?.companyName)
      }. (Export/save PDF and attach manually).`
    );
    window.open(`https://web.whatsapp.com/send?text=${msg}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#dce8e1] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#2c5f57] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-bold text-slate-700">Loading Packing Slips...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#dce8e1] flex items-center justify-center p-4">
        <div className="bg-red-100 border border-red-400 text-red-800 p-4 rounded max-w-md text-xs space-y-2">
          <strong>Error loading packing slips:</strong>
          <p>{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-2 bg-white border border-slate-300 px-3 py-1 font-bold rounded hover:bg-slate-50 cursor-pointer"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eaf1ed] packing-slip-print-shell">
      {/* ── Screen-only Toolbar (hidden during print) ────────────────────────── */}
      <div className="print:hidden packing-slip-print-toolbar bg-[#2c5f57] text-white px-4 py-2.5 flex items-center justify-between shadow-md border-b border-[#1f4842] flex-wrap gap-2">
        <div className="flex items-center space-x-3 flex-wrap">
          <span className="font-bold text-sm tracking-wide">Packing Slip Preview</span>
          <div className="text-xs bg-[#1f4842] px-3 py-1 rounded flex items-center space-x-3 text-slate-200">
            <span>
              Challan: <strong>{challanFrom === challanTo ? challanFrom : `${challanFrom}–${challanTo}`}</strong>
            </span>
            {(cartonFrom || cartonTo) && (
              <span>
                Carton: <strong>{cartonFrom || '*'}–{cartonTo || '*'}</strong>
              </span>
            )}
            <span>
              Orientation: <strong>{landscape ? 'Landscape' : 'Portrait'}</strong>
            </span>
            <span>
              Copies: <strong>{copies}</strong>
            </span>
            <span>
              Slips: <strong>{slips.length}</strong> × {copies} = <strong>{totalSlips}</strong>
            </span>
            <span>
              Pages: <strong>{pageCount}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate(-1)}
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-xs cursor-pointer"
          >
            ← Back
          </button>
          {slips.length > 0 && (
            <>
              <button
                onClick={handlePrint}
                className="bg-white hover:bg-slate-100 text-[#2c5f57] text-xs font-bold px-3.5 py-1 rounded-xs shadow-xs cursor-pointer"
              >
                🖨 Print / Export PDF
              </button>
              <button
                onClick={handleEmail}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-xs cursor-pointer"
              >
                ✉ Email
              </button>
              <button
                onClick={handleWhatsApp}
                className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-xs cursor-pointer"
              >
                💬 WhatsApp
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Packing Slips Preview Area ───────────────────────────────────────── */}
      <div ref={previewRef} className="p-2 sm:p-3 overflow-auto packing-slip-print-preview">
        {slips.length === 0 ? (
          <div className="bg-white max-w-lg mx-auto p-6 rounded text-center text-slate-600 text-xs shadow-sm border border-slate-200">
            No cartons found matching Challan {challanFrom}–{challanTo}{' '}
            {cartonFrom || cartonTo ? `and Carton ${cartonFrom || '*'}–${cartonTo || '*'}` : ''}.
          </div>
        ) : (
          <div className="packing-slip-preview-scaler" style={{ zoom: previewZoom }}>
            <PackingSlipTemplate slips={slips} landscape={landscape} copies={copies} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PackingSlipPrintPage;
