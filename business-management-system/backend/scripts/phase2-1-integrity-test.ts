import { PrismaClient, PartyType, BalanceType, ProductionReceiveStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function runIntegrityHardeningTests() {
  console.log('================================================================');
  console.log('   PHASE 2.1: DATABASE INTEGRITY HARDENING VERIFICATION TEST    ');
  console.log('================================================================');

  const testSuffix = Date.now().toString().slice(-6);
  const companyCodeA = `SHV_INT_${testSuffix}`;
  const companyCodeB = `AUX_INT_${testSuffix}`;

  let companyAId = '';
  let companyBId = '';
  let fyA1Id = '';
  let fyA2Id = '';
  let fyB1Id = '';
  let partyBId = '';
  let machineBId = '';
  let operatorBId = '';
  let locationBId = '';
  let qualityBId = '';
  let gradeBId = '';
  let bookBId = '';
  let bookAId = '';

  let allTestsPassed = true;

  try {
    // -------------------------------------------------------------
    // SETUP: Create Two Independent Companies
    // -------------------------------------------------------------
    console.log('\n[Setup] Initializing two test companies...');
    const companyA = await prisma.company.create({
      data: {
        companyCode: companyCodeA,
        companyName: 'Shivam Enterprise Integrity Test Co',
        city: 'Surat',
        state: 'Gujarat',
      },
    });
    companyAId = companyA.id;

    const companyB = await prisma.company.create({
      data: {
        companyCode: companyCodeB,
        companyName: 'Auxiliary Integrity Test Co',
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
    });
    companyBId = companyB.id;

    console.log(`  PASS: Company A created: ${companyA.companyName} (${companyAId})`);
    console.log(`  PASS: Company B created: ${companyB.companyName} (${companyBId})`);

    // -------------------------------------------------------------
    // PART 1: FINANCIAL YEAR OVERLAP TESTS
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('PART 1: Financial Year Overlap & Boundary Verification');
    console.log('-------------------------------------------------------------');

    // Test 1.1: Consecutive Normal Financial Years
    console.log('\n[1.1] Testing consecutive normal financial years for Company A...');
    const fyA1 = await prisma.financialYear.create({
      data: {
        companyId: companyAId,
        yearName: '2024-2025',
        startDate: new Date('2024-04-01T00:00:00Z'),
        endDate: new Date('2025-03-31T23:59:59Z'),
      },
    });
    fyA1Id = fyA1.id;

    const fyA2 = await prisma.financialYear.create({
      data: {
        companyId: companyAId,
        yearName: '2025-2026',
        startDate: new Date('2025-04-01T00:00:00Z'),
        endDate: new Date('2026-03-31T23:59:59Z'),
      },
    });
    fyA2Id = fyA2.id;
    console.log(`  PASS: Successfully created consecutive FYs (2024-2025 & 2025-2026).`);

    // Test 1.2: Duplicate FY Name for same company
    console.log('\n[1.2] Testing duplicate FY name rejection for same company...');
    try {
      await prisma.financialYear.create({
        data: {
          companyId: companyAId,
          yearName: '2025-2026', // Duplicate name
          startDate: new Date('2027-04-01T00:00:00Z'),
          endDate: new Date('2028-03-31T23:59:59Z'),
        },
      });
      throw new Error('FAIL: Duplicate FY name was allowed!');
    } catch (e: any) {
      if (e.code === 'P2002' || (e.message && e.message.includes('unique constraint'))) {
        console.log('  PASS: Duplicate financial year name correctly blocked by unique constraint.');
      } else {
        throw e;
      }
    }

    // Test 1.3: Partially overlapping date ranges for same company
    console.log('\n[1.3] Testing partially overlapping date range for Company A...');
    try {
      await prisma.financialYear.create({
        data: {
          companyId: companyAId,
          yearName: '2025-Overlap-Partial',
          startDate: new Date('2025-10-01T00:00:00Z'), // Overlaps with 2025-2026
          endDate: new Date('2026-09-30T23:59:59Z'),
        },
      });
      throw new Error('FAIL: Partially overlapping financial year was allowed!');
    } catch (e: any) {
      if (e.message && (e.message.includes('overlaps with an existing financial year') || e.message.includes('trg_check_financial_year_overlap'))) {
        console.log('  PASS: Partially overlapping date range correctly blocked by database trigger.');
      } else {
        throw e;
      }
    }

    // Test 1.4: Completely overlapping date range (nested) for same company
    console.log('\n[1.4] Testing completely nested/overlapping date range for Company A...');
    try {
      await prisma.financialYear.create({
        data: {
          companyId: companyAId,
          yearName: '2024-Overlap-Nested',
          startDate: new Date('2024-06-01T00:00:00Z'), // Completely inside 2024-2025
          endDate: new Date('2024-12-31T23:59:59Z'),
        },
      });
      throw new Error('FAIL: Completely nested/overlapping financial year was allowed!');
    } catch (e: any) {
      if (e.message && (e.message.includes('overlaps with an existing financial year') || e.message.includes('trg_check_financial_year_overlap'))) {
        console.log('  PASS: Completely overlapping date range correctly blocked by database trigger.');
      } else {
        throw e;
      }
    }

    // Test 1.5: Different company having identical financial year date range
    console.log('\n[1.5] Testing independent financial years across different companies...');
    const fyB1 = await prisma.financialYear.create({
      data: {
        companyId: companyBId,
        yearName: '2025-2026', // Identical name and date range, but for Company B
        startDate: new Date('2025-04-01T00:00:00Z'),
        endDate: new Date('2026-03-31T23:59:59Z'),
      },
    });
    fyB1Id = fyB1.id;
    console.log(`  PASS: Company B successfully created FY 2025-2026 with same dates without collision.`);

    // -------------------------------------------------------------
    // PART 2: COMPANY-LEVEL REFERENTIAL INTEGRITY TESTS
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('PART 2: Cross-Company Referential Integrity & Isolation');
    console.log('-------------------------------------------------------------');

    // Create Company A Master and Book
    const bookA = await prisma.productionBook.create({
      data: {
        companyId: companyAId,
        financialYearId: fyA2Id,
        prefix: 'PR-A',
        bookName: 'Company A Main Book',
      },
    });
    bookAId = bookA.id;

    // Create Company B Masters
    const partyB = await prisma.party.create({
      data: {
        companyId: companyBId,
        partyCode: 'P-B-01',
        partyName: 'Company B Customer',
        partyType: PartyType.CUSTOMER,
      },
    });
    partyBId = partyB.id;

    const machineB = await prisma.machine.create({
      data: {
        companyId: companyBId,
        machineCode: 'M-B-01',
        machineName: 'Company B Machine',
      },
    });
    machineBId = machineB.id;

    const operatorB = await prisma.operator.create({
      data: {
        companyId: companyBId,
        operatorCode: 'OP-B-01',
        operatorName: 'Company B Operator',
      },
    });
    operatorBId = operatorB.id;

    const locationB = await prisma.location.create({
      data: {
        companyId: companyBId,
        locationName: 'Company B Godown',
      },
    });
    locationBId = locationB.id;

    const qualityB = await prisma.yarnQuality.create({
      data: {
        companyId: companyBId,
        qualityName: 'Company B Yarn Quality',
      },
    });
    qualityBId = qualityB.id;

    const gradeB = await prisma.yarnGrade.create({
      data: {
        companyId: companyBId,
        gradeName: 'Company B Grade',
      },
    });
    gradeBId = gradeB.id;

    const bookB = await prisma.productionBook.create({
      data: {
        companyId: companyBId,
        financialYearId: fyB1Id,
        prefix: 'PR-B',
        bookName: 'Company B Production Book',
      },
    });
    bookBId = bookB.id;

    console.log('  PASS: Master records created for Company B.');

    // Test 2.1: ProductionBook referencing another company's financial year
    console.log('\n[2.1] Testing ProductionBook referencing another company financial year...');
    try {
      await prisma.productionBook.create({
        data: {
          companyId: companyAId,
          financialYearId: fyB1Id, // Company B's FY!
          prefix: 'BAD-BOOK',
          bookName: 'Cross Company FY Book',
        },
      });
      throw new Error('FAIL: ProductionBook allowed referencing another company financial year!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company financial year in ProductionBook blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.2: Production Challan referencing Company B Party
    console.log('\n[2.2] Testing Production Challan referencing Company B Party...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-001',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          partyId: partyBId, // Foreign company party!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company party!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company Party reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.3: Production Challan referencing Company B Machine
    console.log('\n[2.3] Testing Production Challan referencing Company B Machine...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-002',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          machineId: machineBId, // Foreign company machine!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company machine!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company Machine reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.4: Production Challan referencing Company B Operator
    console.log('\n[2.4] Testing Production Challan referencing Company B Operator...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-003',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          operatorId: operatorBId, // Foreign company operator!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company operator!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company Operator reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.5: Production Challan referencing Company B Location
    console.log('\n[2.5] Testing Production Challan referencing Company B Location...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-004',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          locationId: locationBId, // Foreign company location!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company location!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company Location reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.6: Production Challan referencing Company B YarnQuality
    console.log('\n[2.6] Testing Production Challan referencing Company B YarnQuality...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-005',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          yarnQualityId: qualityBId, // Foreign company quality!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company quality!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company YarnQuality reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.7: Production Challan referencing Company B YarnGrade
    console.log('\n[2.7] Testing Production Challan referencing Company B YarnGrade...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookAId,
          challanNumber: 'INV-006',
          challanDate: new Date('2025-06-01T00:00:00Z'),
          yarnGradeId: gradeBId, // Foreign company grade!
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company grade!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company YarnGrade reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    // Test 2.8: Production Challan referencing Company B ProductionBook
    console.log('\n[2.8] Testing Production Challan referencing Company B ProductionBook...');
    try {
      await prisma.productionReceive.create({
        data: {
          companyId: companyAId,
          financialYearId: fyA2Id,
          productionBookId: bookBId, // Foreign company book!
          challanNumber: 'INV-007',
          challanDate: new Date('2025-06-01T00:00:00Z'),
        },
      });
      throw new Error('FAIL: ProductionReceive allowed referencing another company production book!');
    } catch (e: any) {
      if (e.code === 'P2003' || (e.message && e.message.toLowerCase().includes('foreign key'))) {
        console.log('  PASS: Cross-company ProductionBook reference blocked by composite FK (P2003).');
      } else {
        throw e;
      }
    }

    console.log('\n================================================================');
    console.log('   ALL PHASE 2.1 INTEGRITY HARDENING TESTS PASSED (13/13)       ');
    console.log('================================================================');
  } catch (error: any) {
    allTestsPassed = false;
    console.error('\n  INTEGRITY TEST FAILED:', error.message || error);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean up all temporary records
    // -------------------------------------------------------------
    console.log('\n[Cleanup] Cleaning up temporary test records...');
    try {
      if (bookAId || bookBId) {
        await prisma.productionBook.deleteMany({ where: { id: { in: [bookAId, bookBId] } } });
      }
      if (partyBId) await prisma.party.deleteMany({ where: { id: partyBId } });
      if (machineBId) await prisma.machine.deleteMany({ where: { id: machineBId } });
      if (operatorBId) await prisma.operator.deleteMany({ where: { id: operatorBId } });
      if (locationBId) await prisma.location.deleteMany({ where: { id: locationBId } });
      if (qualityBId) await prisma.yarnQuality.deleteMany({ where: { id: qualityBId } });
      if (gradeBId) await prisma.yarnGrade.deleteMany({ where: { id: gradeBId } });
      if (fyA1Id || fyA2Id || fyB1Id) {
        await prisma.financialYear.deleteMany({ where: { id: { in: [fyA1Id, fyA2Id, fyB1Id] } } });
      }
      if (companyAId || companyBId) {
        await prisma.company.deleteMany({ where: { id: { in: [companyAId, companyBId] } } });
      }
      console.log('  PASS: All temporary test records removed cleanly. Database remains pristine.');
    } catch (cleanupError: any) {
      console.warn('  WARN: Cleanup warning:', cleanupError.message);
    }

    await prisma.$disconnect();
    if (!allTestsPassed) {
      process.exit(1);
    }
  }
}

runIntegrityHardeningTests();
