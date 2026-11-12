// Phase 18 - temporary live-scope DEMO data for the Bank Receipt Entry module.
//
// This script ONLY ever creates rows tagged "P18 TEMP" / "P18-TEMP" / "P18/BILL/"
// and posts them against its own test bank ledger. It never touches a real bank
// ledger, a real party or a real purchase bill.
//
//   create  : npx tsx scripts/p18-live-temp-data.ts
//   cleanup : npx tsx scripts/p18-live-temp-data.ts cleanup
//   status  : npx tsx scripts/p18-live-temp-data.ts status
//
// Safety guards:
//   * the receipt book must be linked to the P18 TEMP bank ledger (never HDFC),
//   * every party code starts with P18-TEMP,
//   * every purchase bill number starts with P18/BILL/,
//   * cleanup deletes only rows that carry those tags.

import { PrismaClient, Prisma } from '@prisma/client';
import { BankReceiptService } from '../src/services/bankReceiptService.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';

const prisma = new PrismaClient();
const receiptService = new BankReceiptService();
const voucherService = new BankVoucherService();

const COMPANY_ID = '902a42ff-ee15-4437-af80-d649a06faabd';
const FY_ID = '0ad77610-eefc-44a3-8a5f-a3a7b61f14f5';

const BOOK_NAME = 'P18 TEMP Cheque Receipt Book';
const PREFIX = 'P18';
const BOOK_LEDGER_CODE = 'P18-TEMP-BANK';
const PARTY_CODES = ['P18-TEMP-ALPHA', 'P18-TEMP-BETA'];
const BILL_PREFIX = 'P18/BILL/';
const INSTRUMENT_CODES = ['P18HDFC', 'P18ICICI'];
const ADJUSTMENT_ACCOUNT_CODE = 'OT-INT-SALE';

const assertTemp = (value: string, label: string): void => {
  if (!value.startsWith('P18-TEMP')) {
    throw new Error(`Refusing to use non-demo ${label}: ${value}`);
  }
};

const trailingNumber = (value: string): number => {
  const match = /(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
};

async function syncReceiptSequence(): Promise<number> {
  const existing = await prisma.bankVoucher.findMany({
    where: { companyId: COMPANY_ID, financialYearId: FY_ID, voucherType: 'RECEIPT' },
    select: { voucherNumber: true },
  });
  const highest = existing.reduce((max, row) => Math.max(max, trailingNumber(row.voucherNumber)), 0);
  await prisma.$executeRaw`
    INSERT INTO "voucher_sequences"
      ("id", "company_id", "financial_year_id", "voucher_type", "last_number", "updated_at")
    VALUES
      (gen_random_uuid()::text, ${COMPANY_ID}, ${FY_ID}, 'RECEIPT'::"BankVoucherType", ${highest}, NOW())
    ON CONFLICT ("company_id", "financial_year_id", "voucher_type")
    DO UPDATE SET "last_number" = GREATEST("voucher_sequences"."last_number", ${highest}), "updated_at" = NOW()
  `;
  return highest;
}

async function cleanup(): Promise<void> {
  const books = await prisma.bankReceiptBook.findMany({
    where: { companyId: COMPANY_ID, bookName: BOOK_NAME },
    select: { id: true },
  });
  const bookIds = books.map((row) => row.id);

  const vouchers = await prisma.bankVoucher.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [{ bankReceiptBookId: { in: bookIds } }, { narration: { contains: 'P18 TEMP' } }],
    },
    select: { id: true },
  });
  const voucherIds = vouchers.map((row) => row.id);

  const lines = voucherIds.length
    ? await prisma.bankVoucherLine.findMany({
        where: { companyId: COMPANY_ID, bankVoucherId: { in: voucherIds } },
        select: { id: true },
      })
    : [];
  const lineIds = lines.map((row) => row.id);

  if (lineIds.length > 0) {
    await prisma.bankReceiptAdjustmentLine.deleteMany({
      where: { companyId: COMPANY_ID, bankVoucherLineId: { in: lineIds } },
    });
    await prisma.bankReceiptBillAllocation.deleteMany({
      where: { companyId: COMPANY_ID, bankVoucherLineId: { in: lineIds } },
    });
    await prisma.bankVoucherLine.deleteMany({ where: { id: { in: lineIds } } });
  }
  if (voucherIds.length > 0) {
    await prisma.journalLine.deleteMany({
      where: { companyId: COMPANY_ID, voucherId: { in: voucherIds } },
    });
    await prisma.bankVoucher.deleteMany({ where: { id: { in: voucherIds } } });
  }
  if (bookIds.length > 0) {
    await prisma.bankReceiptBook.deleteMany({ where: { id: { in: bookIds } } });
  }

  await prisma.bankInstrumentMaster.deleteMany({
    where: { companyId: COMPANY_ID, code: { in: INSTRUMENT_CODES } },
  });

  const bills = await prisma.purchaseBill.findMany({
    where: { companyId: COMPANY_ID, billNumber: { startsWith: BILL_PREFIX } },
    select: { id: true },
  });
  if (bills.length > 0) {
    await prisma.purchaseBillItem.deleteMany({
      where: { purchaseBillId: { in: bills.map((row) => row.id) } },
    });
    await prisma.purchaseBill.deleteMany({ where: { id: { in: bills.map((row) => row.id) } } });
  }

  const parties = await prisma.party.findMany({
    where: { companyId: COMPANY_ID, partyCode: { startsWith: 'P18-TEMP' } },
    select: { id: true, partyCode: true },
  });
  for (const party of parties) {
    assertTemp(party.partyCode, 'party');
    await prisma.ledgerAccount.deleteMany({
      where: { companyId: COMPANY_ID, partyId: party.id, accountCode: { startsWith: 'P18-TEMP' } },
    });
    const remainingLedgers = await prisma.ledgerAccount.count({
      where: { companyId: COMPANY_ID, partyId: party.id },
    });
    if (remainingLedgers === 0) {
      await prisma.party.delete({ where: { id: party.id } });
    }
  }

  // Auto-created party ledgers may use a generated code; remove any ledger whose
  // party is a demo party, then the demo bank ledger.
  for (const party of parties) {
    const used = await prisma.journalLine.count({
      where: { companyId: COMPANY_ID, ledgerAccount: { partyId: party.id } },
    });
    if (used === 0) {
      await prisma.ledgerAccount.deleteMany({ where: { companyId: COMPANY_ID, partyId: party.id } });
    }
  }

  const demoBank = await prisma.ledgerAccount.findFirst({
    where: { companyId: COMPANY_ID, accountCode: BOOK_LEDGER_CODE },
    select: { id: true },
  });
  if (demoBank) {
    const used = await prisma.journalLine.count({
      where: { companyId: COMPANY_ID, ledgerAccountId: demoBank.id },
    });
    if (used > 0) throw new Error('Refusing to delete the demo bank ledger: journal lines still reference it.');
    await prisma.ledgerAccount.delete({ where: { id: demoBank.id } });
  }

  const sequence = await syncReceiptSequence();
  console.log(
    `cleanup done: vouchers=${voucherIds.length} lines=${lineIds.length} books=${bookIds.length} bills=${bills.length} parties=${parties.length} sequence=${sequence}`
  );
}

async function create(): Promise<void> {
  await cleanup();

  const fy = await prisma.financialYear.findUnique({
    where: { id: FY_ID },
    select: { yearName: true, isLocked: true },
  });
  if (!fy) throw new Error('Live financial year not found.');
  if (fy.isLocked) throw new Error(`Financial year ${fy.yearName} is locked; demo data cannot be posted.`);

  // Dedicated demo bank ledger: the real HDFC ledger is never touched.
  const bankLedger = await prisma.ledgerAccount.upsert({
    where: { companyId_accountCode: { companyId: COMPANY_ID, accountCode: BOOK_LEDGER_CODE } },
    update: { isActive: true },
    create: {
      companyId: COMPANY_ID,
      accountCode: BOOK_LEDGER_CODE,
      accountName: 'P18 TEMP Bank A/c (demo)',
      accountGroup: 'BANK',
      accountType: 'ASSET',
      balanceType: 'DEBIT',
      openingBalance: 0,
      isBankAccount: true,
      bankName: 'P18 Test Bank',
      branchName: 'Demo Branch',
      accountHolderName: 'SHIVAM ENTERPRISE (demo)',
      bankAccountNumber: '999900001111',
      ifscCode: 'P18T0000001',
      description: 'Temporary demo ledger for the Phase 18 cheque receipt walkthrough.',
    },
    select: { id: true, accountCode: true, accountName: true },
  });

  const partyRows = await Promise.all(
    [
      {
        code: PARTY_CODES[0],
        name: 'P18 TEMP Alpha Traders (demo)',
        address: '12 Marine Drive, Fort',
        city: 'Mumbai',
        state: 'Maharashtra',
        phone: '9820011223',
      },
      {
        code: PARTY_CODES[1],
        name: 'P18 TEMP Beta Textiles (demo)',
        address: '150 Kalawad Road',
        city: 'Rajkot',
        state: 'Gujarat',
        phone: '9820033445',
      },
    ].map((party) =>
      prisma.party.upsert({
        where: { companyId_partyCode: { companyId: COMPANY_ID, partyCode: party.code } },
        update: {
          isActive: true,
          address: party.address,
          city: party.city,
          state: party.state,
          phone: party.phone,
        },
        create: {
          companyId: COMPANY_ID,
          partyCode: party.code,
          partyName: party.name,
          partyType: 'CUSTOMER',
          openingBalance: 0,
          balanceType: 'DEBIT',
          address: party.address,
          city: party.city,
          state: party.state,
          phone: party.phone,
        },
        select: { id: true, partyCode: true, partyName: true },
      })
    )
  );

  const [alpha, beta] = partyRows;

  const billSpecs = [
    { partyId: alpha.id, number: `${BILL_PREFIX}001`, date: '2026-04-05', amount: '10000.00', items: [] },
    { partyId: alpha.id, number: `${BILL_PREFIX}002`, date: '2026-04-20', amount: '15000.00', items: [] },
    { partyId: beta.id, number: `${BILL_PREFIX}003`, date: '2026-05-02', amount: '9000.00', items: [] },
    {
      partyId: alpha.id,
      number: `${BILL_PREFIX}004`,
      date: '2026-04-22',
      amount: '18703.00',
      items: [
        { itemDescription: 'Cotton Saree', quantity: '10.000', unit: 'PCS', rate: '1200.00' },
        { itemDescription: 'Silk Dupatta', quantity: '5.000', unit: 'PCS', rate: '800.00' },
      ],
    },
    {
      partyId: alpha.id,
      number: `${BILL_PREFIX}005`,
      date: '2026-04-23',
      amount: '17700.00',
      items: [
        { itemDescription: 'Cotton Fabric', quantity: '20.000', unit: 'MTR', rate: '600.00' },
      ],
    },
  ];
  const bills: Array<{ id: string; billNumber: string; totalAmount: string }> = [];
  for (const spec of billSpecs) {
    const bill = await prisma.purchaseBill.upsert({
      where: {
        companyId_financialYearId_billNumber: {
          companyId: COMPANY_ID,
          financialYearId: FY_ID,
          billNumber: spec.number,
        },
      },
      update: { status: 'CONFIRMED', totalAmount: spec.amount },
      create: {
        companyId: COMPANY_ID,
        financialYearId: FY_ID,
        billNumber: spec.number,
        billDate: new Date(`${spec.date}T00:00:00.000Z`),
        partyId: spec.partyId,
        supplierLegalName: 'P18 TEMP Supplier (demo)',
        supplierTradeName: 'P18 TEMP Supplier',
        supplierCity: 'Surat',
        supplierState: 'Gujarat',
        supplierStateCode: '24',
        placeOfSupply: '24',
        taxableAmount: spec.amount,
        totalAmount: spec.amount,
        status: 'CONFIRMED',
        remarks: 'P18 TEMP purchase bill (demo data, safe to delete)',
      },
      select: { id: true, billNumber: true, totalAmount: true },
    });
    bills.push({ id: bill.id, billNumber: bill.billNumber, totalAmount: String(bill.totalAmount) });

    if (spec.items.length > 0) {
      await prisma.purchaseBillItem.deleteMany({ where: { purchaseBillId: bill.id } });
      for (const item of spec.items) {
        await prisma.purchaseBillItem.create({
          data: {
            purchaseBillId: bill.id,
            itemDescription: item.itemDescription,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            rate: new Prisma.Decimal(item.rate),
            taxableAmount: new Prisma.Decimal(
              (Number(item.quantity) * Number(item.rate)).toFixed(2)
            ),
          },
        });
      }
    }
  }

  const book = await receiptService.createBook(COMPANY_ID, FY_ID, {
    prefix: PREFIX,
    bookName: BOOK_NAME,
    bankAccountLedgerId: bankLedger.id,
  });
  if (book.bankAccount.id !== bankLedger.id) {
    throw new Error('Receipt book was linked to an unexpected ledger; aborting.');
  }

  const hdfc = await receiptService.createInstrument(COMPANY_ID, {
    code: INSTRUMENT_CODES[0],
    description: 'P18 Test Bank - HDFC style (demo)',
  });
  const icici = await receiptService.createInstrument(COMPANY_ID, {
    code: INSTRUMENT_CODES[1],
    description: 'P18 Test Bank - ICICI style (demo)',
  });

  const adjustmentAccount = await prisma.ledgerAccount.findFirst({
    where: { companyId: COMPANY_ID, accountCode: ADJUSTMENT_ACCOUNT_CODE },
    select: { id: true, accountName: true },
  });
  if (!adjustmentAccount) throw new Error(`Adjustment account ${ADJUSTMENT_ACCOUNT_CODE} not found.`);

  // Voucher 1: two rows, one Against Bill with allocation + interest adjustment.
  const voucher1 = await receiptService.create(COMPANY_ID, FY_ID, {
    bookId: book.id,
    voucherDate: '2026-06-10',
    narration: 'P18 TEMP multi-party cheque receipt (demo data, safe to delete)',
    lines: [
      {
        partyId: alpha.id,
        bankInstrumentId: hdfc.id,
        chequeNumber: 'P18-100001',
        description: 'P18 TEMP Alpha - bill 001 + interest',
        amount: '12000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: bills[0].id, allocatedAmount: '10000.00' }],
        adjustments: [
          {
            purchaseBillId: bills[0].id,
            adjustmentLedgerAccountId: adjustmentAccount.id,
            calculationType: 'AMT',
            adjustmentAmount: '2000.00',
            drCr: 'CR',
            note: 'P18 TEMP interest on delayed payment',
          },
        ],
      },
      {
        partyId: beta.id,
        bankInstrumentId: icici.id,
        chequeNumber: 'P18-100002',
        description: 'P18 TEMP Beta - on account',
        amount: '8000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
    ],
  });

  // Voucher 2: Against Bill, then edited once so revision history is visible.
  const voucher2 = await receiptService.create(COMPANY_ID, FY_ID, {
    bookId: book.id,
    voucherDate: '2026-06-12',
    narration: 'P18 TEMP single-row against bill (demo data, safe to delete)',
    lines: [
      {
        partyId: alpha.id,
        bankInstrumentId: hdfc.id,
        chequeNumber: 'P18-100003',
        description: 'P18 TEMP Alpha - bill 002',
        amount: '5000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: bills[1].id, allocatedAmount: '5000.00' }],
      },
    ],
  });
  await receiptService.update(COMPANY_ID, FY_ID, voucher2.id, {
    bookId: book.id,
    voucherDate: '2026-06-12',
    narration: 'P18 TEMP single-row against bill - edited to 6,000 (demo data, safe to delete)',
    lines: [
      {
        partyId: alpha.id,
        bankInstrumentId: hdfc.id,
        chequeNumber: 'P18-100003',
        description: 'P18 TEMP Alpha - bill 002 (edited)',
        amount: '6000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: bills[1].id, allocatedAmount: '6000.00' }],
      },
    ],
  });

  // Voucher 3: Skip in O/S (party ledger only, no bill allocation).
  const voucher3 = await receiptService.create(COMPANY_ID, FY_ID, {
    bookId: book.id,
    voucherDate: '2026-06-15',
    narration: 'P18 TEMP skip-in-outstanding receipt (demo data, safe to delete)',
    lines: [
      {
        partyId: beta.id,
        bankInstrumentId: icici.id,
        chequeNumber: 'P18-100004',
        description: 'P18 TEMP Beta - advance, skip in O/S',
        amount: '3000.00',
        adjustmentMode: 'SKIP_IN_OS',
      },
    ],
  });

  // Voucher 4: cancelled, so the register shows a cancelled receipt with reason.
  const voucher4 = await receiptService.create(COMPANY_ID, FY_ID, {
    bookId: book.id,
    voucherDate: '2026-06-18',
    narration: 'P18 TEMP cheque returned unpaid (demo data, safe to delete)',
    lines: [
      {
        partyId: beta.id,
        bankInstrumentId: hdfc.id,
        chequeNumber: 'P18-100005',
        description: 'P18 TEMP Beta - cheque that bounced',
        amount: '1500.00',
        adjustmentMode: 'NO_ADJUSTMENT',
      },
    ],
  });
  await voucherService.cancel(COMPANY_ID, FY_ID, 'RECEIPT', voucher4.id, 'P18 TEMP demo - cheque returned unpaid');

  // Historical receipt that over-pays bill 005 by 24.00. It carries no journal
  // lines, so the demo bank balance stays untouched while the popup can show a
  // genuine negative bill balance (-24.00) instead of clamping it to zero.
  const alphaLedger = await prisma.ledgerAccount.findFirst({
    where: { companyId: COMPANY_ID, partyId: alpha.id },
    select: { id: true },
  });
  if (!alphaLedger) throw new Error('Alpha party ledger missing; cannot create the negative-balance fixture.');

  const historical = await prisma.bankVoucher.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      voucherType: 'RECEIPT',
      voucherNumber: 'P18-HIST-0001',
      voucherDate: new Date('2026-04-24T00:00:00.000Z'),
      partyId: alpha.id,
      counterpartyLedgerId: alphaLedger.id,
      bankAccountLedgerId: bankLedger.id,
      bankReceiptBookId: book.id,
      paymentMode: 'CHEQUE',
      amount: new Prisma.Decimal('17724.00'),
      narration: 'P18 TEMP historical over-receipt (demo data, safe to delete)',
      status: 'POSTED',
      revision: 1,
    },
    select: { id: true },
  });

  const historicalLine = await prisma.bankVoucherLine.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      bankVoucherId: historical.id,
      rowNumber: 1,
      revision: 1,
      partyId: alpha.id,
      partyLedgerAccountId: alphaLedger.id,
      amount: new Prisma.Decimal('17724.00'),
      adjustmentMode: 'AGAINST_BILL',
      description: 'P18 TEMP historical over-receipt (demo data, safe to delete)',
    },
    select: { id: true },
  });

  await prisma.bankReceiptBillAllocation.create({
    data: {
      companyId: COMPANY_ID,
      financialYearId: FY_ID,
      bankVoucherLineId: historicalLine.id,
      purchaseBillId: bills[4].id,
      sourceDocumentType: 'PURCHASE_BILL',
      sourceDocumentNumber: bills[4].billNumber,
      billDate: new Date('2026-04-23T00:00:00.000Z'),
      billAmount: new Prisma.Decimal('17700.00'),
      billTds: new Prisma.Decimal('0.00'),
      previousReceived: new Prisma.Decimal('0.00'),
      allocatedAmount: new Prisma.Decimal('17724.00'),
      balanceAfter: new Prisma.Decimal('-24.00'),
      status: 'ACTIVE',
      revision: 1,
    },
  });

  const numbers = [];
  for (const id of [voucher1.id, voucher2.id, voucher3.id, voucher4.id]) {
    const view = await voucherService.getById(COMPANY_ID, FY_ID, 'RECEIPT', id);
    numbers.push({
      id: view.id,
      voucherNumber: view.voucherNumber,
      status: view.status,
      rows: view.receiptRowCount,
      amount: view.amount,
    });
  }

  const bookView = await receiptService.getBook(COMPANY_ID, FY_ID, book.id);
  console.log(
    JSON.stringify(
      {
        company: COMPANY_ID,
        financialYear: fy.yearName,
        demoBankLedger: bankLedger.accountName,
        book: { id: book.id, name: book.bookName, balance: bookView.balance },
        parties: partyRows.map((row) => ({ id: row.id, code: row.partyCode, name: row.partyName })),
        bills,
        vouchers: numbers,
        cleanup: 'npx tsx scripts/p18-live-temp-data.ts cleanup',
      },
      null,
      2
    )
  );
}

async function status(): Promise<void> {
  const demoVouchers = await prisma.bankVoucher.findMany({
    where: { companyId: COMPANY_ID, narration: { contains: 'P18 TEMP' } },
    select: { id: true, voucherNumber: true, status: true },
    orderBy: { voucherNumber: 'asc' },
  });
  const voucherIds = demoVouchers.map((row) => row.id);
  const [books, instruments, lines, allocations, adjustments, bills, parties, demoBank] =
    await Promise.all([
      prisma.bankReceiptBook.count({ where: { companyId: COMPANY_ID, bookName: BOOK_NAME } }),
      prisma.bankInstrumentMaster.count({ where: { companyId: COMPANY_ID, code: { in: INSTRUMENT_CODES } } }),
      voucherIds.length
        ? prisma.bankVoucherLine.count({ where: { companyId: COMPANY_ID, bankVoucherId: { in: voucherIds } } })
        : 0,
      voucherIds.length
        ? prisma.bankReceiptBillAllocation.count({
            where: { companyId: COMPANY_ID, bankVoucherLine: { bankVoucherId: { in: voucherIds } } },
          })
        : 0,
      voucherIds.length
        ? prisma.bankReceiptAdjustmentLine.count({
            where: { companyId: COMPANY_ID, bankVoucherLine: { bankVoucherId: { in: voucherIds } } },
          })
        : 0,
      prisma.purchaseBill.count({ where: { companyId: COMPANY_ID, billNumber: { startsWith: BILL_PREFIX } } }),
      prisma.party.count({ where: { companyId: COMPANY_ID, partyCode: { startsWith: 'P18-TEMP' } } }),
      prisma.ledgerAccount.count({ where: { companyId: COMPANY_ID, accountCode: BOOK_LEDGER_CODE } }),
    ]);
  console.log(
    JSON.stringify(
      {
        books,
        instruments,
        demoBankLedger: demoBank,
        parties,
        bills,
        vouchers: demoVouchers,
        voucherLines: lines,
        allocations,
        adjustments,
      },
      null,
      2
    )
  );
}
async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'create';
  if (mode === 'cleanup') await cleanup();
  else if (mode === 'status') await status();
  else await create();
  await prisma.$disconnect();
}

void main();