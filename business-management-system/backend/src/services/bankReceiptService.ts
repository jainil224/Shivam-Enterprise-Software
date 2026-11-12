// Phase 18 - Bank Receipt Entry (Cheque Receipt).
// One receipt voucher = one BankVoucher header + many BankVoucherLine rows.
// Posting reuses the Phase 12 double-entry engine: JournalLine remains the only
// posted accounting source. This service only decides WHAT to post.
//
// Posting shape for one voucher:
//   DR  selected bank ledger              = SUM(row amounts)
//   CR  party ledger (per row)            = row amount + DR adjustments - CR adjustments
//   DR  adjustment ledger (per DR line)   = adjustment amount
//   CR  adjustment ledger (per CR line)   = adjustment amount
// Total debit always equals total credit by construction and is verified again
// against the stored JournalLine rows before the transaction commits.

import {
  BankReceiptAdjustmentMode,
  BankReceiptCalculationType,
  BankReceiptDrCr,
  LedgerAccount,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  BankReceiptRepository,
  BookWithLedger,
} from '../repositories/bankReceiptRepository.js';
import { MoneyInputError, parsePositiveMoney } from '../utils/money.js';
import {
  AppError,
  FieldError,
  conflictError,
  notFoundError,
  validationError,
} from '../utils/appError.js';
import { signedBalance, signedOpening } from '../utils/ledgerPosting.js';

const prisma = new PrismaClient();
const repo = new BankReceiptRepository();

const ADJUSTMENT_MODES: BankReceiptAdjustmentMode[] = [
  'NO_ADJUSTMENT',
  'AGAINST_BILL',
  'SKIP_IN_OS',
];
const CALCULATION_TYPES: BankReceiptCalculationType[] = ['AMT', 'INT', 'TDS'];
const CHEQUE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-/]{0,19}$/;
const PREFIX_PATTERN = /^[A-Za-z0-9\-/]{0,10}$/;
const MAX_LINES = 200;

export interface ReceiptAllocationPayload {
  purchaseBillId?: string;
  allocatedAmount?: string | number | null;
}

export interface ReceiptAdjustmentPayload {
  purchaseBillId?: string | null;
  adjustmentLedgerAccountId?: string;
  calculationType?: string;
  interestPercent?: string | number | null;
  dueValue?: number | string | null;
  tdsPercent?: string | number | null;
  adjustmentAmount?: string | number | null;
  drCr?: string;
  note?: string | null;
}

export interface ReceiptLinePayload {
  partyId?: string;
  bankInstrumentId?: string | null;
  bankNameCode?: string | null;
  chequeNumber?: string | null;
  description?: string | null;
  amount?: string | number | null;
  adjustmentMode?: string;
  allocations?: ReceiptAllocationPayload[];
  adjustments?: ReceiptAdjustmentPayload[];
}

export interface ReceiptPayload {
  bookId?: string;
  voucherDate?: string;
  narration?: string | null;
  remarks?: string | null;
  lines?: ReceiptLinePayload[];
}

export interface ReceiptBookPayload {
  prefix?: string | null;
  bookName?: string;
  bankAccountLedgerId?: string;
  isActive?: boolean;
}

export interface InstrumentPayload {
  code?: string;
  description?: string;
  isActive?: boolean;
}

interface ResolvedAllocation {
  purchaseBillId: string;
  billNumber: string;
  billDate: Date;
  billAmount: Prisma.Decimal;
  billTds: Prisma.Decimal;
  previousReceived: Prisma.Decimal;
  allocatedAmount: Prisma.Decimal;
  balanceAfter: Prisma.Decimal;
  dueValue: number | null;
}

interface ResolvedAdjustment {
  purchaseBillId: string | null;
  account: LedgerAccount;
  calculationType: BankReceiptCalculationType;
  interestPercent: Prisma.Decimal | null;
  dueValue: number | null;
  tdsPercent: Prisma.Decimal | null;
  amount: Prisma.Decimal;
  drCr: BankReceiptDrCr;
  note: string | null;
}

interface ResolvedLine {
  rowNumber: number;
  partyId: string;
  partyName: string;
  partyLedger: LedgerAccount;
  instrumentId: string | null;
  bankNameCode: string | null;
  chequeNumber: string | null;
  description: string | null;
  amount: Prisma.Decimal;
  adjustmentMode: BankReceiptAdjustmentMode;
  allocations: ResolvedAllocation[];
  adjustments: ResolvedAdjustment[];
}

interface ResolvedHeader {
  book: BookWithLedger;
  voucherDate: Date;
  narration: string | null;
  remarks: string | null;
  lines: ResolvedLine[];
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: unknown, fieldLabel: string): Date {
  const text = String(value ?? '').trim();
  if (text === '') throw new MoneyInputError(`${fieldLabel} is required.`);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(parsed.getTime())) throw new MoneyInputError(`${fieldLabel} is not a valid date.`);
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0)
  );
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, maxLength);
}

function optionalPercent(
  value: unknown,
  field: string,
  errors: FieldError[]
): Prisma.Decimal | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    errors.push({ field, message: 'Percentage must be a number with at most 2 decimal places.' });
    return null;
  }
  return new Prisma.Decimal(text).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function optionalInt(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: Prisma.Decimal | null | undefined): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

function balanceView(value: Prisma.Decimal) {
  return signedBalance(value);
}

export class BankReceiptService {
  private async loadContext(companyId: string, financialYearId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, companyName: true, companyCode: true, isActive: true },
    });
    if (!company || !company.isActive) {
      throw new AppError(400, 'Active company context is invalid or the company is inactive.');
    }

    const financialYear = await prisma.financialYear.findFirst({
      where: { id: financialYearId, companyId },
      select: {
        id: true,
        yearName: true,
        startDate: true,
        endDate: true,
        isLocked: true,
        isActive: true,
      },
    });
    if (!financialYear || !financialYear.isActive) {
      throw new AppError(400, 'Active financial year context is invalid for the selected company.');
    }

    return { company, financialYear };
  }

  private formatVoucherNumber(prefix: string, financialYearStart: Date, sequence: number): string {
    const trimmed = (prefix ?? '').trim();
    const head = trimmed === '' ? '' : trimmed.endsWith('-') ? trimmed : `${trimmed}-`;
    return `${head}${financialYearStart.getUTCFullYear()}-${String(sequence).padStart(4, '0')}`;
  }

  private async ensurePartyLedger(
    tx: Prisma.TransactionClient,
    companyId: string,
    party: {
      id: string;
      partyName: string;
      partyCode: string;
      partyType: string;
      balanceType: 'DEBIT' | 'CREDIT';
    }
  ): Promise<LedgerAccount> {
    const existing = await tx.ledgerAccount.findFirst({
      where: { companyId, partyId: party.id },
    });
    if (existing) return existing;

    const isSupplier = party.partyType === 'SUPPLIER';
    const baseCode =
      `PL-${party.partyCode}`.toUpperCase().replace(/[^A-Z0-9\-_/]/g, '-').slice(0, 20) ||
      'PL-PARTY';

    let accountCode = baseCode;
    let suffix = 1;
    while (await tx.ledgerAccount.findFirst({ where: { companyId, accountCode } })) {
      const suffixText = `-${suffix}`;
      accountCode = `${baseCode.slice(0, 20 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    try {
      return await tx.ledgerAccount.create({
        data: {
          companyId,
          accountCode,
          accountName: party.partyName,
          accountGroup: isSupplier ? 'SUNDRY_CREDITORS' : 'SUNDRY_DEBTORS',
          accountType: isSupplier ? 'LIABILITY' : 'ASSET',
          balanceType: party.balanceType,
          openingBalance: new Prisma.Decimal(0),
          partyId: party.id,
          isAutoCreated: true,
          isBankAccount: false,
          description:
            'Auto-created ledger link for Party Master. Opening balance remains on the Party Master record.',
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await tx.ledgerAccount.findFirst({ where: { companyId, partyId: party.id } });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async bookView(companyId: string, financialYearId: string, book: BookWithLedger) {
    const balances = await repo.ledgerSignedBalances(companyId, financialYearId, [
      book.bankAccountLedgerId,
    ]);
    return {
      id: book.id,
      prefix: book.prefix,
      bookName: book.bookName,
      bankAccountLedgerId: book.bankAccountLedgerId,
      isActive: book.isActive,
      bankAccount: {
        id: book.bankAccountLedger.id,
        accountCode: book.bankAccountLedger.accountCode,
        accountName: book.bankAccountLedger.accountName,
        accountGroup: book.bankAccountLedger.accountGroup,
        bankName: book.bankAccountLedger.bankName,
        branchName: book.bankAccountLedger.branchName,
        bankAccountNumber: book.bankAccountLedger.bankAccountNumber,
        isActive: book.bankAccountLedger.isActive,
      },
      balance: balanceView(balances.get(book.bankAccountLedgerId) ?? new Prisma.Decimal(0)),
    };
  }

  async listBooks(companyId: string, financialYearId: string) {
    await this.loadContext(companyId, financialYearId);
    const books = await repo.listBooks(companyId, financialYearId);
    const balances = await repo.ledgerSignedBalances(
      companyId,
      financialYearId,
      books.map((book) => book.bankAccountLedgerId)
    );

    return books.map((book) => ({
      id: book.id,
      prefix: book.prefix,
      bookName: book.bookName,
      bankAccountLedgerId: book.bankAccountLedgerId,
      isActive: book.isActive,
      bankAccount: {
        id: book.bankAccountLedger.id,
        accountCode: book.bankAccountLedger.accountCode,
        accountName: book.bankAccountLedger.accountName,
        accountGroup: book.bankAccountLedger.accountGroup,
        bankName: book.bankAccountLedger.bankName,
        branchName: book.bankAccountLedger.branchName,
        bankAccountNumber: book.bankAccountLedger.bankAccountNumber,
        isActive: book.bankAccountLedger.isActive,
      },
      balance: balanceView(balances.get(book.bankAccountLedgerId) ?? new Prisma.Decimal(0)),
    }));
  }

  async getBook(companyId: string, financialYearId: string, id: string) {
    await this.loadContext(companyId, financialYearId);
    const book = await repo.findBook(companyId, financialYearId, id);
    if (!book) {
      notFoundError('Bank receipt book not found for the active company and financial year.');
    }
    return this.bookView(companyId, financialYearId, book as BookWithLedger);
  }

  async createBook(companyId: string, financialYearId: string, payload: ReceiptBookPayload) {
    await this.loadContext(companyId, financialYearId);
    const errors: FieldError[] = [];

    const bookName = cleanText(payload.bookName, 60);
    if (!bookName) errors.push({ field: 'bookName', message: 'Book name is required.' });

    const prefix = cleanText(payload.prefix, 10) ?? '';
    if (!PREFIX_PATTERN.test(prefix)) {
      errors.push({
        field: 'prefix',
        message: 'Prefix may contain up to 10 letters, numbers, hyphen or slash.',
      });
    }

    let bankLedger: LedgerAccount | null = null;
    if (!payload.bankAccountLedgerId) {
      errors.push({ field: 'bankAccountLedgerId', message: 'A linked bank ledger is required.' });
    } else {
      const ledger = await prisma.ledgerAccount.findFirst({
        where: { id: payload.bankAccountLedgerId, companyId },
      });
      if (!ledger) {
        errors.push({
          field: 'bankAccountLedgerId',
          message: 'Selected bank ledger does not belong to the active company.',
        });
      } else if (!ledger.isBankAccount || ledger.accountGroup !== 'BANK') {
        errors.push({
          field: 'bankAccountLedgerId',
          message: `${ledger.accountCode} - ${ledger.accountName} is not a bank ledger account.`,
        });
      } else if (!ledger.isActive) {
        errors.push({ field: 'bankAccountLedgerId', message: 'Selected bank ledger is inactive.' });
      } else {
        bankLedger = ledger;
      }
    }

    if (errors.length === 0 && bookName) {
      const duplicateName = await repo.findBookByName(companyId, financialYearId, bookName);
      if (duplicateName) {
        errors.push({
          field: 'bookName',
          message: `Book name ${bookName} already exists for this company and financial year.`,
        });
      }
      const duplicatePrefix = await repo.findBookByPrefix(companyId, financialYearId, prefix);
      if (duplicatePrefix) {
        errors.push({
          field: 'prefix',
          message: `Prefix ${prefix || '(blank)'} is already used by another receipt book in this financial year.`,
        });
      }
    }

    if (errors.length > 0) validationError(errors);

    const book = await repo.createBook({
      companyId,
      financialYearId,
      prefix,
      bookName: bookName as string,
      bankAccountLedgerId: (bankLedger as LedgerAccount).id,
      isActive: payload.isActive !== false,
    });

    return this.bookView(companyId, financialYearId, book);
  }

  async updateBook(
    companyId: string,
    financialYearId: string,
    id: string,
    payload: ReceiptBookPayload
  ) {
    await this.loadContext(companyId, financialYearId);
    const existing = await repo.findBook(companyId, financialYearId, id);
    if (!existing) {
      notFoundError('Bank receipt book not found for the active company and financial year.');
    }
    const current = existing as BookWithLedger;

    const errors: FieldError[] = [];
    const bookName =
      payload.bookName === undefined ? current.bookName : cleanText(payload.bookName, 60);
    if (!bookName) errors.push({ field: 'bookName', message: 'Book name is required.' });

    const prefix =
      payload.prefix === undefined ? current.prefix : cleanText(payload.prefix, 10) ?? '';
    if (!PREFIX_PATTERN.test(prefix)) {
      errors.push({
        field: 'prefix',
        message: 'Prefix may contain up to 10 letters, numbers, hyphen or slash.',
      });
    }

    let bankLedgerId = current.bankAccountLedgerId;
    if (payload.bankAccountLedgerId && payload.bankAccountLedgerId !== current.bankAccountLedgerId) {
      const ledger = await prisma.ledgerAccount.findFirst({
        where: { id: payload.bankAccountLedgerId, companyId },
      });
      if (!ledger || !ledger.isBankAccount || ledger.accountGroup !== 'BANK' || !ledger.isActive) {
        errors.push({
          field: 'bankAccountLedgerId',
          message: 'Selected bank ledger must be an active bank account of the active company.',
        });
      } else {
        bankLedgerId = ledger.id;
      }
    }

    if (errors.length === 0 && bookName) {
      const duplicateName = await repo.findBookByName(companyId, financialYearId, bookName, id);
      if (duplicateName) {
        errors.push({ field: 'bookName', message: `Book name ${bookName} already exists.` });
      }
      const duplicatePrefix = await repo.findBookByPrefix(companyId, financialYearId, prefix, id);
      if (duplicatePrefix) {
        errors.push({
          field: 'prefix',
          message: `Prefix ${prefix || '(blank)'} is already used by another receipt book.`,
        });
      }
    }

    if (errors.length > 0) validationError(errors);

    const updated = await repo.updateBook(id, {
      bookName: bookName as string,
      prefix,
      bankAccountLedgerId: bankLedgerId,
      isActive: payload.isActive === undefined ? current.isActive : payload.isActive !== false,
    });

    return this.bookView(companyId, financialYearId, updated);
  }

  async listInstruments(companyId: string, query: Record<string, unknown>) {
    const search = typeof query.search === 'string' ? query.search : undefined;
    const includeInactive = query.includeInactive === 'true';
    const rows = await repo.listInstruments(companyId, search, includeInactive);
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      isActive: row.isActive,
    }));
  }

  async createInstrument(companyId: string, payload: InstrumentPayload) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new AppError(400, 'Active company context is invalid.');

    const errors: FieldError[] = [];
    const code = cleanText(payload.code, 20);
    const description = cleanText(payload.description, 100);
    if (!code) errors.push({ field: 'code', message: 'Instrument code is required.' });
    else if (!/^[A-Za-z0-9][A-Za-z0-9\-/ ]{0,19}$/.test(code)) {
      errors.push({
        field: 'code',
        message: 'Code must be 1-20 letters, numbers, spaces, hyphen or slash.',
      });
    }
    if (!description) errors.push({ field: 'description', message: 'Description is required.' });

    if (errors.length === 0 && code) {
      const duplicate = await repo.findInstrumentByCode(companyId, code);
      if (duplicate) {
        errors.push({ field: 'code', message: `Instrument code ${code} already exists.` });
      }
    }
    if (errors.length > 0) validationError(errors);

    const created = await repo.createInstrument({
      companyId,
      code: code as string,
      description: description as string,
      isActive: payload.isActive !== false,
    });
    return {
      id: created.id,
      code: created.code,
      description: created.description,
      isActive: created.isActive,
    };
  }
  async lookupParties(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    await this.loadContext(companyId, financialYearId);
    const search = typeof query.search === 'string' ? query.search : '';
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit ?? '30'), 10) || 30));

    const parties = await repo.searchParties(companyId, search, limit);
    const ledgerMap = await repo.partyLedgerMap(
      companyId,
      parties.map((party) => party.id)
    );
    const balances = await repo.ledgerSignedBalances(
      companyId,
      financialYearId,
      Array.from(ledgerMap.values())
    );

    return parties.map((party) => {
      const ledgerId = ledgerMap.get(party.id) ?? null;
      const balance = ledgerId
        ? balances.get(ledgerId) ?? new Prisma.Decimal(0)
        : new Prisma.Decimal(0);
      return {
        id: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyType: party.partyType,
        gstin: party.gstin,
        panNumber: party.panNumber,
        address: party.address,
        city: party.city,
        state: party.state,
        phone: party.phone,
        partyGroupName: party.partyGroup?.groupName ?? null,
        ledgerAccountId: ledgerId,
        // The current schema stores no broker/salesperson/collection/person on
        // Party. They are returned as null instead of being fabricated.
        brokerName: null as string | null,
        salespersonName: null as string | null,
        collectionName: null as string | null,
        personName: null as string | null,
        balance: balanceView(balance),
      };
    });
  }

  async lookupAdjustmentAccounts(companyId: string, query: Record<string, unknown>) {
    const search = typeof query.search === 'string' ? query.search : '';
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(query.limit ?? '30'), 10) || 30));
    const rows = await repo.searchAdjustmentAccounts(companyId, search, limit);

    return rows.map((row) => ({
      id: row.id,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountGroup: row.accountGroup,
      partyName: row.party?.partyName ?? null,
      address: row.party?.address ?? null,
      balance: balanceView(signedOpening(row.openingBalance, row.balanceType)),
    }));
  }

  private async buildOutstandingRows(
    client: Prisma.TransactionClient | PrismaClient,
    companyId: string,
    partyId: string,
    excludeVoucherId?: string,
    search?: string
  ) {
    const bills = await repo.purchaseBillsForParty(companyId, partyId, search);
    const billIds = bills.map((bill) => bill.id);

    const [allocated, reductions] = await Promise.all([
      repo.allocationTotals(client, companyId, billIds, excludeVoucherId),
      repo.adjustmentReductionTotals(client, companyId, billIds, excludeVoucherId),
    ]);

    const rows = bills.map((bill) => {
      const billAmount = bill.totalAmount;
      const billTds = new Prisma.Decimal(0);
      // PreRec = previous active allocations + net posted adjustment reduction.
      const previousReceived = (allocated.get(bill.id) ?? new Prisma.Decimal(0)).plus(
        reductions.get(bill.id) ?? new Prisma.Decimal(0)
      );
      const balance = billAmount.minus(billTds).minus(previousReceived);
      return {
        id: bill.id,
        sourceDocumentType: 'PURCHASE_BILL',
        typeCode: 'PUR',
        bookName: bill.book?.bookName ?? null,
        billNumber: bill.billNumber,
        billDate: toDateKey(bill.billDate),
        dueValue: null as number | null,
        billAmount: money(billAmount),
        billTds: money(billTds),
        previousReceived: money(previousReceived),
        currentReceived: '0.00',
        balance: money(balance),
        jvRequired: false,
        items: bill.items.map((item) => ({
          itemName: item.itemDescription,
          quantity: item.quantity.toFixed(3),
          unit: item.unit,
        })),
        balanceValue: balance,
      };
    });

    // A bill settled to exactly zero is no longer allocatable. Over-received
    // bills keep their genuine negative balance (for example -24.00) so the
    // popup can show the real figure instead of silently hiding the bill.
    return rows
      .filter((row) => !row.balanceValue.isZero())
      .map(({ balanceValue, ...row }) => row);
  }

  async outstandingBills(companyId: string, financialYearId: string, query: Record<string, unknown>) {
    await this.loadContext(companyId, financialYearId);
    const partyId = typeof query.partyId === 'string' ? query.partyId : '';
    if (!partyId) {
      validationError([
        { field: 'partyId', message: 'A party is required to load outstanding bills.' },
      ]);
    }
    const party = await repo.findParty(companyId, partyId);
    if (!party || !party.isActive) {
      validationError([{ field: 'partyId', message: 'Selected party is invalid or inactive.' }]);
    }
    const search = typeof query.search === 'string' ? query.search : undefined;
    const excludeVoucherId =
      typeof query.excludeVoucherId === 'string' && query.excludeVoucherId !== ''
        ? query.excludeVoucherId
        : undefined;

    const rows = await this.buildOutstandingRows(
      prisma,
      companyId,
      partyId,
      excludeVoucherId,
      search
    );

    return {
      party: {
        id: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        address: party.address,
        city: party.city,
        state: party.state,
        gstin: party.gstin,
        phone: party.phone,
      },
      bills: rows,
      totals: {
        billAmount: money(
          rows.reduce((sum, row) => sum.plus(row.billAmount), new Prisma.Decimal(0))
        ),
        billTds: money(rows.reduce((sum, row) => sum.plus(row.billTds), new Prisma.Decimal(0))),
        previousReceived: money(
          rows.reduce((sum, row) => sum.plus(row.previousReceived), new Prisma.Decimal(0))
        ),
        currentReceived: '0.00',
        balance: money(rows.reduce((sum, row) => sum.plus(row.balance), new Prisma.Decimal(0))),
      },
    };
  }

  async validateAllocation(
    companyId: string,
    financialYearId: string,
    body: Record<string, unknown>
  ) {
    await this.loadContext(companyId, financialYearId);
    const partyId = String(body.partyId ?? '');
    const allocations = Array.isArray(body.allocations) ? body.allocations : [];
    const excludeVoucherId =
      typeof body.excludeVoucherId === 'string' && body.excludeVoucherId !== ''
        ? body.excludeVoucherId
        : undefined;

    if (!partyId) {
      validationError([{ field: 'partyId', message: 'A party is required.' }]);
    }

    let receiptAmount = new Prisma.Decimal(0);
    try {
      receiptAmount = parsePositiveMoney(body.receiptAmount, 'Receipt amount');
    } catch (error) {
      validationError([
        {
          field: 'receiptAmount',
          message: error instanceof Error ? error.message : 'Receipt amount is invalid.',
        },
      ]);
    }

    const errors: FieldError[] = [];
    const requested = new Map<string, Prisma.Decimal>();
    for (const item of allocations as Array<Record<string, unknown>>) {
      const billId = String(item.purchaseBillId ?? '');
      if (!billId) continue;
      try {
        const amount = parsePositiveMoney(item.allocatedAmount, 'Allocation amount');
        requested.set(billId, (requested.get(billId) ?? new Prisma.Decimal(0)).plus(amount));
      } catch (error) {
        errors.push({
          field: 'allocations',
          message: error instanceof Error ? error.message : 'Allocation amount is invalid.',
        });
      }
    }
    if (errors.length > 0) validationError(errors);

    const requestedTotal = Array.from(requested.values()).reduce(
      (sum, value) => sum.plus(value),
      new Prisma.Decimal(0)
    );
    if (requestedTotal.gt(receiptAmount)) {
      validationError([
        {
          field: 'allocations',
          message: `Total allocation ${money(requestedTotal)} exceeds the receipt amount ${money(receiptAmount)}.`,
        },
      ]);
    }

    const rows = await this.buildOutstandingRows(
      prisma,
      companyId,
      partyId,
      excludeVoucherId
    );
    const byId = new Map(rows.map((row) => [row.id, row]));

    const validated = [];
    for (const [billId, amount] of requested.entries()) {
      const row = byId.get(billId);
      if (!row) {
        errors.push({
          field: 'allocations',
          message: 'Selected bill is not an outstanding bill of this party.',
        });
        continue;
      }
      const balance = new Prisma.Decimal(row.balance);
      if (amount.gt(balance)) {
        errors.push({
          field: 'allocations',
          message: `Bill ${row.billNumber} only has ${money(balance)} outstanding, but ${money(amount)} was allocated.`,
        });
        continue;
      }
      validated.push({
        purchaseBillId: billId,
        billNumber: row.billNumber,
        allocatedAmount: money(amount),
        balanceAfter: money(balance.minus(amount)),
      });
    }
    if (errors.length > 0) validationError(errors);

    return {
      allocations: validated,
      allocatedTotal: money(requestedTotal),
      chequeBalance: money(receiptAmount.minus(requestedTotal)),
    };
  }

  private async resolveAdjustmentAccount(
    companyId: string,
    accountId: string,
    errors: FieldError[]
  ): Promise<LedgerAccount | null> {
    if (!accountId) {
      errors.push({
        field: 'adjustmentLedgerAccountId',
        message: 'An adjustment account is required.',
      });
      return null;
    }
    const account = await repo.findAdjustmentAccount(companyId, accountId);
    if (!account) {
      errors.push({
        field: 'adjustmentLedgerAccountId',
        message: 'Selected adjustment account does not belong to the active company.',
      });
      return null;
    }
    if (!account.isActive) {
      errors.push({
        field: 'adjustmentLedgerAccountId',
        message: 'Selected adjustment account is inactive.',
      });
      return null;
    }
    if (account.isBankAccount || account.accountGroup === 'BANK') {
      errors.push({
        field: 'adjustmentLedgerAccountId',
        message: 'A bank account cannot be used as an adjustment head.',
      });
      return null;
    }
    if (
      account.accountGroup === 'SUNDRY_DEBTORS' ||
      account.accountGroup === 'SUNDRY_CREDITORS' ||
      account.accountGroup === 'CAPITAL' ||
      account.accountGroup === 'ASSETS' ||
      account.accountGroup === 'LIABILITIES'
    ) {
      errors.push({
        field: 'adjustmentLedgerAccountId',
        message: `${account.accountCode} - ${account.accountName} is not an eligible adjustment head.`,
      });
      return null;
    }
    return account;
  }

  private buildAdjustmentPreview(
    adjustment: { amount: Prisma.Decimal; drCr: BankReceiptDrCr; account: LedgerAccount },
    partyLedgerName: string
  ) {
    const lines =
      adjustment.drCr === 'DR'
        ? [
            {
              accountName: adjustment.account.accountName,
              accountCode: adjustment.account.accountCode,
              drCr: 'DR' as const,
              amount: money(adjustment.amount),
            },
            {
              accountName: partyLedgerName,
              accountCode: '',
              drCr: 'CR' as const,
              amount: money(adjustment.amount),
            },
          ]
        : [
            {
              accountName: adjustment.account.accountName,
              accountCode: adjustment.account.accountCode,
              drCr: 'CR' as const,
              amount: money(adjustment.amount),
            },
            {
              accountName: partyLedgerName,
              accountCode: '',
              drCr: 'DR' as const,
              amount: money(adjustment.amount),
            },
          ];

    return {
      lines,
      totalDebit: money(adjustment.amount),
      totalCredit: money(adjustment.amount),
      balanced: true,
      partyEffect:
        adjustment.drCr === 'DR'
          ? { drCr: 'CR' as const, amount: money(adjustment.amount) }
          : { drCr: 'DR' as const, amount: money(adjustment.amount) },
    };
  }

  private async resolveAdjustmentForPreview(
    companyId: string,
    body: Record<string, unknown>
  ): Promise<{ amount: Prisma.Decimal; drCr: BankReceiptDrCr; account: LedgerAccount }> {
    const errors: FieldError[] = [];
    const account = await this.resolveAdjustmentAccount(
      companyId,
      String(body.adjustmentLedgerAccountId ?? ''),
      errors
    );

    let amount = new Prisma.Decimal(0);
    try {
      amount = parsePositiveMoney(body.adjustmentAmount, 'Adjustment amount');
    } catch (error) {
      errors.push({
        field: 'adjustmentAmount',
        message: error instanceof Error ? error.message : 'Adjustment amount is invalid.',
      });
    }

    const drCr = String(body.drCr ?? '').toUpperCase();
    if (drCr !== 'DR' && drCr !== 'CR') {
      errors.push({ field: 'drCr', message: 'Select whether the adjustment is Debit or Credit.' });
    }

    const calculationType = String(body.calculationType ?? 'AMT').toUpperCase();
    if (!CALCULATION_TYPES.includes(calculationType as BankReceiptCalculationType)) {
      errors.push({ field: 'calculationType', message: 'Unsupported calculation type.' });
    }

    if (errors.length > 0) validationError(errors);

    return {
      amount,
      drCr: drCr as BankReceiptDrCr,
      account: account as LedgerAccount,
    };
  }

  async adjustmentPreview(
    companyId: string,
    financialYearId: string,
    body: Record<string, unknown>
  ) {
    await this.loadContext(companyId, financialYearId);
    const resolved = await this.resolveAdjustmentForPreview(companyId, body);
    const partyName = cleanText(body.partyName, 120) ?? 'Party Ledger';
    return this.buildAdjustmentPreview(resolved, partyName);
  }

  async validateAdjustment(
    companyId: string,
    financialYearId: string,
    body: Record<string, unknown>
  ) {
    await this.loadContext(companyId, financialYearId);
    const resolved = await this.resolveAdjustmentForPreview(companyId, body);
    const partyName = cleanText(body.partyName, 120) ?? 'Party Ledger';
    const preview = this.buildAdjustmentPreview(resolved, partyName);

    const totalDebit = new Prisma.Decimal(preview.totalDebit);
    const totalCredit = new Prisma.Decimal(preview.totalCredit);
    if (!totalDebit.equals(totalCredit)) {
      validationError([{ field: 'adjustment', message: 'Journal adjustment does not balance.' }]);
    }
    return preview;
  }
  private async resolvePayload(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    context: {
      financialYear: { yearName: string; startDate: Date; endDate: Date; isLocked: boolean };
    },
    payload: ReceiptPayload,
    excludeVoucherId?: string
  ): Promise<ResolvedHeader> {
    const errors: FieldError[] = [];

    const book = payload.bookId
      ? await repo.findBook(companyId, financialYearId, payload.bookId)
      : null;
    if (!book) {
      errors.push({ field: 'bookId', message: 'A valid Bank Receipt Book is required.' });
    } else if (!book.isActive) {
      errors.push({ field: 'bookId', message: 'The selected Bank Receipt Book is inactive.' });
    } else if (!book.bankAccountLedger.isActive || !book.bankAccountLedger.isBankAccount) {
      errors.push({
        field: 'bookId',
        message: 'The bank ledger linked to this book is inactive or is not a bank account.',
      });
    }

    let voucherDate: Date | null = null;
    try {
      voucherDate = parseDateInput(payload.voucherDate, 'Voucher date');
    } catch (error) {
      errors.push({
        field: 'voucherDate',
        message: error instanceof Error ? error.message : 'Voucher date is required.',
      });
    }
    if (voucherDate) {
      const key = toDateKey(voucherDate);
      if (
        key < toDateKey(context.financialYear.startDate) ||
        key > toDateKey(context.financialYear.endDate)
      ) {
        errors.push({
          field: 'voucherDate',
          message: `Voucher date must fall inside financial year ${context.financialYear.yearName}.`,
        });
      }
    }
    if (context.financialYear.isLocked) {
      errors.push({
        field: 'financialYear',
        message: `Financial year ${context.financialYear.yearName} is locked. Posting and editing are blocked.`,
      });
    }

    const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
    if (rawLines.length === 0) {
      errors.push({ field: 'lines', message: 'At least one receipt row is required.' });
    }
    if (rawLines.length > MAX_LINES) {
      errors.push({
        field: 'lines',
        message: `A voucher cannot contain more than ${MAX_LINES} rows.`,
      });
    }

    const lines: ResolvedLine[] = [];

    for (let index = 0; index < rawLines.length; index += 1) {
      const raw = rawLines[index] ?? {};
      const rowNumber = index + 1;
      const label = `Row ${rowNumber}`;

      const hasAnyValue =
        (raw.partyId && String(raw.partyId).trim() !== '') ||
        (raw.amount !== null && raw.amount !== undefined && String(raw.amount).trim() !== '') ||
        (raw.chequeNumber && String(raw.chequeNumber).trim() !== '');
      if (!hasAnyValue) continue; // empty grid rows are never persisted

      if (!raw.partyId) {
        errors.push({
          field: `lines.${index}.partyId`,
          message: `${label}: select a party account.`,
        });
        continue;
      }

      const party = await repo.findParty(companyId, raw.partyId);
      if (!party) {
        errors.push({
          field: `lines.${index}.partyId`,
          message: `${label}: selected party does not belong to the active company.`,
        });
        continue;
      }
      if (!party.isActive) {
        errors.push({
          field: `lines.${index}.partyId`,
          message: `${label}: selected party is inactive.`,
        });
        continue;
      }

      const partyLedger = await this.ensurePartyLedger(tx, companyId, {
        id: party.id,
        partyName: party.partyName,
        partyCode: party.partyCode,
        partyType: party.partyType,
        balanceType: party.balanceType,
      });

      let amount = new Prisma.Decimal(0);
      try {
        amount = parsePositiveMoney(raw.amount, `${label} amount`);
      } catch (error) {
        errors.push({
          field: `lines.${index}.amount`,
          message: `${label}: ${error instanceof Error ? error.message : 'amount is invalid.'}`,
        });
      }

      let instrument: { id: string; code: string } | null = null;
      const instrumentId = raw.bankInstrumentId ? String(raw.bankInstrumentId) : '';
      if (instrumentId) {
        const found = await repo.findInstrument(companyId, instrumentId);
        if (!found) {
          errors.push({
            field: `lines.${index}.bankInstrumentId`,
            message: `${label}: selected Bank Name code does not belong to the active company.`,
          });
        } else if (!found.isActive) {
          errors.push({
            field: `lines.${index}.bankInstrumentId`,
            message: `${label}: selected Bank Name code is inactive.`,
          });
        } else {
          instrument = { id: found.id, code: found.code };
        }
      } else if (raw.bankNameCode) {
        const found = await repo.findInstrumentByCode(companyId, String(raw.bankNameCode));
        if (!found || !found.isActive) {
          errors.push({
            field: `lines.${index}.bankInstrumentId`,
            message: `${label}: Bank Name code ${raw.bankNameCode} does not exist or is inactive.`,
          });
        } else {
          instrument = { id: found.id, code: found.code };
        }
      } else {
        errors.push({
          field: `lines.${index}.bankInstrumentId`,
          message: `${label}: select a Bank Name code.`,
        });
      }

      const chequeNumber = cleanText(raw.chequeNumber, 20);
      if (chequeNumber && !CHEQUE_PATTERN.test(chequeNumber)) {
        errors.push({
          field: `lines.${index}.chequeNumber`,
          message: `${label}: cheque/reference must be 1-20 letters, numbers, hyphen or slash.`,
        });
      }

      const modeText = String(raw.adjustmentMode ?? 'NO_ADJUSTMENT').toUpperCase();
      if (!ADJUSTMENT_MODES.includes(modeText as BankReceiptAdjustmentMode)) {
        errors.push({
          field: `lines.${index}.adjustmentMode`,
          message: `${label}: select a valid adjustment option.`,
        });
      }
      const adjustmentMode = modeText as BankReceiptAdjustmentMode;

      const description = cleanText(raw.description, 250);
      const allocations: ResolvedAllocation[] = [];
      const adjustments: ResolvedAdjustment[] = [];

      if (adjustmentMode === 'AGAINST_BILL') {
        const rawAllocations = Array.isArray(raw.allocations) ? raw.allocations : [];
        const requested = new Map<string, Prisma.Decimal>();
        for (const item of rawAllocations) {
          const billId = String(item.purchaseBillId ?? '');
          if (!billId) continue;
          try {
            const value = parsePositiveMoney(item.allocatedAmount, `${label} allocation`);
            requested.set(billId, (requested.get(billId) ?? new Prisma.Decimal(0)).plus(value));
          } catch (error) {
            errors.push({
              field: `lines.${index}.allocations`,
              message: `${label}: ${error instanceof Error ? error.message : 'allocation is invalid.'}`,
            });
          }
        }

        if (requested.size === 0) {
          errors.push({
            field: `lines.${index}.allocations`,
            message: `${label}: Against Bill requires at least one bill allocation.`,
          });
        }

        const requestedTotal = Array.from(requested.values()).reduce(
          (sum, value) => sum.plus(value),
          new Prisma.Decimal(0)
        );
        if (amount.gt(0) && requestedTotal.gt(amount)) {
          errors.push({
            field: `lines.${index}.allocations`,
            message: `${label}: allocation ${money(requestedTotal)} exceeds the receipt amount ${money(amount)}.`,
          });
        }

        if (requested.size > 0 && amount.gt(0)) {
          const outstanding = await this.buildOutstandingRows(
            tx,
            companyId,
            party.id,
            excludeVoucherId
          );
          const byId = new Map(outstanding.map((row) => [row.id, row]));
          for (const [billId, value] of requested.entries()) {
            const row = byId.get(billId);
            if (!row) {
              errors.push({
                field: `lines.${index}.allocations`,
                message: `${label}: bill is not an outstanding confirmed bill of this party.`,
              });
              continue;
            }
            const balance = new Prisma.Decimal(row.balance);
            if (value.gt(balance)) {
              errors.push({
                field: `lines.${index}.allocations`,
                message: `${label}: bill ${row.billNumber} only has ${money(balance)} outstanding.`,
              });
              continue;
            }
            allocations.push({
              purchaseBillId: billId,
              billNumber: row.billNumber,
              billDate: new Date(`${row.billDate}T00:00:00.000Z`),
              billAmount: new Prisma.Decimal(row.billAmount),
              billTds: new Prisma.Decimal(row.billTds),
              previousReceived: new Prisma.Decimal(row.previousReceived),
              allocatedAmount: value,
              balanceAfter: balance.minus(value),
              dueValue: row.dueValue,
            });
          }
        }

        const rawAdjustments = Array.isArray(raw.adjustments) ? raw.adjustments : [];
        for (const item of rawAdjustments) {
          const account = await this.resolveAdjustmentAccount(
            companyId,
            String(item.adjustmentLedgerAccountId ?? ''),
            errors
          );
          let value = new Prisma.Decimal(0);
          try {
            value = parsePositiveMoney(item.adjustmentAmount, `${label} adjustment`);
          } catch (error) {
            errors.push({
              field: `lines.${index}.adjustments`,
              message: `${label}: ${error instanceof Error ? error.message : 'adjustment is invalid.'}`,
            });
          }
          const drCr = String(item.drCr ?? '').toUpperCase();
          if (drCr !== 'DR' && drCr !== 'CR') {
            errors.push({
              field: `lines.${index}.adjustments`,
              message: `${label}: adjustment must be Debit or Credit.`,
            });
          }
          const calculationType = String(item.calculationType ?? 'AMT').toUpperCase();
          if (!CALCULATION_TYPES.includes(calculationType as BankReceiptCalculationType)) {
            errors.push({
              field: `lines.${index}.adjustments`,
              message: `${label}: unsupported adjustment calculation type.`,
            });
          }
          const purchaseBillId = item.purchaseBillId ? String(item.purchaseBillId) : null;
          if (purchaseBillId && !allocations.some((row) => row.purchaseBillId === purchaseBillId)) {
            errors.push({
              field: `lines.${index}.adjustments`,
              message: `${label}: the journal adjustment must reference a bill allocated in this row.`,
            });
          }
          if (account && value.gt(0) && (drCr === 'DR' || drCr === 'CR')) {
            adjustments.push({
              purchaseBillId,
              account,
              calculationType: calculationType as BankReceiptCalculationType,
              interestPercent: optionalPercent(
                item.interestPercent,
                `lines.${index}.adjustments`,
                errors
              ),
              dueValue: optionalInt(item.dueValue),
              tdsPercent: optionalPercent(item.tdsPercent, `lines.${index}.adjustments`, errors),
              amount: value,
              drCr: drCr as BankReceiptDrCr,
              note: cleanText(item.note, 250),
            });
          }
        }

        if (allocations.length > 0 && adjustments.length > 0) {
          const netAdjustmentByBill = new Map<string, Prisma.Decimal>();
          for (const adjustment of adjustments) {
            if (!adjustment.purchaseBillId) continue;
            const delta =
              adjustment.drCr === 'DR' ? adjustment.amount : adjustment.amount.negated();
            netAdjustmentByBill.set(
              adjustment.purchaseBillId,
              (netAdjustmentByBill.get(adjustment.purchaseBillId) ?? new Prisma.Decimal(0)).plus(
                delta
              )
            );
          }
          for (const allocation of allocations) {
            const net = netAdjustmentByBill.get(allocation.purchaseBillId) ?? new Prisma.Decimal(0);
            const settlement = allocation.allocatedAmount.plus(net);
            const billBalance = allocation.billAmount
              .minus(allocation.billTds)
              .minus(allocation.previousReceived);
            if (settlement.gt(billBalance)) {
              errors.push({
                field: `lines.${index}.allocations`,
                message: `${label}: bill ${allocation.billNumber} would be settled by ${money(
                  settlement
                )} against an outstanding balance of ${money(billBalance)}.`,
              });
            }
          }
        }

        const netCredit = amount          .plus(
            adjustments
              .filter((row) => row.drCr === 'DR')
              .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
          )
          .minus(
            adjustments
              .filter((row) => row.drCr === 'CR')
              .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
          );
        if (netCredit.lte(0)) {
          errors.push({
            field: `lines.${index}.adjustments`,
            message: `${label}: adjustments would leave a zero or negative party credit.`,
          });
        }
      } else if (Array.isArray(raw.allocations) && raw.allocations.length > 0) {
        errors.push({
          field: `lines.${index}.allocations`,
          message: `${label}: bill allocations are only allowed with Against Bill.`,
        });
      } else if (Array.isArray(raw.adjustments) && raw.adjustments.length > 0) {
        errors.push({
          field: `lines.${index}.adjustments`,
          message: `${label}: journal adjustments are only allowed with Against Bill.`,
        });
      }

      lines.push({
        rowNumber,
        partyId: party.id,
        partyName: party.partyName,
        partyLedger,
        instrumentId: instrument?.id ?? null,
        bankNameCode: instrument?.code ?? null,
        chequeNumber,
        description,
        amount,
        adjustmentMode,
        allocations,
        adjustments,
      });
    }

    if (lines.length === 0 && rawLines.length > 0) {
      errors.push({ field: 'lines', message: 'At least one complete receipt row is required.' });
    }

    if (errors.length > 0) validationError(errors);

    return {
      book: book as BookWithLedger,
      voucherDate: voucherDate as Date,
      narration: cleanText(payload.narration, 500),
      remarks: cleanText(payload.remarks, 500),
      lines,
    };
  }
  private buildJournalLines(
    resolved: ResolvedHeader,
    companyId: string,
    financialYearId: string,
    voucherId: string,
    revision: number,
    startLineNumber: number
  ): Prisma.JournalLineCreateManyInput[] {
    const postingDate = resolved.voucherDate;
    const lines: Prisma.JournalLineCreateManyInput[] = [];
    let lineNumber = startLineNumber;

    const bankTotal = resolved.lines.reduce(
      (sum, line) => sum.plus(line.amount),
      new Prisma.Decimal(0)
    );
    const baseNarration = resolved.narration ?? 'Bank receipt';

    lines.push({
      companyId,
      financialYearId,
      voucherId,
      ledgerAccountId: resolved.book.bankAccountLedgerId,
      revision,
      lineNumber: lineNumber++,
      debitAmount: bankTotal,
      creditAmount: new Prisma.Decimal(0),
      isReversal: false,
      postingDate,
      narration: baseNarration,
    });

    for (const line of resolved.lines) {
      const drAdjustments = line.adjustments
        .filter((row) => row.drCr === 'DR')
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const crAdjustments = line.adjustments
        .filter((row) => row.drCr === 'CR')
        .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0));
      const partyCredit = line.amount.plus(drAdjustments).minus(crAdjustments);

      lines.push({
        companyId,
        financialYearId,
        voucherId,
        ledgerAccountId: line.partyLedger.id,
        revision,
        lineNumber: lineNumber++,
        debitAmount: new Prisma.Decimal(0),
        creditAmount: partyCredit,
        isReversal: false,
        postingDate,
        narration: line.description ?? `Bank receipt from ${line.partyName}`,
      });

      for (const adjustment of line.adjustments) {
        lines.push({
          companyId,
          financialYearId,
          voucherId,
          ledgerAccountId: adjustment.account.id,
          revision,
          lineNumber: lineNumber++,
          debitAmount:
            adjustment.drCr === 'DR' ? adjustment.amount : new Prisma.Decimal(0),
          creditAmount:
            adjustment.drCr === 'CR' ? adjustment.amount : new Prisma.Decimal(0),
          isReversal: false,
          postingDate,
          narration:
            adjustment.note ?? `Journal adjustment ${adjustment.account.accountName}`,
        });
      }
    }

    return lines;
  }

  private async persistLines(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialYearId: string,
    voucherId: string,
    revision: number,
    resolved: ResolvedHeader
  ) {
    for (const line of resolved.lines) {
      const createdLine = await repo.createLine(tx, {
        companyId,
        financialYearId,
        bankVoucherId: voucherId,
        rowNumber: line.rowNumber,
        revision,
        partyId: line.partyId,
        partyLedgerAccountId: line.partyLedger.id,
        bankInstrumentId: line.instrumentId,
        bankNameCode: line.bankNameCode,
        chequeNumber: line.chequeNumber,
        description: line.description,
        amount: line.amount,
        adjustmentMode: line.adjustmentMode,
      });

      for (const allocation of line.allocations) {
        const createdAllocation = await repo.createAllocation(tx, {
          companyId,
          financialYearId,
          bankVoucherLineId: createdLine.id,
          purchaseBillId: allocation.purchaseBillId,
          sourceDocumentType: 'PURCHASE_BILL',
          sourceDocumentNumber: allocation.billNumber,
          billDate: allocation.billDate,
          dueValue: allocation.dueValue,
          billAmount: allocation.billAmount,
          billTds: allocation.billTds,
          previousReceived: allocation.previousReceived,
          allocatedAmount: allocation.allocatedAmount,
          balanceAfter: allocation.balanceAfter,
          status: 'ACTIVE',
          revision,
        });

        for (const adjustment of line.adjustments.filter(
          (row) => row.purchaseBillId === allocation.purchaseBillId
        )) {
          await repo.createAdjustment(tx, {
            companyId,
            financialYearId,
            bankVoucherLineId: createdLine.id,
            allocationId: createdAllocation.id,
            adjustmentLedgerAccountId: adjustment.account.id,
            calculationType: adjustment.calculationType,
            interestPercent: adjustment.interestPercent,
            dueValue: adjustment.dueValue,
            tdsPercent: adjustment.tdsPercent,
            adjustmentAmount: adjustment.amount,
            drCr: adjustment.drCr,
            note: adjustment.note,
            status: 'ACTIVE',
            revision,
          });
        }
      }

      // Row-level adjustments that are not tied to a single bill.
      for (const adjustment of line.adjustments.filter((row) => row.purchaseBillId === null)) {
        await repo.createAdjustment(tx, {
          companyId,
          financialYearId,
          bankVoucherLineId: createdLine.id,
          allocationId: null,
          adjustmentLedgerAccountId: adjustment.account.id,
          calculationType: adjustment.calculationType,
          interestPercent: adjustment.interestPercent,
          dueValue: adjustment.dueValue,
          tdsPercent: adjustment.tdsPercent,
          adjustmentAmount: adjustment.amount,
          drCr: adjustment.drCr,
          note: adjustment.note,
          status: 'ACTIVE',
          revision,
        });
      }
    }
  }

  private async lockAllocatedBills(tx: Prisma.TransactionClient, resolved: ResolvedHeader) {
    const ids = Array.from(
      new Set(
        resolved.lines.flatMap((line) => line.allocations.map((row) => row.purchaseBillId))
      )
    );
    await repo.lockPurchaseBills(tx, ids);
  }

  private async revalidateAllocations(
    tx: Prisma.TransactionClient,
    companyId: string,
    resolved: ResolvedHeader,
    excludeVoucherId?: string
  ) {
    for (const line of resolved.lines) {
      if (line.allocations.length === 0) continue;
      const outstanding = await this.buildOutstandingRows(
        tx,
        companyId,
        line.partyId,
        excludeVoucherId
      );
      const byId = new Map(outstanding.map((row) => [row.id, row]));
      const errors: FieldError[] = [];
      for (const allocation of line.allocations) {
        const row = byId.get(allocation.purchaseBillId);
        if (!row) {
          errors.push({
            field: 'allocations',
            message: `Bill ${allocation.billNumber} is no longer outstanding.`,
          });
          continue;
        }
        const balance = new Prisma.Decimal(row.balance);
        if (allocation.allocatedAmount.gt(balance)) {
          errors.push({
            field: 'allocations',
            message: `Bill ${allocation.billNumber} now only has ${money(balance)} outstanding.`,
          });
        }
      }
      if (errors.length > 0) validationError(errors);
    }
  }

  async create(companyId: string, financialYearId: string, payload: ReceiptPayload) {
    const context = await this.loadContext(companyId, financialYearId);

    const voucherId = await prisma.$transaction(async (tx) => {
      const resolved = await this.resolvePayload(
        tx,
        companyId,
        financialYearId,
        context,
        payload
      );
      await this.lockAllocatedBills(tx, resolved);
      // Revalidate under row locks so two concurrent receipts cannot
      // over-allocate the same bill.
      await this.revalidateAllocations(tx, companyId, resolved);

      const sequence = await repo.nextSequence(tx, companyId, financialYearId);
      const voucherNumber = this.formatVoucherNumber(
        resolved.book.prefix,
        context.financialYear.startDate,
        sequence
      );

      const total = resolved.lines.reduce(
        (sum, line) => sum.plus(line.amount),
        new Prisma.Decimal(0)
      );
      const firstLine = resolved.lines[0];

      const created = await tx.bankVoucher.create({
        data: {
          companyId,
          financialYearId,
          voucherType: 'RECEIPT',
          voucherNumber,
          voucherDate: resolved.voucherDate,
          partyId: firstLine.partyId,
          counterpartyLedgerId: firstLine.partyLedger.id,
          bankAccountLedgerId: resolved.book.bankAccountLedgerId,
          bankReceiptBookId: resolved.book.id,
          paymentMode: 'CHEQUE',
          amount: total,
          referenceNumber: null,
          chequeNumber: firstLine.chequeNumber,
          chequeDate: resolved.voucherDate,
          bankName: resolved.book.bankAccountLedger.bankName,
          branchName: resolved.book.bankAccountLedger.branchName,
          narration: resolved.narration,
          remarks: resolved.remarks,
          status: 'POSTED',
          revision: 1,
        },
        select: { id: true },
      });

      await this.persistLines(tx, companyId, financialYearId, created.id, 1, resolved);

      const journalLines = this.buildJournalLines(
        resolved,
        companyId,
        financialYearId,
        created.id,
        1,
        1
      );
      await repo.insertJournalLines(tx, journalLines);

      const totals = await repo.voucherTotals(tx, created.id);
      if (!totals.debit.equals(totals.credit)) {
        throw new AppError(
          500,
          'Receipt posting failed the debit/credit balance check.',
          undefined,
          'UNBALANCED_POSTING'
        );
      }

      return created.id;
    });

    return { id: voucherId };
  }

  async update(companyId: string, financialYearId: string, id: string, payload: ReceiptPayload) {
    const context = await this.loadContext(companyId, financialYearId);
    if (context.financialYear.isLocked) {
      throw new AppError(
        409,
        `Financial year ${context.financialYear.yearName} is locked. Editing is blocked.`
      );
    }

    await prisma.$transaction(async (tx) => {
      try {
        await repo.lockVoucher(tx, companyId, financialYearId, id);
      } catch {
        notFoundError('Receipt voucher not found for the active company and financial year.');
      }

      const existing = await repo.findVoucherHeader(tx, companyId, financialYearId, id);
      if (!existing) {
        notFoundError('Receipt voucher not found for the active company and financial year.');
      }
      const header = existing as NonNullable<typeof existing>;
      if (header.status === 'CANCELLED') {
        conflictError('A cancelled voucher cannot be edited.');
      }

      const resolved = await this.resolvePayload(
        tx,
        companyId,
        financialYearId,
        context,
        payload,
        id
      );
      await this.lockAllocatedBills(tx, resolved);
      await this.revalidateAllocations(tx, companyId, resolved, id);

      const nextRevision = header.revision + 1;
      const startLine = (await repo.maxLineNumber(tx, id)) + 1;

      // Retire the previous revision's allocation view, keeping audit history.
      await repo.reverseActiveAllocations(tx, id, `Superseded by revision ${nextRevision}`);

      const existingNet = await repo.netByLedger(tx, id);
      const reversalLines: Prisma.JournalLineCreateManyInput[] = existingNet
        .filter((entry) => !entry.debit.isZero() || !entry.credit.isZero())
        .map((entry, index) => ({
          companyId,
          financialYearId,
          voucherId: id,
          ledgerAccountId: entry.ledgerAccountId,
          revision: nextRevision,
          lineNumber: startLine + index,
          debitAmount: entry.credit,
          creditAmount: entry.debit,
          isReversal: true,
          postingDate: resolved.voucherDate,
          narration: `Reversal of revision ${header.revision} before edit`,
        }));

      const correctedLines = this.buildJournalLines(
        resolved,
        companyId,
        financialYearId,
        id,
        nextRevision,
        startLine + reversalLines.length
      );
      await repo.insertJournalLines(tx, [...reversalLines, ...correctedLines]);

      await this.persistLines(tx, companyId, financialYearId, id, nextRevision, resolved);

      const total = resolved.lines.reduce(
        (sum, line) => sum.plus(line.amount),
        new Prisma.Decimal(0)
      );
      const firstLine = resolved.lines[0];

      await tx.bankVoucher.update({
        where: { id },
        data: {
          voucherDate: resolved.voucherDate,
          partyId: firstLine.partyId,
          counterpartyLedgerId: firstLine.partyLedger.id,
          bankAccountLedgerId: resolved.book.bankAccountLedgerId,
          bankReceiptBookId: resolved.book.id,
          paymentMode: 'CHEQUE',
          amount: total,
          chequeNumber: firstLine.chequeNumber,
          chequeDate: resolved.voucherDate,
          bankName: resolved.book.bankAccountLedger.bankName,
          branchName: resolved.book.bankAccountLedger.branchName,
          narration: resolved.narration,
          remarks: resolved.remarks,
          revision: nextRevision,
        },
      });

      const totals = await repo.voucherTotals(tx, id);
      if (!totals.debit.equals(totals.credit)) {
        throw new AppError(
          500,
          'Edited receipt failed the debit/credit balance check.',
          undefined,
          'UNBALANCED_POSTING'
        );
      }
    });

    return { id };
  }

  async neighbours(companyId: string, financialYearId: string, id: string) {
    await this.loadContext(companyId, financialYearId);
    const voucher = await prisma.bankVoucher.findFirst({
      where: { id, companyId, financialYearId, voucherType: 'RECEIPT' },
      select: {
        id: true,
        voucherDate: true,
        voucherNumber: true,
        bankReceiptBookId: true,
      },
    });
    if (!voucher) {
      notFoundError('Receipt voucher not found for the active company and financial year.');
    }
    const header = voucher as NonNullable<typeof voucher>;
    const bookId = header.bankReceiptBookId ?? '';
    if (!bookId) return { previous: null, next: null };

    const result = await repo.neighbours(
      companyId,
      financialYearId,
      bookId,
      header.voucherDate,
      header.voucherNumber
    );
    return {
      previous: result.previous
        ? { id: result.previous.id, voucherNumber: result.previous.voucherNumber }
        : null,
      next: result.next
        ? { id: result.next.id, voucherNumber: result.next.voucherNumber }
        : null,
    };
  }

  async getNextNumber(companyId: string, financialYearId: string, bookId: string) {
    const context = await this.loadContext(companyId, financialYearId);
    const book = await repo.findBook(companyId, financialYearId, bookId);
    if (!book) {
      notFoundError('Bank receipt book not found for the active company and financial year.');
    }
    const resolvedBook = book as BookWithLedger;

    const sequence = await prisma.voucherSequence.findUnique({
      where: {
        companyId_financialYearId_voucherType: {
          companyId,
          financialYearId,
          voucherType: 'RECEIPT',
        },
      },
    });

    return {
      voucherNumber: this.formatVoucherNumber(
        resolvedBook.prefix,
        context.financialYear.startDate,
        (sequence?.lastNumber ?? 0) + 1
      ),
      bookId: resolvedBook.id,
      bookName: resolvedBook.bookName,
    };
  }
}