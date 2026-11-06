import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma, PrismaClient } from '@prisma/client';
import { ItemService } from '../src/services/itemService.js';
import { SalesOrderService } from '../src/services/salesOrderService.js';
import { PurchaseOrderService } from '../src/services/purchaseOrderService.js';
import { OrderReportService } from '../src/services/orderReportService.js';
import { amountInWords } from '../../frontend/src/utils/amountInWords.js';

const prisma = new PrismaClient();
const itemService = new ItemService();
const salesOrders = new SalesOrderService();
const purchaseOrders = new PurchaseOrderService();
const orderReports = new OrderReportService();

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendSrc = path.resolve(scriptDir, '../../frontend/src');
const backendSrc = path.resolve(scriptDir, '../src');

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

interface CaughtError {
  statusCode?: number;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

async function expectError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
  label: string,
  expectedField?: string
): Promise<CaughtError> {
  try {
    await fn();
  } catch (error) {
    const err = error as CaughtError;
    const fieldMatched =
      !expectedField || (err.errors ?? []).some((item) => item.field === expectedField);
    assert(
      err.statusCode === expectedStatus && fieldMatched,
      `${label} (expected ${expectedStatus}, received ${err.statusCode ?? 'none'}${
        fieldMatched ? '' : ' / field mismatch'
      }: ${err.message})`
    );
    return err;
  }
  assert(false, `${label} (expected rejection with ${expectedStatus}, but the call succeeded)`);
  return { message: '' };
}

const TEST_COMPANY_CODE = 'P13TEST';
const OTHER_COMPANY_CODE = 'P13OTHER';

async function cleanupTestData(): Promise<void> {
  const companies = await prisma.company.findMany({
    where: { companyCode: { in: [TEST_COMPANY_CODE, OTHER_COMPANY_CODE] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.orderStatusHistory.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.orderFulfilmentLink.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.salesOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.orderSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.item.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.location.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

interface SuiteContext {
  companyId: string;
  financialYearId: string;
  lockedFinancialYearId: string;
  otherCompanyId: string;
  otherFinancialYearId: string;
  customerGujaratId: string;
  customerMaharashtraId: string;
  supplierGujaratId: string;
  supplierMaharashtraId: string;
  inactiveSupplierId: string;
  itemAId: string;
  itemBId: string;
  itemCId: string;
  inactiveItemId: string;
  locationId: string;
}

async function createCompanyWithYears(code: string, name: string, state: string) {
  const company = await prisma.company.create({
    data: {
      companyCode: code,
      companyName: name,
      gstin: '24AABCS1234F1Z8',
      panNumber: 'AABCS1234F',
      address: 'Plot 12, Ring Road',
      city: 'Surat',
      state,
      pincode: '395002',
      phone: '9876543210',
      email: 'accounts@shivam.example',
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

  const lockedFy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2025 - 2026',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: true,
    },
  });

  return { company, fy, lockedFy };
}

async function buildContext(): Promise<SuiteContext> {
  const primary = await createCompanyWithYears(TEST_COMPANY_CODE, 'SHIVAM ENTERPRISE PHASE 13 LTD', 'Gujarat');
  const other = await createCompanyWithYears(OTHER_COMPANY_CODE, 'OTHER TEXTILES PHASE 13 LTD', 'Maharashtra');

  const customerGujarat = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P13CUSTGUJ',
      partyName: 'Gujarat Yarn Traders',
      partyType: 'CUSTOMER',
      gstin: '24AAACC1111A1Z5',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const customerMaharashtra = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P13CUSTMH',
      partyName: 'Mumbai Fabric House',
      partyType: 'CUSTOMER',
      gstin: '27AAACC2222B1Z6',
      address: 'Dadar West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400028',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplierGujarat = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P13SUPPGUJ',
      partyName: 'Surat Textile Suppliers',
      partyType: 'SUPPLIER',
      gstin: '24AAACC3333C1Z7',
      address: 'Sahara Darwaja',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395003',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const supplierMaharashtra = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P13SUPPMH',
      partyName: 'Bhiwandi Weaving Mills',
      partyType: 'SUPPLIER',
      gstin: '27AAACC4444D1Z8',
      address: 'Powerloom Marg',
      city: 'Bhiwandi',
      state: 'Maharashtra',
      pincode: '421302',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const inactiveSupplier = await prisma.party.create({
    data: {
      companyId: primary.company.id,
      partyCode: 'P13SUPPOFF',
      partyName: 'Closed Supplier',
      partyType: 'SUPPLIER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
      isActive: false,
    },
  });

  const location = await prisma.location.create({
    data: { companyId: primary.company.id, locationName: 'Main Godown' },
  });

  const itemA = await itemService.create(primary.company.id, {
    itemCode: 'P13-YARN-01',
    itemName: 'Cotton Yarn 40s',
    itemType: 'YARN',
    unit: 'KG',
    hsnCode: '5205',
    gstRate: '5',
    defaultSalesRate: '250',
    defaultPurchaseRate: '100',
    colour: 'Natural',
  });

  const itemB = await itemService.create(primary.company.id, {
    itemCode: 'P13-FAB-01',
    itemName: 'Dyed Fabric Roll',
    itemType: 'FABRIC',
    unit: 'METER',
    hsnCode: '5208',
    gstRate: '12',
    defaultSalesRate: '100',
    defaultPurchaseRate: '200',
  });

  const itemC = await itemService.create(primary.company.id, {
    itemCode: 'P13-OTH-01',
    itemName: 'Packing Carton',
    itemType: 'OTHER',
    unit: 'PIECE',
    gstRate: '18',
  });

  const inactiveItem = await itemService.create(primary.company.id, {
    itemCode: 'P13-OFF-01',
    itemName: 'Discontinued Item',
    itemType: 'RAW_MATERIAL',
    unit: 'KG',
    gstRate: '18',
  });
  await itemService.setStatus(primary.company.id, inactiveItem.id, false);

  return {
    companyId: primary.company.id,
    financialYearId: primary.fy.id,
    lockedFinancialYearId: primary.lockedFy.id,
    otherCompanyId: other.company.id,
    otherFinancialYearId: other.fy.id,
    customerGujaratId: customerGujarat.id,
    customerMaharashtraId: customerMaharashtra.id,
    supplierGujaratId: supplierGujarat.id,
    supplierMaharashtraId: supplierMaharashtra.id,
    inactiveSupplierId: inactiveSupplier.id,
    itemAId: itemA.id,
    itemBId: itemB.id,
    itemCId: itemC.id,
    inactiveItemId: inactiveItem.id,
    locationId: location.id,
  };
}

function salesPayload(
  ctx: SuiteContext,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    orderDate: '2026-05-10',
    partyId: ctx.customerGujaratId,
    customerReferenceNumber: 'CUST-PO-771',
    customerReferenceDate: '2026-05-08',
    expectedDeliveryDate: '2026-05-25',
    salesperson: 'Jainil Patel',
    paymentTerms: '30 Days Credit',
    deliveryTerms: 'Door Delivery',
    freightTerms: 'To Pay',
    priority: 'NORMAL',
    freightAmount: '250.40',
    packingAmount: '100.00',
    otherCharges: '0',
    narration: 'Phase 13 sales order test',
    remarks: 'Deliver in two lots',
    termsAndConditions: 'Goods once sold will not be taken back.',
    lines: [
      {
        itemId: ctx.itemAId,
        quantity: '100',
        rate: '250',
        discountPercent: '2',
        gstRate: '5',
        expectedDeliveryDate: '2026-05-20',
      },
      {
        itemId: ctx.itemBId,
        quantity: '50.5',
        rate: '100',
        discountPercent: '0',
        gstRate: '12',
      },
    ],
    ...overrides,
  };
}

function purchasePayload(
  ctx: SuiteContext,
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    orderDate: '2026-05-12',
    partyId: ctx.supplierGujaratId,
    supplierQuotationNumber: 'SUP-Q-118',
    supplierQuotationDate: '2026-05-09',
    expectedDeliveryDate: '2026-05-30',
    buyerName: 'Jainil Patel',
    paymentTerms: '100% Advance',
    deliveryTerms: 'Ex-Works',
    freightTerms: 'Paid',
    priority: 'NORMAL',
    deliveryLocationId: ctx.locationId,
    freightAmount: '500',
    packingAmount: '0',
    otherCharges: '0',
    narration: 'Phase 13 purchase order test',
    termsAndConditions: 'Material must match the approved sample.',
    lines: [
      {
        itemId: ctx.itemAId,
        quantity: '100',
        rate: '100',
        discountPercent: '10',
        gstRate: '18',
        deliveryLocationId: ctx.locationId,
      },
      {
        itemId: ctx.itemBId,
        quantity: '20',
        rate: '200',
        discountPercent: '0',
        gstRate: '5',
      },
    ],
    ...overrides,
  };
}
async function run(): Promise<void> {
  await cleanupTestData();
  const ctx = await buildContext();

  section('1. Item Master (Phase 13 dependency)');
  const items = await itemService.list(ctx.companyId, { includeInactive: 'true' });
  assert(items.length === 4, 'four item master records are created for the test company');
  const lookups = await itemService.getLookups(ctx.companyId);
  assert(
    lookups.itemTypes.length === 4 && lookups.units.length === 10 && lookups.gstRates.length === 5,
    'item lookups expose 4 item types, 10 units of measure and 5 GST slabs'
  );
  await expectError(
    () =>
      itemService.create(ctx.companyId, {
        itemCode: 'P13-YARN-01',
        itemName: 'Duplicate Code',
        unit: 'KG',
      }),
    400,
    'item code duplication is rejected',
    'itemCode'
  );
  await expectError(
    () =>
      itemService.create(ctx.companyId, {
        itemCode: 'P13-BAD-HSN',
        itemName: 'Bad HSN Item',
        hsnCode: '12',
      }),
    400,
    'HSN code must contain 4 to 8 digits',
    'hsnCode'
  );
  await expectError(
    () =>
      itemService.create(ctx.companyId, {
        itemCode: 'P13-BAD-UNIT',
        itemName: 'Bad Unit Item',
        unit: 'LITRE' as never,
      }),
    400,
    'unit of measure outside the allowed list is rejected',
    'unit'
  );
  const fourDecimal = await itemService.create(ctx.companyId, {
    itemCode: 'P13-RATE-4D',
    itemName: 'Four Decimal Rate Item',
    unit: 'KG',
    defaultSalesRate: '245.6789',
    defaultPurchaseRate: '98.7654',
  });
  assert(
    fourDecimal.defaultSalesRate === '245.6789' && fourDecimal.defaultPurchaseRate === '98.7654',
    'item rates are stored and returned with 4 decimal places'
  );
  const renamed = await itemService.update(ctx.companyId, ctx.itemCId, {
    itemName: 'Packing Carton Large',
  });
  assert(
    renamed.itemName === 'Packing Carton Large' && renamed.gstRate === '18.00',
    'item update merges untouched fields instead of overwriting them'
  );
  const deactivated = await itemService.setStatus(ctx.companyId, fourDecimal.id, false);
  assert(deactivated.isActive === false, 'an unreferenced item can be deactivated');

  section('2. Sales order creation, numbering and GST calculation');
  const so1 = await salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx));
  assert(so1.orderNumber === 'SO-2026-0001', `first sales order number is SO-2026-0001 (received ${so1.orderNumber})`);
  assert(so1.status === 'DRAFT', 'a new sales order starts in DRAFT');
  assert(so1.lines.length === 2, 'both sales order lines are persisted');
  assert(
    so1.lines[0].taxableAmount === '24500.00' &&
      so1.lines[0].cgstAmount === '612.50' &&
      so1.lines[0].sgstAmount === '612.50' &&
      so1.lines[0].igstAmount === '0.00',
    'line 1 applies a 2% discount and splits 5% GST into CGST 612.50 / SGST 612.50'
  );
  assert(
    so1.lines[1].taxableAmount === '5050.00' &&
      so1.lines[1].cgstAmount === '303.00' &&
      so1.lines[1].sgstAmount === '303.00',
    'line 2 applies 12% GST on 5050.00 (CGST/SGST 303.00 each)'
  );
  assert(so1.taxType === 'INTRA_STATE', 'Gujarat company and Gujarat customer resolve to INTRA_STATE');
  assert(
    so1.totals.totalQuantity === '150.500' &&
      so1.totals.subtotal === '30050.00' &&
      so1.totals.discountAmount === '500.00' &&
      so1.totals.taxableAmount === '29550.00',
    'sales order totals aggregate quantity, gross value, discount and taxable value'
  );
  assert(
    so1.totals.cgstAmount === '915.50' &&
      so1.totals.sgstAmount === '915.50' &&
      so1.totals.igstAmount === '0.00',
    'sales order totals aggregate CGST 915.50 and SGST 915.50 with no IGST'
  );
  assert(
    so1.totals.freightAmount === '250.40' &&
      so1.totals.packingAmount === '100.00' &&
      so1.totals.otherCharges === '0.00',
    'freight, packing and other charges are captured independently'
  );
  assert(
    so1.totals.grandTotal === '31731.00' && so1.totals.roundOffAmount === '-0.40',
    `grand total is rounded to whole rupees with a -0.40 round off (received ${so1.totals.grandTotal} / ${so1.totals.roundOffAmount})`
  );
  assert(
    so1.party.partyName === 'Gujarat Yarn Traders' &&
      so1.billingAddress !== null &&
      so1.deliveryAddress === so1.billingAddress,
    'party snapshot is stored on the order and the delivery address defaults to billing'
  );
  assert(
    so1.totalFulfilledQuantity === '0.000' &&
      so1.totalPendingQuantity === '150.500' &&
      so1.lines[0].pendingQuantity === '100.000',
    'without linked fulfilment documents, pending quantity equals ordered quantity'
  );
  const so1Raw = await prisma.salesOrder.findUniqueOrThrow({ where: { id: so1.id } });
  assert(
    so1Raw.grandTotal.toFixed(2) === '31731.00' && so1Raw.roundOffAmount.toFixed(2) === '-0.40',
    'order header stores Decimal(15,2) financial values with the same totals'
  );

  section('3. Inter-state sales order');
  const so2 = await salesOrders.create(
    ctx.companyId,
    ctx.financialYearId,
    salesPayload(ctx, {
      partyId: ctx.customerMaharashtraId,
      freightAmount: '0',
      packingAmount: '0',
      customerReferenceNumber: null,
      lines: [
        { itemId: ctx.itemAId, quantity: '10', rate: '100', discountPercent: '0', gstRate: '18' },
      ],
    })
  );
  assert(so2.orderNumber === 'SO-2026-0002', `second sales order number is SO-2026-0002 (received ${so2.orderNumber})`);
  assert(so2.taxType === 'INTER_STATE', 'Gujarat company and Maharashtra customer resolve to INTER_STATE');
  assert(
    so2.totals.igstAmount === '180.00' &&
      so2.totals.cgstAmount === '0.00' &&
      so2.totals.sgstAmount === '0.00' &&
      so2.totals.grandTotal === '1180.00',
    'inter-state sales order charges IGST only (180.00 on 1000.00 taxable value)'
  );

  section('4. Sales order validation');
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx, { partyId: undefined })),
    400,
    'sales order without a party is rejected',
    'partyId'
  );
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx, { lines: [] })),
    400,
    'sales order without lines is rejected',
    'lines'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, {
          lines: [
            { itemId: ctx.itemAId, quantity: '1', rate: '10', gstRate: '5' },
            { itemId: ctx.itemAId, quantity: '2', rate: '10', gstRate: '5' },
          ],
        })
      ),
    400,
    'the same item cannot appear on two order lines',
    'lines[1].itemId'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, {
          lines: [{ itemId: ctx.itemAId, quantity: '1', rate: '10', unit: 'METER', gstRate: '5' }],
        })
      ),
    400,
    'a line unit that differs from the item master unit is rejected',
    'lines[0].unit'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, {
          lines: [{ itemId: ctx.itemAId, quantity: '0', rate: '10', gstRate: '5' }],
        })
      ),
    400,
    'zero quantity is rejected',
    'lines[0].quantity'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, {
          lines: [{ itemId: ctx.itemAId, quantity: '1', rate: '10.12345', gstRate: '5' }],
        })
      ),
    400,
    'a rate with more than 4 decimal places is rejected',
    'lines[0].rate'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, {
          lines: [{ itemId: ctx.itemAId, quantity: '1', rate: '10', gstRate: '101' }],
        })
      ),
    400,
    'a GST rate above 100 is rejected',
    'lines[0].gstRate'
  );
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx, { orderDate: '2025-05-10' })),
    400,
    'an order date outside the financial year is rejected',
    'orderDate'
  );
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx, { taxType: 'INTER_STATE' })),
    400,
    'a supplied tax type that contradicts the derived GST treatment is rejected',
    'taxType'
  );
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.financialYearId, salesPayload(ctx, { partyId: ctx.supplierGujaratId })),
    400,
    'a supplier cannot be used as the customer on a sales order',
    'partyId'
  );
  await expectError(
    () =>
      salesOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        salesPayload(ctx, { partyId: ctx.inactiveSupplierId })
      ),
    400,
    'an inactive party is rejected',
    'partyId'
  );
  await expectError(
    () => salesOrders.create(OTHER_COMPANY_CODE, ctx.financialYearId, salesPayload(ctx)),
    400,
    'an unknown company context is rejected'
  );

  section('5. Sales order lifecycle');
  const confirmedSo2 = await salesOrders.confirm(ctx.companyId, ctx.financialYearId, so2.id);
  assert(confirmedSo2.status === 'CONFIRMED' && confirmedSo2.confirmedAt !== null, 'draft sales order can be confirmed');
  await expectError(
    () =>
      salesOrders.update(
        ctx.companyId,
        ctx.financialYearId,
        so2.id,
        salesPayload(ctx, { partyId: ctx.customerMaharashtraId })
      ),
    409,
    'a confirmed sales order can no longer be edited'
  );
  await expectError(
    () => salesOrders.confirm(ctx.companyId, ctx.financialYearId, so2.id),
    409,
    'confirming an already confirmed sales order is blocked'
  );
  await expectError(
    () => salesOrders.cancel(ctx.companyId, ctx.financialYearId, so2.id, ''),
    400,
    'cancelling without a reason is rejected',
    'reason'
  );
  const cancelledSo2 = await salesOrders.cancel(
    ctx.companyId,
    ctx.financialYearId,
    so2.id,
    'Customer cancelled the requirement'
  );
  assert(
    cancelledSo2.status === 'CANCELLED' &&
      cancelledSo2.cancellationReason === 'Customer cancelled the requirement' &&
      cancelledSo2.cancelledAt !== null,
    'cancelling a sales order stores the reason and timestamp'
  );
  await expectError(
    () => salesOrders.cancel(ctx.companyId, ctx.financialYearId, so2.id, 'Cancel again'),
    409,
    'cancelling an already cancelled sales order is blocked'
  );
  const confirmedSo1 = await salesOrders.confirm(ctx.companyId, ctx.financialYearId, so1.id);
  assert(confirmedSo1.status === 'CONFIRMED', 'first sales order can be confirmed after validation checks');
  const so1History = await salesOrders.history(ctx.companyId, ctx.financialYearId, so1.id);
  assert(
    so1History.length === 2 &&
      so1History[0]?.action === 'CREATED' &&
      so1History[1]?.action === 'CONFIRMED' &&
      so1History[1]?.fromStatus === 'DRAFT' &&
      so1History[1]?.toStatus === 'CONFIRMED',
    'sales order history records CREATED and CONFIRMED transitions'
  );
  const so3 = await salesOrders.copy(ctx.companyId, ctx.financialYearId, so1.id);
  assert(
    so3.orderNumber === 'SO-2026-0003' && so3.status === 'DRAFT' && so3.lines.length === 2,
    `copying a sales order creates a new draft with the next number (received ${so3.orderNumber})`
  );
  assert(
    Number(so3.totals.grandTotal) > 0 && so3.id !== so1.id,
    'the copied sales order recalculates totals and has its own identity'
  );
  const nextSo = await salesOrders.nextNumber(ctx.companyId, ctx.financialYearId);
  assert(
    nextSo.orderNumber === 'SO-2026-0004',
    `next sales order number preview is SO-2026-0004 (received ${nextSo.orderNumber})`
  );
  const soList = await salesOrders.list(ctx.companyId, ctx.financialYearId, {});
  assert(
    soList.total === 3 && soList.items.some((row) => row.orderNumber === 'SO-2026-0001'),
    'sales order register lists all three orders for the financial year'
  );
  const soSummary = await salesOrders.summary(ctx.companyId, ctx.financialYearId);
  assert(
    soSummary.statuses.CONFIRMED?.count === 1 &&
      soSummary.statuses.CANCELLED?.count === 1 &&
      soSummary.statuses.DRAFT?.count === 1 &&
      soSummary.pending.count === 2,
    'sales order summary counts DRAFT, CONFIRMED and CANCELLED orders and two pending orders'
  );

  section('6. Purchase order creation, numbering and GST calculation');
  const po1 = await purchaseOrders.create(ctx.companyId, ctx.financialYearId, purchasePayload(ctx));
  assert(po1.orderNumber === 'PO-2026-0001', `first purchase order number is PO-2026-0001 (received ${po1.orderNumber})`);
  assert(po1.status === 'DRAFT' && po1.lines.length === 2, 'a new purchase order starts in DRAFT with both lines');
  assert(
    po1.totals.totalQuantity === '120.000' &&
      po1.totals.subtotal === '14000.00' &&
      po1.totals.discountAmount === '1000.00' &&
      po1.totals.taxableAmount === '13000.00',
    'purchase order totals aggregate quantity, gross value, discount and taxable value'
  );
  assert(
    po1.totals.cgstAmount === '910.00' &&
      po1.totals.sgstAmount === '910.00' &&
      po1.totals.igstAmount === '0.00' &&
      po1.totals.freightAmount === '500.00',
    'purchase order applies CGST 910.00 / SGST 910.00 and freight 500.00'
  );
  assert(
    po1.totals.grandTotal === '15320.00' && po1.totals.roundOffAmount === '0.00',
    `purchase order grand total is exactly 15320.00 (received ${po1.totals.grandTotal})`
  );
  assert(
    po1.deliveryLocationName === 'Main Godown' && po1.lines[0].deliveryLocationName === 'Main Godown',
    'header and line delivery locations are resolved from the location master'
  );
  const po1Raw = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po1.id } });
  assert(
    po1Raw.grandTotal.toFixed(2) === '15320.00' && po1Raw.totalQuantity.toFixed(3) === '120.000',
    'purchase order header stores Decimal(15,2) money and Decimal(15,3) quantity'
  );

  section('7. Inter-state purchase order');
  const po2 = await purchaseOrders.create(
    ctx.companyId,
    ctx.financialYearId,
    purchasePayload(ctx, {
      partyId: ctx.supplierMaharashtraId,
      freightAmount: '0',
      lines: [
        { itemId: ctx.itemAId, quantity: '10', rate: '100', discountPercent: '0', gstRate: '18' },
      ],
    })
  );
  assert(po2.orderNumber === 'PO-2026-0002', `second purchase order number is PO-2026-0002 (received ${po2.orderNumber})`);
  assert(po2.taxType === 'INTER_STATE', 'Gujarat company and Maharashtra supplier resolve to INTER_STATE');
  assert(
    po2.totals.igstAmount === '180.00' &&
      po2.totals.cgstAmount === '0.00' &&
      po2.totals.sgstAmount === '0.00' &&
      po2.totals.grandTotal === '1180.00',
    'inter-state purchase order charges IGST only (180.00 on 1000.00 taxable value)'
  );

  section('8. Purchase order validation');
  await expectError(
    () => purchaseOrders.create(ctx.companyId, ctx.financialYearId, purchasePayload(ctx, { partyId: undefined })),
    400,
    'purchase order without a supplier is rejected',
    'partyId'
  );
  await expectError(
    () =>
      purchaseOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        purchasePayload(ctx, { partyId: ctx.customerGujaratId })
      ),
    400,
    'a customer cannot be used as the supplier on a purchase order',
    'partyId'
  );
  await expectError(
    () =>
      purchaseOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        purchasePayload(ctx, { deliveryLocationId: 'not-a-location' })
      ),
    400,
    'an unknown header delivery location is rejected',
    'deliveryLocationId'
  );
  await expectError(
    () =>
      purchaseOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        purchasePayload(ctx, {
          lines: [{ itemId: ctx.itemAId, quantity: '1', rate: '10', deliveryLocationId: 'not-a-location' }],
        })
      ),
    400,
    'an unknown line delivery location is rejected',
    'lines[0].deliveryLocationId'
  );
  await expectError(
    () =>
      purchaseOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        purchasePayload(ctx, {
          lines: [{ itemId: ctx.inactiveItemId, quantity: '1', rate: '10' }],
        })
      ),
    400,
    'an inactive item cannot be ordered',
    'lines[0].itemId'
  );
  await expectError(
    () =>
      purchaseOrders.create(
        ctx.companyId,
        ctx.financialYearId,
        purchasePayload(ctx, { orderDate: '2027-05-10' })
      ),
    400,
    'a purchase order date outside the financial year is rejected',
    'orderDate'
  );

  section('9. Purchase order lifecycle');
  const approvedPo1 = await purchaseOrders.approve(ctx.companyId, ctx.financialYearId, po1.id);
  assert(approvedPo1.status === 'APPROVED' && approvedPo1.approvedAt !== null, 'draft purchase order can be approved');
  await expectError(
    () => purchaseOrders.update(ctx.companyId, ctx.financialYearId, po1.id, purchasePayload(ctx)),
    409,
    'an approved purchase order can no longer be edited'
  );
  const sentPo1 = await purchaseOrders.send(ctx.companyId, ctx.financialYearId, po1.id);
  assert(sentPo1.status === 'SENT' && sentPo1.sentAt !== null, 'an approved purchase order can be marked as sent');
  const ackPo1 = await purchaseOrders.acknowledge(ctx.companyId, ctx.financialYearId, po1.id);
  assert(
    ackPo1.status === 'ACKNOWLEDGED' && ackPo1.supplierConfirmationDate !== null,
    'a sent purchase order can be acknowledged by the supplier'
  );
  await expectError(
    () => purchaseOrders.approve(ctx.companyId, ctx.financialYearId, po1.id),
    409,
    'approving an acknowledged purchase order is blocked'
  );
  await expectError(
    () => purchaseOrders.send(ctx.companyId, ctx.financialYearId, po1.id),
    409,
    'sending an already acknowledged purchase order is blocked'
  );
  const poHistory = await purchaseOrders.history(ctx.companyId, ctx.financialYearId, po1.id);
  assert(
    poHistory.map((entry) => entry.action).join(',') === 'CREATED,APPROVED,SENT,ACKNOWLEDGED',
    `purchase order history records CREATED, APPROVED, SENT and ACKNOWLEDGED (received ${poHistory
      .map((entry) => entry.action)
      .join(',')})`
  );
  const po3 = await purchaseOrders.copy(ctx.companyId, ctx.financialYearId, po1.id);
  assert(
    po3.orderNumber === 'PO-2026-0003' && po3.status === 'DRAFT' && po3.lines.length === 2,
    `copying a purchase order creates a new draft with the next number (received ${po3.orderNumber})`
  );
  await expectError(
    () => purchaseOrders.cancel(ctx.companyId, ctx.financialYearId, po2.id, 'no'),
    400,
    'a cancellation reason shorter than 3 characters is rejected',
    'reason'
  );
  const cancelledPo2 = await purchaseOrders.cancel(
    ctx.companyId,
    ctx.financialYearId,
    po2.id,
    'Quotation was not competitive'
  );
  assert(
    cancelledPo2.status === 'CANCELLED' && cancelledPo2.cancellationReason === 'Quotation was not competitive',
    'cancelling a purchase order stores the reason'
  );
  const nextPo = await purchaseOrders.nextNumber(ctx.companyId, ctx.financialYearId);
  assert(
    nextPo.orderNumber === 'PO-2026-0004',
    `next purchase order number preview is PO-2026-0004 (received ${nextPo.orderNumber})`
  );
  const poSummary = await purchaseOrders.summary(ctx.companyId, ctx.financialYearId);
  assert(
    poSummary.statuses.ACKNOWLEDGED?.count === 1 &&
      poSummary.statuses.DRAFT?.count === 1 &&
      poSummary.statuses.CANCELLED?.count === 1 &&
      poSummary.pending.count === 2,
    'purchase order summary counts ACKNOWLEDGED, DRAFT and CANCELLED orders and two pending orders'
  );
  await expectError(
    () => itemService.setStatus(ctx.companyId, ctx.itemAId, false),
    409,
    'deactivating an item referenced by open orders is blocked'
  );

  section('10. Company / financial year isolation and locked periods');
  await expectError(
    () => salesOrders.getById(ctx.otherCompanyId, ctx.otherFinancialYearId, so1.id),
    404,
    'a sales order cannot be read from another company'
  );
  await expectError(
    () => purchaseOrders.getById(ctx.otherCompanyId, ctx.otherFinancialYearId, po1.id),
    404,
    'a purchase order cannot be read from another company'
  );
  await expectError(
    () => salesOrders.getById(ctx.companyId, ctx.lockedFinancialYearId, so1.id),
    404,
    'a sales order cannot be read from a different financial year'
  );
  await expectError(
    () => purchaseOrders.getById(ctx.companyId, ctx.lockedFinancialYearId, po1.id),
    404,
    'a purchase order cannot be read from a different financial year'
  );
  await expectError(
    () => salesOrders.create(ctx.companyId, ctx.lockedFinancialYearId, salesPayload(ctx)),
    409,
    'creating a sales order in a locked financial year is blocked'
  );
  await expectError(
    () => purchaseOrders.create(ctx.companyId, ctx.lockedFinancialYearId, purchasePayload(ctx)),
    409,
    'creating a purchase order in a locked financial year is blocked'
  );
  await expectError(
    () => salesOrders.confirm(ctx.companyId, ctx.lockedFinancialYearId, so1.id),
    409,
    'confirming a sales order in a locked financial year is blocked'
  );
  await expectError(
    () => purchaseOrders.approve(ctx.companyId, ctx.lockedFinancialYearId, po1.id),
    409,
    'approving a purchase order in a locked financial year is blocked'
  );
  await expectError(
    () => salesOrders.update(ctx.companyId, ctx.lockedFinancialYearId, so1.id, salesPayload(ctx)),
    409,
    'editing a sales order in a locked financial year is blocked'
  );
  await expectError(
    () => purchaseOrders.cancel(ctx.companyId, ctx.lockedFinancialYearId, po1.id, 'Locked year cancel'),
    409,
    'cancelling a purchase order in a locked financial year is blocked'
  );

  section('11. Accounting and inventory integrity');
  const [journalCount, voucherCount, purchaseBillCount, ledgerCount, linkCount] = await Promise.all([
    prisma.journalLine.count({ where: { companyId: ctx.companyId } }),
    prisma.bankVoucher.count({ where: { companyId: ctx.companyId } }),
    prisma.purchaseBill.count({ where: { companyId: ctx.companyId } }),
    prisma.ledgerAccount.count({ where: { companyId: ctx.companyId } }),
    prisma.orderFulfilmentLink.count({ where: { companyId: ctx.companyId } }),
  ]);
  assert(journalCount === 0, 'orders never create journal lines');
  assert(voucherCount === 0, 'orders never create bank vouchers');
  assert(purchaseBillCount === 0, 'orders never create GST purchase bills');
  assert(ledgerCount === 0, 'orders never create or move ledger account balances');
  assert(linkCount === 0, 'no fulfilment link is fabricated without a real dispatch or receipt module');
  const parties = await prisma.party.findMany({
    where: { companyId: ctx.companyId },
    select: { openingBalance: true },
  });
  assert(
    parties.every((party) => party.openingBalance.toFixed(2) === '0.00'),
    'party master opening balances are untouched by order confirmation and approval'
  );
  const storedItems = await prisma.item.findMany({ where: { companyId: ctx.companyId } });
  assert(
    storedItems.find((item) => item.id === ctx.itemAId)?.defaultSalesRate.toFixed(4) === '250.0000',
    'item master rates are not mutated by order documents'
  );
  assert(
    (await prisma.orderSequence.findMany({ where: { companyId: ctx.companyId } })).length === 2,
    'one independent sequence row exists for sales orders and one for purchase orders'
  );

  section('12. Order reports (8 sales + 8 purchase)');
  const expectedSalesKeys = [
    'pending-sales-orders',
    'customer-wise-orders',
    'item-wise-orders',
    'delivery-schedule',
    'overdue-sales-orders',
    'partially-fulfilled-orders',
    'fully-fulfilled-orders',
    'fulfilment-summary',
  ];
  const expectedPurchaseKeys = [
    'pending-purchase-orders',
    'supplier-wise-orders',
    'item-wise-purchase-orders',
    'expected-delivery',
    'overdue-purchase-orders',
    'partially-received-orders',
    'fully-received-orders',
    'pending-quantity',
  ];
  assert(
    orderReports.salesList().map((entry) => entry.key).join(',') === expectedSalesKeys.join(','),
    'the sales report catalogue exposes the eight specified reports in order'
  );
  assert(
    orderReports.purchaseList().map((entry) => entry.key).join(',') === expectedPurchaseKeys.join(','),
    'the purchase report catalogue exposes the eight specified reports in order'
  );

  for (const definition of orderReports.salesList()) {
    const result = await orderReports.runSales(ctx.companyId, ctx.financialYearId, definition.key, {});
    assert(
      result.key === definition.key &&
        result.columns.length === definition.columns.length &&
        Array.isArray(result.rows) &&
        result.rows.every((row) => definition.columns.every((column) => column.key in row)) &&
        typeof result.generatedAt === 'string',
      `sales report ${definition.key} returns its declared columns and row shape`
    );
  }
  for (const definition of orderReports.purchaseList()) {
    const result = await orderReports.runPurchase(ctx.companyId, ctx.financialYearId, definition.key, {});
    assert(
      result.key === definition.key &&
        result.columns.length === definition.columns.length &&
        Array.isArray(result.rows) &&
        result.rows.every((row) => definition.columns.every((column) => column.key in row)) &&
        typeof result.generatedAt === 'string',
      `purchase report ${definition.key} returns its declared columns and row shape`
    );
  }

  const pendingSales = await orderReports.runSales(
    ctx.companyId,
    ctx.financialYearId,
    'pending-sales-orders',
    {}
  );
  assert(
    pendingSales.rows.length === 2,
    `pending sales orders report lists the confirmed and the copied draft order (received ${pendingSales.rows.length})`
  );
  const pendingPurchase = await orderReports.runPurchase(
    ctx.companyId,
    ctx.financialYearId,
    'pending-purchase-orders',
    {}
  );
  assert(
    pendingPurchase.rows.length === 2,
    `pending purchase orders report lists the acknowledged and the copied draft order (received ${pendingPurchase.rows.length})`
  );
  const windowedSales = await orderReports.runSales(
    ctx.companyId,
    ctx.financialYearId,
    'pending-sales-orders',
    { fromDate: '2026-05-01', toDate: '2026-05-31' }
  );
  assert(
    windowedSales.rows.length === 1,
    `sales report date filtering keeps only the May order (received ${windowedSales.rows.length})`
  );
  const customerWise = await orderReports.runSales(
    ctx.companyId,
    ctx.financialYearId,
    'customer-wise-orders',
    {}
  );
  assert(
    customerWise.rows.length === 2 && Object.keys(customerWise.totals).length > 0,
    'customer-wise report groups both customers and returns computed totals'
  );
  await expectError(
    () => orderReports.runSales(ctx.companyId, ctx.financialYearId, 'unknown-report', {}),
    400,
    'an unknown sales report key is rejected',
    'report'
  );
  await expectError(
    () => orderReports.runPurchase(ctx.companyId, ctx.financialYearId, 'unknown-report', {}),
    400,
    'an unknown purchase report key is rejected',
    'report'
  );
  await expectError(
    () =>
      orderReports.runSales(ctx.companyId, ctx.financialYearId, 'pending-sales-orders', {
        fromDate: '2026-13-01',
      }),
    400,
    'an invalid report date filter is rejected',
    'fromDate'
  );

  section('13. Lookups and next-number previews');
  const salesLookups = await salesOrders.getLookups(ctx.companyId, ctx.financialYearId);
  assert(
    salesLookups.parties.length === 2 &&
      salesLookups.items.length === 3 &&
      salesLookups.nextOrderNumber === 'SO-2026-0004',
    'sales lookups expose only active customers, all active items and the next number'
  );
  const purchaseLookups = await purchaseOrders.getLookups(ctx.companyId, ctx.financialYearId);
  assert(
    purchaseLookups.parties.length === 2 &&
      purchaseLookups.locations.length === 1 &&
      purchaseLookups.nextOrderNumber === 'PO-2026-0004',
    'purchase lookups expose only active suppliers, active locations and the next number'
  );

  section('14. API route surface');
  const salesRoutes = readFileSync(path.join(backendSrc, 'routes/salesOrderRoutes.ts'), 'utf8');
  const purchaseRoutes = readFileSync(path.join(backendSrc, 'routes/purchaseOrderRoutes.ts'), 'utf8');
  const itemRoutes = readFileSync(path.join(backendSrc, 'routes/itemRoutes.ts'), 'utf8');
  const routeIndex = readFileSync(path.join(backendSrc, 'routes/index.ts'), 'utf8');
  assert(
    [
      "router.get('/lookups'",
      "router.get('/next-number'",
      "router.get('/summary'",
      "router.get('/reports'",
      "router.get('/reports/:reportKey'",
      "router.get('/'",
      "router.post('/'",
      "router.get('/:id'",
      "router.put('/:id'",
      "router.get('/:id/history'",
      "router.post('/:id/confirm'",
      "router.post('/:id/cancel'",
      "router.post('/:id/copy'",
    ].every((needle) => salesRoutes.includes(needle)),
    'sales order routes expose lookups, registers, reports, CRUD, history, confirm, cancel and copy'
  );
  assert(
    [
      "router.post('/:id/approve'",
      "router.post('/:id/send'",
      "router.post('/:id/acknowledge'",
      "router.post('/:id/cancel'",
      "router.post('/:id/copy'",
      "router.get('/reports/:reportKey'",
    ].every((needle) => purchaseRoutes.includes(needle)),
    'purchase order routes expose approve, send, acknowledge, cancel, copy and reports'
  );
  assert(
    [
      "router.get('/lookups'",
      "router.get('/summary'",
      "router.get('/'",
      "router.post('/'",
      "router.get('/:id'",
      "router.put('/:id'",
      "router.patch('/:id/status'",
    ].every((needle) => itemRoutes.includes(needle)),
    'item routes expose lookups, summary, CRUD and status toggle'
  );
  assert(
    routeIndex.includes("router.use('/items', itemRoutes)") &&
      routeIndex.includes("router.use('/sales-orders', salesOrderRoutes)") &&
      routeIndex.includes("router.use('/purchase-orders', purchaseOrderRoutes)"),
    'the three Phase 13 routers are mounted on the API root'
  );

  section('15. Frontend wiring and print support');
  const requiredFiles = [
    'pages/OrderEntryPage.tsx',
    'pages/OrderRegisterPage.tsx',
    'pages/OrderDetailPage.tsx',
    'pages/OrderPrintPage.tsx',
    'pages/OrderReportsPage.tsx',
    'pages/ItemMasterPage.tsx',
    'pages/orderPageShared.ts',
    'components/ItemModal.tsx',
    'types/orders.ts',
  ];
  assert(
    requiredFiles.every((file) => existsSync(path.join(frontendSrc, file))),
    'all Phase 13 frontend pages, shared helpers and types exist'
  );
  const appSource = readFileSync(path.join(frontendSrc, 'App.tsx'), 'utf8');
  assert(
    appSource.includes('/transactions/sales-orders') &&
      appSource.includes('/transactions/purchase-orders') &&
      appSource.includes('/masters/items') &&
      appSource.includes('OrderPrintPage') &&
      appSource.includes('OrderReportsPage'),
    'App.tsx registers item master, sales order and purchase order pages including print and reports'
  );
  const navigationSource = readFileSync(path.join(frontendSrc, 'config/navigation.ts'), 'utf8');
  assert(
    navigationSource.includes("route: '/transactions/sales-orders'") &&
      navigationSource.includes("route: '/transactions/purchase-orders'") &&
      navigationSource.includes("route: '/masters/items'") &&
      (navigationSource.match(/plannedPhase: 'Phase 13/g) ?? []).length === 3,
    'dashboard shortcuts point at the three Phase 13 routes and are marked implemented'
  );
  const apiSource = readFileSync(path.join(frontendSrc, 'services/api.ts'), 'utf8');
  assert(
    apiSource.includes('/sales-orders') &&
      apiSource.includes('/purchase-orders') &&
      apiSource.includes('/items') &&
      apiSource.includes('runOrderReport'),
    'the frontend API client exposes item, sales order, purchase order and report calls'
  );
  const sharedSource = readFileSync(path.join(frontendSrc, 'pages/orderPageShared.ts'), 'utf8');
  assert(
    sharedSource.includes('computeLineDraft') && sharedSource.includes('statusTone'),
    'shared order page helpers provide client-side preview totals and status tones'
  );
  const printSource = readFileSync(path.join(frontendSrc, 'pages/OrderPrintPage.tsx'), 'utf8');
  assert(
    printSource.includes('amountInWords') &&
      printSource.includes('window.print()') &&
      printSource.includes('print-toolbar'),
    'the order print page renders amount in words and a print toolbar'
  );
  const printStyles = readFileSync(path.join(frontendSrc, 'styles/index.css'), 'utf8');
  assert(
    printStyles.includes('@media print') && printStyles.includes('.print-toolbar'),
    'the shared print stylesheet still hides toolbars and prints order pages on white'
  );
  assert(
    amountInWords('31731') === 'Rupees Thirty One Thousand Seven Hundred Thirty One Only' &&
      amountInWords('13522.5') === 'Rupees Thirteen Thousand Five Hundred Twenty Two And Paise Fifty Only',
    'amount in words converts order totals using the Indian numbering system'
  );

  section('16. Test result');
  console.log(`\nPhase 13 suite: ${passed}/${total} assertions passed.`);
}

(async () => {
  try {
    await run();
  } catch (error) {
    console.error('\nPhase 13 suite aborted:', error);
    process.exitCode = 1;
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }
})();
