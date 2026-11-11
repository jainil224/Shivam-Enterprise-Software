import { prisma } from '../utils/prisma.js';

// Phase 15.2 - company-scoped report masters. Every read is scoped to one
// company so a report can never group by another company's master data.

export class PartyGroupRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { groupName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.partyGroup.findMany({ where, orderBy: { groupName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.partyGroup.findFirst({ where: { id, companyId } });
  }
  findByName(companyId: string, groupName: string) {
    return prisma.partyGroup.findFirst({ where: { companyId, groupName: groupName.trim() } });
  }
  create(companyId: string, data: { groupName: string; description?: string | null; isActive?: boolean }) {
    return prisma.partyGroup.create({
      data: {
        companyId,
        groupName: data.groupName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { groupName?: string; description?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.groupName !== undefined) patch.groupName = data.groupName.trim();
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.partyGroup.update({ where: { id }, data: patch });
  }
  countParties(companyId: string, id: string) {
    return prisma.party.count({ where: { companyId, partyGroupId: id } });
  }
}

export class AreaRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { areaName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.area.findMany({ where, orderBy: { areaName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.area.findFirst({ where: { id, companyId } });
  }
  findByName(companyId: string, areaName: string) {
    return prisma.area.findFirst({ where: { companyId, areaName: areaName.trim() } });
  }
  create(companyId: string, data: { areaName: string; description?: string | null; isActive?: boolean }) {
    return prisma.area.create({
      data: {
        companyId,
        areaName: data.areaName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { areaName?: string; description?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.areaName !== undefined) patch.areaName = data.areaName.trim();
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.area.update({ where: { id }, data: patch });
  }
  countParties(companyId: string, id: string) {
    return prisma.party.count({ where: { companyId, areaId: id } });
  }
}

export class BrokerRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { brokerName: { contains: term, mode: 'insensitive' } },
        { brokerCode: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.broker.findMany({ where, orderBy: { brokerName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.broker.findFirst({ where: { id, companyId } });
  }
  findByCode(companyId: string, brokerCode: string) {
    return prisma.broker.findFirst({ where: { companyId, brokerCode: brokerCode.trim().toUpperCase() } });
  }
  create(companyId: string, data: { brokerCode: string; brokerName: string; phone?: string | null; isActive?: boolean }) {
    return prisma.broker.create({
      data: {
        companyId,
        brokerCode: data.brokerCode.trim().toUpperCase(),
        brokerName: data.brokerName.trim(),
        phone: data.phone?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { brokerCode?: string; brokerName?: string; phone?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.brokerCode !== undefined) patch.brokerCode = data.brokerCode.trim().toUpperCase();
    if (data.brokerName !== undefined) patch.brokerName = data.brokerName.trim();
    if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.broker.update({ where: { id }, data: patch });
  }
}

export class TransporterRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { transporterName: { contains: term, mode: 'insensitive' } },
        { transporterCode: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.transporter.findMany({ where, orderBy: { transporterName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.transporter.findFirst({ where: { id, companyId } });
  }
  findByCode(companyId: string, transporterCode: string) {
    return prisma.transporter.findFirst({ where: { companyId, transporterCode: transporterCode.trim().toUpperCase() } });
  }
  create(companyId: string, data: { transporterCode: string; transporterName: string; phone?: string | null; isActive?: boolean }) {
    return prisma.transporter.create({
      data: {
        companyId,
        transporterCode: data.transporterCode.trim().toUpperCase(),
        transporterName: data.transporterName.trim(),
        phone: data.phone?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { transporterCode?: string; transporterName?: string; phone?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.transporterCode !== undefined) patch.transporterCode = data.transporterCode.trim().toUpperCase();
    if (data.transporterName !== undefined) patch.transporterName = data.transporterName.trim();
    if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.transporter.update({ where: { id }, data: patch });
  }
}

export class SalespersonRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { salespersonName: { contains: term, mode: 'insensitive' } },
        { salespersonCode: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.salesperson.findMany({ where, orderBy: { salespersonName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.salesperson.findFirst({ where: { id, companyId } });
  }
  findByCode(companyId: string, salespersonCode: string) {
    return prisma.salesperson.findFirst({ where: { companyId, salespersonCode: salespersonCode.trim().toUpperCase() } });
  }
  create(companyId: string, data: { salespersonCode: string; salespersonName: string; phone?: string | null; isActive?: boolean }) {
    return prisma.salesperson.create({
      data: {
        companyId,
        salespersonCode: data.salespersonCode.trim().toUpperCase(),
        salespersonName: data.salespersonName.trim(),
        phone: data.phone?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { salespersonCode?: string; salespersonName?: string; phone?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.salespersonCode !== undefined) patch.salespersonCode = data.salespersonCode.trim().toUpperCase();
    if (data.salespersonName !== undefined) patch.salespersonName = data.salespersonName.trim();
    if (data.phone !== undefined) patch.phone = data.phone?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.salesperson.update({ where: { id }, data: patch });
  }
}

export class ItemGroupRepository {
  findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { groupName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.itemGroup.findMany({ where, orderBy: { groupName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.itemGroup.findFirst({ where: { id, companyId } });
  }
  findByName(companyId: string, groupName: string) {
    return prisma.itemGroup.findFirst({ where: { companyId, groupName: groupName.trim() } });
  }
  create(companyId: string, data: { groupName: string; description?: string | null; isActive?: boolean }) {
    return prisma.itemGroup.create({
      data: {
        companyId,
        groupName: data.groupName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { groupName?: string; description?: string | null; isActive?: boolean }) {
    const patch: any = {};
    if (data.groupName !== undefined) patch.groupName = data.groupName.trim();
    if (data.description !== undefined) patch.description = data.description?.trim() || null;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.itemGroup.update({ where: { id }, data: patch });
  }
  countItems(companyId: string, id: string) {
    return prisma.item.count({ where: { companyId, itemGroupId: id } });
  }
}

export class PurchaseBookRepository {
  findAll(companyId: string, financialYearId?: string, options?: { includeInactive?: boolean }) {
    const where: any = { companyId };
    if (financialYearId) where.financialYearId = financialYearId;
    if (!options?.includeInactive) where.isActive = true;
    return prisma.purchaseBook.findMany({ where, orderBy: { bookName: 'asc' } });
  }
  findById(companyId: string, id: string) {
    return prisma.purchaseBook.findFirst({ where: { id, companyId } });
  }
  findByName(companyId: string, financialYearId: string, bookName: string) {
    return prisma.purchaseBook.findFirst({
      where: { companyId, financialYearId, bookName: bookName.trim() },
    });
  }
  findByPrefix(companyId: string, financialYearId: string, prefix: string) {
    return prisma.purchaseBook.findFirst({
      where: { companyId, financialYearId, prefix: prefix.trim().toUpperCase() },
    });
  }
  create(companyId: string, data: { financialYearId: string; prefix: string; bookName: string; isActive?: boolean }) {
    return prisma.purchaseBook.create({
      data: {
        companyId,
        financialYearId: data.financialYearId,
        prefix: data.prefix.trim().toUpperCase(),
        bookName: data.bookName.trim(),
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }
  update(companyId: string, id: string, data: { prefix?: string; bookName?: string; isActive?: boolean }) {
    const patch: any = {};
    if (data.prefix !== undefined) patch.prefix = data.prefix.trim().toUpperCase();
    if (data.bookName !== undefined) patch.bookName = data.bookName.trim();
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return prisma.purchaseBook.update({ where: { id }, data: patch });
  }
  countBills(companyId: string, id: string) {
    return prisma.purchaseBill.count({ where: { companyId, bookId: id } });
  }
}