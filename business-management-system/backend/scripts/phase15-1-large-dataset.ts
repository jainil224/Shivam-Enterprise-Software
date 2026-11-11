// Phase 15.1 - large dataset verification (100 / 1000 / 5000 purchase bills).
// Each size uses its own isolated company fixture that is removed afterwards.
import { Prisma, PrismaClient } from '@prisma/client';
import { reportService } from '../src/services/reportService.js';
import type { ReportRunRequest } from '../src/types/reportTypes.js';

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string): void {
  total++;
  if (condition) {
    console.log(`  PASS [${total}]: ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL [${total}]: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

interface Timing {
  size: number;
  optionsMs: number;
  runPageMs: number;
  filteredRunMs: number;
  groupedRunMs: number;
  fullLoadMs: number;
  pdfMs: number;
  xlsxMs: number;
  pdfPages: number;
  heapDeltaMb: number;
}

const SIZES = [100, 1000, 5000];

function companyCode(size: number): string {
  return 'P151PERF' + size;
}

async function cleanup(size: number): Promise<void> {
  const company = await prisma.company.findFirst({ where: { companyCode: companyCode(size) } });
  if (!company) return;
  await prisma.journalLine.deleteMany({ where: { companyId: company.id } });
  await prisma.debitNote.deleteMany({ where: { companyId: company.id } });
  await prisma.purchaseBill.deleteMany({ where: { companyId: company.id } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: company.id } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: company.id } });
  await prisma.party.deleteMany({ where: { companyId: company.id } });
  await prisma.item.deleteMany({ where: { companyId: company.id } });
  await prisma.financialYear.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: company.id } });
}

interface PerfFixture {
  companyId: string;
  financialYearId: string;
  expectedTotal: number;
}

async function buildFixture(size: number): Promise<PerfFixture> {
  const company = await prisma.company.create({
    data: {
      companyCode: companyCode(size),
      companyName: 'PERF ' + size + ' TEXTILES LTD',
      gstin: '24AABCP' + String(size).padStart(4, '0') + 'F1Z5',
      panNumber: 'AABCP' + String(size).padStart(4, '0') + 'F',
      address: 'Performance Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
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

  const party = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'PERF' + size,
      partyName: 'Perf Party ' + size,
      partyType: 'SUPPLIER',
      gstin: '24AAACP' + String(size).padStart(4, '0') + 'C1Z1',
      address: 'Performance Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  const bills: Prisma.PurchaseBillCreateManyInput[] = [];
  const items: Prisma.PurchaseBillItemCreateManyInput[] = [];
  let expectedTotal = 0;

  for (let index = 0; index < size; index += 1) {
    const amount = 1000 + index;
    expectedTotal += amount;
    const billId = '00000000-0000-4000-8000-' + String(size).padStart(4, '0') + String(index).padStart(8, '0');
    const dayOffset = index % 365;
    const billDate = new Date(Date.UTC(2026, 3, 1) + dayOffset * 24 * 60 * 60 * 1000);
    bills.push({
      id: billId,
      companyId: company.id,
      financialYearId: fy.id,
      billNumber: 'PERF-' + size + '-' + String(index).padStart(5, '0'),
      billDate,
      partyId: party.id,
      supplierLegalName: party.partyName,
      supplierInvoiceNumber: 'PERF-INV-' + size + '-' + index,
      totalQuantity: new Prisma.Decimal(10),
      taxableAmount: new Prisma.Decimal(amount),
      totalAmount: new Prisma.Decimal(amount),
      status: 'CONFIRMED',
    });
    items.push({
      purchaseBillId: billId,
      itemDescription: 'Perf Item ' + (index % 10),
      quantity: new Prisma.Decimal(10),
      unit: 'KG',
      rate: new Prisma.Decimal(100),
      taxableAmount: new Prisma.Decimal(amount),
    });
  }

  // Chunked createMany keeps each statement small on a local PostgreSQL.
  const chunkSize = 500;
  for (let start = 0; start < bills.length; start += chunkSize) {
    await prisma.purchaseBill.createMany({ data: bills.slice(start, start + chunkSize) });
  }
  for (let start = 0; start < items.length; start += chunkSize) {
    await prisma.purchaseBillItem.createMany({ data: items.slice(start, start + chunkSize) });
  }

  return { companyId: company.id, financialYearId: fy.id, expectedTotal };
}

function request(overrides: Partial<ReportRunRequest> = {}): ReportRunRequest {
  return {
    dateFrom: '2026-04-01',
    dateTo: '2027-03-31',
    mode: 'PURCHASE',
    format: 'BILL_NO_WISE',
    rateColumn: 'BASIC',
    detailMode: 'DETAIL',
    page: 1,
    pageSize: 100,
    sortDir: 'asc',
    ...overrides,
  };
}

async function measure<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - start) };
}

async function runSize(size: number): Promise<Timing> {
  console.log(`\n--- Dataset: ${size} purchase bills ---`);
  await cleanup(size);
  const setupStart = performance.now();
  const fixture = await buildFixture(size);
  const setupMs = Math.round(performance.now() - setupStart);
  console.log(`  Fixture created in ${setupMs} ms`);

  try {
    const options = await measure(() => reportService.getOptions(fixture.companyId, fixture.financialYearId));
    assert(options.value.items.length === 10, `${size}: the Item filter lists the 10 real stored descriptions`);
    assert(
      options.value.itemFilter.billItemCount === 10,
      `${size}: the distinct bill description count is read from PostgreSQL`
    );

    const page = await measure(() => reportService.execute(fixture.companyId, fixture.financialYearId, request()));
    assert(page.value.rowCount === size, `${size}: the row count covers the whole dataset`);
    assert(page.value.rows.length === 100, `${size}: page one is capped at the requested page size`);
    assert(
      Math.abs(page.value.totals.all.billAmount - fixture.expectedTotal) < 0.5,
      `${size}: the dataset-wide total equals the stored bill amounts`
    );

    const threshold = 1000 + Math.floor(size / 2);
    const filtered = await measure(() =>
      reportService.execute(
        fixture.companyId,
        fixture.financialYearId,
        request({ columnFilters: [{ key: 'billAmount', operator: 'gte', value: String(threshold) }] })
      )
    );
    const expectedFiltered = size - Math.floor(size / 2);
    assert(filtered.value.rowCount === expectedFiltered, `${size}: a column filter reduces the whole dataset correctly`);
    assert(
      filtered.value.rows.every((row) => Number(row.values.billAmount) >= threshold),
      `${size}: every returned row satisfies the column filter`
    );

    const grouped = await measure(() =>
      reportService.execute(
        fixture.companyId,
        fixture.financialYearId,
        request({ format: 'PARTY_WISE', columnFilters: [{ key: 'partyCity', operator: 'equals', value: 'Surat' }] })
      )
    );
    assert(grouped.value.groups.length === 1, `${size}: grouping is built over the filtered dataset`);
    assert(grouped.value.groups[0].count === size, `${size}: the group count equals the filtered row count`);

    const full = await measure(() =>
      reportService.execute(fixture.companyId, fixture.financialYearId, request({ pageSize: 0 }), true)
    );
    assert(full.value.rows.length === size, `${size}: export mode loads every row`);

    const heapBefore = process.memoryUsage().heapUsed;
    const pdf = await measure(() =>
      reportService.exportPdf(fixture.companyId, fixture.financialYearId, request({ pdfOrientation: 'landscape' }))
    );
    const heapAfter = process.memoryUsage().heapUsed;
    const pdfText = pdf.value.buffer.toString('latin1');
    const pageObjects = pdfText.match(/\/Type \/Page /g) ?? [];
    assert(pdf.value.buffer.subarray(0, 8).toString('latin1') === '%PDF-1.4', `${size}: the PDF header is valid`);
    assert(pageObjects.length >= 2, `${size}: the PDF is multi-page`);
    assert(pdfText.includes('GRAND TOTAL'), `${size}: the PDF contains the grand total`);
    assert(
      pdfText.includes('PERF-' + size + '-' + String(size - 1).padStart(5, '0')),
      `${size}: the PDF contains the last stored document`
    );

    const xlsx = await measure(() => Promise.resolve(reportService.exportXlsx(full.value)));
    assert(xlsx.value.buffer[0] === 0x50 && xlsx.value.buffer[1] === 0x4b, `${size}: the XLSX export stays a real workbook`);

    const timing: Timing = {
      size,
      optionsMs: options.ms,
      runPageMs: page.ms,
      filteredRunMs: filtered.ms,
      groupedRunMs: grouped.ms,
      fullLoadMs: full.ms,
      pdfMs: pdf.ms,
      xlsxMs: xlsx.ms,
      pdfPages: pageObjects.length,
      heapDeltaMb: Math.round(((heapAfter - heapBefore) / (1024 * 1024)) * 10) / 10,
    };
    console.log(
      `  options ${timing.optionsMs} ms | page ${timing.runPageMs} ms | filter ${timing.filteredRunMs} ms | ` +
        `group ${timing.groupedRunMs} ms | full load ${timing.fullLoadMs} ms | pdf ${timing.pdfMs} ms (${timing.pdfPages} pages) | ` +
        `xlsx ${timing.xlsxMs} ms | heap ${timing.heapDeltaMb} MB`
    );
    assert(timing.heapDeltaMb < 800, `${size}: the PDF export stays inside a sane heap budget`);
    return timing;
  } finally {
    await cleanup(size);
  }
}

async function main(): Promise<void> {
  console.log('Phase 15.1 - large dataset verification');
  const timings: Timing[] = [];
  for (const size of SIZES) {
    timings.push(await runSize(size));
  }

  console.log('\n--- Summary ---');
  for (const timing of timings) {
    console.log(
      `${String(timing.size).padStart(5)} bills | options ${String(timing.optionsMs).padStart(6)} ms | ` +
        `page1 ${String(timing.runPageMs).padStart(6)} ms | filter ${String(timing.filteredRunMs).padStart(6)} ms | ` +
        `group ${String(timing.groupedRunMs).padStart(6)} ms | full ${String(timing.fullLoadMs).padStart(6)} ms | ` +
        `pdf ${String(timing.pdfMs).padStart(6)} ms | xlsx ${String(timing.xlsxMs).padStart(6)} ms | heap ${timing.heapDeltaMb} MB`
    );
  }

  console.log(`\nPhase 15.1 large dataset checks: ${passed}/${total} passed`);
  if (passed !== total) process.exit(1);
}

main()
  .catch(async (error) => {
    console.error('\nPhase 15.1 large dataset test failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
