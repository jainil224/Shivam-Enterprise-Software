import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api';
const prisma = new PrismaClient();

let companyAId = '';
let companyBId = '';
let fy2526Id = '';
let fy2627Id = '';

async function runPhase3Tests() {
  console.log('================================================================');
  console.log('       PHASE 3: COMPANY MANAGEMENT MODULE API & FLOW TEST       ');
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
    // 1. Create Company
    // -------------------------------------------------------------
    console.log('[Test 1] Creating new company via POST /api/companies...');
    const createRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_P3',
        companyName: 'Shivam Enterprise Textiles Phase3',
        gstin: '24AAAAA0000A1Z5',
        panNumber: 'AAAAA0000A',
        address: 'Plot 42, GIDC Pandesara',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '394221',
        phone: '9825123456',
        email: 'contact@shivamtextiles.com',
      }),
    });
    const createData: any = await createRes.json();

    assert(createRes.status === 201, 'Status 201 Created returned');
    assert(createData.success === true, 'Response body success is true');
    assert(createData.data.companyCode === 'SHIVAM_P3', 'Company code uppercase match');
    companyAId = createData.data.id;
    console.log(`        Company ID: ${companyAId}`);

    // -------------------------------------------------------------
    // 2. Duplicate Company Code Rejection
    // -------------------------------------------------------------
    console.log('\n[Test 2] Verifying duplicate company code rejection (HTTP 409)...');
    const dupRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_P3',
        companyName: 'Duplicate Code Attempt',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate companyCode correctly rejected with 409 Conflict');

    // -------------------------------------------------------------
    // 3. Validation: Invalid GSTIN & PAN
    // -------------------------------------------------------------
    console.log('\n[Test 3] Verifying format validation for GSTIN and PAN (HTTP 400)...');
    const badGstinRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'INVALID_TAX',
        companyName: 'Invalid Tax Org',
        gstin: 'INVALID_GSTIN_123',
      }),
    });
    assert(badGstinRes.status === 400, 'Invalid GSTIN format rejected with HTTP 400 Bad Request');

    const badPanRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'INVALID_PAN',
        companyName: 'Invalid PAN Org',
        panNumber: '123BADPAN!',
      }),
    });
    assert(badPanRes.status === 400, 'Invalid PAN format rejected with HTTP 400 Bad Request');

    // -------------------------------------------------------------
    // 4. List Companies & Search
    // -------------------------------------------------------------
    console.log('\n[Test 4] Verifying GET /api/companies and query search filter...');
    const listRes = await fetch(`${API_BASE}/companies`);
    const listData: any = await listRes.json();
    assert(listRes.status === 200, 'GET /api/companies returned 200 OK');
    assert(Array.isArray(listData.data), 'Companies returned as array');
    assert(listData.data.some((c: any) => c.id === companyAId), 'Created company is present in list');

    const searchRes = await fetch(`${API_BASE}/companies?search=SHIVAM_P3`);
    const searchData: any = await searchRes.json();
    assert(searchData.data.length === 1, 'Search query by code returned exact match');
    assert(searchData.data[0].id === companyAId, 'Search result matches target company');

    // -------------------------------------------------------------
    // 5. Update Company Details
    // -------------------------------------------------------------
    console.log('\n[Test 5] Updating company details via PATCH /api/companies/:id...');
    const updateRes = await fetch(`${API_BASE}/companies/${companyAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: 'Navsari',
        email: 'updated@shivamtextiles.com',
      }),
    });
    const updateData: any = await updateRes.json();
    assert(updateRes.status === 200, 'PATCH /api/companies/:id returned 200 OK');
    assert(updateData.data.city === 'Navsari', 'Updated city is Navsari');
    assert(updateData.data.email === 'updated@shivamtextiles.com', 'Updated email persists');

    // -------------------------------------------------------------
    // 6. Create Financial Year
    // -------------------------------------------------------------
    console.log('\n[Test 6] Creating Financial Year 2025-2026 for Company...');
    const fyRes = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: true,
      }),
    });
    const fyData: any = await fyRes.json();
    assert(fyRes.status === 201, 'Status 201 Created for financial year');
    assert(fyData.data.yearName === '2025-2026', 'FY yearName match');
    fy2526Id = fyData.data.id;
    console.log(`        FY ID: ${fy2526Id}`);

    // -------------------------------------------------------------
    // 7. Duplicate FY Name Rejection
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying duplicate FY name rejection for same company (HTTP 409)...');
    const dupFyRes = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
      }),
    });
    assert(dupFyRes.status === 409, 'Duplicate FY name rejected with 409 Conflict');

    // -------------------------------------------------------------
    // 8. Overlapping FY Dates Rejection
    // -------------------------------------------------------------
    console.log('\n[Test 8] Verifying overlapping financial year date ranges rejection (HTTP 409)...');
    const overlapRes = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026-OVERLAP',
        startDate: '2025-08-01',
        endDate: '2026-07-31',
      }),
    });
    assert(overlapRes.status === 409, 'Overlapping dates blocked by database trigger with 409 Conflict');

    // -------------------------------------------------------------
    // 9. Consecutive Financial Year
    // -------------------------------------------------------------
    console.log('\n[Test 9] Creating consecutive Financial Year 2026-2027...');
    const fy2Res = await fetch(`${API_BASE}/companies/${companyAId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        isActive: true,
      }),
    });
    const fy2Data: any = await fy2Res.json();
    assert(fy2Res.status === 201, 'Consecutive FY 2026-2027 created successfully');
    fy2627Id = fy2Data.data.id;

    // -------------------------------------------------------------
    // 10. Independent FY across different companies
    // -------------------------------------------------------------
    console.log('\n[Test 10] Verifying independent financial years across different companies...');
    const compBRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'AUX_P3',
        companyName: 'Auxiliary Enterprise Phase3',
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
      }),
    });
    assert(fyBRes.status === 201, 'Company B successfully created FY 2025-2026 with exact same dates (isolated)');
    const fyBData: any = await fyBRes.json();

    // -------------------------------------------------------------
    // 11. Lock & Unlock Financial Year
    // -------------------------------------------------------------
    console.log('\n[Test 11] Verifying lock and unlock operations on Financial Year...');
    const lockRes = await fetch(`${API_BASE}/financial-years/${fy2526Id}/lock`, { method: 'PATCH' });
    const lockData: any = await lockRes.json();
    assert(lockRes.status === 200, 'Lock FY returned 200 OK');
    assert(lockData.data.isLocked === true, 'FY isLocked is true');

    const unlockRes = await fetch(`${API_BASE}/financial-years/${fy2526Id}/unlock`, { method: 'PATCH' });
    const unlockData: any = await unlockRes.json();
    assert(unlockRes.status === 200, 'Unlock FY returned 200 OK');
    assert(unlockData.data.isLocked === false, 'FY isLocked is false');

    // -------------------------------------------------------------
    // 12. Validate Session Context (Server-Side)
    // -------------------------------------------------------------
    console.log('\n[Test 12] Verifying server-side context validation endpoint...');
    const valRes = await fetch(`${API_BASE}/companies/validate-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyAId,
        financialYearId: fy2526Id,
      }),
    });
    const valData: any = await valRes.json();
    assert(valRes.status === 200, 'Valid context returns 200 OK');
    assert(valData.data.company.id === companyAId, 'Validated company ID matches');
    assert(valData.data.financialYear.id === fy2526Id, 'Validated FY ID matches');

    // Cross-company mismatched FY check
    const mismatchRes = await fetch(`${API_BASE}/companies/validate-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyAId,
        financialYearId: fyBData.data.id, // Belongs to Company B!
      }),
    });
    assert(mismatchRes.status === 400, 'Mismatched Company/FY pair correctly rejected (HTTP 400)');

    // -------------------------------------------------------------
    // 13. Company Deactivation (Safe Soft-Delete)
    // -------------------------------------------------------------
    console.log('\n[Test 13] Verifying company deactivation (soft-delete preservation)...');
    const deactRes = await fetch(`${API_BASE}/companies/${companyBId}/deactivate`, { method: 'PATCH' });
    const deactData: any = await deactRes.json();
    assert(deactRes.status === 200, 'Deactivate returned 200 OK');
    assert(deactData.data.isActive === false, 'Company isActive is false');

    // Verify company is omitted from active list by default
    const activeListRes = await fetch(`${API_BASE}/companies`);
    const activeListData: any = await activeListRes.json();
    assert(!activeListData.data.some((c: any) => c.id === companyBId), 'Inactive company excluded from active list');

    // Verify included when includeInactive=true
    const fullListRes = await fetch(`${API_BASE}/companies?includeInactive=true`);
    const fullListData: any = await fullListRes.json();
    assert(fullListData.data.some((c: any) => c.id === companyBId), 'Inactive company present when requested');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 3 API & INTEGRATION TESTS PASSED (${passed}/${total})       `);
    console.log('================================================================\n');
  } finally {
    console.log('[Cleanup] Removing Phase 3 temporary test records from DB...');
    try {
      if (companyAId) {
        await prisma.financialYear.deleteMany({ where: { companyId: companyAId } });
        await prisma.company.delete({ where: { id: companyAId } });
      }
      if (companyBId) {
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

runPhase3Tests().catch((err) => {
  console.error('Phase 3 Test Failure:', err);
  process.exit(1);
});
