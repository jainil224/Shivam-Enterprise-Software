import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';

async function seed() {
  const party = await prisma.party.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const machine = await prisma.machine.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const operator = await prisma.operator.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const quality = await prisma.yarnQuality.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const grade = await prisma.yarnGrade.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const location = await prisma.location.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });

  // Delete previous 1004 if exists
  const existing1004 = await prisma.productionReceive.findFirst({
    where: { companyId: COMPANY_ID, challanNumber: '1004' },
  });
  if (existing1004) {
    await prisma.productionReceiveItem.deleteMany({ where: { productionReceiveId: existing1004.id } });
    await prisma.productionReceive.delete({ where: { id: existing1004.id } });
  }

  // Create 25 carton challan #1004 for multi-page demonstration
  const items = [];
  for (let i = 1; i <= 25; i++) {
    const gross = (30.500 + i * 0.12).toFixed(3);
    const tare = (1.200 + 24 * 0.040).toFixed(3);
    const net = (parseFloat(gross) - parseFloat(tare)).toFixed(3);
    const avg = (parseFloat(net) / 24).toFixed(3);
    items.push({
      cartonNumber: `${100 + i}`,
      cartonWeight: 1.200,
      cops: 24,
      grossWeight: parseFloat(gross),
      copsWeight: 0.040,
      tareWeight: parseFloat(tare),
      netWeight: parseFloat(net),
      averageWeight: parseFloat(avg),
      lotNumber: 'LOT-80/72-MP',
      twist: '80',
      grade: 'Fresh A',
    });
  }

  const c4 = await prisma.productionReceive.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      productionBookId: BOOK_ID,
      challanNumber: '1004',
      challanDate: new Date('2026-04-08T00:00:00.000Z'),
      partyId: party?.id,
      machineId: machine?.id,
      operatorId: operator?.id,
      yarnQualityId: quality?.id,
      yarnGradeId: grade?.id,
      locationId: location?.id,
      lotNumber: 'LOT-80/72-MP',
      twist: '80',
      emptyCopsWeight: 0.040,
      status: 'CONFIRMED',
      items: {
        create: items,
      },
    },
  });

  console.log(`Created multi-page Challan #1004 ID: ${c4.id}`);
  await prisma.$disconnect();
}

seed().catch(console.error);

