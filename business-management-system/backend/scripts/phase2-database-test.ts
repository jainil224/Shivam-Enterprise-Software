import { PrismaClient, PartyType, BalanceType, ProductionReceiveStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function runPhase2DatabaseTests() {
  console.log('================================================================');
  console.log('   PHASE 2: COMPLETE DATABASE ARCHITECTURE VERIFICATION TEST    ');
  console.log('================================================================');

  const testSuffix = Date.now().toString().slice(-6);
  const companyCodeA = `SHIVAM_${testSuffix}`;
  const companyCodeB = `AUX_${testSuffix}`;

  let companyAId = '';
  let companyBId = '';
  let fyAId = '';
  let fyBId = '';
  let partyAId = '';
  let machineAId = '';
  let operatorAId = '';
  let locationAId = '';
  let qualityAId = '';
  let gradeAId = '';
  let bookAId = '';
  let challanAId = '';

  let allTestsPassed = true;

  try {
    // -------------------------------------------------------------
    // TEST 1: Create Two Separate Companies
    // -------------------------------------------------------------
    console.log('\n[Test 1] Creating two separate companies...');
    const companyA = await prisma.company.create({
      data: {
        companyCode: companyCodeA,
        companyName: 'Shivam Enterprise Test Ltd',
        gstin: '24AAAAA0000A1Z5',
        panNumber: 'AAAAA0000A',
        city: 'Surat',
        state: 'Gujarat',
        phone: '9876543210',
        email: 'info@shivamenterprise.test',
      },
    });
    companyAId = companyA.id;

    const companyB = await prisma.company.create({
      data: {
        companyCode: companyCodeB,
        companyName: 'Auxiliary Textiles Private Limited',
        gstin: '24BBBBB1111B1Z2',
        panNumber: 'BBBBB1111B',
        city: 'Ahmedabad',
        state: 'Gujarat',
      },
    });
    companyBId = companyB.id;

    console.log(`  PASS: Created Company A (${companyA.companyName}, ID: ${companyAId})`);
    console.log(`  PASS: Created Company B (${companyB.companyName}, ID: ${companyBId})`);

    // Verify companyCode uniqueness
    try {
      await prisma.company.create({
        data: {
          companyCode: companyCodeA,
          companyName: 'Duplicate Company Code Test',
        },
      });
      throw new Error('FAIL: Duplicate companyCode was allowed!');
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        console.log('  PASS: Duplicate companyCode correctly blocked by unique constraint (P2002).');
      } else {
        throw e;
      }
    }

    // -------------------------------------------------------------
    // TEST 2: Create Separate Financial Years for Each Company
    // -------------------------------------------------------------
    console.log('\n[Test 2] Creating separate financial years for each company...');
    const fyA = await prisma.financialYear.create({
      data: {
        companyId: companyAId,
        yearName: '2025-2026',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isActive: true,
        isLocked: false,
      },
    });
    fyAId = fyA.id;

    const fyB = await prisma.financialYear.create({
      data: {
        companyId: companyBId,
        yearName: '2025-2026',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isActive: true,
        isLocked: false,
      },
    });
    fyBId = fyB.id;

    console.log(`  PASS: Created FY '2025-2026' for Company A (ID: ${fyAId})`);
    console.log(`  PASS: Created FY '2025-2026' for Company B (ID: ${fyBId})`);

    // -------------------------------------------------------------
    // TEST 3: Prevent Duplicate Financial Year within Same Company
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing duplicate financial year prevention...');
    try {
      await prisma.financialYear.create({
        data: {
          companyId: companyAId,
          yearName: '2025-2026', // Duplicate for Company A
          startDate: new Date('2025-04-01'),
          endDate: new Date('2026-03-31'),
        },
      });
      throw new Error('FAIL: Duplicate financial year was permitted for the same company!');
    } catch (e: any) {
      if (
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') ||
        (e.message && e.message.includes('overlaps with an existing financial year'))
      ) {
        console.log('  PASS: Duplicate FY for same company correctly rejected by DB trigger/unique constraint.');
      } else {
        throw e;
      }
    }

    // -------------------------------------------------------------
    // TEST 4: Create Parties with Multi-Company Scope
    // -------------------------------------------------------------
    console.log('\n[Test 4] Creating parties for different companies...');
    const partyA = await prisma.party.create({
      data: {
        companyId: companyAId,
        partyCode: 'CUST-001',
        partyName: 'Rajesh Fabrics Pvt Ltd',
        partyType: PartyType.CUSTOMER,
        gstin: '24AABCR1234F1Z8',
        openingBalance: new Prisma.Decimal(125000.50),
        balanceType: BalanceType.DEBIT,
      },
    });
    partyAId = partyA.id;

    // Same partyCode 'CUST-001' in Company B should succeed (scoped per company)
    const partyB = await prisma.party.create({
      data: {
        companyId: companyBId,
        partyCode: 'CUST-001',
        partyName: 'Gujarat Synthetics',
        partyType: PartyType.BOTH,
        openingBalance: new Prisma.Decimal(50000.00),
        balanceType: BalanceType.CREDIT,
      },
    });

    console.log(`  PASS: Created Party A (ID: ${partyAId}, Code: ${partyA.partyCode}, Balance: ${partyA.openingBalance} ${partyA.balanceType})`);
    console.log(`  PASS: Successfully reused Code 'CUST-001' in Company B (ID: ${partyB.id}) proving company isolation.`);

    // -------------------------------------------------------------
    // TEST 5: Create Machines, Operators, Locations, Qualities, Grades
    // -------------------------------------------------------------
    console.log('\n[Test 5] Creating masters: Machines, Operators, Locations, Qualities, Grades...');
    const machine = await prisma.machine.create({
      data: {
        companyId: companyAId,
        machineCode: 'TFO-01',
        machineName: 'Two-for-One Twister Machine 1',
      },
    });
    machineAId = machine.id;

    const operator = await prisma.operator.create({
      data: {
        companyId: companyAId,
        operatorCode: 'OP-101',
        operatorName: 'Suresh Patel',
        phone: '9825012345',
      },
    });
    operatorAId = operator.id;

    const location = await prisma.location.create({
      data: {
        companyId: companyAId,
        locationName: 'Main Yarn Warehouse - Section A',
      },
    });
    locationAId = location.id;

    const quality = await prisma.yarnQuality.create({
      data: {
        companyId: companyAId,
        qualityName: '80/72 Polyester DTY Texturised',
        denier: '80 Denier / 72 Filament',
      },
    });
    qualityAId = quality.id;

    const grade = await prisma.yarnGrade.create({
      data: {
        companyId: companyAId,
        gradeName: 'A-Grade Fresh',
      },
    });
    gradeAId = grade.id;

    console.log(`  PASS: Machine '${machine.machineName}' created (ID: ${machineAId})`);
    console.log(`  PASS: Operator '${operator.operatorName}' created (ID: ${operatorAId})`);
    console.log(`  PASS: Location '${location.locationName}' created (ID: ${locationAId})`);
    console.log(`  PASS: YarnQuality '${quality.qualityName}' created (ID: ${qualityAId})`);
    console.log(`  PASS: YarnGrade '${grade.gradeName}' created (ID: ${gradeAId})`);

    // -------------------------------------------------------------
    // TEST 6: Create Production Books
    // -------------------------------------------------------------
    console.log('\n[Test 6] Creating Production Book...');
    const book = await prisma.productionBook.create({
      data: {
        companyId: companyAId,
        financialYearId: fyAId,
        prefix: 'PR-25',
        bookName: 'Main Production Receive Book',
        openingBalance: new Prisma.Decimal(0.000),
      },
    });
    bookAId = book.id;
    console.log(`  PASS: Production Book '${book.bookName}' created (Prefix: ${book.prefix}, ID: ${bookAId})`);

    // Verify unique book prefix per company and FY
    try {
      await prisma.productionBook.create({
        data: {
          companyId: companyAId,
          financialYearId: fyAId,
          prefix: 'PR-25',
          bookName: 'Duplicate Prefix Book',
        },
      });
      throw new Error('FAIL: Duplicate production book prefix was allowed!');
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        console.log('  PASS: Duplicate production book prefix correctly rejected (P2002).');
      } else {
        throw e;
      }
    }

    // -------------------------------------------------------------
    // TEST 7: Create Production Receive Challan Header
    // -------------------------------------------------------------
    console.log('\n[Test 7] Creating Production Receive Challan...');
    const challan = await prisma.productionReceive.create({
      data: {
        companyId: companyAId,
        financialYearId: fyAId,
        productionBookId: bookAId,
        challanNumber: '1001',
        challanDate: new Date('2025-06-15T10:00:00Z'),
        partyId: partyAId,
        machineId: machineAId,
        operatorId: operatorAId,
        yarnQualityId: qualityAId,
        yarnGradeId: gradeAId,
        locationId: locationAId,
        lotNumber: 'LOT-2025-09',
        twist: '250 TPM S-Twist',
        emptyCopsWeight: new Prisma.Decimal(0.050), // 50 grams per cop
        remarks: 'Batch test production run for Phase 2 validation',
        status: ProductionReceiveStatus.CONFIRMED,
      },
    });
    challanAId = challan.id;
    console.log(`  PASS: Production Challan #${challan.challanNumber} created (ID: ${challanAId}, Status: ${challan.status})`);

    // -------------------------------------------------------------
    // TEST 8: Add Multiple Carton Entries with Precise Decimals
    // -------------------------------------------------------------
    console.log('\n[Test 8] Adding carton entries with 3-decimal precision...');

    // Carton 1:
    // Cops = 40, Empty Cops Weight = 0.050 kg => Cops Weight = 2.000 kg
    // Carton Weight = 2.500 kg
    // Tare Weight = 2.500 + 2.000 = 4.500 kg
    // Gross Weight = 50.250 kg
    // Net Weight = 50.250 - 4.500 = 45.750 kg
    // Average Weight = 45.750 / 40 = 1.144 kg (rounded to 3 decimals: 1.144)
    const item1 = await prisma.productionReceiveItem.create({
      data: {
        productionReceiveId: challanAId,
        cartonNumber: '1',
        cartonWeight: new Prisma.Decimal(2.500),
        cops: 40,
        grossWeight: new Prisma.Decimal(50.250),
        copsWeight: new Prisma.Decimal(2.000),
        tareWeight: new Prisma.Decimal(4.500),
        netWeight: new Prisma.Decimal(45.750),
        twist: '250 TPM',
        lotNumber: 'LOT-2025-09',
        grade: 'A',
        averageWeight: new Prisma.Decimal(1.144),
      },
    });

    // Carton 2:
    // Gross = 48.800 kg, Tare = 4.500 kg => Net = 44.300 kg, Avg = 44.300 / 40 = 1.108 kg
    const item2 = await prisma.productionReceiveItem.create({
      data: {
        productionReceiveId: challanAId,
        cartonNumber: '2',
        cartonWeight: new Prisma.Decimal(2.500),
        cops: 40,
        grossWeight: new Prisma.Decimal(48.800),
        copsWeight: new Prisma.Decimal(2.000),
        tareWeight: new Prisma.Decimal(4.500),
        netWeight: new Prisma.Decimal(44.300),
        twist: '250 TPM',
        lotNumber: 'LOT-2025-09',
        grade: 'A',
        averageWeight: new Prisma.Decimal(1.108),
      },
    });

    console.log(`  PASS: Carton #1 added: Gross=${item1.grossWeight}kg, Tare=${item1.tareWeight}kg, Net=${item1.netWeight}kg, Avg=${item1.averageWeight}kg`);
    console.log(`  PASS: Carton #2 added: Gross=${item2.grossWeight}kg, Tare=${item2.tareWeight}kg, Net=${item2.netWeight}kg, Avg=${item2.averageWeight}kg`);

    // Verify duplicate carton number in same challan is rejected
    try {
      await prisma.productionReceiveItem.create({
        data: {
          productionReceiveId: challanAId,
          cartonNumber: '1', // Duplicate in same challan
          cartonWeight: new Prisma.Decimal(2.500),
          cops: 40,
          grossWeight: new Prisma.Decimal(50.000),
          copsWeight: new Prisma.Decimal(2.000),
          tareWeight: new Prisma.Decimal(4.500),
          netWeight: new Prisma.Decimal(45.500),
          averageWeight: new Prisma.Decimal(1.138),
        },
      });
      throw new Error('FAIL: Duplicate carton number in same challan was allowed!');
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        console.log('  PASS: Duplicate carton number in same challan correctly rejected (P2002).');
      } else {
        throw e;
      }
    }

    // -------------------------------------------------------------
    // TEST 9: Query Challan with Complete Joined Graph
    // -------------------------------------------------------------
    console.log('\n[Test 9] Fetching full production challan graph with relations...');
    const fullChallan = await prisma.productionReceive.findUnique({
      where: { id: challanAId },
      include: {
        company: true,
        financialYear: true,
        productionBook: true,
        party: true,
        machine: true,
        operator: true,
        yarnQuality: true,
        yarnGrade: true,
        location: true,
        items: {
          orderBy: { cartonNumber: 'asc' },
        },
      },
    });

    if (!fullChallan || fullChallan.items.length !== 2) {
      throw new Error('FAIL: Could not retrieve full challan with all relations and items');
    }

    const totalNetWeight = fullChallan.items.reduce(
      (acc, item) => acc.add(item.netWeight),
      new Prisma.Decimal(0)
    );
    const totalGrossWeight = fullChallan.items.reduce(
      (acc, item) => acc.add(item.grossWeight),
      new Prisma.Decimal(0)
    );

    console.log(`  PASS: Successfully loaded Challan #${fullChallan.challanNumber}`);
    console.log(`        Company: ${fullChallan.company.companyName}`);
    console.log(`        Financial Year: ${fullChallan.financialYear.yearName}`);
    console.log(`        Book: ${fullChallan.productionBook.bookName} (${fullChallan.productionBook.prefix})`);
    console.log(`        Party: ${fullChallan.party?.partyName}`);
    console.log(`        Machine: ${fullChallan.machine?.machineName}`);
    console.log(`        Operator: ${fullChallan.operator?.operatorName}`);
    console.log(`        Quality: ${fullChallan.yarnQuality?.qualityName}`);
    console.log(`        Total Cartons: ${fullChallan.items.length}`);
    console.log(`        Total Gross Weight: ${totalGrossWeight.toString()} kg`);
    console.log(`        Total Net Weight: ${totalNetWeight.toString()} kg`);

    // -------------------------------------------------------------
    // TEST 10: Referential Integrity (Restrict Company Deletion)
    // -------------------------------------------------------------
    console.log('\n[Test 10] Testing referential integrity & safe deletion rules...');
    try {
      // Company deletion should be restricted because active ProductionReceives exist
      await prisma.company.delete({
        where: { id: companyAId },
      });
      throw new Error('FAIL: Company with active production challans was deleted!');
    } catch (e: any) {
      if (
        (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2003' || e.code === 'P2014')) ||
        (e.message && e.message.includes('foreign key constraint'))
      ) {
        console.log('  PASS: Deleting Company with active transactions blocked by referential integrity (RESTRICT constraint).');
      } else {
        throw e;
      }
    }

    console.log('\n----------------------------------------------------------------');
    console.log('   ALL 10 ARCHITECTURE INTEGRATION TESTS PASSED (10/10)        ');
    console.log('----------------------------------------------------------------');
  } catch (error: any) {
    allTestsPassed = false;
    console.error('\n  TEST EXECUTION FAILED:', error.message || error);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Clean up temporary test records
    // -------------------------------------------------------------
    console.log('\n[Cleanup] Cleaning up temporary test records...');
    try {
      if (challanAId) {
        await prisma.productionReceiveItem.deleteMany({ where: { productionReceiveId: challanAId } });
        await prisma.productionReceive.delete({ where: { id: challanAId } });
      }
      if (bookAId) await prisma.productionBook.delete({ where: { id: bookAId } });
      if (partyAId) await prisma.party.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
      if (machineAId) await prisma.machine.delete({ where: { id: machineAId } });
      if (operatorAId) await prisma.operator.delete({ where: { id: operatorAId } });
      if (locationAId) await prisma.location.delete({ where: { id: locationAId } });
      if (qualityAId) await prisma.yarnQuality.delete({ where: { id: qualityAId } });
      if (gradeAId) await prisma.yarnGrade.delete({ where: { id: gradeAId } });
      if (fyAId || fyBId) {
        await prisma.financialYear.deleteMany({ where: { companyId: { in: [companyAId, companyBId] } } });
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

runPhase2DatabaseTests();
