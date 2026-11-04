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
let bookBId = '';

let partyAId = '';
let partyA2Id = '';
let partyBId = '';

let machineAId = '';
let machineA2Id = '';
let operatorAId = '';
let qualityAId = '';
let gradeAId = '';
let locationAId = '';

let challan1Id = '';
let challan2Id = '';
let challan3Id = '';
let lockedChallanId = '';

async function runPhase8Tests() {
  console.log('================================================================');
  console.log(' PHASE 8: PRODUCTION RECORD MANAGEMENT — FULL INTEGRATION TEST  ');
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

    // Cleanup previous phase 8 run if any
    await prisma.productionReceiveItem.deleteMany({
      where: {
        productionReceive: {
          company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
        },
      },
    });
    await prisma.productionReceive.deleteMany({
      where: {
        company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
      },
    });
    await prisma.productionBook.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.party.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.machine.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.operator.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.yarnQuality.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.yarnGrade.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.location.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.financialYear.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
    });
    await prisma.company.deleteMany({
      where: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
    });

    // 1. Company A
    const compARes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_P8',
        companyName: 'Shivam Enterprise Phase 8 Test Ltd',
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
        startDate: '2025-04-01T00:00:00.000Z',
        endDate: '2026-03-31T23:59:59.999Z',
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
        startDate: '2024-04-01T00:00:00.000Z',
        endDate: '2025-03-31T23:59:59.999Z',
      }),
    });
    const fyALockedData: any = await fyALockedRes.json();
    fyALockedId = fyALockedData.data.id;

    // Create a production book in 2024-2025 before locking
    const bookLockedRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyALockedId },
      body: JSON.stringify({ prefix: 'PR-8L', bookName: 'Book Locked 2024' }),
    });
    const bookLockedData: any = await bookLockedRes.json();
    const bookLockedId = bookLockedData.data.id;

    // Create a challan in 2024-2025 before locking
    const challanLockedRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyALockedId },
      body: JSON.stringify({
        productionBookId: bookLockedId,
        challanNumber: 'LOCKED-01',
        challanDate: '2024-06-01T00:00:00.000Z',
        emptyCopsWeight: 0.040,
        items: [{ cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 30.0 }],
      }),
    });
    const challanLockedData: any = await challanLockedRes.json();
    lockedChallanId = challanLockedData.data.id;

    // Now Lock Financial Year 2024-2025
    const lockFyRes = await fetch(`${API_BASE}/financial-years/${fyALockedId}/lock`, { method: 'PATCH' });
    assert(lockFyRes.status === 200, 'FY 2024-2025 locked successfully');

    // 2. Company B
    const compBRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'AUX_P8',
        companyName: 'Auxiliary Phase 8 Test Co',
      }),
    });
    const compBData: any = await compBRes.json();
    companyBId = compBData.data.id;

    const fyBRes = await fetch(`${API_BASE}/companies/${companyBId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01T00:00:00.000Z',
        endDate: '2026-03-31T23:59:59.999Z',
      }),
    });
    const fyBData: any = await fyBRes.json();
    fyBId = fyBData.data.id;

    // Production Books
    const bookARes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ prefix: 'PR-8A', bookName: 'Book A 2025' }),
    });
    const bookAData: any = await bookARes.json();
    bookAId = bookAData.data.id;

    const bookBRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyBId, 'x-financial-year-id': fyBId },
      body: JSON.stringify({ prefix: 'PR-8B', bookName: 'Book B 2025' }),
    });
    const bookBData: any = await bookBRes.json();
    bookBId = bookBData.data.id;

    // Masters for Company A
    const p1 = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ partyCode: 'P-01', partyName: 'Alpha Textiles' }),
    });
    partyAId = (await p1.json()).data.id;

    const p2 = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ partyCode: 'P-02', partyName: 'Beta Fabrics' }),
    });
    partyA2Id = (await p2.json()).data.id;

    const pB = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyBId, 'x-financial-year-id': fyBId },
      body: JSON.stringify({ partyCode: 'P-B1', partyName: 'Company B Party' }),
    });
    partyBId = (await pB.json()).data.id;

    const m1 = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ machineCode: 'M-01', machineName: 'Twister 1' }),
    });
    machineAId = (await m1.json()).data.id;

    const m2 = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ machineCode: 'M-02', machineName: 'Twister 2' }),
    });
    machineA2Id = (await m2.json()).data.id;

    const op = await fetch(`${API_BASE}/masters/operators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ operatorCode: 'OP-01', operatorName: 'Ramesh Patel' }),
    });
    operatorAId = (await op.json()).data.id;

    const yq = await fetch(`${API_BASE}/masters/yarn-qualities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ qualityName: '80/72 Polyester DTY' }),
    });
    qualityAId = (await yq.json()).data.id;

    const yg = await fetch(`${API_BASE}/masters/yarn-grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ gradeName: 'A-Grade' }),
    });
    gradeAId = (await yg.json()).data.id;

    const loc = await fetch(`${API_BASE}/masters/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ locationName: 'Godown 1' }),
    });
    locationAId = (await loc.json()).data.id;

    console.log('  Masters and test companies initialized successfully.\n');

    // -------------------------------------------------------------
    // Create 3 Challans for navigation and listing tests
    // -------------------------------------------------------------
    console.log('[Test Setup] Creating 3 baseline challans for testing...');

    // Challan 1: Date 2025-05-01, No: 1001
    const c1Res = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '1001',
        challanDate: '2025-05-01T00:00:00.000Z',
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-A1',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 31.0 },
          { cartonNumber: '2', cartonWeight: 1.0, cops: 24, grossWeight: 31.5 },
        ],
      }),
    });
    const c1Data: any = await c1Res.json();
    challan1Id = c1Data.data.id;
    assert(c1Res.status === 201, 'Baseline Challan 1 created (HTTP 201)');

    // Challan 2: Date 2025-05-02, No: 1002
    const c2Res = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '1002',
        challanDate: '2025-05-02T00:00:00.000Z',
        partyId: partyA2Id,
        machineId: machineA2Id,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-B2',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '3', cartonWeight: 1.0, cops: 24, grossWeight: 30.5 },
        ],
      }),
    });
    const c2Data: any = await c2Res.json();
    challan2Id = c2Data.data.id;
    assert(c2Res.status === 201, 'Baseline Challan 2 created (HTTP 201)');

    // Challan 3: Date 2025-05-03, No: 1003
    const c3Res = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '1003',
        challanDate: '2025-05-03T00:00:00.000Z',
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-A1',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '4', cartonWeight: 1.0, cops: 24, grossWeight: 32.0 },
        ],
      }),
    });
    const c3Data: any = await c3Res.json();
    challan3Id = c3Data.data.id;
    assert(c3Res.status === 201, 'Baseline Challan 3 created (HTTP 201)\n');

    // -------------------------------------------------------------
    // [1-7] Testing Production Register & Filtering
    // -------------------------------------------------------------
    console.log('[Part 1] Testing Production Register listing & filters...');

    // 1. List production challans
    const listRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const listData: any = await listRes.json();
    assert(listRes.status === 200, '1. List production challans returned HTTP 200');
    assert(listData.total === 3, '1. List returns total count 3');
    assert(Array.isArray(listData.data) && listData.data.length === 3, '1. Data array contains 3 challans');

    // 2. Search by challan number
    const searchChallanRes = await fetch(`${API_BASE}/manufacturing/production-receive?challanNumber=1002`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const searchChallanData: any = await searchChallanRes.json();
    assert(searchChallanData.total === 1, '2. Search by challan number 1002 returns 1 record');
    assert(searchChallanData.data[0].challanNumber === '1002', '2. Returned challan number is 1002');

    // 3. Search by party (Beta Fabrics)
    const searchPartyRes = await fetch(`${API_BASE}/manufacturing/production-receive?search=Beta`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const searchPartyData: any = await searchPartyRes.json();
    assert(searchPartyData.total === 1, '3. Search by party "Beta" returns 1 record');
    assert(searchPartyData.data[0].party.partyName === 'Beta Fabrics', '3. Matched party is Beta Fabrics');

    // 4. Search by lot number (LOT-A1)
    const searchLotRes = await fetch(`${API_BASE}/manufacturing/production-receive?lotNumber=LOT-A1`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const searchLotData: any = await searchLotRes.json();
    assert(searchLotData.total === 2, '4. Search by lot number LOT-A1 returns 2 records');

    // 5. Filter by date range (2025-05-01 to 2025-05-02)
    const dateRangeRes = await fetch(
      `${API_BASE}/manufacturing/production-receive?fromDate=2025-05-01T00:00:00.000Z&toDate=2025-05-02T23:59:59.999Z`,
      { headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId } }
    );
    const dateRangeData: any = await dateRangeRes.json();
    assert(dateRangeData.total === 2, '5. Filter by date range returns 2 records');

    // 6. Filter by status (CONFIRMED)
    const statusRes = await fetch(`${API_BASE}/manufacturing/production-receive?status=CONFIRMED`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const statusData: any = await statusRes.json();
    assert(statusData.total === 3, '6. Filter by status CONFIRMED returns 3 records');

    // 7. Pagination (limit=2, page=1 and page=2)
    const page1Res = await fetch(`${API_BASE}/manufacturing/production-receive?page=1&limit=2`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const page1Data: any = await page1Res.json();
    assert(page1Data.data.length === 2, '7. Page 1 returns 2 records');
    assert(page1Data.totalPages === 2, '7. Total pages is 2');

    const page2Res = await fetch(`${API_BASE}/manufacturing/production-receive?page=2&limit=2`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const page2Data: any = await page2Res.json();
    assert(page2Data.data.length === 1, '7. Page 2 returns 1 remaining record');

    // 8. Fetch full challan details (GET /:id)
    const detailRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan1Id}`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const detailData: any = await detailRes.json();
    assert(detailRes.status === 200, '8. Fetch full challan details returned HTTP 200');
    assert(detailData.data.challanNumber === '1001', '8. Detail challan number is 1001');
    assert(detailData.data.items.length === 2, '8. Detail items count is 2\n');

    // -------------------------------------------------------------
    // [9-14] Testing Editing Existing Production Challan
    // -------------------------------------------------------------
    console.log('[Part 2] Testing Challan Editing (Header, Cartons, Weight Recalculation)...');

    // 9. Edit header details (change lotNumber to LOT-EDITED, machine to machineA2Id)
    // 10. Edit carton details (modify carton 1 gross weight to 32.500)
    // 11. Add carton to existing challan (carton 99)
    // 12. Remove carton from existing challan (remove carton 2)
    // 13. Recalculate weights after editing
    // 14. Recalculate totals
    const editRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        lotNumber: 'LOT-EDITED',
        machineId: machineA2Id,
        items: [
          // Updated Carton 1: gross 32.500 kg (tare = 1.0 + 24*0.04 = 1.960; net = 30.540; avg = 1.273)
          { cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 32.500 },
          // New Carton 99: gross 35.000 kg (tare = 1.0 + 24*0.04 = 1.960; net = 33.040; avg = 1.377)
          { cartonNumber: '99', cartonWeight: 1.0, cops: 24, grossWeight: 35.000 },
        ],
      }),
    });
    const editData: any = await editRes.json();
    assert(editRes.status === 200, '9-14. PATCH challan returned HTTP 200');
    assert(editData.data.lotNumber === 'LOT-EDITED', '9. Header lotNumber successfully updated');
    assert(editData.data.machineId === machineA2Id, '9. Header machineId successfully updated');
    assert(editData.data.items.length === 2, '11-12. Carton items count updated to 2 (1 removed, 1 added)');

    // Verify Carton 1 updated values
    const c1Item = editData.data.items.find((i: any) => i.cartonNumber === '1');
    assert(parseFloat(c1Item.grossWeight) === 32.5, '10. Carton 1 gross weight updated to 32.500');
    assert(parseFloat(c1Item.tareWeight) === 1.96, '13. Carton 1 tare weight recalculated to 1.960');
    assert(parseFloat(c1Item.netWeight) === 30.54, '13. Carton 1 net weight recalculated to 30.540');
    assert(parseFloat(c1Item.averageWeight) === 1.273, '13. Carton 1 average weight recalculated to 1.273');

    // Verify Totals recalculated
    assert(editData.totals.totalCartons === 2, '14. Total cartons recalculated to 2');
    assert(editData.totals.totalCops === 48, '14. Total cops recalculated to 48');
    assert(parseFloat(editData.totals.totalGrossWeight) === 67.5, '14. Total gross weight recalculated to 67.500');
    assert(parseFloat(editData.totals.totalNetWeight) === 63.58, '14. Total net weight recalculated to 63.580\n');

    // -------------------------------------------------------------
    // [15-19] Testing Security & Validation Rejections on Edit
    // -------------------------------------------------------------
    console.log('[Part 3] Testing Edit Validation and Boundary Protections...');

    // 15. Reject editing a locked financial year
    const editLockedRes = await fetch(`${API_BASE}/manufacturing/production-receive/${lockedChallanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyALockedId },
      body: JSON.stringify({
        items: [{ cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 30.0 }],
      }),
    });
    assert(editLockedRes.status === 403, '15. Reject editing a locked financial year returned HTTP 403 Forbidden');

    // 16. Reject editing a cancelled challan (tested after cancellation below)

    // 17. Reject cross-company access (Company B tries to edit Company A challan)
    const crossCompanyEditRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyBId, 'x-financial-year-id': fyBId },
      body: JSON.stringify({
        items: [{ cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 30.0 }],
      }),
    });
    assert(crossCompanyEditRes.status === 404, '17. Reject cross-company edit returned HTTP 404');

    // 18. Reject cross-financial-year access (Challan 1 has FY 2025-26, but header sends locked FY ID)
    const crossFyEditRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyALockedId },
      body: JSON.stringify({
        items: [{ cartonNumber: '1', cartonWeight: 1.0, cops: 24, grossWeight: 30.0 }],
      }),
    });
    assert(crossFyEditRes.status === 400, '18. Reject cross-financial-year edit returned HTTP 400');

    // 19. Reject duplicate carton numbers during edit
    const duplicateCartonEditRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan1Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        items: [
          { cartonNumber: '10', cartonWeight: 1.0, cops: 24, grossWeight: 30.0 },
          { cartonNumber: '10', cartonWeight: 1.0, cops: 24, grossWeight: 31.0 },
        ],
      }),
    });
    assert(duplicateCartonEditRes.status === 400, '19. Reject duplicate carton numbers on edit returned HTTP 400\n');

    // -------------------------------------------------------------
    // [20-22] Testing Safe Cancellation & History Preservation
    // -------------------------------------------------------------
    console.log('[Part 4] Testing Challan Cancellation & Carton Preservation...');

    // 20. Cancel challan with a reason
    const cancelRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan2Id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({ cancellationReason: 'Defective cop batch received from twister' }),
    });
    const cancelData: any = await cancelRes.json();
    assert(cancelRes.status === 200, '20. Cancel challan returned HTTP 200');
    assert(cancelData.data.status === 'CANCELLED', '20. Status updated to CANCELLED');
    assert(
      cancelData.data.cancellationReason === 'Defective cop batch received from twister',
      '20. Cancellation reason stored accurately'
    );
    assert(cancelData.data.cancelledAt !== null, '20. Cancellation timestamp recorded');

    // 16. Reject editing a cancelled challan
    const editCancelledRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan2Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        items: [{ cartonNumber: '3', cartonWeight: 1.0, cops: 24, grossWeight: 35.0 }],
      }),
    });
    assert(editCancelledRes.status === 400, '16. Reject editing a cancelled challan returned HTTP 400');

    // 21. Preserve carton history after cancellation
    const cancelledDetailRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan2Id}`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const cancelledDetailData: any = await cancelledDetailRes.json();
    assert(cancelledDetailData.data.items.length === 1, '21. Carton records preserved after cancellation');
    assert(cancelledDetailData.data.items[0].cartonNumber === '3', '21. Preserved carton number matches');

    // 22. Prevent permanent deletion (No DELETE endpoint exists; RESTRICT cascade prevents orphaned deletion)
    const deleteCheck = await prisma.productionReceive.findUnique({ where: { id: challan2Id } });
    assert(deleteCheck !== null, '22. Challan record exists in DB (not permanently deleted)\n');

    // -------------------------------------------------------------
    // [23-25] Testing Previous / Next Deterministic Navigation
    // -------------------------------------------------------------
    console.log('[Part 5] Testing Deterministic Prev / Next Navigation...');

    // Navigation for Challan 2 (middle record between Challan 1 and Challan 3)
    const nav2Res = await fetch(
      `${API_BASE}/manufacturing/production-receive/${challan2Id}/navigation?productionBookId=${bookAId}`,
      { headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId } }
    );
    const nav2Data: any = await nav2Res.json();
    assert(nav2Res.status === 200, '23-24. Navigation returned HTTP 200');
    assert(nav2Data.data.prevId === challan1Id, '23. Previous of Challan 2 is Challan 1');
    assert(nav2Data.data.nextId === challan3Id, '24. Next of Challan 2 is Challan 3');

    // 25. Boundary condition: First record (Challan 1) has no Prev
    const nav1Res = await fetch(
      `${API_BASE}/manufacturing/production-receive/${challan1Id}/navigation?productionBookId=${bookAId}`,
      { headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId } }
    );
    const nav1Data: any = await nav1Res.json();
    assert(nav1Data.data.prevId === null, '25. Boundary: First record has prevId = null');
    assert(nav1Data.data.nextId === challan2Id, '25. First record nextId = Challan 2');

    // 25. Boundary condition: Last record (Challan 3) has no Next
    const nav3Res = await fetch(
      `${API_BASE}/manufacturing/production-receive/${challan3Id}/navigation?productionBookId=${bookAId}`,
      { headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId } }
    );
    const nav3Data: any = await nav3Res.json();
    assert(nav3Data.data.prevId === challan2Id, '25. Last record prevId = Challan 2');
    assert(nav3Data.data.nextId === null, '25. Boundary: Last record has nextId = null\n');

    // -------------------------------------------------------------
    // [26-28] Concurrency, Conflict Protection, and Phase 7 Regression
    // -------------------------------------------------------------
    console.log('[Part 6] Testing Concurrency & Phase 7 Regression...');

    // 26. Simultaneous update conflict detection (duplicate challan number update conflict)
    const conflictUpdateRes = await fetch(`${API_BASE}/manufacturing/production-receive/${challan3Id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        challanNumber: '1001', // already used by Challan 1
        items: [{ cartonNumber: '4', cartonWeight: 1.0, cops: 24, grossWeight: 32.0 }],
      }),
    });
    assert(conflictUpdateRes.status === 409, '26. Duplicate challan number update rejected with HTTP 409 Conflict');

    // 27. Challan numbering concurrency: next-number continues to give strictly higher numbers
    const nextNumRes = await fetch(
      `${API_BASE}/manufacturing/production-receive/next-number?productionBookId=${bookAId}`,
      { headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId } }
    );
    const nextNumData: any = await nextNumRes.json();
    assert(nextNumRes.status === 200, '27. Next number endpoint returned HTTP 200');
    assert(parseInt(nextNumData.data.nextChallanNumber, 10) > 1003, '27. Next challan number is safely higher than 1003');

    // 28. Previous Phase 7 saving still works cleanly
    const p7SaveRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: nextNumData.data.nextChallanNumber,
        challanDate: '2025-06-15T00:00:00.000Z',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '500', cartonWeight: 1.2, cops: 24, grossWeight: 33.160 },
        ],
      }),
    });
    const p7SaveData: any = await p7SaveRes.json();
    assert(p7SaveRes.status === 201, '28. Phase 7 creation flow works cleanly (HTTP 201)');
    assert(p7SaveData.data.items[0].netWeight !== null, '28. Authoritative weight formulas computed on save');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 8 TESTS PASSED (${passed}/${total})                `);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Phase 8 Test Failure:', err);
    process.exit(1);
  } finally {
    console.log('[Cleanup] Removing Phase 8 temporary test records...');
    try {
      await prisma.productionReceiveItem.deleteMany({
        where: {
          productionReceive: {
            company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
          },
        },
      });
      await prisma.productionReceive.deleteMany({
        where: {
          company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
        },
      });
      await prisma.productionBook.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.party.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.machine.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.operator.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.yarnQuality.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.yarnGrade.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.location.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.financialYear.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } } },
      });
      await prisma.company.deleteMany({
        where: { companyCode: { in: ['SHIVAM_P8', 'AUX_P8'] } },
      });
      console.log('  PASS: Database cleaned up cleanly.\n');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runPhase8Tests();
