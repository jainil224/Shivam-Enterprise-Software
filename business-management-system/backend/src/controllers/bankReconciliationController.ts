// Phase 16 - Bank Reconciliation HTTP layer.
// Company and financial-year scope always come from the validated request
// headers, never from the body.

import { NextFunction, Request, Response } from 'express';
import { getCompanyId, getFinancialYearId } from './masterController.js';
import { bankReconciliationService } from '../services/bankReconciliationService.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function queryRecord(req: Request): Record<string, unknown> {
  return { ...asRecord(req.query), ...asRecord(req.body) };
}

export const bankReconciliationController = {
  listBanks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.listBanks(companyId, financialYearId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  load: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.load(
        companyId,
        financialYearId,
        queryRecord(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  saveOpeningBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.saveOpeningBalance(
        companyId,
        financialYearId,
        asRecord(req.body)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  saveStatementBalance: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.saveStatementBalance(
        companyId,
        financialYearId,
        asRecord(req.body)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  markReconciled: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.markReconciled(
        companyId,
        financialYearId,
        req.params.journalLineId,
        asRecord(req.body)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  removeClearing: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.removeClearing(
        companyId,
        financialYearId,
        req.params.journalLineId,
        asRecord(req.body)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  listTransactions: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.listTransactions(
        companyId,
        financialYearId,
        queryRecord(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getSummary: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.getSummary(
        companyId,
        financialYearId,
        queryRecord(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getStatement: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const data = await bankReconciliationService.getStatement(
        companyId,
        financialYearId,
        queryRecord(req)
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  exportPdf: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = getCompanyId(req);
      const financialYearId = getFinancialYearId(req);
      const { buffer, filename } = await bankReconciliationService.exportPdf(
        companyId,
        financialYearId,
        asRecord(req.body)
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('X-Report-Filename', filename);
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  },
};