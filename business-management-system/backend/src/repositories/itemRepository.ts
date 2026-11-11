import { ItemType, Prisma, PrismaClient, UnitOfMeasure } from '@prisma/client';

const prisma = new PrismaClient();

export const ITEM_INCLUDE = {
  itemGroup: { select: { id: true, groupName: true } },
  yarnQuality: { select: { id: true, qualityName: true, denier: true } },
  yarnGrade: { select: { id: true, gradeName: true } },
} satisfies Prisma.ItemInclude;

export type ItemWithRelations = Prisma.ItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

export interface ItemListFilters {
  search?: string;
  itemType?: ItemType;
  includeInactive?: boolean;
}

export interface ItemWriteData {
  itemCode: string;
  itemName: string;
  itemCategory: string | null;
  itemType: ItemType;
  unit: UnitOfMeasure;
  hsnCode: string | null;
  gstRate: Prisma.Decimal;
  defaultSalesRate: Prisma.Decimal;
  defaultPurchaseRate: Prisma.Decimal;
  barcode: string | null;
  description: string | null;
  itemGroupId: string | null;
  yarnQualityId: string | null;
  yarnGradeId: string | null;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  fabricType: string | null;
  fabricDesign: string | null;
  colour: string | null;
  sizeSpecification: string | null;
}

export class ItemRepository {
  async findAll(companyId: string, filters: ItemListFilters): Promise<ItemWithRelations[]> {
    const where: Prisma.ItemWhereInput = { companyId };
    if (!filters.includeInactive) {
      where.isActive = true;
    }
    if (filters.itemType) {
      where.itemType = filters.itemType;
    }
    if (filters.search && filters.search.trim() !== '') {
      const term = filters.search.trim();
      where.OR = [
        { itemCode: { contains: term, mode: 'insensitive' } },
        { itemName: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { hsnCode: { contains: term, mode: 'insensitive' } },
        { itemCategory: { contains: term, mode: 'insensitive' } },
        { yarnCount: { contains: term, mode: 'insensitive' } },
        { denier: { contains: term, mode: 'insensitive' } },
        { colour: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.item.findMany({
      where,
      include: ITEM_INCLUDE,
      orderBy: [{ itemName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string): Promise<ItemWithRelations | null> {
    return prisma.item.findFirst({ where: { id, companyId }, include: ITEM_INCLUDE });
  }

  async findByIds(companyId: string, ids: string[]): Promise<ItemWithRelations[]> {
    if (ids.length === 0) return [];
    return prisma.item.findMany({
      where: { companyId, id: { in: ids } },
      include: ITEM_INCLUDE,
    });
  }

  async findByCode(companyId: string, itemCode: string): Promise<ItemWithRelations | null> {
    return prisma.item.findFirst({
      where: { companyId, itemCode: { equals: itemCode.trim(), mode: 'insensitive' } },
      include: ITEM_INCLUDE,
    });
  }

  async create(companyId: string, data: ItemWriteData): Promise<ItemWithRelations> {
    return prisma.item.create({
      data: { companyId, ...data },
      include: ITEM_INCLUDE,
    });
  }

  async update(id: string, data: Partial<ItemWriteData>): Promise<ItemWithRelations> {
    return prisma.item.update({ where: { id }, data, include: ITEM_INCLUDE });
  }

  async setStatus(id: string, isActive: boolean): Promise<ItemWithRelations> {
    return prisma.item.update({ where: { id }, data: { isActive }, include: ITEM_INCLUDE });
  }

  async countByCompany(companyId: string): Promise<number> {
    return prisma.item.count({ where: { companyId } });
  }
}