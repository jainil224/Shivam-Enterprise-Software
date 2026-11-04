import { Request, Response, NextFunction } from 'express';
import { BankVoucherType } from '@prisma/client';
import { BankVoucherService } from '../services/bankVoucherService.js';
import { getCompanyId, getFinancialYearId } from './masterController.js';

const service = new BankVoucherService();

export function createBankVoucherController(voucherType: BankVoucherType) {
  const label = voucherType === 'RECEIPT' ? 'Bank receipt' : 'Bank payment';

  return {
    getLookups: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.getLookups(companyId, financialYearId, voucherType);
        res.status(200).json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    getNextNumber: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.nextNumber(companyId, financialYearId, voucherType);
        res.status(200).json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    getSummary: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.statusSummary(companyId, financialYearId, voucherType);
        res.status(200).json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    list: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const result = await service.list(companyId, financialYearId, voucherType, req.query);
        res.status(200).json({
          success: true,
          data: result.items,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          totalAmount: result.totalAmount,
        });
      } catch (err) {
        next(err);
      }
    },

    getById: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.getById(companyId, financialYearId, voucherType, req.params.id);
        res.status(200).json({ success: true, data });
      } catch (err) {
        next(err);
      }
    },

    create: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.create(companyId, financialYearId, voucherType, req.body ?? {});
        res.status(201).json({
          success: true,
          message: `${label} ${data.voucherNumber} saved successfully.`,
          data,
        });
      } catch (err) {
        next(err);
      }
    },

    update: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.update(
          companyId,
          financialYearId,
          voucherType,
          req.params.id,
          req.body ?? {}
        );
        res.status(200).json({
          success: true,
          message: `${label} ${data.voucherNumber} updated successfully.`,
          data,
        });
      } catch (err) {
        next(err);
      }
    },

    cancel: async (req: Request, res: Response, next: NextFunction) => {
      try {
        const companyId = getCompanyId(req);
        const financialYearId = getFinancialYearId(req);
        const data = await service.cancel(
          companyId,
          financialYearId,
          voucherType,
          req.params.id,
          req.body?.reason
        );
        res.status(200).json({
          success: true,
          message: `${label} ${data.voucherNumber} cancelled and accounting reversed.`,
          data,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}