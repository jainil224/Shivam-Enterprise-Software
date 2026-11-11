// Phase 15.1 - persistent, company-scoped report column layouts.
// Additive only: no existing table or record is touched.

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReportColumnLayoutRow {
  id: string;
  companyId: string;
  reportType: string;
  layoutName: string;
  selectedColumns: Prisma.JsonValue;
  columnOrder: Prisma.JsonValue;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportColumnLayoutCreateData {
  companyId: string;
  reportType: string;
  layoutName: string;
  selectedColumns: string[];
  columnOrder: string[];
  isDefault: boolean;
  createdBy: string | null;
}

export interface ReportColumnLayoutUpdateData {
  layoutName?: string;
  selectedColumns?: string[];
  columnOrder?: string[];
  isDefault?: boolean;
}

function jsonColumns(columns: string[]): Prisma.InputJsonValue {
  return columns as unknown as Prisma.InputJsonValue;
}

export const reportLayoutRepository = {
  async list(companyId: string, reportType: string): Promise<ReportColumnLayoutRow[]> {
    return prisma.reportColumnLayout.findMany({
      where: { companyId, reportType },
      orderBy: [{ isDefault: 'desc' }, { layoutName: 'asc' }],
    });
  },

  async findById(companyId: string, reportType: string, id: string): Promise<ReportColumnLayoutRow | null> {
    return prisma.reportColumnLayout.findFirst({ where: { id, companyId, reportType } });
  },

  async findByName(
    companyId: string,
    reportType: string,
    layoutName: string,
    excludeId?: string
  ): Promise<ReportColumnLayoutRow | null> {
    return prisma.reportColumnLayout.findFirst({
      where: {
        companyId,
        reportType,
        layoutName: { equals: layoutName, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  async create(data: ReportColumnLayoutCreateData): Promise<ReportColumnLayoutRow> {
    return prisma.reportColumnLayout.create({
      data: {
        companyId: data.companyId,
        reportType: data.reportType,
        layoutName: data.layoutName,
        selectedColumns: jsonColumns(data.selectedColumns),
        columnOrder: jsonColumns(data.columnOrder),
        isDefault: data.isDefault,
        createdBy: data.createdBy,
      },
    });
  },

  async update(id: string, data: ReportColumnLayoutUpdateData): Promise<ReportColumnLayoutRow> {
    return prisma.reportColumnLayout.update({
      where: { id },
      data: {
        ...(data.layoutName !== undefined ? { layoutName: data.layoutName } : {}),
        ...(data.selectedColumns !== undefined ? { selectedColumns: jsonColumns(data.selectedColumns) } : {}),
        ...(data.columnOrder !== undefined ? { columnOrder: jsonColumns(data.columnOrder) } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });
  },

  async remove(id: string): Promise<void> {
    await prisma.reportColumnLayout.delete({ where: { id } });
  },

  async setDefault(companyId: string, reportType: string, id: string): Promise<ReportColumnLayoutRow> {
    return prisma.$transaction(async (tx) => {
      await tx.reportColumnLayout.updateMany({
        where: { companyId, reportType, isDefault: true },
        data: { isDefault: false },
      });
      return tx.reportColumnLayout.update({ where: { id }, data: { isDefault: true } });
    });
  },

  async clearDefault(companyId: string, reportType: string, exceptId?: string): Promise<void> {
    await prisma.reportColumnLayout.updateMany({
      where: { companyId, reportType, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  },
};
