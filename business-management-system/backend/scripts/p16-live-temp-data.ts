// Phase 16 - temporary live-scope demo data.
// Creates real, posted bank vouchers (double entry) so the Bank Reconciliation
// screen has visible rows, then marks two of them cleared. Every row carries the
// "P16-TEMP-" reference prefix and a "P16 TEMP" narration so it can be removed
// with a single command:  npx tsx scripts/p16-live-temp-data.ts cleanup

import { PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { BankReconciliationService } from '../src/services/bankReconciliationService.js';

const prisma = new PrismaClient();
const voucherService = new BankVoucherService();
const reconService = new BankReconciliationService();

const COMPANY_ID = '902a42ff-ee15-4437-af80-d649a06faabd';
const FY_ID = '0ad77610-eefc-44a3-8a5f-a3a7b61f14f5';
const BANK_ID = 'ca64c072-597f-4012-b67f-7200696e269d';

const REF_PREFIX = 'P16-TEMP-';

interface TempEntry {
  voucherType: 'RECEIPT' | 'PAYMENT';
  voucherDate: string;
  amount: string;
  paymentMode: 'NEFT' | 'RTGS' | 'IMPS' | 'CHEQUE' | 'UPI';
  referenceNumber: string;
  chequeNumber?: string;
  chequeDate?: string;
  narration: string;
  partyCode: string;
  clearingDate?: string;
}

const TEMP_PARTIES = [
  { partyCode: 'TMP16-CUST', partyName: 'P16 TEMP Customer (test data)', partyType: 'CUSTOMER' as const },
  { partyCode: 'TMP16-SUPP', partyName: 'P16 TEMP Supplier (test data)', partyType: 'SUPPLIER' as const },
];

const ENTRIES: TempEntry[] = [
  {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-10',
    amount: '30000.00',
    paymentMode: 'NEFT',
    referenceNumber: 'P16-TEMP-R1',
    narration: 'P16 TEMP receipt - NEFT from customer (test data, safe to delete)',
    partyCode: 'TMP16-CUST',
  },
  {
    voucherType: 'PAYMENT',
    voucherDate: '2026-05-10',
    amount: '6000.00',
    paymentMode: 'CHEQUE',
    referenceNumber: 'P16-TEMP-P1',
    chequeNumber: '900001',
    chequeDate: '2026-05-08',
    narration: 'P16 TEMP payment - cheque issued (test data, safe to delete)',
    partyCode: 'TMP16-SUPP',
    clearingDate: '2026-05-12',
  },
  {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-11',
    amount: '15000.00',
    paymentMode: 'UPI',
    referenceNumber: 'P16-TEMP-R2',
    narration: 'P16 TEMP receipt - UPI collection (test data, safe to delete)',
    partyCode: 'TMP16-CUST',
    clearingDate: '2026-05-13',
  },
  {
    voucherType: 'PAYMENT',
    voucherDate: '2026-05-18',
    amount: '12500.00',
    paymentMode: 'RTGS',
    referenceNumber: 'P16-TEMP-P2',
    narration: 'P16 TEMP payment - RTGS to supplier (test data, safe to delete)',
    partyCode: 'TMP16-SUPP',
  },
  {
    voucherType: 'RECEIPT',
    voucherDate: '2026-06-02',
    amount: '8000.00',
    paymentMode: 'IMPS',
    referenceNumber: 'P16-TEMP-R3',
    narration: 'P16 TEMP receipt - IMPS collection (test data, safe to delete)',
    partyCode: 'TMP16-CUST',
  },
];

const trailingNumber = (value: string): number => {
  const match = /(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
};

// The voucher sequence rows are missing in this company, so a fresh insert would
// restart at 001 and collide with the existing vouchers. Rebuild the sequence
// from the highest number already in use, which also repairs that gap.
async function syncSequence(voucherType: 'RECEIPT' | 'PAYMENT'): Promise<number> {
  const existing = await prisma.bankVoucher.findMany({
    where: { companyId: COMPANY_ID, financialYearId: FY_ID, voucherType },
    select: { voucherNumber: true },
  });
  const highest = existing.reduce((max, row) => Math.max(max, trailingNumber(row.voucherNumber)), 0);

  await prisma.$executeRaw`
    INSERT INTO "voucher_sequences"
      ("id", "company_id", "financial_year_id", "voucher_type", "last_number", "updated_at")
    VALUES
      (gen_random_uuid()::text, ${COMPANY_ID}, ${FY_ID}, ${voucherType}::"BankVoucherType", ${highest}, NOW())
    ON CONFLICT ("company_id", "financial_year_id", "voucher_type")
    DO UPDATE SET "last_number" = GREATEST("voucher_sequences"."last_number", ${highest}), "updated_at" = NOW()
  `;
  return highest;
}

async function cleanup(): Promise<void> {
  const vouchers = await prisma.bankVoucher.findMany({
    where: { companyId: COMPANY_ID, bankAccountLedgerId: BANK_ID, referenceNumber: { startsWith: REF_PREFIX } },
    select: { id: true },
  });
  const voucherIds = vouchers.map((row) => row.id);
  const lines = voucherIds.length
    ? await prisma.journalLine.findMany({ where: { companyId: COMPANY_ID, voucherId: { in: voucherIds } }, select: { id: true } })
    : [];
  const lineIds = lines.map((row) => row.id);

  if (lineIds.length > 0) {
    await prisma.bankReconciliationAudit.deleteMany({ where: { companyId: COMPANY_ID, bankJournalLineId: { in: lineIds } } });
    await prisma.bankReconciliationMark.deleteMany({ where: { companyId: COMPANY_ID, bankJournalLineId: { in: lineIds } } });
  }
  if (voucherIds.length > 0) {
    await prisma.journalLine.deleteMany({ where: { companyId: COMPANY_ID, voucherId: { in: voucherIds } } });
    await prisma.bankVoucher.deleteMany({ where: { id: { in: voucherIds } } });
  }

  const parties = await prisma.party.findMany({ where: { companyId: COMPANY_ID, partyCode: { startsWith: 'TMP16-' } }, select: { id: true, partyCode: true } });
  for (const party of parties) {
    const usedByVoucher = await prisma.bankVoucher.count({ where: { companyId: COMPANY_ID, partyId: party.id } });
    const usedByLedger = await prisma.ledgerAccount.count({ where: { companyId: COMPANY_ID, partyId: party.id } });
    if (usedByVoucher === 0 && usedByLedger === 0) {
      await prisma.party.delete({ where: { id: party.id } });
    }
  }

  await syncSequence('PAYMENT');
  await syncSequence('RECEIPT');

  console.log('cleanup done: vouchers=' + voucherIds.length + ' journalLines=' + lineIds.length + ' parties=' + parties.length);
}

async function create(): Promise<void> {
  await cleanup();

  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID }, select: { companyName: true } });
  const fy = await prisma.financialYear.findUnique({ where: { id: FY_ID }, select: { yearName: true, isLocked: true } });
  if (!company || !fy) throw new Error('Live company or financial year not found.');
  if (fy.isLocked) throw new Error('Financial year ' + fy.yearName + ' is locked; temp data cannot be posted.');

  const partyIds = new Map<string, string>();
  for (const party of TEMP_PARTIES) {
    const row = await prisma.party.upsert({
      where: { companyId_partyCode: { companyId: COMPANY_ID, partyCode: party.partyCode } },
      update: { isActive: true },
      create: {
        companyId: COMPANY_ID,
        partyCode: party.partyCode,
        partyName: party.partyName,
        partyType: party.partyType,
        openingBalance: 0,
        balanceType: party.partyType === 'CUSTOMER' ? 'DEBIT' : 'CREDIT',
      },
      select: { id: true, partyCode: true },
    });
    partyIds.set(row.partyCode, row.id);
  }

  console.log('sequences: PAYMENT=' + (await syncSequence('PAYMENT')) + ' RECEIPT=' + (await syncSequence('RECEIPT')));

  const created: Array<{ reference: string; voucherNumber: string; lineId: string | null; amount: string; type: string }> = [];

  for (const entry of ENTRIES) {
    const partyId = partyIds.get(entry.partyCode);
    if (!partyId) throw new Error('Missing temp party ' + entry.partyCode);

    const voucher = await voucherService.create(COMPANY_ID, FY_ID, entry.voucherType, {
      voucherDate: entry.voucherDate,
      partyId,
      bankAccountLedgerId: BANK_ID,
      paymentMode: entry.paymentMode,
      amount: entry.amount,
      referenceNumber: entry.referenceNumber,
      chequeNumber: entry.chequeNumber,
      chequeDate: entry.chequeDate,
      narration: entry.narration,
    });

    const line = await prisma.journalLine.findFirst({
      where: { companyId: COMPANY_ID, voucherId: voucher.id, ledgerAccountId: BANK_ID },
      select: { id: true },
    });

    if (entry.clearingDate && line) {
      await reconService.markReconciled(COMPANY_ID, FY_ID, line.id, { clearingDate: entry.clearingDate });
    }

    created.push({
      reference: entry.referenceNumber,
      voucherNumber: voucher.voucherNumber,
      lineId: line ? line.id : null,
      amount: entry.amount,
      type: entry.voucherType,
    });
  }

  console.log(JSON.stringify({ company: company.companyName, financialYear: fy.yearName, created }, null, 2));
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === 'cleanup') {
    await cleanup();
  } else {
    await create();
  }
  await prisma.$disconnect();
}

void main();