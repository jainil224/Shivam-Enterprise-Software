import {
  PartyRepository,
  MachineRepository,
  OperatorRepository,
  LocationRepository,
  YarnQualityRepository,
  YarnGradeRepository,
  ProductionBookRepository,
} from '../repositories/masterRepositories.js';
import { CompanyRepository } from '../repositories/companyRepository.js';
import { PartyGroupRepository, AreaRepository } from '../repositories/reportMasterRepository.js';
import { FinancialYearRepository } from '../repositories/financialYearRepository.js';
import {
  validatePartyInput,
  validateMachineInput,
  validateOperatorInput,
  validateLocationInput,
  validateYarnQualityInput,
  validateYarnGradeInput,
  validateProductionBookInput,
} from '../utils/validators.js';

const partyRepo = new PartyRepository();
const machineRepo = new MachineRepository();
const operatorRepo = new OperatorRepository();
const locationRepo = new LocationRepository();
const yarnQualityRepo = new YarnQualityRepository();
const yarnGradeRepo = new YarnGradeRepository();
const productionBookRepo = new ProductionBookRepository();
const companyRepo = new CompanyRepository();
const fyRepo = new FinancialYearRepository();
const partyGroupRepo = new PartyGroupRepository();
const areaRepo = new AreaRepository();

// Helper to assert company exists and is valid
async function assertActiveCompany(companyId: string) {
  if (!companyId) {
    const error: any = new Error('Company ID context is required for master operations.');
    error.statusCode = 400;
    throw error;
  }
  const company = await companyRepo.findById(companyId);
  if (!company) {
    const error: any = new Error('Company does not exist or context is invalid.');
    error.statusCode = 404;
    throw error;
  }
  return company;
}

// Phase 15.2 - a party may only point at master data owned by the same company.
async function assertPartyMasterRefs(
  companyId: string,
  data: { partyGroupId?: string | null; areaId?: string | null }
) {
  const errors: { field: string; message: string }[] = [];
  if (data.partyGroupId) {
    const group = await partyGroupRepo.findById(companyId, data.partyGroupId);
    if (!group) {
      errors.push({
        field: 'partyGroupId',
        message: 'Selected party group does not belong to the active company.',
      });
    }
  }
  if (data.areaId) {
    const area = await areaRepo.findById(companyId, data.areaId);
    if (!area) {
      errors.push({ field: 'areaId', message: 'Selected area does not belong to the active company.' });
    }
  }
  if (errors.length > 0) {
    const error: any = new Error('Party validation failed.');
    error.statusCode = 400;
    error.errors = errors;
    throw error;
  }
}

// =============================================================
// 1. Party Service
// =============================================================
export class PartyService {
  async getParties(companyId: string, options?: { search?: string; partyType?: any; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return partyRepo.findAll(companyId, options);
  }

  async getPartyById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const party = await partyRepo.findById(companyId, id);
    if (!party) {
      const error: any = new Error('Party not found.');
      error.statusCode = 404;
      throw error;
    }
    return party;
  }

  async createParty(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validatePartyInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Party validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    await assertPartyMasterRefs(companyId, data);

    // Check duplicate party code within company
    const existing = await partyRepo.findByCode(companyId, data.partyCode);
    if (existing) {
      const error: any = new Error(`Party with code '${data.partyCode.trim().toUpperCase()}' already exists in this company.`);
      error.statusCode = 409;
      throw error;
    }

    return partyRepo.create(companyId, data);
  }

  async updateParty(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getPartyById(companyId, id);

    const validationErrors = validatePartyInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Party validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    await assertPartyMasterRefs(companyId, data);

    if (data.partyCode) {
      const existing = await partyRepo.findByCode(companyId, data.partyCode);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Party with code '${data.partyCode.trim().toUpperCase()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return partyRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getPartyById(companyId, id);
    return partyRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 2. Machine Service
// =============================================================
export class MachineService {
  async getMachines(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return machineRepo.findAll(companyId, options);
  }

  async getMachineById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await machineRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Machine not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createMachine(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateMachineInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Machine validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    const existing = await machineRepo.findByCode(companyId, data.machineCode);
    if (existing) {
      const error: any = new Error(`Machine with code '${data.machineCode.trim().toUpperCase()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return machineRepo.create(companyId, data);
  }

  async updateMachine(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getMachineById(companyId, id);

    const validationErrors = validateMachineInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Machine validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.machineCode) {
      const existing = await machineRepo.findByCode(companyId, data.machineCode);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Machine with code '${data.machineCode.trim().toUpperCase()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return machineRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getMachineById(companyId, id);
    return machineRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 3. Operator Service
// =============================================================
export class OperatorService {
  async getOperators(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return operatorRepo.findAll(companyId, options);
  }

  async getOperatorById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await operatorRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Operator not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createOperator(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateOperatorInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Operator validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    const existing = await operatorRepo.findByCode(companyId, data.operatorCode);
    if (existing) {
      const error: any = new Error(`Operator with code '${data.operatorCode.trim().toUpperCase()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return operatorRepo.create(companyId, data);
  }

  async updateOperator(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getOperatorById(companyId, id);

    const validationErrors = validateOperatorInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Operator validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.operatorCode) {
      const existing = await operatorRepo.findByCode(companyId, data.operatorCode);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Operator with code '${data.operatorCode.trim().toUpperCase()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return operatorRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getOperatorById(companyId, id);
    return operatorRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 4. Location / Godown Service
// =============================================================
export class LocationService {
  async getLocations(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return locationRepo.findAll(companyId, options);
  }

  async getLocationById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await locationRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Location not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createLocation(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateLocationInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Location validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    const existing = await locationRepo.findByName(companyId, data.locationName);
    if (existing) {
      const error: any = new Error(`Location '${data.locationName.trim()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return locationRepo.create(companyId, data);
  }

  async updateLocation(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getLocationById(companyId, id);

    const validationErrors = validateLocationInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Location validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.locationName) {
      const existing = await locationRepo.findByName(companyId, data.locationName);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Location '${data.locationName.trim()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return locationRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getLocationById(companyId, id);
    return locationRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 5. Yarn Quality Service
// =============================================================
export class YarnQualityService {
  async getYarnQualities(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return yarnQualityRepo.findAll(companyId, options);
  }

  async getYarnQualityById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await yarnQualityRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Yarn quality not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createYarnQuality(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateYarnQualityInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Yarn quality validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    const existing = await yarnQualityRepo.findByName(companyId, data.qualityName);
    if (existing) {
      const error: any = new Error(`Yarn quality '${data.qualityName.trim()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return yarnQualityRepo.create(companyId, data);
  }

  async updateYarnQuality(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getYarnQualityById(companyId, id);

    const validationErrors = validateYarnQualityInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Yarn quality validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.qualityName) {
      const existing = await yarnQualityRepo.findByName(companyId, data.qualityName);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Yarn quality '${data.qualityName.trim()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return yarnQualityRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getYarnQualityById(companyId, id);
    return yarnQualityRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 6. Yarn Grade Service
// =============================================================
export class YarnGradeService {
  async getYarnGrades(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return yarnGradeRepo.findAll(companyId, options);
  }

  async getYarnGradeById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await yarnGradeRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Yarn grade not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createYarnGrade(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateYarnGradeInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Yarn grade validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    const existing = await yarnGradeRepo.findByName(companyId, data.gradeName);
    if (existing) {
      const error: any = new Error(`Yarn grade '${data.gradeName.trim()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    return yarnGradeRepo.create(companyId, data);
  }

  async updateYarnGrade(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getYarnGradeById(companyId, id);

    const validationErrors = validateYarnGradeInput(data, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Yarn grade validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.gradeName) {
      const existing = await yarnGradeRepo.findByName(companyId, data.gradeName);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Yarn grade '${data.gradeName.trim()}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return yarnGradeRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getYarnGradeById(companyId, id);
    return yarnGradeRepo.setStatus(companyId, id, isActive);
  }
}

// =============================================================
// 7. Production Book Service
// =============================================================
export class ProductionBookService {
  async getProductionBooks(companyId: string, financialYearId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    if (!financialYearId) {
      const error: any = new Error('Financial year ID is required for production books.');
      error.statusCode = 400;
      throw error;
    }
    const fy = await fyRepo.findById(financialYearId);
    if (!fy || fy.companyId !== companyId) {
      const error: any = new Error('Financial year does not belong to the active company.');
      error.statusCode = 400;
      throw error;
    }
    return productionBookRepo.findAll(companyId, financialYearId, options);
  }

  async getProductionBookById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const item = await productionBookRepo.findById(companyId, id);
    if (!item) {
      const error: any = new Error('Production book not found.');
      error.statusCode = 404;
      throw error;
    }
    return item;
  }

  async createProductionBook(companyId: string, data: any) {
    await assertActiveCompany(companyId);

    const validationErrors = validateProductionBookInput(data);
    if (validationErrors.length > 0) {
      const error: any = new Error('Production book validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    // Verify FY belongs to this company
    const fy = await fyRepo.findById(data.financialYearId);
    if (!fy || fy.companyId !== companyId) {
      const error: any = new Error('Financial year does not belong to this company.');
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate prefix within company & FY
    const existingPrefix = await productionBookRepo.findByPrefix(companyId, data.financialYearId, data.prefix);
    if (existingPrefix) {
      const error: any = new Error(`Production book with prefix '${data.prefix.trim().toUpperCase()}' already exists in this financial year.`);
      error.statusCode = 409;
      throw error;
    }

    // Check duplicate name within company & FY
    const existingName = await productionBookRepo.findByName(companyId, data.financialYearId, data.bookName);
    if (existingName) {
      const error: any = new Error(`Production book with name '${data.bookName.trim()}' already exists in this financial year.`);
      error.statusCode = 409;
      throw error;
    }

    return productionBookRepo.create(companyId, data);
  }

  async updateProductionBook(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    const book = await this.getProductionBookById(companyId, id);

    const validationErrors = validateProductionBookInput({ ...data, financialYearId: book.financialYearId }, true);
    if (validationErrors.length > 0) {
      const error: any = new Error('Production book validation failed.');
      error.statusCode = 400;
      error.errors = validationErrors;
      throw error;
    }

    if (data.prefix) {
      const existing = await productionBookRepo.findByPrefix(companyId, book.financialYearId, data.prefix);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Production book prefix '${data.prefix.trim().toUpperCase()}' is already in use.`);
        error.statusCode = 409;
        throw error;
      }
    }

    if (data.bookName) {
      const existing = await productionBookRepo.findByName(companyId, book.financialYearId, data.bookName);
      if (existing && existing.id !== id) {
        const error: any = new Error(`Production book name '${data.bookName.trim()}' is already in use.`);
        error.statusCode = 409;
        throw error;
      }
    }

    return productionBookRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getProductionBookById(companyId, id);
    return productionBookRepo.setStatus(companyId, id, isActive);
  }
}
