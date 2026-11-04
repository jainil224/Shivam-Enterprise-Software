import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreatePurchaseBillItemInput {
  itemDescription: string;
  hsnCode?: string | null;
  quantity: number | Prisma.Decimal;
  unit?: string;
  rate: number | Prisma.Decimal;
  discount?: number | Prisma.Decimal;
  taxableAmount: number | Prisma.Decimal;
  cartonNumber?: string | null;
  lotNumber?: string | null;
  grade?: string | null;
  cops?: number | null;
}

export interface CreatePurchaseBillInput {
  companyId: string;
  financialYearId: string;
  billNumber?: string;
  billDate: Date;
  sourceChallanId?: string | null;
  partyId?: string | null;
  supplierGstin?: string | null;
  supplierLegalName: string;
  supplierTradeName?: string | null;
  supplierAddress?: string | null;
  supplierState?: string | null;
  supplierStateCode?: string | null;
  supplierPincode?: string | null;
  supplierCity?: string | null;
  verificationSource?: string;
  verificationTimestamp?: Date | null;
  isVerifiedSupplier?: boolean;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: Date | null;
  placeOfSupply?: string | null;
  totalQuantity: number | Prisma.Decimal;
  taxableAmount: number | Prisma.Decimal;
  cgstRate?: number | Prisma.Decimal;
  cgstAmount?: number | Prisma.Decimal;
  sgstRate?: number | Prisma.Decimal;
  sgstAmount?: number | Prisma.Decimal;
  igstRate?: number | Prisma.Decimal;
  igstAmount?: number | Prisma.Decimal;
  roundOff?: number | Prisma.Decimal;
  totalAmount: number | Prisma.Decimal;
  remarks?: string | null;
  items: CreatePurchaseBillItemInput[];
}

export class PurchaseBillRepository {
  /**
   * Compute next bill number in format PB-2026-0001
   */
  async getNextBillNumber(companyId: string, financialYearId: string): Promise<string> {
    const fy = await prisma.financialYear.findUnique({
      where: { companyId_id: { companyId, id: financialYearId } },
    });

    const yearPrefix = fy ? fy.yearName.replace(/[^0-9]/g, '').slice(0, 4) : new Date().getFullYear().toString();
    const prefix = `PB-${yearPrefix}-`;

    const count = await prisma.purchaseBill.count({
      where: {
        companyId,
        financialYearId,
      },
    });

    const nextSeq = (count + 1).toString().padStart(4, '0');
    return `${prefix}${nextSeq}`;
  }

  /**
   * Find by source challan ID in active company
   */
  async findByChallanId(companyId: string, sourceChallanId: string) {
    return prisma.purchaseBill.findFirst({
      where: {
        companyId,
        sourceChallanId,
      },
      include: {
        items: true,
      },
    });
  }

  /**
   * Find by bill ID in active company
   */
  async findById(companyId: string, id: string) {
    return prisma.purchaseBill.findFirst({
      where: {
        companyId,
        id,
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
        sourceChallan: {
          include: {
            items: true,
            productionBook: true,
            party: true,
            yarnQuality: true,
            yarnGrade: true,
          },
        },
        party: true,
        financialYear: true,
        company: true,
      },
    });
  }

  /**
   * Create purchase bill atomically
   */
  async create(data: CreatePurchaseBillInput) {
    return prisma.$transaction(async (tx) => {
      // 1. If sourceChallanId provided, verify it does not already have a bill
      if (data.sourceChallanId) {
        const existing = await tx.purchaseBill.findFirst({
          where: {
            companyId: data.companyId,
            sourceChallanId: data.sourceChallanId,
          },
        });

        if (existing) {
          const err: any = new Error(
            `Purchase Bill '${existing.billNumber}' has already been created for this challan.`
          );
          err.statusCode = 409;
          err.existingBill = existing;
          throw err;
        }
      }

      // 2. Generate billNumber if not explicitly supplied
      let billNumber = data.billNumber?.trim();
      if (!billNumber) {
        const fy = await tx.financialYear.findUnique({
          where: { companyId_id: { companyId: data.companyId, id: data.financialYearId } },
        });
        const yearPrefix = fy ? fy.yearName.replace(/[^0-9]/g, '').slice(0, 4) : new Date().getFullYear().toString();
        const count = await tx.purchaseBill.count({
          where: { companyId: data.companyId, financialYearId: data.financialYearId },
        });
        billNumber = `PB-${yearPrefix}-${(count + 1).toString().padStart(4, '0')}`;
      }

      // Check unique billNumber within company & FY
      const duplicate = await tx.purchaseBill.findUnique({
        where: {
          companyId_financialYearId_billNumber: {
            companyId: data.companyId,
            financialYearId: data.financialYearId,
            billNumber,
          },
        },
      });

      if (duplicate) {
        const err: any = new Error(`Bill Number '${billNumber}' already exists in this financial year.`);
        err.statusCode = 409;
        throw err;
      }

      // 3. Create header
      const bill = await tx.purchaseBill.create({
        data: {
          companyId: data.companyId,
          financialYearId: data.financialYearId,
          billNumber,
          billDate: data.billDate,
          sourceChallanId: data.sourceChallanId || null,
          partyId: data.partyId || null,
          supplierGstin: data.supplierGstin ? data.supplierGstin.trim().toUpperCase() : null,
          supplierLegalName: data.supplierLegalName.trim(),
          supplierTradeName: data.supplierTradeName?.trim() || null,
          supplierAddress: data.supplierAddress?.trim() || null,
          supplierState: data.supplierState?.trim() || null,
          supplierStateCode: data.supplierStateCode?.trim() || null,
          supplierPincode: data.supplierPincode?.trim() || null,
          supplierCity: data.supplierCity?.trim() || null,
          verificationSource: data.verificationSource || 'MANUAL_UNVERIFIED',
          verificationTimestamp: data.verificationTimestamp || null,
          isVerifiedSupplier: Boolean(data.isVerifiedSupplier),
          supplierInvoiceNumber: data.supplierInvoiceNumber?.trim() || null,
          supplierInvoiceDate: data.supplierInvoiceDate || null,
          placeOfSupply: data.placeOfSupply?.trim() || null,
          totalQuantity: new Prisma.Decimal(data.totalQuantity),
          taxableAmount: new Prisma.Decimal(data.taxableAmount),
          cgstRate: new Prisma.Decimal(data.cgstRate || 0),
          cgstAmount: new Prisma.Decimal(data.cgstAmount || 0),
          sgstRate: new Prisma.Decimal(data.sgstRate || 0),
          sgstAmount: new Prisma.Decimal(data.sgstAmount || 0),
          igstRate: new Prisma.Decimal(data.igstRate || 0),
          igstAmount: new Prisma.Decimal(data.igstAmount || 0),
          roundOff: new Prisma.Decimal(data.roundOff || 0),
          totalAmount: new Prisma.Decimal(data.totalAmount),
          remarks: data.remarks?.trim() || null,
          status: 'CONFIRMED',
        },
      });

      // 4. Create items
      for (const item of data.items) {
        await tx.purchaseBillItem.create({
          data: {
            purchaseBillId: bill.id,
            itemDescription: item.itemDescription.trim(),
            hsnCode: item.hsnCode?.trim() || null,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit?.trim() || 'KG',
            rate: new Prisma.Decimal(item.rate),
            discount: new Prisma.Decimal(item.discount || 0),
            taxableAmount: new Prisma.Decimal(item.taxableAmount),
            cartonNumber: item.cartonNumber?.trim() || null,
            lotNumber: item.lotNumber?.trim() || null,
            grade: item.grade?.trim() || null,
            cops: item.cops !== undefined && item.cops !== null ? Number(item.cops) : null,
          },
        });
      }

      // 5. Return complete bill
      return tx.purchaseBill.findUnique({
        where: { id: bill.id },
        include: {
          items: true,
          sourceChallan: {
            include: {
              productionBook: true,
              yarnQuality: true,
              yarnGrade: true,
            },
          },
          party: true,
          financialYear: true,
        },
      });
    });
  }

  /**
   * Paginated listing of purchase bills
   */
  async findPaginated(companyId: string, params: {
    financialYearId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseBillWhereInput = {
      companyId,
    };

    if (params.financialYearId) {
      where.financialYearId = params.financialYearId;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { billNumber: { contains: q, mode: 'insensitive' } },
        { supplierLegalName: { contains: q, mode: 'insensitive' } },
        { supplierGstin: { contains: q, mode: 'insensitive' } },
        { supplierInvoiceNumber: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [bills, total] = await Promise.all([
      prisma.purchaseBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { billDate: 'desc' },
        include: {
          sourceChallan: {
            select: {
              challanNumber: true,
              challanDate: true,
            },
          },
          party: {
            select: {
              partyName: true,
            },
          },
          items: true,
        },
      }),
      prisma.purchaseBill.count({ where }),
    ]);

    return {
      data: bills,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const purchaseBillRepository = new PurchaseBillRepository();

