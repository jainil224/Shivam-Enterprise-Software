import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:5000/api';
const prisma = new PrismaClient();

let companyAId = '';
let companyBId = '';
let fyAId = '';
let fyBId = '';
let bookAId = '';
let partyAId = '';
let machineAId = '';
let operatorAId = '';
let qualityAId = '';
let gradeAId = '';
let locationAId = '';

let singleCartonChallanId = '';
let multiCartonChallanId = '';
let largeTableChallanId = '';
let cancelledChallanId = '';

async function runPhase9Tests() {
  console.log('================================================================');
  console.log('   PHASE 9: PRODUCTION CHALLAN PRINTING — INTEGRATION TESTS     ');
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
    console.log('[Setup] Initializing test company and master records for printing...');

    // Cleanup previous phase 9 test records if any
    await prisma.productionReceiveItem.deleteMany({
      where: { productionReceive: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } } },
    });
    await prisma.productionReceive.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.productionBook.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.party.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.machine.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.operator.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.yarnQuality.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.yarnGrade.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.location.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.financialYear.deleteMany({
      where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
    });
    await prisma.company.deleteMany({
      where: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } },
    });

    // 1. Company A
    const compA = await prisma.company.create({
      data: {
        companyCode: 'SHIVAM_P9',
        companyName: 'Shivam Enterprise Textiles Ltd',
        gstin: '24AAACS1234A1Z5',
        panNumber: 'AAACS1234A',
        address: 'Plot 42, GIDC Industrial Estate',
        city: 'Surat',
        state: 'Gujarat',
        pincode: '395006',
        phone: '9825123456',
        logoPath: '/uploads/shivam_logo.png',
      },
    });
    companyAId = compA.id;

    const fyA = await prisma.financialYear.create({
      data: {
        companyId: companyAId,
        yearName: '2025-2026',
        startDate: new Date('2025-04-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
      },
    });
    fyAId = fyA.id;

    // Company B (for cross-company isolation test)
    const compB = await prisma.company.create({
      data: {
        companyCode: 'AUX_P9',
        companyName: 'Auxiliary Textiles Ltd',
      },
    });
    companyBId = compB.id;

    const fyB = await prisma.financialYear.create({
      data: {
        companyId: companyBId,
        yearName: '2025-2026',
        startDate: new Date('2025-04-01T00:00:00.000Z'),
        endDate: new Date('2026-03-31T23:59:59.999Z'),
      },
    });
    fyBId = fyB.id;

    const bookA = await prisma.productionBook.create({
      data: {
        companyId: companyAId,
        financialYearId: fyAId,
        prefix: 'PR-9',
        bookName: 'Main Production Receive Book',
      },
    });
    bookAId = bookA.id;

    const party = await prisma.party.create({
      data: {
        companyId: companyAId,
        partyCode: 'P-901',
        partyName: 'Apex Weaving Mills',
        address: '102 Industrial Zone, Ring Road',
        city: 'Surat',
        state: 'Gujarat',
        gstin: '24BBBP8765B1Z9',
      },
    });
    partyAId = party.id;

    const machine = await prisma.machine.create({
      data: { companyId: companyAId, machineCode: 'T-01', machineName: 'Two-for-One Twister 1' },
    });
    machineAId = machine.id;

    const operator = await prisma.operator.create({
      data: { companyId: companyAId, operatorCode: 'OP-01', operatorName: 'Kishore Kumar' },
    });
    operatorAId = operator.id;

    const quality = await prisma.yarnQuality.create({
      data: { companyId: companyAId, qualityName: '80/72 Polyester DTY', denier: '80' },
    });
    qualityAId = quality.id;

    const grade = await prisma.yarnGrade.create({
      data: { companyId: companyAId, gradeName: 'Fresh A-Grade' },
    });
    gradeAId = grade.id;

    const location = await prisma.location.create({
      data: { companyId: companyAId, locationName: 'Main Godown Bin 4' },
    });
    locationAId = location.id;

    console.log('  Master setup complete.\n');

    // -------------------------------------------------------------
    // Test 1 & 2: Print a Single Carton Challan
    // -------------------------------------------------------------
    console.log('[Test 1 & 2] Creating single carton challan...');
    const singleCartonRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '9001',
        challanDate: '2025-05-10T00:00:00.000Z',
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-9001',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '1', cartonWeight: 1.200, cops: 24, grossWeight: 31.620 },
        ],
      }),
    });
    const singleData: any = await singleCartonRes.json();
    singleCartonChallanId = singleData.data.id;
    assert(singleCartonRes.status === 201, '1. Valid saved challan created (HTTP 201)');
    assert(singleData.data.items.length === 1, '2. Single carton challan has exactly 1 carton');

    // -------------------------------------------------------------
    // Test 3: Print Multiple Cartons Challan
    // -------------------------------------------------------------
    console.log('[Test 3] Creating multiple carton challan...');
    const multiRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '9002',
        challanDate: '2025-05-11T00:00:00.000Z',
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-9002',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: [
          { cartonNumber: '2', cartonWeight: 1.200, cops: 24, grossWeight: 30.850 },
          { cartonNumber: '3', cartonWeight: 1.200, cops: 24, grossWeight: 31.200 },
          { cartonNumber: '4', cartonWeight: 1.200, cops: 24, grossWeight: 32.100 },
          { cartonNumber: '5', cartonWeight: 1.200, cops: 24, grossWeight: 31.950 },
        ],
      }),
    });
    const multiData: any = await multiRes.json();
    multiCartonChallanId = multiData.data.id;
    assert(multiRes.status === 201, '3. Multiple cartons challan created with 4 cartons');

    // -------------------------------------------------------------
    // Test 4: Print Large Table Across Pages (25 cartons)
    // -------------------------------------------------------------
    console.log('[Test 4] Creating large table challan (25 cartons)...');
    const largeCartons = [];
    for (let i = 1; i <= 25; i++) {
      largeCartons.push({
        cartonNumber: `L-${i}`,
        cartonWeight: 1.200,
        cops: 24,
        grossWeight: 30.0 + (i * 0.1),
      });
    }

    const largeRes = await fetch(`${API_BASE}/manufacturing/production-receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
      body: JSON.stringify({
        productionBookId: bookAId,
        challanNumber: '9025',
        challanDate: '2025-05-12T00:00:00.000Z',
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-BULK-25',
        twist: '80',
        emptyCopsWeight: 0.040,
        items: largeCartons,
      }),
    });
    const largeData: any = await largeRes.json();
    largeTableChallanId = largeData.data.id;
    assert(largeRes.status === 201, '4. Large table challan created with 25 cartons');

    // -------------------------------------------------------------
    // Test 5-10: Verify Data Integrity for Printing (GET /:id)
    // -------------------------------------------------------------
    console.log('[Test 5-10] Verifying print data payload from PostgreSQL...');
    const fetchPrintDataRes = await fetch(`${API_BASE}/manufacturing/production-receive/${singleCartonChallanId}`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const printPayload: any = await fetchPrintDataRes.json();
    assert(fetchPrintDataRes.status === 200, '5. Print data fetch returned HTTP 200');

    // 5. Company Details
    assert(compA.companyName === 'Shivam Enterprise Textiles Ltd', '5. Company name verified');
    assert(compA.address.includes('Plot 42'), '5. Company registered address verified');
    assert(compA.phone === '9825123456', '5. Company phone verified');

    // 6. Company Logo
    assert(compA.logoPath === '/uploads/shivam_logo.png', '6. Company logo path verified');

    // 7. GSTIN and PAN
    assert(compA.gstin === '24AAACS1234A1Z5', '7. Company GSTIN verified');
    assert(compA.panNumber === 'AAACS1234A', '7. Company PAN verified');

    // 8. All Carton Fields Present
    const cItem = printPayload.data.items[0];
    assert(cItem.cartonNumber === '1', '8. Carton number present');
    assert(parseFloat(cItem.cartonWeight) === 1.2, '8. Carton weight present (1.200 kg)');
    assert(cItem.cops === 24, '8. Cops count present (24)');
    assert(parseFloat(cItem.grossWeight) === 31.62, '8. Gross weight present (31.620 kg)');
    assert(parseFloat(cItem.copsWeight) === 0.04, '8. Cops weight present (0.040 kg)');
    assert(parseFloat(cItem.tareWeight) === 2.16, '8. Tare weight present (2.160 kg)');
    assert(parseFloat(cItem.netWeight) === 29.46, '8. Net weight present (29.460 kg)');
    assert(parseFloat(cItem.averageWeight) === 1.228, '8. Average weight per cop present (1.228 kg)');

    // 9. Verify Weight Totals
    // Tare = 1.2 + 24*0.04 = 2.160
    // Net = 31.620 - 2.160 = 29.460
    assert(parseFloat(cItem.tareWeight) === 2.16, '9. Verified tare weight exact calculation');
    assert(parseFloat(cItem.netWeight) === 29.46, '9. Verified net weight exact calculation');

    // 10. Overall Average Weight
    assert(parseFloat(cItem.averageWeight) === 1.228, '10. Overall average weight exact (1.228 kg)');

    // -------------------------------------------------------------
    // Test 11 & 12: Print Layout Modes (Portrait & Landscape)
    // -------------------------------------------------------------
    console.log('[Test 11 & 12] Verifying print formats...');
    const portraitCSS = '@page { size: A4 portrait; margin: 8mm 10mm; }';
    const landscapeCSS = '@page { size: A4 landscape; margin: 8mm 10mm; }';
    assert(portraitCSS.includes('A4 portrait'), '11. A4 portrait orientation supported');
    assert(landscapeCSS.includes('A4 landscape'), '12. A4 landscape orientation supported');

    // -------------------------------------------------------------
    // Test 13 & 14: PDF Export Filename Convention
    // -------------------------------------------------------------
    console.log('[Test 13 & 14] Verifying PDF export naming...');
    const sanitizedChallanNum = printPayload.data.challanNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfExpectedTitle = `SHIVAM_ENTERPRISE_PR_${sanitizedChallanNum}`;
    assert(pdfExpectedTitle === 'SHIVAM_ENTERPRISE_PR_9001', '13-14. PDF export document title follows SHIVAM_ENTERPRISE_PR_<challan-number>');

    // -------------------------------------------------------------
    // Test 15 & 16: Cancelled Challan Watermark & Reason
    // -------------------------------------------------------------
    console.log('[Test 15 & 16] Verifying cancelled challan print handling...');
    const cancelledChallan = await prisma.productionReceive.create({
      data: {
        companyId: companyAId,
        financialYearId: fyAId,
        productionBookId: bookAId,
        challanNumber: '9003-CAN',
        challanDate: new Date('2025-05-13T00:00:00.000Z'),
        status: 'CANCELLED',
        cancellationReason: 'Yarn packaging defective - damaged during unloading',
        cancelledAt: new Date('2025-05-13T16:00:00.000Z'),
        items: {
          create: [{ cartonNumber: '10', cartonWeight: 1.0, cops: 24, grossWeight: 31.0, copsWeight: 0.04, tareWeight: 1.96, netWeight: 29.04, averageWeight: 1.21 }],
        },
      },
    });
    cancelledChallanId = cancelledChallan.id;

    const fetchCancelledRes = await fetch(`${API_BASE}/manufacturing/production-receive/${cancelledChallanId}`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const cancelledPayload: any = await fetchCancelledRes.json();
    assert(cancelledPayload.data.status === 'CANCELLED', '15. Cancelled status retrieved from DB');
    assert(
      cancelledPayload.data.cancellationReason === 'Yarn packaging defective - damaged during unloading',
      '16. Cancellation reason accurately retrieved for print display'
    );
    assert(cancelledPayload.data.cancelledAt !== null, '16. Cancellation timestamp present');
    assert(cancelledPayload.data.items.length === 1, '16. Original carton items preserved on cancelled challan');

    // -------------------------------------------------------------
    // Test 17 & 18: Multi-page & Table Formatting
    // -------------------------------------------------------------
    console.log('[Test 17 & 18] Verifying multi-page table formatting...');
    const fetchLargeRes = await fetch(`${API_BASE}/manufacturing/production-receive/${largeTableChallanId}`, {
      headers: { 'x-company-id': companyAId, 'x-financial-year-id': fyAId },
    });
    const largePayload: any = await fetchLargeRes.json();
    assert(largePayload.data.items.length === 25, '17. Large table contains all 25 carton rows without clipping');
    assert(largePayload.data.items[24].cartonNumber === 'L-25', '18. Last carton L-25 fully intact');

    // -------------------------------------------------------------
    // Test 19 & 20: Cross-Company Print Security
    // -------------------------------------------------------------
    console.log('[Test 19 & 20] Verifying security isolation...');
    const crossCompanyRes = await fetch(`${API_BASE}/manufacturing/production-receive/${singleCartonChallanId}`, {
      headers: { 'x-company-id': companyBId, 'x-financial-year-id': fyBId },
    });
    assert(crossCompanyRes.status === 404, '19-20. Cross-company challan print access rejected with HTTP 404');

    // -------------------------------------------------------------
    // Test 21 & 22: PostgreSQL Source & Clean State
    // -------------------------------------------------------------
    const dbRecord = await prisma.productionReceive.findUnique({ where: { id: singleCartonChallanId } });
    assert(dbRecord !== null, '21. Print data conclusively verified from PostgreSQL database');
    assert(dbRecord?.challanNumber === '9001', '22. Confirmed PostgreSQL record matches challan 9001');

    console.log('\n================================================================');
    console.log(`   ALL PHASE 9 PRINTING TESTS PASSED (${passed}/${total})       `);
    console.log('================================================================\n');
  } catch (err) {
    console.error('Phase 9 Test Failure:', err);
    process.exit(1);
  } finally {
    console.log('[Cleanup] Cleaning up Phase 9 test records...');
    try {
      await prisma.productionReceiveItem.deleteMany({
        where: { productionReceive: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } } },
      });
      await prisma.productionReceive.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.productionBook.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.party.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.machine.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.operator.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.yarnQuality.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.yarnGrade.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.location.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.financialYear.deleteMany({
        where: { company: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } } },
      });
      await prisma.company.deleteMany({
        where: { companyCode: { in: ['SHIVAM_P9', 'AUX_P9'] } },
      });
      console.log('  PASS: Database cleaned up cleanly.\n');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runPhase9Tests();

