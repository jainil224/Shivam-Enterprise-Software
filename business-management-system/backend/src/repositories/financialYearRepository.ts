import { prisma } from '../utils/prisma.js';
import { FinancialYear, Prisma } from '@prisma/client';

export class FinancialYearRepository {
  async findByCompanyId(companyId: string): Promise<FinancialYear[]> {
    return prisma.financialYear.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findById(id: string): Promise<FinancialYear | null> {
    return prisma.financialYear.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });
  }

  async findByName(companyId: string, yearName: string): Promise<FinancialYear | null> {
    return prisma.financialYear.findUnique({
      where: {
        companyId_yearName: {
          companyId,
          yearName: yearName.trim(),
        },
      },
    });
  }

  async create(companyId: string, data: {
    yearName: string;
    startDate: Date;
    endDate: Date;
    isActive?: boolean;
    isLocked?: boolean;
  }): Promise<FinancialYear> {
    return prisma.financialYear.create({
      data: {
        companyId,
        yearName: data.yearName.trim(),
        startDate: data.startDate,
        endDate: data.endDate,
        isActive: data.isActive ?? true,
        isLocked: data.isLocked ?? false,
      },
    });
  }

  async update(id: string, data: Prisma.FinancialYearUpdateInput): Promise<FinancialYear> {
    return prisma.financialYear.update({
      where: { id },
      data,
    });
  }

  async setLockStatus(id: string, isLocked: boolean): Promise<FinancialYear> {
    return prisma.financialYear.update({
      where: { id },
      data: { isLocked },
    });
  }

  async checkDateOverlap(companyId: string, startDate: Date, endDate: Date, excludeId?: string): Promise<FinancialYear | null> {
    const where: Prisma.FinancialYearWhereInput = {
      companyId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    return prisma.financialYear.findFirst({ where });
  }
}

export const financialYearRepository = new FinancialYearRepository();

