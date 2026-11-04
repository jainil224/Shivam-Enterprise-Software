import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const books = await prisma.productionBook.findMany();
  console.log('Current books:', books);
  for (const b of books) {
    if (!b.isActive) {
      await prisma.productionBook.update({
        where: { id: b.id },
        data: { isActive: true },
      });
      console.log(`Activated book: ${b.prefix} ${b.bookName}`);
    }
  }
}

main().finally(() => prisma.$disconnect());

