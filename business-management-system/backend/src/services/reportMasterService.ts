/**
 * Phase 15.2 - Report master services.
 * All operations are company scoped, reject duplicates with 409 and refuse to
 * delete/deactivate a master that is still referenced by live transactions.
 */
import {
  PartyGroupRepository,
  AreaRepository,
  BrokerRepository,
  TransporterRepository,
  SalespersonRepository,
  ItemGroupRepository,
  PurchaseBookRepository,
} from '../repositories/reportMasterRepository.js';
import { CompanyRepository } from '../repositories/companyRepository.js';
import { FinancialYearRepository } from '../repositories/financialYearRepository.js';
import {
  validateNamedGroupInput,
  validateAreaInput,
  validateBrokerInput,
  validateTransporterInput,
  validateSalespersonInput,
  validatePurchaseBookInput,
} from '../utils/reportMasterValidators.js';

const partyGroupRepo = new PartyGroupRepository();
const areaRepo = new AreaRepository();
const brokerRepo = new BrokerRepository();
const transporterRepo = new TransporterRepository();
const salespersonRepo = new SalespersonRepository();
const itemGroupRepo = new ItemGroupRepository();
const purchaseBookRepo = new PurchaseBookRepository();
const companyRepo = new CompanyRepository();
const fyRepo = new FinancialYearRepository();

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

function notFound(label: string): never {
  const error: any = new Error(`${label} not found.`);
  error.statusCode = 404;
  throw error;
}

function conflict(message: string): never {
  const error: any = new Error(message);
  error.statusCode = 409;
  throw error;
}

function validationFailed(label: string, errors: { field: string; message: string }[]): never {
  const error: any = new Error(`${label} validation failed.`);
  error.statusCode = 400;
  error.errors = errors;
  throw error;
}

async function assertFinancialYear(companyId: string, financialYearId: string) {
  const fy = await fyRepo.findById(financialYearId);
  if (!fy || fy.companyId !== companyId) {
    const error: any = new Error('Financial year does not exist for this company.');
    error.statusCode = 400;
    throw error;
  }
  return fy;
}

// =============================================================
// Party Group
// =============================================================
export class PartyGroupService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return partyGroupRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await partyGroupRepo.findById(companyId, id);
    if (!record) notFound('Party group');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateNamedGroupInput(data);
    if (errors.length) validationFailed('Party group', errors);

    const existing = await partyGroupRepo.findByName(companyId, data.groupName);
    if (existing) conflict(`Party group '${data.groupName.trim()}' already exists.`);

    return partyGroupRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateNamedGroupInput(data, true);
    if (errors.length) validationFailed('Party group', errors);

    if (data.groupName) {
      const existing = await partyGroupRepo.findByName(companyId, data.groupName);
      if (existing && existing.id !== id) conflict(`Party group '${data.groupName.trim()}' already exists.`);
    }

    return partyGroupRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    if (!isActive) {
      const usage = await partyGroupRepo.countParties(companyId, id);
      if (usage > 0) conflict(`Cannot deactivate: ${usage} party(ies) still use this party group.`);
    }
    return partyGroupRepo.update(companyId, id, { isActive });
  }

  async usage(companyId: string, id: string) {
    await this.getById(companyId, id);
    return { parties: await partyGroupRepo.countParties(companyId, id) };
  }
}

// =============================================================
// Area
// =============================================================
export class AreaService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return areaRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await areaRepo.findById(companyId, id);
    if (!record) notFound('Area');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateAreaInput(data);
    if (errors.length) validationFailed('Area', errors);

    const existing = await areaRepo.findByName(companyId, data.areaName);
    if (existing) conflict(`Area '${data.areaName.trim()}' already exists.`);

    return areaRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateAreaInput(data, true);
    if (errors.length) validationFailed('Area', errors);

    if (data.areaName) {
      const existing = await areaRepo.findByName(companyId, data.areaName);
      if (existing && existing.id !== id) conflict(`Area '${data.areaName.trim()}' already exists.`);
    }

    return areaRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    if (!isActive) {
      const usage = await areaRepo.countParties(companyId, id);
      if (usage > 0) conflict(`Cannot deactivate: ${usage} party(ies) still use this area.`);
    }
    return areaRepo.update(companyId, id, { isActive });
  }

  async usage(companyId: string, id: string) {
    await this.getById(companyId, id);
    return { parties: await areaRepo.countParties(companyId, id) };
  }
}

// =============================================================
// Broker
// =============================================================
export class BrokerService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return brokerRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await brokerRepo.findById(companyId, id);
    if (!record) notFound('Broker');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateBrokerInput(data);
    if (errors.length) validationFailed('Broker', errors);

    const existing = await brokerRepo.findByCode(companyId, data.brokerCode);
    if (existing) conflict(`Broker code '${data.brokerCode.trim().toUpperCase()}' already exists.`);

    return brokerRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateBrokerInput(data, true);
    if (errors.length) validationFailed('Broker', errors);

    if (data.brokerCode) {
      const existing = await brokerRepo.findByCode(companyId, data.brokerCode);
      if (existing && existing.id !== id) {
        conflict(`Broker code '${data.brokerCode.trim().toUpperCase()}' already exists.`);
      }
    }

    return brokerRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    return brokerRepo.update(companyId, id, { isActive });
  }
}

// =============================================================
// Transporter
// =============================================================
export class TransporterService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return transporterRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await transporterRepo.findById(companyId, id);
    if (!record) notFound('Transporter');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateTransporterInput(data);
    if (errors.length) validationFailed('Transporter', errors);

    const existing = await transporterRepo.findByCode(companyId, data.transporterCode);
    if (existing) conflict(`Transporter code '${data.transporterCode.trim().toUpperCase()}' already exists.`);

    return transporterRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateTransporterInput(data, true);
    if (errors.length) validationFailed('Transporter', errors);

    if (data.transporterCode) {
      const existing = await transporterRepo.findByCode(companyId, data.transporterCode);
      if (existing && existing.id !== id) {
        conflict(`Transporter code '${data.transporterCode.trim().toUpperCase()}' already exists.`);
      }
    }

    return transporterRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    return transporterRepo.update(companyId, id, { isActive });
  }
}

// =============================================================
// Salesperson
// =============================================================
export class SalespersonService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return salespersonRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await salespersonRepo.findById(companyId, id);
    if (!record) notFound('Salesperson');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateSalespersonInput(data);
    if (errors.length) validationFailed('Salesperson', errors);

    const existing = await salespersonRepo.findByCode(companyId, data.salespersonCode);
    if (existing) conflict(`Salesperson code '${data.salespersonCode.trim().toUpperCase()}' already exists.`);

    return salespersonRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateSalespersonInput(data, true);
    if (errors.length) validationFailed('Salesperson', errors);

    if (data.salespersonCode) {
      const existing = await salespersonRepo.findByCode(companyId, data.salespersonCode);
      if (existing && existing.id !== id) {
        conflict(`Salesperson code '${data.salespersonCode.trim().toUpperCase()}' already exists.`);
      }
    }

    return salespersonRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    return salespersonRepo.update(companyId, id, { isActive });
  }
}

// =============================================================
// Item Group
// =============================================================
export class ItemGroupService {
  async list(companyId: string, options?: { search?: string; includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    return itemGroupRepo.findAll(companyId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await itemGroupRepo.findById(companyId, id);
    if (!record) notFound('Item group');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validateNamedGroupInput(data);
    if (errors.length) validationFailed('Item group', errors);

    const existing = await itemGroupRepo.findByName(companyId, data.groupName);
    if (existing) conflict(`Item group '${data.groupName.trim()}' already exists.`);

    return itemGroupRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    const errors = validateNamedGroupInput(data, true);
    if (errors.length) validationFailed('Item group', errors);

    if (data.groupName) {
      const existing = await itemGroupRepo.findByName(companyId, data.groupName);
      if (existing && existing.id !== id) conflict(`Item group '${data.groupName.trim()}' already exists.`);
    }

    return itemGroupRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    if (!isActive) {
      const usage = await itemGroupRepo.countItems(companyId, id);
      if (usage > 0) conflict(`Cannot deactivate: ${usage} item(s) still use this item group.`);
    }
    return itemGroupRepo.update(companyId, id, { isActive });
  }

  async usage(companyId: string, id: string) {
    await this.getById(companyId, id);
    return { items: await itemGroupRepo.countItems(companyId, id) };
  }
}

// =============================================================
// Purchase Book
// =============================================================
export class PurchaseBookService {
  async list(companyId: string, financialYearId?: string, options?: { includeInactive?: boolean }) {
    await assertActiveCompany(companyId);
    if (financialYearId) await assertFinancialYear(companyId, financialYearId);
    return purchaseBookRepo.findAll(companyId, financialYearId, options);
  }

  async getById(companyId: string, id: string) {
    await assertActiveCompany(companyId);
    const record = await purchaseBookRepo.findById(companyId, id);
    if (!record) notFound('Purchase book');
    return record;
  }

  async create(companyId: string, data: any) {
    await assertActiveCompany(companyId);
    const errors = validatePurchaseBookInput(data);
    if (errors.length) validationFailed('Purchase book', errors);
    await assertFinancialYear(companyId, data.financialYearId);

    const existingName = await purchaseBookRepo.findByName(companyId, data.financialYearId, data.bookName);
    if (existingName) conflict(`Purchase book '${data.bookName.trim()}' already exists in this financial year.`);

    const existingPrefix = await purchaseBookRepo.findByPrefix(companyId, data.financialYearId, data.prefix);
    if (existingPrefix) {
      conflict(`Purchase book prefix '${data.prefix.trim().toUpperCase()}' already exists in this financial year.`);
    }

    return purchaseBookRepo.create(companyId, data);
  }

  async update(companyId: string, id: string, data: any) {
    await assertActiveCompany(companyId);
    const book = await this.getById(companyId, id);
    const errors = validatePurchaseBookInput(data, true);
    if (errors.length) validationFailed('Purchase book', errors);

    if (data.bookName) {
      const existing = await purchaseBookRepo.findByName(companyId, book.financialYearId, data.bookName);
      if (existing && existing.id !== id) {
        conflict(`Purchase book '${data.bookName.trim()}' already exists in this financial year.`);
      }
    }

    if (data.prefix) {
      const existing = await purchaseBookRepo.findByPrefix(companyId, book.financialYearId, data.prefix);
      if (existing && existing.id !== id) {
        conflict(`Purchase book prefix '${data.prefix.trim().toUpperCase()}' already exists in this financial year.`);
      }
    }

    return purchaseBookRepo.update(companyId, id, data);
  }

  async setStatus(companyId: string, id: string, isActive: boolean) {
    await assertActiveCompany(companyId);
    await this.getById(companyId, id);
    if (!isActive) {
      const usage = await purchaseBookRepo.countBills(companyId, id);
      if (usage > 0) conflict(`Cannot deactivate: ${usage} purchase bill(s) still use this book.`);
    }
    return purchaseBookRepo.update(companyId, id, { isActive });
  }

  async usage(companyId: string, id: string) {
    await this.getById(companyId, id);
    return { purchaseBills: await purchaseBookRepo.countBills(companyId, id) };
  }
}