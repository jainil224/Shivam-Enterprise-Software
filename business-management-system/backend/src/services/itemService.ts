import { ItemType, Prisma, PrismaClient, UnitOfMeasure } from '@prisma/client';
import {
  ITEM_INCLUDE,
  ItemRepository,
  ItemWithRelations,
} from '../repositories/itemRepository.js';
import { FieldError, conflictError, notFoundError, validationError } from '../utils/appError.js';
import {
  OrderInputError,
  moneyFixed,
  parsePercent,
  parseRate,
} from '../utils/orderMath.js';

const prisma = new PrismaClient();
const repo = new ItemRepository();

export const ITEM_TYPES: ItemType[] = ['YARN', 'RAW_MATERIAL', 'FABRIC', 'OTHER'];

export const UNIT_OF_MEASURES: UnitOfMeasure[] = [
  'KG',
  'GRAM',
  'METER',
  'YARD',
  'PIECE',
  'ROLL',
  'BOX',
  'CARTON',
  'PACKET',
  'NOS',
];

const ITEM_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/.]{0,29}$/;
const HSN_PATTERN = /^[0-9]{4,8}$/;

export interface ItemPayload {
  itemCode?: string;
  itemName?: string;
  itemCategory?: string | null;
  itemType?: ItemType;
  unit?: UnitOfMeasure;
  hsnCode?: string | null;
  gstRate?: string | number | null;
  defaultSalesRate?: string | number | null;
  defaultPurchaseRate?: string | number | null;
  barcode?: string | null;
  description?: string | null;
  itemGroupId?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  yarnCount?: string | null;
  denier?: string | null;
  lotNumber?: string | null;
  fabricType?: string | null;
  fabricDesign?: string | null;
  colour?: string | null;
  sizeSpecification?: string | null;
}

export interface ItemView {
  id: string;
  companyId: string;
  itemCode: string;
  itemName: string;
  itemCategory: string | null;
  itemType: ItemType;
  unit: UnitOfMeasure;
  hsnCode: string | null;
  gstRate: string;
  defaultSalesRate: string;
  defaultPurchaseRate: string;
  barcode: string | null;
  description: string | null;
  itemGroupId: string | null;
  itemGroupName: string | null;
  yarnQualityId: string | null;
  yarnQualityName: string | null;
  yarnGradeId: string | null;
  yarnGradeName: string | null;
  yarnCount: string | null;
  denier: string | null;
  lotNumber: string | null;
  fabricType: string | null;
  fabricDesign: string | null;
  colour: string | null;
  sizeSpecification: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  return trimmed.slice(0, maxLength);
}

function serialize(item: ItemWithRelations): ItemView {
  return {
    id: item.id,
    companyId: item.companyId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemCategory: item.itemCategory,
    itemType: item.itemType,
    unit: item.unit,
    hsnCode: item.hsnCode,
    gstRate: moneyFixed(item.gstRate),
    defaultSalesRate: parseFloat(item.defaultSalesRate.toFixed(4)).toFixed(4),
    defaultPurchaseRate: parseFloat(item.defaultPurchaseRate.toFixed(4)).toFixed(4),
    barcode: item.barcode,
    description: item.description,
    itemGroupId: item.itemGroupId,
    itemGroupName: item.itemGroup?.groupName ?? null,
    yarnQualityId: item.yarnQualityId,
    yarnQualityName: item.yarnQuality?.qualityName ?? null,
    yarnGradeId: item.yarnGradeId,
    yarnGradeName: item.yarnGrade?.gradeName ?? null,
    yarnCount: item.yarnCount,
    denier: item.denier,
    lotNumber: item.lotNumber,
    fabricType: item.fabricType,
    fabricDesign: item.fabricDesign,
    colour: item.colour,
    sizeSpecification: item.sizeSpecification,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export class ItemService {
  async list(companyId: string, query: Record<string, unknown>): Promise<ItemView[]> {
    const itemType =
      typeof query.itemType === 'string' && ITEM_TYPES.includes(query.itemType as ItemType)
        ? (query.itemType as ItemType)
        : undefined;

    const items = await repo.findAll(companyId, {
      search: typeof query.search === 'string' ? query.search : undefined,
      itemType,
      includeInactive: query.includeInactive === 'true',
    });

    return items.map(serialize);
  }

  async getById(companyId: string, id: string): Promise<ItemView> {
    const item = await repo.findById(companyId, id);
    if (!item) {
      notFoundError('Item not found for the active company.');
    }
    return serialize(item);
  }

  private async parsePayload(
    companyId: string,
    payload: ItemPayload,
    isUpdate: boolean,
    excludeId?: string
  ) {
    const errors: FieldError[] = [];

    const itemCode = cleanText(payload.itemCode, 30);
    const itemName = cleanText(payload.itemName, 150);

    if (isUpdate) {
      if (payload.itemCode !== undefined) {
        if (!itemCode) {
          errors.push({ field: 'itemCode', message: 'Item code cannot be empty.' });
        } else if (!ITEM_CODE_PATTERN.test(itemCode)) {
          errors.push({
            field: 'itemCode',
            message: 'Item code must start with a letter or number and may use A-Z, 0-9, -, _, / or . (max 30).',
          });
        }
      }
      if (payload.itemName !== undefined && !itemName) {
        errors.push({ field: 'itemName', message: 'Item name cannot be empty.' });
      }
    } else {
      if (!itemCode) {
        errors.push({ field: 'itemCode', message: 'Item code is required.' });
      } else if (!ITEM_CODE_PATTERN.test(itemCode)) {
        errors.push({
          field: 'itemCode',
          message: 'Item code must start with a letter or number and may use A-Z, 0-9, -, _, / or . (max 30).',
        });
      }
      if (!itemName) {
        errors.push({ field: 'itemName', message: 'Item name is required.' });
      } else if (itemName.length < 2) {
        errors.push({ field: 'itemName', message: 'Item name must be at least 2 characters.' });
      }
    }

    if (itemCode) {
      const duplicate = await repo.findByCode(companyId, itemCode);
      if (duplicate && duplicate.id !== excludeId) {
        errors.push({
          field: 'itemCode',
          message: `Item code ${itemCode} is already used by ${duplicate.itemName}.`,
        });
      }
    }

    const itemType = payload.itemType ?? 'OTHER';
    if (!ITEM_TYPES.includes(itemType)) {
      errors.push({ field: 'itemType', message: 'Item type must be YARN, RAW_MATERIAL, FABRIC or OTHER.' });
    }

    const unit = payload.unit ?? 'KG';
    if (!UNIT_OF_MEASURES.includes(unit)) {
      errors.push({ field: 'unit', message: `Unit must be one of ${UNIT_OF_MEASURES.join(', ')}.` });
    }

    const hsnCode = cleanText(payload.hsnCode, 8);
    if (hsnCode && !HSN_PATTERN.test(hsnCode)) {
      errors.push({ field: 'hsnCode', message: 'HSN code must be 4 to 8 digits.' });
    }

    let gstRate = parsePercent(payload.gstRate, 'gstRate', 'GST rate', '18');
    // Rates are decimal(15,4): start at zero and only widen the parse when a value
    // is supplied, so a 3- or 4-decimal rate is not rejected by the 2-decimal money parser.
    let defaultSalesRate = new Prisma.Decimal(0);
    let defaultPurchaseRate = new Prisma.Decimal(0);

    if (payload.defaultSalesRate !== undefined && payload.defaultSalesRate !== null && payload.defaultSalesRate !== '') {
      try {
        defaultSalesRate = parseRate(payload.defaultSalesRate, 'defaultSalesRate', 'Default sales rate');
      } catch (error) {
        if (error instanceof OrderInputError) {
          errors.push({ field: error.field, message: error.message });
        } else {
          throw error;
        }
      }
    }

    if (
      payload.defaultPurchaseRate !== undefined &&
      payload.defaultPurchaseRate !== null &&
      payload.defaultPurchaseRate !== ''
    ) {
      try {
        defaultPurchaseRate = parseRate(
          payload.defaultPurchaseRate,
          'defaultPurchaseRate',
          'Default purchase rate'
        );
      } catch (error) {
        if (error instanceof OrderInputError) {
          errors.push({ field: error.field, message: error.message });
        } else {
          throw error;
        }
      }
    }

    if (!isUpdate && gstRate.isNegative()) {
      errors.push({ field: 'gstRate', message: 'GST rate cannot be negative.' });
    }

    let itemGroupId = cleanText(payload.itemGroupId, 64);
    if (itemGroupId) {
      const group = await prisma.itemGroup.findFirst({
        where: { id: itemGroupId, companyId },
        select: { id: true },
      });
      if (!group) {
        errors.push({
          field: 'itemGroupId',
          message: 'Selected item group does not belong to the active company.',
        });
        itemGroupId = null;
      }
    }

    let yarnQualityId = cleanText(payload.yarnQualityId, 64);
    if (yarnQualityId) {
      const quality = await prisma.yarnQuality.findFirst({
        where: { id: yarnQualityId, companyId },
        select: { id: true },
      });
      if (!quality) {
        errors.push({
          field: 'yarnQualityId',
          message: 'Selected yarn quality does not belong to the active company.',
        });
        yarnQualityId = null;
      }
    }

    let yarnGradeId = cleanText(payload.yarnGradeId, 64);
    if (yarnGradeId) {
      const grade = await prisma.yarnGrade.findFirst({
        where: { id: yarnGradeId, companyId },
        select: { id: true },
      });
      if (!grade) {
        errors.push({
          field: 'yarnGradeId',
          message: 'Selected yarn grade does not belong to the active company.',
        });
        yarnGradeId = null;
      }
    }

    if (errors.length > 0) {
      validationError(errors);
    }

    return {
      itemCode: itemCode as string,
      itemName: itemName as string,
      itemCategory: cleanText(payload.itemCategory, 100),
      itemType,
      unit,
      hsnCode,
      gstRate,
      defaultSalesRate,
      defaultPurchaseRate,
      barcode: cleanText(payload.barcode, 50),
      description: cleanText(payload.description, 500),
      itemGroupId,
      yarnQualityId,
      yarnGradeId,
      yarnCount: cleanText(payload.yarnCount, 30),
      denier: cleanText(payload.denier, 30),
      lotNumber: cleanText(payload.lotNumber, 50),
      fabricType: cleanText(payload.fabricType, 100),
      fabricDesign: cleanText(payload.fabricDesign, 100),
      colour: cleanText(payload.colour, 100),
      sizeSpecification: cleanText(payload.sizeSpecification, 100),
    };
  }

  async create(companyId: string, payload: ItemPayload): Promise<ItemView> {
    const data = await this.parsePayload(companyId, payload, false);
    const item = await repo.create(companyId, data);
    return serialize(item);
  }

  async update(companyId: string, id: string, payload: ItemPayload): Promise<ItemView> {
    const existing = await repo.findById(companyId, id);
    if (!existing) {
      notFoundError('Item not found for the active company.');
    }

    const data = await this.parsePayload(companyId, payload, true, id);
    // parsePayload returns null for omitted text fields, so a partial update must fall back
    // to the stored value instead of writing null into a non-nullable column.
    const keep = <T>(incoming: T | null | undefined, current: T): T =>
      incoming === undefined || incoming === null ? current : incoming;
    const item = await repo.update(id, {
      itemCode: keep<string>(data.itemCode, existing.itemCode),
      itemName: keep<string>(data.itemName, existing.itemName),
      itemCategory: keep<string | null>(data.itemCategory, existing.itemCategory),
      itemType: keep(data.itemType, existing.itemType),
      unit: keep(data.unit, existing.unit),
      hsnCode: keep<string | null>(data.hsnCode, existing.hsnCode),
      gstRate: payload.gstRate === undefined ? existing.gstRate : data.gstRate,
      defaultSalesRate:
        payload.defaultSalesRate === undefined ? existing.defaultSalesRate : data.defaultSalesRate,
      defaultPurchaseRate:
        payload.defaultPurchaseRate === undefined
          ? existing.defaultPurchaseRate
          : data.defaultPurchaseRate,
      barcode: keep<string | null>(data.barcode, existing.barcode),
      description: keep<string | null>(data.description, existing.description),
      itemGroupId: keep<string | null>(data.itemGroupId, existing.itemGroupId),
      yarnQualityId: keep<string | null>(data.yarnQualityId, existing.yarnQualityId),
      yarnGradeId: keep<string | null>(data.yarnGradeId, existing.yarnGradeId),
      yarnCount: keep<string | null>(data.yarnCount, existing.yarnCount),
      denier: keep<string | null>(data.denier, existing.denier),
      lotNumber: keep<string | null>(data.lotNumber, existing.lotNumber),
      fabricType: keep<string | null>(data.fabricType, existing.fabricType),
      fabricDesign: keep<string | null>(data.fabricDesign, existing.fabricDesign),
      colour: keep<string | null>(data.colour, existing.colour),
      sizeSpecification: keep<string | null>(data.sizeSpecification, existing.sizeSpecification),
    });
    return serialize(item);
  }

  async setStatus(companyId: string, id: string, isActive: boolean): Promise<ItemView> {
    const existing = await repo.findById(companyId, id);
    if (!existing) {
      notFoundError('Item not found for the active company.');
    }
    if (!isActive) {
      const openLines = await prisma.salesOrderLine.count({
        where: {
          companyId,
          itemId: id,
          order: { status: { in: ['DRAFT', 'CONFIRMED', 'PARTIALLY_FULFILLED'] } },
        },
      });
      const openPurchaseLines = await prisma.purchaseOrderLine.count({
        where: {
          companyId,
          itemId: id,
          order: { status: { in: ['DRAFT', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED'] } },
        },
      });
      if (openLines + openPurchaseLines > 0) {
        conflictError(
          'This item is referenced by open sales or purchase orders. Close or cancel those orders before deactivating it.'
        );
      }
    }
    const item = await repo.setStatus(id, isActive);
    return serialize(item);
  }

  async getLookups(companyId: string) {
    const [itemGroups, yarnQualities, yarnGrades] = await Promise.all([
      prisma.itemGroup.findMany({
        where: { companyId, isActive: true },
        select: { id: true, groupName: true },
        orderBy: { groupName: 'asc' },
      }),
      prisma.yarnQuality.findMany({
        where: { companyId, isActive: true },
        select: { id: true, qualityName: true, denier: true },
        orderBy: { qualityName: 'asc' },
      }),
      prisma.yarnGrade.findMany({
        where: { companyId, isActive: true },
        select: { id: true, gradeName: true },
        orderBy: { gradeName: 'asc' },
      }),
    ]);

    return {
      itemTypes: ITEM_TYPES,
      units: UNIT_OF_MEASURES,
      gstRates: ['0', '5', '12', '18', '28'],
      itemGroups,
      yarnQualities,
      yarnGrades,
    };
  }

  async summary(companyId: string) {
    const [total, active, yarn, rawMaterial, fabric, other] = await Promise.all([
      prisma.item.count({ where: { companyId } }),
      prisma.item.count({ where: { companyId, isActive: true } }),
      prisma.item.count({ where: { companyId, itemType: 'YARN' } }),
      prisma.item.count({ where: { companyId, itemType: 'RAW_MATERIAL' } }),
      prisma.item.count({ where: { companyId, itemType: 'FABRIC' } }),
      prisma.item.count({ where: { companyId, itemType: 'OTHER' } }),
    ]);
    return { total, active, inactive: total - active, yarn, rawMaterial, fabric, other };
  }
}

export { serialize as serializeItem };