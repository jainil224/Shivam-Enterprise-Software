import { Request, Response, NextFunction } from 'express';
import { LedgerAccountGroup } from '@prisma/client';
import { LedgerAccountService } from '../services/ledgerAccountService.js';
import { getCompanyId, getFinancialYearId } from './masterController.js';

const service = new LedgerAccountService();

export const listLedgerAccounts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);

    const isBankParam = req.query.isBankAccount;
    const isBankAccount =
      isBankParam === 'true' ? true : isBankParam === 'false' ? false : undefined;

    const data = await service.list(companyId, financialYearId, {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      accountGroup:
        typeof req.query.accountGroup === 'string'
          ? (req.query.accountGroup as LedgerAccountGroup)
          : undefined,
      isBankAccount,
      includeInactive: req.query.includeInactive === 'true',
    });

    res.status(200).json({ success: true, data, count: data.length });
  } catch (err) {
    next(err);
  }
};

export const getLedgerAccountById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const data = await service.getById(companyId, financialYearId, req.params.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createLedgerAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const data = await service.create(companyId, req.body ?? {});
    res.status(201).json({
      success: true,
      message: 'Ledger account created successfully.',
      data: await service.getById(companyId, financialYearId, data.id),
    });
  } catch (err) {
    next(err);
  }
};

export const updateLedgerAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const data = await service.update(companyId, financialYearId, req.params.id, req.body ?? {});
    res.status(200).json({
      success: true,
      message: 'Ledger account updated successfully.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const setLedgerAccountStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = getCompanyId(req);
    const financialYearId = getFinancialYearId(req);
    const isActive = req.body?.isActive;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'isActive boolean is required.' },
      });
    }
    const data = await service.setActive(companyId, financialYearId, req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Ledger account ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data,
    });
  } catch (err) {
    next(err);
  }
};