import { Prisma } from '@prisma/client';
import { ProductionReceiveRepository } from '../repositories/productionReceiveRepository.js';
import { PartyRepository, MachineRepository, OperatorRepository, LocationRepository, YarnQualityRepository, YarnGradeRepository } from '../repositories/masterRepositories.js';
import { calculateCartonWeight, calculateTotals, CartonWeightInput, CalculatedCartonWeight } from '../utils/weightCalculations.js';

const repo = new ProductionReceiveRepository();
const partyRepo = new PartyRepository();
const machineRepo = new MachineRepository();
const operatorRepo = new OperatorRepository();
const locationRepo = new LocationRepository();
const yarnQualityRepo = new YarnQualityRepository();
const yarnGradeRepo = new YarnGradeRepository();

export interface SaveChallanPayload {
  productionBookId: string;
  challanNumber: string;
  challanDate: string | Date;
  partyId?: string | null;
  machineId?: string | null;
  operatorId?: string | null;
  yarnQualityId?: string | null;
  yarnGradeId?: string | null;
  lotNumber?: string | null;
  twist?: string | null;
  emptyCopsWeight: number | string;
  locationId?: string | null;
  remarks?: string | null;
  items: CartonWeightInput[];
}

export class ProductionReceiveService {
  /**
   * Validate all contexts for the entry form.
   */
  async validateContext(companyId: string, financialYearId: string, productionBookId: string) {
    if (!companyId || !financialYearId || !productionBookId) {
      const err: any = new Error('Company ID, Financial Year ID, and Production Book ID are required.');
      err.statusCode = 400;
      throw err;
    }
    return repo.validateContext(companyId, financialYearId, productionBookId);
  }

  /**
   * Get suggestions for next challan number and carton number.
   */
  async getNextNumbers(companyId: string, financialYearId: string, productionBookId: string) {
    await this.validateContext(companyId, financialYearId, productionBookId);
    return repo.getNextNumbers(companyId, financialYearId, productionBookId);
  }

  /**
   * Authoritative Challan validation and atomic transaction save.
   */
  async createChallan(companyId: string, financialYearId: string, payload: SaveChallanPayload) {
    // 1. Validate Company, FY, and Production Book
    const { financialYear, productionBook } = await this.validateContext(
      companyId,
      financialYearId,
      payload.productionBookId
    );

    // 2. Validate Challan Number
    const challanNum = payload.challanNumber?.trim();
    if (!challanNum) {
      const err: any = new Error('Challan number is required.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate Date within Financial Year range
    const challanDate = new Date(payload.challanDate || new Date());
    if (isNaN(challanDate.getTime())) {
      const err: any = new Error('Invalid challan date.');
      err.statusCode = 400;
      throw err;
    }

    const fyStart = new Date(financialYear.startDate);
    const fyEnd = new Date(financialYear.endDate);
    // Compare YYYY-MM-DD
    const dateStr = challanDate.toISOString().slice(0, 10);
    const startStr = fyStart.toISOString().slice(0, 10);
    const endStr = fyEnd.toISOString().slice(0, 10);

    if (dateStr < startStr || dateStr > endStr) {
      const err: any = new Error(
        `Challan date (${dateStr}) must fall within active financial year '${financialYear.yearName}' (${startStr} to ${endStr}).`
      );
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate Master References (company isolation + active status)
    if (payload.partyId) {
      const party = await partyRepo.findById(companyId, payload.partyId);
      if (!party) {
        const err: any = new Error('Selected party does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!party.isActive) {
        const err: any = new Error(`Party '${party.partyName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.machineId) {
      const machine = await machineRepo.findById(companyId, payload.machineId);
      if (!machine) {
        const err: any = new Error('Selected machine does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!machine.isActive) {
        const err: any = new Error(`Machine '${machine.machineName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.operatorId) {
      const operator = await operatorRepo.findById(companyId, payload.operatorId);
      if (!operator) {
        const err: any = new Error('Selected operator does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!operator.isActive) {
        const err: any = new Error(`Operator '${operator.operatorName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.yarnQualityId) {
      const quality = await yarnQualityRepo.findById(companyId, payload.yarnQualityId);
      if (!quality) {
        const err: any = new Error('Selected yarn quality does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!quality.isActive) {
        const err: any = new Error(`Yarn quality '${quality.qualityName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.yarnGradeId) {
      const grade = await yarnGradeRepo.findById(companyId, payload.yarnGradeId);
      if (!grade) {
        const err: any = new Error('Selected yarn grade does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!grade.isActive) {
        const err: any = new Error(`Yarn grade '${grade.gradeName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (payload.locationId) {
      const loc = await locationRepo.findById(companyId, payload.locationId);
      if (!loc) {
        const err: any = new Error('Selected location does not exist in this company.');
        err.statusCode = 400;
        throw err;
      }
      if (!loc.isActive) {
        const err: any = new Error(`Location '${loc.locationName}' is inactive.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 5. Validate Carton Rows
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      const err: any = new Error('At least one carton row is required to save a production challan.');
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate carton numbers within submission
    const seenCartons = new Set<string>();
    const calculatedItems: CalculatedCartonWeight[] = [];

    for (const rawItem of payload.items) {
      const cNum = rawItem.cartonNumber?.toString().trim();
      if (!cNum) {
        const err: any = new Error('Each carton row must have a valid carton number.');
        err.statusCode = 400;
        throw err;
      }
      if (seenCartons.has(cNum)) {
        const err: any = new Error(`Duplicate carton number '${cNum}' in the same challan.`);
        err.statusCode = 400;
        throw err;
      }
      seenCartons.add(cNum);

      try {
        const calculated = calculateCartonWeight({
          ...rawItem,
          // If row lacks copsWeight, default from header
          copsWeight: rawItem.copsWeight !== undefined && rawItem.copsWeight !== null && rawItem.copsWeight !== ''
            ? rawItem.copsWeight
            : payload.emptyCopsWeight,
          // Defaults from header
          twist: rawItem.twist || payload.twist,
          lotNumber: rawItem.lotNumber || payload.lotNumber,
          grade: rawItem.grade || undefined,
        });
        calculatedItems.push(calculated);
      } catch (calcErr: any) {
        const err: any = new Error(calcErr.message || 'Carton calculation failed.');
        err.statusCode = 400;
        throw err;
      }
    }

    // 6. Calculate summary totals
    const totals = calculateTotals(calculatedItems);

    // 7. Atomic transaction create
    const emptyCopsWgt = new Prisma.Decimal(payload.emptyCopsWeight || 0).toDecimalPlaces(3);

    const saved = await repo.create({
      companyId,
      financialYearId,
      productionBookId: payload.productionBookId,
      challanNumber: challanNum,
      challanDate,
      partyId: payload.partyId || null,
      machineId: payload.machineId || null,
      operatorId: payload.operatorId || null,
      yarnQualityId: payload.yarnQualityId || null,
      yarnGradeId: payload.yarnGradeId || null,
      lotNumber: payload.lotNumber || null,
      twist: payload.twist || null,
      emptyCopsWeight: emptyCopsWgt,
      locationId: payload.locationId || null,
      remarks: payload.remarks || null,
      items: calculatedItems,
    });

    return {
      challan: saved,
      totals,
    };
  }

  /**
   * Update an existing challan with full validation and authoritative recalculation.
   */
  async updateChallan(
    companyId: string,
    financialYearId: string,
    id: string,
    payload: Partial<SaveChallanPayload>
  ) {
    const existing = await repo.findById(companyId, id);
    if (!existing) {
      const err: any = new Error('Production challan not found.');
      err.statusCode = 404;
      throw err;
    }

    if (existing.financialYearId !== financialYearId) {
      const err: any = new Error('Cannot edit a challan belonging to another financial year.');
      err.statusCode = 400;
      throw err;
    }

    if (existing.status === 'CANCELLED') {
      const err: any = new Error('Cannot edit a cancelled production challan.');
      err.statusCode = 400;
      throw err;
    }

    if (existing.financialYear?.isLocked) {
      const err: any = new Error(
        `Financial year '${existing.financialYear.yearName}' is locked for edits.`
      );
      err.statusCode = 403;
      throw err;
    }

    // 1. Validate Challan Number if changed
    const challanNum = payload.challanNumber ? payload.challanNumber.trim() : existing.challanNumber;
    if (!challanNum) {
      const err: any = new Error('Challan number is required.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate Challan Date
    let challanDate = existing.challanDate;
    if (payload.challanDate) {
      const parsedDate = new Date(payload.challanDate);
      if (isNaN(parsedDate.getTime())) {
        const err: any = new Error('Invalid challan date.');
        err.statusCode = 400;
        throw err;
      }
      challanDate = parsedDate;
    }

    const fyStart = new Date(existing.financialYear.startDate);
    const fyEnd = new Date(existing.financialYear.endDate);
    const dateStr = challanDate.toISOString().slice(0, 10);
    const startStr = fyStart.toISOString().slice(0, 10);
    const endStr = fyEnd.toISOString().slice(0, 10);

    if (dateStr < startStr || dateStr > endStr) {
      const err: any = new Error(
        `Challan date (${dateStr}) must fall within financial year '${existing.financialYear.yearName}' (${startStr} to ${endStr}).`
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Re-validate masters
    const partyId = payload.partyId !== undefined ? payload.partyId : existing.partyId;
    if (partyId) {
      const party = await partyRepo.findById(companyId, partyId);
      if (!party || !party.isActive) {
        const err: any = new Error('Selected party is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    const machineId = payload.machineId !== undefined ? payload.machineId : existing.machineId;
    if (machineId) {
      const machine = await machineRepo.findById(companyId, machineId);
      if (!machine || !machine.isActive) {
        const err: any = new Error('Selected machine is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    const operatorId = payload.operatorId !== undefined ? payload.operatorId : existing.operatorId;
    if (operatorId) {
      const operator = await operatorRepo.findById(companyId, operatorId);
      if (!operator || !operator.isActive) {
        const err: any = new Error('Selected operator is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    const yarnQualityId = payload.yarnQualityId !== undefined ? payload.yarnQualityId : existing.yarnQualityId;
    if (yarnQualityId) {
      const quality = await yarnQualityRepo.findById(companyId, yarnQualityId);
      if (!quality || !quality.isActive) {
        const err: any = new Error('Selected yarn quality is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    const yarnGradeId = payload.yarnGradeId !== undefined ? payload.yarnGradeId : existing.yarnGradeId;
    if (yarnGradeId) {
      const grade = await yarnGradeRepo.findById(companyId, yarnGradeId);
      if (!grade || !grade.isActive) {
        const err: any = new Error('Selected yarn grade is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    const locationId = payload.locationId !== undefined ? payload.locationId : existing.locationId;
    if (locationId) {
      const loc = await locationRepo.findById(companyId, locationId);
      if (!loc || !loc.isActive) {
        const err: any = new Error('Selected location is invalid or inactive.');
        err.statusCode = 400;
        throw err;
      }
    }

    // 4. Validate and Recalculate Carton Items
    const rawItems = payload.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      const err: any = new Error('At least one carton row is required.');
      err.statusCode = 400;
      throw err;
    }

    const emptyCopsWgtVal = payload.emptyCopsWeight !== undefined ? payload.emptyCopsWeight : existing.emptyCopsWeight;
    const twistVal = payload.twist !== undefined ? payload.twist : existing.twist;
    const lotNumberVal = payload.lotNumber !== undefined ? payload.lotNumber : existing.lotNumber;

    const seenCartons = new Set<string>();
    const calculatedItems: CalculatedCartonWeight[] = [];

    for (const rawItem of rawItems) {
      const cNum = rawItem.cartonNumber?.toString().trim();
      if (!cNum) {
        const err: any = new Error('Each carton row must have a valid carton number.');
        err.statusCode = 400;
        throw err;
      }
      if (seenCartons.has(cNum)) {
        const err: any = new Error(`Duplicate carton number '${cNum}' in the same challan.`);
        err.statusCode = 400;
        throw err;
      }
      seenCartons.add(cNum);

      try {
        const calculated = calculateCartonWeight({
          ...rawItem,
          copsWeight: rawItem.copsWeight !== undefined && rawItem.copsWeight !== null && rawItem.copsWeight !== ''
            ? rawItem.copsWeight
            : emptyCopsWgtVal.toString(),
          twist: rawItem.twist || twistVal,
          lotNumber: rawItem.lotNumber || lotNumberVal,
          grade: rawItem.grade || undefined,
        });
        calculatedItems.push(calculated);
      } catch (calcErr: any) {
        const err: any = new Error(calcErr.message || 'Carton calculation failed.');
        err.statusCode = 400;
        throw err;
      }
    }

    const totals = calculateTotals(calculatedItems);
    const emptyCopsDecimal = new Prisma.Decimal(emptyCopsWgtVal || 0).toDecimalPlaces(3);

    const updated = await repo.update(companyId, id, {
      challanNumber: challanNum,
      challanDate,
      partyId,
      machineId,
      operatorId,
      yarnQualityId,
      yarnGradeId,
      lotNumber: lotNumberVal,
      twist: twistVal,
      emptyCopsWeight: emptyCopsDecimal,
      locationId,
      remarks: payload.remarks !== undefined ? payload.remarks : existing.remarks,
      items: calculatedItems,
    });

    return {
      challan: updated,
      totals,
    };
  }

  /**
   * Cancel a challan with required reason.
   */
  async cancelChallan(companyId: string, financialYearId: string, id: string, cancellationReason: string) {
    if (!cancellationReason || !cancellationReason.trim()) {
      const err: any = new Error('A non-empty cancellation reason is required.');
      err.statusCode = 400;
      throw err;
    }

    const existing = await repo.findById(companyId, id);
    if (!existing) {
      const err: any = new Error('Production challan not found.');
      err.statusCode = 404;
      throw err;
    }

    if (existing.financialYearId !== financialYearId) {
      const err: any = new Error('Cannot cancel a challan belonging to another financial year.');
      err.statusCode = 400;
      throw err;
    }

    return repo.cancel(companyId, id, cancellationReason);
  }

  /**
   * Get deterministic Prev and Next record IDs for navigation.
   */
  async getNavigation(companyId: string, financialYearId: string, productionBookId: string, id: string) {
    if (!productionBookId) {
      const err: any = new Error('Production Book ID is required for navigation.');
      err.statusCode = 400;
      throw err;
    }
    return repo.getNavigation(companyId, financialYearId, productionBookId, id);
  }

  /**
   * List challans with search, filtering, and pagination.
   */
  async listChallansPaginated(companyId: string, financialYearId: string, options: any) {
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (options?.fromDate) {
      fromDate = new Date(options.fromDate);
      if (isNaN(fromDate.getTime())) fromDate = undefined;
    }
    if (options?.toDate) {
      toDate = new Date(options.toDate);
      if (isNaN(toDate.getTime())) toDate = undefined;
    }

    return repo.findAllPaginated(companyId, financialYearId, {
      ...options,
      fromDate,
      toDate,
    });
  }

  /**
   * Get challan by ID with company isolation.
   */
  async getChallanById(companyId: string, id: string) {
    const record = await repo.findById(companyId, id);
    if (!record) {
      const err: any = new Error('Production challan not found.');
      err.statusCode = 404;
      throw err;
    }
    return record;
  }

  async getChallanByExactNumber(
    companyId: string,
    financialYearId: string,
    productionBookId: string,
    challanNumber: string
  ) {
    const normalized = challanNumber?.trim();
    if (!normalized) {
      const err: any = new Error('Challan number is required.');
      err.statusCode = 400;
      throw err;
    }

    await this.validateContext(companyId, financialYearId, productionBookId);
    return repo.findExactByChallanNumber(companyId, financialYearId, productionBookId, normalized);
  }

  /**
   * List challans for company & FY.
   */
  async listChallans(companyId: string, financialYearId: string, options?: { bookId?: string }) {
    return repo.findAll(companyId, financialYearId, options);
  }
}

