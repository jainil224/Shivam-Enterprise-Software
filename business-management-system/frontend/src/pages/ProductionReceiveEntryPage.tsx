import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import {
  validateProductionReceiveContext,
  getNextProductionReceiveNumbers,
  createProductionReceive,
  updateProductionReceive,
  getProductionReceiveById,
  getProductionReceiveNavigation,
  lookupProductionReceiveByChallanNumber,
  getParties,
  getMachines,
  getOperators,
  getYarnQualities,
  getYarnGrades,
  getLocations,
} from '../services/api';
import {
  ProductionBook,
  Party,
  Machine,
  Operator,
  YarnQuality,
  YarnGrade,
  Location,
} from '../types';
import {
  CartonRowState,
  calculateRowDerived,
  calculateGridTotals,
  formatAverageWeight,
  GridTotalsState,
} from '../utils/weightCalculations';
import {
  PackingSlipPrintOptionsModal,
  PrintOptions,
} from '../components/PackingSlipPrintOptionsModal';

export const ProductionReceiveEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeCompany, activeFinancialYear } = useCompany();

  // Book resolution: query param or sessionStorage
  const bookIdParam = searchParams.get('bookId') || sessionStorage.getItem('bms_selected_production_book_id');
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);

  // Master Data States
  const [isValidatingBook, setIsValidatingBook] = useState(true);
  const [selectedBook, setSelectedBook] = useState<ProductionBook | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [qualities, setYarnQualities] = useState<YarnQuality[]>([]);
  const [grades, setYarnGrades] = useState<YarnGrade[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [navIds, setNavIds] = useState<{ prevId: string | null; nextId: string | null }>({ prevId: null, nextId: null });

  // Header Form Fields (Matching Screenshot 2)
  const [challanNumber, setChallanNumber] = useState('89');
  const [challanDate, setChallanDate] = useState(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/ ${month}/ ${year}`;
  });
  const [partyId, setPartyId] = useState('');
  const [machineId, setMachineId] = useState('');
  const [yarnQualityId, setYarnQualityId] = useState('');
  const [lotNumber, setLotNumber] = useState('LOT-101');
  const [operatorId, setOperatorId] = useState('');
  const [yarnGradeId, setYarnGradeId] = useState('');
  const [twist, setTwist] = useState('800');
  const [emptyCopsWeight, setEmptyCopsWeight] = useState('0.040');
  const [locationId, setLocationId] = useState('');
  const [suggestedNewNo, setSuggestedNewNo] = useState('1460');
  const [remarks, setRemarks] = useState('');
  const [isCancelledRecord, setIsCancelledRecord] = useState(false);
  const [loadedChallanId, setLoadedChallanId] = useState<string | null>(null);
  const [isLoadingExistingChallan, setIsLoadingExistingChallan] = useState(false);
  const [hasDirtyForm, setHasDirtyForm] = useState(false);
  const hasEditAccess = isEditMode || (Boolean(loadedChallanId) && !isCancelledRecord);

  // Carton Grid Rows & Active Row
  const [rows, setRows] = useState<CartonRowState[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [totals, setTotals] = useState<GridTotalsState>({
    totalCartons: 0,
    totalCartonWeight: 0,
    totalCops: 0,
    totalGrossWeight: 0,
    totalCopsWeight: 0,
    totalTareWeight: 0,
    totalNetWeight: 0,
    totalAverageWeight: 0,
  });

  // Input element refs for rapid Enter-key navigation
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // UI Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Recalculate totals on rows change (only completed rows with grossWeight > 0 contribute)
  useEffect(() => {
    setTotals(calculateGridTotals(rows));
  }, [rows]);

  // Helper to focus input with auto-select
  const focusField = useCallback((fieldKey: string) => {
    setTimeout(() => {
      const el = inputRefs.current[fieldKey];
      if (el) {
        el.focus();
        el.select?.();
      }
    }, 40);
  }, []);

  // Helper to compute next sequential carton number
  const getNextCartonNumber = useCallback((currentNum: string): string => {
    const trimmed = currentNum.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const digits = match[2];
      const nextVal = parseInt(digits, 10) + 1;
      return `${prefix}${nextVal.toString().padStart(digits.length, '0')}`;
    }
    const fallbackNum = parseInt(trimmed.replace(/\D/g, ''), 10);
    return !isNaN(fallbackNum) ? (fallbackNum + 1).toString() : '1';
  }, []);

  // Helper to compute sequential carton numbers for placeholder rows (fixes Carton Number Bug)
  const getPlaceholderCartonNumber = useCallback(
    (offset: number): string => {
      let base = rows.length > 0 ? rows[rows.length - 1].cartonNumber : suggestedNewNo || '1';
      for (let i = 0; i < offset; i++) {
        base = getNextCartonNumber(base);
      }
      return base;
    },
    [rows, suggestedNewNo, getNextCartonNumber]
  );

  const applyLoadedChallanToForm = useCallback(
    (existingChallan: any) => {
      setLoadedChallanId(existingChallan?.id || null);
      setIsCancelledRecord(existingChallan?.status === 'CANCELLED');
      setChallanNumber(existingChallan?.challanNumber || '');

      const cDate = new Date(existingChallan?.challanDate || new Date());
      const day = String(cDate.getDate()).padStart(2, '0');
      const month = String(cDate.getMonth() + 1).padStart(2, '0');
      const year = cDate.getFullYear();
      setChallanDate(`${day}/ ${month}/ ${year}`);

      setPartyId(existingChallan?.partyId || '');
      setMachineId(existingChallan?.machineId || '');
      setYarnQualityId(existingChallan?.yarnQualityId || '');
      setYarnGradeId(existingChallan?.yarnGradeId || '');
      setLotNumber(existingChallan?.lotNumber || 'LOT-101');
      setOperatorId(existingChallan?.operatorId || '');
      setTwist(existingChallan?.twist || '800');
      setEmptyCopsWeight(Number(existingChallan?.emptyCopsWeight || 0.04).toFixed(3));
      setLocationId(existingChallan?.locationId || '');
      setRemarks(existingChallan?.remarks || '');

      const loadedRows: CartonRowState[] = (existingChallan?.items || []).map((item: any) => {
        const derived = calculateRowDerived(
          item.cartonWeight.toString(),
          item.cops.toString(),
          item.grossWeight.toString(),
          item.copsWeight.toString()
        );

        return {
          id: item.id || Math.random().toString(),
          cartonNumber: item.cartonNumber,
          cartonWeight: Number(item.cartonWeight).toFixed(3),
          cops: item.cops.toString(),
          grossWeight: Number(item.grossWeight).toFixed(3),
          copsWeight: Number(item.copsWeight).toFixed(3),
          tareWeight: derived.tareWeight,
          netWeight: derived.netWeight,
          averageWeight: derived.averageWeight,
          twist: item.twist || existingChallan?.twist || '800',
          lotNumber: item.lotNumber || existingChallan?.lotNumber || 'LOT-101',
          grade: item.grade || '',
        };
      });

      setRows(loadedRows);
      setSuggestedNewNo(
        loadedRows.length > 0
          ? getNextCartonNumber(loadedRows[loadedRows.length - 1].cartonNumber)
          : '1460'
      );
      setHasDirtyForm(false);
    },
    [getNextCartonNumber]
  );

  // Load masters and validate context
  const initPage = useCallback(async () => {
    if (!bookIdParam) {
      navigate('/manufacturing/production-receive/books', { replace: true });
      return;
    }

    setIsValidatingBook(true);
    setErrorMessage(null);

    try {
      // 1. Validate Book Context through Backend
      const ctx = await validateProductionReceiveContext(bookIdParam);
      setSelectedBook(ctx.productionBook);

      // 2. Load Active Masters in Parallel
      const [pList, mList, oList, qList, gList, lList] = await Promise.all([
        getParties({ includeInactive: false }),
        getMachines({ includeInactive: false }),
        getOperators({ includeInactive: false }),
        getYarnQualities({ includeInactive: false }),
        getYarnGrades({ includeInactive: false }),
        getLocations({ includeInactive: false }),
      ]);

      setParties(pList);
      setMachines(mList);
      setOperators(oList);
      setYarnQualities(qList);
      setYarnGrades(gList);
      setLocations(lList);

      if (editId) {
        // --- EDIT MODE ---
        const [existingChallan, navResult] = await Promise.all([
          getProductionReceiveById(editId),
          getProductionReceiveNavigation(editId, bookIdParam).catch(() => ({ prevId: null, nextId: null })),
        ]);

        setNavIds(navResult);
        applyLoadedChallanToForm(existingChallan);

        if (existingChallan.status === 'CANCELLED') {
          setErrorMessage('This production challan has been CANCELLED and cannot be modified.');
        }
      } else {
        // --- NEW ENTRY MODE ---
        const nextNums = await getNextProductionReceiveNumbers(bookIdParam);
        setChallanNumber(nextNums.nextChallanNumber || '89');
        const initialCartonNum = nextNums.nextCartonNumber || '1460';
        setSuggestedNewNo(initialCartonNum);

        // Pre-select first master items if available
        if (pList.length > 0) setPartyId(pList[0].id);
        if (mList.length > 0) setMachineId(mList[0].id);
        if (qList.length > 0) setYarnQualityId(qList[0].id);
        if (gList.length > 0) setYarnGradeId(gList[0].id);
        if (lList.length > 0) setLocationId(lList[0].id);
        if (oList.length > 0) setOperatorId(oList[0].id);

        const initialGrade = gList.length > 0 ? gList[0].gradeName : '';
        const initialDerived = calculateRowDerived('1.000', '24', '', '0.040');

        // Initialize with First Carton (four manual inputs ready)
        setRows([
          {
            id: Math.random().toString(),
            cartonNumber: initialCartonNum,
            cartonWeight: '1.000',
            cops: '24',
            grossWeight: '',
            copsWeight: '0.040',
            tareWeight: initialDerived.tareWeight,
            netWeight: 0,
            averageWeight: 0,
            twist: '800',
            lotNumber: 'LOT-101',
            grade: initialGrade,
          },
        ]);
        setLoadedChallanId(null);
        setIsCancelledRecord(false);
        setHasDirtyForm(false);
        setActiveRowIndex(0);

        // Auto-focus first carton's Gross Weight or Carton Number
        focusField('0_cartonNumber');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initialize production receive entry.');
    } finally {
      setIsValidatingBook(false);
    }
  }, [bookIdParam, editId, navigate, getNextCartonNumber, focusField, applyLoadedChallanToForm]);

  useEffect(() => {
    initPage();
  }, [initPage]);

  const handleChallanLookup = useCallback(async () => {
    const typedNumber = challanNumber.trim();
    if (!selectedBook) return;
    if (!typedNumber) {
      setErrorMessage('Please enter a challan number to search.');
      return;
    }

    if (hasDirtyForm) {
      const shouldLoad = window.confirm(
        'Current challan has unsaved changes. Load the existing challan and discard the current form?'
      );
      if (!shouldLoad) return;
    }

    setIsLoadingExistingChallan(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const foundChallan = await lookupProductionReceiveByChallanNumber(selectedBook.id, typedNumber);
      if (!foundChallan) {
        setLoadedChallanId(null);
        setIsCancelledRecord(false);
        setHasDirtyForm(false);
        setErrorMessage('No existing challan found.');
        return;
      }

      const navResult = await getProductionReceiveNavigation(foundChallan.id, selectedBook.id).catch(
        () => ({ prevId: null, nextId: null })
      );
      setNavIds(navResult);
      applyLoadedChallanToForm(foundChallan);

      if (foundChallan.status === 'CANCELLED') {
        setErrorMessage('This production challan has been CANCELLED and cannot be modified.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load challan.');
    } finally {
      setIsLoadingExistingChallan(false);
    }
  }, [applyLoadedChallanToForm, challanNumber, hasDirtyForm, selectedBook]);

  // Handle cell edit in carton grid
  const handleCellChange = (id: string, field: keyof CartonRowState, val: string) => {
    setHasDirtyForm(true);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        const updated = { ...r, [field]: val };
        // Recalculate derived weights immediately
        const derived = calculateRowDerived(
          field === 'cartonWeight' ? val : updated.cartonWeight,
          field === 'cops' ? val : updated.cops,
          field === 'grossWeight' ? val : updated.grossWeight,
          field === 'copsWeight' ? val : updated.copsWeight
        );

        return {
          ...updated,
          tareWeight: derived.tareWeight,
          netWeight: derived.netWeight,
          averageWeight: derived.averageWeight,
          hasError: Boolean(derived.error),
          errorMessage: derived.error,
        };
      })
    );
  };

  // Header field synchronization
  const handleEmptyCopsWeightChange = (newVal: string) => {
    setHasDirtyForm(true);
    setEmptyCopsWeight(newVal);
    setRows((prev) =>
      prev.map((r) => {
        const derived = calculateRowDerived(r.cartonWeight, r.cops, r.grossWeight, newVal);
        return {
          ...r,
          copsWeight: newVal,
          tareWeight: derived.tareWeight,
          netWeight: derived.netWeight,
          averageWeight: derived.averageWeight,
        };
      })
    );
  };

  const handleHeaderLotNumberChange = (newLot: string) => {
    const oldLot = lotNumber;
    setHasDirtyForm(true);
    setLotNumber(newLot);
    setRows((prev) =>
      prev.map((r) => (!r.lotNumber || r.lotNumber === oldLot ? { ...r, lotNumber: newLot } : r))
    );
  };

  const handleHeaderTwistChange = (newTwist: string) => {
    const oldTwist = twist;
    setHasDirtyForm(true);
    setTwist(newTwist);
    setRows((prev) =>
      prev.map((r) => (!r.twist || r.twist === oldTwist ? { ...r, twist: newTwist } : r))
    );
  };

  const handleHeaderGradeChange = (newGradeId: string) => {
    setHasDirtyForm(true);
    setYarnGradeId(newGradeId);
    const newGradeName = grades.find((g) => g.id === newGradeId)?.gradeName || '';
    const oldGradeName = grades.find((g) => g.id === yarnGradeId)?.gradeName || '';
    setRows((prev) =>
      prev.map((r) => (!r.grade || r.grade === oldGradeName ? { ...r, grade: newGradeName } : r))
    );
  };

  // The Core Chandni Software Enter-Key Workflow
  const handleGrossWeightEnter = (idx: number) => {
    const currentRow = rows[idx];
    if (!currentRow) return;

    const grossVal = parseFloat(currentRow.grossWeight);
    if (isNaN(grossVal) || grossVal <= 0) {
      setErrorMessage(`Carton #${currentRow.cartonNumber}: Please enter a valid gross weight greater than 0.`);
      focusField(`${idx}_grossWeight`);
      return;
    }

    // Authoritative 3-decimal calculation for current row
    const cWgt = parseFloat(currentRow.cartonWeight) || 1.0;
    const copsInt = parseInt(currentRow.cops, 10) || 24;
    const cpWgt = parseFloat(emptyCopsWeight) || 0.040;
    const derived = calculateRowDerived(cWgt.toString(), copsInt.toString(), grossVal.toString(), cpWgt.toString());

    if (derived.error) {
      setErrorMessage(`Carton #${currentRow.cartonNumber}: ${derived.error}`);
      return;
    }

    setErrorMessage(null);

    const selectedGradeName = grades.find((g) => g.id === yarnGradeId)?.gradeName || '';
    const updatedCurrent: CartonRowState = {
      ...currentRow,
      cartonWeight: cWgt.toFixed(3),
      cops: copsInt.toString(),
      copsWeight: cpWgt.toFixed(3),
      grossWeight: grossVal.toFixed(3),
      tareWeight: derived.tareWeight,
      netWeight: derived.netWeight,
      averageWeight: derived.averageWeight,
      twist: currentRow.twist || twist,
      lotNumber: currentRow.lotNumber || lotNumber,
      grade: currentRow.grade || selectedGradeName,
      hasError: false,
      errorMessage: undefined,
    };

    // If next row already exists (user editing previous row), focus next row's gross weight
    if (idx + 1 < rows.length) {
      setRows((prev) => prev.map((r, i) => (i === idx ? updatedCurrent : r)));
      setActiveRowIndex(idx + 1);
      focusField(`${idx + 1}_grossWeight`);
      return;
    }

    // Generate next sequential carton number (e.g. 1460 -> 1461)
    const nextCartonNum = getNextCartonNumber(updatedCurrent.cartonNumber);

    // Compute inherited tare weight for the next carton
    const nextDerived = calculateRowDerived(
      updatedCurrent.cartonWeight,
      updatedCurrent.cops,
      '',
      updatedCurrent.copsWeight
    );

    // Subsequent carton inherits: Carton Weight, Cops, Cops Weight, Tare Weight, Twist, LOT NO, Grade
    const nextRow: CartonRowState = {
      id: Math.random().toString(),
      cartonNumber: nextCartonNum,
      cartonWeight: updatedCurrent.cartonWeight, // Inherited
      cops: updatedCurrent.cops,                 // Inherited
      grossWeight: '',                           // ONLY Gross Weight needed from operator!
      copsWeight: updatedCurrent.copsWeight,     // Inherited
      tareWeight: nextDerived.tareWeight,        // Inherited
      netWeight: 0,
      averageWeight: 0,
      twist: updatedCurrent.twist,               // Inherited from current/header
      lotNumber: updatedCurrent.lotNumber,       // Inherited from current/header
      grade: updatedCurrent.grade,               // Inherited from current/header
    };

    setRows((prev) => {
      const copy = [...prev];
      copy[idx] = updatedCurrent;
      copy.push(nextRow);
      return copy;
    });

    setSuggestedNewNo(nextCartonNum);
    setActiveRowIndex(idx + 1);

    // Immediately focus next row's Gross Weight input!
    focusField(`${idx + 1}_grossWeight`);
  };

  // Weight Scale
  const handleWeightScale = () => {
    setErrorMessage(
      'Weight Scale: No electronic scale hardware is currently connected. Please enter the gross weight manually in the Gross column. (Scale hardware integration can be configured when a compatible serial/USB scale is connected).'
    );
  };

  // Search Taka/Cartoon/Beam (F3)
  const handleSearchCartons = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      // Find matching items from current loaded rows and existing challans
      const localMatches = rows
        .filter((r) => r.cartonNumber.toLowerCase().includes(query.toLowerCase()) && r.grossWeight)
        .map((r) => ({
          type: 'Carton (Current Challan)',
          number: r.cartonNumber,
          detail: `Gross: ${r.grossWeight} kg, Net: ${r.netWeight.toFixed(3)} kg, Lot: ${r.lotNumber}`,
        }));

      setSearchResults(localMatches);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Save Challan (1 - Save / F10)
  const handleSave = async () => {
    if (!selectedBook) return;

    const activeRecordId = editId || loadedChallanId;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Filter valid completed rows with Gross Weight > 0
    const completedRows = rows.filter((r) => r.cartonNumber.trim() && parseFloat(r.grossWeight) > 0);
    if (completedRows.length === 0) {
      setErrorMessage('Please enter at least one completed carton with gross weight to save challan.');
      return;
    }

    // Check duplicate carton numbers
    const seen = new Set<string>();
    for (const r of completedRows) {
      const numKey = r.cartonNumber.trim();
      if (seen.has(numKey)) {
        setErrorMessage(`Duplicate carton number '${numKey}' in entry grid.`);
        return;
      }
      seen.add(numKey);

      if (r.hasError) {
        setErrorMessage(`Carton ${numKey} has an error: ${r.errorMessage}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isCancelledRecord) {
        setErrorMessage('Cannot save changes to a cancelled challan.');
        return;
      }

      // Convert DD/MM/YYYY to YYYY-MM-DD
      const dateParts = challanDate.split('/').map((s) => s.trim());
      const isoDate =
        dateParts.length === 3
          ? `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`
          : new Date().toISOString().slice(0, 10);

      const payload = {
        productionBookId: selectedBook.id,
        challanNumber: challanNumber.trim(),
        challanDate: isoDate,
        partyId: partyId || null,
        machineId: machineId || null,
        operatorId: operatorId || null,
        yarnQualityId: yarnQualityId || null,
        yarnGradeId: yarnGradeId || null,
        lotNumber: lotNumber.trim() || null,
        twist: twist.trim() || null,
        emptyCopsWeight: parseFloat(emptyCopsWeight) || 0.04,
        locationId: locationId || null,
        remarks: remarks.trim() || null,
        items: completedRows.map((r) => ({
          cartonNumber: r.cartonNumber.trim(),
          cartonWeight: parseFloat(r.cartonWeight) || 1.0,
          cops: parseInt(r.cops, 10) || 24,
          grossWeight: parseFloat(r.grossWeight) || 0,
          copsWeight: parseFloat(r.copsWeight) || 0.04,
          twist: r.twist.trim() || twist.trim() || null,
          lotNumber: r.lotNumber.trim() || lotNumber.trim() || null,
          grade: r.grade.trim() || null,
        })),
      };

      if (activeRecordId) {
        const updated = await updateProductionReceive(activeRecordId, payload);
        setLoadedChallanId(updated.id || activeRecordId);
        setSuccessMessage(`Challan #${updated.challanNumber} updated successfully! (${updated.items.length} cartons)`);
        setHasDirtyForm(false);
      } else {
        const result = await createProductionReceive(payload);
        setSuccessMessage(`Challan #${result.challan.challanNumber} saved successfully! (${result.challan.items.length} cartons, ${totals.totalNetWeight.toFixed(3)} kg)`);

        // Advance next numbers
        const nextNums = await getNextProductionReceiveNumbers(selectedBook.id);
        setChallanNumber(nextNums.nextChallanNumber || (parseInt(challanNumber, 10) + 1).toString());
        const nextCartonSuggestion = nextNums.nextCartonNumber || getNextCartonNumber(completedRows[completedRows.length - 1].cartonNumber);
        setSuggestedNewNo(nextCartonSuggestion);

        // Reset to fresh first carton ready for entry
        const selectedGradeName = grades.find((g) => g.id === yarnGradeId)?.gradeName || '';
        const firstDerived = calculateRowDerived('1.000', '24', '', emptyCopsWeight);
        setRows([
          {
            id: Math.random().toString(),
            cartonNumber: nextCartonSuggestion,
            cartonWeight: '1.000',
            cops: '24',
            grossWeight: '',
            copsWeight: emptyCopsWeight,
            tareWeight: firstDerived.tareWeight,
            netWeight: 0,
            averageWeight: 0,
            twist: twist,
            lotNumber: lotNumber,
            grade: selectedGradeName,
          },
        ]);
        setLoadedChallanId(null);
        setIsCancelledRecord(false);
        setHasDirtyForm(false);
        setActiveRowIndex(0);
        focusField('0_cartonNumber');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save production challan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear form (2 - Clear)
  const handleClear = () => {
    const hasData = rows.some((r) => r.grossWeight && parseFloat(r.grossWeight) > 0);
    if (hasData && !window.confirm('Clear all unsaved carton entries? This cannot be undone.')) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setHasDirtyForm(false);
    const selectedGradeName = grades.find((g) => g.id === yarnGradeId)?.gradeName || '';
    const firstDerived = calculateRowDerived('1.000', '24', '', emptyCopsWeight);
    setRows([
      {
        id: Math.random().toString(),
        cartonNumber: suggestedNewNo || '1460',
        cartonWeight: '1.000',
        cops: '24',
        grossWeight: '',
        copsWeight: emptyCopsWeight,
        tareWeight: firstDerived.tareWeight,
        netWeight: 0,
        averageWeight: 0,
        twist: twist,
        lotNumber: lotNumber,
        grade: selectedGradeName,
      },
    ]);
    setActiveRowIndex(0);
    focusField('0_cartonNumber');
  };

  // Go Back to Books (3 - Go Back)
  const handleGoBack = () => {
    const hasData = rows.some((r) => r.grossWeight && parseFloat(r.grossWeight) > 0);
    if (hasData && !window.confirm('You have unsaved carton entries. Go back to Book Selection anyway?')) {
      return;
    }
    navigate('/manufacturing/production-receive/books');
  };

  // Print (4 - Print)
  const handlePrint = () => {
    if (editId) {
      setShowPrintOptions(true);
    } else {
      setErrorMessage('Please save the challan first before printing.');
    }
  };

  // Exit (5 - Exit)
  const handleExit = () => {
    const hasData = rows.some((r) => r.grossWeight && parseFloat(r.grossWeight) > 0);
    if (hasData && !window.confirm('You have unsaved entries. Exit to Dashboard anyway?')) {
      return;
    }
    navigate('/');
  };

  // Previous (7 - Previous)
  const handlePrevious = () => {
    if (navIds.prevId) {
      navigate(`/manufacturing/production-receive/entry?edit=${navIds.prevId}&bookId=${bookIdParam}`);
    }
  };

  // Next (8 - Next)
  const handleNext = () => {
    if (navIds.nextId) {
      navigate(`/manufacturing/production-receive/entry?edit=${navIds.nextId}&bookId=${bookIdParam}`);
    }
  };

  // Keyboard Shortcuts (1=Save, 2=Clear, 3=Back, 4=Print, 5=Exit, 7=Prev, 8=Next, F3=Search, F5=List, F10=Save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'select' || activeTag === 'textarea';

      if (e.key === 'F5') {
        e.preventDefault();
        navigate('/manufacturing/production-receive/records');
      } else if (e.key === 'F10') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowSearchModal(true);
      } else if (!isInputFocused) {
        if (e.key === '1') {
          e.preventDefault();
          handleSave();
        } else if (e.key === '2') {
          e.preventDefault();
          handleClear();
        } else if (e.key === '3') {
          e.preventDefault();
          handleGoBack();
        } else if (e.key === '4') {
          e.preventDefault();
          handlePrint();
        } else if (e.key === '5') {
          e.preventDefault();
          handleExit();
        } else if (e.key === '7') {
          e.preventDefault();
          handlePrevious();
        } else if (e.key === '8') {
          e.preventDefault();
          handleNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (isValidatingBook) {
    return (
      <div className="min-h-screen bg-[#dce8e1] flex flex-col items-center justify-center text-xs font-bold text-slate-700 space-y-2">
        <div className="w-6 h-6 border-2 border-[#2c5f57] border-t-transparent rounded-full animate-spin" />
        <span>Loading Production Book Context...</span>
      </div>
    );
  }

  // Display at least 16 rows to match the classic desktop ERP feel
  const totalDisplayRows = Math.max(16, rows.length);
  const displayRows = Array.from({ length: totalDisplayRows }, (_, idx) => {
    if (idx < rows.length) {
      return { isPlaceholder: false, data: rows[idx], cartonNum: rows[idx].cartonNumber };
    }
    const offset = idx - rows.length + 1;
    return {
      isPlaceholder: true,
      data: null,
      cartonNum: getPlaceholderCartonNumber(offset),
    };
  });

  return (
    <div className="min-h-screen bg-[#dce8e1] text-slate-800 flex flex-col font-sans select-none overflow-x-hidden text-xs">
      {/* ── Top Window Title Bar (Matching Screenshot 2) ────────────────────── */}
      <div className="bg-[#2c5f57] text-white px-3 py-1 flex items-center justify-between border-b border-[#1f4842] shadow-xs">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-xs sm:text-sm tracking-wide">
            Production Receive Challan -&gt; {selectedBook?.bookName || 'YARN SALES'}
          </span>
          {hasEditAccess && (
            <span className="bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
              Edit Mode
            </span>
          )}
          {isCancelledRecord && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded uppercase">
              Cancelled
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {/* List-F5 Button (Opens Challan Register) */}
          <button
            onClick={() => navigate('/manufacturing/production-receive/records')}
            title="Open Production Challans Register (List - F5)"
            className="bg-[#107c41] hover:bg-[#0c6334] text-white text-xs font-bold px-3 py-0.5 rounded-xs flex items-center space-x-1 shadow-2xs border border-[#0d5f32] transition-colors cursor-pointer"
          >
            <span>List-F5</span>
          </button>

          {/* Minimize */}
          <button
            onClick={() => navigate('/manufacturing/production-receive/books')}
            title="Minimize"
            className="w-5 h-4 flex items-center justify-center text-xs text-slate-200 hover:bg-[#1f4842] rounded-xs"
          >
            _
          </button>
          {/* Maximize */}
          <button
            title="Maximize"
            className="w-5 h-4 flex items-center justify-center text-xs text-slate-200 hover:bg-[#1f4842] rounded-xs"
          >
            □
          </button>
          {/* Close */}
          <button
            onClick={() => navigate('/manufacturing/production-receive/books')}
            title="Close"
            className="w-5 h-4 flex items-center justify-center text-xs text-white bg-[#eb5757] hover:bg-red-600 rounded-xs font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Alerts & Notifications ────────────────────────────────────────── */}
      {successMessage && (
        <div className="bg-emerald-100 border-b border-emerald-300 text-emerald-800 px-4 py-1 flex items-center justify-between text-xs font-semibold">
          <span>✓ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 px-4 py-1 flex items-center justify-between text-xs font-semibold">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* ── Top Form Fields Area (Matching Screenshot 2) ────────────────────── */}
      <div className="bg-[#dce8e1] px-4 py-2 border-b border-[#789d93]">
        {/* Row 1 */}
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-2">
          <div className="flex items-center space-x-4 flex-wrap gap-y-1.5">
            {/* Chln. No */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Chln. No :</span>
              <div className="bg-[#183330] border border-[#112422] rounded-xs px-2 py-0.5 flex items-center shadow-inner">
                <input
                  type="text"
                  value={challanNumber}
                  onChange={(e) => {
                    setHasDirtyForm(true);
                    setChallanNumber(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleChallanLookup();
                    }
                  }}
                  className="bg-transparent text-[#48e5c2] font-mono font-bold text-sm text-right w-16 focus:outline-none"
                  disabled={isLoadingExistingChallan || isCancelledRecord}
                />
              </div>
              {isLoadingExistingChallan && (
                <span className="text-[10px] font-bold text-amber-700">Loading…</span>
              )}
            </div>

            {/* Date */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Date :</span>
              <input
                type="text"
                value={challanDate}
                onChange={(e) => {
                  setHasDirtyForm(true);
                  setChallanDate(e.target.value);
                }}
                placeholder="DD/ MM/ YYYY"
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs text-center font-mono w-28 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                disabled={isCancelledRecord}
              />
            </div>

            {/* Party Name */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Party Name :</span>
              <select
                value={partyId}
                onChange={(e) => {
                  setHasDirtyForm(true);
                  setPartyId(e.target.value);
                }}
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                disabled={isCancelledRecord}
              >
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.partyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Machine */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Machine :</span>
              <select
                value={machineId}
                onChange={(e) => {
                  setHasDirtyForm(true);
                  setMachineId(e.target.value);
                }}
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                disabled={isCancelledRecord}
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.machineCode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Excel Shortcuts button */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="bg-white hover:bg-slate-50 border border-[#789d93] rounded-xs px-2 py-0.5 flex items-center space-x-1.5 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
            >
              <span className="w-3.5 h-3.5 bg-emerald-700 text-white rounded-xs flex items-center justify-center font-bold text-[9px]">
                X
              </span>
              <span>Shortcuts</span>
            </button>
          </div>
        </div>

        {/* Row 2 */}
        <div className="flex items-center justify-between flex-wrap gap-y-2 mb-2">
          <div className="flex items-center space-x-4 flex-wrap gap-y-1.5">
            {/* Quality/Denier */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Quality/Denier :</span>
              <select
                value={yarnQualityId}
                onChange={(e) => {
                  setHasDirtyForm(true);
                  setYarnQualityId(e.target.value);
                }}
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-60 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                disabled={isCancelledRecord}
              >
                {qualities.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.qualityName} {q.denier ? `(${q.denier})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* LOT NO */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">LOT NO :</span>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => handleHeaderLotNumberChange(e.target.value)}
                placeholder="LOT NO"
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-28 uppercase focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>

            {/* Twist */}
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-800">Twist :</span>
              <input
                type="text"
                value={twist}
                onChange={(e) => handleHeaderTwistChange(e.target.value)}
                className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              />
            </div>
          </div>

          {/* Weight Scale Button */}
          <div className="flex items-center">
            <button
              onClick={handleWeightScale}
              title="No electronic scale connected — click for manual entry guidance"
              className="bg-slate-50 hover:bg-slate-100 border border-[#789d93] rounded-xs px-2.5 py-1 flex flex-col items-center justify-center text-[10px] font-bold text-slate-600 shadow-2xs leading-tight cursor-pointer"
            >
              <span>Weight</span>
              <span>Scale</span>
              <span className="text-[8px] text-amber-600 font-normal">Not connected</span>
            </button>
          </div>
        </div>

        {/* Row 3 */}
        <div className="flex items-center space-x-4 flex-wrap gap-y-1.5 mb-2">
          {/* Operator Name */}
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-800">Operator Name :</span>
            <select
              value={operatorId}
              onChange={(e) => {
                setHasDirtyForm(true);
                setOperatorId(e.target.value);
              }}
              className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-52 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              disabled={isCancelledRecord}
            >
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.operatorName}
                </option>
              ))}
            </select>
          </div>

          {/* GRADE */}
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-800">GRADE :</span>
            <select
              value={yarnGradeId}
              onChange={(e) => handleHeaderGradeChange(e.target.value)}
              className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
            >
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.gradeName}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-slate-800">Location :</span>
            <select
              value={locationId}
              onChange={(e) => {
                setHasDirtyForm(true);
                setLocationId(e.target.value);
              }}
              className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
              disabled={isCancelledRecord}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.locationName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4 */}
        <div className="flex items-center space-x-6 flex-wrap gap-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">Empty Cops Weight :</span>
            <input
              type="text"
              value={emptyCopsWeight}
              onChange={(e) => handleEmptyCopsWeightChange(e.target.value)}
              className="bg-white border border-[#789d93] rounded-xs px-2 py-0.5 text-xs font-mono w-20 text-right focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">New No :</span>
            <span className="font-mono font-bold text-slate-900 bg-white/70 px-2 py-0.5 border border-[#789d93] rounded-xs">
              {suggestedNewNo}
            </span>
          </div>
        </div>
      </div>

      {/* ── Carton Grid Table (legacy production register format) ───────────── */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden border-b border-[#789d93]">
        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-270px)]">
          <table className="w-full min-w-[766px] table-fixed border-collapse text-xs">
            <colgroup>
              <col style={{ width: '24px' }} />
              <col style={{ width: '30px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '84px' }} />
              <col style={{ width: '56px' }} />
              <col style={{ width: '76px' }} />
              <col style={{ width: '76px' }} />
              <col style={{ width: '72px' }} />
              <col style={{ width: '82px' }} />
              <col style={{ width: '110px' }} />
              <col />
            </colgroup>
            {/* Table Header */}
            <thead className="bg-[#c2ded7] text-[#1e403a] font-bold sticky top-0 z-10 border-b border-[#789d93]">
              <tr>
                <th className="py-1 px-1 border-r border-[#789d93] text-center"></th>
                <th className="py-1 px-1 border-r border-[#789d93] text-right"></th>
                <th className="py-1 px-2 border-r border-[#789d93] text-left">Cartn</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right">Cartn.Wgt</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right">Cops</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right">Gross</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right">Cops.Wgt</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right">Tare Wgt</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-right font-bold">Weight</th>
                <th className="py-1 px-2 border-r border-[#789d93] text-left">LOT NO</th>
                <th className="py-1 px-3 text-right">Avg_Wgt</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[#d4e4dd]">
              {displayRows.map((item, idx) => {
                const isActive = activeRowIndex === idx;

                if (!item.isPlaceholder && item.data) {
                  const r = item.data;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setActiveRowIndex(idx)}
                      className={`cursor-pointer ${
                        isActive ? 'bg-[#f0f7f4]' : idx % 2 === 1 ? 'bg-[#fbfdfc]' : 'bg-white'
                      }`}
                    >
                      {/* Active Indicator Arrow */}
                      <td className="py-0.5 px-1 text-center font-bold text-black border-r border-[#789d93]">
                        {isActive ? '►' : ''}
                      </td>

                      <td className="py-0.5 px-1 text-right font-mono text-[#1e3a8a] border-r border-[#789d93]">
                        {idx + 1}
                      </td>

                      {/* 1. Cartn (Editable for first carton, Enter moves to Cartn.Wgt) */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          ref={(el) => (inputRefs.current[`${idx}_cartonNumber`] = el)}
                          type="text"
                          value={r.cartonNumber}
                          onChange={(e) => handleCellChange(r.id, 'cartonNumber', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusField(`${idx}_cartonWeight`);
                            }
                          }}
                          className="w-full bg-transparent px-1 py-0.5 text-xs font-mono font-bold focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* 2. Cartn.Wgt (Editable, Enter moves to Cops) */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          ref={(el) => (inputRefs.current[`${idx}_cartonWeight`] = el)}
                          type="text"
                          value={r.cartonWeight}
                          onChange={(e) => handleCellChange(r.id, 'cartonWeight', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusField(`${idx}_cops`);
                            }
                          }}
                          className="w-full bg-transparent px-1 py-0.5 text-right text-xs font-mono focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* 3. Cops (Editable, Enter moves to Gross Weight) */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          ref={(el) => (inputRefs.current[`${idx}_cops`] = el)}
                          type="text"
                          value={r.cops}
                          onChange={(e) => handleCellChange(r.id, 'cops', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusField(`${idx}_grossWeight`);
                            }
                          }}
                          className="w-full bg-transparent px-1 py-0.5 text-right text-xs font-mono focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* 4. Gross (Primary operator input! Enter commits carton & auto-creates next carton) */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          ref={(el) => (inputRefs.current[`${idx}_grossWeight`] = el)}
                          type="text"
                          value={r.grossWeight}
                          placeholder="0.000"
                          onChange={(e) => handleCellChange(r.id, 'grossWeight', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleGrossWeightEnter(idx);
                            }
                          }}
                          className="w-full bg-white border border-[#789d93] px-1 py-0.5 text-right text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                        />
                      </td>

                      {/* Cops.Wgt (Header-derived) */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          type="text"
                          value={r.copsWeight}
                          onChange={(e) => handleCellChange(r.id, 'copsWeight', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          className="w-full bg-transparent px-1 py-0.5 text-right text-xs font-mono text-slate-600 focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* Tare Wgt (Calculated: Carton Weight + Cops * Cops Weight) */}
                      <td className="py-0.5 px-2 text-right font-mono text-slate-700 border-r border-[#e2ece6]">
                        {r.tareWeight.toFixed(3)}
                      </td>

                      {/* Weight (Net, Calculated: Gross Weight - Tare Weight) */}
                      <td
                        className={`py-0.5 px-2 text-right font-mono font-bold border-r border-[#e2ece6] ${
                          r.netWeight < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}
                      >
                        {r.netWeight.toFixed(3)}
                      </td>

                      {/* LOT NO */}
                      <td className="py-0.5 px-1 border-r border-[#e2ece6]">
                        <input
                          type="text"
                          value={r.lotNumber}
                          onChange={(e) => handleCellChange(r.id, 'lotNumber', e.target.value)}
                          onFocus={() => setActiveRowIndex(idx)}
                          className="w-full bg-transparent px-1 py-0.5 text-xs uppercase focus:bg-white focus:outline-none"
                        />
                      </td>

                      {/* Avg_Wgt (Calculated: Net Weight / Cops) */}
                      <td className="py-0.5 px-3 text-right font-mono text-slate-950">
                        {formatAverageWeight(r.netWeight, r.cops)}
                      </td>
                    </tr>
                  );
                }

                // Placeholder empty rows (e.g. rows 2-16 in Screenshot 2)
                return (
                  <tr
                    key={`placeholder-${idx}`}
                    onClick={() => {
                      // Click on empty row to make it active
                      setActiveRowIndex(idx);
                    }}
                    className="cursor-pointer bg-white"
                  >
                    <td className="py-0.5 px-1 text-center font-bold text-black border-r border-[#e2ece6]">
                      {isActive ? '►' : ''}
                    </td>
                    <td className="py-0.5 px-1 text-right font-mono text-[#1e3a8a] border-r border-[#e2ece6]">
                      {idx + 1}
                    </td>
                    <td className="py-0.5 px-2 text-left font-mono text-slate-400 border-r border-[#e2ece6]">
                      {item.cartonNum}
                    </td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-right border-r border-[#e2ece6]"></td>
                    <td className="py-0.5 px-2 text-left border-r border-[#e2ece6]"></td>
                    {/* In Screenshot 2, the Avg_Wgt column has a soft grey background on empty rows */}
                    <td className="py-0.5 px-3 text-right bg-[#e2e8e5]"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Sub-grid Totals Summary (Matching Section 8) ────────────────────── */}
        <div className="bg-[#eaf3ef] px-4 py-1.5 border-t border-[#789d93] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <div className="flex items-center space-x-4 flex-wrap gap-y-1">
            <span className="font-sans font-bold text-slate-700 uppercase">
              Totals ({totals.totalCartons} Cartons):
            </span>
            <span>
              Carton Wgt: <strong>{totals.totalCartonWeight.toFixed(3)}</strong>
            </span>
            <span>
              Cops: <strong>{totals.totalCops}</strong>
            </span>
            <span>
              Gross: <strong>{totals.totalGrossWeight.toFixed(3)}</strong>
            </span>
            <span>
              Tare: <strong>{totals.totalTareWeight.toFixed(3)}</strong>
            </span>
            <span className="text-[#0d5f32] font-bold text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Net Weight: {totals.totalNetWeight.toFixed(3)} kg
            </span>
            <span>
              Avg Wgt: <strong>{totals.totalAverageWeight.toFixed(3)}</strong>
            </span>
          </div>

          <button
            onClick={() => setShowSearchModal(true)}
            className="text-[11px] font-bold text-red-600 hover:text-red-700 font-sans cursor-pointer underline decoration-dotted"
          >
            Search Taka/Cartoon/Beam : F3
          </button>
        </div>
      </div>

      {/* ── Action Buttons Bar (Matching Screenshot 2) ──────────────────────── */}
      <div className="bg-[#e4eee8] px-4 py-1.5 border-t border-[#789d93] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          {/* 1 - Save */}
          <button
            onClick={handleSave}
            disabled={isSubmitting || isCancelledRecord}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : '1 - Save'}
          </button>

          {/* 2 - Clear */}
          <button
            onClick={handleClear}
            disabled={isSubmitting}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer"
          >
            2 - Clear
          </button>

          {/* 3 - Go Back */}
          <button
            onClick={handleGoBack}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer"
          >
            3 - Go Back
          </button>

          {/* 4 - Print */}
          <button
            onClick={handlePrint}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer"
          >
            4 - Print
          </button>

          {/* 5 - Exit */}
          <button
            onClick={handleExit}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer"
          >
            5 - Exit
          </button>

          {/* 7 - Previous */}
          <button
            onClick={handlePrevious}
            disabled={!navIds.prevId}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer disabled:opacity-40"
          >
            7 - Previous
          </button>

          {/* 8 - Next */}
          <button
            onClick={handleNext}
            disabled={!navIds.nextId}
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-3 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer disabled:opacity-40"
          >
            8 - Next
          </button>
        </div>

        {/* Creal (Clear) button on right */}
        <div>
          <button
            onClick={handleClear}
            title="Creal — Clear current unsaved carton entries (alias for 2-Clear)"
            className="bg-white hover:bg-slate-100 border border-[#789d93] rounded-xs px-4 py-1 font-bold text-slate-800 shadow-2xs cursor-pointer"
          >
            Creal
          </button>
        </div>
      </div>

      {/* ── Bottom Status Strip (Matching Screenshot 2) ─────────────────────── */}
      <div className="bg-[#f0f4f2] text-slate-700 px-3 py-0.5 text-[10px] font-mono border-t border-[#789d93] flex items-center justify-between select-none">
        <div className="flex items-center space-x-2">
          {/* Red X Icon */}
          <span className="w-3.5 h-3.5 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-[8px]">
            ✕
          </span>
          <span>
            Texturizing | {activeCompany?.companyName || 'SHIVAM ENTERPRISE'} | D:\CSOFT\Data\\FAS2627\COM0003.cssoft | {activeFinancialYear?.yearName || '2026 - 2027'}
          </span>
          <span className="text-amber-600 font-bold ml-2">📁 About Us Status FAS2627</span>
        </div>

        <div className="text-slate-600 font-sans text-[10px]">
          Made by Jainil Patel V.
        </div>
      </div>

      {/* ── Shortcuts Modal ─────────────────────────────────────────────────── */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-xl border border-slate-300 max-w-sm w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-xs text-slate-800">Keyboard Shortcuts</h3>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="text-slate-500 hover:text-black font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between"><span>Save Challan:</span><span className="font-mono font-bold">1 / F10</span></div>
              <div className="flex justify-between"><span>Clear Form:</span><span className="font-mono font-bold">2</span></div>
              <div className="flex justify-between"><span>Back to Books:</span><span className="font-mono font-bold">3</span></div>
              <div className="flex justify-between"><span>Print Packing Slip:</span><span className="font-mono font-bold">4</span></div>
              <div className="flex justify-between"><span>Exit to Dashboard:</span><span className="font-mono font-bold">5</span></div>
              <div className="flex justify-between"><span>Previous Record:</span><span className="font-mono font-bold">7</span></div>
              <div className="flex justify-between"><span>Next Record:</span><span className="font-mono font-bold">8</span></div>
              <div className="flex justify-between"><span>Search Carton/Taka/Beam:</span><span className="font-mono font-bold">F3</span></div>
              <div className="flex justify-between"><span>Challan Register List:</span><span className="font-mono font-bold">F5</span></div>
              <div className="flex justify-between"><span>Weight Scale:</span><span className="font-mono font-bold">Click button</span></div>
              <div className="flex justify-between"><span>Commit & Next Carton:</span><span className="font-mono font-bold">Enter</span></div>
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full py-1 bg-[#2c5f57] text-white font-bold rounded-xs text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Packing Slip Print Options Modal (Phase 10.1) ────────────────────── */}
      <PackingSlipPrintOptionsModal
        isOpen={showPrintOptions}
        onClose={() => setShowPrintOptions(false)}
        currentChallanNumber={challanNumber}
        challanId={editId}
        productionBookId={bookIdParam || ''}
        onPrint={(opts: PrintOptions) => {
          setShowPrintOptions(false);
          const params = new URLSearchParams({
            challanFrom: opts.challanFrom,
            challanTo: opts.challanTo,
            cartonFrom: opts.cartonFrom,
            cartonTo: opts.cartonTo,
            copies: opts.copies.toString(),
            landscape: opts.landscape.toString(),
            bookId: bookIdParam || '',
            challanId: editId || '',
          });
          window.open(`/manufacturing/packing-slip/print?${params.toString()}`, '_blank');
        }}
        onPreview={(opts: PrintOptions) => {
          setShowPrintOptions(false);
          const params = new URLSearchParams({
            challanFrom: opts.challanFrom,
            challanTo: opts.challanTo,
            cartonFrom: opts.cartonFrom,
            cartonTo: opts.cartonTo,
            copies: opts.copies.toString(),
            landscape: opts.landscape.toString(),
            bookId: bookIdParam || '',
            challanId: editId || '',
          });
          navigate(`/manufacturing/packing-slip/print?${params.toString()}`);
        }}
        onExport={(opts: PrintOptions) => {
          setShowPrintOptions(false);
          const params = new URLSearchParams({
            challanFrom: opts.challanFrom,
            challanTo: opts.challanTo,
            cartonFrom: opts.cartonFrom,
            cartonTo: opts.cartonTo,
            copies: opts.copies.toString(),
            landscape: opts.landscape.toString(),
            bookId: bookIdParam || '',
            challanId: editId || '',
          });
          navigate(`/manufacturing/packing-slip/print?${params.toString()}`);
        }}
        onEmail={(opts: PrintOptions) => {
          setShowPrintOptions(false);
          const range = opts.challanFrom === opts.challanTo ? `#${opts.challanFrom}` : `#${opts.challanFrom}–${opts.challanTo}`;
          const subject = encodeURIComponent(
            `Packing Slip — ${activeCompany?.companyName || 'SHIVAM ENTERPRISE'} Challan ${range}`
          );
          const body = encodeURIComponent(
            `Dear Sir/Madam,\n\nPlease find the Packing Slip for Challan ${range} attached.\n\nNote: Export the PDF from the Packing Slip print page and attach it manually to this email.\n\nRegards,\n${
              activeCompany?.companyName || 'SHIVAM ENTERPRISE'
            }`
          );
          window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
        }}
        onWhatsApp={(opts: PrintOptions) => {
          setShowPrintOptions(false);
          const range = opts.challanFrom === opts.challanTo ? `#${opts.challanFrom}` : `#${opts.challanFrom}–${opts.challanTo}`;
          const msg = encodeURIComponent(
            `Packing Slip for Challan ${range} — ${
              activeCompany?.companyName || 'SHIVAM ENTERPRISE'
            }. (Export the PDF from the print page and attach it manually.)`
          );
          window.open(`https://web.whatsapp.com/send?text=${msg}`, '_blank');
        }}
      />

      {/* ── F3 Search Taka/Cartoon/Beam Modal ────────────────────────────────── */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#dce8e1] border-2 border-[#2c5f57] rounded-none shadow-2xl w-[500px] max-w-full flex flex-col font-sans select-none">
            {/* Title Bar */}
            <div className="bg-[#2c5f57] text-white px-3 py-1 flex items-center justify-between border-b border-[#1f4842]">
              <span className="font-bold text-xs tracking-wide">Search Taka / Cartoon / Beam (F3)</span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="w-4 h-4 bg-[#eb5757] hover:bg-red-600 text-white flex items-center justify-center text-[10px] font-bold rounded-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Category Clarification Notice */}
              <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 text-[11px] rounded-xs">
                ℹ️ <strong>Search Scope:</strong> Cartoon (Carton) search is active in current production records. Taka (fabric rolls) and Beam (warp beams) searches will be supported when their respective Weaving and Warping modules are enabled.
              </div>

              {/* Search Input */}
              <div className="flex items-center space-x-2">
                <span className="font-bold text-xs text-slate-800">Carton Number :</span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Type carton number (e.g. 1460)..."
                  value={searchQuery}
                  onChange={(e) => handleSearchCartons(e.target.value)}
                  className="flex-1 bg-white border border-[#789d93] rounded-xs px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#2c5f57]"
                />
              </div>

              {/* Results Table */}
              <div className="bg-white border border-[#789d93] max-h-48 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-xs text-slate-500">Searching...</div>
                ) : searchResults.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-[#c2ded7] text-slate-800 border-b border-[#789d93]">
                      <tr>
                        <th className="py-1 px-2 text-left">Category</th>
                        <th className="py-1 px-2 text-left">Number</th>
                        <th className="py-1 px-2 text-left">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {searchResults.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-1 px-2 text-slate-700 font-sans">{r.type}</td>
                          <td className="py-1 px-2 font-bold text-slate-900">{r.number}</td>
                          <td className="py-1 px-2 text-slate-600">{r.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : searchQuery.trim() ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No matching cartons found for &quot;{searchQuery}&quot;.
                  </div>
                ) : (
                  <div className="p-3 text-center text-xs text-slate-400 italic">
                    Type a carton number above to search current challan records.
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-2 bg-[#e4eee8] flex justify-end border-t border-[#789d93]">
              <button
                onClick={() => setShowSearchModal(false)}
                className="bg-white hover:bg-slate-100 border border-[#789d93] text-slate-800 rounded-xs px-4 py-1 text-xs font-bold shadow-2xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionReceiveEntryPage;
