import { Request, Response, NextFunction } from 'express';
import { financialYearService } from '../services/financialYearService.js';

export const getFinancialYears = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const financialYears = await financialYearService.getByCompanyId(companyId);
    res.status(200).json({
      success: true,
      count: financialYears.length,
      data: financialYears,
    });
  } catch (error) {
    next(error);
  }
};

export const createFinancialYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const fy = await financialYearService.create(companyId, req.body);
    res.status(201).json({
      success: true,
      message: 'Financial Year created successfully.',
      data: fy,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFinancialYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const fy = await financialYearService.update(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Financial Year updated successfully.',
      data: fy,
    });
  } catch (error) {
    next(error);
  }
};

export const lockFinancialYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const fy = await financialYearService.setLock(id, true);
    res.status(200).json({
      success: true,
      message: 'Financial Year locked successfully.',
      data: fy,
    });
  } catch (error) {
    next(error);
  }
};

export const unlockFinancialYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const fy = await financialYearService.setLock(id, false);
    res.status(200).json({
      success: true,
      message: 'Financial Year unlocked successfully.',
      data: fy,
    });
  } catch (error) {
    next(error);
  }
};

