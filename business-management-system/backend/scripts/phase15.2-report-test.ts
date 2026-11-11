// Phase 15.2 - Sales & Purchase Report (Bill Base) master data + all-format test.
// Every expected value below comes from the fixtures created in this file or
// from the database. Nothing is hardcoded to make a check pass.
import { inflateRawSync } from 'node:zlib';
import { Prisma, PrismaClient } from '@prisma/client';
import { REPORT_FORMATS, reportService } from '../src/services/reportService.js';
import { reportLayoutService } from '../src/services/reportLayoutService.js';
import { buildPdf } from '../src/utils/pdfWriter.js';
import { debitNoteService } from '../src/services/debitNoteService.js';
import type { DebitNoteBillLineInput, DebitNotePayload } from '../src/services/debitNoteService.js';
import {
  PartyGroupService,
  AreaService,
  BrokerService,
  TransporterService,
  SalespersonService,
  ItemGroupService,
  PurchaseBookService,
} from '../src/services/reportMasterService.js';
import type { ReportRunRequest, ReportRunResponse } from '../src/types/reportTypes.js';

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string): void {
  total++;
  if (condition) {
    console.log(`  PASS [${total}]: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL [${total}]: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function section(title: string): void {
  console.log(`\n--- ${title} ---`);
}

function close(actual: number, expected: number, tolerance = 0.005): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

interface CaughtError {
  statusCode?: number;
  message: string;
}

async function expectError(fn: () => Promise<unknown>, expectedStatus: number, label: string): Promise<CaughtError> {
  try {
    await fn();
  } catch (error) {
    const err = error as CaughtError;
    assert(
      err.statusCode === expectedStatus,
      `${label} (expected ${expectedStatus}, received ${err.statusCode ?? 'none'}: ${err.message})`
    );
    return err;
  }
  assert(false, `${label} (expected rejection with ${expectedStatus}, but the call succeeded)`);
  return { message: '' };
}

interface ZipEntry {
  name: string;
  content: string;
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
    const dataStart = offset + 30 + nameLength + extraLength;
    const raw = buffer.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? raw.toString('utf8') : inflateRawSync(raw).toString('utf8');
    entries.push({ name, content });
    offset = dataStart + compressedSize;
  }
  return entries;
}

const TEST_COMPANY_CODE = 'P152TEST';
const OTHER_COMPANY_CODE = 'P152OTHER';

async function cleanupTestData(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.debitNote.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBill.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.debitNoteBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.item.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.itemGroup.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.partyGroup.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.area.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.broker.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.transporter.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.salesperson.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.yarnQuality.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.yarnGrade.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}
interface Fixture {
  companyId: string;
  otherCompanyId: string;
  financialYearId: string;
  otherFinancialYearId: string;
  partyGroupYarnId: string;
  partyGroupFabricId: string;
  areaRingRoadId: string;
  areaPowerloomId: string;
  brokerOneId: string;
  brokerTwoId: string;
  transporterOneId: string;
  transporterTwoId: string;
  salespersonOneId: string;
  salespersonTwoId: string;
  itemGroupYarnId: string;
  itemGroupFabricId: string;
  bookYarnId: string;
  bookFabricId: string;
  itemYarnId: string;
  itemFabricId: string;
  partyAlphaId: string;
  partyBetaId: string;
  partyDeliveryId: string;
  billOneId: string;
  billTwoId: string;
  billThreeId: string;
  billCancelledId: string;
  billOutOfRangeId: string;
  debitNoteId: string;
  debitNoteTotal: number;
}

const partyGroupService = new PartyGroupService();
const areaService = new AreaService();
const brokerService = new BrokerService();
const transporterService = new TransporterService();
const salespersonService = new SalespersonService();
const itemGroupService = new ItemGroupService();
const purchaseBookService = new PurchaseBookService();

async function buildFixture(): Promise<Fixture> {
  const company = await prisma.company.create({
    data: {
      companyCode: TEST_COMPANY_CODE,
      companyName: 'SHIVAM ENTERPRISE PHASE 152 LTD',
      gstin: '24AABCS1520F1Z6',
      panNumber: 'AABCS1520F',
      address: 'Plot 22, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '9876500152',
      email: 'accounts@shivam152.example',
    },
  });

  const otherCompany = await prisma.company.create({
    data: {
      companyCode: OTHER_COMPANY_CODE,
      companyName: 'OTHER COMPANY PHASE 152 LTD',
      gstin: '27AABCS1521F1Z7',
      panNumber: 'AABCS1521F',
      address: 'Plot 5, Industrial Estate',
      city: 'Bhiwandi',
      state: 'Maharashtra',
      pincode: '421302',
    },
  });

  const fy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2026 - 2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });

  const otherFy = await prisma.financialYear.create({
    data: {
      companyId: otherCompany.id,
      yearName: '2026 - 2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });

  // All masters are created through the real services so the API validation,
  // duplicate detection and company scoping are exercised, not bypassed.
  const partyGroupYarn = await partyGroupService.create(company.id, {
    groupName: 'Yarn Suppliers',
    description: 'Polyester and cotton yarn suppliers',
  });
  const partyGroupFabric = await partyGroupService.create(company.id, {
    groupName: 'Fabric Suppliers',
    description: 'Fabric and weaving mills',
  });

  const areaRingRoad = await areaService.create(company.id, {
    areaName: 'Ring Road',
    description: 'Surat ring road cluster',
  });
  const areaPowerloom = await areaService.create(company.id, {
    areaName: 'Powerloom Zone',
    description: 'Bhiwandi powerloom cluster',
  });

  const brokerOne = await brokerService.create(company.id, {
    brokerCode: 'BR-01',
    brokerName: 'Mahesh Broker',
    phone: '9825000152',
  });
  const brokerTwo = await brokerService.create(company.id, {
    brokerCode: 'BR-02',
    brokerName: 'Nilesh Broker',
    phone: '9825000153',
  });

  const transporterOne = await transporterService.create(company.id, {
    transporterCode: 'TR-01',
    transporterName: 'Shree Roadlines',
    phone: '9825000154',
  });
  const transporterTwo = await transporterService.create(company.id, {
    transporterCode: 'TR-02',
    transporterName: 'Gujarat Freight',
    phone: '9825000155',
  });

  const salespersonOne = await salespersonService.create(company.id, {
    salespersonCode: 'SP-01',
    salespersonName: 'Nilesh Patel',
    phone: '9825000156',
  });
  const salespersonTwo = await salespersonService.create(company.id, {
    salespersonCode: 'SP-02',
    salespersonName: 'Ketan Shah',
    phone: '9825000157',
  });

  const itemGroupYarn = await itemGroupService.create(company.id, {
    groupName: 'Polyester Yarn',
    description: 'All polyester yarn items',
  });
  const itemGroupFabric = await itemGroupService.create(company.id, {
    groupName: 'Fabric',
    description: 'All fabric items',
  });

  const bookYarn = await purchaseBookService.create(company.id, {
    financialYearId: fy.id,
    bookName: 'Yarn Purchase Book',
    prefix: 'PY-',
  });
  const bookFabric = await purchaseBookService.create(company.id, {
    financialYearId: fy.id,
    bookName: 'Fabric Purchase Book',
    prefix: 'PF-',
  });
  // Yarn quality / grade masters already exist in this BMS; create them with
  // the real Prisma model because Phase 15.2 does not add a service for them.
  const quality40 = await prisma.yarnQuality.create({
    data: { companyId: company.id, qualityName: '40s Cotton', denier: '40' },
  });
  const quality75 = await prisma.yarnQuality.create({
    data: { companyId: company.id, qualityName: '75D Polyester', denier: '75' },
  });
  const gradeA = await prisma.yarnGrade.create({
    data: { companyId: company.id, gradeName: 'A Grade' },
  });
  const gradeB = await prisma.yarnGrade.create({
    data: { companyId: company.id, gradeName: 'B Grade' },
  });

  const itemYarn = await prisma.item.create({
    data: {
      companyId: company.id,
      itemCode: 'P152-ITEM-YARN',
      itemName: 'Polyester Yarn 75D',
      itemCategory: 'Yarn',
      unit: 'KG',
      hsnCode: '5402',
      itemGroupId: itemGroupYarn.id,
      yarnQualityId: quality75.id,
      yarnGradeId: gradeA.id,
    },
  });
  const itemFabric = await prisma.item.create({
    data: {
      companyId: company.id,
      itemCode: 'P152-ITEM-FABRIC',
      itemName: 'Cotton Fabric 40s',
      itemCategory: 'Fabric',
      unit: 'KG',
      hsnCode: '5208',
      itemGroupId: itemGroupFabric.id,
      yarnQualityId: quality40.id,
      yarnGradeId: gradeB.id,
    },
  });

  const partyAlpha = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P152ALPHA',
      partyName: 'Alpha Textiles',
      partyType: 'SUPPLIER',
      gstin: '24AAACA1520A1Z1',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      partyGroupId: partyGroupYarn.id,
      areaId: areaRingRoad.id,
    },
  });
  const partyBeta = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P152BETA',
      partyName: 'Beta Weaving Mills',
      partyType: 'SUPPLIER',
      gstin: '27AAACB1520B1Z2',
      address: 'Powerloom Estate',
      city: 'Bhiwandi',
      state: 'Maharashtra',
      pincode: '421302',
      partyGroupId: partyGroupFabric.id,
      areaId: areaPowerloom.id,
    },
  });
  const partyDelivery = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P152DELIV',
      partyName: 'Gamma Delivery House',
      partyType: 'CUSTOMER',
      city: 'Surat',
      state: 'Gujarat',
    },
  });

  const debitNoteBook = await prisma.debitNoteBook.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      prefix: 'DN-',
      bookName: 'DEBIT NOTE',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: true,
    },
  });

  const creditAccount = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: 'P152-INT-PUR',
      accountName: 'Interest on Purchase',
      accountGroup: 'INDIRECT_EXPENSES',
      accountType: 'EXPENSE',
      balanceType: 'DEBIT',
      openingBalance: new Prisma.Decimal(0),
      isBankAccount: false,
    },
  });

  const billOne = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P152-PB-001',
      billDate: new Date('2026-04-10T00:00:00.000Z'),
      partyId: partyAlpha.id,
      bookId: bookYarn.id,
      brokerId: brokerOne.id,
      transporterId: transporterOne.id,
      salespersonId: salespersonOne.id,
      deliveryPartyId: partyDelivery.id,
      vehicleNumber: 'GJ-05-AB-1234',
      supplierGstin: '24AAACA1520A1Z1',
      supplierLegalName: 'Alpha Textiles',
      supplierCity: 'Surat',
      supplierState: 'Gujarat',
      supplierInvoiceNumber: 'P152-INV-1001',
      placeOfSupply: 'Gujarat',
      totalQuantity: new Prisma.Decimal(100),
      taxableAmount: new Prisma.Decimal(10000),
      cgstRate: new Prisma.Decimal(2.5),
      cgstAmount: new Prisma.Decimal(250),
      sgstRate: new Prisma.Decimal(2.5),
      sgstAmount: new Prisma.Decimal(250),
      totalAmount: new Prisma.Decimal(10500),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemId: itemYarn.id,
            itemDescription: 'Polyester Yarn 75D',
            hsnCode: '5402',
            quantity: new Prisma.Decimal(60),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(6000),
            cartonNumber: 'C-152-1',
            lotNumber: 'LOT-152-1',
            grade: 'A Grade',
            yarnQualityId: quality40.id,
            yarnGradeId: gradeA.id,
          },
          {
            itemId: itemYarn.id,
            itemDescription: 'Polyester Yarn 75D',
            hsnCode: '5402',
            quantity: new Prisma.Decimal(40),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(4000),
            cartonNumber: 'C-152-2',
            lotNumber: 'LOT-152-1',
            grade: 'A Grade',
            yarnQualityId: quality40.id,
            yarnGradeId: gradeA.id,
          },
        ],
      },
    },
  });

  const billTwo = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P152-PB-002',
      billDate: new Date('2026-05-12T00:00:00.000Z'),
      partyId: partyBeta.id,
      bookId: bookFabric.id,
      brokerId: brokerTwo.id,
      transporterId: transporterTwo.id,
      salespersonId: salespersonTwo.id,
      vehicleNumber: 'GJ-05-CD-5678',
      supplierGstin: '27AAACB1520B1Z2',
      supplierLegalName: 'Beta Weaving Mills',
      supplierCity: 'Bhiwandi',
      supplierState: 'Maharashtra',
      supplierInvoiceNumber: 'P152-INV-1002',
      placeOfSupply: 'Maharashtra',
      totalQuantity: new Prisma.Decimal(200),
      taxableAmount: new Prisma.Decimal(30000),
      igstRate: new Prisma.Decimal(5),
      igstAmount: new Prisma.Decimal(1500),
      totalAmount: new Prisma.Decimal(31500),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemId: itemFabric.id,
            itemDescription: 'Cotton Fabric 40s',
            hsnCode: '5208',
            quantity: new Prisma.Decimal(200),
            unit: 'KG',
            rate: new Prisma.Decimal(150),
            taxableAmount: new Prisma.Decimal(30000),
            cartonNumber: 'C-152-3',
            lotNumber: 'LOT-152-2',
            grade: 'B Grade',
            yarnQualityId: quality75.id,
            yarnGradeId: gradeB.id,
          },
        ],
      },
    },
  });

  const billThree = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P152-PB-003',
      billDate: new Date('2026-06-20T00:00:00.000Z'),
      partyId: partyAlpha.id,
      bookId: bookYarn.id,
      brokerId: brokerOne.id,
      transporterId: transporterOne.id,
      salespersonId: salespersonOne.id,
      vehicleNumber: 'GJ-05-AB-1234',
      supplierGstin: '24AAACA1520A1Z1',
      supplierLegalName: 'Alpha Textiles',
      supplierCity: 'Surat',
      supplierState: 'Gujarat',
      supplierInvoiceNumber: 'P152-INV-1003',
      placeOfSupply: 'Gujarat',
      totalQuantity: new Prisma.Decimal(50),
      taxableAmount: new Prisma.Decimal(5000),
      cgstRate: new Prisma.Decimal(2.5),
      cgstAmount: new Prisma.Decimal(125),
      sgstRate: new Prisma.Decimal(2.5),
      sgstAmount: new Prisma.Decimal(125),
      totalAmount: new Prisma.Decimal(5250),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemId: itemYarn.id,
            itemDescription: 'Polyester Yarn 75D',
            hsnCode: '5402',
            quantity: new Prisma.Decimal(50),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(5000),
            cartonNumber: 'C-152-4',
            lotNumber: 'LOT-152-1',
            grade: 'A Grade',
            yarnQualityId: quality40.id,
            yarnGradeId: gradeA.id,
          },
        ],
      },
    },
  });

  const billCancelled = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P152-PB-004',
      billDate: new Date('2026-07-01T00:00:00.000Z'),
      partyId: partyAlpha.id,
      supplierGstin: '24AAACA1520A1Z1',
      supplierLegalName: 'Alpha Textiles',
      supplierCity: 'Surat',
      supplierState: 'Gujarat',
      totalQuantity: new Prisma.Decimal(70),
      taxableAmount: new Prisma.Decimal(7000),
      totalAmount: new Prisma.Decimal(7350),
      status: 'CANCELLED',
      items: {
        create: [
          {
            itemDescription: 'Cancelled Stock',
            quantity: new Prisma.Decimal(70),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(7000),
          },
        ],
      },
    },
  });

  const billOutOfRange = await prisma.purchaseBill.create({
    data: {
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'P152-PB-OLD',
      billDate: new Date('2025-05-01T00:00:00.000Z'),
      partyId: partyAlpha.id,
      supplierGstin: '24AAACA1520A1Z1',
      supplierLegalName: 'Alpha Textiles',
      supplierCity: 'Surat',
      supplierState: 'Gujarat',
      totalQuantity: new Prisma.Decimal(10),
      taxableAmount: new Prisma.Decimal(1000),
      totalAmount: new Prisma.Decimal(1000),
      status: 'CONFIRMED',
      items: {
        create: [
          {
            itemDescription: 'Previous Year Stock',
            quantity: new Prisma.Decimal(10),
            unit: 'KG',
            rate: new Prisma.Decimal(100),
            taxableAmount: new Prisma.Decimal(1000),
          },
        ],
      },
    },
  });

  const line = (overrides: Partial<DebitNoteBillLineInput> = {}): DebitNoteBillLineInput => ({
    billNo: 'P152-PB-001',
    billDate: '2026-04-10',
    totalDays: 45,
    dharaDays: 5,
    paidAmount: 0,
    itemDescription: 'Polyester Yarn 75D',
    quantity: 100,
    billTaxable: 10000,
    billAmount: 10500,
    unpaidAmount: 10500,
    sgstRate: 2.5,
    cgstRate: 2.5,
    igstRate: 0,
    rate: 12,
    ...overrides,
  });

  const notePayload: DebitNotePayload = {
    bookId: debitNoteBook.id,
    noteDate: '2026-09-05',
    noteType: 'PURCHASE',
    partyId: partyAlpha.id,
    dueDays: 45,
    creditAccountId: creditAccount.id,
    osEffect: '2.OS(+)',
    reason: 'INTEREST',
    calculationBasis: 'BILL_AMOUNT',
    gstRate: 5,
    brokerId: brokerTwo.id,
    transporterId: transporterTwo.id,
    salespersonId: salespersonTwo.id,
    vehicleNumber: 'GJ-05-XY-9999',
    billLines: [line()],
  };

  const debitNote = await debitNoteService.create(company.id, fy.id, notePayload);

  return {
    companyId: company.id,
    otherCompanyId: otherCompany.id,
    financialYearId: fy.id,
    otherFinancialYearId: otherFy.id,
    partyGroupYarnId: partyGroupYarn.id,
    partyGroupFabricId: partyGroupFabric.id,
    areaRingRoadId: areaRingRoad.id,
    areaPowerloomId: areaPowerloom.id,
    brokerOneId: brokerOne.id,
    brokerTwoId: brokerTwo.id,
    transporterOneId: transporterOne.id,
    transporterTwoId: transporterTwo.id,
    salespersonOneId: salespersonOne.id,
    salespersonTwoId: salespersonTwo.id,
    itemGroupYarnId: itemGroupYarn.id,
    itemGroupFabricId: itemGroupFabric.id,
    bookYarnId: bookYarn.id,
    bookFabricId: bookFabric.id,
    itemYarnId: itemYarn.id,
    itemFabricId: itemFabric.id,
    partyAlphaId: partyAlpha.id,
    partyBetaId: partyBeta.id,
    partyDeliveryId: partyDelivery.id,
    billOneId: billOne.id,
    billTwoId: billTwo.id,
    billThreeId: billThree.id,
    billCancelledId: billCancelled.id,
    billOutOfRangeId: billOutOfRange.id,
    debitNoteId: debitNote.id,
    debitNoteTotal: Number(debitNote.totalAmount),
  };
}
function baseRequest(overrides: Partial<ReportRunRequest> = {}): ReportRunRequest {
  return {
    dateFrom: '2026-04-01',
    dateTo: '2027-03-31',
    mode: 'PURCHASE',
    format: 'BILL_NO_WISE',
    rateColumn: 'BASIC',
    detailMode: 'DETAIL',
    page: 1,
    pageSize: 100,
    sortDir: 'asc',
    ...overrides,
  };
}

async function run(fixture: Fixture, overrides: Partial<ReportRunRequest> = {}): Promise<ReportRunResponse> {
  return reportService.execute(fixture.companyId, fixture.financialYearId, baseRequest(overrides));
}

// Phase 15.2 expected purchase totals, derived from the fixture bills only.
const EXPECTED_PURCHASE_TOTAL = 10500 + 31500 + 5250;
const EXPECTED_PURCHASE_TAXABLE = 10000 + 30000 + 5000;

async function runMasterCrudSection(fixture: Fixture): Promise<void> {
  section('15.2 masters - CRUD, validation, company scoping');

  const groups = await partyGroupService.list(fixture.companyId);
  assert(groups.length === 2, `party group list returns the 2 fixture groups (received ${groups.length})`);

  const areas = await areaService.list(fixture.companyId);
  assert(areas.length === 2, `area list returns the 2 fixture areas (received ${areas.length})`);

  const brokers = await brokerService.list(fixture.companyId);
  assert(brokers.length === 2, `broker list returns the 2 fixture brokers (received ${brokers.length})`);

  const transporters = await transporterService.list(fixture.companyId);
  assert(
    transporters.length === 2,
    `transporter list returns the 2 fixture transporters (received ${transporters.length})`
  );

  const salespersons = await salespersonService.list(fixture.companyId);
  assert(
    salespersons.length === 2,
    `salesperson list returns the 2 fixture salespersons (received ${salespersons.length})`
  );

  const itemGroups = await itemGroupService.list(fixture.companyId);
  assert(itemGroups.length === 2, `item group list returns the 2 fixture item groups (received ${itemGroups.length})`);

  const books = await purchaseBookService.list(fixture.companyId, fixture.financialYearId);
  assert(books.length === 2, `purchase book list returns the 2 fixture books (received ${books.length})`);

  await expectError(
    () => purchaseBookService.list(fixture.companyId, fixture.otherFinancialYearId),
    400,
    'a financial year owned by another company is rejected when listing purchase books'
  );

  // Duplicate and invalid input must be rejected, never silently accepted.
  await expectError(
    () => partyGroupService.create(fixture.companyId, { groupName: 'Yarn Suppliers' }),
    409,
    'duplicate party group name is rejected with 409'
  );
  await expectError(
    () => partyGroupService.create(fixture.companyId, { groupName: '   ' }),
    400,
    'blank party group name is rejected with 400'
  );
  await expectError(
    () => brokerService.create(fixture.companyId, { brokerCode: '', brokerName: 'No Code' }),
    400,
    'broker without a code is rejected with 400'
  );
  await expectError(
    () => transporterService.create(fixture.companyId, { transporterCode: 'TR-01', transporterName: 'Duplicate' }),
    409,
    'duplicate transporter code is rejected with 409'
  );
  await expectError(
    () =>
      purchaseBookService.create(fixture.companyId, {
        financialYearId: fixture.financialYearId,
        bookName: 'Yarn Purchase Book',
        prefix: 'PX-',
      }),
    409,
    'duplicate purchase book name inside the financial year is rejected with 409'
  );
  await expectError(
    () =>
      purchaseBookService.create(fixture.companyId, {
        financialYearId: fixture.financialYearId,
        bookName: 'Fresh Book',
        prefix: 'PY-',
      }),
    409,
    'duplicate purchase book prefix inside the financial year is rejected with 409'
  );

  // Company scoping: another company must never see these masters.
  const otherGroups = await partyGroupService.list(fixture.otherCompanyId);
  assert(otherGroups.length === 0, 'party groups are company scoped (other company sees none)');
  await expectError(
    () => partyGroupService.getById(fixture.otherCompanyId, fixture.partyGroupYarnId),
    404,
    'party group of another company is not readable (404)'
  );
  await expectError(
    () => brokerService.getById(fixture.otherCompanyId, fixture.brokerOneId),
    404,
    'broker of another company is not readable (404)'
  );

  // Update and rename must persist.
  const tempBroker = await brokerService.create(fixture.companyId, {
    brokerCode: 'BR-TMP',
    brokerName: 'Temporary Broker',
  });
  const renamed = await brokerService.update(fixture.companyId, tempBroker.id, { brokerName: 'Renamed Broker' });
  assert(renamed.brokerName === 'Renamed Broker', 'broker update persists the new name');
  const reloaded = await brokerService.getById(fixture.companyId, tempBroker.id);
  assert(reloaded.brokerName === 'Renamed Broker', 'broker rename is readable after reload');
  const deactivated = await brokerService.setStatus(fixture.companyId, tempBroker.id, false);
  assert(deactivated.isActive === false, 'unused broker can be deactivated');
  const activeBrokers = await brokerService.list(fixture.companyId);
  assert(activeBrokers.length === 2, 'inactive broker is excluded from the default list');
  const allBrokers = await brokerService.list(fixture.companyId, { includeInactive: true });
  assert(allBrokers.length === 3, 'inactive broker is returned when includeInactive is requested');

  // Referenced masters must not be deactivatable.
  await expectError(
    () => partyGroupService.setStatus(fixture.companyId, fixture.partyGroupYarnId, false),
    409,
    'party group referenced by a party cannot be deactivated (409)'
  );
  const groupUsage = await partyGroupService.usage(fixture.companyId, fixture.partyGroupYarnId);
  assert(groupUsage.parties === 1, `party group usage reports 1 party (received ${groupUsage.parties})`);

  await expectError(
    () => itemGroupService.setStatus(fixture.companyId, fixture.itemGroupYarnId, false),
    409,
    'item group referenced by an item cannot be deactivated (409)'
  );
  await expectError(
    () => purchaseBookService.setStatus(fixture.companyId, fixture.bookYarnId, false),
    409,
    'purchase book referenced by a bill cannot be deactivated (409)'
  );

  const tempArea = await areaService.create(fixture.companyId, { areaName: 'Temporary Area' });
  const areaOff = await areaService.setStatus(fixture.companyId, tempArea.id, false);
  assert(areaOff.isActive === false, 'unreferenced area can be deactivated');
  await areaService.setStatus(fixture.companyId, tempArea.id, true);
  const areasAfter = await areaService.list(fixture.companyId);
  assert(areasAfter.length === 3, 'reactivated area returns to the active list');

  const tempSalesperson = await salespersonService.create(fixture.companyId, {
    salespersonCode: 'SP-TMP',
    salespersonName: 'Temporary Salesperson',
  });
  const salespersonOff = await salespersonService.setStatus(fixture.companyId, tempSalesperson.id, false);
  assert(salespersonOff.isActive === false, 'unused salesperson can be deactivated');

  const tempTransporter = await transporterService.create(fixture.companyId, {
    transporterCode: 'TR-TMP',
    transporterName: 'Temporary Transporter',
  });
  const transporterRenamed = await transporterService.update(fixture.companyId, tempTransporter.id, {
    transporterName: 'Temporary Transporter Renamed',
  });
  assert(
    transporterRenamed.transporterName === 'Temporary Transporter Renamed',
    'transporter update persists the new name'
  );
  await expectError(
    () => transporterService.getById(fixture.otherCompanyId, tempTransporter.id),
    404,
    'transporter of another company is not readable (404)'
  );
}

async function runOptionsSection(fixture: Fixture): Promise<void> {
  section('15.2 options - formats, master lists, new columns');

  const options = await reportService.getOptions(fixture.companyId, fixture.financialYearId);

  assert(options.formats.length === 20, `options expose all 20 report formats (received ${options.formats.length})`);
  assert(
    options.formats.filter((format) => format.support === 'FULL').length === 19,
    'exactly 19 formats are reported as fully supported'
  );
  const expense = options.formats.find((format) => format.key === 'EXPENSE_WISE');
  assert(expense?.support === 'UNAVAILABLE', 'Expense Wise stays UNAVAILABLE');
  assert(
    Boolean(expense?.reason && expense.reason.length > 20),
    'Expense Wise carries an explicit dependency reason'
  );
  const salesmanAlt = options.formats.find((format) => format.key === 'SALESMAN_PARTY_WISE_ALT');
  assert(Boolean(salesmanAlt?.note), 'the second Salesman + Party entry documents its limitation');

  const optionKeys: Array<keyof typeof options> = [
    'partyGroups',
    'areas',
    'brokers',
    'transporters',
    'salespersons',
    'vehicles',
    'itemGroups',
  ];
  for (const key of optionKeys) {
    const list = options[key] as Array<{ value: string; label: string }>;
    assert(Array.isArray(list) && list.length > 0, `options.${String(key)} is populated from real master rows`);
  }

  assert(
    options.partyGroups.some((group) => group.value === fixture.partyGroupYarnId),
    'party group options contain the fixture party group'
  );
  assert(
    options.areas.some((area) => area.value === fixture.areaPowerloomId),
    'area options contain the fixture area'
  );
  assert(
    options.brokers.some((broker) => broker.label.includes('Nilesh Broker')),
    'broker options contain the fixture broker name'
  );
  assert(
    options.transporters.some((transporter) => transporter.label.includes('Gujarat Freight')),
    'transporter options contain the fixture transporter name'
  );
  assert(
    options.salespersons.some((person) => person.label.includes('Ketan Shah')),
    'salesperson options contain the fixture salesperson name'
  );
  assert(
    options.vehicles.some((vehicle) => vehicle.value === 'GJ-05-CD-5678'),
    'vehicle options contain the fixture vehicle number'
  );
  assert(
    options.itemGroups.some((group) => group.label.includes('Polyester Yarn')),
    'item group options contain the fixture item group'
  );

  const partyOption = options.parties.find((party) => party.value === fixture.partyAlphaId);
  assert(Boolean(partyOption), 'party options contain the fixture party');
  assert(
    partyOption?.partyGroupId === fixture.partyGroupYarnId,
    'party option exposes its party group id for dependent narrowing'
  );
  assert(
    partyOption?.areaId === fixture.areaRingRoadId,
    'party option exposes its area id for dependent narrowing'
  );

  const columnKeys = options.columns.map((column) => column.key);
  const requiredColumns = [
    'partyGroup',
    'partyArea',
    'broker',
    'transporter',
    'salesperson',
    'vehicle',
    'dueDays',
    'grade',
    'lotNumber',
    'hsnCode',
    'itemGroup',
    'bookName',
  ];
  for (const key of requiredColumns) {
    assert(columnKeys.includes(key), `column selector exposes '${key}'`);
  }

  assert(options.unavailableFilters.length === 4, 'the 4 unavailable filters are reported explicitly');
  assert(
    options.unavailableFilters.every((filter) => filter.reason.length > 20),
    'every unavailable filter states its exact dependency'
  );
  assert(options.requiredColumns.includes('srNo'), 'srNo remains a required column');
}
function sumGroupBillAmount(groups: ReportRunResponse['groups']): number {
  return groups.reduce((sum, group) => sum + group.totals.billAmount, 0);
}

async function runAllFormatsSection(fixture: Fixture): Promise<void> {
  section('15.2 all 20 formats - grouping, subtotals, grand totals, pagination');

  assert(REPORT_FORMATS.length === 20, `report engine defines exactly 20 formats (received ${REPORT_FORMATS.length})`);

  const detail = await run(fixture, { format: 'BILL_NO_WISE' });
  assert(detail.rows.length === 3, `Bill No Wise returns the 3 confirmed bills in range (received ${detail.rows.length})`);
  assert(
    close(detail.totals.all.billAmount, EXPECTED_PURCHASE_TOTAL),
    `Bill No Wise grand total is ${EXPECTED_PURCHASE_TOTAL} (received ${detail.totals.all.billAmount})`
  );
  assert(
    close(detail.totals.all.taxableAmount, EXPECTED_PURCHASE_TAXABLE),
    `Bill No Wise taxable total is ${EXPECTED_PURCHASE_TAXABLE} (received ${detail.totals.all.taxableAmount})`
  );
  assert(detail.totals.all.documentCount === 3, 'document count is 3');
  assert(detail.totals.grandTotalAllowed, 'a single source allows a grand total');
  assert(
    detail.rows.every((row) => row.sourceType === 'PURCHASE'),
    'every row comes from the Purchase source'
  );
  assert(
    detail.rows.every((row) => row.status !== 'CANCELLED'),
    'cancelled bills are excluded by default'
  );
  assert(
    detail.rows.every((row) => row.documentNo !== 'P152-PB-OLD'),
    'bills outside the requested date range are excluded'
  );

  const summary = await run(fixture, { format: 'BILL_NO_WISE', detailMode: 'SUMMARY' });
  assert(
    close(summary.totals.all.billAmount, detail.totals.all.billAmount),
    'SUMMARY and DETAIL agree on the grand total'
  );
  assert(
    summary.rows.every((row) => row.itemLines.length === 0),
    'SUMMARY rows carry no item lines'
  );

  const paged = await run(fixture, { format: 'BILL_NO_WISE', page: 2, pageSize: 2 });
  assert(paged.pagination.total === 3, `pagination reports 3 total rows (received ${paged.pagination.total})`);
  assert(paged.pagination.totalPages === 2, `pagination reports 2 pages (received ${paged.pagination.totalPages})`);
  assert(paged.rows.length === 1, `page 2 holds the remaining single row (received ${paged.rows.length})`);
  assert(
    close(paged.totals.all.billAmount, EXPECTED_PURCHASE_TOTAL),
    'totals stay dataset-wide and are not limited to the current page'
  );

  const descending = await run(fixture, { format: 'BILL_NO_WISE', sortBy: 'billDate', sortDir: 'desc' });
  const dates = descending.rows.map((row) => row.documentDate);
  const sortedDates = [...dates].sort().reverse();
  assert(
    dates.join('|') === sortedDates.join('|'),
    `descending date sort is applied (received ${dates.join(', ')})`
  );

  for (const format of REPORT_FORMATS) {
    if (format.support !== 'FULL') {
      await expectError(
        () => run(fixture, { format: format.key }),
        400,
        `${format.key} is rejected with 400 and its documented reason`
      );
      continue;
    }

    const response = await run(fixture, { format: format.key });
    assert(response.rows.length > 0, `${format.key} returns rows`);
    assert(
      close(response.totals.all.billAmount, EXPECTED_PURCHASE_TOTAL),
      `${format.key} keeps the same grand total (${response.totals.all.billAmount})`
    );
    assert(
      response.groupBy.join('|') === format.groupBy.join('|'),
      `${format.key} groups by [${format.groupBy.join(', ')}]`
    );
    if (format.groupBy.length > 0) {
      assert(response.groups.length > 0, `${format.key} produces at least one group`);
      assert(
        close(sumGroupBillAmount(response.groups), EXPECTED_PURCHASE_TOTAL),
        `${format.key} group subtotals add up to the grand total`
      );
      const firstKey = format.groupBy[0];
      assert(
        response.groups.every((group) => group.field === firstKey),
        `${format.key} top-level groups are keyed by '${firstKey}'`
      );
    } else {
      assert(response.groups.length === 0, `${format.key} produces no groups`);
    }

    const summaryRun = await run(fixture, { format: format.key, detailMode: 'SUMMARY' });
    assert(
      close(summaryRun.totals.all.billAmount, response.totals.all.billAmount),
      `${format.key} DETAIL and SUMMARY totals match`
    );
  }

  // Every format must be able to run for a SELECTED source set that includes
  // both purchase bills and purchase debit notes.
  const selected = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'],
    format: 'PARTY_WISE',
  });
  assert(selected.rows.length === 4, `SELECTED mode returns 4 documents (received ${selected.rows.length})`);
  assert(
    close(selected.totals.all.billAmount, EXPECTED_PURCHASE_TOTAL + fixture.debitNoteTotal),
    'SELECTED mode totals include the purchase debit note'
  );
  assert(
    !selected.totals.grandTotalAllowed,
    'a mixed source set blocks a single grand total and states why'
  );
  assert(
    selected.totals.grandTotalReason.length > 10,
    'the blocked grand total carries an explicit reason'
  );
  assert(selected.totals.bySource.length === 2, 'SELECTED mode reports a subtotal per source');
}
async function runMasterFilterSection(fixture: Fixture): Promise<void> {
  section('15.2 master filters - every displayed filter narrows the dataset');

  interface FilterCase {
    label: string;
    overrides: Partial<ReportRunRequest>;
    expectedTotal: number;
    expectedRows: number;
  }

  const cases: FilterCase[] = [
    {
      label: 'Party Group = Fabric Suppliers',
      overrides: { partyGroupId: fixture.partyGroupFabricId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Party Group = Yarn Suppliers',
      overrides: { partyGroupId: fixture.partyGroupYarnId },
      expectedTotal: 15750,
      expectedRows: 2,
    },
    {
      label: 'Area = Ring Road',
      overrides: { areaId: fixture.areaRingRoadId },
      expectedTotal: 15750,
      expectedRows: 2,
    },
    {
      label: 'Area = Powerloom Zone',
      overrides: { areaId: fixture.areaPowerloomId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Broker = Nilesh Broker',
      overrides: { brokerId: fixture.brokerTwoId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Transporter = Shree Roadlines',
      overrides: { transporterId: fixture.transporterOneId },
      expectedTotal: 15750,
      expectedRows: 2,
    },
    {
      label: 'Salesperson = Ketan Shah',
      overrides: { salespersonId: fixture.salespersonTwoId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Vehicle = GJ-05-CD-5678',
      overrides: { vehicle: 'GJ-05-CD-5678' },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Book = Fabric Purchase Book',
      overrides: { bookId: fixture.bookFabricId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Item Group = Polyester Yarn',
      overrides: { itemGroup: 'Polyester Yarn' },
      expectedTotal: 15750,
      expectedRows: 2,
    },
    {
      label: 'Quality = 75D Polyester',
      overrides: { quality: '75D Polyester' },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Item = Cotton Fabric 40s',
      overrides: { itemId: 'Cotton Fabric 40s' },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Delivery Party = Gamma Delivery House',
      overrides: { deliveryPartyId: fixture.partyDeliveryId },
      expectedTotal: 10500,
      expectedRows: 1,
    },
    {
      label: 'Party = Beta Weaving Mills',
      overrides: { partyId: fixture.partyBetaId },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'City = Surat',
      overrides: { partyCity: 'Surat' },
      expectedTotal: 15750,
      expectedRows: 2,
    },
    {
      label: 'Date range from 2026-05-01',
      overrides: { dateFrom: '2026-05-01' },
      expectedTotal: 36750,
      expectedRows: 2,
    },
    {
      label: 'Basic rate from 120',
      overrides: { rateColumn: 'BASIC', rateFrom: 120 },
      expectedTotal: 31500,
      expectedRows: 1,
    },
    {
      label: 'Cancelled included',
      overrides: { includeCancelled: true },
      expectedTotal: EXPECTED_PURCHASE_TOTAL + 7350,
      expectedRows: 4,
    },
  ];

  for (const testCase of cases) {
    const response = await run(fixture, testCase.overrides);
    assert(
      response.rows.length === testCase.expectedRows,
      `${testCase.label} returns ${testCase.expectedRows} row(s) (received ${response.rows.length})`
    );
    assert(
      close(response.totals.all.billAmount, testCase.expectedTotal),
      `${testCase.label} total is ${testCase.expectedTotal} (received ${response.totals.all.billAmount})`
    );
  }

  // Combined filters must intersect, not union.
  const combined = await run(fixture, {
    partyGroupId: fixture.partyGroupYarnId,
    brokerId: fixture.brokerTwoId,
  });
  assert(combined.rows.length === 0, 'incompatible master filters return an empty result set');
  assert(combined.totals.all.billAmount === 0, 'an empty result set reports a zero total');
  const combinedPdf = await reportService.exportPdf(
    fixture.companyId,
    fixture.financialYearId,
    baseRequest({ partyGroupId: fixture.partyGroupYarnId, brokerId: fixture.brokerTwoId })
  );
  const combinedPdfText = combinedPdf.buffer.toString('latin1');
  assert(
    combinedPdfText.includes('Party Group: Yarn Suppliers'),
    'the printed filter summary lists the applied party group'
  );
  assert(
    combinedPdfText.includes('Broker: Nilesh Broker'),
    'the printed filter summary lists the applied broker'
  );
  assert(
    combinedPdfText.includes('Cancelled documents: excluded'),
    'the printed filter summary states the cancelled-document policy'
  );

  const intersected = await run(fixture, {
    partyGroupId: fixture.partyGroupYarnId,
    brokerId: fixture.brokerOneId,
    areaId: fixture.areaRingRoadId,
  });
  assert(intersected.rows.length === 2, 'compatible master filters intersect to the 2 matching bills');
  assert(
    close(intersected.totals.all.billAmount, 15750),
    `intersected master filters total 15750 (received ${intersected.totals.all.billAmount})`
  );

  // Filtering happens before grouping, so group subtotals reflect the filter.
  const grouped = await run(fixture, {
    format: 'PARTY_WISE',
    partyGroupId: fixture.partyGroupYarnId,
  });
  assert(grouped.groups.length === 1, 'only the matching party group survives into the grouping');
  assert(
    close(grouped.groups[0].totals.billAmount, 15750),
    'the group subtotal matches the filtered total'
  );

  // Master filters must also apply to the debit note source.
  const noteOnly = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE_DEBIT_NOTE'],
    format: 'BILL_NO_WISE',
    brokerId: fixture.brokerTwoId,
  });
  assert(noteOnly.rows.length === 1, 'broker filter matches the purchase debit note');
  assert(
    close(noteOnly.totals.all.billAmount, fixture.debitNoteTotal),
    `debit note total is ${fixture.debitNoteTotal} (received ${noteOnly.totals.all.billAmount})`
  );
  assert(noteOnly.rows[0].dueDays === 45, 'debit note Due Days comes from the stored dueDays column');
  assert(
    noteOnly.rows[0].vehicle === 'GJ-05-XY-9999',
    'debit note vehicle number is reported'
  );
}
async function runColumnSection(fixture: Fixture): Promise<void> {
  section('15.2 new columns, column filters and saved layouts');

  const selectedColumns = [
    'srNo',
    'billNo',
    'partyGroup',
    'partyArea',
    'broker',
    'transporter',
    'salesperson',
    'vehicle',
    'deliveryParty',
    'bookName',
    'quality',
    'grade',
    'lotNumber',
    'hsnCode',
    'itemGroup',
    'dueDays',
    'billAmount',
    'basicRate',
  ];
  const response = await run(fixture, { columns: selectedColumns });
  assert(
    response.columns.map((column) => column.key).join('|') === selectedColumns.join('|'),
    'the requested column order is honoured exactly'
  );
  const reordered = await run(fixture, {
    columns: ['srNo', 'vehicle', 'broker', 'billNo', 'partyName', 'billAmount'],
  });
  assert(
    reordered.columns.map((column) => column.key).join('|') ===
      ['srNo', 'vehicle', 'broker', 'billNo', 'partyName', 'billAmount', 'basicRate'].join('|'),
    'a custom column order is preserved instead of being re-sorted into catalogue order'
  );

  const rowOne = response.rows.find((row) => row.documentNo === 'P152-PB-001');
  assert(Boolean(rowOne), 'the first fixture bill is present in the result');
  assert(rowOne?.partyGroup === 'Yarn Suppliers', `party group column shows 'Yarn Suppliers' (received '${rowOne?.partyGroup}')`);
  assert(rowOne?.partyArea === 'Ring Road', `area column shows 'Ring Road' (received '${rowOne?.partyArea}')`);
  assert(rowOne?.broker === 'Mahesh Broker', `broker column shows 'Mahesh Broker' (received '${rowOne?.broker}')`);
  assert(
    rowOne?.transporter === 'Shree Roadlines',
    `transporter column shows 'Shree Roadlines' (received '${rowOne?.transporter}')`
  );
  assert(
    rowOne?.salesperson === 'Nilesh Patel',
    `salesperson column shows 'Nilesh Patel' (received '${rowOne?.salesperson}')`
  );
  assert(rowOne?.vehicle === 'GJ-05-AB-1234', `vehicle column shows the stored number (received '${rowOne?.vehicle}')`);
  assert(
    rowOne?.deliveryParty === 'Gamma Delivery House',
    `delivery party column shows the linked party (received '${rowOne?.deliveryParty}')`
  );
  assert(
    rowOne?.bookName === 'Yarn Purchase Book',
    `book column shows the linked purchase book (received '${rowOne?.bookName}')`
  );
  assert(rowOne?.quality === '40s Cotton', `quality column shows the linked yarn quality (received '${rowOne?.quality}')`);
  assert(rowOne?.grade === 'A Grade', `grade column shows the linked yarn grade (received '${rowOne?.grade}')`);
  assert(rowOne?.lotNumber === 'LOT-152-1', `lot column shows the stored lot (received '${rowOne?.lotNumber}')`);
  assert(rowOne?.hsnCode === '5402', `HSN column shows the stored HSN (received '${rowOne?.hsnCode}')`);
  assert(
    rowOne?.itemGroup === 'Polyester Yarn',
    `item group column resolves the real Item Master relation (received '${rowOne?.itemGroup}')`
  );
  assert(rowOne?.itemCount === 2, `item count reflects both bill lines (received ${rowOne?.itemCount})`);
  assert(rowOne?.dueDays === null, 'purchase bills report no Due Days because no such column exists on a bill');
  assert(rowOne?.billAmount === 10500, `bill amount is 10500 (received ${rowOne?.billAmount})`);

  const rowTwo = response.rows.find((row) => row.documentNo === 'P152-PB-002');
  assert(rowTwo?.grade === 'B Grade', 'the second bill reports its own grade');
  assert(rowTwo?.partyGroup === 'Fabric Suppliers', 'the second bill reports its own party group');
  assert(rowTwo?.itemGroup === 'Fabric', 'the second bill reports its own item group');

  // Unassigned historical values must stay empty, never invented.
  const unassigned = await run(fixture, { columns: selectedColumns, includeCancelled: true });
  const cancelledRow = unassigned.rows.find((row) => row.documentNo === 'P152-PB-004');
  assert(Boolean(cancelledRow), 'the cancelled bill is returned when includeCancelled is set');
  assert(cancelledRow?.broker === '', 'a bill without a broker reports an empty broker, not a fabricated one');
  assert(cancelledRow?.vehicle === '', 'a bill without a vehicle reports an empty vehicle');
  assert(cancelledRow?.partyGroup === 'Yarn Suppliers', 'the cancelled bill still resolves its party group');

  // Dataset-wide column filters.
  interface ColumnCase {
    label: string;
    filters: Array<{ key: string; operator: string; value?: string | null; valueTo?: string | null }>;
    expectedRows: number;
    expectedTotal: number;
  }

  const columnCases: ColumnCase[] = [
    {
      label: 'Broker contains Nilesh',
      filters: [{ key: 'broker', operator: 'contains', value: 'Nilesh' }],
      expectedRows: 1,
      expectedTotal: 31500,
    },
    {
      label: 'Vehicle equals GJ-05-AB-1234',
      filters: [{ key: 'vehicle', operator: 'equals', value: 'GJ-05-AB-1234' }],
      expectedRows: 2,
      expectedTotal: 15750,
    },
    {
      label: 'Grade contains B Grade',
      filters: [{ key: 'grade', operator: 'contains', value: 'B Grade' }],
      expectedRows: 1,
      expectedTotal: 31500,
    },
    {
      label: 'Bill Amount between 5000 and 11000',
      filters: [{ key: 'billAmount', operator: 'between', value: '5000', valueTo: '11000' }],
      expectedRows: 2,
      expectedTotal: 15750,
    },
    {
      label: 'Party Group is not empty',
      filters: [{ key: 'partyGroup', operator: 'notEmpty' }],
      expectedRows: 3,
      expectedTotal: EXPECTED_PURCHASE_TOTAL,
    },
    {
      label: 'Salesperson equals Ketan Shah',
      filters: [{ key: 'salesperson', operator: 'equals', value: 'Ketan Shah' }],
      expectedRows: 1,
      expectedTotal: 31500,
    },
  ];

  for (const testCase of columnCases) {
    const filtered = await run(fixture, {
      columnFilters: testCase.filters as ReportRunRequest['columnFilters'],
    });
    assert(
      filtered.rows.length === testCase.expectedRows,
      `${testCase.label} returns ${testCase.expectedRows} row(s) (received ${filtered.rows.length})`
    );
    assert(
      close(filtered.totals.all.billAmount, testCase.expectedTotal),
      `${testCase.label} total is ${testCase.expectedTotal} (received ${filtered.totals.all.billAmount})`
    );
    assert(
      filtered.meta.columnFilters.length === testCase.filters.length,
      `${testCase.label} is echoed in the report meta`
    );
  }

  // Due Days only exists on debit notes, so the filter must be checked there.
  const dueDaysFiltered = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE_DEBIT_NOTE'],
    columnFilters: [{ key: 'dueDays', operator: 'gt', value: '30' }],
  });
  assert(dueDaysFiltered.rows.length === 1, 'Due Days greater than 30 matches the debit note');
  const dueDaysEmpty = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE_DEBIT_NOTE'],
    columnFilters: [{ key: 'dueDays', operator: 'gt', value: '60' }],
  });
  assert(dueDaysEmpty.rows.length === 0, 'Due Days greater than 60 matches nothing');

  // Invalid filters are rejected, never silently ignored.
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'billDate', operator: 'contains', value: '2026' }] }),
    400,
    'a text operator on a date column is rejected with 400'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'unknownColumn', operator: 'equals', value: 'x' }] }),
    400,
    'an unknown column filter is rejected with 400'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'srNo', operator: 'gt', value: '1' }] }),
    400,
    'filtering on the generated Sr No is rejected with 400'
  );
  await expectError(
    () => run(fixture, { columnFilters: [{ key: 'billAmount', operator: 'between', value: '100' }] }),
    400,
    'a Between filter without an upper bound is rejected with 400'
  );

  // Saved column layouts must accept the new columns.
  const layoutColumns = ['srNo', 'billNo', 'broker', 'transporter', 'salesperson', 'vehicle', 'dueDays', 'grade', 'lotNumber', 'hsnCode'];
  const created = await reportLayoutService.create(fixture.companyId, {
    reportType: 'BILL_BASE',
    name: 'Phase 15.2 Master Columns',
    columns: layoutColumns,
  });
  assert(
    created.columns.join('|') === layoutColumns.join('|'),
    'a saved layout keeps the selected new columns in order'
  );
  assert(created.unavailableColumns.length === 0, 'every saved column is currently available');

  const renamed = await reportLayoutService.update(fixture.companyId, created.id, {
    name: 'Phase 15.2 Master Columns Renamed',
  });
  assert(renamed.name === 'Phase 15.2 Master Columns Renamed', 'a saved layout can be renamed');
  assert(renamed.columns.join('|') === layoutColumns.join('|'), 'renaming keeps the column selection intact');

  const defaulted = await reportLayoutService.setDefault(fixture.companyId, created.id);
  assert(defaulted.isDefault, 'a saved layout can be marked as default');

  const listed = await reportLayoutService.list(fixture.companyId);
  assert(
    listed.filter((layout) => layout.isDefault).length === 1,
    'exactly one layout is the default at a time'
  );
  assert(
    listed.some((layout) => layout.id === created.id && layout.isDefault),
    'the saved layout is the current default'
  );

  const reloadedLayout = await reportLayoutService.getById(fixture.companyId, created.id);
  assert(
    reloadedLayout.columns.join('|') === layoutColumns.join('|'),
    'the saved layout reads back with the same columns'
  );

  await expectError(
    () =>
      reportLayoutService.create(fixture.companyId, {
        reportType: 'BILL_BASE',
        name: 'Phase 15.2 Master Columns Renamed',
        columns: layoutColumns,
      }),
    409,
    'duplicate layout names are rejected with 409'
  );
  await expectError(
    () =>
      reportLayoutService.create(fixture.companyId, {
        reportType: 'BILL_BASE',
        name: 'Missing Sr No',
        columns: ['billNo', 'broker'],
      }),
    400,
    'a layout cannot drop the required Sr No column'
  );
  await expectError(
    () =>
      reportLayoutService.create(fixture.companyId, {
        reportType: 'BILL_BASE',
        name: 'Unknown Column',
        columns: ['srNo', 'notAColumn'],
      }),
    400,
    'a layout cannot store an unknown column'
  );

  await reportLayoutService.remove(fixture.companyId, created.id);
  const afterRemove = await reportLayoutService.list(fixture.companyId);
  assert(
    !afterRemove.some((layout) => layout.id === created.id),
    'a saved layout can be deleted'
  );
  await expectError(
    () => reportLayoutService.getById(fixture.companyId, created.id),
    404,
    'a deleted layout is no longer readable (404)'
  );
}
function pdfPageCount(buffer: Buffer): number {
  const text = buffer.toString('latin1');
  const match = text.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function runExportSection(fixture: Fixture): Promise<void> {
  section('15.2 PDF and XLSX export');

  const filtered = await run(fixture, {
    columns: ['srNo', 'billNo', 'partyName', 'partyGroup', 'broker', 'transporter', 'vehicle', 'billAmount'],
    columnFilters: [{ key: 'broker', operator: 'contains', value: 'Nilesh' }],
  });

  const pdf = await reportService.exportPdf(fixture.companyId, fixture.financialYearId, baseRequest({
    format: 'BILL_NO_WISE',
    columns: ['srNo', 'billNo', 'partyName', 'broker', 'transporter', 'salesperson', 'vehicle', 'billAmount'],
  }));
  const pdfText = pdf.buffer.toString('latin1');
  assert(pdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'the PDF export starts with a real PDF header');
  assert(pdf.buffer.length > 1500, `the PDF export has real content (${pdf.buffer.length} bytes)`);
  assert(pdf.filename.endsWith('.pdf'), `the PDF filename ends with .pdf (${pdf.filename})`);
  assert(pdfText.includes('Beta Weaving Mills'), 'the PDF contains the party name');
  assert(pdfText.includes('Broker'), 'the PDF prints the Broker column header');
  assert(pdfText.includes('GRAND TOTAL'), 'the PDF prints a grand total row');
  assert(pdfText.includes('47,250.00'), 'the PDF grand total equals the on-screen total');

  // The PDF writer must stay inside WinAnsi: the rupee sign is transliterated
  // and Latin-1 accents are octal escaped instead of producing broken glyphs.
  const unicodePdf = buildPdf({
    orientation: 'portrait',
    header: {
      companyName: 'Sivam \u2013 Caf\u00e9 Textiles (P) Ltd',
      companyAddress: 'Plot 12, Ring Road, Surat',
      companyGstin: '24ABCDE1234F1Z5',
      financialYear: '2026 - 2027',
      reportTitle: 'Party Wise Purchase Report \u2013 \u20B9 Test',
      reportType: 'Detail',
      dateRange: '2026-04-01 to 2026-11-10',
      filters: ['Caf\u00e9 \u2013 filter'],
    },
    columns: [
      { label: 'Bill No', width: 20, align: 'left' },
      { label: 'Party', width: 40, align: 'left' },
      { label: 'Amount', width: 20, align: 'right' },
    ],
    rows: [
      { cells: ['P152-PB-001', 'Caf\u00e9 R\u00e9sum\u00e9 & Fils', '\u20B9 1,23,456.78'] },
    ],
  });
  const unicodeText = unicodePdf.buffer.toString('latin1');
  assert(unicodePdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'the WinAnsi probe is a valid PDF');
  assert(unicodeText.includes('Rs.'), 'the rupee sign is transliterated to Rs. inside the PDF');
  assert(unicodeText.includes('\\351'), 'Latin-1 characters are octal escaped for WinAnsi');
  assert(!unicodeText.includes('\u20B9'), 'no raw rupee sign leaks into the PDF stream');

  // Narrow column set so the new master values are not truncated by the
  // auto-fitted column widths.
  const narrowPdf = await reportService.exportPdf(fixture.companyId, fixture.financialYearId, baseRequest({
    format: 'BILL_NO_WISE',
    columns: ['srNo', 'broker', 'transporter', 'vehicle', 'billAmount'],
  }));
  const narrowText = narrowPdf.buffer.toString('latin1');
  assert(narrowText.includes('Nilesh Broker'), 'the PDF contains the broker column value');
  assert(narrowText.includes('Gujarat Freight'), 'the PDF contains the transporter column value');
  assert(narrowText.includes('GJ-05-CD-5678'), 'the PDF contains the vehicle column value');
  assert(pdfPageCount(pdf.buffer) === 1, `a 3 row report renders on 1 page (received ${pdfPageCount(pdf.buffer)})`);

  const landscape = await reportService.exportPdf(fixture.companyId, fixture.financialYearId, baseRequest({
    format: 'BILL_NO_WISE',
    pdfOrientation: 'landscape',
  }));
  const landscapeText = landscape.buffer.toString('latin1');
  assert(landscape.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'the landscape PDF is a valid PDF');
  const portraitBox = pdfText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  const landscapeBox = landscapeText.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  assert(Boolean(portraitBox && landscapeBox), 'both PDFs declare a MediaBox');
  assert(
    Number(landscapeBox?.[1]) > Number(landscapeBox?.[2]),
    'the landscape PDF is wider than it is tall'
  );
  assert(
    Number(portraitBox?.[2]) > Number(portraitBox?.[1]),
    'the portrait PDF is taller than it is wide'
  );

  // A multi-page PDF must really paginate: 60 fixture bills in a second FY.
  const bulkFy = await prisma.financialYear.create({
    data: {
      companyId: fixture.companyId,
      yearName: '2025 - 2026',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      isActive: false,
      isLocked: false,
    },
  });
  for (let index = 0; index < 60; index++) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const month = String(4 + Math.floor(index / 28)).padStart(2, '0');
    const amount = 1000 + index * 10;
    await prisma.purchaseBill.create({
      data: {
        companyId: fixture.companyId,
        financialYearId: bulkFy.id,
        billNumber: 'P152-BULK-' + String(index + 1).padStart(3, '0'),
        billDate: new Date('2025-' + month + '-' + day + 'T00:00:00.000Z'),
        partyId: fixture.partyAlphaId,
        supplierLegalName: 'Alpha Textiles',
        supplierCity: 'Surat',
        totalQuantity: new Prisma.Decimal(10),
        taxableAmount: new Prisma.Decimal(amount),
        totalAmount: new Prisma.Decimal(amount),
        status: 'CONFIRMED',
        items: {
          create: [
            {
              itemDescription: 'Bulk Stock',
              quantity: new Prisma.Decimal(10),
              unit: 'KG',
              rate: new Prisma.Decimal(amount / 10),
              taxableAmount: new Prisma.Decimal(amount),
            },
          ],
        },
      },
    });
  }

  const bulkRequest = baseRequest({ dateFrom: '2025-04-01', dateTo: '2026-03-31', pageSize: 200 });
  const bulkPdf = await reportService.exportPdf(fixture.companyId, bulkFy.id, bulkRequest);
  const bulkPages = pdfPageCount(bulkPdf.buffer);
  assert(bulkPages >= 2, `a 60 row PDF paginates onto multiple pages (received ${bulkPages})`);
  assert(
    bulkPdf.buffer.toString('latin1').includes('Page 1 of ' + bulkPages),
    'each PDF page is labelled with its page number and the total'
  );

  const bulkResponse = await reportService.execute(fixture.companyId, bulkFy.id, bulkRequest);
  assert(bulkResponse.rows.length === 60, `the bulk fixture reports 60 rows (received ${bulkResponse.rows.length})`);

  // XLSX must carry the same filtered dataset as the preview.
  const xlsx = reportService.exportXlsx(filtered);
  assert(xlsx.buffer[0] === 0x50 && xlsx.buffer[1] === 0x4b, 'the XLSX export is a real ZIP container');
  assert(xlsx.filename.endsWith('.xlsx'), `the XLSX filename ends with .xlsx (${xlsx.filename})`);
  const entries = readZipEntries(xlsx.buffer);
  assert(entries.length > 3, `the XLSX contains the expected workbook parts (${entries.length} entries)`);
  const sheetXml = entries.find((entry) => entry.name === 'xl/worksheets/sheet1.xml')?.content ?? '';
  assert(sheetXml.includes('P152-PB-002'), 'the workbook contains the row kept by the filter');
  assert(!sheetXml.includes('P152-PB-001'), 'the workbook excludes the row removed by the filter');
  assert(sheetXml.includes('Nilesh Broker'), 'the workbook contains the new Broker column');
  assert(sheetXml.includes('GJ-05-CD-5678'), 'the workbook contains the new Vehicle column');
  assert(sheetXml.includes('Fabric Suppliers'), 'the workbook contains the new Party Group column');
  assert(sheetXml.includes('TOTAL'), 'the workbook keeps its TOTAL footer');

  const xlsxTotals = xlsx.buffer.length;
  assert(xlsxTotals > 1000, `the workbook has real content (${xlsxTotals} bytes)`);

  await prisma.purchaseBill.deleteMany({ where: { financialYearId: bulkFy.id } });
  await prisma.financialYear.delete({ where: { id: bulkFy.id } });
}
async function snapshotCounts(companyId: string): Promise<Record<string, number>> {
  const [bills, billItems, notes, noteLines, journals, sequences, layouts] = await Promise.all([
    prisma.purchaseBill.count({ where: { companyId } }),
    prisma.purchaseBillItem.count({ where: { purchaseBill: { companyId } } }),
    prisma.debitNote.count({ where: { companyId } }),
    prisma.debitNoteLine.count({ where: { companyId } }),
    prisma.journalLine.count({ where: { companyId } }),
    prisma.voucherSequence.count({ where: { companyId } }),
    prisma.reportColumnLayout.count({ where: { companyId } }),
  ]);
  return { bills, billItems, notes, noteLines, journals, sequences, layouts };
}

async function runReadOnlySection(fixture: Fixture): Promise<void> {
  section('15.2 read-only guarantee');

  const before = await snapshotCounts(fixture.companyId);

  for (const format of REPORT_FORMATS) {
    if (format.support !== 'FULL') continue;
    await run(fixture, { format: format.key, detailMode: 'DETAIL' });
    await run(fixture, { format: format.key, detailMode: 'SUMMARY' });
  }
  await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'],
    format: 'MONTH_WISE_ALL',
  });
  await reportService.exportPdf(fixture.companyId, fixture.financialYearId, baseRequest({}));
  const exportResponse = await run(fixture, { format: 'PARTY_WISE' });
  reportService.exportXlsx(exportResponse);

  const after = await snapshotCounts(fixture.companyId);
  const labels: Record<string, string> = {
    bills: 'purchase bills',
    billItems: 'purchase bill lines',
    notes: 'debit notes',
    noteLines: 'debit note lines',
    journals: 'journal lines',
    sequences: 'voucher sequences',
    layouts: 'saved column layouts',
  };
  for (const key of Object.keys(labels)) {
    assert(
      before[key] === after[key],
      `running and exporting every format never changes ${labels[key]} (${before[key]} -> ${after[key]})`
    );
  }
}

async function runIsolationSection(fixture: Fixture): Promise<void> {
  section('15.2 company and financial year isolation');

  await expectError(
    () => reportService.execute(fixture.companyId, fixture.otherFinancialYearId, baseRequest({})),
    404,
    'a financial year owned by another company is rejected (404)'
  );
  await expectError(
    () => reportService.execute(fixture.otherCompanyId, fixture.financialYearId, baseRequest({})),
    404,
    'a company cannot run a report against another company financial year (404)'
  );

  const otherCompanyReport = await reportService.execute(
    fixture.otherCompanyId,
    fixture.otherFinancialYearId,
    baseRequest({})
  );
  assert(otherCompanyReport.rows.length === 0, 'a company with no data returns an empty report, never other data');
  assert(otherCompanyReport.totals.all.billAmount === 0, 'an empty report totals zero');

  const otherOptions = await reportService.getOptions(fixture.otherCompanyId, fixture.otherFinancialYearId);
  assert(otherOptions.partyGroups.length === 0, 'options never leak another company party groups');
  assert(otherOptions.brokers.length === 0, 'options never leak another company brokers');
  assert(otherOptions.books.length === 0, 'options never leak another company books');

  // No double counting: each document contributes exactly one row.
  const response = await run(fixture, { format: 'BILL_NO_WISE' });
  const documentNos = response.rows.map((row) => row.documentNo);
  assert(
    new Set(documentNos).size === documentNos.length,
    'no document appears twice in a Bill No Wise report'
  );
  const rowSum = response.rows.reduce((sum, row) => sum + row.billAmount, 0);
  assert(
    close(rowSum, response.totals.all.billAmount),
    'the row amounts add up to the reported total with no double counting'
  );

  // A mixed source report must keep per-source subtotals that add up.
  const mixed = await run(fixture, {
    mode: 'SELECTED',
    sources: ['PURCHASE', 'PURCHASE_DEBIT_NOTE'],
    format: 'PARTY_WISE',
  });
  const bySourceSum = mixed.totals.bySource.reduce((sum, entry) => sum + entry.billAmount, 0);
  assert(
    close(bySourceSum, mixed.totals.all.billAmount),
    'per-source subtotals add up to the combined total'
  );
  assert(mixed.totals.grandTotal === null, 'a mixed direction report does not print a misleading grand total');

  const cancelledOnly = await run(fixture, {
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
  });
  assert(cancelledOnly.rows.length === 0, 'a cancelled bill is excluded by default');
  const cancelledIncluded = await run(fixture, {
    dateFrom: '2026-07-01',
    dateTo: '2026-07-31',
    includeCancelled: true,
  });
  assert(cancelledIncluded.rows.length === 1, 'the cancelled bill appears only when explicitly requested');
  assert(cancelledIncluded.rows[0].status === 'CANCELLED', 'the cancelled row reports its cancelled status');
}

async function main(): Promise<void> {
  console.log('Phase 15.2 - Sales & Purchase Report (Bill Base) masters + all-format test');
  await cleanupTestData();

  const fixture = await buildFixture();
  try {
    await runMasterCrudSection(fixture);
    await runOptionsSection(fixture);
    await runAllFormatsSection(fixture);
    await runMasterFilterSection(fixture);
    await runColumnSection(fixture);
    await runExportSection(fixture);
    await runReadOnlySection(fixture);
    await runIsolationSection(fixture);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 15.2 report tests: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

main().catch(async (error) => {
  console.error('\nPhase 15.2 report test failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});