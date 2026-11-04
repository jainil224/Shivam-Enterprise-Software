import { PrismaClient, PartyType, BalanceType } from '@prisma/client';

const prisma = new PrismaClient();

// =============================================================
// 1. Party / Account Repository
// =============================================================
export class PartyRepository {
  async findAll(companyId: string, options?: { search?: string; partyType?: PartyType; includeInactive?: boolean }) {
    const where: any = { companyId };

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    if (options?.partyType) {
      where.partyType = options.partyType;
    }

    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { partyName: { contains: term, mode: 'insensitive' } },
        { partyCode: { contains: term, mode: 'insensitive' } },
        { gstin: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { city: { contains: term, mode: 'insensitive' } },
      ];
    }

    return prisma.party.findMany({
      where,
      orderBy: [{ partyName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.party.findFirst({
      where: { id, companyId },
    });
  }

  async findByCode(companyId: string, partyCode: string) {
    return prisma.party.findFirst({
      where: { companyId, partyCode: partyCode.trim().toUpperCase() },
    });
  }

  async create(companyId: string, data: {
    partyCode: string;
    partyName: string;
    partyType?: PartyType;
    gstin?: string | null;
    panNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    openingBalance?: number | string;
    balanceType?: BalanceType;
    isActive?: boolean;
  }) {
    return prisma.party.create({
      data: {
        companyId,
        partyCode: data.partyCode.trim().toUpperCase(),
        partyName: data.partyName.trim(),
        partyType: data.partyType || 'CUSTOMER',
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        panNumber: data.panNumber ? data.panNumber.trim().toUpperCase() : null,
        address: data.address?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pincode: data.pincode?.trim() || null,
        phone: data.phone?.trim() || null,
        email: data.email?.trim() || null,
        openingBalance: data.openingBalance !== undefined ? String(data.openingBalance) : '0.00',
        balanceType: data.balanceType || 'DEBIT',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    partyCode?: string;
    partyName?: string;
    partyType?: PartyType;
    gstin?: string | null;
    panNumber?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    openingBalance?: number | string;
    balanceType?: BalanceType;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.partyCode !== undefined) updateData.partyCode = data.partyCode.trim().toUpperCase();
    if (data.partyName !== undefined) updateData.partyName = data.partyName.trim();
    if (data.partyType !== undefined) updateData.partyType = data.partyType;
    if (data.gstin !== undefined) updateData.gstin = data.gstin ? data.gstin.trim().toUpperCase() : null;
    if (data.panNumber !== undefined) updateData.panNumber = data.panNumber ? data.panNumber.trim().toUpperCase() : null;
    if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
    if (data.city !== undefined) updateData.city = data.city ? data.city.trim() : null;
    if (data.state !== undefined) updateData.state = data.state ? data.state.trim() : null;
    if (data.pincode !== undefined) updateData.pincode = data.pincode ? data.pincode.trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.openingBalance !== undefined) updateData.openingBalance = String(data.openingBalance);
    if (data.balanceType !== undefined) updateData.balanceType = data.balanceType;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.party.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.party.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, partyId: id },
    });
  }
}

// =============================================================
// 2. Machine Repository
// =============================================================
export class MachineRepository {
  async findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { machineCode: { contains: term, mode: 'insensitive' } },
        { machineName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.machine.findMany({
      where,
      orderBy: [{ machineCode: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.machine.findFirst({
      where: { id, companyId },
    });
  }

  async findByCode(companyId: string, machineCode: string) {
    return prisma.machine.findFirst({
      where: { companyId, machineCode: machineCode.trim().toUpperCase() },
    });
  }

  async create(companyId: string, data: {
    machineCode: string;
    machineName: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    return prisma.machine.create({
      data: {
        companyId,
        machineCode: data.machineCode.trim().toUpperCase(),
        machineName: data.machineName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    machineCode?: string;
    machineName?: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.machineCode !== undefined) updateData.machineCode = data.machineCode.trim().toUpperCase();
    if (data.machineName !== undefined) updateData.machineName = data.machineName.trim();
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.machine.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.machine.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, machineId: id },
    });
  }
}

// =============================================================
// 3. Operator Repository
// =============================================================
export class OperatorRepository {
  async findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { operatorCode: { contains: term, mode: 'insensitive' } },
        { operatorName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.operator.findMany({
      where,
      orderBy: [{ operatorName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.operator.findFirst({
      where: { id, companyId },
    });
  }

  async findByCode(companyId: string, operatorCode: string) {
    return prisma.operator.findFirst({
      where: { companyId, operatorCode: operatorCode.trim().toUpperCase() },
    });
  }

  async create(companyId: string, data: {
    operatorCode: string;
    operatorName: string;
    phone?: string | null;
    isActive?: boolean;
  }) {
    return prisma.operator.create({
      data: {
        companyId,
        operatorCode: data.operatorCode.trim().toUpperCase(),
        operatorName: data.operatorName.trim(),
        phone: data.phone?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    operatorCode?: string;
    operatorName?: string;
    phone?: string | null;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.operatorCode !== undefined) updateData.operatorCode = data.operatorCode.trim().toUpperCase();
    if (data.operatorName !== undefined) updateData.operatorName = data.operatorName.trim();
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.operator.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.operator.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, operatorId: id },
    });
  }
}

// =============================================================
// 4. Location / Godown Repository
// =============================================================
export class LocationRepository {
  async findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { locationName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.location.findMany({
      where,
      orderBy: [{ locationName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.location.findFirst({
      where: { id, companyId },
    });
  }

  async findByName(companyId: string, locationName: string) {
    return prisma.location.findFirst({
      where: { companyId, locationName: locationName.trim() },
    });
  }

  async create(companyId: string, data: {
    locationName: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    return prisma.location.create({
      data: {
        companyId,
        locationName: data.locationName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    locationName?: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.locationName !== undefined) updateData.locationName = data.locationName.trim();
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.location.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, locationId: id },
    });
  }
}

// =============================================================
// 5. Yarn Quality Repository
// =============================================================
export class YarnQualityRepository {
  async findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { qualityName: { contains: term, mode: 'insensitive' } },
        { denier: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.yarnQuality.findMany({
      where,
      orderBy: [{ qualityName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.yarnQuality.findFirst({
      where: { id, companyId },
    });
  }

  async findByName(companyId: string, qualityName: string) {
    return prisma.yarnQuality.findFirst({
      where: { companyId, qualityName: qualityName.trim() },
    });
  }

  async create(companyId: string, data: {
    qualityName: string;
    denier?: string | null;
    description?: string | null;
    isActive?: boolean;
  }) {
    return prisma.yarnQuality.create({
      data: {
        companyId,
        qualityName: data.qualityName.trim(),
        denier: data.denier?.trim() || null,
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    qualityName?: string;
    denier?: string | null;
    description?: string | null;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.qualityName !== undefined) updateData.qualityName = data.qualityName.trim();
    if (data.denier !== undefined) updateData.denier = data.denier ? data.denier.trim() : null;
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.yarnQuality.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.yarnQuality.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, yarnQualityId: id },
    });
  }
}

// =============================================================
// 6. Yarn Grade Repository
// =============================================================
export class YarnGradeRepository {
  async findAll(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { gradeName: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.yarnGrade.findMany({
      where,
      orderBy: [{ gradeName: 'asc' }],
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.yarnGrade.findFirst({
      where: { id, companyId },
    });
  }

  async findByName(companyId: string, gradeName: string) {
    return prisma.yarnGrade.findFirst({
      where: { companyId, gradeName: gradeName.trim() },
    });
  }

  async create(companyId: string, data: {
    gradeName: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    return prisma.yarnGrade.create({
      data: {
        companyId,
        gradeName: data.gradeName.trim(),
        description: data.description?.trim() || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    gradeName?: string;
    description?: string | null;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.gradeName !== undefined) updateData.gradeName = data.gradeName.trim();
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.yarnGrade.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.yarnGrade.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, yarnGradeId: id },
    });
  }
}

// =============================================================
// 7. Production Book Repository
// =============================================================
export class ProductionBookRepository {
  async findAll(companyId: string, financialYearId: string, options?: { search?: string; includeInactive?: boolean }) {
    const where: any = { companyId, financialYearId };
    if (!options?.includeInactive) where.isActive = true;
    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      where.OR = [
        { prefix: { contains: term, mode: 'insensitive' } },
        { bookName: { contains: term, mode: 'insensitive' } },
      ];
    }
    return prisma.productionBook.findMany({
      where,
      orderBy: [{ prefix: 'asc' }],
      include: {
        financialYear: {
          select: { yearName: true, isLocked: true },
        },
      },
    });
  }

  async findById(companyId: string, id: string) {
    return prisma.productionBook.findFirst({
      where: { id, companyId },
      include: {
        financialYear: {
          select: { yearName: true, isLocked: true },
        },
      },
    });
  }

  async findByPrefix(companyId: string, financialYearId: string, prefix: string) {
    return prisma.productionBook.findFirst({
      where: { companyId, financialYearId, prefix: prefix.trim().toUpperCase() },
    });
  }

  async findByName(companyId: string, financialYearId: string, bookName: string) {
    return prisma.productionBook.findFirst({
      where: { companyId, financialYearId, bookName: bookName.trim() },
    });
  }

  async create(companyId: string, data: {
    financialYearId: string;
    prefix: string;
    bookName: string;
    openingBalance?: number | string;
    isActive?: boolean;
  }) {
    return prisma.productionBook.create({
      data: {
        companyId,
        financialYearId: data.financialYearId,
        prefix: data.prefix.trim().toUpperCase(),
        bookName: data.bookName.trim(),
        openingBalance: data.openingBalance !== undefined ? String(data.openingBalance) : '0.000',
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async update(companyId: string, id: string, data: {
    prefix?: string;
    bookName?: string;
    openingBalance?: number | string;
    isActive?: boolean;
  }) {
    const updateData: any = {};
    if (data.prefix !== undefined) updateData.prefix = data.prefix.trim().toUpperCase();
    if (data.bookName !== undefined) updateData.bookName = data.bookName.trim();
    if (data.openingBalance !== undefined) updateData.openingBalance = String(data.openingBalance);
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.productionBook.update({
      where: { id },
      data: updateData,
    });
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    return prisma.productionBook.update({
      where: { id },
      data: { isActive },
    });
  }

  async countTransactions(companyId: string, id: string) {
    return prisma.productionReceive.count({
      where: { companyId, productionBookId: id },
    });
  }
}
