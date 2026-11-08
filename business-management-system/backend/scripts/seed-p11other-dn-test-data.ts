/**
 * TEMPORARY test data for the Debit Note module in company P11OTHER (OTHER TEXTILES LTD).
 *
 * What it creates (idempotent - safe to run twice):
 *   - fixes the company financial year so today's date is inside it
 *   - ensures an active Debit Note Book for that financial year
 *   - 4 parties (2 suppliers, 1 customer, 1 both) with real GSTINs
 *   - 6 credit-account ledgers (interest / cash discount / quantity discount / rate difference / interest on sale / freight)
 *   - 2 party ledgers with opening balances (so the header shows a real Dr/Cr instead of "No ledger")
 *   - 5 confirmed purchase bills with items (intra-state CGST+SGST and inter-state IGST)
 *
 * Delete this file (and clear-p11other-dn-test-data.ts) once manual testing is done.
 * Run: npx tsx scripts/seed-p11other-dn-test-data.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const COMPANY_CODE = 'P11OTHER';

const money = (value: number) => new Prisma.Decimal(value.toFixed(2));
const qty = (value: number) => new Prisma.Decimal(value.toFixed(3));

interface SeedBill {
  billNumber: string;
  supplierInvoiceNumber: string;
  billDate: string;
  partyCode: string;
  supplierLegalName: string;
  supplierGstin: string;
  supplierAddress: string;
  supplierCity: string;
  supplierState: string;
  supplierStateCode: string;
  placeOfSupply: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  items: Array<{ description: string; quantity: number; unit: string; rate: number }>;
}

const PARTIES = [
  {
    partyCode: 'OT-SUPP-01',
    partyName: 'Shree Ganesh Textiles',
    partyType: 'SUPPLIER' as const,
    gstin: '27AABCT1234G1Z5',
    panNumber: 'AABCT1234G',
    address: 'Plot 24, MIDC Industrial Area',
    city: 'Ichalkaranji',
    state: 'Maharashtra',
    pincode: '416115',
    phone: '9822011001',
    email: 'accounts@shreeganesh.example',
    openingBalance: 0,
    balanceType: 'CREDIT' as const,
  },
  {
    partyCode: 'OT-SUPP-02',
    partyName: 'Rajkot Cotton Traders',
    partyType: 'SUPPLIER' as const,
    gstin: '24AABCR5678H1Z2',
    panNumber: 'AABCR5678H',
    address: '12 Gondal Road',
    city: 'Rajkot',
    state: 'Gujarat',
    pincode: '360001',
    phone: '9825022002',
    email: 'sales@rajkotcotton.example',
    openingBalance: 0,
    balanceType: 'CREDIT' as const,
  },
  {
    partyCode: 'OT-CUST-01',
    partyName: 'Mumbai Fashions Pvt Ltd',
    partyType: 'CUSTOMER' as const,
    gstin: '27AABCM9012J1Z9',
    panNumber: 'AABCM9012J',
    address: '88 Lamington Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    phone: '9820033003',
    email: 'purchase@mumbaifashions.example',
    openingBalance: 18500,
    balanceType: 'DEBIT' as const,
  },
  {
    partyCode: 'OT-BOTH-01',
    partyName: 'Surat Weaving House',
    partyType: 'BOTH' as const,
    gstin: '24AABCS3456K1Z4',
    panNumber: 'AABCS3456K',
    address: 'Ring Road Textile Market',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395003',
    phone: '9825044004',
    email: 'info@suratweaving.example',
    openingBalance: 0,
    balanceType: 'DEBIT' as const,
  },
];

const LEDGERS = [
  {
    accountCode: 'OT-INT-PUR',
    accountName: 'Interest on Purchase',
    accountGroup: 'INDIRECT_EXPENSES' as const,
    accountType: 'EXPENSE' as const,
    balanceType: 'DEBIT' as const,
  },
  {
    accountCode: 'OT-CASH-DISC',
    accountName: 'Cash Discount Received',
    accountGroup: 'INDIRECT_INCOME' as const,
    accountType: 'INCOME' as const,
    balanceType: 'CREDIT' as const,
  },
  {
    accountCode: 'OT-QTY-DISC',
    accountName: 'Quantity Discount Received',
    accountGroup: 'INDIRECT_INCOME' as const,
    accountType: 'INCOME' as const,
    balanceType: 'CREDIT' as const,
  },
  {
    accountCode: 'OT-RATE-DIFF',
    accountName: 'Rate Difference (Purchase)',
    accountGroup: 'INDIRECT_EXPENSES' as const,
    accountType: 'EXPENSE' as const,
    balanceType: 'DEBIT' as const,
  },
  {
    accountCode: 'OT-INT-SALE',
    accountName: 'Interest on Sale',
    accountGroup: 'INDIRECT_INCOME' as const,
    accountType: 'INCOME' as const,
    balanceType: 'CREDIT' as const,
  },
  {
    accountCode: 'OT-FREIGHT',
    accountName: 'Freight Charges',
    accountGroup: 'DIRECT_EXPENSES' as const,
    accountType: 'EXPENSE' as const,
    balanceType: 'DEBIT' as const,
  },
  {
    accountCode: 'TDS-RECEIVABLE',
    accountName: 'TDS Receivable',
    accountGroup: 'ASSETS' as const,
    accountType: 'ASSET' as const,
    balanceType: 'DEBIT' as const,
  },
];

const BILLS: SeedBill[] = [
  {
    billNumber: 'PB-OT-001',
    supplierInvoiceNumber: 'GST/2026/1042',
    billDate: '2026-06-10',
    partyCode: 'OT-SUPP-01',
    supplierLegalName: 'Shree Ganesh Textiles',
    supplierGstin: '27AABCT1234G1Z5',
    supplierAddress: 'Plot 24, MIDC Industrial Area',
    supplierCity: 'Ichalkaranji',
    supplierState: 'Maharashtra',
    supplierStateCode: '27',
    placeOfSupply: 'Maharashtra',
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 0,
    items: [
      { description: 'Cotton Yarn 40s', quantity: 120, unit: 'KG', rate: 210 },
      { description: 'Polyester Yarn 30s', quantity: 80, unit: 'KG', rate: 175 },
    ],
  },
  {
    billNumber: 'PB-OT-002',
    supplierInvoiceNumber: 'GST/2026/1088',
    billDate: '2026-07-18',
    partyCode: 'OT-SUPP-01',
    supplierLegalName: 'Shree Ganesh Textiles',
    supplierGstin: '27AABCT1234G1Z5',
    supplierAddress: 'Plot 24, MIDC Industrial Area',
    supplierCity: 'Ichalkaranji',
    supplierState: 'Maharashtra',
    supplierStateCode: '27',
    placeOfSupply: 'Maharashtra',
    cgstRate: 2.5,
    sgstRate: 2.5,
    igstRate: 0,
    items: [{ description: 'Cotton Yarn 40s', quantity: 60, unit: 'KG', rate: 205 }],
  },
  {
    billNumber: 'PB-OT-003',
    supplierInvoiceNumber: 'RJ/26-27/311',
    billDate: '2026-08-05',
    partyCode: 'OT-SUPP-02',
    supplierLegalName: 'Rajkot Cotton Traders',
    supplierGstin: '24AABCR5678H1Z2',
    supplierAddress: '12 Gondal Road',
    supplierCity: 'Rajkot',
    supplierState: 'Gujarat',
    supplierStateCode: '24',
    placeOfSupply: 'Gujarat',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 5,
    items: [{ description: 'Grey Fabric 60 Count', quantity: 500, unit: 'MTR', rate: 62 }],
  },
  {
    billNumber: 'PB-OT-004',
    supplierInvoiceNumber: 'RJ/26-27/402',
    billDate: '2026-09-22',
    partyCode: 'OT-SUPP-02',
    supplierLegalName: 'Rajkot Cotton Traders',
    supplierGstin: '24AABCR5678H1Z2',
    supplierAddress: '12 Gondal Road',
    supplierCity: 'Rajkot',
    supplierState: 'Gujarat',
    supplierStateCode: '24',
    placeOfSupply: 'Gujarat',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 5,
    items: [{ description: 'Grey Fabric 60 Count', quantity: 250, unit: 'MTR', rate: 64 }],
  },
  {
    billNumber: 'PB-OT-005',
    supplierInvoiceNumber: 'SWH/26/77',
    billDate: '2026-10-03',
    partyCode: 'OT-BOTH-01',
    supplierLegalName: 'Surat Weaving House',
    supplierGstin: '24AABCS3456K1Z4',
    supplierAddress: 'Ring Road Textile Market',
    supplierCity: 'Surat',
    supplierState: 'Gujarat',
    supplierStateCode: '24',
    placeOfSupply: 'Gujarat',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 5,
    items: [{ description: 'Grey Fabric 40 Count', quantity: 300, unit: 'MTR', rate: 60 }],
  },
];

async function main() {
  const company = await prisma.company.findFirst({ where: { companyCode: COMPANY_CODE } });
  if (!company) throw new Error(`Company ${COMPANY_CODE} not found.`);
  console.log(`company: ${company.companyCode} - ${company.companyName} (${company.id})`);

  // 1. Financial year: make sure today's date is inside an unlocked, active year.
  const today = new Date();
  let fy = await prisma.financialYear.findFirst({
    where: { companyId: company.id, startDate: { lte: today }, endDate: { gte: today } },
  });
  if (!fy) {
    fy = await prisma.financialYear.findFirst({ where: { companyId: company.id }, orderBy: { startDate: 'desc' } });
    if (!fy) throw new Error('No financial year exists for this company.');
    fy = await prisma.financialYear.update({
      where: { id: fy.id },
      data: {
        yearName: '2026 - 2027',
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2027-03-31T00:00:00.000Z'),
        isActive: true,
        isLocked: false,
      },
    });
    console.log(`financial year extended: ${fy.yearName} ${fy.startDate.toISOString().slice(0, 10)} -> ${fy.endDate.toISOString().slice(0, 10)}`);
  } else {
    if (fy.isLocked) {
      fy = await prisma.financialYear.update({ where: { id: fy.id }, data: { isLocked: false } });
      console.log('financial year unlocked');
    }
    console.log(`financial year: ${fy.yearName} ${fy.startDate.toISOString().slice(0, 10)} -> ${fy.endDate.toISOString().slice(0, 10)}`);
  }

  // 2. Debit Note Book for that financial year.
  let book = await prisma.debitNoteBook.findFirst({
    where: { companyId: company.id, financialYearId: fy.id },
  });
  if (!book) {
    book = await prisma.debitNoteBook.create({
      data: {
        companyId: company.id,
        financialYearId: fy.id,
        prefix: 'DN-',
        bookName: 'DEBIT NOTE',
        openingBalance: money(0),
        balanceType: 'CREDIT',
        isActive: true,
      },
    });
    console.log('debit note book created');
  } else {
    console.log(`debit note book: ${book.bookName} (prefix ${book.prefix})`);
  }

  // 3. Parties.
  const partyIdByCode = new Map<string, string>();
  for (const party of PARTIES) {
    const row = await prisma.party.upsert({
      where: { companyId_partyCode: { companyId: company.id, partyCode: party.partyCode } },
      update: {
        partyName: party.partyName,
        partyType: party.partyType,
        gstin: party.gstin,
        panNumber: party.panNumber,
        address: party.address,
        city: party.city,
        state: party.state,
        pincode: party.pincode,
        phone: party.phone,
        email: party.email,
        openingBalance: money(party.openingBalance),
        balanceType: party.balanceType,
        isActive: true,
      },
      create: {
        companyId: company.id,
        partyCode: party.partyCode,
        partyName: party.partyName,
        partyType: party.partyType,
        gstin: party.gstin,
        panNumber: party.panNumber,
        address: party.address,
        city: party.city,
        state: party.state,
        pincode: party.pincode,
        phone: party.phone,
        email: party.email,
        openingBalance: money(party.openingBalance),
        balanceType: party.balanceType,
        isActive: true,
      },
    });
    partyIdByCode.set(party.partyCode, row.id);
  }
  console.log(`parties ready: ${PARTIES.length}`);

  // 4. Credit-account ledgers.
  for (const ledger of LEDGERS) {
    await prisma.ledgerAccount.upsert({
      where: { companyId_accountCode: { companyId: company.id, accountCode: ledger.accountCode } },
      update: {
        accountName: ledger.accountName,
        accountGroup: ledger.accountGroup,
        accountType: ledger.accountType,
        balanceType: ledger.balanceType,
        isActive: true,
      },
      create: {
        companyId: company.id,
        accountCode: ledger.accountCode,
        accountName: ledger.accountName,
        accountGroup: ledger.accountGroup,
        accountType: ledger.accountType,
        balanceType: ledger.balanceType,
        openingBalance: money(0),
        isBankAccount: false,
        isAutoCreated: false,
      },
    });
  }
  console.log(`credit accounts ready: ${LEDGERS.length}`);

  // 5. Party ledgers with opening balances (real Dr/Cr in the entry header).
  const partyLedgers = [
    { code: 'PL-OTSUPP01', partyCode: 'OT-SUPP-01', group: 'SUNDRY_CREDITORS' as const, type: 'LIABILITY' as const, balanceType: 'CREDIT' as const, opening: 25000 },
    { code: 'PL-OTCUST01', partyCode: 'OT-CUST-01', group: 'SUNDRY_DEBTORS' as const, type: 'ASSET' as const, balanceType: 'DEBIT' as const, opening: 18500 },
  ];
  for (const ledger of partyLedgers) {
    const partyId = partyIdByCode.get(ledger.partyCode);
    if (!partyId) continue;
    await prisma.ledgerAccount.upsert({
      where: { companyId_accountCode: { companyId: company.id, accountCode: ledger.code } },
      update: {
        partyId,
        openingBalance: money(ledger.opening),
        balanceType: ledger.balanceType,
        isActive: true,
      },
      create: {
        companyId: company.id,
        accountCode: ledger.code,
        accountName: PARTIES.find((p) => p.partyCode === ledger.partyCode)?.partyName || ledger.code,
        accountGroup: ledger.group,
        accountType: ledger.type,
        balanceType: ledger.balanceType,
        openingBalance: money(ledger.opening),
        partyId,
        isBankAccount: false,
        isAutoCreated: false,
      },
    });
  }
  console.log(`party ledgers ready: ${partyLedgers.length} (OT-SUPP-02 intentionally has none -> "No ledger")`);

  // 6. Confirmed purchase bills with items.
  for (const bill of BILLS) {
    const partyId = partyIdByCode.get(bill.partyCode);
    if (!partyId) throw new Error(`Party ${bill.partyCode} missing.`);
    const taxable = bill.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const totalQuantity = bill.items.reduce((sum, item) => sum + item.quantity, 0);
    const cgstAmount = (taxable * bill.cgstRate) / 100;
    const sgstAmount = (taxable * bill.sgstRate) / 100;
    const igstAmount = (taxable * bill.igstRate) / 100;
    const total = taxable + cgstAmount + sgstAmount + igstAmount;

    await prisma.purchaseBill.upsert({
      where: {
        companyId_financialYearId_billNumber: {
          companyId: company.id,
          financialYearId: fy.id,
          billNumber: bill.billNumber,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        financialYearId: fy.id,
        billNumber: bill.billNumber,
        billDate: new Date(`${bill.billDate}T00:00:00.000Z`),
        partyId,
        supplierLegalName: bill.supplierLegalName,
        supplierGstin: bill.supplierGstin,
        supplierAddress: bill.supplierAddress,
        supplierCity: bill.supplierCity,
        supplierState: bill.supplierState,
        supplierStateCode: bill.supplierStateCode,
        placeOfSupply: bill.placeOfSupply,
        supplierInvoiceNumber: bill.supplierInvoiceNumber,
        supplierInvoiceDate: new Date(`${bill.billDate}T00:00:00.000Z`),
        totalQuantity: qty(totalQuantity),
        taxableAmount: money(taxable),
        cgstRate: money(bill.cgstRate),
        cgstAmount: money(cgstAmount),
        sgstRate: money(bill.sgstRate),
        sgstAmount: money(sgstAmount),
        igstRate: money(bill.igstRate),
        igstAmount: money(igstAmount),
        totalAmount: money(total),
        status: 'CONFIRMED',
        remarks: 'TEMPORARY Debit Note test data',
        items: {
          create: bill.items.map((item) => ({
            itemDescription: item.description,
            quantity: qty(item.quantity),
            unit: item.unit,
            rate: money(item.rate),
            taxableAmount: money(item.quantity * item.rate),
          })),
        },
      },
    });
  }
  console.log(`purchase bills ready: ${BILLS.length}`);

  console.log('\n--- READY TO TEST ---');
  console.log(`company : ${company.companyCode} (${company.companyName})`);
  console.log(`book    : ${book.bookName} / prefix ${book.prefix}`);
  console.log('supplier with bills + ledger : OT-SUPP-01 (Shree Ganesh Textiles, Maharashtra, intra-state)');
  console.log('supplier with bills, no ledger: OT-SUPP-02 (Rajkot Cotton Traders, Gujarat, inter-state IGST)');
  console.log('customer (SALES type)        : OT-CUST-01 (Mumbai Fashions Pvt Ltd)');
  console.log('both-type party with bill    : OT-BOTH-01 (Surat Weaving House)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());