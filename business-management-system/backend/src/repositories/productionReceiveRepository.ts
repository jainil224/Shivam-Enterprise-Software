import { PrismaClient, ProductionReceive, ProductionReceiveItem, Prisma } from '@prisma/client';
import { CalculatedCartonWeight, GridTotals } from '../utils/weightCalculations.js';

const prisma = new PrismaClient();

export interface CreateProductionReceiveInput {
  companyId: string;
  financialYearId: string;
  productionBookId: string;
  challanNumber: string;
  challanDate: Date;
  partyId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  lotNumber?: string | null;
  twist?: string | null;
  emptyCopsWeight: Prisma.Decimal;
  locationId?: string | null;
  remarks?: string | null;
  items: CalculatedCartonWeight[];
}

export interface UpdateProductionReceiveInput {
  challanNumber?: string;
  challanDate?: Date;
  partyId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  lotNumber?: string | null;
  twist?: string | null;
  emptyCopsWeight?: Prisma.Decimal;
  locationId?: string | null;
  remarks?: string | null;
  items: CalculatedCartonWeight[];
}

export interface ListProductionReceivesQueryOptions {
  bookId?: string;
  search?: string;
  challanNumber?: string;
  partyId?: string;
  machineId?: string;
  lotNumber?: string;
  fromDate?: Date;
  toDate?: Date;
  status?: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export class ProductionReceiveRepository {
  /**
   * Validate company, financial year, and production book context.
   */
  async validateContext(companyId: string, financialYearId: string, productionBookId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      const err: any = new Error('Company not found.');
      err.statusCode = 404;
      throw err;
    }
    if (!company.isActive) {
      const err: any = new Error('Active company is deactivated.');
      err.statusCode = 400;
      throw err;
    }

    const fy = await prisma.financialYear.findUnique({
      where: { id: financialYearId },
    });
    if (!fy || fy.companyId !== companyId) {
      const err: any = new Error('Financial year does not belong to active company.');
      err.statusCode = 400;
      throw err;
    }
    if (!fy.isActive) {
      const err: any = new Error('Selected financial year is inactive.');
      err.statusCode = 400;
      throw err;
    }
    if (fy.isLocked) {
      const err: any = new Error(`Financial year '${fy.yearName}' is locked for entries.`);
      err.statusCode = 403;
      throw err;
    }

    const book = await prisma.productionBook.findUnique({
      where: { id: productionBookId },
    });
    if (!book || book.companyId !== companyId || book.financialYearId !== financialYearId) {
      const err: any = new Error('Production book does not belong to active company and financial year.');
      err.statusCode = 400;
      throw err;
    }
    if (!book.isActive) {
      const err: any = new Error(`Production book '${book.bookName}' is inactive.`);
      err.statusCode = 400;
      throw err;
    }

    return { company, financialYear: fy, productionBook: book };
  }

  /**
   * Calculate next challan number and next carton suggestion.
   */
  async getNextNumbers(companyId: string, financialYearId: string, productionBookId: string) {
    // 1. Next Challan Number for this book
    const existingChallans = await prisma.productionReceive.findMany({
      where: {
        companyId,
        financialYearId,
        productionBookId,
      },
      select: { challanNumber: true },
    });

    let maxChallanNum = 1000;
    for (const c of existingChallans) {
      const n = parseInt(c.challanNumber.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxChallanNum) {
        maxChallanNum = n;
      }
    }
    const nextChallanNumber = (maxChallanNum + 1).toString();

    // 2. Next Carton Number suggestion (New No.)
    const existingItems = await prisma.productionReceiveItem.findMany({
      where: {
        productionReceive: {
          companyId,
          financialYearId,
          productionBookId,
        },
      },
      select: { cartonNumber: true },
    });

    let maxCartonNum = 0;
    for (const item of existingItems) {
      const n = parseInt(item.cartonNumber.replace(/\D/g, ''), 10);
      if (!isNaN(n) && n > maxCartonNum) {
        maxCartonNum = n;
      }
    }
    const nextCartonNumber = (maxCartonNum + 1).toString();

    return { nextChallanNumber, nextCartonNumber };
  }

  /**
   * Atomic Prisma transaction to save challan header and all child items.
   */
  async create(data: CreateProductionReceiveInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify unique challanNumber within (companyId, financialYearId, productionBookId)
      const existing = await tx.productionReceive.findUnique({
        where: {
          companyId_financialYearId_productionBookId_challanNumber: {
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            productionBookId: data.productionBookId,
            challanNumber: data.challanNumber.trim(),
          },
        },
      });

      if (existing) {
        const err: any = new Error(
          `Challan number '${data.challanNumber}' already exists in this production book.`
        );
        err.statusCode = 409;
        throw err;
      }

      // 2. Create header
      const header = await tx.productionReceive.create({
        data: {
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          productionBookId: data.productionBookId,
          challanNumber: data.challanNumber.trim(),
          challanDate: data.challanDate,
          partyId: data.partyId || null,
          machineId: data.machineId || null,
          operatorId: data.operatorId || null,
          yarnQualityId: data.yarnQualityId || null,
          yarnGradeId: data.yarnGradeId || null,
          lotNumber: data.lotNumber?.trim() || null,
          twist: data.twist?.trim() || null,
          emptyCopsWeight: data.emptyCopsWeight,
          locationId: data.locationId || null,
          remarks: data.remarks?.trim() || null,
          status: 'CONFIRMED',
        },
      });

      // 3. Create all items
      for (const item of data.items) {
        await tx.productionReceiveItem.create({
          data: {
            productionReceiveId: header.id,
            cartonNumber: item.cartonNumber,
            cartonWeight: item.cartonWeight,
            cops: item.cops,
            grossWeight: item.grossWeight,
            copsWeight: item.copsWeight,
            tareWeight: item.tareWeight,
            netWeight: item.netWeight,
            averageWeight: item.averageWeight,
            twist: item.twist,
            lotNumber: item.lotNumber,
            grade: item.grade,
          },
        });
      }

      // 4. Return full saved record
      return tx.productionReceive.findUnique({
        where: { id: header.id },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
          productionBook: true,
          party: true,
          machine: true,
          operator: true,
          yarnQuality: true,
          yarnGrade: true,
          location: true,
        },
      });
    });
  }

  /**
   * Find by ID with company isolation.
   */
  async findById(companyId: string, id: string) {
    return prisma.productionReceive.findFirst({
      where: {
        id,
        companyId,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        productionBook: true,
        party: true,
        machine: true,
        operator: true,
        yarnQuality: true,
        yarnGrade: true,
        location: true,
        financialYear: true,
      },
    });
  }

  async findExactByChallanNumber(
    companyId: string,
    financialYearId: string,
    productionBookId: string,
    challanNumber: string
  ) {
    const normalized = challanNumber.trim();
    if (!normalized) return null;

    return prisma.productionReceive.findFirst({
      where: {
        companyId,
        financialYearId,
        productionBookId,
        challanNumber: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        productionBook: true,
        party: true,
        machine: true,
        operator: true,
        yarnQuality: true,
        yarnGrade: true,
        location: true,
        financialYear: true,
      },
    });
  }

  /**
   * Update an existing production challan atomically.
   */
  async update(companyId: string, id: string, data: UpdateProductionReceiveInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify existence and company ownership
      const existing = await tx.productionReceive.findFirst({
        where: { id, companyId },
        include: { financialYear: true },
      });

      if (!existing) {
        const err: any = new Error('Production challan not found.');
        err.statusCode = 404;
        throw err;
      }

      if (existing.status === 'CANCELLED') {
        const err: any = new Error('Cannot edit a cancelled production challan.');
        err.statusCode = 400;
        throw err;
      }

      if (existing.financialYear?.isLocked) {
        const err: any = new Error(
          `Cannot edit challan in locked financial year '${existing.financialYear.yearName}'.`
        );
        err.statusCode = 403;
        throw err;
      }

      // 2. Check unique challanNumber if changed
      const targetChallanNum = data.challanNumber ? data.challanNumber.trim() : existing.challanNumber;
      if (targetChallanNum !== existing.challanNumber) {
        const duplicate = await tx.productionReceive.findUnique({
          where: {
            companyId_financialYearId_productionBookId_challanNumber: {
              companyId: existing.companyId,
              financialYearId: existing.financialYearId,
              productionBookId: existing.productionBookId,
              challanNumber: targetChallanNum,
            },
          },
        });
        if (duplicate && duplicate.id !== id) {
          const err: any = new Error(
            `Challan number '${targetChallanNum}' already exists in this production book.`
          );
          err.statusCode = 409;
          throw err;
        }
      }

      // 3. Update header fields using scalar IDs (UncheckedUpdateInput) to prevent Prisma nulling companyId on composite foreign keys
      const updateData: Prisma.ProductionReceiveUncheckedUpdateInput = {
        challanNumber: targetChallanNum,
        emptyCopsWeight: data.emptyCopsWeight ?? existing.emptyCopsWeight,
      };

      if (data.challanDate) updateData.challanDate = data.challanDate;
      if (data.partyId !== undefined) updateData.partyId = data.partyId || null;
      if (data.machineId !== undefined) updateData.machineId = data.machineId || null;
      if (data.operatorId !== undefined) updateData.operatorId = data.operatorId || null;
      if (data.yarnQualityId !== undefined) updateData.yarnQualityId = data.yarnQualityId || null;
      if (data.yarnGradeId !== undefined) updateData.yarnGradeId = data.yarnGradeId || null;
      if (data.locationId !== undefined) updateData.locationId = data.locationId || null;
      if (data.lotNumber !== undefined) updateData.lotNumber = data.lotNumber?.trim() || null;
      if (data.twist !== undefined) updateData.twist = data.twist?.trim() || null;
      if (data.remarks !== undefined) updateData.remarks = data.remarks?.trim() || null;

      await tx.productionReceive.update({
        where: { id },
        data: updateData,
      });

      // 4. Replace carton items safely within the transaction
      await tx.productionReceiveItem.deleteMany({
        where: { productionReceiveId: id },
      });

      for (const item of data.items) {
        await tx.productionReceiveItem.create({
          data: {
            productionReceiveId: id,
            cartonNumber: item.cartonNumber,
            cartonWeight: item.cartonWeight,
            cops: item.cops,
            grossWeight: item.grossWeight,
            copsWeight: item.copsWeight,
            tareWeight: item.tareWeight,
            netWeight: item.netWeight,
            averageWeight: item.averageWeight,
            twist: item.twist,
            lotNumber: item.lotNumber,
            grade: item.grade,
          },
        });
      }

      // 5. Return updated record with full relations
      return tx.productionReceive.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
          productionBook: true,
          party: true,
          machine: true,
          operator: true,
          yarnQuality: true,
          yarnGrade: true,
          location: true,
          financialYear: true,
        },
      });
    });
  }

  /**
   * Cancel an existing production challan with reason.
   */
  async cancel(companyId: string, id: string, cancellationReason: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.productionReceive.findFirst({
        where: { id, companyId },
        include: { financialYear: true },
      });

      if (!existing) {
        const err: any = new Error('Production challan not found.');
        err.statusCode = 404;
        throw err;
      }

      if (existing.status === 'CANCELLED') {
        const err: any = new Error('Challan is already cancelled.');
        err.statusCode = 400;
        throw err;
      }

      if (existing.financialYear?.isLocked) {
        const err: any = new Error(
          `Cannot cancel challan in locked financial year '${existing.financialYear.yearName}'.`
        );
        err.statusCode = 403;
        throw err;
      }

      return tx.productionReceive.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: cancellationReason.trim(),
          cancelledAt: new Date(),
        },
        include: {
          items: {
            orderBy: { createdAt: 'asc' },
          },
          productionBook: true,
          party: true,
          machine: true,
          operator: true,
          yarnQuality: true,
          yarnGrade: true,
          location: true,
          financialYear: true,
        },
      });
    });
  }

  /**
   * Get deterministic Prev and Next navigation IDs for a challan within its book.
   */
  async getNavigation(companyId: string, financialYearId: string, productionBookId: string, id: string) {
    const current = await prisma.productionReceive.findFirst({
      where: { id, companyId, financialYearId, productionBookId },
      select: { id: true, challanDate: true, challanNumber: true },
    });

    if (!current) {
      const err: any = new Error('Challan not found in specified context.');
      err.statusCode = 404;
      throw err;
    }

    // Fetch all records in deterministic order (challanDate asc, challanNumber asc, id asc)
    const allRecords = await prisma.productionReceive.findMany({
      where: {
        companyId,
        financialYearId,
        productionBookId,
      },
      select: { id: true },
      orderBy: [
        { challanDate: 'asc' },
        { challanNumber: 'asc' },
        { id: 'asc' },
      ],
    });

    const currentIndex = allRecords.findIndex((r) => r.id === id);
    const prevId = currentIndex > 0 ? allRecords[currentIndex - 1].id : null;
    const nextId = currentIndex >= 0 && currentIndex < allRecords.length - 1 ? allRecords[currentIndex + 1].id : null;

    return { prevId, nextId };
  }

  /**
   * List challans with search, filtering, and pagination.
   */
  async findAllPaginated(companyId: string, financialYearId: string, options?: ListProductionReceivesQueryOptions) {
    const where: Prisma.ProductionReceiveWhereInput = {
      companyId,
      financialYearId,
    };

    if (options?.bookId) {
      where.productionBookId = options.bookId;
    }

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.partyId) {
      where.partyId = options.partyId;
    }

    if (options?.machineId) {
      where.machineId = options.machineId;
    }

    if (options?.lotNumber) {
      where.lotNumber = { contains: options.lotNumber, mode: 'insensitive' };
    }

    if (options?.challanNumber) {
      where.challanNumber = { contains: options.challanNumber, mode: 'insensitive' };
    }

    if (options?.fromDate || options?.toDate) {
      where.challanDate = {};
      if (options.fromDate) where.challanDate.gte = options.fromDate;
      if (options.toDate) where.challanDate.lte = options.toDate;
    }

    if (options?.search) {
      const s = options.search.trim();
      where.OR = [
        { challanNumber: { contains: s, mode: 'insensitive' } },
        { lotNumber: { contains: s, mode: 'insensitive' } },
        { party: { partyName: { contains: s, mode: 'insensitive' } } },
        { party: { partyCode: { contains: s, mode: 'insensitive' } } },
        { machine: { machineCode: { contains: s, mode: 'insensitive' } } },
      ];
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(1, options?.limit || 15));
    const skip = (page - 1) * limit;

    const sortOrder = options?.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, records] = await Promise.all([
      prisma.productionReceive.count({ where }),
      prisma.productionReceive.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { challanDate: sortOrder },
          { challanNumber: sortOrder },
          { id: sortOrder },
        ],
        include: {
          productionBook: { select: { prefix: true, bookName: true } },
          party: { select: { partyCode: true, partyName: true } },
          yarnQuality: { select: { qualityName: true, denier: true } },
          yarnGrade: { select: { gradeName: true } },
          machine: { select: { machineCode: true } },
          operator: { select: { operatorName: true } },
          items: {
            select: {
              cops: true,
              grossWeight: true,
              netWeight: true,
            },
          },
          _count: { select: { items: true } },
        },
      }),
    ]);

    // Enhance records with calculated sums for register view
    const enrichedRecords = records.map((rec) => {
      let totalCops = 0;
      let totalGrossWeight = new Prisma.Decimal(0);
      let totalNetWeight = new Prisma.Decimal(0);

      for (const item of rec.items) {
        totalCops += item.cops;
        totalGrossWeight = totalGrossWeight.add(item.grossWeight);
        totalNetWeight = totalNetWeight.add(item.netWeight);
      }

      return {
        ...rec,
        totalCartons: rec._count.items,
        totalCops,
        totalGrossWeight: totalGrossWeight.toFixed(3),
        totalNetWeight: totalNetWeight.toFixed(3),
      };
    });

    return {
      data: enrichedRecords,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * List challans for company & FY (simple legacy list).
   */
  async findAll(companyId: string, financialYearId: string, options?: { bookId?: string }) {
    const where: Prisma.ProductionReceiveWhereInput = {
      companyId,
      financialYearId,
    };
    if (options?.bookId) {
      where.productionBookId = options.bookId;
    }

    return prisma.productionReceive.findMany({
      where,
      orderBy: { challanDate: 'desc' },
      include: {
        productionBook: { select: { prefix: true, bookName: true } },
        party: { select: { partyCode: true, partyName: true } },
        yarnQuality: { select: { qualityName: true, denier: true } },
        yarnGrade: { select: { gradeName: true } },
        machine: { select: { machineCode: true } },
        operator: { select: { operatorName: true } },
        _count: { select: { items: true } },
      },
    });
  }
}

export const productionReceiveRepository = new ProductionReceiveRepository();

