import { Request, Response, NextFunction } from 'express';
import {
  PartyService,
  MachineService,
  OperatorService,
  LocationService,
  YarnQualityService,
  YarnGradeService,
  ProductionBookService,
} from '../services/masterServices.js';

const partyService = new PartyService();
const machineService = new MachineService();
const operatorService = new OperatorService();
const locationService = new LocationService();
const yarnQualityService = new YarnQualityService();
const yarnGradeService = new YarnGradeService();
const productionBookService = new ProductionBookService();

// Helper to extract companyId from header, query, or body
export function getCompanyId(req: Request): string {
  const cid =
    (req.headers['x-company-id'] as string) ||
    (req.query.companyId as string) ||
    req.body?.companyId;
  if (!cid) {
    const error: any = new Error('Active Company ID (x-company-id header or companyId query/body) is required.');
    error.statusCode = 400;
    throw error;
  }
  return cid;
}

// Helper to extract financialYearId
export function getFinancialYearId(req: Request): string {
  const fyId =
    (req.headers['x-financial-year-id'] as string) ||
    (req.query.financialYearId as string) ||
    req.body?.financialYearId;
  if (!fyId) {
    const error: any = new Error('Active Financial Year ID is required for production books.');
    error.statusCode = 400;
    throw error;
  }
  return fyId;
}

// =============================================================
// 1. Party Controller
// =============================================================
export const getParties = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const partyType = req.query.partyType as any;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await partyService.getParties(companyId, { search, partyType, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const getParty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await partyService.getPartyById(companyId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createParty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await partyService.createParty(companyId, req.body);
    res.status(201).json({ success: true, message: 'Party created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateParty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await partyService.updateParty(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Party updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setPartyStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await partyService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Party ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 2. Machine Controller
// =============================================================
export const getMachines = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await machineService.getMachines(companyId, { search, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createMachine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await machineService.createMachine(companyId, req.body);
    res.status(201).json({ success: true, message: 'Machine created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateMachine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await machineService.updateMachine(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Machine updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setMachineStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await machineService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Machine ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 3. Operator Controller
// =============================================================
export const getOperators = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await operatorService.getOperators(companyId, { search, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createOperator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await operatorService.createOperator(companyId, req.body);
    res.status(201).json({ success: true, message: 'Operator created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateOperator = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await operatorService.updateOperator(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Operator updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setOperatorStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await operatorService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Operator ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 4. Location Controller
// =============================================================
export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await locationService.getLocations(companyId, { search, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await locationService.createLocation(companyId, req.body);
    res.status(201).json({ success: true, message: 'Location created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await locationService.updateLocation(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Location updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setLocationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await locationService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Location ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 5. Yarn Quality Controller
// =============================================================
export const getYarnQualities = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await yarnQualityService.getYarnQualities(companyId, { search, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createYarnQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await yarnQualityService.createYarnQuality(companyId, req.body);
    res.status(201).json({ success: true, message: 'Yarn quality created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateYarnQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await yarnQualityService.updateYarnQuality(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Yarn quality updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setYarnQualityStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await yarnQualityService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Yarn quality ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 6. Yarn Grade Controller
// =============================================================
export const getYarnGrades = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await yarnGradeService.getYarnGrades(companyId, { search, includeInactive });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createYarnGrade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await yarnGradeService.createYarnGrade(companyId, req.body);
    res.status(201).json({ success: true, message: 'Yarn grade created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateYarnGrade = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await yarnGradeService.updateYarnGrade(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Yarn grade updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setYarnGradeStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await yarnGradeService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Yarn grade ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

// =============================================================
// 7. Production Book Controller
// =============================================================
export const getProductionBooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const search = req.query.search as string | undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const data = await productionBookService.getProductionBooks(companyId, financialYearId, {
      search,
      includeInactive,
    });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createProductionBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = req.body.financialYearId || (req.headers['x-financial-year-id'] as string);
    const data = await productionBookService.createProductionBook(companyId, {
      ...req.body,
      financialYearId,
    });
    res.status(201).json({ success: true, message: 'Production book created successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const updateProductionBook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const data = await productionBookService.updateProductionBook(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Production book updated successfully.', data });
  } catch (err) {
    next(err);
  }
};

export const setProductionBookStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const isActive = req.body.isActive === true;
    const data = await productionBookService.setStatus(companyId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Production book ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};

