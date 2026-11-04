import { financialYearRepository } from '../repositories/financialYearRepository.js';
import { companyRepository } from '../repositories/companyRepository.js';
import { validateFinancialYearInput } from '../utils/validators.js';

export class FinancialYearService {
  async getByCompanyId(companyId: string) {
    const company = await companyRepository.findById(companyId);
    if (!company) {
      const err = new Error('Company not found.');
      (err as any).statusCode = 404;
      throw err;
    }
    return financialYearRepository.findByCompanyId(companyId);
  }

  async getById(id: string) {
    const fy = await financialYearRepository.findById(id);
    if (!fy) {
      const err = new Error('Financial Year not found.');
      (err as any).statusCode = 404;
      throw err;
    }
    return fy;
  }

  async create(companyId: string, data: {
    yearName: string;
    startDate: string | Date;
    endDate: string | Date;
    isActive?: boolean;
    isLocked?: boolean;
  }) {
    const company = await companyRepository.findById(companyId);
    if (!company) {
      const err = new Error('Company not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const validationErrors = validateFinancialYearInput(data);
    if (validationErrors.length > 0) {
      const err = new Error(validationErrors[0].message);
      (err as any).statusCode = 400;
      (err as any).errors = validationErrors;
      throw err;
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Check duplicate yearName
    const existingName = await financialYearRepository.findByName(companyId, data.yearName);
    if (existingName) {
      const err = new Error(`Financial Year '${data.yearName.trim()}' already exists for this company.`);
      (err as any).statusCode = 409;
      (err as any).errors = [{ field: 'yearName', message: 'Financial Year name must be unique per company.' }];
      throw err;
    }

    // Check overlap at service level (in addition to database trigger)
    const overlapping = await financialYearRepository.checkDateOverlap(companyId, startDate, endDate);
    if (overlapping) {
      const err = new Error(`Financial year dates overlap with existing year '${overlapping.yearName}' (${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)}).`);
      (err as any).statusCode = 409;
      (err as any).errors = [{ field: 'startDate', message: 'Date range overlaps with an existing financial year.' }];
      throw err;
    }

    try {
      return await financialYearRepository.create(companyId, {
        yearName: data.yearName,
        startDate,
        endDate,
        isActive: data.isActive ?? true,
        isLocked: data.isLocked ?? false,
      });
    } catch (e: any) {
      // Catch native trigger error if it fired
      if (e.message && e.message.includes('overlaps with an existing financial year')) {
        const err = new Error('Database integrity check: Financial year dates overlap with an existing period.');
        (err as any).statusCode = 409;
        throw err;
      }
      throw e;
    }
  }

  async update(id: string, data: {
    yearName?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    isActive?: boolean;
    isLocked?: boolean;
  }) {
    const existing = await financialYearRepository.findById(id);
    if (!existing) {
      const err = new Error('Financial Year not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (existing.isLocked) {
      const err = new Error('Cannot modify a locked financial year. Please unlock it first.');
      (err as any).statusCode = 400;
      throw err;
    }

    const yearName = data.yearName ?? existing.yearName;
    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;

    const validationErrors = validateFinancialYearInput({ yearName, startDate, endDate });
    if (validationErrors.length > 0) {
      const err = new Error(validationErrors[0].message);
      (err as any).statusCode = 400;
      (err as any).errors = validationErrors;
      throw err;
    }

    // Check duplicate name if changed
    if (data.yearName && data.yearName.trim() !== existing.yearName) {
      const duplicate = await financialYearRepository.findByName(existing.companyId, data.yearName);
      if (duplicate && duplicate.id !== id) {
        const err = new Error(`Financial Year '${data.yearName.trim()}' already exists for this company.`);
        (err as any).statusCode = 409;
        throw err;
      }
    }

    // Check overlap if dates changed
    if (data.startDate || data.endDate) {
      const overlapping = await financialYearRepository.checkDateOverlap(existing.companyId, startDate, endDate, id);
      if (overlapping) {
        const err = new Error(`Dates overlap with existing financial year '${overlapping.yearName}'.`);
        (err as any).statusCode = 409;
        throw err;
      }
    }

    return financialYearRepository.update(id, {
      yearName,
      startDate,
      endDate,
      isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
      isLocked: data.isLocked !== undefined ? data.isLocked : existing.isLocked,
    });
  }

  async setLock(id: string, isLocked: boolean) {
    const existing = await financialYearRepository.findById(id);
    if (!existing) {
      const err = new Error('Financial Year not found.');
      (err as any).statusCode = 404;
      throw err;
    }
    return financialYearRepository.setLockStatus(id, isLocked);
  }
}

export const financialYearService = new FinancialYearService();

