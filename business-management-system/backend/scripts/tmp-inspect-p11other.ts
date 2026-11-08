import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const CODE = 'P11OTHER';

async function main() {
  const company = await prisma.company.findFirst({ where: { companyCode: CODE } });
  if (!company) { console.log('COMPANY NOT FOUND'); return; }
  console.log('company', company.id, company.companyName, company.state, company.gstin);
  const years = await prisma.financialYear.findMany({ where: { companyId: company.id }, orderBy: { startDate: 'desc' } });
  console.log('years', years.map((y) => `${y.yearName}|${y.id}|active=${y.isActive}|locked=${y.isLocked}`).join(' ; '));
  const books = await prisma.debitNoteBook.findMany({ where: { companyId: company.id } });
  console.log('dn books', books.length, books.map((b) => `${b.bookName}|${b.prefix}|${b.financialYearId}`).join(' ; '));
  const parties = await prisma.party.findMany({ where: { companyId: company.id }, select: { partyCode: true, partyName: true, partyType: true, isActive: true } });
  console.log('parties', parties.length, parties.slice(0, 12).map((p) => `${p.partyCode}:${p.partyName}:${p.partyType}:${p.isActive}`).join(' ; '));
  const ledgers = await prisma.ledgerAccount.findMany({ where: { companyId: company.id }, select: { accountCode: true, accountName: true, accountGroup: true } });
  console.log('ledgers', ledgers.length, ledgers.slice(0, 15).map((l) => `${l.accountCode}:${l.accountName}:${l.accountGroup}`).join(' ; '));
  const bills = await prisma.purchaseBill.findMany({ where: { companyId: company.id }, select: { billNumber: true, supplierInvoiceNumber: true, totalAmount: true, status: true, partyId: true, financialYearId: true } });
  console.log('purchase bills', bills.length, bills.slice(0, 10).map((b) => `${b.supplierInvoiceNumber}|${b.totalAmount}|${b.status}|fy=${b.financialYearId}`).join(' ; '));
  const dns = await prisma.debitNote.count({ where: { companyId: company.id } });
  console.log('debit notes', dns);
  const items = await prisma.item.count({ where: { companyId: company.id } });
  console.log('items', items);
  const sales = await prisma.salesInvoice?.count?.({ where: { companyId: company.id } }).catch(() => 'n/a');
  console.log('sales invoices', sales);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());