import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api';
const prisma = new PrismaClient();

let companyAId = '';
let companyBId = '';
let fyAId = '';
let fyBId = '';

let party1Id = '';
let party2Id = '';
let machine1Id = '';
let operator1Id = '';
let location1Id = '';
let quality1Id = '';
let grade1Id = '';
let book1Id = '';

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('       PHASE 5: MASTER MANAGEMENT MODULE API & FLOW TEST        ');
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
    // Setup Test Companies and Financial Years
    // -------------------------------------------------------------
    console.log('[Setup] Initializing test companies and financial years...');
    const compARes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'SHIVAM_M5',
        companyName: 'Shivam Enterprise Master Test Ltd',
      }),
    });
    const compAData: any = await compARes.json();
    companyAId = compAData.data.id;

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

    const compBRes = await fetch(`${API_BASE}/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyCode: 'AUX_M5',
        companyName: 'Auxiliary Enterprise Master Test Ltd',
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

    console.log(`  Company A ID: ${companyAId} (FY: ${fyAId})`);
    console.log(`  Company B ID: ${companyBId} (FY: ${fyBId})\n`);

    // -------------------------------------------------------------
    // 1. Party Master: Create Party
    // -------------------------------------------------------------
    console.log('[1. Party] Testing party creation (POST /api/masters/parties)...');
    const partyRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        partyCode: 'CUST-001',
        partyName: 'Rajesh Fabrics Pvt Ltd',
        partyType: 'CUSTOMER',
        gstin: '24AAAAA0000A1Z5',
        panNumber: 'AAAAA0000A',
        address: 'Plot 401, Pandesara GIDC',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '394221',
        phone: '9825123456',
        email: 'rajesh@fabrics.com',
        openingBalance: 150000.50,
        balanceType: 'DEBIT',
      }),
    });
    const partyData: any = await partyRes.json();
    assert(partyRes.status === 201, 'Status 201 Created for Party');
    assert(partyData.data.partyCode === 'CUST-001', 'Party code uppercase match');
    assert(partyData.data.city === 'Surat', 'Party city saved');
    assert(partyData.data.partyType === 'CUSTOMER', 'Party type is CUSTOMER');
    party1Id = partyData.data.id;

    // Create a Supplier party
    const suppRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        partyCode: 'SUPP-001',
        partyName: 'Reliance Petrofils Supplier',
        partyType: 'SUPPLIER',
        openingBalance: 500000.00,
        balanceType: 'CREDIT',
      }),
    });
    const suppData: any = await suppRes.json();
    assert(suppRes.status === 201, 'Supplier party created');
    party2Id = suppData.data.id;

    // -------------------------------------------------------------
    // 2. Party Master: Edit Party
    // -------------------------------------------------------------
    console.log('\n[2. Party] Testing party update (PATCH /api/masters/parties/:id)...');
    const updatePartyRes = await fetch(`${API_BASE}/masters/parties/${party1Id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        city: 'Navsari',
        phone: '9825000111',
      }),
    });
    const updatePartyData: any = await updatePartyRes.json();
    assert(updatePartyRes.status === 200, 'Party updated with 200 OK');
    assert(updatePartyData.data.city === 'Navsari', 'Updated city is Navsari');
    assert(updatePartyData.data.phone === '9825000111', 'Updated phone is 9825000111');

    // -------------------------------------------------------------
    // 3. Party Master: Search Party
    // -------------------------------------------------------------
    console.log('\n[3. Party] Testing party search query...');
    const searchPartyRes = await fetch(`${API_BASE}/masters/parties?search=CUST-001`, {
      headers: { 'x-company-id': companyAId },
    });
    const searchPartyData: any = await searchPartyRes.json();
    assert(searchPartyRes.status === 200, 'Search returned 200 OK');
    assert(searchPartyData.data.length === 1, 'Exact search returned 1 record');
    assert(searchPartyData.data[0].id === party1Id, 'Search result matches target party');

    // -------------------------------------------------------------
    // 4. Party Master: Filter Customers and Suppliers
    // -------------------------------------------------------------
    console.log('\n[4. Party] Testing party type filtering (CUSTOMER vs SUPPLIER)...');
    const custFilterRes = await fetch(`${API_BASE}/masters/parties?partyType=CUSTOMER`, {
      headers: { 'x-company-id': companyAId },
    });
    const custFilterData: any = await custFilterRes.json();
    assert(custFilterData.data.every((p: any) => p.partyType === 'CUSTOMER'), 'All results are CUSTOMER');

    const suppFilterRes = await fetch(`${API_BASE}/masters/parties?partyType=SUPPLIER`, {
      headers: { 'x-company-id': companyAId },
    });
    const suppFilterData: any = await suppFilterRes.json();
    assert(suppFilterData.data.every((p: any) => p.partyType === 'SUPPLIER'), 'All results are SUPPLIER');

    // -------------------------------------------------------------
    // 5. Party Master: Duplicate Party Code Prevention
    // -------------------------------------------------------------
    console.log('\n[5. Party] Testing duplicate party code rejection (HTTP 409)...');
    const dupPartyRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        partyCode: 'CUST-001', // Duplicate in Company A
        partyName: 'Duplicate Attempt',
      }),
    });
    assert(dupPartyRes.status === 409, 'Duplicate party code rejected with HTTP 409 Conflict');

    // Cross-company test: same code in Company B should succeed!
    const compBPartyRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyBId,
      },
      body: JSON.stringify({
        partyCode: 'CUST-001', // Allowed in Company B
        partyName: 'Company B Customer 1',
      }),
    });
    assert(compBPartyRes.status === 201, 'Same party code in Company B allowed (Company isolation verified)');

    // -------------------------------------------------------------
    // 6. GSTIN and PAN Validation
    // -------------------------------------------------------------
    console.log('\n[6. Party] Testing invalid GSTIN and PAN validation (HTTP 400)...');
    const badGstinRes = await fetch(`${API_BASE}/masters/parties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        partyCode: 'BAD-GSTIN',
        partyName: 'Bad GSTIN Org',
        gstin: 'INVALID123',
      }),
    });
    assert(badGstinRes.status === 400, 'Invalid GSTIN format rejected with HTTP 400');

    // -------------------------------------------------------------
    // 7. Machine Master: Create Machine
    // -------------------------------------------------------------
    console.log('\n[7. Machine] Testing machine creation (POST /api/masters/machines)...');
    const machineRes = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        machineCode: 'TFO-01',
        machineName: 'Two-For-One Twister Machine 1',
        description: '256 Spindles, Line A, Make Himson',
      }),
    });
    const machineData: any = await machineRes.json();
    assert(machineRes.status === 201, 'Status 201 Created for Machine');
    assert(machineData.data.machineCode === 'TFO-01', 'Machine code match');
    machine1Id = machineData.data.id;

    // -------------------------------------------------------------
    // 8. Machine Master: Duplicate Code Prevention
    // -------------------------------------------------------------
    console.log('\n[8. Machine] Testing duplicate machine code rejection (HTTP 409)...');
    const dupMachineRes = await fetch(`${API_BASE}/masters/machines`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        machineCode: 'TFO-01',
        machineName: 'Duplicate Machine Attempt',
      }),
    });
    assert(dupMachineRes.status === 409, 'Duplicate machine code rejected with 409 Conflict');

    // -------------------------------------------------------------
    // 9. Operator Master: Create Operator
    // -------------------------------------------------------------
    console.log('\n[9. Operator] Testing operator creation (POST /api/masters/operators)...');
    const opRes = await fetch(`${API_BASE}/masters/operators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        operatorCode: 'OP-01',
        operatorName: 'Suresh Patel',
        phone: '9825123456',
      }),
    });
    const opData: any = await opRes.json();
    assert(opRes.status === 201, 'Status 201 Created for Operator');
    assert(opData.data.operatorCode === 'OP-01', 'Operator code match');
    operator1Id = opData.data.id;

    // -------------------------------------------------------------
    // 10. Location Master: Create Location
    // -------------------------------------------------------------
    console.log('\n[10. Location] Testing location creation (POST /api/masters/locations)...');
    const locRes = await fetch(`${API_BASE}/masters/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        locationName: 'Main Yarn Warehouse - Section A',
        description: 'Ground Floor, Capacity 500 Cartons',
      }),
    });
    const locData: any = await locRes.json();
    assert(locRes.status === 201, 'Status 201 Created for Location');
    assert(locData.data.locationName === 'Main Yarn Warehouse - Section A', 'Location name match');
    location1Id = locData.data.id;

    // -------------------------------------------------------------
    // 11. Yarn Quality Master: Create Quality
    // -------------------------------------------------------------
    console.log('\n[11. Yarn Quality] Testing yarn quality creation (POST /api/masters/yarn-qualities)...');
    const qualRes = await fetch(`${API_BASE}/masters/yarn-qualities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        qualityName: '80/72 Polyester DTY Texturised',
        denier: '80/72',
        description: 'Semi Dull, 80 TPM, High tenacity',
      }),
    });
    const qualData: any = await qualRes.json();
    assert(qualRes.status === 201, 'Status 201 Created for Yarn Quality');
    assert(qualData.data.qualityName === '80/72 Polyester DTY Texturised', 'Quality name match');
    quality1Id = qualData.data.id;

    // -------------------------------------------------------------
    // 12. Yarn Grade Master: Create Grade
    // -------------------------------------------------------------
    console.log('\n[12. Yarn Grade] Testing yarn grade creation (POST /api/masters/yarn-grades)...');
    const gradeRes = await fetch(`${API_BASE}/masters/yarn-grades`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({
        gradeName: 'A-Grade Fresh',
        description: 'Export quality prime lots',
      }),
    });
    const gradeData: any = await gradeRes.json();
    assert(gradeRes.status === 201, 'Status 201 Created for Yarn Grade');
    assert(gradeData.data.gradeName === 'A-Grade Fresh', 'Grade name match');
    grade1Id = gradeData.data.id;

    // -------------------------------------------------------------
    // 13. Production Book Master: Create Book
    // -------------------------------------------------------------
    console.log('\n[13. Production Book] Testing production book creation (POST /api/masters/production-books)...');
    const bookRes = await fetch(`${API_BASE}/masters/production-books`, {
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
        openingBalance: 1250.500,
      }),
    });
    const bookData: any = await bookRes.json();
    assert(bookRes.status === 201, 'Status 201 Created for Production Book');
    assert(bookData.data.prefix === 'PR-25', 'Book prefix match');
    book1Id = bookData.data.id;

    // -------------------------------------------------------------
    // 14. Production Book: Duplicate Prefix Prevention
    // -------------------------------------------------------------
    console.log('\n[14. Production Book] Testing duplicate book prefix rejection (HTTP 409)...');
    const dupBookRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
        'x-financial-year-id': fyAId,
      },
      body: JSON.stringify({
        financialYearId: fyAId,
        prefix: 'PR-25', // Duplicate in same FY
        bookName: 'Second Book Attempt',
      }),
    });
    assert(dupBookRes.status === 409, 'Duplicate book prefix rejected with HTTP 409 Conflict');

    // -------------------------------------------------------------
    // 15. Financial Year Isolation of Production Books
    // -------------------------------------------------------------
    console.log('\n[15. Production Book] Testing financial year isolation (same prefix in Company B allowed)...');
    const compBBookRes = await fetch(`${API_BASE}/masters/production-books`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyBId,
        'x-financial-year-id': fyBId,
      },
      body: JSON.stringify({
        financialYearId: fyBId,
        prefix: 'PR-25', // Same prefix in Company B FY
        bookName: 'Company B Production Book',
      }),
    });
    assert(compBBookRes.status === 201, 'Same prefix allowed in different company/FY (Isolation verified)');

    // -------------------------------------------------------------
    // 16. Company-Level Data Isolation
    // -------------------------------------------------------------
    console.log('\n[16. Isolation] Verifying cross-company record privacy...');
    const compAParties = await fetch(`${API_BASE}/masters/parties`, {
      headers: { 'x-company-id': companyAId },
    });
    const compAPartiesData: any = await compAParties.json();
    assert(!compAPartiesData.data.some((p: any) => p.partyName === 'Company B Customer 1'), 'Company B records not visible to Company A');

    // -------------------------------------------------------------
    // 17. Master Deactivation (Soft Status Toggle)
    // -------------------------------------------------------------
    console.log('\n[17. Status] Testing master deactivation (PATCH .../status)...');
    const deactRes = await fetch(`${API_BASE}/masters/parties/${party1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const deactData: any = await deactRes.json();
    assert(deactRes.status === 200, 'Party status patched with 200 OK');
    assert(deactData.data.isActive === false, 'Party is now inactive');

    // -------------------------------------------------------------
    // 18. Inactive Master Exclusion from Active Selection
    // -------------------------------------------------------------
    console.log('\n[18. Exclusion] Testing inactive record exclusion from default lists...');
    const activeList = await fetch(`${API_BASE}/masters/parties`, {
      headers: { 'x-company-id': companyAId },
    });
    const activeListData: any = await activeList.json();
    assert(!activeListData.data.some((p: any) => p.id === party1Id), 'Inactive party excluded from active query');

    const fullList = await fetch(`${API_BASE}/masters/parties?includeInactive=true`, {
      headers: { 'x-company-id': companyAId },
    });
    const fullListData: any = await fullList.json();
    assert(fullListData.data.some((p: any) => p.id === party1Id), 'Inactive party present when includeInactive=true');

    // Re-activate party1 for complete round-trip test
    await fetch(`${API_BASE}/masters/parties/${party1Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-company-id': companyAId,
      },
      body: JSON.stringify({ isActive: true }),
    });
    console.log('  PASS: Re-activated party successfully.');

    // -------------------------------------------------------------
    // 19. Protecting Referenced Records
    // -------------------------------------------------------------
    console.log('\n[19. Referential Integrity] Verifying transaction references protect master records...');
    // Create a temporary transaction referencing machine1Id
    const testChallan = await prisma.productionReceive.create({
      data: {
        companyId: companyAId,
        financialYearId: fyAId,
        productionBookId: book1Id,
        challanNumber: '1001',
        challanDate: new Date('2025-05-01'),
        partyId: party1Id,
        machineId: machine1Id,
        operatorId: operator1Id,
        yarnQualityId: quality1Id,
        yarnGradeId: grade1Id,
        locationId: location1Id,
      },
    });
    assert(Boolean(testChallan.id), 'Challan created referencing all masters');

    // Attempting to delete machine referenced by challan is blocked by foreign key RESTRICT
    try {
      await prisma.machine.delete({ where: { id: machine1Id } });
      assert(false, 'Expected foreign key delete restriction');
    } catch (e: any) {
      assert(e.code === 'P2003' || e.message.includes('foreign key constraint'), 'Direct deletion blocked by RESTRICT constraint');
    }

    // Cleanup challan
    await prisma.productionReceive.delete({ where: { id: testChallan.id } });
    console.log('  PASS: Test challan cleaned up cleanly.');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 5 MASTER MANAGEMENT TESTS PASSED (${passed}/${total})      `);
    console.log('================================================================\n');
  } finally {
    console.log('[Cleanup] Removing Phase 5 temporary test records from DB...');
    try {
      if (companyAId) {
        await prisma.productionReceive.deleteMany({ where: { companyId: companyAId } });
        await prisma.productionBook.deleteMany({ where: { companyId: companyAId } });
        await prisma.yarnGrade.deleteMany({ where: { companyId: companyAId } });
        await prisma.yarnQuality.deleteMany({ where: { companyId: companyAId } });
        await prisma.location.deleteMany({ where: { companyId: companyAId } });
        await prisma.operator.deleteMany({ where: { companyId: companyAId } });
        await prisma.machine.deleteMany({ where: { companyId: companyAId } });
        await prisma.party.deleteMany({ where: { companyId: companyAId } });
        await prisma.financialYear.deleteMany({ where: { companyId: companyAId } });
        await prisma.company.delete({ where: { id: companyAId } });
      }
      if (companyBId) {
        await prisma.productionReceive.deleteMany({ where: { companyId: companyBId } });
        await prisma.productionBook.deleteMany({ where: { companyId: companyBId } });
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

runPhase5Tests().catch((err) => {
  console.error('Phase 5 Test Failure:', err);
  process.exit(1);
});

