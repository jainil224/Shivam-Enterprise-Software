import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY = '2b696c58-cb50-4afd-b856-44afba670845';

async function main() {
  const notes = await prisma.debitNote.count({ where: { companyId: COMPANY } });
  const journals = await prisma.journalLine.count({ where: { companyId: COMPANY } });
  await prisma.debitNote.deleteMany({ where: { companyId: COMPANY } });
  await prisma.journalLine.deleteMany({ where: { companyId: COMPANY } });
  const ledgers = await prisma.ledgerAccount.deleteMany({
    where: { companyId: COMPANY, accountCode: { startsWith: 'VERIFY-' } },
  });
  const remainingNotes = await prisma.debitNote.count({ where: { companyId: COMPANY } });
  console.log('deleted notes=' + notes + ' journalLines=' + journals + ' verifyLedgers=' + ledgers.count + ' remainingNotes=' + remainingNotes);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
