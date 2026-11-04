import { companyRepository } from '../repositories/companyRepository.js';
import { financialYearRepository } from '../repositories/financialYearRepository.js';
import { validateCompanyInput } from '../utils/validators.js';

export class CompanyService {
  async getAllCompanies(search?: string, includeInactive = false) {
    return companyRepository.findAll(search, includeInactive);
  }

  async getCompanyById(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) {
      const err = new Error('Company not found.');
      (err as any).statusCode = 404;
      throw err;
    }
    return company;
  }

  async createCompany(data: {
    companyCode: string;
    companyName: string;
    gstin?: string | null;
    panNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    logoPath?: string | null;
  }) {
    const validationErrors = validateCompanyInput(data);
    if (validationErrors.length > 0) {
      const err = new Error(validationErrors[0].message);
      (err as any).statusCode = 400;
      (err as any).errors = validationErrors;
      throw err;
    }

    // Check unique companyCode
    const existing = await companyRepository.findByCode(data.companyCode);
    if (existing) {
      const err = new Error(`Company Code '${data.companyCode.trim().toUpperCase()}' is already in use.`);
      (err as any).statusCode = 409;
      (err as any).errors = [{ field: 'companyCode', message: 'Company Code must be unique.' }];
      throw err;
    }

    return companyRepository.create({
      companyCode: data.companyCode,
      companyName: data.companyName,
      gstin: data.gstin || null,
      panNumber: data.panNumber || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      logoPath: data.logoPath || null,
      isActive: true,
    });
  }

  async updateCompany(id: string, data: {
    companyCode?: string;
    companyName?: string;
    gstin?: string | null;
    panNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    logoPath?: string | null;
  }) {
    const existing = await companyRepository.findById(id);
    if (!existing) {
      const err = new Error('Company not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const validationErrors = validateCompanyInput({
      companyCode: data.companyCode ?? existing.companyCode,
      companyName: data.companyName ?? existing.companyName,
      gstin: data.gstin !== undefined ? data.gstin : existing.gstin,
      panNumber: data.panNumber !== undefined ? data.panNumber : existing.panNumber,
      email: data.email !== undefined ? data.email : existing.email,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      logoPath: data.logoPath !== undefined ? data.logoPath : existing.logoPath,
    });

    if (validationErrors.length > 0) {
      const err = new Error(validationErrors[0].message);
      (err as any).statusCode = 400;
      (err as any).errors = validationErrors;
      throw err;
    }

    // If companyCode changed, check uniqueness
    if (data.companyCode && data.companyCode.trim().toUpperCase() !== existing.companyCode) {
      const duplicateCode = await companyRepository.findByCode(data.companyCode);
      if (duplicateCode && duplicateCode.id !== id) {
        const err = new Error(`Company Code '${data.companyCode.trim().toUpperCase()}' is already taken.`);
        (err as any).statusCode = 409;
        (err as any).errors = [{ field: 'companyCode', message: 'Company Code must be unique.' }];
        throw err;
      }
    }

    return companyRepository.update(id, data);
  }

  async deactivateCompany(id: string) {
    const company = await companyRepository.findById(id);
    if (!company) {
      const err = new Error('Company not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    return companyRepository.deactivate(id);
  }

  async validateContext(companyId: string, financialYearId: string) {
    const company = await companyRepository.findById(companyId);
    if (!company || !company.isActive) {
      const err = new Error('Active company not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const fy = await financialYearRepository.findById(financialYearId);
    if (!fy || fy.companyId !== companyId) {
      const err = new Error('Financial year does not belong to the selected company.');
      (err as any).statusCode = 400;
      throw err;
    }

    return {
      isValid: true,
      company: {
        id: company.id,
        companyCode: company.companyCode,
        companyName: company.companyName,
        gstin: company.gstin,
        panNumber: company.panNumber,
        address: company.address,
        phone: company.phone,
        logoPath: company.logoPath,
      },
      financialYear: {
        id: fy.id,
        yearName: fy.yearName,
        startDate: fy.startDate,
        endDate: fy.endDate,
        isActive: fy.isActive,
        isLocked: fy.isLocked,
      },
    };
  }
}

export const companyService = new CompanyService();

