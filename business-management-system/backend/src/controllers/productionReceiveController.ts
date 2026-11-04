import { Request, Response, NextFunction } from 'express';
import { ProductionReceiveService } from '../services/productionReceiveService.js';
import { getCompanyId, getFinancialYearId } from './masterController.js';

const service = new ProductionReceiveService();

export const validateContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const productionBookId = (req.query.productionBookId as string) || req.body?.productionBookId;

    if (!productionBookId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Production Book ID is required for validation.' },
      });
    }

    const data = await service.validateContext(companyId, financialYearId, productionBookId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getNextNumbers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const productionBookId = (req.query.productionBookId as string) || req.body?.productionBookId;

    if (!productionBookId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Production Book ID is required.' },
      });
    }

    const data = await service.getNextNumbers(companyId, financialYearId, productionBookId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createProductionReceive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);

    const result = await service.createChallan(companyId, financialYearId, req.body);
    res.status(201).json({
      success: true,
      message: 'Production receive challan saved successfully.',
      data: result.challan,
      totals: result.totals,
    });
  } catch (err) {
    next(err);
  }
};

export const lookupProductionReceiveByChallanNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const productionBookId = (req.query.productionBookId as string) || req.body?.productionBookId;
    const challanNumber = (req.query.challanNumber as string) || req.body?.challanNumber;

    if (!productionBookId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Production Book ID is required.' },
      });
    }

    if (!challanNumber) {
      return res.status(400).json({
        success: false,
        error: { message: 'Challan number is required.' },
      });
    }

    const data = await service.getChallanByExactNumber(companyId, financialYearId, productionBookId, challanNumber);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getProductionReceiveById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const data = await service.getChallanById(companyId, id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateProductionReceive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const { id } = req.params;

    const result = await service.updateChallan(companyId, financialYearId, id, req.body);
    res.status(200).json({
      success: true,
      message: 'Production receive challan updated successfully.',
      data: result.challan,
      totals: result.totals,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelProductionReceive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const { id } = req.params;
    const { cancellationReason } = req.body;

    const data = await service.cancelChallan(companyId, financialYearId, id, cancellationReason);
    res.status(200).json({
      success: true,
      message: 'Production receive challan cancelled successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getProductionReceiveNavigation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const { id } = req.params;
    const productionBookId = req.query.productionBookId as string;

    const data = await service.getNavigation(companyId, financialYearId, productionBookId, id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const listProductionReceives = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const {
      productionBookId,
      search,
      challanNumber,
      partyId,
      machineId,
      lotNumber,
      fromDate,
      toDate,
      status,
      page,
      limit,
      sortOrder,
    } = req.query;

    const options: any = {
      bookId: productionBookId as string | undefined,
      search: search as string | undefined,
      challanNumber: challanNumber as string | undefined,
      partyId: partyId as string | undefined,
      machineId: machineId as string | undefined,
      lotNumber: lotNumber as string | undefined,
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
      status: status as any,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      sortOrder: sortOrder as any,
    };

    const result = await service.listChallansPaginated(companyId, financialYearId, options);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (err) {
    next(err);
  }
};

