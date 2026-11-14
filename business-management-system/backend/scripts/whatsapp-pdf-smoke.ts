// Temporary Phase 19.3 smoke check: builds one PDF per supported document
// family from real database rows and verifies the %PDF- signature + content.
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/utils/prisma.js';
import { buildWhatsAppDocumentPdf } from '../src/services/whatsapp/whatsappDocumentPdf.js';

async function main(): Promise<void> {
  const company =
    (await prisma.company.findFirst({
      where: { id: '902a42ff-ee15-4437-af80-d649a06faabd' },
    })) ??
    (await prisma.company.findFirst({
      where: { bankVouchers: { some: {} } },
      orderBy: { createdAt: 'asc' },
    }));
  if (!company) throw new Error('No company');
  const fy = await prisma.financialYear.findFirst({ where: { companyId: company.id } });
  if (!fy) throw new Error('No FY');
  const scope = { companyId: company.id, financialYearId: fy.id };
  const outDir = path.resolve(process.cwd(), '..', 'documentation', 'screenshots', 'phase19');
  fs.mkdirSync(outDir, { recursive: true });

  const checks: Array<[string, string]> = [];
  const receipt = await prisma.bankVoucher.findFirst({
    where: { ...scope, voucherType: 'RECEIPT' },
    orderBy: { createdAt: 'desc' },
  });
  const payment = await prisma.bankVoucher.findFirst({
    where: { ...scope, voucherType: 'PAYMENT' },
    orderBy: { createdAt: 'desc' },
  });
  const bill = await prisma.purchaseBill.findFirst({ where: scope, orderBy: { createdAt: 'desc' } });
  const note = await prisma.debitNote.findFirst({ where: scope, orderBy: { createdAt: 'desc' } });
  let challanScope = scope;
  let challan = await prisma.productionReceive.findFirst({ where: scope, orderBy: { createdAt: 'desc' } });
  if (!challan) {
    const anyChallan = await prisma.productionReceive.findFirst({ orderBy: { createdAt: 'desc' } });
    if (anyChallan) {
      challan = anyChallan;
      challanScope = { companyId: anyChallan.companyId, financialYearId: anyChallan.financialYearId };
    }
  }

  if (receipt) checks.push(['BANK_RECEIPT', receipt.id, scope]);
  if (payment) checks.push(['BANK_PAYMENT', payment.id, scope]);
  if (bill) checks.push(['PURCHASE_BILL', bill.id, scope]);
  if (note) checks.push(['DEBIT_NOTE', note.id, scope]);
  if (challan) checks.push(['PRODUCTION_CHALLAN', challan.id, challanScope]);

  for (const [type, id, docScope] of checks) {
    const built = await buildWhatsAppDocumentPdf(type as never, id as string, docScope as typeof scope);
    const sig = built.buffer.subarray(0, 5).toString('latin1');
    const raw = built.buffer.toString('latin1');
    const hasNumber = built.documentNumber.length === 0 || raw.includes(built.documentNumber.slice(0, 8));
    const file = path.join(outDir, 'p193-' + built.fileName);
    fs.writeFileSync(file, built.buffer);
    console.log(
      `${type} | ${built.documentNumber} | ${built.fileName} | ${built.buffer.length} bytes | sig=${sig} | content=${hasNumber}`
    );
  }

  const report = await buildWhatsAppDocumentPdf('REPORT_ACCOUNT_LEDGER', 'adhoc', scope, {
    ledgerAccountId: (await prisma.ledgerAccount.findFirst({ where: { companyId: company.id } }))?.id,
    fromDate: fy.startDate.toISOString().slice(0, 10),
    toDate: fy.endDate.toISOString().slice(0, 10),
  });
  console.log('REPORT_ACCOUNT_LEDGER |', report.fileName, report.buffer.length, report.buffer.subarray(0, 5).toString('latin1'));
  fs.writeFileSync(path.join(outDir, 'p193-' + report.fileName), report.buffer);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('SMOKE FAILED', error);
  process.exit(1);
});