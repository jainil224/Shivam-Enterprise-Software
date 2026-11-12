import { Request, Response, NextFunction } from 'express';
import { BankReceiptService } from '../services/bankReceiptService.js';
import { getCompanyId, getFinancialYearId } from './masterController.js';

const service = new BankReceiptService();

/**
 * Phase 18 controller.
 *
 * The create/update handlers fall through to the next router (Phase 12 single
 * line bank receipt) when the payload has no `lines` array. That keeps the old
 * single-line endpoint contract working while the new multi-row cheque receipt
 * endpoint lives under the same base path.
 */
function isMultiLinePayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as { lines?: unknown };
  return Array.isArray(candidate.lines);
}

export const bankReceiptController = {
  // ---------------------------------------------------------------- books
  listBooks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.listBooks(getCompanyId(req), getFinancialYearId(req));
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.getBook(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.createBook(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(201).json({
        success: true,
        message: `Bank receipt book ${data.bookName} created successfully.`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  updateBook: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.updateBook(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        req.body ?? {}
      );
      res.status(200).json({
        success: true,
        message: `Bank receipt book ${data.bookName} updated successfully.`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  // ---------------------------------------------------------- instruments
  listInstruments: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.listInstruments(getCompanyId(req), req.query);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  createInstrument: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.createInstrument(getCompanyId(req), req.body ?? {});
      res.status(201).json({
        success: true,
        message: `Bank name code ${data.code} created successfully.`,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------- lookups
  lookupParties: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.lookupParties(
        getCompanyId(req),
        getFinancialYearId(req),
        req.query
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  lookupAdjustmentAccounts: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.lookupAdjustmentAccounts(getCompanyId(req), req.query);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  outstandingBills: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.outstandingBills(
        getCompanyId(req),
        getFinancialYearId(req),
        req.query
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  validateAllocation: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.validateAllocation(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  adjustmentPreview: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.adjustmentPreview(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  validateAdjustment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.validateAdjustment(
        getCompanyId(req),
        getFinancialYearId(req),
        req.body ?? {}
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  getNextNumber: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = typeof req.query.bookId === 'string' ? req.query.bookId : '';
      const data = await service.getNextNumber(
        getCompanyId(req),
        getFinancialYearId(req),
        bookId
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  // ------------------------------------------------------------- vouchers
  create: async (req: Request, res: Response, next: NextFunction) => {
    if (!isMultiLinePayload(req.body)) {
      next();
      return;
    }
    try {
      const data = await service.create(getCompanyId(req), getFinancialYearId(req), req.body);
      res.status(201).json({
        success: true,
        message: 'Cheque receipt saved successfully.',
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    if (!isMultiLinePayload(req.body)) {
      next();
      return;
    }
    try {
      const data = await service.update(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id,
        req.body
      );
      res.status(200).json({
        success: true,
        message: 'Cheque receipt updated successfully.',
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  neighbours: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await service.neighbours(
        getCompanyId(req),
        getFinancialYearId(req),
        req.params.id
      );
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};