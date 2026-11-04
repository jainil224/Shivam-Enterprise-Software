import { Request, Response, NextFunction } from 'express';
import { companyService } from '../services/companyService.js';

export const getCompanies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const includeInactive = req.query.includeInactive === 'true';

    const companies = await companyService.getAllCompanies(search, includeInactive);
    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const company = await companyService.getCompanyById(id);
    res.status(200).json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const createCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const company = await companyService.createCompany(req.body);
    res.status(201).json({
      success: true,
      message: 'Company created successfully.',
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const company = await companyService.updateCompany(id, req.body);
    res.status(200).json({
      success: true,
      message: 'Company updated successfully.',
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateCompany = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const company = await companyService.deactivateCompany(id);
    res.status(200).json({
      success: true,
      message: 'Company deactivated successfully.',
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const validateContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, financialYearId } = req.body;
    if (!companyId || !financialYearId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Both companyId and financialYearId are required.' },
      });
    }

    const context = await companyService.validateContext(companyId, financialYearId);
    res.status(200).json({
      success: true,
      data: context,
    });
  } catch (error) {
    next(error);
  }
};

