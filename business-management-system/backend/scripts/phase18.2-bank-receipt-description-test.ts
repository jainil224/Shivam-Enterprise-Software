// Phase 18.2 - Bank Receipt Description auto-population.
// Verifies the allocation driven Description contract: only genuine allocated
// bill numbers are used, the update is scoped to one receipt row, manual text is
// protected, removals clear only generated text, and a real save/reload round
// trip keeps the stored BankVoucherLine description. The pure policy module is
// imported from the frontend so these tests run the exact code the entry page
// runs. Every fixture lives inside a throwaway company removed in the finally
// block - no production data is touched.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Prisma } from '@prisma/client';
import { BankReceiptService } from '../src/services/bankReceiptService.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';
import {
  buildBillDescription,
  isGeneratedBillDescription,
  resolveDescriptionAfterAllocation,
  resolveDescriptionAfterManualEdit,
  resolveDescriptionOnLoad,
} from '../../frontend/src/utils/receiptDescription.js';

const prisma = new PrismaClient();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const receiptService = new BankReceiptService();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log(`  PASS [${total}]: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL [${total}]: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function section(title: string) {
  console.log(`\n--- ${title} ---`);
}

const TEST_COMPANY_CODE = 'P182TEST';

async function cleanupTestData() {
  const companies = await prisma.company.findMany({
    where: { companyCode: TEST_COMPANY_CODE },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;

  await prisma.bankReceiptAdjustmentLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReceiptBillAllocation.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucherLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseBillItem.deleteMany({
    where: { purchaseBill: { companyId: { in: companyIds } } },
  });
  await prisma.purchaseBill.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankReceiptBook.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankInstrumentMaster.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

interface SuiteContext {
  companyId: string;
  financialYearId: string;
  bankLedgerId: string;
  alphaId: string;
  betaId: string;
  gammaId: string;
  billA1Id: string;
  billA1Number: string;
  billA2Id: string;
  billA2Number: string;
  billA3Id: string;
  billA3Number: string;
  billA4Id: string;
  billA4Number: string;
  billA5Id: string;
  billA5Number: string;
  billB1Id: string;
  billB1Number: string;
  billG1Id: string;
  billG1Number: string;
  instrumentId: string;
  bookId: string;
}

async function buildContext(): Promise<SuiteContext> {
  const company = await prisma.company.create({
    data: {
      companyCode: TEST_COMPANY_CODE,
      companyName: 'SHIVAM ENTERPRISE PHASE 18.2 LTD',
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 18, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '9876543210',
      email: 'accounts@shivam.example',
    },
  });

  const fy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2026 - 2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });

  const bankLedger = await ledgerService.create(company.id, {
    accountCode: '1001',
    accountName: 'HDFC Bank Current A/c',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'HDFC Bank',
    branchName: 'Ring Road, Surat',
    accountHolderName: 'SHIVAM ENTERPRISE',
    ifscCode: 'HDFC0001234',
    bankAccountNumber: '50200012345678',
  });

  const makeParty = async (partyCode: string, partyName: string, address: string) => {
    const party = await prisma.party.create({
      data: {
        companyId: company.id,
        partyCode,
        partyName,
        partyType: 'CUSTOMER',
        openingBalance: new Prisma.Decimal(0),
        balanceType: 'DEBIT',
        address,
      },
    });
    await ledgerService.create(company.id, {
      accountCode: `PL-${partyCode}`,
      accountName: partyName,
      accountGroup: 'SUNDRY_DEBTORS',
      openingBalance: '0.00',
      partyId: party.id,
    });
    return party;
  };

  const alpha = await makeParty('P182ALP', 'Alpha Traders', 'Ring Road, Surat');
  const beta = await makeParty('P182BET', 'Beta Traders', 'Station Road, Surat');
  const gamma = await makeParty('P182GAM', 'Gamma Fabrics', 'Adajan, Surat');

  const makeBill = async (billNumber: string, partyId: string, totalAmount: string, billDate: string) => {
    const bill = await prisma.purchaseBill.create({
      data: {
        companyId: company.id,
        financialYearId: fy.id,
        billNumber,
        billDate: new Date(`${billDate}T00:00:00.000Z`),
        partyId,
        supplierLegalName: 'Test Supplier',
        totalAmount: new Prisma.Decimal(totalAmount),
        status: 'CONFIRMED',
      },
    });
    await prisma.purchaseBillItem.create({
      data: {
        purchaseBillId: bill.id,
        itemDescription: 'Cotton Fabric',
        quantity: new Prisma.Decimal('10.000'),
        unit: 'MTR',
        rate: new Prisma.Decimal(Number(totalAmount) / 10),
        taxableAmount: new Prisma.Decimal(totalAmount),
      },
    });
    return bill;
  };

  const billA1 = await makeBill('P182-PUR-1000', alpha.id, '1000.00', '2026-04-05');
  const billA2 = await makeBill('P182-PUR-2000', alpha.id, '2000.00', '2026-04-06');
  const billA3 = await makeBill('P182-PUR-3000', alpha.id, '3000.00', '2026-04-07');
  const billA4 = await makeBill('P182-PUR-5000', alpha.id, '5000.00', '2026-04-08');
  const billA5 = await makeBill('P182-PUR-6000', alpha.id, '6000.00', '2026-04-09');
  const billB1 = await makeBill('P182-PUR-4000', beta.id, '4000.00', '2026-04-10');
  const billG1 = await makeBill('P182-PUR-7000', gamma.id, '7000.00', '2026-04-11');

  const instrument = await receiptService.createInstrument(company.id, {
    code: 'P182HDFC',
    description: 'HDFC Bank Phase 18.2',
  });

  const book = await receiptService.createBook(company.id, fy.id, {
    prefix: 'B182',
    bookName: 'Phase 18.2 Receipt Book',
    bankAccountLedgerId: bankLedger.id,
  });

  return {
    companyId: company.id,
    financialYearId: fy.id,
    bankLedgerId: bankLedger.id,
    alphaId: alpha.id,
    betaId: beta.id,
    gammaId: gamma.id,
    billA1Id: billA1.id,
    billA1Number: billA1.billNumber,
    billA2Id: billA2.id,
    billA2Number: billA2.billNumber,
    billA3Id: billA3.id,
    billA3Number: billA3.billNumber,
    billA4Id: billA4.id,
    billA4Number: billA4.billNumber,
    billA5Id: billA5.id,
    billA5Number: billA5.billNumber,
    billB1Id: billB1.id,
    billB1Number: billB1.billNumber,
    billG1Id: billG1.id,
    billG1Number: billG1.billNumber,
    instrumentId: instrument.id,
    bookId: book.id,
  };
}

const loadReceipt = async (ctx: SuiteContext, id: string) =>
  voucherService.getById(ctx.companyId, ctx.financialYearId, 'RECEIPT', id);

function runGenerationPolicySuite() {
  section('Cases 1 / 2 / 9 - generation uses only real allocated bill numbers');

  assert(
    buildBillDescription(['P182-PUR-1000']) === 'Bill No: P182-PUR-1000',
    'One allocated bill produces "Bill No: <bill>"'
  );
  assert(
    buildBillDescription(['P182-PUR-2000', 'P182-PUR-3000']) ===
      'Bill No: P182-PUR-2000, P182-PUR-3000',
    'Two allocated bills are listed in allocation order'
  );
  assert(
    buildBillDescription(['P182-PUR-2000', 'P182-PUR-2000']) === 'Bill No: P182-PUR-2000',
    'A repeated bill number is listed once'
  );
  assert(
    buildBillDescription(['', '   ', null, undefined]) === '',
    'No bill number means no description is fabricated'
  );
  assert(
    isGeneratedBillDescription('Bill No: P182-PUR-1000') &&
      !isGeneratedBillDescription('Part payment against old dues'),
    'Generated text is recognised, manual text is not'
  );
}

function runManualProtectionSuite() {
  section('Cases 4 / 5 / 6 - generated text follows allocations, manual text is safe');

  const empty = { description: '', descriptionAuto: true };

  assert(
    resolveDescriptionAfterAllocation(empty, ['P182-PUR-1000']).description ===
      'Bill No: P182-PUR-1000',
    'An empty description is populated from the allocation'
  );

  const generated = resolveDescriptionAfterAllocation(empty, ['P182-PUR-1000']);
  const reallocated = resolveDescriptionAfterAllocation(generated, ['P182-PUR-5000']);
  assert(
    reallocated.description === 'Bill No: P182-PUR-5000' &&
      reallocated.descriptionAuto === true,
    'Reallocating bills replaces the generated description'
  );

  const cleared = resolveDescriptionAfterAllocation(generated, []);
  assert(
    cleared.description === '' && cleared.descriptionAuto === true,
    'Removing every allocation clears the generated description'
  );

  const manual = { description: 'Part payment against old dues', descriptionAuto: false };
  assert(
    resolveDescriptionAfterAllocation(manual, ['P182-PUR-1000']).description ===
      'Part payment against old dues',
    'A manually entered description is never overwritten by an allocation'
  );
  assert(
    resolveDescriptionAfterAllocation(manual, []).description ===
      'Part payment against old dues',
    'Removing allocations preserves a manually entered description'
  );

  assert(
    resolveDescriptionAfterManualEdit('').descriptionAuto === true &&
      resolveDescriptionAfterManualEdit('Cheque deposit').descriptionAuto === false,
    'Typing takes ownership of the cell, clearing it hands control back'
  );

  assert(
    resolveDescriptionOnLoad('Bill No: P182-PUR-1000', true).descriptionAuto === true &&
      resolveDescriptionOnLoad('Part payment', true).descriptionAuto === false &&
      resolveDescriptionOnLoad(null, false).descriptionAuto === true,
    'A reopened voucher keeps generated text live and manual text protected'
  );
}

async function runServiceRoundTripSuite(ctx: SuiteContext) {
  section('Cases 1 / 7 - one allocated bill saves and reopens with its description');

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.alphaId,
    receiptAmount: 1000,
    allocations: [{ purchaseBillId: ctx.billA1Id, allocatedAmount: '1000.00' }],
  });
  const generated = buildBillDescription(validation.allocations.map((row) => row.billNumber));
  assert(
    generated === `Bill No: ${ctx.billA1Number}`,
    'The popup validation result supplies the real bill number for the description'
  );

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-20',
    narration: 'Phase 18.2 single bill description',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400001',
        description: generated,
        amount: '1000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: validation.allocations.map((row) => ({
          purchaseBillId: row.purchaseBillId,
          allocatedAmount: row.allocatedAmount,
        })),
      },
    ],
  });

  const reopened = await loadReceipt(ctx, created.id);
  const line = reopened.receiptLines?.[0];
  assert(
    line?.description === generated,
    `The description is stored on the BankVoucherLine and reopens unchanged (${line?.description ?? 'null'})`
  );
  assert(
    line?.allocations?.[0]?.sourceDocumentNumber === ctx.billA1Number,
    'The stored allocation keeps the bill number the description was built from'
  );
}

async function runMultipleBillSuite(ctx: SuiteContext) {
  section('Case 2 - multiple allocated bills populate every real bill number');

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.alphaId,
    receiptAmount: 5000,
    allocations: [
      { purchaseBillId: ctx.billA2Id, allocatedAmount: '2000.00' },
      { purchaseBillId: ctx.billA3Id, allocatedAmount: '3000.00' },
    ],
  });
  const generated = buildBillDescription(validation.allocations.map((row) => row.billNumber));
  assert(
    generated.includes(ctx.billA2Number) && generated.includes(ctx.billA3Number),
    'Both allocated bills appear in the generated description'
  );

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-21',
    narration: 'Phase 18.2 multiple bill description',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400002',
        description: generated,
        amount: '5000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: validation.allocations.map((row) => ({
          purchaseBillId: row.purchaseBillId,
          allocatedAmount: row.allocatedAmount,
        })),
      },
    ],
  });

  const reopened = await loadReceipt(ctx, created.id);
  assert(
    reopened.receiptLines?.[0]?.description === generated,
    'The multi-bill description survives save and reopen'
  );
  assert(
    (reopened.receiptLines?.[0]?.allocations ?? []).length === 2,
    'Both allocations are stored against the same receipt row'
  );
}

async function runRowScopeSuite(ctx: SuiteContext) {
  section('Case 3 - the description only ever applies to its own receipt row');

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-22',
    narration: 'Phase 18.2 two independent rows',
    lines: [
      {
        partyId: ctx.betaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400003',
        description: `Bill No: ${ctx.billB1Number}`,
        amount: '4000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billB1Id, allocatedAmount: '4000.00' }],
      },
      {
        partyId: ctx.gammaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400004',
        description: `Bill No: ${ctx.billG1Number}`,
        amount: '7000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billG1Id, allocatedAmount: '7000.00' }],
      },
    ],
  });

  const reopened = await loadReceipt(ctx, created.id);
  const rows = reopened.receiptLines ?? [];
  assert(rows.length === 2, 'Both receipt rows are stored');

  const betaRow = rows.find((row) => row.party?.id === ctx.betaId);
  const gammaRow = rows.find((row) => row.party?.id === ctx.gammaId);
  assert(
    betaRow?.description === `Bill No: ${ctx.billB1Number}`,
    'Row 1 keeps its own bill number'
  );
  assert(
    gammaRow?.description === `Bill No: ${ctx.billG1Number}`,
    'Row 2 keeps its own bill number'
  );
  assert(
    betaRow?.description !== gammaRow?.description,
    'Updating one row never rewrites the other row'
  );
}

async function runReallocationSuite(ctx: SuiteContext) {
  section('Cases 4 / 5 - reallocating regenerates, removing clears, both persist');

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-23',
    narration: 'Phase 18.2 reallocation',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400005',
        description: `Bill No: ${ctx.billA4Number}`,
        amount: '5000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billA4Id, allocatedAmount: '5000.00' }],
      },
    ],
  });

  const before = await loadReceipt(ctx, created.id);
  assert(
    before.receiptLines?.[0]?.description === `Bill No: ${ctx.billA4Number}`,
    'The first allocation writes its bill number'
  );

  const regenerated = buildBillDescription([ctx.billA5Number]);
  await receiptService.update(ctx.companyId, ctx.financialYearId, created.id, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-23',
    narration: 'Phase 18.2 reallocation - different bill',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400005',
        description: regenerated,
        amount: '6000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billA5Id, allocatedAmount: '6000.00' }],
      },
    ],
  });

  const reallocated = await loadReceipt(ctx, created.id);
  assert(
    reallocated.receiptLines?.[0]?.description === `Bill No: ${ctx.billA5Number}`,
    'Reallocating replaces the generated description with the new bill number'
  );

  await receiptService.update(ctx.companyId, ctx.financialYearId, created.id, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-23',
    narration: 'Phase 18.2 allocations removed',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400005',
        description: null,
        amount: '6000.00',
        adjustmentMode: 'NO_ADJUSTMENT',
        allocations: [],
      },
    ],
  });

  const removed = await loadReceipt(ctx, created.id);
  assert(
    (removed.receiptLines?.[0]?.description ?? null) === null,
    'Removing every allocation clears the generated description'
  );
  assert(
    (removed.receiptLines?.[0]?.allocations ?? []).length === 0,
    'No allocation is left behind after the removal'
  );
}

async function runManualDescriptionSuite(ctx: SuiteContext) {
  section('Case 6 - a manually entered description survives allocation and reload');

  const manual = 'Part payment against old dues';
  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-24',
    narration: 'Phase 18.2 manual description',
    lines: [
      {
        partyId: ctx.alphaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400006',
        description: manual,
        amount: '6000.00',
        adjustmentMode: 'AGAINST_BILL',
        allocations: [{ purchaseBillId: ctx.billA5Id, allocatedAmount: '6000.00' }],
      },
    ],
  });

  const reopened = await loadReceipt(ctx, created.id);
  assert(
    reopened.receiptLines?.[0]?.description === manual,
    'Manual text is stored as typed, not replaced by the bill number'
  );
  assert(
    reopened.receiptLines?.[0]?.allocations?.length === 1,
    'The manual description does not disturb the allocation'
  );
}

async function runUnallocatedExclusionSuite(ctx: SuiteContext) {
  section('Case 8 - bills that were only displayed are excluded');

  const outstanding = await receiptService.outstandingBills(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.alphaId,
  });
  const visible = outstanding.bills.map((bill) => bill.billNumber);
  assert(
    visible.includes(ctx.billA4Number) && visible.includes(ctx.billA5Number),
    'Both Alpha bills are visible in the outstanding popup'
  );

  const validation = await receiptService.validateAllocation(ctx.companyId, ctx.financialYearId, {
    partyId: ctx.alphaId,
    receiptAmount: 5000,
    allocations: [{ purchaseBillId: ctx.billA4Id, allocatedAmount: '5000.00' }],
  });
  const generated = buildBillDescription(validation.allocations.map((row) => row.billNumber));
  assert(
    generated === `Bill No: ${ctx.billA4Number}`,
    'Only the bill that received a positive allocation is described'
  );
  assert(
    !generated.includes(ctx.billA5Number),
    'A displayed but unallocated bill never appears in the description'
  );
}

async function runNoBillNumberSuite(ctx: SuiteContext) {
  section('Case 9 - a row without a bill number gets no invented description');

  const created = await receiptService.create(ctx.companyId, ctx.financialYearId, {
    bookId: ctx.bookId,
    voucherDate: '2026-05-25',
    narration: 'Phase 18.2 on account row',
    lines: [
      {
        partyId: ctx.betaId,
        bankInstrumentId: ctx.instrumentId,
        chequeNumber: '400007',
        description: null,
        amount: '500.00',
        adjustmentMode: 'NO_ADJUSTMENT',
        allocations: [],
      },
    ],
  });

  const reopened = await loadReceipt(ctx, created.id);
  assert(
    (reopened.receiptLines?.[0]?.description ?? null) === null,
    'A row with no allocation keeps an empty description'
  );
  assert(
    buildBillDescription([]) === '',
    'The generator returns nothing when there is no bill number'
  );
}

function runSourceContractSuite() {
  section('UI source contract - row keyed generation, manual protection, payload shape');

  const dialog = readFileSync(
    path.join(repoRoot, 'frontend/src/components/receipt/OutstandingAdjustmentDialog.tsx'),
    'utf8'
  );
  assert(
    dialog.includes('billNumber: row.billNumber'),
    'The popup hands the real bill number back with the applied allocation'
  );
  assert(
    dialog.includes('export interface OutstandingAppliedAllocation'),
    'The apply result type carries the bill number'
  );

  const entry = readFileSync(
    path.join(repoRoot, 'frontend/src/pages/ChequeReceiptEntryPage.tsx'),
    'utf8'
  );
  assert(
    entry.includes('resolveDescriptionAfterAllocation(') &&
      entry.includes('resolveDescriptionAfterManualEdit(') &&
      entry.includes('resolveDescriptionOnLoad('),
    'The entry grid delegates every description decision to the shared policy'
  );
  assert(
    entry.includes('result.allocations.map((allocation) => allocation.billNumber)'),
    'The generated text is built from the applied allocations only'
  );
  assert(
    entry.includes('updateRowByKey(target.key'),
    'Apply Allocation updates the row through its stable key, never the active row'
  );
  assert(
    entry.includes('descriptionAuto'),
    'Each row tracks whether its description is generated or manual'
  );
  assert(
    entry.includes('billNumber: allocation.sourceDocumentNumber'),
    'A reopened voucher recovers bill numbers from the stored allocation'
  );
  assert(
    entry.includes('resolveDescriptionOnLoad(line.description, activeAllocations.length > 0)'),
    'A reopened voucher restores the generated/manual state per row'
  );
  assert(
    !entry.includes('Bill No: PB-OT-'),
    'No example bill number is hardcoded in the entry page'
  );

  const payloadStart = entry.indexOf('const payload: ChequeReceiptPayload');
  const payloadEnd = entry.indexOf('savingRef.current = true');
  assert(
    payloadStart > 0 && payloadEnd > payloadStart,
    'The save payload block is present'
  );
  const payloadBlock = entry.slice(payloadStart, payloadEnd);
  assert(
    !payloadBlock.includes('billNumber'),
    'The save request keeps its existing allocation shape'
  );
  assert(
    payloadBlock.includes('description: row.description.trim()'),
    'The generated description is part of the save request'
  );
}

async function main() {
  console.log('Phase 18.2 - Bank Receipt Description auto-population');
  await cleanupTestData();

  runGenerationPolicySuite();
  runManualProtectionSuite();
  runSourceContractSuite();

  const ctx = await buildContext();
  try {
    await runServiceRoundTripSuite(ctx);
    await runMultipleBillSuite(ctx);
    await runRowScopeSuite(ctx);
    await runReallocationSuite(ctx);
    await runUnallocatedExclusionSuite(ctx);
    await runManualDescriptionSuite(ctx);
    await runNoBillNumberSuite(ctx);
  } finally {
    await cleanupTestData();
    await prisma.$disconnect();
  }

  console.log(`\nPhase 18.2 result: ${passed}/${total} assertions passed.`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('\nPhase 18.2 suite failed:', error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});