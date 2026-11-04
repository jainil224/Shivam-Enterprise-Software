import { PrismaClient } from '@prisma/client';
import { calculateCartonWeight, calculateTotals } from '../src/utils/weightCalculations.js';

const API_BASE = 'http://localhost:5000/api';
const prisma = new PrismaClient();

let companyAId = '';
let companyBId = '';
let fyAId = '';
let fyALockedId = '';
let fyBId = '';

let bookAId = '';
let bookInactiveId = '';
let bookBId = '';

let partyAId = '';
let partyInactiveId = '';
let partyBId = '';

let machineAId = '';
let machineBId = '';

let operatorAId = '';
let qualityAId = '';
let gradeAId = '';
let locationAId = '';

let savedChallanId = '';

async function runPhase7Tests() {
  console.log('================================================================');
  console.log('   PHASE 7: PRODUCTION RECEIVE ENTRY — FULL INTEGRATION TEST    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup Test Companies, Financial Years & Masters
    // -------------------------------------------------------------
    console.log('[Setup] Initializing test companies, financial years and masters...');

    // 1. Company A
    const compARes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_P7',
        companyName: 'Shivam Enterprise Phase 7 Test Ltd',
      }),
    });
    const compAData: any = await compARes.json();
    companyAId = compAData.data.id;

    // Financial Year 2025-2026 (Active & Unlocked)
    const fyARes = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: true,
      }),
    });
    const fyAData: any = await fyARes.json();
    fyAId = fyAData.data.id;

    // Financial Year 2024-2025 (Locked)
    const fyALockedRes = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2024-2025',
        startDate: '2024-04-01',
        endDate: '2025-03-31',
        isActive: true,
      }),
    });
    const fyALockedData: any = await fyALockedRes.json();
    fyALockedId = fyALockedData.data.id;
    // Lock it
    await fetch(`${API_BASE}/financial-years/${fyALockedId}/lock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isLocked: true }),
    });

    // 2. Company B (for cross-company isolation tests)
    const compBRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'AUX_P7',
        companyName: 'Auxiliary Enterprise Phase 7 Test Ltd',
      }),
    });
    const compBData: any = await compBRes.json();
    companyBId = compBData.data.id;

    const fyBRes = await fetch(`${API_BASE}/companies/${companyBId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: true,
      }),
    });
    const fyBData: any = await fyBRes.json();
    fyBId = fyBData.data.id;

    // Production Books
    const bookARes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        financialYearId: fyAId,
        prefix: 'PR-25',
        bookName: 'Main Production Receive Book',
        openingBalance: 1000.0,
      }),
    });
    const bookAData: any = await bookARes.json();
    bookAId = bookAData.data.id;

    // Inactive book
    const bookInactRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        financialYearId: fyAId,
        prefix: 'INACT-25',
        bookName: 'Inactive Book',
        openingBalance: 0,
      }),
    });
    const bookInactData: any = await bookInactRes.json();
    bookInactiveId = bookInactData.data.id;
    await fetch(`${API_BASE}/masters/production-books/${bookInactiveId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({ isActive: false }),
    });

    // Company B Book
    const bookBRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyBId,
        'x-financial-year-id': fyBId,
      },
      body: JSON.stringify({
        financialYearId: fyBId,
        prefix: 'PR-25',
        bookName: 'Company B Book',
        openingBalance: 500.0,
      }),
    });
    const bookBData: any = await bookBRes.json();
    bookBId = bookBData.data.id;

    // Masters for Company A
    const partyRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        partyCode: 'P7-CUST-1',
        partyName: 'Rajesh Weaving Mills',
        partyType: 'CUSTOMER',
      }),
    });
    partyAId = (await partyRes.json()).data.id;

    const partyInactRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        partyCode: 'P7-INACT-CUST',
        partyName: 'Defunct Party',
        partyType: 'CUSTOMER',
      }),
    });
    partyInactiveId = (await partyInactRes.json()).data.id;
    await fetch(`${API_BASE}/masters/parties/${partyInactiveId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({ isActive: false }),
    });

    const partyBRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyBId },
      body: JSON.stringify({
        partyCode: 'P7-COMPB-CUST',
        partyName: 'Company B Customer',
        partyType: 'CUSTOMER',
      }),
    });
    partyBId = (await partyBRes.json()).data.id;

    const machRes = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        machineCode: 'TFO-01',
        machineName: 'Twister Line 1',
      }),
    });
    machineAId = (await machRes.json()).data.id;

    const machBRes = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyBId },
      body: JSON.stringify({
        machineCode: 'TFO-B1',
        machineName: 'Company B Twister',
      }),
    });
    machineBId = (await machBRes.json()).data.id;

    const opRes = await fetch(`${API_BASE}/masters/operators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        operatorCode: 'OP-01',
        operatorName: 'Suresh Patel',
      }),
    });
    operatorAId = (await opRes.json()).data.id;

    const qualRes = await fetch(`${API_BASE}/masters/yarn-qualities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        qualityName: '80/72 Polyester DTY',
        denier: '80/72',
      }),
    });
    qualityAId = (await qualRes.json()).data.id;

    const gradeRes = await fetch(`${API_BASE}/masters/yarn-grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        gradeName: 'A-Grade Fresh',
      }),
    });
    gradeAId = (await gradeRes.json()).data.id;

    const locRes = await fetch(`${API_BASE}/masters/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId },
      body: JSON.stringify({
        locationName: 'Section A Ground Floor',
      }),
    });
    locationAId = (await locRes.json()).data.id;

    console.log('  Masters and companies initialized cleanly.\n');

    // -------------------------------------------------------------
    // Part 1: Context & Validation Endpoint
    // -------------------------------------------------------------
    console.log('[Part 1] Testing context validation (/validate-context)...');

    // Valid context
    const validCtxRes = await fetch(
      `${API_BASE}/manufacturing/production-receive/validate-context?productionBookId=${bookAId}`,
      {
        headers: {
          'x-company-id': companyAId,
          'x-financial-year-id': fyAId,
        },
      }
    );
    const validCtxData: any = await validCtxRes.json();
    assert(validCtxRes.status === 200, 'Valid context returned HTTP 200');
    assert(validCtxData.data.productionBook.id === bookAId, 'Validated book ID matches');
    assert(validCtxData.data.financialYear.yearName === '2025-2026', 'Validated FY name matches');

    // Inactive book rejection
    const inactBookCtx = await fetch(
      `${API_BASE}/manufacturing/production-receive/validate-context?productionBookId=${bookInactiveId}`,
      {
        headers: {
          'x-company-id': companyAId,
          'x-financial-year-id': fyAId,
        },
      }
    );
    assert(inactBookCtx.status === 400, 'Inactive book rejected with HTTP 400');

    // Locked financial year rejection
    const lockedFyBook = await prisma.productionBook.create({
      data: {
        companyId: companyAId,
        financialYearId: fyALockedId,
        prefix: 'LOCKED-24',
        bookName: 'Locked Year Book',
      },
    });
    const lockedCtx = await fetch(
      `${API_BASE}/manufacturing/production-receive/validate-context?productionBookId=${lockedFyBook.id}`,
      {
        headers: {
          'x-company-id': companyAId,
          'x-financial-year-id': fyALockedId,
        },
      }
    );
    assert(lockedCtx.status === 403, 'Locked financial year rejected with HTTP 403 Forbidden');

    // Cross-company book rejection
    const crossBookCtx = await fetch(
      `${API_BASE}/manufacturing/production-receive/validate-context?productionBookId=${bookBId}`,
      {
        headers: {
          'x-company-id': companyAId,
          'x-financial-year-id': fyAId,
        },
      }
    );
    assert(crossBookCtx.status === 400, 'Cross-company book rejected with HTTP 400');

    // -------------------------------------------------------------
    // Part 2: Next Number Generation
    // -------------------------------------------------------------
    console.log('\n[Part 2] Testing next number generation (/next-number)...');
    const nextNumRes = await fetch(
      `${API_BASE}/manufacturing/production-receive/next-number?productionBookId=${bookAId}`,
      {
        headers: {
          'x-company-id': companyAId,
          'x-financial-year-id': fyAId,
        },
      }
    );
    const nextNumData: any = await nextNumRes.json();
    assert(nextNumRes.status === 200, 'Next number returned HTTP 200');
    assert(Boolean(nextNumData.data.nextChallanNumber), 'Generated nextChallanNumber exists');
    assert(Boolean(nextNumData.data.nextCartonNumber), 'Generated nextCartonNumber exists');
    console.log(`  Suggested Challan No: ${nextNumData.data.nextChallanNumber}, Carton No: ${nextNumData.data.nextCartonNumber}`);

    // -------------------------------------------------------------
    // Part 3: Exact Weight Calculation Unit Tests
    // -------------------------------------------------------------
    console.log('\n[Part 3] Testing exact weight calculation logic...');
    // Example from phse 7.md:
    // Carton Weight = 1.000, Cops = 24, Gross Weight = 31.620, Cops Weight = 0.040
    // Tare = 1.000 + (24 * 0.040) = 1.960
    // Net = 31.620 - 1.960 = 29.660
    // Avg = 29.660 / 24 = 1.235833 -> 1.236
    const calc1 = calculateCartonWeight({
      cartonNumber: '1',
      cartonWeight: 1.000,
      cops: 24,
      grossWeight: 31.620,
      copsWeight: 0.040,
    });

    assert(calc1.tareWeight.toFixed(3) === '1.960', 'Tare weight calculation exact (1.960)');
    assert(calc1.netWeight.toFixed(3) === '29.660', 'Net weight calculation exact (29.660)');
    assert(calc1.averageWeight.toFixed(3) === '1.236', 'Average weight calculation exact (1.236)');

    // Multiple cartons and totals test
    const calc2 = calculateCartonWeight({
      cartonNumber: '2',
      cartonWeight: 1.000,
      cops: 24,
      grossWeight: 30.000,
      copsWeight: 0.040,
    });
    assert(calc2.tareWeight.toFixed(3) === '1.960', 'Carton 2 Tare weight exact (1.960)');
    assert(calc2.netWeight.toFixed(3) === '28.040', 'Carton 2 Net weight exact (28.040)');

    const totals = calculateTotals([calc1, calc2]);
    assert(totals.totalCartons === 2, 'Total cartons = 2');
    assert(totals.totalCops === 48, 'Total cops = 48');
    assert(totals.totalGrossWeight.toFixed(3) === '61.620', 'Total gross = 61.620');
    assert(totals.totalTareWeight.toFixed(3) === '3.920', 'Total tare = 3.920');
    assert(totals.totalNetWeight.toFixed(3) === '57.700', 'Total net = 57.700');
    assert(totals.totalAverageWeight.toFixed(3) === '1.202', 'Total average = 1.202');

    // Negative weight rejection
    let negRejected = false;
    try {
      calculateCartonWeight({
        cartonNumber: '3',
        cartonWeight: -1,
        cops: 24,
        grossWeight: 30,
        copsWeight: 0.04,
      });
    } catch {
      negRejected = true;
    }
    assert(negRejected, 'Negative carton weight correctly rejected');

    // Negative net weight rejection (Gross < Tare)
    let negNetRejected = false;
    try {
      calculateCartonWeight({
        cartonNumber: '4',
        cartonWeight: 5.0,
        cops: 100,
        grossWeight: 5.5, // Tare = 5.0 + 4.0 = 9.0 > Gross 5.5!
        copsWeight: 0.04,
      });
    } catch {
      negNetRejected = true;
    }
    assert(negNetRejected, 'Negative net weight (Gross < Tare) correctly rejected');

    // Invalid cops rejection
    let copsRejected = false;
    try {
      calculateCartonWeight({
        cartonNumber: '5',
        cartonWeight: 1.0,
        cops: 0,
        grossWeight: 30,
        copsWeight: 0.04,
      });
    } catch {
      copsRejected = true;
    }
    assert(copsRejected, 'Zero cops rejected on completed row');

    // -------------------------------------------------------------
    // Part 4: Save Production Challan (POST /api/manufacturing/production-receive)
    // -------------------------------------------------------------
    console.log('\n[Part 4] Testing production challan creation...');

    const validPayload = {
      productionBookId: bookAId,
      challanNumber: '1001',
      challanDate: '2025-05-15',
      partyId: partyAId,
      machineId: machineAId,
      operatorId: operatorAId,
      yarnQualityId: qualityAId,
      yarnGradeId: gradeAId,
      locationId: locationAId,
      lotNumber: 'LOT-A100',
      twist: '80',
      emptyCopsWeight: 0.040,
      remarks: 'Phase 7 Integration Test Challan',
      items: [
        {
          cartonNumber: '101',
          cartonWeight: 1.000,
          cops: 24,
          grossWeight: 31.620,
          copsWeight: 0.040,
          twist: '80',
          lotNumber: 'LOT-A100',
          grade: 'A-Grade Fresh',
        },
        {
          cartonNumber: '102',
          cartonWeight: 1.000,
          cops: 24,
          grossWeight: 30.500,
          copsWeight: 0.040,
          twist: '80',
          lotNumber: 'LOT-A100',
          grade: 'A-Grade Fresh',
        },
      ],
    };

    const saveRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify(validPayload),
    });
    const saveData: any = await saveRes.json();
    assert(saveRes.status === 201, 'Challan created with HTTP 201 Created');
    assert(saveData.data.challanNumber === '1001', 'Saved challan number is 1001');
    assert(saveData.data.items.length === 2, 'Saved challan has 2 carton items');
    assert(saveData.data.status === 'CONFIRMED', 'Challan status is CONFIRMED');
    savedChallanId = saveData.data.id;

    // Verify calculated values stored in database
    const savedCarton1 = saveData.data.items[0];
    assert(Number(savedCarton1.tareWeight) === 1.96, 'Carton 1 DB tareWeight is 1.960');
    assert(Number(savedCarton1.netWeight) === 29.66, 'Carton 1 DB netWeight is 29.660');
    assert(Number(savedCarton1.averageWeight) === 1.236, 'Carton 1 DB averageWeight is 1.236');

    // -------------------------------------------------------------
    // Part 5: Duplicate Challan Number Prevention
    // -------------------------------------------------------------
    console.log('\n[Part 5] Testing duplicate challan number prevention (HTTP 409)...');
    const dupChallanRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1001', // duplicate
      }),
    });
    assert(dupChallanRes.status === 409, 'Duplicate challan number blocked with HTTP 409 Conflict');

    // -------------------------------------------------------------
    // Part 6: Duplicate Carton Number Prevention
    // -------------------------------------------------------------
    console.log('\n[Part 6] Testing duplicate carton number within challan...');
    const dupCartonRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1002',
        items: [
          { cartonNumber: '201', cartonWeight: 1, cops: 20, grossWeight: 25, copsWeight: 0.04 },
          { cartonNumber: '201', cartonWeight: 1, cops: 20, grossWeight: 25, copsWeight: 0.04 }, // Duplicate!
        ],
      }),
    });
    assert(dupCartonRes.status === 400, 'Duplicate carton number rejected with HTTP 400');

    // -------------------------------------------------------------
    // Part 7: Date Range & Financial Year Checks
    // -------------------------------------------------------------
    console.log('\n[Part 7] Testing challan date boundary validation...');
    // Date outside FY 2025-2026 (e.g. 2027-01-01)
    const outDateRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1003',
        challanDate: '2027-01-01', // Outside FY!
      }),
    });
    assert(outDateRes.status === 400, 'Challan date outside FY rejected with HTTP 400');

    // -------------------------------------------------------------
    // Part 8: Cross-Company Foreign Key Protections
    // -------------------------------------------------------------
    console.log('\n[Part 8] Testing cross-company master isolation on save...');
    // Cross-company Party
    const crossPartyRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1004',
        partyId: partyBId, // Belongs to Company B!
      }),
    });
    assert(crossPartyRes.status === 400, 'Cross-company Party rejected with HTTP 400');

    // Cross-company Machine
    const crossMachRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1005',
        machineId: machineBId, // Belongs to Company B!
      }),
    });
    assert(crossMachRes.status === 400, 'Cross-company Machine rejected with HTTP 400');

    // Inactive Party
    const inactPartyRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1006',
        partyId: partyInactiveId, // Inactive!
      }),
    });
    assert(inactPartyRes.status === 400, 'Inactive Party rejected with HTTP 400');

    // -------------------------------------------------------------
    // Part 9: Atomic Rollback on Failure
    // -------------------------------------------------------------
    console.log('\n[Part 9] Testing atomic rollback when one row is invalid...');
    const invalidRowRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        ...validPayload,
        challanNumber: '1007',
        items: [
          { cartonNumber: '301', cartonWeight: 1, cops: 20, grossWeight: 25, copsWeight: 0.04 },
          { cartonNumber: '302', cartonWeight: 1, cops: -5, grossWeight: 25, copsWeight: 0.04 }, // Invalid cops!
        ],
      }),
    });
    assert(invalidRowRes.status === 400, 'Invalid row rejected with HTTP 400');

    // Verify 1007 was NOT created
    const check1007 = await prisma.productionReceive.findFirst({
      where: { companyId: companyAId, challanNumber: '1007' },
    });
    assert(check1007 === null, 'Atomic rollback confirmed: no header or partial rows created');

    // -------------------------------------------------------------
    // Part 10: Fetch Saved Challan (GET /:id)
    // -------------------------------------------------------------
    console.log('\n[Part 10] Testing fetch saved challan (GET /:id)...');
    const getRes = await fetch(`${API_BASE}/manufacturing/production-receive/${savedChallanId}`, {
      headers: {
        'x-company-id': companyAId,
      },
    });
    const getData: any = await getRes.json();
    assert(getRes.status === 200, 'GET challan by ID returned HTTP 200');
    assert(getData.data.challanNumber === '1001', 'Fetched challan number matches');
    assert(getData.data.party.partyName === 'Rajesh Weaving Mills', 'Party relation populated');
    assert(getData.data.machine.machineName === 'Twister Line 1', 'Machine relation populated');
    assert(getData.data.items.length === 2, 'Items array populated with 2 cartons');

    // Company B cannot access Company A's challan (tenant privacy)
    const crossGetRes = await fetch(`${API_BASE}/manufacturing/production-receive/${savedChallanId}`, {
      headers: {
        'x-company-id': companyBId,
      },
    });
    assert(crossGetRes.status === 404, 'Cross-company GET rejected with HTTP 404');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 7 PRODUCTION RECEIVE TESTS PASSED (${passed}/${total})`);
    console.log('================================================================\n');
  } finally {
    console.log('[Cleanup] Removing Phase 7 temporary test records...');
    try {
      if (companyAId) {
        await prisma.productionReceiveItem.deleteMany({
          where: { productionReceive: { companyId: companyAId } },
        });
        await prisma.productionReceive.deleteMany({ where: { companyId: companyAId } });
        await prisma.productionBook.deleteMany({ where: { companyId: companyAId } });
        await prisma.location.deleteMany({ where: { companyId: companyAId } });
        await prisma.yarnGrade.deleteMany({ where: { companyId: companyAId } });
        await prisma.yarnQuality.deleteMany({ where: { companyId: companyAId } });
        await prisma.operator.deleteMany({ where: { companyId: companyAId } });
        await prisma.machine.deleteMany({ where: { companyId: companyAId } });
        await prisma.party.deleteMany({ where: { companyId: companyAId } });
        await prisma.financialYear.deleteMany({ where: { companyId: companyAId } });
        await prisma.company.delete({ where: { id: companyAId } });
      }
      if (companyBId) {
        await prisma.productionReceiveItem.deleteMany({
          where: { productionReceive: { companyId: companyBId } },
        });
        await prisma.productionReceive.deleteMany({ where: { companyId: companyBId } });
        await prisma.productionBook.deleteMany({ where: { companyId: companyBId } });
        await prisma.machine.deleteMany({ where: { companyId: companyBId } });
        await prisma.party.deleteMany({ where: { companyId: companyBId } });
        await prisma.financialYear.deleteMany({ where: { companyId: companyBId } });
        await prisma.company.delete({ where: { id: companyBId } });
      }
      console.log('  PASS: Database cleaned up cleanly.\n');
    } catch (e: any) {
      console.error('Cleanup notice:', e.message);
    }
    await prisma.$disconnect();
  }
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 Test Failure:', err);
  process.exit(1);
});

