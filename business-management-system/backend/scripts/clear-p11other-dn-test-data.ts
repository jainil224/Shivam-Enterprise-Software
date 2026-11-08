/**
 * Removes the TEMPORARY Debit Note test data seeded by seed-p11other-dn-test-data.ts.
 * Also deletes every Debit Note created against company P11OTHER while testing,
 * because those notes reference the seeded bills and ledgers.
 *
 * Run: npx tsx scripts/clear-p11other-dn-test-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_CODE = 'P11OTHER';

const PARTY_CODES = ['OT-SUPP-01', 'OT-SUPP-02', 'OT-CUST-01', 'OT-BOTH-01'];
const LEDGER_CODES = [
  'OT-INT-PUR',
  'OT-CASH-DISC',
  'OT-QTY-DISC',
  'OT-RATE-DIFF',
  'OT-INT-SALE',
  'OT-FREIGHT',
  'TDS-RECEIVABLE',
  'PL-OTSUPP01',
  'PL-OTCUST01',
];
const BILL_PREFIX = 'PB-OT-';

async function main() {
  const company = await prisma.company.findFirst({ where: { companyCode: COMPANY_CODE } });
  if (!company) throw new Error(`Company ${COMPANY_CODE} not found.`);

  const notes = await prisma.debitNote.findMany({ where: { companyId: company.id }, select: { noteNumber: true } });
  await prisma.journalLine.deleteMany({ where: { companyId: company.id, debitNoteId: { not: null } } });
  await prisma.debitNote.deleteMany({ where: { companyId: company.id } });
  console.log(`debit notes removed: ${notes.length}${notes.length ? ' -> ' + notes.map((n) => n.noteNumber).join(', ') : ''}`);

  const bills = await prisma.purchaseBill.deleteMany({
    where: { companyId: company.id, billNumber: { startsWith: BILL_PREFIX } },
  });
  console.log(`purchase bills removed: ${bills.count}`);

  // Ledgers must go before parties: ledger_accounts.party_id is ON DELETE RESTRICT.
  const ledgers = await prisma.ledgerAccount.deleteMany({
    where: { companyId: company.id, accountCode: { in: LEDGER_CODES } },
  });
  console.log(`ledger accounts removed: ${ledgers.count}`);

  const parties = await prisma.party.deleteMany({
    where: { companyId: company.id, partyCode: { in: PARTY_CODES } },
  });
  console.log(`parties removed: ${parties.count}`);

  const leftovers = await prisma.debitNote.count({ where: { companyId: company.id } });
  console.log(`remaining debit notes for ${COMPANY_CODE}: ${leftovers}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());