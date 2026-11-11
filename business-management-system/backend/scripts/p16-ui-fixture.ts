// Phase 16 UI verification fixture. Creates an isolated company with real bank
// vouchers so the browser flow can be exercised, then removes it again.

import { Prisma, PrismaClient } from '@prisma/client';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { LedgerAccountService } from '../src/services/ledgerAccountService.js';

const prisma = new PrismaClient();
const voucherService = new BankVoucherService();
const ledgerService = new LedgerAccountService();

const CODE = 'P16UI';

async function cleanup() {
  const companies = await prisma.company.findMany({ where: { companyCode: CODE }, select: { id: true } });
  const ids = companies.map((c) => c.id);
  if (ids.length === 0) return;
  await prisma.bankReconciliationAudit.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.bankReconciliationStatement.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.bankReconciliationMark.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.bankReconciliationOpening.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.party.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
  console.log('fixture cleaned');
}

async function create() {
  await cleanup();

  const company = await prisma.company.create({
    data: {
      companyCode: CODE,
      companyName: 'PHASE 16 UI VERIFY LTD',
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 16, Ring Road',
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

  const bank = await ledgerService.create(company.id, {
    accountCode: '1101',
    accountName: 'State Bank of India',
    accountGroup: 'BANK',
    openingBalance: '0.00',
    bankName: 'STATE BANK OF INDIA',
    branchName: 'Ring Road, Surat',
    ifscCode: 'SBIN0001234',
    bankAccountNumber: '30987654321',
  });

  const customer = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P16UICUST',
      partyName: 'Patel Yarn Traders',
      partyType: 'CUSTOMER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'DEBIT',
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P16UISUPP',
      partyName: 'Surat Textile Suppliers',
      partyType: 'SUPPLIER',
      openingBalance: new Prisma.Decimal(0),
      balanceType: 'CREDIT',
    },
  });

  await voucherService.create(company.id, fy.id, 'RECEIPT', {
    voucherDate: '2026-05-10',
    partyId: customer.id,
    bankAccountLedgerId: bank.id,
    paymentMode: 'NEFT',
    amount: '30000.00',
    referenceNumber: 'UTR-30000',
    narration: 'Phase 16 UI receipt',
  });

  await voucherService.create(company.id, fy.id, 'RECEIPT', {
    voucherDate: '2026-05-11',
    partyId: customer.id,
    bankAccountLedgerId: bank.id,
    paymentMode: 'NEFT',
    amount: '15000.00',
    referenceNumber: 'UTR-15000',
    narration: 'Phase 16 UI receipt two',
  });

  await voucherService.create(company.id, fy.id, 'PAYMENT', {
    voucherDate: '2026-05-10',
    partyId: supplier.id,
    bankAccountLedgerId: bank.id,
    paymentMode: 'CHEQUE',
    amount: '6000.00',
    chequeNumber: 'CHQ-1001',
    chequeDate: '2026-05-08',
    narration: 'Phase 16 UI payment',
  });

  console.log(
    JSON.stringify({
      companyId: company.id,
      financialYearId: fy.id,
      bankLedgerId: bank.id,
      companyName: company.companyName,
    })
  );
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'cleanup') {
    await cleanup();
  } else {
    await create();
  }
  await prisma.$disconnect();
}

void main();