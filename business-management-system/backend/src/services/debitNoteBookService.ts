import { debitNoteBookRepository } from '../repositories/debitNoteBookRepository.js';
import { CompanyRepository } from '../repositories/companyRepository.js';
import { FinancialYearRepository } from '../repositories/financialYearRepository.js';

const companyRepo = new CompanyRepository();
const fyRepo = new FinancialYearRepository();

export class DebitNoteBookService {
  private async validateContext(companyId: string, financialYearId: string) {
    const company = await companyRepo.findById(companyId);
    if (!company || !company.isActive) {
      const err: any = new Error('Active company is required.');
      err.statusCode = 400;
      throw err;
    }

    const fy = await fyRepo.findById(financialYearId);
    if (!fy || !fy.isActive || fy.companyId !== companyId) {
      const err: any = new Error('Active financial year is required.');
      err.statusCode = 400;
      throw err;
    }

    return { company, fy };
  }

  async listBooks(
    companyId: string,
    financialYearId: string,
    options?: { includeInactive?: boolean }
  ) {
    await this.validateContext(companyId, financialYearId);

    // Ensure at least one default book exists for this FY
    await debitNoteBookRepository.ensureDefaultBook(companyId, financialYearId);

    const books = await debitNoteBookRepository.findAll(companyId, financialYearId, options);

    // Attach dynamic balance to each book
    const booksWithBalance = await Promise.all(
      books.map(async (book) => {
        const bal = await debitNoteBookRepository.getBookBalance(companyId, financialYearId, book.id);
        return {
          id: book.id,
          prefix: book.prefix,
          bookName: book.bookName,
          openingBalance: book.openingBalance.toString(),
          balance: bal.balance,
          balanceType: bal.balanceType,
          isActive: book.isActive,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
        };
      })
    );

    return booksWithBalance;
  }

  async getBookById(companyId: string, financialYearId: string, id: string) {
    await this.validateContext(companyId, financialYearId);

    const book = await debitNoteBookRepository.findById(companyId, financialYearId, id);
    if (!book) {
      const err: any = new Error('Debit Note Book not found.');
      err.statusCode = 404;
      throw err;
    }

    const bal = await debitNoteBookRepository.getBookBalance(companyId, financialYearId, book.id);
    return {
      id: book.id,
      prefix: book.prefix,
      bookName: book.bookName,
      openingBalance: book.openingBalance.toString(),
      balance: bal.balance,
      balanceType: bal.balanceType,
      isActive: book.isActive,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
    };
  }

  async createBook(
    companyId: string,
    financialYearId: string,
    data: {
      prefix: string;
      bookName: string;
      openingBalance?: number | string;
      balanceType?: 'DEBIT' | 'CREDIT';
      isActive?: boolean;
    }
  ) {
    const { fy } = await this.validateContext(companyId, financialYearId);
    if (fy.isLocked) {
      const err: any = new Error('Cannot create book in a locked financial year.');
      err.statusCode = 400;
      throw err;
    }

    if (!data.prefix || !data.prefix.trim()) {
      const err: any = new Error('Book prefix is required (e.g. DN-).');
      err.statusCode = 400;
      throw err;
    }

    if (!data.bookName || !data.bookName.trim()) {
      const err: any = new Error('Book name is required.');
      err.statusCode = 400;
      throw err;
    }

    const existingPrefix = await debitNoteBookRepository.findByPrefix(
      companyId,
      financialYearId,
      data.prefix
    );
    if (existingPrefix) {
      const err: any = new Error(`Debit Note Book with prefix '${data.prefix}' already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const existingName = await debitNoteBookRepository.findByName(
      companyId,
      financialYearId,
      data.bookName
    );
    if (existingName) {
      const err: any = new Error(`Debit Note Book with name '${data.bookName}' already exists.`);
      err.statusCode = 409;
      throw err;
    }

    return debitNoteBookRepository.create(companyId, financialYearId, data);
  }
}

export const debitNoteBookService = new DebitNoteBookService();
