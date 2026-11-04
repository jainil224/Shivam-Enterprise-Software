import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    include: {
      financialYears: true,
      productionBooks: true,
    },
  });
  console.log('Total companies:', companies.length);
  for (const c of companies) {
    console.log(`Company: ${c.companyName} (${c.companyCode}) [ID: ${c.id}]`);
    console.log('  Financial Years:', c.financialYears.map((fy) => `${fy.yearName} [${fy.id}]`));
    console.log('  Production Books:', c.productionBooks.map((b) => `${b.prefix}: ${b.bookName} [${b.id}]`));
  }
}

main().finally(() => prisma.$disconnect());

