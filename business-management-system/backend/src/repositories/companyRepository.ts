import { prisma } from '../utils/prisma.js';
import { Company, Prisma } from '@prisma/client';

export class CompanyRepository {
  async findAll(search?: string, includeInactive = false): Promise<Company[]> {
    const where: Prisma.CompanyWhereInput = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { companyCode: { contains: q, mode: 'insensitive' } },
        { companyName: { contains: q, mode: 'insensitive' } },
        { gstin: { contains: q, mode: 'insensitive' } },
        { panNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    return prisma.company.findMany({
      where,
      include: {
        financialYears: {
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { companyName: 'asc' },
    });
  }

  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { id },
      include: {
        financialYears: {
          orderBy: { startDate: 'desc' },
        },
      },
    });
  }

  async findByCode(code: string): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { companyCode: code.trim().toUpperCase() },
    });
  }

  async create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return prisma.company.create({
      data: {
        ...data,
        companyCode: data.companyCode.trim().toUpperCase(),
        companyName: data.companyName.trim(),
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        panNumber: data.panNumber ? data.panNumber.trim().toUpperCase() : null,
      },
    });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    const updateData: Prisma.CompanyUpdateInput = { ...data };

    if (typeof data.companyCode === 'string') {
      updateData.companyCode = data.companyCode.trim().toUpperCase();
    }
    if (typeof data.companyName === 'string') {
      updateData.companyName = data.companyName.trim();
    }
    if (typeof data.gstin === 'string') {
      updateData.gstin = data.gstin.trim().toUpperCase();
    }
    if (typeof data.panNumber === 'string') {
      updateData.panNumber = data.panNumber.trim().toUpperCase();
    }

    return prisma.company.update({
      where: { id },
      data: updateData,
    });
  }

  async deactivate(id: string): Promise<Company> {
    return prisma.company.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async countDependencies(id: string): Promise<{ productionReceives: number; financialYears: number }> {
    const [productionReceives, financialYears] = await Promise.all([
      prisma.productionReceive.count({ where: { companyId: id } }),
      prisma.financialYear.count({ where: { companyId: id } }),
    ]);

    return { productionReceives, financialYears };
  }
}

export const companyRepository = new CompanyRepository();

