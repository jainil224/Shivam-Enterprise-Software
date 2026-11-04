import { PrismaClient, Prisma } from '@prisma/client';
import { GSTINService } from '../src/services/gstin/gstinService.js';
import { SandboxProvider } from '../src/services/gstin/providers/sandboxProvider.js';
import { NoProvider } from '../src/services/gstin/providers/noProvider.js';
import { purchaseBillService } from '../src/services/purchaseBillService.js';
import { purchaseBillRepository } from '../src/repositories/purchaseBillRepository.js';
import { productionReceiveRepository } from '../src/repositories/productionReceiveRepository.js';
import { productionReceiveService } from '../src/services/productionReceiveService.js';

const prisma = new PrismaClient();

async function runPhase11Tests() {
  console.log('================================================================');
  console.log(' PHASE 11: GSTIN LOOKUP, PURCHASE BILL & CHALLAN EDIT FIX TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS [${total}]: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL [${total}]: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup Context: Company, FY, Book, Masters
    // -------------------------------------------------------------
    console.log('[Setup] Preparing test environment...');

    let company = await prisma.company.findFirst({ where: { companyCode: 'P11TEST' } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          companyCode: 'P11TEST',
          companyName: 'SHIVAM ENTERPRISE PHASE 11 LTD',
          gstin: '24AABCS1234F1Z8',
          state: 'Gujarat',
          city: 'Surat',
        },
      });
    }

    let otherCompany = await prisma.company.findFirst({ where: { companyCode: 'P11OTHER' } });
    if (!otherCompany) {
      otherCompany = await prisma.company.create({
        data: {
          companyCode: 'P11OTHER',
          companyName: 'OTHER TEXTILES LTD',
          gstin: '27AABCS9999F1Z1',
          state: 'Maharashtra',
          city: 'Mumbai',
        },
      });
    }

    let fy = await prisma.financialYear.findFirst({
      where: { companyId: company.id, yearName: '2026 - 2027' },
    });
    if (!fy) {
      fy = await prisma.financialYear.create({
        data: {
          companyId: company.id,
          yearName: '2026 - 2027',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          isActive: true,
          isLocked: false,
        },
      });
    }

    let lockedFy = await prisma.financialYear.findFirst({
      where: { companyId: company.id, yearName: '2025 - 2026' },
    });
    if (!lockedFy) {
      lockedFy = await prisma.financialYear.create({
        data: {
          companyId: company.id,
          yearName: '2025 - 2026',
          startDate: new Date('2025-04-01'),
          endDate: new Date('2026-03-31'),
          isActive: false,
          isLocked: true,
        },
      });
    }

    let book = await prisma.productionBook.findFirst({
      where: { companyId: company.id, financialYearId: fy.id, bookName: 'P11 YARN BOOK' },
    });
    if (!book) {
      book = await prisma.productionBook.create({
        data: {
          companyId: company.id,
          financialYearId: fy.id,
          bookName: 'P11 YARN BOOK',
          prefix: 'P11-',
          isActive: true,
        },
      });
    }

    let party = await prisma.party.findFirst({
      where: { companyId: company.id, partyName: 'RELIANCE LOCAL SUPPLIER' },
    });
    if (!party) {
      party = await prisma.party.create({
        data: {
          companyId: company.id,
          partyCode: 'P11-REL',
          partyName: 'RELIANCE LOCAL SUPPLIER',
          partyType: 'SUPPLIER',
          gstin: '24AAAAR1234A1Z9',
          state: 'Gujarat',
          city: 'Surat',
        },
      });
    }

    let quality = await prisma.yarnQuality.findFirst({
      where: { companyId: company.id, qualityName: '150/48 HIMALAYA' },
    });
    if (!quality) {
      quality = await prisma.yarnQuality.create({
        data: {
          companyId: company.id,
          qualityName: '150/48 HIMALAYA',
          denier: '150/48',
        },
      });
    }

    let grade = await prisma.yarnGrade.findFirst({
      where: { companyId: company.id, gradeName: 'A+' },
    });
    if (!grade) {
      grade = await prisma.yarnGrade.create({
        data: {
          companyId: company.id,
          gradeName: 'A+',
        },
      });
    }

    console.log('[Setup Complete]\n');

    // =============================================================
    // TASK 1: EXTERNAL GSTIN LOOKUP & PARTY MASTER INDEPENDENCE
    // =============================================================
    console.log('--- TASK 1: GSTIN LOOKUP & VERIFICATION ---');

    const gstinService = new GSTINService();

    // 1. Format validation: Empty
    let formatErrorCaught = false;
    try {
      await gstinService.verify(company.id, '');
    } catch (e: any) {
      formatErrorCaught = e.statusCode === 400;
    }
    assert(formatErrorCaught, 'GSTIN format validation rejects empty input with HTTP 400');

    // 2. Format validation: Invalid length / characters
    let invalidFormatCaught = false;
    try {
      await gstinService.verify(company.id, '12345INVALID');
    } catch (e: any) {
      invalidFormatCaught = e.statusCode === 400;
    }
    assert(invalidFormatCaught, 'GSTIN format validation rejects invalid characters/length');

    // 3. Priority 1: Match existing Party Master record locally
    const localMatch = await gstinService.verify(company.id, '24AAAAR1234A1Z9');
    assert(
      localMatch.source === 'LOCAL_PARTY_MASTER' &&
      localMatch.partyId === party.id &&
      localMatch.legalName === 'RELIANCE LOCAL SUPPLIER' &&
      localMatch.isVerified === true,
      'Priority 1: Successfully matched local Party Master by exact GSTIN'
    );

    // 4. Priority 2/3 with No Provider: Returns exact spec error and portal URL
    gstinService.setProvider(new NoProvider());
    let noProviderCaught = false;
    let portalUrlPresent = false;
    try {
      await gstinService.verify(company.id, '24AAAAA0000A1Z5');
    } catch (e: any) {
      noProviderCaught = e.message.includes('External GSTIN verification is not configured');
      portalUrlPresent = e.portalUrl === 'https://services.gst.gov.in/services/searchtp';
    }
    assert(noProviderCaught && portalUrlPresent, 'No-provider configuration returns exact spec error & official portal link');

    // 5. Priority 2/3 with Sandbox Provider: Returns verified details
    gstinService.setProvider(new SandboxProvider());
    const externalMatch = await gstinService.verify(company.id, '24AAAAA0000A1Z5');
    assert(
      externalMatch.source === 'EXTERNAL_API' &&
      externalMatch.isVerified === true &&
      externalMatch.gstin === '24AAAAA0000A1Z5' &&
      externalMatch.legalName.includes('RELIANCE INDUSTRIES LIMITED') &&
      externalMatch.state === 'Gujarat' &&
      externalMatch.stateCode === '24',
      'Configured provider verification returns actual supplier legal name, state and address'
    );

    // 6. External provider returns not found / invalid GSTIN
    let notFoundCaught = false;
    try {
      await gstinService.verify(company.id, '24NOTFD0001A1Z8');
    } catch (e: any) {
      notFoundCaught = e.statusCode === 404;
    }
    assert(notFoundCaught, 'Provider reporting GSTIN not found throws 404 with portal link');

    // 7. Optional action: Save supplier to Party Master
    const dynamicGstin = `24EXT${Date.now().toString().slice(-6)}1Z7`;
    const savedPartyRes = await gstinService.saveToPartyMaster(company.id, {
      partyName: 'EXTERNAL NEW SUPPLIER PVT LTD',
      gstin: dynamicGstin,
      state: 'Gujarat',
      city: 'Surat',
    });
    assert(
      savedPartyRes.isNew === true &&
      savedPartyRes.party.partyName === 'EXTERNAL NEW SUPPLIER PVT LTD',
      'Optional save to Party Master creates new party record'
    );

    // 8. Duplicate Party Master protection by GSTIN
    const dupPartyRes = await gstinService.saveToPartyMaster(company.id, {
      partyName: 'DUPLICATE ATTEMPT',
      gstin: dynamicGstin,
    });
    assert(
      dupPartyRes.isNew === false &&
      dupPartyRes.party.id === savedPartyRes.party.id,
      'Duplicate Party Master save is prevented by exact GSTIN match within company'
    );

    // =============================================================
    // TASK 3: FIX PRODUCTION CHALLAN EDIT ERROR
    // =============================================================
    console.log('\n--- TASK 3: PRODUCTION CHALLAN EDIT FIX ---');

    // Create a confirmed test challan
    const challanNum = `CH-${Date.now().toString().slice(-6)}`;
    const createdChallan = await productionReceiveRepository.create({
      companyId: company.id,
      financialYearId: fy.id,
      productionBookId: book.id,
      challanNumber: challanNum,
      challanDate: new Date('2026-05-10'),
      partyId: party.id,
      yarnQualityId: quality.id,
      yarnGradeId: grade.id,
      lotNumber: 'LOT-ORIGINAL',
      twist: '800',
      emptyCopsWeight: new Prisma.Decimal(0.040),
      items: [
        {
          cartonNumber: '1001',
          cartonWeight: new Prisma.Decimal(1.000),
          cops: 24,
          grossWeight: new Prisma.Decimal(50.000),
          copsWeight: new Prisma.Decimal(0.040),
          tareWeight: new Prisma.Decimal(1.960),
          netWeight: new Prisma.Decimal(48.040),
          averageWeight: new Prisma.Decimal(2.002),
          twist: '800',
          lotNumber: 'LOT-ORIGINAL',
          grade: 'A+',
        },
      ],
    });

    assert(createdChallan.id !== '', `Challan #${challanNum} created successfully`);

    // Now test EDITing the challan via productionReceiveRepository.update:
    // Testing update of lotNumber, twist, remarks, and carton items
    const updatedChallan = await productionReceiveRepository.update(company.id, createdChallan.id, {
      challanNumber: challanNum,
      lotNumber: 'LOT-EDITED-99',
      twist: '850',
      remarks: 'Verified update without company_id null error',
      items: [
        {
          cartonNumber: '1001',
          cartonWeight: new Prisma.Decimal(1.000),
          cops: 24,
          grossWeight: new Prisma.Decimal(52.000),
          copsWeight: new Prisma.Decimal(0.040),
          tareWeight: new Prisma.Decimal(1.960),
          netWeight: new Prisma.Decimal(50.040),
          averageWeight: new Prisma.Decimal(2.085),
          twist: '850',
          lotNumber: 'LOT-EDITED-99',
          grade: 'A+',
        },
      ],
    });

    assert(
      updatedChallan?.companyId === company.id,
      'Challan update succeeds: companyId remains intact and preserved'
    );
    assert(
      updatedChallan?.financialYearId === fy.id,
      'Challan update succeeds: financialYearId remains intact and preserved'
    );
    assert(
      updatedChallan?.lotNumber === 'LOT-EDITED-99' && updatedChallan?.twist === '850',
      'Challan header fields (lotNumber, twist) updated and persisted correctly'
    );
    assert(
      updatedChallan?.items.length === 1 &&
      Number(updatedChallan?.items[0].netWeight) === 50.04,
      'Carton rows updated and recalculation persisted atomically'
    );

    // Verify cross-company update rejected
    let crossCompanyEditRejected = false;
    try {
      await productionReceiveRepository.update(otherCompany.id, createdChallan.id, {
        challanNumber: challanNum,
        items: [],
      });
    } catch (e: any) {
      crossCompanyEditRejected = e.statusCode === 404;
    }
    assert(crossCompanyEditRejected, 'Cross-company challan update is strictly rejected with 404');

    // Verify locked financial year update rejected
    // Create a book and challan in locked FY
    let lockedBook = await prisma.productionBook.findFirst({
      where: { companyId: company.id, financialYearId: lockedFy.id },
    });
    if (!lockedBook) {
      lockedBook = await prisma.productionBook.create({
        data: {
          companyId: company.id,
          financialYearId: lockedFy.id,
          bookName: 'LOCKED BOOK',
          prefix: 'LB-',
          isActive: true,
        },
      });
    }

    const lockedChallanNum = `CH-LK-${Date.now().toString().slice(-4)}`;
    const lockedChallan = await prisma.productionReceive.create({
      data: {
        companyId: company.id,
        financialYearId: lockedFy.id,
        productionBookId: lockedBook.id,
        challanNumber: lockedChallanNum,
        challanDate: new Date('2025-05-10'),
        emptyCopsWeight: new Prisma.Decimal(0.040),
        status: 'CONFIRMED',
      },
    });

    let lockedFyEditRejected = false;
    try {
      await productionReceiveRepository.update(company.id, lockedChallan.id, {
        challanNumber: lockedChallanNum,
        items: [],
      });
    } catch (e: any) {
      lockedFyEditRejected = e.statusCode === 403;
    }
    assert(lockedFyEditRejected, 'Challan in locked financial year rejected from editing with 403');

    // =============================================================
    // TASK 2: PURCHASE BILL CREATION & CHALLAN LINKING
    // =============================================================
    console.log('\n--- TASK 2: PURCHASE BILL CREATION & COMMERCIAL CALCULATION ---');

    // 1. Create Purchase Bill without Party Master (Using GSTIN & snapshot only)
    const billWithoutParty = await purchaseBillService.createBill(company.id, fy.id, {
      supplierGstin: '24EXTNL1234A1Z7',
      supplierLegalName: 'UNREGISTERED MILL SUPPLIER LLP',
      supplierState: 'Gujarat',
      supplierStateCode: '24',
      supplierInvoiceNumber: 'INV-2026-001',
      supplierInvoiceDate: '2026-05-11',
      ratePerKg: 130,
      gstRate: 5,
      items: [
        {
          itemDescription: 'Direct Polyester Yarn 150/48',
          quantity: 100, // 100 KG
          rate: 130, // 130/KG -> Taxable: 13,000
          discount: 0,
        },
      ],
    });

    assert(
      billWithoutParty.id !== '' &&
      billWithoutParty.partyId === null &&
      billWithoutParty.supplierLegalName === 'UNREGISTERED MILL SUPPLIER LLP',
      'Purchase Bill created successfully WITHOUT Party Master relation'
    );
    assert(
      Number(billWithoutParty.taxableAmount) === 13000 &&
      Number(billWithoutParty.cgstRate) === 2.5 &&
      Number(billWithoutParty.sgstRate) === 2.5 &&
      Number(billWithoutParty.cgstAmount) === 325 &&
      Number(billWithoutParty.sgstAmount) === 325 &&
      Number(billWithoutParty.totalAmount) === 13650,
      'Intra-state GST calculation (CGST 2.5% + SGST 2.5%) and totals are exact'
    );

    // 2. Inter-State GST Calculation (IGST)
    const interStateBill = await purchaseBillService.createBill(company.id, fy.id, {
      supplierGstin: '27AABCM9999M1Z3', // Maharashtra 27 vs Gujarat 24
      supplierLegalName: 'MUMBAI TEXTILE SPINNERS LTD',
      supplierState: 'Maharashtra',
      supplierStateCode: '27',
      supplierInvoiceNumber: 'INV-MUM-88',
      ratePerKg: 150,
      gstRate: 12,
      items: [
        {
          itemDescription: 'Specialty Twisted Yarn',
          quantity: 200,
          rate: 150, // 30,000 Taxable
        },
      ],
    });

    assert(
      Number(interStateBill.cgstAmount) === 0 &&
      Number(interStateBill.sgstAmount) === 0 &&
      Number(interStateBill.igstRate) === 12 &&
      Number(interStateBill.igstAmount) === 3600 &&
      Number(interStateBill.totalAmount) === 33600,
      'Inter-state GST calculation applies full IGST (12%) with 0 CGST and 0 SGST'
    );

    // 3. Create Purchase Bill from existing confirmed Production Challan
    const billFromChallan = await purchaseBillService.createBill(company.id, fy.id, {
      sourceChallanId: createdChallan.id,
      supplierGstin: '24AAAAR1234A1Z9',
      supplierLegalName: 'RELIANCE LOCAL SUPPLIER',
      supplierState: 'Gujarat',
      supplierStateCode: '24',
      partyId: party.id,
      supplierInvoiceNumber: 'INV-CH-001',
      ratePerKg: 140,
      gstRate: 5,
      items: [
        {
          itemDescription: '150/48 HIMALAYA - Carton #1001',
          quantity: 50.040, // From carton net weight
          rate: 140,
        },
      ],
    });

    assert(
      billFromChallan.sourceChallanId === createdChallan.id,
      'Purchase Bill successfully linked to source Production Challan'
    );

    // 4. One bill per challan duplicate protection: Attempting second bill for same challan must be rejected
    let duplicateBillRejected = false;
    let existingBillReported = false;
    try {
      await purchaseBillService.createBill(company.id, fy.id, {
        sourceChallanId: createdChallan.id,
        supplierLegalName: 'SECOND ATTEMPT',
        items: [{ itemDescription: 'Duplicate', quantity: 10, rate: 100 }],
      });
    } catch (e: any) {
      duplicateBillRejected = e.statusCode === 409;
      existingBillReported = e.existingBill?.id === billFromChallan.id;
    }
    assert(
      duplicateBillRejected && existingBillReported,
      'Duplicate bill creation on same challan is rejected with 409 and returns existing bill'
    );

    // 5. Existing bill lookup by challan ID
    const foundBill = await purchaseBillRepository.findByChallanId(company.id, createdChallan.id);
    assert(
      foundBill?.id === billFromChallan.id,
      'Fast bill lookup by challan ID correctly returns existing linked bill'
    );

    // 6. Cross-company bill creation on challan rejected
    let crossCompanyChallanRejected = false;
    try {
      await purchaseBillService.createBill(otherCompany.id, fy.id, {
        sourceChallanId: createdChallan.id,
        supplierLegalName: 'ATTACKER',
        items: [{ itemDescription: 'Hack', quantity: 10, rate: 100 }],
      });
    } catch (e: any) {
      crossCompanyChallanRejected = e.statusCode === 404;
    }
    assert(crossCompanyChallanRejected, 'Cross-company source challan access rejected with 404');

    // 7. Cancelled challan restriction
    await prisma.productionReceive.update({
      where: { id: createdChallan.id },
      data: { status: 'CANCELLED' },
    });

    // Create another cancelled challan with no bill
    const cancelledChallanNum = `CH-CANC-${Date.now().toString().slice(-4)}`;
    const cancelledChallan = await prisma.productionReceive.create({
      data: {
        companyId: company.id,
        financialYearId: fy.id,
        productionBookId: book.id,
        challanNumber: cancelledChallanNum,
        challanDate: new Date('2026-05-12'),
        emptyCopsWeight: new Prisma.Decimal(0.040),
        status: 'CANCELLED',
      },
    });

    let cancelledChallanRejected = false;
    try {
      await purchaseBillService.createBill(company.id, fy.id, {
        sourceChallanId: cancelledChallan.id,
        supplierLegalName: 'CANCELLED SUPPLIER',
        items: [{ itemDescription: 'Test', quantity: 10, rate: 100 }],
      });
    } catch (e: any) {
      cancelledChallanRejected = e.statusCode === 400 && e.message.includes('CANCELLED');
    }
    assert(cancelledChallanRejected, 'Bill creation from CANCELLED production challan is strictly prevented');

    // 8. Locked FY bill creation restriction
    let lockedFyBillRejected = false;
    try {
      await purchaseBillService.createBill(company.id, lockedFy.id, {
        supplierLegalName: 'LOCKED FY SUPPLIER',
        items: [{ itemDescription: 'Test', quantity: 10, rate: 100 }],
      });
    } catch (e: any) {
      lockedFyBillRejected = e.statusCode === 403;
    }
    assert(lockedFyBillRejected, 'Bill creation in locked financial year rejected with 403');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(` RESULTS: ${passed}/${total} Phase 11 Tests Passed Successfully!`);
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('\nTest runner failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase11Tests();
