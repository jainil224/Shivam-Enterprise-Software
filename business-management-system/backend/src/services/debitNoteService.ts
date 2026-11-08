import { Prisma, PrismaClient } from '@prisma/client';
import { debitNoteRepository, DebitNoteFilters } from '../repositories/debitNoteRepository.js';
import { debitNoteBookRepository } from '../repositories/debitNoteBookRepository.js';
import { CompanyRepository } from '../repositories/companyRepository.js';
import { FinancialYearRepository } from '../repositories/financialYearRepository.js';

const prisma = new PrismaClient();
const companyRepo = new CompanyRepository();
const fyRepo = new FinancialYearRepository();

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fail(message: string, statusCode = 400): never {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

const NOTE_TYPES = ['SALES', 'PURCHASE', 'BOTH'] as const;
const REASONS = ['CASH_DISCOUNT', 'QUANTITY_DISCOUNT', 'RATE_DIFFERENCE', 'INTEREST', 'TCS'] as const;
const CALCULATION_BASES = ['BILL_AMOUNT', 'TAXABLE_AMOUNT', 'BASIC_AMOUNT'] as const;
const OS_EFFECTS = ['2.OS(+)', '1.OS(-)', '3.NONE'] as const;

export interface DebitNoteBillLineInput {
  billNo: string;
  billDate: string;
  totalDays?: number;
  dharaDays?: number;
  interestDays?: number;
  paidAmount?: number | string;
  paidDate?: string | null;
  itemDescription?: string | null;
  quantity?: number | string;
  billTaxable?: number | string;
  billAmount?: number | string;
  unpaidAmount?: number | string;
  sgstRate?: number | string;
  cgstRate?: number | string;
  igstRate?: number | string;
  rate?: number | string;
  basicAmount?: number | string;
  sourceBillId?: string | null;
  sourceBillType?: string | null;
}

export interface DebitNotePayload {
  bookId: string;
  noteDate: string;
  partyNoteNo?: string | null;
  noteType: 'SALES' | 'PURCHASE' | 'BOTH';
  partyId: string;
  dueDays?: number;
  creditAccountId: string;
  osEffect?: string;
  reason: (typeof REASONS)[number];
  calculationBasis: (typeof CALCULATION_BASES)[number];
  gstRate?: number | string;
  tcsAmount?: number | string;
  tdsRate?: number | string;
  tdsAmount?: number | string;
  tdsSection?: string | null;
  tdsAccount?: string | null;
  remark?: string | null;
  billLines: DebitNoteBillLineInput[];
}

interface ComputedBillLine {
  lineNumber: number;
  billNo: string;
  billDate: Date;
  totalDays: number;
  dharaDays: number;
  interestDays: number;
  paidAmount: Prisma.Decimal;
  paidDate: Date | null;
  itemDescription: string | null;
  quantity: Prisma.Decimal;
  billTaxable: Prisma.Decimal;
  billAmount: Prisma.Decimal;
  unpaidAmount: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  cgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  rate: Prisma.Decimal;
  basicAmount: Prisma.Decimal;
  sourceBillId: string | null;
  sourceBillType: string | null;
}

interface ComputedTotals {
  lines: ComputedBillLine[];
  basicAmount: number;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  tcsAmount: number;
  tdsRate: number;
  tdsAmount: number;
  tdsSection: string | null;
  tdsAccount: string | null;
  roundOff: number;
  totalAmount: number;
  gstRate: number;
}

type GstSide = 'INPUT' | 'OUTPUT';

const GST_LEDGER_CONFIG: Record<GstSide, Record<'CGST' | 'SGST' | 'IGST', { code: string; name: string; group: 'ASSETS' | 'LIABILITIES'; type: 'ASSET' | 'LIABILITY'; balance: 'DEBIT' | 'CREDIT' }>> = {
  INPUT: {
    CGST: { code: 'GST-ICGST', name: 'CGST Input Tax Credit', group: 'ASSETS', type: 'ASSET', balance: 'DEBIT' },
    SGST: { code: 'GST-ISGST', name: 'SGST Input Tax Credit', group: 'ASSETS', type: 'ASSET', balance: 'DEBIT' },
    IGST: { code: 'GST-IIGST', name: 'IGST Input Tax Credit', group: 'ASSETS', type: 'ASSET', balance: 'DEBIT' },
  },
  OUTPUT: {
    CGST: { code: 'GST-OCGST', name: 'CGST Output Tax Payable', group: 'LIABILITIES', type: 'LIABILITY', balance: 'CREDIT' },
    SGST: { code: 'GST-OSGST', name: 'SGST Output Tax Payable', group: 'LIABILITIES', type: 'LIABILITY', balance: 'CREDIT' },
    IGST: { code: 'GST-OIGST', name: 'IGST Output Tax Payable', group: 'LIABILITIES', type: 'LIABILITY', balance: 'CREDIT' },
  },
};

export class DebitNoteService {
  private async validateContext(companyId: string, financialYearId: string) {
    const company = await companyRepo.findById(companyId);
    if (!company || !company.isActive) {
      fail('Active company is required.');
    }

    const fy = await fyRepo.findById(financialYearId);
    if (!fy || !fy.isActive || fy.companyId !== companyId) {
      fail('Active financial year is required.');
    }

    return { company, fy };
  }

  private assertNoteDateInsideFinancialYear(noteDate: Date, fy: { startDate: Date; endDate: Date }) {
    const day = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate()).getTime();
    const start = new Date(fy.startDate);
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const end = new Date(fy.endDate);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

    if (day < startDay || day > endDay) {
      fail(`Note date ${noteDate.toISOString().slice(0, 10)} is outside the active financial year.`);
    }
  }

  /** Party ledger is auto-provisioned once per party (PL-<partyCode>, max 20 chars). */
  private async ensurePartyLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    party: { id: string; partyName: string; partyCode: string; partyType: string }
  ) {
    const existing = await tx.ledgerAccount.findFirst({ where: { companyId, partyId: party.id } });
    if (existing) return existing;

    const isSupplier = party.partyType === 'SUPPLIER';
    const base = `PL-${party.partyCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')}`.slice(0, 20) || 'PL-PARTY';

    let accountCode = base;
    for (let suffix = 1; suffix <= 99; suffix++) {
      const clash = await tx.ledgerAccount.findFirst({ where: { companyId, accountCode } });
      if (!clash) break;
      accountCode = `${base.slice(0, 20 - String(suffix).length)}${suffix}`;
    }

    try {
      return await tx.ledgerAccount.create({
        data: {
          companyId,
          accountCode,
          accountName: party.partyName,
          accountGroup: isSupplier ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS',
          accountType: isSupplier ? 'LIABILITY' : 'ASSET',
          balanceType: isSupplier ? 'CREDIT' : 'DEBIT',
          openingBalance: new Prisma.Decimal(0),
          partyId: party.id,
          isAutoCreated: true,
          isBankAccount: false,
          description: `Auto-created ledger account for party ${party.partyName}`,
        },
      });
    } catch {
      const found = await tx.ledgerAccount.findFirst({ where: { companyId, partyId: party.id } });
      if (found) return found;
      throw new Error(`Unable to provision ledger account for party ${party.partyName}.`);
    }
  }

  private async ensureGstLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    taxName: 'CGST' | 'SGST' | 'IGST',
    side: GstSide
  ) {
    const config = GST_LEDGER_CONFIG[side][taxName];
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, accountCode: config.code },
    });
    if (existing) return existing;

    return tx.ledgerAccount.create({
      data: {
        companyId,
        accountCode: config.code,
        accountName: config.name,
        accountGroup: config.group,
        accountType: config.type,
        balanceType: config.balance,
        openingBalance: new Prisma.Decimal(0),
        isAutoCreated: true,
        isBankAccount: false,
        description: `Auto-created ${side.toLowerCase()} GST ledger for ${taxName}`,
      },
    });
  }

  private async ensureRoundOffLedger(tx: Prisma.TransactionClient, companyId: string) {
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, accountCode: 'SYS-ROUND-OFF' },
    });
    if (existing) return existing;

    return tx.ledgerAccount.create({
      data: {
        companyId,
        accountCode: 'SYS-ROUND-OFF',
        accountName: 'Round Off',
        accountGroup: 'OTHERS',
        accountType: 'EQUITY',
        balanceType: 'DEBIT',
        openingBalance: new Prisma.Decimal(0),
        isAutoCreated: true,
        isBankAccount: false,
        description: 'Auto-created round-off adjustment ledger',
      },
    });
  }

  private async ensureTcsLedger(tx: Prisma.TransactionClient, companyId: string) {
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, accountCode: 'GST-TCS' },
    });
    if (existing) return existing;

    return tx.ledgerAccount.create({
      data: {
        companyId,
        accountCode: 'GST-TCS',
        accountName: 'TCS Payable',
        accountGroup: 'LIABILITIES',
        accountType: 'LIABILITY',
        balanceType: 'CREDIT',
        openingBalance: new Prisma.Decimal(0),
        isAutoCreated: true,
        isBankAccount: false,
        description: 'Auto-created TCS ledger (amount entered explicitly, no configured rate)',
      },
    });
  }

  /**
   * TDS receivable ledger (asset). The amount deducted from the party is parked here.
   * Provisioned once per company under a fixed code so a note never invents a ledger.
   */
  private async ensureTdsLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    preferredName?: string | null
  ) {
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, accountCode: 'TDS-RECEIVABLE' },
    });
    if (existing) return existing;

    const accountName = (preferredName || '').trim().slice(0, 60) || 'TDS Receivable';

    try {
      return await tx.ledgerAccount.create({
        data: {
          companyId,
          accountCode: 'TDS-RECEIVABLE',
          accountName,
          accountGroup: 'ASSETS',
          accountType: 'ASSET',
          balanceType: 'DEBIT',
          openingBalance: new Prisma.Decimal(0),
          isAutoCreated: true,
          isBankAccount: false,
          description: 'Auto-created TDS receivable ledger',
        },
      });
    } catch {
      const found = await tx.ledgerAccount.findFirst({
        where: { companyId, accountCode: 'TDS-RECEIVABLE' },
      });
      if (found) return found;
      throw new Error('Unable to provision the TDS receivable ledger account.');
    }
  }

  private computeBillLines(
    payload: DebitNotePayload,
    noteDate: Date,
    gstRateNum: number
  ): ComputedBillLine[] {
    const lines: ComputedBillLine[] = [];

    (payload.billLines || []).forEach((raw, index) => {
      const billNo = String(raw.billNo || '').trim();
      if (!billNo) {
        fail(`Bill line ${index + 1}: Bill No is required.`);
      }

      const billDate = raw.billDate ? new Date(raw.billDate) : noteDate;
      if (Number.isNaN(billDate.getTime())) {
        fail(`Bill line ${index + 1}: Bill Date is invalid.`);
      }

      const totalDays = raw.totalDays !== undefined
        ? Math.max(0, Math.trunc(toNumber(raw.totalDays)))
        : Math.max(0, Math.floor((noteDate.getTime() - billDate.getTime()) / 86400000));
      const dharaDays = Math.max(0, Math.trunc(toNumber(raw.dharaDays)));
      const interestDays = raw.interestDays !== undefined
        ? Math.max(0, Math.trunc(toNumber(raw.interestDays)))
        : Math.max(0, totalDays - dharaDays);

      const billAmount = toNumber(raw.billAmount);
      const billTaxable = raw.billTaxable !== undefined && raw.billTaxable !== null && String(raw.billTaxable).trim() !== ''
        ? toNumber(raw.billTaxable)
        : billAmount;
      const paidAmount = toNumber(raw.paidAmount);
      const unpaidAmount = raw.unpaidAmount !== undefined && raw.unpaidAmount !== null && String(raw.unpaidAmount).trim() !== ''
        ? toNumber(raw.unpaidAmount)
        : billAmount - paidAmount;
      const quantity = toNumber(raw.quantity);
      const rate = toNumber(raw.rate);

      if (billAmount < 0 || billTaxable < 0 || paidAmount < 0 || unpaidAmount < 0 || quantity < 0 || rate < 0) {
        fail(`Bill line ${index + 1}: Negative financial values are not allowed.`);
      }

      let baseForCalculation = billAmount;
      if (payload.calculationBasis === 'TAXABLE_AMOUNT' || payload.calculationBasis === 'BASIC_AMOUNT') {
        baseForCalculation = billTaxable;
      }

      let basicAmount: number;
      // An explicit Basic Amount wins only when it is a positive figure. A zero or
      // blank value falls back to the documented rate formula so a stale client
      // value can never silently produce a zero-value Debit Note line.
      const explicitBasicValue = raw.basicAmount !== undefined && raw.basicAmount !== null
        ? toNumber(raw.basicAmount)
        : 0;
      const explicitBasic = explicitBasicValue > 0;
      if (explicitBasic) {
        basicAmount = explicitBasicValue;
      } else if (rate > 0) {
        if (payload.reason === 'INTEREST') {
          basicAmount = interestDays > 0
            ? (baseForCalculation * rate * interestDays) / 36500
            : (baseForCalculation * rate) / 100;
        } else if (payload.reason === 'QUANTITY_DISCOUNT' || payload.reason === 'RATE_DIFFERENCE') {
          basicAmount = quantity > 0 ? quantity * rate : (baseForCalculation * rate) / 100;
        } else {
          basicAmount = (baseForCalculation * rate) / 100;
        }
      } else {
        basicAmount = 0;
      }

      basicAmount = round2(basicAmount);
      if (basicAmount < 0) {
        fail(`Bill line ${index + 1}: Basic Amount cannot be negative.`);
      }

      lines.push({
        lineNumber: index + 1,
        billNo,
        billDate,
        totalDays,
        dharaDays,
        interestDays,
        paidAmount: new Prisma.Decimal(round2(paidAmount)),
        paidDate: raw.paidDate ? new Date(raw.paidDate) : null,
        itemDescription: raw.itemDescription ? String(raw.itemDescription).trim() : null,
        quantity: new Prisma.Decimal(quantity),
        billTaxable: new Prisma.Decimal(round2(billTaxable)),
        billAmount: new Prisma.Decimal(round2(billAmount)),
        unpaidAmount: new Prisma.Decimal(round2(unpaidAmount)),
        sgstRate: new Prisma.Decimal(round2(toNumber(raw.sgstRate, gstRateNum / 2))),
        cgstRate: new Prisma.Decimal(round2(toNumber(raw.cgstRate, gstRateNum / 2))),
        igstRate: new Prisma.Decimal(round2(toNumber(raw.igstRate, 0))),
        rate: new Prisma.Decimal(rate),
        basicAmount: new Prisma.Decimal(basicAmount),
        sourceBillId: raw.sourceBillId || null,
        sourceBillType: raw.sourceBillType || null,
      });
    });

    if (lines.length === 0) {
      fail('At least one bill line is required.');
    }

    return lines;
  }

  private computeTotals(
    payload: DebitNotePayload,
    lines: ComputedBillLine[],
    companyGstin: string | null,
    partyGstin: string | null
  ): ComputedTotals {
    const gstRateNum = round2(Math.max(0, toNumber(payload.gstRate, 0)));
    const basicAmount = round2(lines.reduce((sum, line) => sum + toNumber(line.basicAmount), 0));
    const taxableValue = basicAmount;

    const companyStateCode = companyGstin ? companyGstin.trim().substring(0, 2) : '';
    const partyStateCode = partyGstin ? partyGstin.trim().substring(0, 2) : '';
    const isIntraState = Boolean(companyStateCode) && Boolean(partyStateCode)
      ? partyStateCode === companyStateCode
      : true;

    let cgstRate = 0;
    let cgstAmount = 0;
    let sgstRate = 0;
    let sgstAmount = 0;
    let igstRate = 0;
    let igstAmount = 0;

    const linesWithTax = lines.filter((l) => toNumber(l.basicAmount) > 0);
    const hasRowTaxes = linesWithTax.some(
      (l) => toNumber(l.sgstRate) > 0 || toNumber(l.cgstRate) > 0 || toNumber(l.igstRate) > 0
    );

    if (hasRowTaxes) {
      let sumCgstRate = 0;
      let sumSgstRate = 0;
      let sumIgstRate = 0;

      for (const line of linesWithTax) {
        const lineBasic = toNumber(line.basicAmount);
        const rSgst = toNumber(line.sgstRate);
        const rCgst = toNumber(line.cgstRate);
        const rIgst = toNumber(line.igstRate);

        cgstAmount += (lineBasic * rCgst) / 100;
        sgstAmount += (lineBasic * rSgst) / 100;
        igstAmount += (lineBasic * rIgst) / 100;

        sumCgstRate += rCgst;
        sumSgstRate += rSgst;
        sumIgstRate += rIgst;
      }

      cgstAmount = round2(cgstAmount);
      sgstAmount = round2(sgstAmount);
      igstAmount = round2(igstAmount);

      cgstRate = linesWithTax.length > 0 ? round2(sumCgstRate / linesWithTax.length) : 0;
      sgstRate = linesWithTax.length > 0 ? round2(sumSgstRate / linesWithTax.length) : 0;
      igstRate = linesWithTax.length > 0 ? round2(sumIgstRate / linesWithTax.length) : 0;
    } else if (gstRateNum > 0) {
      if (isIntraState) {
        cgstRate = round2(gstRateNum / 2);
        sgstRate = round2(gstRateNum / 2);
        cgstAmount = round2((taxableValue * cgstRate) / 100);
        sgstAmount = round2((taxableValue * sgstRate) / 100);
      } else {
        igstRate = gstRateNum;
        igstAmount = round2((taxableValue * igstRate) / 100);
      }
    }

    // TCS has no configured rate in this BMS. When the reason is TCS the amount is
    // entered explicitly; it is never inferred from a fabricated percentage.
    const tcsAmount = payload.reason === 'TCS' ? round2(Math.max(0, toNumber(payload.tcsAmount, 0))) : 0;
    if (payload.reason === 'TCS' && tcsAmount <= 0) {
      fail('TCS amount must be entered explicitly because no TCS rate is configured in this BMS.');
    }

    // TDS: the rate is always entered by the user, never inferred. The amount is
    // derived from the taxable value; an explicit amount is honoured only when the
    // rate is zero, mirroring the TCS behaviour.
    const tdsRate = round2(Math.max(0, toNumber(payload.tdsRate, 0)));
    if (tdsRate > 100) fail('TDS rate cannot exceed 100%.');

    const explicitTdsAmount = round2(Math.max(0, toNumber(payload.tdsAmount, 0)));
    const tdsAmount = tdsRate > 0 ? round2((taxableValue * tdsRate) / 100) : explicitTdsAmount;

    const tdsSection = payload.tdsSection
      ? String(payload.tdsSection).trim().toUpperCase().slice(0, 20) || null
      : null;
    const tdsAccount = payload.tdsAccount ? String(payload.tdsAccount).trim().slice(0, 60) || null : null;

    const subTotal = round2(taxableValue + cgstAmount + sgstAmount + igstAmount + tcsAmount);
    const totalAmount = Math.round(subTotal);
    const roundOff = round2(totalAmount - subTotal);

    // TDS reduces the party debit, so it can never consume the whole note.
    if (tdsAmount > 0 && tdsAmount >= totalAmount) {
      fail(
        'TDS amount (' +
          tdsAmount.toFixed(2) +
          ') must be less than the Debit Note total (' +
          totalAmount.toFixed(2) +
          ').'
      );
    }

    return {
      lines,
      basicAmount,
      taxableValue,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      tcsAmount,
      tdsRate,
      tdsAmount,
      tdsSection,
      tdsAccount,
      roundOff,
      totalAmount,
      gstRate: gstRateNum,
    };
  }

  private validateHeaderPayload(payload: DebitNotePayload) {
    if (!payload.bookId) fail('Debit Note Book is required.');
    if (!payload.partyId) fail('Party is required.');
    if (!payload.creditAccountId) fail('Credit Account is required.');
    if (!NOTE_TYPES.includes(payload.noteType)) fail('Note Type must be SALES, PURCHASE or BOTH.');
    if (!REASONS.includes(payload.reason)) fail('Reason is invalid.');
    if (!CALCULATION_BASES.includes(payload.calculationBasis)) fail('Calculation Basis is invalid.');

    const osEffect = payload.osEffect || '2.OS(+)';
    if (!OS_EFFECTS.includes(osEffect as (typeof OS_EFFECTS)[number])) {
      fail('O/s Effect must be 2.OS(+), 1.OS(-) or 3.NONE.');
    }

    // TDS is enabled. The rate is user-entered and the amount is derived from the
    // taxable value; only genuinely invalid values are rejected.
    const tdsRateInput = toNumber(payload.tdsRate, 0);
    if (!Number.isFinite(tdsRateInput) || tdsRateInput < 0) {
      fail('TDS rate cannot be negative.');
    }
    if (tdsRateInput > 100) {
      fail('TDS rate cannot exceed 100%.');
    }
    const tdsAmountInput = toNumber(payload.tdsAmount, 0);
    if (!Number.isFinite(tdsAmountInput) || tdsAmountInput < 0) {
      fail('TDS amount cannot be negative.');
    }
  }

  /**
   * Source bills are validated against real saved documents: same company,
   * same party, correct transaction type and no duplicate/over adjustment.
   */
  private async validateSourceBills(
    companyId: string,
    partyId: string,
    lines: ComputedBillLine[],
    reason: string,
    excludeDebitNoteId?: string
  ) {
    const sourceIds = Array.from(
      new Set(lines.map((line) => line.sourceBillId).filter((id): id is string => Boolean(id)))
    );
    if (sourceIds.length === 0) return;

    const bills = await prisma.purchaseBill.findMany({
      where: { companyId, id: { in: sourceIds } },
      select: { id: true, partyId: true, status: true, totalAmount: true, billNumber: true },
    });
    const billMap = new Map(bills.map((bill) => [bill.id, bill]));

    const isAdjustment = ['CASH_DISCOUNT', 'QUANTITY_DISCOUNT', 'RATE_DIFFERENCE'].includes(reason);

    for (const line of lines) {
      if (!line.sourceBillId) continue;
      const bill = billMap.get(line.sourceBillId);
      if (!bill) fail(`Source bill ${line.billNo} was not found in the active company.`, 404);
      if (bill.status === 'CANCELLED') fail(`Source bill ${line.billNo} is cancelled.`);
      if (bill.partyId !== partyId) fail(`Source bill ${line.billNo} does not belong to the selected party.`);
      if (line.sourceBillType && line.sourceBillType !== 'PURCHASE') {
        fail(`Source bill ${line.billNo} is not a purchase bill.`);
      }

      if (isAdjustment) {
        const alreadyAdjusted = await debitNoteRepository.sumAdjustedForSourceBill(
          companyId,
          bill.id,
          excludeDebitNoteId
        );
        const proposed = new Prisma.Decimal(line.basicAmount).plus(alreadyAdjusted);
        if (proposed.greaterThan(new Prisma.Decimal(bill.totalAmount).plus(0.01))) {
          fail(
            `Adjusted amount for bill ${line.billNo} (${proposed.toFixed(2)}) exceeds the source bill amount (${new Prisma.Decimal(
              bill.totalAmount
            ).toFixed(2)}).`
          );
        }
      }
    }
  }

  /**
   * Real eligible bills for the selected party. No synthetic rows are ever returned.
   * Paid amounts and payment dates are accurately detected from real BankVoucher payment
   * records linked to the party.
   */
  async getEligibleBills(companyId: string, financialYearId: string, partyId: string, noteType: string) {
    await this.validateContext(companyId, financialYearId);

    const party = await prisma.party.findFirst({ where: { id: partyId, companyId } });
    if (!party) fail('Party not found.', 404);

    const wantsPurchase = noteType === 'PURCHASE' || noteType === 'BOTH';
    if (!wantsPurchase) {
      // Sales invoices are not implemented in this BMS version. Return a true empty state.
      return [];
    }

    const purchaseBills = await prisma.purchaseBill.findMany({
      where: { companyId, partyId, status: { not: 'CANCELLED' } },
      orderBy: { billDate: 'desc' },
      include: { items: true },
    });

    // Single grouped aggregate instead of one query per bill: large party lookups stay fast.
    const billIds = purchaseBills.map((bill) => bill.id);
    const adjustedGroups = billIds.length
      ? await prisma.debitNoteBillLine.groupBy({
          by: ['sourceBillId'],
          where: {
            sourceBillId: { in: billIds },
            debitNote: { companyId, status: { not: 'CANCELLED' } },
          },
          _sum: { basicAmount: true },
        })
      : [];
    const adjustedByBillId = new Map<string, number>();
    for (const group of adjustedGroups) {
      if (group.sourceBillId) adjustedByBillId.set(group.sourceBillId, toNumber(group._sum.basicAmount ?? 0));
    }

    // Query real bank payment vouchers posted for this party to detect actual payments
    const paymentVouchers = await prisma.bankVoucher.findMany({
      where: {
        companyId,
        partyId,
        voucherType: 'PAYMENT',
        status: 'POSTED',
      },
      orderBy: { voucherDate: 'asc' },
    });

    // Match payment vouchers by direct reference/narration first, then FIFO by bill date
    const paymentsByBillId = new Map<string, { paid: number; lastPaymentDate: Date | null }>();
    let unallocatedPayment = 0;

    for (const voucher of paymentVouchers) {
      const vAmt = toNumber(voucher.amount);
      if (vAmt <= 0) continue;

      const ref = (voucher.referenceNumber || '').trim().toLowerCase();
      const narration = (voucher.narration || '').trim().toLowerCase();
      const remarks = (voucher.remarks || '').trim().toLowerCase();

      // Check if reference points to a specific purchase bill
      const matchedBill = purchaseBills.find((b) => {
        const invNo = (b.supplierInvoiceNumber || '').trim().toLowerCase();
        const billNo = (b.billNumber || '').trim().toLowerCase();
        return (
          (invNo && (ref === invNo || narration.includes(invNo) || remarks.includes(invNo))) ||
          (billNo && (ref === billNo || narration.includes(billNo) || remarks.includes(billNo)))
        );
      });

      if (matchedBill) {
        const current = paymentsByBillId.get(matchedBill.id) || { paid: 0, lastPaymentDate: null };
        current.paid += vAmt;
        current.lastPaymentDate = voucher.voucherDate;
        paymentsByBillId.set(matchedBill.id, current);
      } else {
        unallocatedPayment += vAmt;
      }
    }

    // FIFO allocation of unallocated payments to older bills first (chronological order)
    const chronologicalBills = [...purchaseBills].sort(
      (a, b) => new Date(a.billDate).getTime() - new Date(b.billDate).getTime()
    );

    for (const bill of chronologicalBills) {
      const billTotal = toNumber(bill.totalAmount);
      const existing = paymentsByBillId.get(bill.id) || { paid: 0, lastPaymentDate: null };
      const needed = Math.max(0, billTotal - existing.paid);

      if (needed > 0 && unallocatedPayment > 0) {
        const alloc = Math.min(needed, unallocatedPayment);
        existing.paid += alloc;
        unallocatedPayment -= alloc;
        if (!existing.lastPaymentDate && paymentVouchers.length > 0) {
          existing.lastPaymentDate = paymentVouchers[paymentVouchers.length - 1].voucherDate;
        }
        paymentsByBillId.set(bill.id, existing);
      }
    }

    const rows = [];
    for (const bill of purchaseBills) {
      const billAmt = toNumber(bill.totalAmount);
      const alreadyAdjusted = adjustedByBillId.get(bill.id) ?? 0;
      const paymentInfo = paymentsByBillId.get(bill.id);
      const paidAmt = paymentInfo ? round2(Math.min(billAmt, paymentInfo.paid)) : 0;
      const paymentDate = paymentInfo?.lastPaymentDate ? paymentInfo.lastPaymentDate.toISOString().slice(0, 10) : null;
      const unPaidAmt = round2(Math.max(0, billAmt - paidAmt - alreadyAdjusted));

      const itemNames = bill.items
        .map((item) => item.itemDescription)
        .filter((name): name is string => Boolean(name && name.trim()));

      rows.push({
        id: bill.id,
        invoiceNo: bill.supplierInvoiceNumber || bill.billNumber,
        date: bill.billDate.toISOString().slice(0, 10),
        item: itemNames.length > 0 ? itemNames.join(', ') : null,
        quantity: toNumber(bill.totalQuantity),
        billAmt: round2(billAmt),
        taxableAmt: round2(toNumber(bill.taxableAmount)),
        paymentDate,
        paidAmt,
        unPaidAmt,
        adjustedAmt: round2(alreadyAdjusted),
        paymentAllocationAvailable: paymentVouchers.length > 0,
        txnType: 'PURCHASE',
        sgstRate: toNumber(bill.sgstRate),
        cgstRate: toNumber(bill.cgstRate),
        igstRate: toNumber(bill.igstRate),
      });
    }

    return rows;
  }
  async getNextNumber(companyId: string, financialYearId: string, bookId: string) {
    await this.validateContext(companyId, financialYearId);
    if (!bookId) fail('bookId query parameter is required.');

    const book = await debitNoteBookRepository.findById(companyId, financialYearId, bookId);
    if (!book || !book.isActive) fail('Active Debit Note Book not found.', 404);

    const voucherNumber = await debitNoteRepository.peekVoucherNumber(companyId, financialYearId, book.id);
    return {
      bookId: book.id,
      bookName: book.bookName,
      prefix: book.prefix,
      voucherNumber,
      noteNumber: `${book.prefix} ${voucherNumber}`,
    };
  }

  async getSummary(companyId: string, financialYearId: string) {
    await this.validateContext(companyId, financialYearId);
    return debitNoteRepository.getSummary(companyId, financialYearId);
  }

  async getPartyBalance(companyId: string, financialYearId: string, partyId: string) {
    await this.validateContext(companyId, financialYearId);
    if (!partyId) fail('partyId query parameter is required.');

    const party = await prisma.party.findFirst({ where: { id: partyId, companyId } });
    if (!party) fail('Party not found.', 404);

    const live = await debitNoteRepository.getPartyLedgerBalance(companyId, partyId);
    return {
      partyId,
      ledgerId: live.ledgerId,
      balance: live.balance,
      balanceType: live.balanceType,
      source: live.ledgerId ? 'LEDGER' : 'NO_LEDGER',
    };
  }

  async getPrintRange(
    companyId: string,
    financialYearId: string,
    options: { bookId?: string; from: number; to: number; partyId?: string }
  ) {
    await this.validateContext(companyId, financialYearId);
    const from = Math.trunc(options.from);
    const to = Math.trunc(options.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to < from) {
      fail('A valid Note From / To range is required.');
    }
    return debitNoteRepository.findPrintRange(companyId, financialYearId, {
      bookId: options.bookId,
      from,
      to,
      partyId: options.partyId,
    });
  }

  async create(companyId: string, financialYearId: string, payload: DebitNotePayload) {
    const { company, fy } = await this.validateContext(companyId, financialYearId);
    if (fy.isLocked) fail('Cannot create Debit Note in a locked financial year.');

    this.validateHeaderPayload(payload);

    const book = await debitNoteBookRepository.findById(companyId, financialYearId, payload.bookId);
    if (!book || !book.isActive) fail('Active Debit Note Book not found.', 404);

    const party = await prisma.party.findFirst({ where: { id: payload.partyId, companyId } });
    if (!party) fail('Party not found in active company.', 404);
    if (!party.isActive) fail('Selected party is inactive.');

    const creditAccount = await prisma.ledgerAccount.findFirst({
      where: { id: payload.creditAccountId, companyId },
    });
    if (!creditAccount || !creditAccount.isActive) {
      fail('Active Credit Account not found in active company.', 404);
    }

    const noteDate = payload.noteDate ? new Date(payload.noteDate) : new Date();
    if (Number.isNaN(noteDate.getTime())) fail('Note Date is invalid.');
    this.assertNoteDateInsideFinancialYear(noteDate, fy);

    const gstRateNum = Math.max(0, toNumber(payload.gstRate, 0));
    const lines = this.computeBillLines(payload, noteDate, gstRateNum);
    const totals = this.computeTotals(payload, lines, company.gstin || null, party.gstin || null);

    await this.validateSourceBills(companyId, party.id, lines, payload.reason);

    if (totals.totalAmount < 0) fail('Debit Note total cannot be negative.');
    if (totals.taxableValue === 0 && totals.tcsAmount === 0) {
      fail('Debit Note amount is zero. Enter a Basic Amount or a Rate for at least one bill.');
    }

    const gstSide: GstSide = payload.noteType === 'PURCHASE' ||
      (payload.noteType === 'BOTH' && party.partyType !== 'CUSTOMER')
      ? 'INPUT'
      : 'OUTPUT';

    return prisma.$transaction(async (tx) => {
      const voucherNumber = await debitNoteRepository.getNextVoucherNumber(
        tx,
        companyId,
        financialYearId,
        book.id
      );
      const noteNumber = `${book.prefix} ${voucherNumber}`;

      const partyLedger = await this.ensurePartyLedger(tx, companyId, party);
      const tdsLedger = totals.tdsAmount > 0
        ? await this.ensureTdsLedger(tx, companyId, totals.tdsAccount)
        : null;

      const createdNote = await debitNoteRepository.create(tx, {
        companyId,
        financialYearId,
        bookId: book.id,
        voucherNumber,
        noteNumber,
        noteDate,
        partyNoteNo: payload.partyNoteNo ? payload.partyNoteNo.trim() : null,
        noteType: payload.noteType,
        partyId: party.id,
        dueDays: Math.max(0, Math.trunc(toNumber(payload.dueDays))),
        creditAccountId: creditAccount.id,
        osEffect: payload.osEffect || '2.OS(+)',
        reason: payload.reason,
        calculationBasis: payload.calculationBasis,
        gstRate: new Prisma.Decimal(totals.gstRate),
        tdsRate: new Prisma.Decimal(totals.tdsRate),
        tdsAmount: new Prisma.Decimal(totals.tdsAmount),
        tdsSection: totals.tdsSection,
        tdsAccount: tdsLedger ? tdsLedger.accountName : null,
        remark: payload.remark ? payload.remark.trim() : null,
        basicAmount: new Prisma.Decimal(totals.basicAmount),
        taxableValue: new Prisma.Decimal(totals.taxableValue),
        cgstRate: new Prisma.Decimal(totals.cgstRate),
        cgstAmount: new Prisma.Decimal(totals.cgstAmount),
        sgstRate: new Prisma.Decimal(totals.sgstRate),
        sgstAmount: new Prisma.Decimal(totals.sgstAmount),
        igstRate: new Prisma.Decimal(totals.igstRate),
        igstAmount: new Prisma.Decimal(totals.igstAmount),
        tcsAmount: new Prisma.Decimal(totals.tcsAmount),
        roundOff: new Prisma.Decimal(totals.roundOff),
        totalAmount: new Prisma.Decimal(totals.totalAmount),
        postedAt: noteDate,
        billLines: totals.lines,
      });

      const journalLines = await this.buildJournalLines(tx, {
        companyId,
        financialYearId,
        debitNoteId: createdNote.id,
        noteNumber,
        noteDate,
        partyLedgerId: partyLedger.id,
        creditAccountId: creditAccount.id,
        creditAccountName: creditAccount.accountName,
        tdsLedgerId: tdsLedger ? tdsLedger.id : null,
        totals,
        gstSide,
        revision: 1,
        startLineNumber: 1,
        narrationPrefix: 'Debit Note',
      });

      this.assertBalancedJournal(journalLines, noteNumber);
      await debitNoteRepository.insertJournalLines(tx, journalLines);

      return createdNote;
    });
  }
  async update(companyId: string, financialYearId: string, id: string, payload: DebitNotePayload) {
    const { company, fy } = await this.validateContext(companyId, financialYearId);
    if (fy.isLocked) fail('Cannot update Debit Note in a locked financial year.');

    const existing = await debitNoteRepository.findById(companyId, financialYearId, id);
    if (!existing) fail('Debit Note not found.', 404);
    if (existing.status === 'CANCELLED') fail('Cannot edit a cancelled Debit Note.');

    this.validateHeaderPayload(payload);

    const book = await debitNoteBookRepository.findById(companyId, financialYearId, existing.bookId);
    if (!book || !book.isActive) fail('Active Debit Note Book not found.', 404);

    const party = await prisma.party.findFirst({ where: { id: payload.partyId, companyId } });
    if (!party) fail('Party not found.', 404);
    if (!party.isActive) fail('Selected party is inactive.');

    const creditAccount = await prisma.ledgerAccount.findFirst({
      where: { id: payload.creditAccountId, companyId },
    });
    if (!creditAccount || !creditAccount.isActive) fail('Active Credit Account not found.', 404);

    const noteDate = payload.noteDate ? new Date(payload.noteDate) : existing.noteDate;
    if (Number.isNaN(noteDate.getTime())) fail('Note Date is invalid.');
    this.assertNoteDateInsideFinancialYear(noteDate, fy);

    const gstRateNum = Math.max(0, toNumber(payload.gstRate, 0));
    const lines = this.computeBillLines(payload, noteDate, gstRateNum);
    const totals = this.computeTotals(payload, lines, company.gstin || null, party.gstin || null);

    await this.validateSourceBills(companyId, party.id, lines, payload.reason, id);

    if (totals.taxableValue === 0 && totals.tcsAmount === 0) {
      fail('Debit Note amount is zero. Enter a Basic Amount or a Rate for at least one bill.');
    }

    const gstSide: GstSide = payload.noteType === 'PURCHASE' ||
      (payload.noteType === 'BOTH' && party.partyType !== 'CUSTOMER')
      ? 'INPUT'
      : 'OUTPUT';

    return prisma.$transaction(async (tx) => {
      const net = await debitNoteRepository.getNetPostingsByLedger(tx, id);
      const latestRevision = await debitNoteRepository.getLatestRevision(tx, id);
      const nextRevision = latestRevision + 1;

      const reversalLines: Prisma.JournalLineCreateManyInput[] = net
        .filter((entry) => !entry.debit.isZero() || !entry.credit.isZero())
        .map((entry, index) => ({
          companyId,
          financialYearId,
          debitNoteId: id,
          ledgerAccountId: entry.ledgerAccountId,
          revision: nextRevision,
          lineNumber: index + 1,
          debitAmount: entry.credit,
          creditAmount: entry.debit,
          isReversal: true,
          postingDate: noteDate,
          narration: `Reversal before revision ${nextRevision} of DN ${existing.noteNumber}`,
        }));

      const partyLedger = await this.ensurePartyLedger(tx, companyId, party);
      const tdsLedger = totals.tdsAmount > 0
        ? await this.ensureTdsLedger(tx, companyId, totals.tdsAccount)
        : null;

      const correctedLines = await this.buildJournalLines(tx, {
        companyId,
        financialYearId,
        debitNoteId: id,
        noteNumber: existing.noteNumber,
        noteDate,
        partyLedgerId: partyLedger.id,
        creditAccountId: creditAccount.id,
        creditAccountName: creditAccount.accountName,
        tdsLedgerId: tdsLedger ? tdsLedger.id : null,
        totals,
        gstSide,
        revision: nextRevision,
        startLineNumber: reversalLines.length + 1,
        narrationPrefix: `Debit Note ${existing.noteNumber} (Rev ${nextRevision})`,
      });

      this.assertBalancedJournal([...reversalLines, ...correctedLines], existing.noteNumber);

      await debitNoteRepository.insertJournalLines(tx, [...reversalLines, ...correctedLines]);

      return debitNoteRepository.update(tx, id, {
        noteDate,
        partyNoteNo: payload.partyNoteNo ? payload.partyNoteNo.trim() : null,
        noteType: payload.noteType,
        partyId: party.id,
        dueDays: Math.max(0, Math.trunc(toNumber(payload.dueDays))),
        creditAccountId: creditAccount.id,
        osEffect: payload.osEffect || '2.OS(+)',
        reason: payload.reason,
        calculationBasis: payload.calculationBasis,
        gstRate: new Prisma.Decimal(totals.gstRate),
        tdsRate: new Prisma.Decimal(totals.tdsRate),
        tdsAmount: new Prisma.Decimal(totals.tdsAmount),
        tdsSection: totals.tdsSection,
        tdsAccount: tdsLedger ? tdsLedger.accountName : null,
        remark: payload.remark ? payload.remark.trim() : null,
        basicAmount: new Prisma.Decimal(totals.basicAmount),
        taxableValue: new Prisma.Decimal(totals.taxableValue),
        cgstRate: new Prisma.Decimal(totals.cgstRate),
        cgstAmount: new Prisma.Decimal(totals.cgstAmount),
        sgstRate: new Prisma.Decimal(totals.sgstRate),
        sgstAmount: new Prisma.Decimal(totals.sgstAmount),
        igstRate: new Prisma.Decimal(totals.igstRate),
        igstAmount: new Prisma.Decimal(totals.igstAmount),
        tcsAmount: new Prisma.Decimal(totals.tcsAmount),
        roundOff: new Prisma.Decimal(totals.roundOff),
        totalAmount: new Prisma.Decimal(totals.totalAmount),
        revision: nextRevision,
        billLines: totals.lines,
      });
    });
  }

  async cancel(companyId: string, financialYearId: string, id: string, cancellationReason: string) {
    const { fy } = await this.validateContext(companyId, financialYearId);
    if (fy.isLocked) fail('Cannot cancel Debit Note in a locked financial year.');

    const reason = (cancellationReason || '').trim();
    if (!reason) fail('Cancellation reason is required.');

    const existing = await debitNoteRepository.findById(companyId, financialYearId, id);
    if (!existing) fail('Debit Note not found.', 404);
    if (existing.status === 'CANCELLED') fail('Debit Note is already cancelled.');

    return prisma.$transaction(async (tx) => {
      const net = await debitNoteRepository.getNetPostingsByLedger(tx, id);
      const latestRevision = await debitNoteRepository.getLatestRevision(tx, id);
      const nextRevision = latestRevision + 1;

      const reversalLines: Prisma.JournalLineCreateManyInput[] = net
        .filter((entry) => !entry.debit.isZero() || !entry.credit.isZero())
        .map((entry, index) => ({
          companyId,
          financialYearId,
          debitNoteId: id,
          ledgerAccountId: entry.ledgerAccountId,
          revision: nextRevision,
          lineNumber: index + 1,
          debitAmount: entry.credit,
          creditAmount: entry.debit,
          isReversal: true,
          postingDate: existing.noteDate,
          narration: `Cancellation reversal: ${reason}`,
        }));

      await debitNoteRepository.insertJournalLines(tx, reversalLines);
      return debitNoteRepository.cancel(tx, id, reason);
    });
  }

  async getById(companyId: string, financialYearId: string, id: string) {
    await this.validateContext(companyId, financialYearId);
    const note = await debitNoteRepository.findById(companyId, financialYearId, id);
    if (!note) fail('Debit Note not found.', 404);
    return note;
  }

  async listPaginated(companyId: string, financialYearId: string, filters: DebitNoteFilters) {
    await this.validateContext(companyId, financialYearId);
    return debitNoteRepository.findPaginated(companyId, financialYearId, filters);
  }

  async getPreviousAndNext(companyId: string, financialYearId: string, id: string) {
    await this.validateContext(companyId, financialYearId);
    const current = await debitNoteRepository.findById(companyId, financialYearId, id);
    if (!current) fail('Debit Note not found.', 404);
    return debitNoteRepository.findPreviousAndNext(
      companyId,
      financialYearId,
      current.bookId,
      current.voucherNumber
    );
  }

  private async buildJournalLines(
    tx: Prisma.TransactionClient,
    context: {
      companyId: string;
      financialYearId: string;
      debitNoteId: string;
      noteNumber: string;
      noteDate: Date;
      partyLedgerId: string;
      creditAccountId: string;
      creditAccountName: string;
      tdsLedgerId: string | null;
      totals: ComputedTotals;
      gstSide: GstSide;
      revision: number;
      startLineNumber: number;
      narrationPrefix: string;
    }
  ): Promise<Prisma.JournalLineCreateManyInput[]> {
    const { totals } = context;
    const lines: Prisma.JournalLineCreateManyInput[] = [];
    let lineNumber = context.startLineNumber;

    const push = (
      line: Omit<
        Prisma.JournalLineCreateManyInput,
        'companyId' | 'financialYearId' | 'debitNoteId' | 'revision' | 'lineNumber' | 'postingDate'
      >
    ) => {
      lines.push({
        companyId: context.companyId,
        financialYearId: context.financialYearId,
        debitNoteId: context.debitNoteId,
        revision: context.revision,
        lineNumber: lineNumber++,
        postingDate: context.noteDate,
        ...line,
      });
    };

    // Debit the party with the net note value. TDS is deducted from the party debit
    // and parked in the TDS receivable ledger; the note total itself never changes.
    const partyDebit = round2(totals.totalAmount - totals.tdsAmount);
    if (partyDebit !== 0) {
      push({
        ledgerAccountId: context.partyLedgerId,
        debitAmount: new Prisma.Decimal(partyDebit),
        creditAmount: new Prisma.Decimal(0),
        isReversal: false,
        narration: `${context.narrationPrefix}: Debited towards ${context.creditAccountName}`,
      });
    }

    if (totals.tdsAmount > 0) {
      if (!context.tdsLedgerId) {
        fail('TDS ledger account is missing for a note with a TDS deduction.');
      }
      push({
        ledgerAccountId: context.tdsLedgerId,
        debitAmount: new Prisma.Decimal(totals.tdsAmount),
        creditAmount: new Prisma.Decimal(0),
        isReversal: false,
        narration:
          'TDS ' +
          totals.tdsRate +
          '%' +
          (totals.tdsSection ? ' u/s ' + totals.tdsSection : '') +
          ' on DN ' +
          context.noteNumber,
      });
    }

    // Credit the selected credit account with the taxable value.
    push({
      ledgerAccountId: context.creditAccountId,
      debitAmount: new Prisma.Decimal(0),
      creditAmount: new Prisma.Decimal(totals.taxableValue),
      isReversal: false,
      narration: `Amount credited towards ${context.creditAccountName} via DN ${context.noteNumber}`,
    });

    if (totals.cgstAmount > 0) {
      const ledger = await this.ensureGstLedger(tx, context.companyId, 'CGST', context.gstSide);
      push({
        ledgerAccountId: ledger.id,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(totals.cgstAmount),
        isReversal: false,
        narration: `CGST ${context.gstSide === 'INPUT' ? 'input reversal' : 'output'} ${totals.cgstRate}% on DN ${context.noteNumber}`,
      });
    }

    if (totals.sgstAmount > 0) {
      const ledger = await this.ensureGstLedger(tx, context.companyId, 'SGST', context.gstSide);
      push({
        ledgerAccountId: ledger.id,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(totals.sgstAmount),
        isReversal: false,
        narration: `SGST ${context.gstSide === 'INPUT' ? 'input reversal' : 'output'} ${totals.sgstRate}% on DN ${context.noteNumber}`,
      });
    }

    if (totals.igstAmount > 0) {
      const ledger = await this.ensureGstLedger(tx, context.companyId, 'IGST', context.gstSide);
      push({
        ledgerAccountId: ledger.id,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(totals.igstAmount),
        isReversal: false,
        narration: `IGST ${context.gstSide === 'INPUT' ? 'input reversal' : 'output'} ${totals.igstRate}% on DN ${context.noteNumber}`,
      });
    }

    if (totals.tcsAmount > 0) {
      const ledger = await this.ensureTcsLedger(tx, context.companyId);
      push({
        ledgerAccountId: ledger.id,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: new Prisma.Decimal(totals.tcsAmount),
        isReversal: false,
        narration: `TCS on DN ${context.noteNumber}`,
      });
    }

    if (totals.roundOff !== 0) {
      const ledger = await this.ensureRoundOffLedger(tx, context.companyId);
      push({
        ledgerAccountId: ledger.id,
        debitAmount: totals.roundOff < 0 ? new Prisma.Decimal(Math.abs(totals.roundOff)) : new Prisma.Decimal(0),
        creditAmount: totals.roundOff > 0 ? new Prisma.Decimal(totals.roundOff) : new Prisma.Decimal(0),
        isReversal: false,
        narration: `Round off on DN ${context.noteNumber}`,
      });
    }

    return lines;
  }

  private assertBalancedJournal(lines: Prisma.JournalLineCreateManyInput[], noteNumber: string) {
    const debit = lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(String(line.debitAmount ?? 0))), new Prisma.Decimal(0));
    const credit = lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(String(line.creditAmount ?? 0))), new Prisma.Decimal(0));
    if (!debit.equals(credit)) {
      fail(`Journal for ${noteNumber} is unbalanced (Dr ${debit.toFixed(2)} / Cr ${credit.toFixed(2)}).`);
    }
  }
}

export const debitNoteService = new DebitNoteService();