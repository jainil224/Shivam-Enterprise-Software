import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';

async function seed() {
  console.log('Seeding Phase 8 records for active company...');

  // Get active masters
  const party = await prisma.party.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const machine = await prisma.machine.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const operator = await prisma.operator.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const quality = await prisma.yarnQuality.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const grade = await prisma.yarnGrade.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });
  const location = await prisma.location.findFirst({ where: { companyId: COMPANY_ID, isActive: true } });

  // Delete existing records for this book to have fresh, clean numbering 1001, 1002, 1003
  await prisma.productionReceiveItem.deleteMany({
    where: { productionReceive: { companyId: COMPANY_ID, productionBookId: BOOK_ID } },
  });
  await prisma.productionReceive.deleteMany({
    where: { companyId: COMPANY_ID, productionBookId: BOOK_ID },
  });

  // Record 1: Challan 1001 (Confirmed)
  const c1 = await prisma.productionReceive.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      productionBookId: BOOK_ID,
      challanNumber: '1001',
      challanDate: new Date('2026-04-05T00:00:00.000Z'),
      partyId: party?.id,
      machineId: machine?.id,
      operatorId: operator?.id,
      yarnQualityId: quality?.id,
      yarnGradeId: grade?.id,
      locationId: location?.id,
      lotNumber: 'LOT-80/72-A',
      twist: '80',
      emptyCopsWeight: 0.040,
      status: 'CONFIRMED',
      items: {
        create: [
          { cartonNumber: '1', cartonWeight: 1.200, cops: 24, grossWeight: 31.620, copsWeight: 0.040, tareWeight: 2.160, netWeight: 29.460, averageWeight: 1.228, lotNumber: 'LOT-80/72-A', twist: '80', grade: 'Fresh A' },
          { cartonNumber: '2', cartonWeight: 1.200, cops: 24, grossWeight: 30.850, copsWeight: 0.040, tareWeight: 2.160, netWeight: 28.690, averageWeight: 1.195, lotNumber: 'LOT-80/72-A', twist: '80', grade: 'Fresh A' },
        ],
      },
    },
  });

  // Record 2: Challan 1002 (Confirmed)
  const c2 = await prisma.productionReceive.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      productionBookId: BOOK_ID,
      challanNumber: '1002',
      challanDate: new Date('2026-04-06T00:00:00.000Z'),
      partyId: party?.id,
      machineId: machine?.id,
      operatorId: operator?.id,
      yarnQualityId: quality?.id,
      yarnGradeId: grade?.id,
      locationId: location?.id,
      lotNumber: 'LOT-80/72-B',
      twist: '80',
      emptyCopsWeight: 0.040,
      status: 'CONFIRMED',
      items: {
        create: [
          { cartonNumber: '3', cartonWeight: 1.200, cops: 24, grossWeight: 32.100, copsWeight: 0.040, tareWeight: 2.160, netWeight: 29.940, averageWeight: 1.248, lotNumber: 'LOT-80/72-B', twist: '80', grade: 'Fresh A' },
          { cartonNumber: '4', cartonWeight: 1.200, cops: 24, grossWeight: 31.800, copsWeight: 0.040, tareWeight: 2.160, netWeight: 29.640, averageWeight: 1.235, lotNumber: 'LOT-80/72-B', twist: '80', grade: 'Fresh A' },
        ],
      },
    },
  });

  // Record 3: Challan 1003 (Cancelled)
  const c3 = await prisma.productionReceive.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      productionBookId: BOOK_ID,
      challanNumber: '1003',
      challanDate: new Date('2026-04-07T00:00:00.000Z'),
      partyId: party?.id,
      machineId: machine?.id,
      operatorId: operator?.id,
      yarnQualityId: quality?.id,
      yarnGradeId: grade?.id,
      locationId: location?.id,
      lotNumber: 'LOT-80/72-C',
      twist: '80',
      emptyCopsWeight: 0.040,
      status: 'CANCELLED',
      cancellationReason: 'Yarn package damaged during texturising run - order cancelled',
      cancelledAt: new Date('2026-04-07T14:30:00.000Z'),
      items: {
        create: [
          { cartonNumber: '5', cartonWeight: 1.200, cops: 24, grossWeight: 30.500, copsWeight: 0.040, tareWeight: 2.160, netWeight: 28.340, averageWeight: 1.181, lotNumber: 'LOT-80/72-C', twist: '80', grade: 'Fresh A' },
        ],
      },
    },
  });

  console.log(`Seeded 3 records: #1001 (${c1.id}), #1002 (${c2.id}), #1003 (${c3.id})`);
  await prisma.$disconnect();
}

seed().catch(console.error);

