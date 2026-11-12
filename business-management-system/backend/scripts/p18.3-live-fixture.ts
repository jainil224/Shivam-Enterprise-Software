// Phase 18.3 live fixture - one 32,550.00 confirmed bill for the demo Alpha
// party so the browser run can prove the 18,000 cash + 14,550 discount
// settlement. Every run reuses a bill that has no allocation yet, otherwise it
// creates the next suffix, so repeated runs never fight over the same bill.
//
// Usage: npx tsx scripts/p18.3-live-fixture.ts [create|status]

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_ID = '902a42ff-ee15-4437-af80-d649a06faabd';
const FY_ID = '0ad77610-eefc-44a3-8a5f-a3a7b61f14f5';
const PARTY_CODE = 'P18-TEMP-ALPHA';
const BILL_PREFIX = 'P18/BILL/1830';
const BILL_AMOUNT = '32550.00';

async function findParty(): Promise<{ id: string; partyName: string }> {
  const party = await prisma.party.findFirst({
    where: { companyId: COMPANY_ID, partyCode: PARTY_CODE },
    select: { id: true, partyName: true },
  });
  if (!party) throw new Error(`Demo party ${PARTY_CODE} is missing. Run p18-live-temp-data.ts create first.`);
  return party;
}

async function create(): Promise<void> {
  const party = await findParty();

  const existing = await prisma.purchaseBill.findMany({
    where: { companyId: COMPANY_ID, financialYearId: FY_ID, billNumber: { startsWith: BILL_PREFIX } },
    select: {
      id: true,
      billNumber: true,
      _count: { select: { bankReceiptAllocations: true } },
    },
    orderBy: { billNumber: 'asc' },
  });

  const reusable = existing.find((bill) => bill._count.bankReceiptAllocations === 0);
  if (reusable) {
    console.log(
      JSON.stringify({ action: 'reused', billId: reusable.id, billNumber: reusable.billNumber, party }, null, 2)
    );
    return;
  }

  const billNumber = existing.length === 0 ? BILL_PREFIX : `${BILL_PREFIX}-${existing.length + 1}`;
  const bill = await prisma.purchaseBill.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      billNumber,
      billDate: new Date('2026-04-05T00:00:00.000Z'),
      partyId: party.id,
      supplierLegalName: 'P18 TEMP Supplier (demo)',
      supplierTradeName: 'P18 TEMP Supplier',
      supplierCity: 'Surat',
      supplierState: 'Gujarat',
      totalAmount: new Prisma.Decimal(BILL_AMOUNT),
      status: 'CONFIRMED',
      remarks: 'P18.3 live fixture (demo data, safe to delete)',
    },
    select: { id: true, billNumber: true },
  });
  await prisma.purchaseBillItem.create({
    data: {
      purchaseBillId: bill.id,
      itemDescription: 'Cotton Saree',
      quantity: new Prisma.Decimal('25.000'),
      unit: 'PCS',
      rate: new Prisma.Decimal('1302.00'),
      taxableAmount: new Prisma.Decimal(BILL_AMOUNT),
    },
  });
  console.log(JSON.stringify({ action: 'created', billId: bill.id, billNumber: bill.billNumber, party }, null, 2));
}

async function status(): Promise<void> {
  const bills = await prisma.purchaseBill.findMany({
    where: { companyId: COMPANY_ID, financialYearId: FY_ID, billNumber: { startsWith: BILL_PREFIX } },
    select: {
      id: true,
      billNumber: true,
      totalAmount: true,
      status: true,
      _count: { select: { bankReceiptAllocations: true, adjustmentLines: true } },
    },
    orderBy: { billNumber: 'asc' },
  });
  console.log(
    JSON.stringify(
      bills.map((bill) => ({
        billNumber: bill.billNumber,
        id: bill.id,
        totalAmount: String(bill.totalAmount),
        status: bill.status,
        allocations: bill._count.bankReceiptAllocations,
        adjustments: bill._count.adjustmentLines,
      })),
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'create';
  if (mode === 'status') await status();
  else await create();
  await prisma.$disconnect();
}

void main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exitCode = 1;
});