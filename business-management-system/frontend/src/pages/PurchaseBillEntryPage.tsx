import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  UserCheck,
  Save,
  RotateCcw,
  LogOut,
  Building,
  Package,
  Layers,
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';
import {
  verifyGSTIN,
  getGSTINProviderStatus,
  saveSupplierToPartyMaster,
  createPurchaseBill,
  getProductionReceiveById,
  getPurchaseBillByChallanId,
  GSTINVerificationResult,
  GSTINProviderStatus,
} from '../services/api';

const GST_RATES = [0, 5, 12, 18, 28];

export const PurchaseBillEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { challanId } = useParams<{ challanId?: string }>();
  const [searchParams] = useSearchParams();
  const effectiveChallanId = challanId || searchParams.get('challanId') || null;

  const { activeCompany } = useCompany();

  // Loading & State
  const [, setLoadingChallan] = useState(false);
  const [sourceChallan, setSourceChallan] = useState<any>(null);
  const [existingBillForChallan, setExistingBillForChallan] = useState<any>(null);

  // Provider Status
  const [providerStatus, setProviderStatus] = useState<GSTINProviderStatus | null>(null);

  // Supplier Form States
  const [gstinInput, setGstinInput] = useState('');
  const [isVerifyingGstin, setIsVerifyingGstin] = useState(false);
  const [verificationResult, setVerificationResult] = useState<GSTINVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Editable Supplier fields
  const [supplierLegalName, setSupplierLegalName] = useState('');
  const [supplierTradeName, setSupplierTradeName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierState, setSupplierState] = useState('Gujarat');
  const [supplierStateCode, setSupplierStateCode] = useState('24');
  const [supplierPincode, setSupplierPincode] = useState('');
  const [supplierCity, setSupplierCity] = useState('');
  const [matchedPartyId, setMatchedPartyId] = useState<string | null>(null);

  // Optional Save to Party Master state
  const [saveToPartyMasterFlag, setSaveToPartyMasterFlag] = useState(false);
  const [isSavingParty, setIsSavingParty] = useState(false);
  const [partySaveMessage, setPartySaveMessage] = useState<string | null>(null);

  // Commercial Fields
  const [billDate, setBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [placeOfSupply, setPlaceOfSupply] = useState('Gujarat');
  const [itemDescription, setItemDescription] = useState('Texturised Polyester Yarn');
  const [hsnCode, setHsnCode] = useState('5402');
  const [quantity, setQuantity] = useState<number>(0);
  const [unit] = useState('KG');
  const [ratePerKg, setRatePerKg] = useState<number>(120);
  const [discount, setDiscount] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(5);
  const [remarks, setRemarks] = useState('');

  // UI Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load provider status on mount
  useEffect(() => {
    getGSTINProviderStatus()
      .then((st) => setProviderStatus(st))
      .catch(() => {});
  }, []);

  // Load Source Challan if ID present
  const loadSourceChallan = useCallback(async (id: string) => {
    setLoadingChallan(true);
    setErrorMessage(null);
    try {
      // 1. Check if bill already exists for this challan
      const existing = await getPurchaseBillByChallanId(id);
      if (existing) {
        setExistingBillForChallan(existing);
        setErrorMessage(`A Purchase Bill (#${existing.billNumber}) has already been created for this challan.`);
      }

      // 2. Load Challan Details
      const challan = await getProductionReceiveById(id);
      setSourceChallan(challan);

      // Pre-fill Net Weight as Quantity in KG
      const totalNetWeight = (challan.items || []).reduce(
        (sum: number, it: any) => sum + (parseFloat(it.netWeight) || 0),
        0
      );
      setQuantity(Math.round(totalNetWeight * 1000) / 1000);

      // Description from quality
      if (challan.yarnQuality?.qualityName) {
        setItemDescription(`${challan.yarnQuality.qualityName} (Lot: ${challan.lotNumber || '—'}, Gr: ${challan.yarnGrade?.gradeName || '—'})`);
      }

      // If challan has party with GSTIN, pre-fill and trigger verification
      if (challan.party) {
        setMatchedPartyId(challan.party.id);
        setSupplierLegalName(challan.party.partyName || '');
        setSupplierAddress(challan.party.address || '');
        setSupplierCity(challan.party.city || '');
        setSupplierState(challan.party.state || 'Gujarat');
        setSupplierPincode(challan.party.pincode || '');

        if (challan.party.gstin) {
          const g = challan.party.gstin.trim().toUpperCase();
          setGstinInput(g);
          setSupplierStateCode(g.substring(0, 2));
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load source challan.');
    } finally {
      setLoadingChallan(false);
    }
  }, []);

  useEffect(() => {
    if (effectiveChallanId) {
      loadSourceChallan(effectiveChallanId);
    }
  }, [effectiveChallanId, loadSourceChallan]);

  // Handle GSTIN Verification.
  // forceRefresh = false -> a cached answer is allowed (no credit spent when cached).
  // forceRefresh = true  -> skip the cache, spend one credit, return live data.
  const handleVerifyGstin = async (forceRefresh = false) => {
    const clean = gstinInput.trim().toUpperCase();
    if (!clean) {
      setVerificationError('Please enter a 15-character GSTIN to verify.');
      return;
    }

    setIsVerifyingGstin(true);
    setVerificationError(null);
    if (!forceRefresh) setVerificationResult(null);

    try {
      const res = await verifyGSTIN(clean, forceRefresh);
      setVerificationResult(res);

      // Map the returned registration onto the supplier form. Missing fields
      // are left untouched - never filled with placeholders.
      setSupplierLegalName(res.legalName || '');
      if (res.tradeName) setSupplierTradeName(res.tradeName);
      if (res.address) setSupplierAddress(res.address);
      if (res.city) setSupplierCity(res.city);
      if (res.state) {
        setSupplierState(res.state);
        setPlaceOfSupply(res.state);
      }
      if (res.stateCode) setSupplierStateCode(res.stateCode);
      if (res.pincode) setSupplierPincode(res.pincode);
      if (res.partyId) setMatchedPartyId(res.partyId);
    } catch (err: any) {
      setVerificationError(err?.message || 'GSTIN verification failed.');
      // A failed refresh keeps the supplier already on screen; a first attempt
      // falls back to clearly labelled manual entry.
      if (!forceRefresh || !verificationResult) {
        setVerificationResult({
          gstin: clean,
          legalName: supplierLegalName || 'Unverified Supplier',
          status: 'INACTIVE',
          state: supplierState || 'Gujarat',
          stateCode: clean.length >= 2 ? clean.substring(0, 2) : '24',
          source: 'MANUAL_UNVERIFIED',
          isVerified: false,
          verifiedAt: new Date().toISOString(),
          providerName: 'None (Unverified)',
        });
      }
    } finally {
      setIsVerifyingGstin(false);
    }
  };

  // Optional: Explicitly Save Supplier to Party Master
  const handleSaveToPartyMaster = async () => {
    if (!supplierLegalName.trim()) {
      setErrorMessage('Please enter supplier legal name before saving to Party Master.');
      return;
    }
    setIsSavingParty(true);
    setPartySaveMessage(null);
    try {
      const res = await saveSupplierToPartyMaster({
        partyName: supplierLegalName.trim(),
        gstin: gstinInput.trim().toUpperCase() || undefined,
        address: supplierAddress.trim() || undefined,
        city: supplierCity.trim() || undefined,
        state: supplierState.trim() || undefined,
        pincode: supplierPincode.trim() || undefined,
      });
      setMatchedPartyId(res.party.id);
      setPartySaveMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save supplier to Party Master.');
    } finally {
      setIsSavingParty(false);
    }
  };

  // Calculations
  const companyGstin = activeCompany?.gstin ? activeCompany.gstin.trim().toUpperCase() : '';
  const companyStateCode = companyGstin ? companyGstin.substring(0, 2) : '24'; // Gujarat default
  const isIntraState = supplierStateCode === companyStateCode;

  const taxableValue = Math.max(0, Math.round((quantity * ratePerKg - discount) * 100) / 100);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (gstRate > 0) {
    if (isIntraState) {
      const halfRate = gstRate / 2;
      cgstAmount = Math.round(((taxableValue * halfRate) / 100) * 100) / 100;
      sgstAmount = Math.round(((taxableValue * halfRate) / 100) * 100) / 100;
    } else {
      igstAmount = Math.round(((taxableValue * gstRate) / 100) * 100) / 100;
    }
  }

  const subTotalWithTax = taxableValue + cgstAmount + sgstAmount + igstAmount;
  const finalTotal = Math.round(subTotalWithTax);
  const roundOff = Math.round((finalTotal - subTotalWithTax) * 100) / 100;

  // Save Purchase Bill
  const handleSaveBill = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supplierLegalName.trim()) {
      setErrorMessage('Supplier Legal Name is required to create a Purchase Bill.');
      return;
    }

    if (quantity <= 0) {
      setErrorMessage('Quantity must be greater than 0.');
      return;
    }

    if (ratePerKg <= 0) {
      setErrorMessage('Rate per KG must be greater than 0.');
      return;
    }

    if (existingBillForChallan) {
      setErrorMessage('A Purchase Bill has already been created for this challan.');
      return;
    }

    setIsSubmitting(true);

    try {
      // If user selected "Save Supplier to Party Master" checkbox and not yet saved
      let effectivePartyId = matchedPartyId;
      if (saveToPartyMasterFlag && !matchedPartyId) {
        try {
          const partyRes = await saveSupplierToPartyMaster({
            partyName: supplierLegalName.trim(),
            gstin: gstinInput.trim().toUpperCase() || undefined,
            address: supplierAddress.trim() || undefined,
            city: supplierCity.trim() || undefined,
            state: supplierState.trim() || undefined,
            pincode: supplierPincode.trim() || undefined,
          });
          effectivePartyId = partyRes.party.id;
          setMatchedPartyId(partyRes.party.id);
        } catch {
          // If auto-save to party fails, proceed with snapshot creation
        }
      }

      // Build Items array
      const itemsPayload = sourceChallan?.items && sourceChallan.items.length > 0
        ? sourceChallan.items.map((carton: any) => {
            const cNet = parseFloat(carton.netWeight) || 0;
            return {
              itemDescription: `${itemDescription} - Carton #${carton.cartonNumber}`,
              hsnCode,
              quantity: cNet,
              unit,
              rate: ratePerKg,
              discount: 0,
              cartonNumber: carton.cartonNumber,
              lotNumber: carton.lotNumber || sourceChallan.lotNumber,
              grade: carton.grade || sourceChallan.yarnGrade?.gradeName,
              cops: carton.cops,
            };
          })
        : [
            {
              itemDescription,
              hsnCode,
              quantity,
              unit,
              rate: ratePerKg,
              discount,
              cartonNumber: null,
              lotNumber: sourceChallan?.lotNumber || null,
              grade: sourceChallan?.yarnGrade?.gradeName || null,
              cops: null,
            },
          ];

      const payload = {
        billDate,
        sourceChallanId: sourceChallan?.id || null,
        partyId: effectivePartyId || null,
        supplierGstin: gstinInput.trim().toUpperCase() || null,
        supplierLegalName: supplierLegalName.trim(),
        supplierTradeName: supplierTradeName.trim() || null,
        supplierAddress: supplierAddress.trim() || null,
        supplierState: supplierState.trim() || 'Gujarat',
        supplierStateCode: supplierStateCode.trim() || '24',
        supplierPincode: supplierPincode.trim() || null,
        supplierCity: supplierCity.trim() || null,
        verificationSource: verificationResult?.source || 'MANUAL_UNVERIFIED',
        verificationTimestamp: verificationResult?.verifiedAt || null,
        isVerifiedSupplier: Boolean(verificationResult?.isVerified),
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || null,
        supplierInvoiceDate: supplierInvoiceDate || null,
        placeOfSupply: placeOfSupply || supplierState || 'Gujarat',
        gstRate,
        remarks: remarks.trim() || null,
        items: itemsPayload,
      };

      const result = await createPurchaseBill(payload);
      setSuccessMessage(`Purchase Bill #${result.billNumber} created successfully! Total: ₹${result.totalAmount}`);

      setTimeout(() => {
        navigate(`/transactions/purchase/${result.id}`);
      }, 1200);
    } catch (err: any) {
      if (err.existingBill) {
        setExistingBillForChallan(err.existingBill);
      }
      setErrorMessage(err.message || 'Failed to create purchase bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear Form
  const handleClear = () => {
    if (window.confirm('Clear all fields in this Purchase Bill?')) {
      setGstinInput('');
      setVerificationResult(null);
      setVerificationError(null);
      setSupplierLegalName('');
      setSupplierTradeName('');
      setSupplierAddress('');
      setSupplierPincode('');
      setSupplierCity('');
      setSupplierInvoiceNumber('');
      setRatePerKg(120);
      setDiscount(0);
      setRemarks('');
      setSaveToPartyMasterFlag(false);
      setPartySaveMessage(null);
    }
  };

  // Keyboard shortcuts (F10 to Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F10') {
        e.preventDefault();
        handleSaveBill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // -- Verification presentation -------------------------------------------
  const formatCacheAge = (iso: string): string => {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 'just now';
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    return hours + ' hr ago';
  };

  // Requirement: verified only when the provider reported success AND the GSTIN
  // it returned is exactly the one the user asked about.
  const verificationGstinMatches =
    !!verificationResult &&
    verificationResult.gstin.trim().toUpperCase() === gstinInput.trim().toUpperCase();

  const showVerifiedBadge = !!verificationResult && verificationResult.isVerified && verificationGstinMatches;

  const verificationSource = verificationResult?.source ?? 'MANUAL_UNVERIFIED';

  const verificationBadgeLabel = !showVerifiedBadge
    ? 'Unverified Supplier Information'
    : verificationSource === 'LOCAL_PARTY_MASTER'
      ? 'Verified - matched saved Party Master'
      : verificationSource === 'CACHED'
        ? 'Verified - cached result'
        : 'Verified - live lookup';

  const verificationBadgeTone = !showVerifiedBadge
    ? 'bg-amber-100 border-amber-300 text-amber-900'
    : verificationSource === 'CACHED'
      ? 'bg-amber-50 border-amber-300 text-amber-900'
      : verificationSource === 'LOCAL_PARTY_MASTER'
        ? 'bg-blue-50 border-blue-300 text-blue-900'
        : 'bg-emerald-50 border-emerald-300 text-emerald-900';

  const verificationTimestamp = !verificationResult
    ? ''
    : verificationSource === 'CACHED' && verificationResult.cachedAt
      ? 'cached ' + formatCacheAge(verificationResult.cachedAt)
      : 'fetched ' + new Date(verificationResult.verifiedAt).toLocaleTimeString();

  const creditsRemaining = verificationResult?.creditsRemaining;

  return (
    <div className="min-h-screen bg-[#dce8e1] text-slate-800 flex flex-col font-sans select-none overflow-x-hidden text-xs">
      {/* ── Top Title Bar ────────────────────────────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center space-x-2">
          <ShoppingBag className="w-4 h-4 text-emerald-300" />
          <span className="font-bold text-xs sm:text-sm tracking-wide">
            {sourceChallan
              ? `Create Purchase Bill from Challan #${sourceChallan.challanNumber} (${sourceChallan.productionBook?.bookName || 'YARN'})`
              : 'New Yarn Purchase Bill (Tax Inward)'}
          </span>
          {sourceChallan && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
              From Production Challan
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigate('/transactions/purchase')}
            className="bg-[#107c41] hover:bg-[#0c6334] text-white text-xs font-bold px-3 py-0.5 rounded flex items-center space-x-1 cursor-pointer"
          >
            <span>Bill Register (List)</span>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-5 h-5 flex items-center justify-center text-xs text-white bg-[#eb5757] hover:bg-red-600 rounded font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Alerts & Notifications ────────────────────────────────────── */}
      {successMessage && (
        <div className="bg-emerald-100 border-b border-emerald-300 text-emerald-800 px-4 py-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-1.5 flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" /> {errorMessage}
          </span>
          {existingBillForChallan && (
            <button
              onClick={() => navigate(`/transactions/purchase/${existingBillForChallan.id}`)}
              className="bg-blue-600 text-white px-2 py-0.5 rounded text-[11px] font-bold ml-2 cursor-pointer hover:bg-blue-700"
            >
              View Purchase Bill #{existingBillForChallan.billNumber}
            </button>
          )}
          <button onClick={() => setErrorMessage(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Main Content Container ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-7xl mx-auto w-full">
        {/* Source Challan Banner (If linked) */}
        {sourceChallan && (
          <div className="bg-white rounded border border-[#789d93] p-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
              <span className="font-bold text-xs text-[#2c5f57] flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Source Challan Information
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Challan ID: {sourceChallan.id}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block">Challan No:</span>
                <span className="font-bold font-mono text-slate-800">{sourceChallan.challanNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Challan Date:</span>
                <span className="font-bold font-mono text-slate-800">
                  {new Date(sourceChallan.challanDate).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Quality / Denier:</span>
                <span className="font-bold text-slate-800">{sourceChallan.yarnQuality?.qualityName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Lot / Grade:</span>
                <span className="font-bold font-mono text-slate-800">
                  {sourceChallan.lotNumber || '—'} / {sourceChallan.yarnGrade?.gradeName || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Cartons / Cops:</span>
                <span className="font-bold font-mono text-slate-800">
                  {sourceChallan.items?.length || 0} Cartons
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Net Weight (KG):</span>
                <span className="font-bold font-mono text-emerald-700 text-sm">
                  {quantity.toFixed(3)} kg
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 1: SUPPLIER GSTIN & EXTERNAL LOOKUP (TASK 1) ────── */}
        <div className="bg-white rounded border border-[#789d93] p-3 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#2c5f57]" />
              <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                Supplier & GSTIN Verification (Party Master Not Required)
              </span>
            </div>

            {/* Official GST Portal Link */}
            <a
              href="https://services.gst.gov.in/services/searchtp"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 underline"
            >
              <span>Search on Official GST Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Provider Notice if none configured */}
          {providerStatus && !providerStatus.isConfigured && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-2 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{providerStatus.message}</p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  You can verify supplier details manually via the GST portal link above or type the supplier details directly. Manually entered data will be clearly labeled as &quot;Unverified Supplier Information&quot;.
                </p>
              </div>
            </div>
          )}

          {/* GSTIN Input & Verify Action */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Supplier GSTIN (15 Digits) :
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={15}
                  value={gstinInput}
                  onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
                  placeholder="24AAAAA0000A1Z5"
                  className="flex-1 bg-white border border-[#789d93] rounded px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyGstin()}
                  disabled={isVerifyingGstin || !gstinInput.trim()}
                  className="bg-[#2c5f57] hover:bg-[#204741] text-white px-3 py-1 rounded font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-2xs"
                >
                  {isVerifyingGstin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                  <span>Verify GSTIN</span>
                </button>
              </div>
            </div>

            {/* Verification status, remaining credits and manual refresh */}
            <div className="md:col-span-2 flex items-center gap-2 flex-wrap">
              {verificationResult && (
                <span className={'border px-2.5 py-1 rounded font-semibold text-xs flex items-center gap-1.5 ' + verificationBadgeTone}>
                  {showVerifiedBadge ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>{verificationBadgeLabel}</span>
                  <span className="text-[10px] font-mono opacity-80">({verificationTimestamp})</span>
                </span>
              )}

              {typeof creditsRemaining === 'number' && (
                <span
                  className="bg-white border border-[#789d93] text-[#1e403a] px-2 py-0.5 rounded font-mono text-[11px] font-bold"
                  title="Provider credits remaining after this lookup"
                >
                  Credits left: {creditsRemaining}
                </span>
              )}

              {verificationResult && verificationSource !== 'MANUAL_UNVERIFIED' && (
                <button
                  type="button"
                  onClick={() => handleVerifyGstin(true)}
                  disabled={isVerifyingGstin}
                  title="Ignore the cache and fetch fresh provider data (costs 1 credit)"
                  className="bg-white border border-[#789d93] text-[#1e403a] hover:bg-[#eaf2ef] px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={'w-3.5 h-3.5 ' + (isVerifyingGstin ? 'animate-spin' : '')} />
                  <span>Refresh</span>
                </button>
              )}

              {matchedPartyId && (
                <span className="bg-blue-100 border border-blue-300 text-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold">
                  Linked to Party Master
                </span>
              )}
            </div>
          </div>

          {verificationResult && verificationSource !== 'MANUAL_UNVERIFIED' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 bg-[#f0f4f2] border border-[#b6d3ca] rounded px-2.5 py-1.5">
              <span>
                Status:{' '}
                <b className={verificationResult.status === 'ACTIVE' ? 'text-emerald-700' : 'text-rose-700'}>
                  {verificationResult.status}
                </b>
              </span>
              {verificationResult.taxpayerType && (
                <span>
                  Taxpayer Type: <b className="text-slate-800">{verificationResult.taxpayerType}</b>
                </span>
              )}
              {verificationResult.registrationDate && (
                <span>
                  Registered: <b className="text-slate-800">{verificationResult.registrationDate}</b>
                </span>
              )}
              {verificationResult.stateCode && (
                <span>
                  State Code: <b className="text-slate-800">{verificationResult.stateCode}</b>
                </span>
              )}
              {verificationResult.blockStatus && (
                <span>
                  GST Block:{' '}
                  <b className={verificationResult.blockStatus === 'Blocked' ? 'text-rose-700' : 'text-slate-800'}>
                    {verificationResult.blockStatus}
                  </b>
                </span>
              )}
              <span>
                Source: <b className="text-slate-800">{verificationResult.providerName}</b>
              </span>
            </div>
          )}

          {verificationError && (
            <p className="text-red-600 text-xs font-medium">⚠️ {verificationError}</p>
          )}

          {/* Auto-populated & Editable Supplier Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Legal Business Name <span className="text-red-500">*</span> :
              </label>
              <input
                type="text"
                value={supplierLegalName}
                onChange={(e) => setSupplierLegalName(e.target.value)}
                placeholder="Supplier Company / Firm Name"
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Trade Name (Optional) :
              </label>
              <input
                type="text"
                value={supplierTradeName}
                onChange={(e) => setSupplierTradeName(e.target.value)}
                placeholder="Trade / Brand Name"
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                State & State Code :
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={supplierState}
                  onChange={(e) => {
                    setSupplierState(e.target.value);
                    setPlaceOfSupply(e.target.value);
                  }}
                  placeholder="Gujarat"
                  className="flex-1 bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
                <input
                  type="text"
                  maxLength={2}
                  value={supplierStateCode}
                  onChange={(e) => setSupplierStateCode(e.target.value)}
                  placeholder="24"
                  className="w-12 bg-white border border-[#789d93] rounded px-1.5 py-1 text-center font-mono text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Registered Billing Address :
              </label>
              <input
                type="text"
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                placeholder="Plot / Street / GIDC Industrial Area"
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                City & PIN Code :
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={supplierCity}
                  onChange={(e) => setSupplierCity(e.target.value)}
                  placeholder="Surat"
                  className="flex-1 bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
                <input
                  type="text"
                  maxLength={6}
                  value={supplierPincode}
                  onChange={(e) => setSupplierPincode(e.target.value)}
                  placeholder="395002"
                  className="w-20 bg-white border border-[#789d93] rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
              </div>
            </div>
          </div>

          {/* Optional Action: Save Supplier to Party Master (Section 1.6) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={saveToPartyMasterFlag}
                onChange={(e) => setSaveToPartyMasterFlag(e.target.checked)}
                className="rounded text-[#2c5f57] focus:ring-[#2c5f57] cursor-pointer"
              />
              <span>Save this supplier snapshot to Party Master upon saving bill (Optional)</span>
            </label>

            {!matchedPartyId && (
              <button
                type="button"
                onClick={handleSaveToPartyMaster}
                disabled={isSavingParty || !supplierLegalName.trim()}
                className="bg-white hover:bg-slate-50 border border-[#789d93] text-slate-800 px-3 py-1 rounded text-xs font-semibold cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isSavingParty ? 'Saving...' : 'Save to Party Master Now'}
              </button>
            )}

            {partySaveMessage && (
              <span className="text-emerald-700 font-semibold text-xs">
                ✓ {partySaveMessage}
              </span>
            )}
          </div>
        </div>

        {/* ── SECTION 2: COMMERCIAL & INVOICE DETAILS ──────────────────── */}
        <div className="bg-white rounded border border-[#789d93] p-3 shadow-xs space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <Layers className="w-4 h-4 text-[#2c5f57]" />
            <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
              Commercial Invoice & Item Particulars
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Purchase Bill Date :
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Supplier Invoice No :
              </label>
              <input
                type="text"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                placeholder="INV-2026-901"
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Supplier Invoice Date :
              </label>
              <input
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                Place of Supply :
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                placeholder="Gujarat"
                className="w-full bg-white border border-[#789d93] rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>
          </div>

          {/* Item Row Entry */}
          <div className="border border-[#789d93] rounded overflow-hidden mt-2">
            <table className="w-full text-xs">
              <thead className="bg-[#c2ded7] text-[#1e403a] font-bold border-b border-[#789d93]">
                <tr>
                  <th className="py-1.5 px-2 text-left">Item Description</th>
                  <th className="py-1.5 px-2 text-center w-20">HSN</th>
                  <th className="py-1.5 px-2 text-right w-28">Quantity ({unit})</th>
                  <th className="py-1.5 px-2 text-right w-24">Rate / KG (₹)</th>
                  <th className="py-1.5 px-2 text-right w-24">Discount (₹)</th>
                  <th className="py-1.5 px-2 text-right w-32">Taxable Value (₹)</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                    />
                  </td>
                  <td className="p-1.5 text-center">
                    <input
                      type="text"
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      className="w-full text-center bg-white border border-slate-300 rounded px-1 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step="0.001"
                      value={quantity}
                      onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                      className="w-full text-right bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(parseFloat(e.target.value) || 0)}
                      className="w-full text-right bg-white border border-slate-300 rounded px-2 py-1 font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-full text-right bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                    />
                  </td>
                  <td className="p-1.5 text-right font-mono font-bold text-sm text-slate-900 bg-slate-50">
                    ₹{taxableValue.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION 3: GST CALCULATION & TOTALS SUMMARY (TASK 2.6) ──── */}
        <div className="bg-[#eaf3ef] rounded border border-[#789d93] p-4 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: GST Configuration */}
            <div className="space-y-2">
              <span className="font-bold text-xs text-[#2c5f57] uppercase tracking-wide block">
                GST Treatment & Place of Supply
              </span>
              <div className="bg-white p-2.5 rounded border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Company State :</span>
                  <span className="font-bold font-mono">
                    {activeCompany?.state || 'Gujarat'} (Code: {companyStateCode})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Supplier State :</span>
                  <span className="font-bold font-mono">
                    {supplierState} (Code: {supplierStateCode})
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                  <span className="font-bold text-slate-700">Tax Type Applicable :</span>
                  <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                    isIntraState ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                  <span className="font-bold text-slate-700">GST Rate (%) :</span>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className="bg-white border border-[#789d93] rounded px-2 py-1 text-xs font-bold font-mono"
                  >
                    {GST_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r}% {r === 5 ? '(Standard Synthetic Yarn)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">Remarks / Narration :</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional bill notes or terms..."
                  className="w-full bg-white border border-[#789d93] rounded p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2c5f57] resize-none"
                />
              </div>
            </div>

            {/* Right: Calculations Breakdown */}
            <div className="bg-white p-3 rounded border border-slate-200 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-700">
                <span>Taxable Amount :</span>
                <span className="font-bold text-sm">₹{taxableValue.toFixed(2)}</span>
              </div>

              {isIntraState ? (
                <>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>CGST ({gstRate / 2}%) :</span>
                    <span>₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>SGST ({gstRate / 2}%) :</span>
                    <span>₹{sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-slate-600">
                  <span>IGST ({gstRate}%) :</span>
                  <span>₹{igstAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-500 text-[11px] border-t border-slate-100 pt-1">
                <span>Sub-Total with Taxes :</span>
                <span>₹{subTotalWithTax.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Round Off :</span>
                <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>

              <div className="flex items-center justify-between border-t-2 border-[#2c5f57] pt-2 text-[#0d5f32]">
                <span className="font-sans font-bold text-sm">Final Bill Total :</span>
                <span className="font-bold text-lg bg-emerald-50 px-3 py-1 rounded border border-emerald-300">
                  ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Buttons Bar ───────────────────────────────────────── */}
      <div className="bg-[#e4eee8] px-4 py-2 border-t border-[#789d93] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          {/* 1 - Save / F10 */}
          <button
            type="button"
            onClick={handleSaveBill}
            disabled={isSubmitting || Boolean(existingBillForChallan)}
            className="bg-[#2c5f57] hover:bg-[#204741] text-white border border-[#1f4842] rounded px-4 py-1.5 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>1 - Save Bill (F10)</span>
          </button>

          {/* 2 - Clear */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isSubmitting}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded px-3 py-1.5 font-bold text-slate-800 shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3 text-slate-600" />
            <span>2 - Clear</span>
          </button>

          {/* 3 - Go Back */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded px-3 py-1.5 font-bold text-slate-800 shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3 text-slate-600" />
            <span>3 - Go Back</span>
          </button>

          {/* 5 - Exit */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded px-3 py-1.5 font-bold text-slate-800 shadow-2xs cursor-pointer flex items-center gap-1"
          >
            <LogOut className="w-3 h-3 text-slate-600" />
            <span>5 - Exit</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-600">
          Press <kbd className="font-bold bg-white px-1 py-0.5 border rounded">F10</kbd> to save atomically
        </div>
      </div>
    </div>
  );
};

export default PurchaseBillEntryPage;
