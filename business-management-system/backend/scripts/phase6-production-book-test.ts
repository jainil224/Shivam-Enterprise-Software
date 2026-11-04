/**
 * Phase 6: Production Book Selection — API & Navigation Integration Test
 * Tests the production books endpoint as used by the Book Selection page.
 */
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api';
const prisma = new PrismaClient();

let companyId = '';
let fyId = '';
let activeBookId = '';
let inactiveBookId = '';
let companyBId = '';
let fyBId = '';

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('  PHASE 6: PRODUCTION BOOK SELECTION — API INTEGRATION TEST     ');
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
    // ── Setup ─────────────────────────────────────────────────────────────────
    console.log('[Setup] Creating test company and financial year...');
    const compRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_P6',
        companyName: 'Shivam Enterprise Phase 6 Test Ltd',
      }),
    });
    const compData: any = await compRes.json();
    companyId = compData.data.id;

    const fyRes = await fetch(`${API_BASE}/companies/${companyId}/financial-years`, {
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
    fyId = fyData.data.id;

    // Second company for cross-company isolation test
    const compBRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'AUX_P6',
        companyName: 'Auxiliary Enterprise Phase 6 Test Ltd',
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

    console.log(`  Company A ID: ${companyId} (FY: ${fyId})`);
    console.log(`  Company B ID: ${companyBId} (FY: ${fyBId})\n`);

    // ── Test 1: Create production books ───────────────────────────────────────
    console.log('[1] Creating two production books (one active, one inactive)...');
    const bookRes1 = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyId,
        'x-financial-year-id': fyId,
      },
      body: JSON.stringify({
        financialYearId: fyId,
        prefix: 'PR-25',
        bookName: 'Main Production Receive Book',
        openingBalance: 1500.750,
      }),
    });
    const book1Data: any = await bookRes1.json();
    assert(bookRes1.status === 201, 'Active production book created (201)');
    activeBookId = book1Data.data.id;
    assert(book1Data.data.prefix === 'PR-25', 'Book prefix is PR-25');
    assert(Number(book1Data.data.openingBalance) === 1500.75, 'Opening balance is 1500.750');

    const bookRes2 = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyId,
        'x-financial-year-id': fyId,
      },
      body: JSON.stringify({
        financialYearId: fyId,
        prefix: 'AR-25',
        bookName: 'Archive Production Book',
        openingBalance: 0,
      }),
    });
    const book2Data: any = await bookRes2.json();
    assert(bookRes2.status === 201, 'Second production book created');
    inactiveBookId = book2Data.data.id;

    // Deactivate the second book
    const deactRes = await fetch(`${API_BASE}/masters/production-books/${inactiveBookId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyId,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const deactData: any = await deactRes.json();
    assert(deactRes.status === 200, 'Book deactivated (200)');
    assert(deactData.data.isActive === false, 'Book is now inactive');

    // ── Test 2: Load all books (default = active only) ────────────────────────
    console.log('\n[2] Testing default book list (active only)...');
    const listRes = await fetch(`${API_BASE}/masters/production-books`, {
      headers: {
        'x-company-id': companyId,
        'x-financial-year-id': fyId,
      },
    });
    const listData: any = await listRes.json();
    assert(listRes.status === 200, 'GET production-books returned 200');
    assert(listData.data.every((b: any) => b.isActive), 'Default list contains only active books');
    assert(listData.data.some((b: any) => b.id === activeBookId), 'Active book is present');
    assert(!listData.data.some((b: any) => b.id === inactiveBookId), 'Inactive book excluded from default list');

    // ── Test 3: Load all books with includeInactive=true ──────────────────────
    console.log('\n[3] Testing includeInactive=true flag...');
    const allRes = await fetch(`${API_BASE}/masters/production-books?includeInactive=true`, {
      headers: {
        'x-company-id': companyId,
        'x-financial-year-id': fyId,
      },
    });
    const allData: any = await allRes.json();
    assert(allRes.status === 200, 'GET with includeInactive=true returned 200');
    assert(allData.data.some((b: any) => b.id === inactiveBookId), 'Inactive book present with includeInactive=true');
    assert(allData.data.length >= 2, 'At least 2 books returned');

    // ── Test 4: Search by prefix ──────────────────────────────────────────────
    console.log('\n[4] Testing search by prefix (PR-25)...');
    const searchPrefixRes = await fetch(`${API_BASE}/masters/production-books?search=PR-25&includeInactive=true`, {
      headers: { 'x-company-id': companyId, 'x-financial-year-id': fyId },
    });
    const searchPrefixData: any = await searchPrefixRes.json();
    assert(searchPrefixRes.status === 200, 'Prefix search returned 200');
    assert(searchPrefixData.data.some((b: any) => b.prefix === 'PR-25'), 'PR-25 found by prefix search');
    assert(!searchPrefixData.data.some((b: any) => b.prefix === 'AR-25'), 'AR-25 excluded from PR-25 search');

    // ── Test 5: Search by book name ───────────────────────────────────────────
    console.log('\n[5] Testing search by book name...');
    const searchNameRes = await fetch(
      `${API_BASE}/masters/production-books?search=Main+Production&includeInactive=true`,
      { headers: { 'x-company-id': companyId, 'x-financial-year-id': fyId } }
    );
    const searchNameData: any = await searchNameRes.json();
    assert(searchNameRes.status === 200, 'Name search returned 200');
    assert(
      searchNameData.data.some((b: any) => b.bookName === 'Main Production Receive Book'),
      'Main Production Receive Book found by name search'
    );

    // ── Test 6: Cross-company isolation ──────────────────────────────────────
    console.log('\n[6] Testing cross-company isolation...');

    // Create a book in Company B with same prefix
    await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyBId,
        'x-financial-year-id': fyBId,
      },
      body: JSON.stringify({
        financialYearId: fyBId,
        prefix: 'PR-25',
        bookName: 'Company B Production Book',
        openingBalance: 999.000,
      }),
    });

    // Company A should NOT see Company B's books
    const compAListRes = await fetch(`${API_BASE}/masters/production-books?includeInactive=true`, {
      headers: { 'x-company-id': companyId, 'x-financial-year-id': fyId },
    });
    const compAListData: any = await compAListRes.json();
    assert(
      compAListData.data.every((b: any) => b.companyId === companyId),
      'Company A books do not include Company B records'
    );

    // Company B should NOT see Company A's books
    const compBListRes = await fetch(`${API_BASE}/masters/production-books?includeInactive=true`, {
      headers: { 'x-company-id': companyBId, 'x-financial-year-id': fyBId },
    });
    const compBListData: any = await compBListRes.json();
    assert(
      compBListData.data.every((b: any) => b.companyId === companyBId),
      'Company B books do not include Company A records'
    );

    // ── Test 7: Backend book verification flow (simulates SelectBook action) ──
    console.log('\n[7] Simulating backend book verification (select by ID re-fetch)...');

    // Active book should be findable via the active-only list
    const verifyRes = await fetch(`${API_BASE}/masters/production-books`, {
      headers: { 'x-company-id': companyId, 'x-financial-year-id': fyId },
    });
    const verifyData: any = await verifyRes.json();
    const foundActive = verifyData.data.find((b: any) => b.id === activeBookId);
    assert(Boolean(foundActive), 'Active book verified via API re-fetch');
    assert(foundActive.isActive === true, 'Verified book is confirmed active');
    assert(foundActive.companyId === companyId, 'Verified book belongs to correct company');
    assert(foundActive.financialYearId === fyId, 'Verified book belongs to correct financial year');

    // Inactive book should NOT appear in active-only list
    const inactiveVerifyRes = await fetch(`${API_BASE}/masters/production-books`, {
      headers: { 'x-company-id': companyId, 'x-financial-year-id': fyId },
    });
    const inactiveVerifyData: any = await inactiveVerifyRes.json();
    const foundInactive = inactiveVerifyData.data.find((b: any) => b.id === inactiveBookId);
    assert(!foundInactive, 'Inactive book cannot be selected (not in active list)');

    // ── Test 8: No books = empty state ────────────────────────────────────────
    console.log('\n[8] Testing empty state for a company with no books...');

    // Create a fresh company with no books
    const emptyCompRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyCode: 'EMPTY_P6', companyName: 'Empty Company P6 Test' }),
    });
    const emptyCompData: any = await emptyCompRes.json();
    const emptyCompId = emptyCompData.data.id;

    const emptyFyRes = await fetch(`${API_BASE}/companies/${emptyCompId}/financial-years`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yearName: '2025-2026',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        isActive: true,
      }),
    });
    const emptyFyData: any = await emptyFyRes.json();
    const emptyFyId = emptyFyData.data.id;

    const emptyListRes = await fetch(`${API_BASE}/masters/production-books`, {
      headers: { 'x-company-id': emptyCompId, 'x-financial-year-id': emptyFyId },
    });
    const emptyListData: any = await emptyListRes.json();
    assert(emptyListRes.status === 200, 'Empty list returns 200 (not error)');
    assert(emptyListData.data.length === 0, 'Empty list returns 0 books');

    // Cleanup empty company
    await prisma.financialYear.deleteMany({ where: { companyId: emptyCompId } });
    await prisma.company.delete({ where: { id: emptyCompId } });

    // ── Test 9: Missing company header = 400 ──────────────────────────────────
    console.log('\n[9] Testing missing company context rejection...');
    const noCtxRes = await fetch(`${API_BASE}/masters/production-books`, {});
    assert(noCtxRes.status === 400, 'Missing company header returns HTTP 400');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 6 PRODUCTION BOOK SELECTION TESTS PASSED (${passed}/${total})`);
    console.log('================================================================\n');
  } finally {
    console.log('[Cleanup] Removing Phase 6 temporary test records...');
    try {
      if (companyId) {
        await prisma.productionBook.deleteMany({ where: { companyId } });
        await prisma.financialYear.deleteMany({ where: { companyId } });
        await prisma.company.delete({ where: { id: companyId } });
      }
      if (companyBId) {
        await prisma.productionBook.deleteMany({ where: { companyId: companyBId } });
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

runPhase6Tests().catch((err) => {
  console.error('Phase 6 Test Failure:', err);
  process.exit(1);
});

